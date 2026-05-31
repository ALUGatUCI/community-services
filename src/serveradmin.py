#! /usr/bin/env python3

from webbrowser import get

import sqlmodel
from sqlmodel import select, func
import sys
import asyncio
from communications.events import approval_email, not_selected_email
import database.database as database
from database.database import create_db_and_tables
from database.models import Request, Account
from database.containers import create_new_container
from database.requests import (
    get_request_by_id,
    delete_request,
    get_all_requests,
)
from containers.containers import (
    suspend_container_by_ucinetid,
    unsuspend_container_by_ucinetid,
    delete_container_by_ucinetid,
    get_container_count,
)
from accounts.accounts import get_all_accounts
from configuration import configuration

# Create the database engine and session

create_db_and_tables()
session = database.session

# Get the command line arguments
arguments = sys.argv

async def entry_point():
    if len(arguments) == 3:
        if arguments[1] == "view": # View a request with the given ID
            request = get_request_by_id(int(arguments[2]))
            if request is not None:
                print(f"ID: {request.id}\nBody: {request.request}\n\n")
            else:
                print(f"No request found with ID {arguments[2]}")
        if arguments[1] == "approve": # Approve a request with the given ID
            # Check if there is anymore space for containers
            if configuration.read_config_file("acc_limit") is not None:
                acc_limit = configuration.read_config_file("acc_limit")
                if acc_limit is not None and get_container_count() >= int(acc_limit):
                    print("Account limit on server reached")
                    sys.exit(1)

            request = get_request_by_id(int(arguments[2]))
            if request is not None:
                # Create the container
                try:
                    await create_new_container(request.id)
                    await approval_email(request.id, session)
                except Exception as e:
                    print(f"Error creating container: {e}")
                    sys.exit(1)

                print(f"Approved request with ID {arguments[2]}")
                delete_request(int(arguments[2]))
            else:
                print(f"No request found with ID {arguments[2]}")
        if arguments[1] == "list": # List all requests or users
            if arguments[2] == "requests":
                requests = get_all_requests()
                for request in requests:
                    print(f"ID: {request.id}\nBody: {request.request}\n\n")
            elif arguments[2] == "users":
                users = get_all_accounts()
                for user in users:
                    print(f"ID: {user.id}\nEmail: {user.email}\nBanned: {user.banned}\nConfirmed: {user.confirmed}\n\n")
            else:
                print(f"Unknown list type: {arguments[2]}")
        if arguments[1] == "ban": # Ban a user with the given ID
            user = session.get(Account, int(arguments[2]))
            if user is not None:
                user.banned = True
                session.commit()
                await suspend_container_by_ucinetid(user.email[:user.email.index("@")]) # Suspend the user's container
                print(f"Banned user with ID {arguments[2]}")
            else:
                print(f"No user found with ID {arguments[2]}")
        if arguments[1] == "unban": # Unban a user with the given ID
            user = session.get(Account, int(arguments[2]))
            if user is not None:
                user.banned = False
                session.commit()
                await unsuspend_container_by_ucinetid(user.email[:user.email.index("@")]) # Unsuspend the user's container
                print(f"Unbanned user with ID {arguments[2]}")
            else:
                print(f"No user found with ID {arguments[2]}")
    elif len(arguments) == 4:
        if arguments[1] == "delete": # Delete a request or user with the given ID
            if arguments[2] == "request":
                request = session.get(Request, int(arguments[3]))
                if request is not None:
                    await not_selected_email(request.id, session)
                    session.delete(request)
                    session.commit()
                    print(f"Deleted request with ID {arguments[3]}")
                else:
                    print(f"No request found with ID {arguments[3]}")
            elif arguments[2] == "users":
                user = session.get(Account, int(arguments[3]))
                if user is not None:
                    await delete_container_by_ucinetid(user.email[:user.email.index("@")]) # Delete the container associated with the user
                    session.delete(user)
                    session.commit()
                    print(f"Deleted user with ID {arguments[3]}")
                else:
                    print(f"No user found with ID {arguments[3]}")
            else:
                print(f"Unknown delete type: {arguments[2]}")
    else:
        print("Implement help later")

# Implement a simple CLI for managing requests and users
if __name__ == "__main__":
    asyncio.run(entry_point())
