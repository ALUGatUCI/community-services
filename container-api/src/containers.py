import asyncio
import enum

from core import client

import database

import config

from shacrypt import shacrypt

from pylxd.managers import ContainerManager

public_ip = config.get_env_var("PUBLIC_IP")


class AddPortResult(enum.Enum):
    """Possible outcomes of attempting to add a forward port."""
    OK = "ok"
    NOT_FOUND = "not_found"
    INVALID_PORT = "invalid_port"
    IN_USE = "in_use"
    RESERVED_NAME = "reserved_name"


async def _get_container_by_ucinetid(ucinetid: str):
    containers = await asyncio.to_thread(client.containers.all)

    for container in containers:
        if container.name == ucinetid:
            return container

    return None

async def _suspend_container_by_ucinetid(ucinetid: str):
    container = await _get_container_by_ucinetid(ucinetid)
    if container is not None:
        await asyncio.to_thread(container.freeze)

    return None

async def _unsuspend_container_by_ucinetid(ucinetid: str):
    container = await _get_container_by_ucinetid(ucinetid)
    if container is not None:
        await asyncio.to_thread(container.unfreeze)

    return None

async def _delete_container_by_ucinetid(ucinetid: str):
    container = await _get_container_by_ucinetid(ucinetid)
    if container is not None:
        # The container may already be stopped, so we use a try-except block to avoid errors
        if container.status.lower() != "exited":
            await asyncio.to_thread(container.stop, wait=True)

        await asyncio.to_thread(container.delete, wait=True)

async def _get_container_count() -> int:
    return await database.get_container_count()

def _get_forward_ports(container: ContainerManager):
    used_ports = []

    for device in container.devices.items():
        if device[1]["type"] == "proxy" and device[0] != "ssh-forward":
            used_ports.append(tuple(device))

    return used_ports


async def create_new_container(ucinetid: str, password: str) -> None:
    """Create and start a new container for the account.

    The supplied password is used as the account's temporary login password
    (hashed before it is handed to cloud-init). An SSH port is allocated so it
    won't collide with existing containers, and the port assignments are
    recorded in the database.
    """
    # Don't clobber an account that already has a container
    if await _get_container_by_ucinetid(ucinetid) is not None:
        raise ValueError(f"A container already exists for {ucinetid}")

    # Allocate an SSH port that won't collide with existing containers by
    # taking the highest assigned port and incrementing from there. The gap of
    # 10 leaves room for each account's forward ports.
    max_ssh_port = await database.get_max_ssh_port()
    next_ssh_port = 10000 if max_ssh_port is None else max_ssh_port + 10
    forward_ports = list(range(next_ssh_port + 1, next_ssh_port + 10))

    # Use the given password as the temporary login password
    hashed_password = shacrypt(password.encode("utf-8"))

    container_config = {
        "name": ucinetid,
        "type": "container",
        "ephemeral": False,
        "source": {
            "type": "image",
            "fingerprint": config.get_env_var("FINGERPRINT_IMAGE"),
        },
        "config": {
            "limits.cpu": f"{config.get_env_var('CPU_LIMIT')}",
            "limits.memory": f"{config.get_env_var('RAM_LIMIT')}GiB",
            "user.user-data": (
                "#cloud-config\n"
                "ssh_pwauth: True\n"
                "users:\n"
                f"  - name: {ucinetid}\n"                 # The username
                "    sudo: ALL=(ALL) NOPASSWD:ALL\n"      # Gives the user sudo rights
                "    shell: /bin/bash\n"
                "    lock_passwd: false\n"                # Crucial: allows password login
                f"    passwd: {hashed_password}\n"        # Hashed password
                "chpasswd:\n"
                "  list: |\n"
                f"    {ucinetid}:{hashed_password}\n"     # Redundant but ensures it sets
                "  expire: True\n"                        # Force a password change on first login
                "runcmd:\n"
                "  - systemctl enable --now ssh\n"
            ),
        },
        "devices": {
            "root": {
                "type": "disk",
                "path": "/",
                "pool": "default",
                "size": f"{config.get_env_var('DISK_LIMIT')}GiB",
            },
            # SSH Port Forwarding (Proxy Device)
            "ssh-forward": {
                "type": "proxy",
                "listen": f"tcp:0.0.0.0:{next_ssh_port}",  # Port on the HOST
                "connect": "tcp:127.0.0.1:22",  # Port inside the CONTAINER
            },
        },
    }

    # Create and start the actual container
    instance = await asyncio.to_thread(
        client.containers.create, container_config, wait=True
    )
    await asyncio.to_thread(instance.start)

    # Record the port assignments only once the container is up. If this fails,
    # tear the container back down so we don't leave an untracked instance.
    try:
        await database.insert_container(ucinetid, next_ssh_port, forward_ports)
    except Exception:
        await _delete_container_by_ucinetid(ucinetid)
        raise


