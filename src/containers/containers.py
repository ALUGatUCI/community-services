import asyncio

import fastapi
import httpx
from fastapi import Depends

import containers.responses as responses
import database.containers as db_containers
import database.database as database
from fastapi import Request
import security
from containers.body import AddPort, RemovePort
from database.containers import get_container_count as get_container_count_db
from containers.core import client
from database.models import Account, Container
from database.remote.actions import update_user

router = fastapi.APIRouter()

public_ip = None
# Get the public IP address of the server
with httpx.Client() as httpx_client:
    try:
        response = httpx_client.get("https://api.ipify.org?format=json")
        response.raise_for_status()
        public_ip = response.json()["ip"]
    except:
        public_ip = None

async def get_container_by_ucinetid(ucinetid: str):
    containers = await asyncio.to_thread(client.containers.all)

    for container in containers:
        if container.name == ucinetid:
            return container

    return None

async def suspend_container_by_ucinetid(ucinetid: str):
    container = await get_container_by_ucinetid(ucinetid)
    if container is not None:
        await asyncio.to_thread(container.freeze)

    return None

async def unsuspend_container_by_ucinetid(ucinetid: str):
    container = await get_container_by_ucinetid(ucinetid)
    if container is not None:
        await asyncio.to_thread(container.unfreeze)

    return None

async def delete_container_by_ucinetid(ucinetid: str):
    container = await get_container_by_ucinetid(ucinetid)
    if container is not None:
        # The container may already be stopped, so we use a try-except block to avoid errors
        if container.status.lower() != "exited":
            await asyncio.to_thread(container.stop, wait=True)

        await asyncio.to_thread(container.delete, wait=True)
        # Delete container from the database
        db_containers.delete_container(ucinetid)

    update_user(f"{ucinetid}@uci.edu", has__container=False)

def get_container_count() -> int:
    return get_container_count_db()

def _get_forward_ports(container: client.containers):
    used_ports = []

    for device in container.devices.items():
        if device[1]["type"] == "proxy" and device[0] != "ssh-forward":
            used_ports.append(tuple(device))

    return used_ports


@router.get("/exists")
async def check_container_exists(token: Request):
    """Checks if a container exists for the account"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    container = await get_container_by_ucinetid(ucinetid)

    if container is None:
        return responses.ContainerExists(success=True, exists=False)
    else:
        return responses.ContainerExists(success=True, exists=True)


@router.get("/address", response_model=responses.ContainerAddress)
async def get_container_connection_port(token: Request):
    """Get the address of the account's container"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if await get_container_by_ucinetid(ucinetid) is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    # Now get the assigned port of the container
    session = database.session

    statement = (
        select(Container.ssh_port)
        .join(Account, Container.id == Account.id)
        .where(Account.email == f"{ucinetid}@uci.edu")
    )
    port = session.exec(statement).first()

    return responses.ContainerAddress(success=True, address=f"ssh {ucinetid}@{public_ip} -p {port}")


@router.get("/status", response_model=responses.ContainerStatus)
async def container_status(token: Request):
    """Get the status of the current container"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    container = await get_container_by_ucinetid(ucinetid)
    if container is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    # Get the list of containers
    containers = await asyncio.to_thread(client.containers.all)

    for container in containers:
        if container.name == ucinetid:
            return responses.ContainerStatus(success=True, status=container.status)

    return responses.ContainerStatus(success=False, status=None)


@router.put("/start", response_model=responses.ContainerAction)
async def container_start(token: Request):
    """Start the named container"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if get_container_by_ucinetid(ucinetid) is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    containers = await asyncio.to_thread(client.containers.all)
    for container in containers:
        if container.name == ucinetid:
            try:
                await asyncio.to_thread(container.start)
                return responses.ContainerAction(
                    success=True, message="Sent start request"
                )
            except:
                return responses.ContainerAction(
                    success=True, message="Something went wrong"
                )

    return responses.ContainerAction(success=False, message="Server not found")


