import asyncio
import enum

from core import client

import database

import config

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