async def get_container_count() -> int:
    """Return the number of containers tracked on this node."""
    return await database.get_container_count()


async def at_limit() -> bool:
    acc_limit = config.get_env_var("ACC_LIMIT")
    if acc_limit is None:
        return False

    try:
        return await get_container_count() >= int(acc_limit)
    except ValueError:
        raise ValueError("Could not parse acc_limit")
    except Exception as e:
        raise e


async def delete_container(ucinetid: str) -> bool:
    """Stop and delete the account's container, and remove its port records.

    Returns True if a container was deleted, False if no container exists for
    the account.
    """
    if await _get_container_by_ucinetid(ucinetid) is None:
        return False

    await _delete_container_by_ucinetid(ucinetid)
    await database.delete_container(ucinetid)

    return True


async def container_exists(ucinetid: str) -> bool:
    """Return whether a container exists for the account."""
    return await _get_container_by_ucinetid(ucinetid) is not None


async def get_connection_address(ucinetid: str) -> str | None:
    """Return the SSH connection address for the account's container.

    Returns None if no container exists for the account.
    """
    if await _get_container_by_ucinetid(ucinetid) is None:
        return None

    port = await database.get_ssh_port(ucinetid)

    return f"ssh {ucinetid}@{public_ip} -p {port}"


async def get_container_status(ucinetid: str) -> str | None:
    """Return the status of the account's container, or None if it does not exist."""
    container = await _get_container_by_ucinetid(ucinetid)
    if container is None:
        return None

    return container.status


async def start_container(ucinetid: str) -> bool | None:
    """Start the account's container.

    Returns True on success, False if the operation failed, or None if no
    container exists for the account.
    """
    container = await _get_container_by_ucinetid(ucinetid)
    if container is None:
        return None

    try:
        await asyncio.to_thread(container.start)
        return True
    except Exception:
        return False


async def stop_container(ucinetid: str) -> bool | None:
    """Stop the account's container.

    Returns True on success, False if the operation failed, or None if no
    container exists for the account.
    """
    container = await _get_container_by_ucinetid(ucinetid)
    if container is None:
        return None

    try:
        await asyncio.to_thread(container.stop)
        return True
    except Exception:
        return False


async def restart_container(ucinetid: str) -> bool | None:
    """Restart the account's container.

    Returns True on success, False if the operation failed, or None if no
    container exists for the account.
    """
    container = await _get_container_by_ucinetid(ucinetid)
    if container is None:
        return None

    try:
        await asyncio.to_thread(container.restart)
        return True
    except Exception:
        return False


async def add_forward_port(
    ucinetid: str, name: str, listen: int, connect: int
) -> AddPortResult:
    """Add a forward port to the account's container.

    Returns an AddPortResult describing the outcome.
    """
    container = await _get_container_by_ucinetid(ucinetid)
    if container is None:
        return AddPortResult.NOT_FOUND

    # Validate that the given listening port is one of the account's allowed ports
    forward_ports = await database.get_forward_ports(ucinetid)
    if listen not in forward_ports:
        return AddPortResult.INVALID_PORT

    # Validate that the port isn't already in use
    for forward_port in _get_forward_ports(container):
        if str(listen) in forward_port[1]["listen"] and (
            name != forward_port[0]
        ):  # Triggers if listening port is the same and name isn't different
            return AddPortResult.IN_USE

    # Prevent the user from overiding the CRITICAL devices
    if name == "ssh-port" or name == "root":
        return AddPortResult.RESERVED_NAME

    container.devices[name] = {
        "type": "proxy",
        "listen": f"tcp:0.0.0.0:{listen}",  # Port on the HOST
        "connect": f"tcp:127.0.0.1:{connect}",  # Port inside the CONTAINER
    }
    container.save()

    return AddPortResult.OK


async def remove_forward_port(ucinetid: str, name: str) -> bool | None:
    """Remove a named forward port from the account's container.

    Returns True if the port was removed, False if the name was invalid, or
    None if no container exists for the account.
    """
    container = await _get_container_by_ucinetid(ucinetid)
    if container is None:
        return None

    # BE SURE THEY CANNOT REMOVE 'ssh-forward' or 'root' TO PREVENT INACCESSIBILITY
    if (
        name != "ssh-forward"
        and name != "root"
        and name in container.devices.keys()
    ):
        del container.devices[name]
        container.save()
        return True

    return False


async def list_forward_ports(ucinetid: str) -> list | None:
    """Return the list of used forward ports, or None if no container exists."""
    container = await _get_container_by_ucinetid(ucinetid)
    if container is None:
        return None

    return _get_forward_ports(container)


async def get_valid_ports(ucinetid: str) -> list[int] | None:
    """Return the account's allowed forward ports, or None if no container exists."""
    if await _get_container_by_ucinetid(ucinetid) is None:
        return None

    return await database.get_forward_ports(ucinetid)