@router.put("/stop", response_model=responses.ContainerAction)
async def container_stop(token: Request):
    """Stop the named container"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if get_container_by_ucinetid(ucinetid) is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    containers = await asyncio.to_thread(client.containers.all)
    for container in containers:
        if container.name == ucinetid:
            try:
                await asyncio.to_thread(container.stop)
                return responses.ContainerAction(
                    success=True, message="Sent stop request"
                )
            except:
                return responses.ContainerAction(
                    success=False, message="Something went wrong"
                )

    return responses.ContainerAction(success=False, message="Server not found")


@router.put("/restart", response_model=responses.ContainerAction)
async def container_restart(token: Request):
    """Restart the named container"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if get_container_by_ucinetid(ucinetid) is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    containers = await asyncio.to_thread(client.containers.all)
    for container in containers:
        if container.name == ucinetid:
            try:
                await asyncio.to_thread(container.restart)
                return responses.ContainerAction(
                    success=True, message="Sent restart request"
                )
            except:
                return responses.ContainerAction(
                    success=False, message="Something went wrong"
                )

    return responses.ContainerAction(success=False, message="Server not found")


@router.post("/port/add", response_model=responses.ContainerAction)
async def add_port(token: Request, new_forward: AddPort = Depends(),):
    """Add forward port to the container"""

    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if get_container_by_ucinetid(ucinetid) is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    containers = await asyncio.to_thread(client.containers.all)
    for container in containers:
        if container.name == ucinetid:
            session = database.session

            # Start by getting the account info
            acc_statement = select(Account).where(
                Account.email == f"{ucinetid}@uci.edu"
            )
            account = session.exec(acc_statement).first()

            # Now get the ID to get the associated container's info
            account_id = account.id
            cont_statement = select(Container).where(Container.id == account_id)
            container_data = session.exec(cont_statement).first()

            # Now validate that the given listening port is in the list
            if new_forward.listen not in container_data.forward_ports:
                raise fastapi.HTTPException(
                    status_code=400, detail="An invalid port was specified"
                )

            # Also validate that the port isn't already in use
            for forward_port in _get_forward_ports(container):
                if str(new_forward.listen) in forward_port[1]["listen"] and (
                    new_forward.name != forward_port[0]
                ):  # Triggers if listening port is the same and name isn't different
                    raise fastapi.HTTPException(
                        status_code=400, detail="The port is already in use"
                    )

            new_port_map = {
                "type": "proxy",
                "listen": f"tcp:0.0.0.0:{new_forward.listen}",  # Port on the HOST
                "connect": f"tcp:127.0.0.1:{new_forward.connect}",  # Port inside the CONTAINER
            }

            # Prevent the user from overiding the CRITICAL devices
            if new_forward.name != "ssh-port" and new_forward.name != "root":
                container.devices[new_forward.name] = new_port_map
                container.save()
                return responses.ContainerAction(
                    success=True, message="Sent forward port added"
                )
            else:
                raise fastapi.HTTPException(
                    status_code=403,
                    detail="Attempted to add port with the same name as another device",
                )


@router.delete("/port/delete", response_model=responses.ContainerAction)
async def remove_port(
    token: Request,
    remove: RemovePort = Depends(),
):
    """Removes a specified port"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if get_container_by_ucinetid(ucinetid) is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    containers = await asyncio.to_thread(client.containers.all)
    for container in containers:
        if container.name == ucinetid:
            # Now check if the named port is in the devices dictioanary
            # BE SURE THEY CANNOT REMOVE 'ssh-forward' or 'root' TO PREVENT INACCESSIBILITY
            if (
                remove.name != "ssh-forward"
                and remove.name != "root"
                and remove.name in container.devices.keys()
            ):
                del container.devices[remove.name]
                container.save()

                return responses.ContainerAction(
                    success=True, message="Sent delete request"
                )
            else:
                return responses.ContainerAction(
                    success=False, message="Named port is invalid"
                )


@router.get("/port/list", response_model=responses.PortsList)
async def get_used_port_list(token: Request):
    """Retrieves a list of all used forwarding ports"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if await get_container_by_ucinetid(ucinetid) is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    containers = await asyncio.to_thread(client.containers.all)
    for container in containers:
        if container.name == ucinetid:
            used_ports = _get_forward_ports(container)

            return responses.PortsList(success=True, ports=used_ports)


@router.get("/port/valid_ports", response_model=responses.ValidPorts)
async def get_valid_ports(token: Request):
    """Get all valid ports for this container"""
    ucinetid = security.verify_credentials(token)  # Verify the credentials (An exception will occur if not valid)

    if not security.check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if await get_container_by_ucinetid(ucinetid) is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    try:
        return responses.ValidPorts(
            success=True, ports=db_containers.get_valid_ports(ucinetid)
        )
    except Exception as e:
        raise fastapi.HTTPException(
            status_code=500, detail=f"An error occurred fetching for valid ports: {e}"
        )
