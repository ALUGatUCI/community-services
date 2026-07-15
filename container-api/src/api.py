import fastapi
from fastapi import Depends

import responses as responses
from body import AddPort, RemovePort

import containers

router = fastapi.APIRouter()


@router.get("/exists")
async def check_container_exists(ucinetid: str):
    """Checks if a container exists for the account"""
    exists = await containers.container_exists(ucinetid)

    return responses.ContainerExists(success=True, exists=exists)


@router.get("/address", response_model=responses.ContainerAddress)
async def get_container_connection_port(ucinetid: str):
    """Get the address of the account's container"""
    address = await containers.get_connection_address(ucinetid)
    if address is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    return responses.ContainerAddress(success=True, address=address)


@router.get("/status", response_model=responses.ContainerStatus)
async def container_status(ucinetid: str):
    """Get the status of the current container"""
    status = await containers.get_container_status(ucinetid)
    if status is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    return responses.ContainerStatus(success=True, status=status)


@router.put("/start", response_model=responses.ContainerAction)
async def container_start(ucinetid: str):
    """Start the named container"""
    result = await containers.start_container(ucinetid)
    if result is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    if result:
        return responses.ContainerAction(success=True, message="Sent start request")

    return responses.ContainerAction(success=False, message="Something went wrong")


@router.put("/stop", response_model=responses.ContainerAction)
async def container_stop(ucinetid: str):
    """Stop the named container"""
    result = await containers.stop_container(ucinetid)
    if result is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    if result:
        return responses.ContainerAction(success=True, message="Sent stop request")

    return responses.ContainerAction(success=False, message="Something went wrong")


@router.put("/restart", response_model=responses.ContainerAction)
async def container_restart(ucinetid: str):
    """Restart the named container"""
    result = await containers.restart_container(ucinetid)
    if result is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    if result:
        return responses.ContainerAction(success=True, message="Sent restart request")

    return responses.ContainerAction(success=False, message="Something went wrong")


@router.post("/port/add", response_model=responses.ContainerAction)
async def add_port(ucinetid: str, new_forward: AddPort = Depends(),):
    """Add forward port to the container"""
    result = await containers.add_forward_port(
        ucinetid, new_forward.name, new_forward.listen, new_forward.connect
    )

    if result is containers.AddPortResult.NOT_FOUND:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )
    if result is containers.AddPortResult.INVALID_PORT:
        raise fastapi.HTTPException(
            status_code=400, detail="An invalid port was specified"
        )
    if result is containers.AddPortResult.IN_USE:
        raise fastapi.HTTPException(
            status_code=400, detail="The port is already in use"
        )
    if result is containers.AddPortResult.RESERVED_NAME:
        raise fastapi.HTTPException(
            status_code=403,
            detail="Attempted to add port with the same name as another device",
        )

    return responses.ContainerAction(success=True, message="Sent forward port added")


@router.delete("/port/delete", response_model=responses.ContainerAction)
async def remove_port(ucinetid: str, remove: RemovePort = Depends()):
    """Removes a specified port"""
    result = await containers.remove_forward_port(ucinetid, remove.name)
    if result is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    if result:
        return responses.ContainerAction(success=True, message="Sent delete request")

    return responses.ContainerAction(success=False, message="Named port is invalid")


@router.get("/port/list", response_model=responses.PortsList)
async def get_used_port_list(ucinetid: str):
    """Retrieves a list of all used forwarding ports"""
    used_ports = await containers.list_forward_ports(ucinetid)
    if used_ports is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    return responses.PortsList(success=True, ports=used_ports)


@router.get("/port/valid_ports", response_model=responses.ValidPorts)
async def get_valid_ports(ucinetid: str):
    """Get all valid ports for this container"""
    try:
        ports = await containers.get_valid_ports(ucinetid)
    except Exception as e:
        raise fastapi.HTTPException(
            status_code=500, detail=f"An error occurred fetching for valid ports: {e}"
        )

    if ports is None:
        raise fastapi.HTTPException(
            status_code=400, detail="No container found for this account"
        )

    return responses.ValidPorts(success=True, ports=ports)
