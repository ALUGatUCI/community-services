from http import HTTPStatus

from sqlalchemy import func
from sqlmodel import select, delete

import configuration
from database.models import Account
from database.models import Container
import database.database as database
from containers.core import client
from security.shacrypt512 import shacrypt
from src.containers.containers import httpx_client


async def create_new_container(account_id: int):
    """Creates a new container upon account creation"""
    database.create_db_and_tables()
    session = database.session

    # Get the account from the ID
    account = session.exec(select(Account).where(Account.id == account_id)).one_or_none()
    if account is None:
        raise ValueError(f"No account found with ID {account_id}")

    ucinetid = account.email[:account.email.find("@")]
    hashed_password = shacrypt(account.confirmation_code.encode('utf-8')) # Use the confirmation code as the temp password

    # Now create and start the actual container
    container_config = {
        "name": ucinetid,
        "type": "container",
        "ephemeral": False,
        "source": {
            'type': 'image',
            'fingerprint': configuration.read_config_file("fingerprint_image"),
        },
        "config": {
            "limits.cpu": f"{configuration.read_config_file("cpu_limit")}",
            "limits.memory": f"{configuration.read_config_file("ram_limit")}GiB",
            "user.user-data": ("#cloud-config\n"
                              "ssh_pwauth: True\n"
                              "users:\n"
                              f"  - name: {ucinetid}\n"               # The username
                              "    sudo: ALL=(ALL) NOPASSWD:ALL\n" # Gives the user sudo rights
                              "    shell: /bin/bash\n"
                              "    lock_passwd: false\n"         # Crucial: allows password login
                              f"    passwd: {hashed_password}\n"   # Plain text password
                              "chpasswd:\n"
                              "  list: |\n"
                              f"    {ucinetid}:{hashed_password}\n"         # Redundant but ensures it sets
                              "  expire: True\n"
                              "runcmd:\n"
                              "  - systemctl enable --now ssh\n"
                               )
        },
        "devices": {
            "root": {
                "type": "disk",
                "path": "/",
                "pool": "default",
                "size": f"{configuration.read_config_file("disk_limit")}GiB"
            },
            # SSH Port Forwarding (Proxy Device)
            "ssh-forward": {
                "type": "proxy",
                "listen": f"tcp:0.0.0.0:{new_container.ssh_port}", # Port on the HOST
                "connect": "tcp:127.0.0.1:22"  # Port inside the CONTAINER
            }
        }
    }

    instance = client.containers.create(container_config, wait=True)

    # Verify the instance has been created
    if ucinetid is None:
        raise RuntimeError(f"Failed to create container: {ucinetid} not found in container list")

    # Start the instance
    instance.start()

    # Calculate the SSH port forwarding number
    # We need to make it so that removing or deleting containers will not result in port collision
    # by checking the maximum existing SSH port and incrementing from there
    max_ssh_port = session.execute(select(func.max(Container.ssh_port))).one()[0]
    next_ssh_port = 10000 if max_ssh_port is None else max_ssh_port + 10

    new_container = Container(
        id = account_id,
        ssh_port = next_ssh_port,
        forward_ports = list(range(next_ssh_port + 1, next_ssh_port + 10))
    )

    # Add the container data to the table

    session.add(new_container)
    session.commit()
    session.refresh(new_container)

def delete_container(ucinetid: str):
    """Deletes the container associated with the given UCINETID."""
    database.create_db_and_tables()
    session = database.session

    statement_1 = select(Account.id).where(Account.email == f"{ucinetid}@uci.edu")
    account_id = session.exec(statement_1).first()
    if account_id is None:
        return
    statement_2 = delete(Container).where(Container.id == account_id)
    session.exec(statement_2)
    session.commit()

def get_valid_ports(ucinetid: str):
    """Get valid ports for the user's container"""

    # Get the account from the ID
    account_id = database.session.exec(select(Account.id).where(Account.email == f"{ucinetid}@uci.edu")).one_or_none()
    if account_id is None:
        raise ValueError(f"No account found with ID {account_id}")

    return database.session.exec(select(Container.forward_ports).where(Container.id == account_id)).all()[0]

