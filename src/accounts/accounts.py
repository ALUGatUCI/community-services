import string
from typing import Annotated

import fastapi
from fastapi import Depends
from fastapi.security import OAuth2PasswordRequestForm
from database import Container
from database.accounts import Account, add_account_to_database, perform_login, send_confirmation_email
from database.models import ContainerRequest
import database.database as database
import database.exceptions as db_exceptions
import sqlmodel
from sqlmodel import select, delete
from fastapi import Request
from fastapi.responses import JSONResponse
from accounts.body import ConfirmationCode
from accounts.responses import AccountConfirmed
from security import check_confirmation_status, discard_token
from containers.containers import get_container_by_ucinetid
from database.remote.actions import get_user, update_user
from database.requests import create_request
from database.accounts import get_all_accounts_db


from security import verify_credentials

router = fastapi.APIRouter()

def get_all_accounts() -> list[Account]:
    return get_all_accounts_db()

@router.post("/confirm")
async def confirm_account(token: Request, inputted_code: ConfirmationCode = Depends()):
    ucinetid = verify_credentials(token)

    session = database.session

    statement = sqlmodel.select(Account).where(Account.email == f"{ucinetid}@uci.edu")
    result = session.exec(statement).one_or_none()

    if result is None:
        raise fastapi.HTTPException(status_code=400, detail="Account not found")

    if result.confirmed == True:
        raise fastapi.HTTPException(status_code=400, detail="Account is already confirmed")

    if result.confirmation_code != inputted_code.code:
        raise fastapi.HTTPException(status_code=400, detail="Incorrect confirmation code")

    # Assuming all checks pass, changed their confirmed status and create container
    result.confirmed = True
    session.commit()

    update_user(f"{ucinetid}@uci.edu", is_confirmed=True)

    return fastapi.Response(status_code=201)

@router.get('/resend_code')
async def resend_code_by_email(token: Request):
    ucinetid = verify_credentials(token)

    session = database.session

    statement = sqlmodel.select(Account).where(Account.email == f"{ucinetid}@uci.edu")
    result = session.exec(statement).one_or_none()

    if result is None:
        raise fastapi.HTTPException(status_code=400, detail="Account not found")

    try:
        await send_confirmation_email(result)
    except Exception as e:
        raise fastapi.HTTPException(status_code=500, detail=str(e))

    return fastapi.Response(status_code=201)

@router.get('/account_confirmed', response_model=AccountConfirmed)
async def is_account_confirmed(token: Request):
    """Check if the account is confirmed"""
    ucinetid = verify_credentials(token)

    session = database.session

    statement = sqlmodel.select(Account).where(Account.email == f"{ucinetid}@uci.edu")
    result = session.exec(statement).one_or_none()

    if result is None:
        raise fastapi.HTTPException(status_code=400, detail="Account not found")

    return AccountConfirmed(confirmed=result.confirmed)

@router.get("/verify_token")
def verify_token(token: Request):
    """Endpoint for the frontend to verify if a token is valid. Returns 200 if valid, 401 if not."""
    try:
        verify_credentials(token)
    except:
        raise fastapi.HTTPException(status_code=401, detail="Invalid token")
    else:
        return fastapi.Response(status_code=200)

@router.post("/request_container")
async def request_container(token: Request, request: ContainerRequest):
    ucinetid = verify_credentials(token)

    if not check_confirmation_status(ucinetid):
        raise fastapi.HTTPException(status_code=400, detail="Inactive user")

    if await get_container_by_ucinetid(ucinetid) is not None:
        raise fastapi.HTTPException(status_code=400, detail="User already has a container")

    try:
        create_request(ucinetid, request)
    except Exception as e:
        raise fastapi.HTTPException(status_code=400, detail=f"Request failed: {e}")

    return fastapi.Response(status_code=201)

@router.post("/create_account")
async def create_account(account: Annotated[OAuth2PasswordRequestForm, fastapi.Depends()]):
    """Do the password creation logic"""

    # Start with validating the emails
    if not account.username.endswith("@uci.edu"):
        raise fastapi.HTTPException(status_code=400, detail="Email address is not valid")

    # Get the database session
    session = database.session

    statement = sqlmodel.select(Account.email)
    emails = session.exec(statement).all()

    if account.username in emails:
        raise fastapi.HTTPException(status_code=400, detail="Email address already exists")

    # Now validate the password
    if account.password.strip() == "":
        raise fastapi.HTTPException(status_code=400, detail="Password is required")

    if len(account.password) < 8:
        raise fastapi.HTTPException(status_code=400, detail="Password is too short")

    if not any(c.islower() for c in account.password):
        raise fastapi.HTTPException(
            status_code=400,
            detail="Password must contain at least one lowercase character"
        )

    if not any(c.isupper() for c in account.password):
        raise fastapi.HTTPException(
            status_code=400,
            detail="Password must contain at least one uppercase character"
        )

    if not any(c.isdigit() for c in account.password):
        raise fastapi.HTTPException(
            status_code=400,
            detail="Password must contain at least one digit"
        )

    if not any(c in string.punctuation for c in account.password):
        raise fastapi.HTTPException(
            status_code=400,
            detail="Password must contain at least one punctuation"
        )

    remote_user = get_user(account.username)
    if remote_user is not None and remote_user["hasContainer"]:
        raise fastapi.HTTPException(
            status_code=400,
            detail="User already exists on another instance"
        )

    try:
        await add_account_to_database(account)
    except Exception as e:
        # Do the cleanup work if necessary
        acc_statement = select(Account).where(Account.email == account.username)
        account_entry = session.exec(acc_statement).first()

        if account_entry is not None:
            account_id = account_entry.id
            rm_acc_statement = delete(Account).where(Account.id == account_id)
            session.exec(rm_acc_statement)
            session.commit()

        con_statement = select(Container).where(Container.id == account_id)
        con_entry = session.exec(con_statement).first()

        if con_entry is not None:
            rm_con_statement = delete(Container).where(Container.id == account_id)
            session.exec(rm_con_statement)
            session.commit()

        # Raise the API exception
        raise fastapi.HTTPException(status_code=500, detail=str(e))

    return fastapi.Response(status_code=201)

def login_to_account(username, password) -> str:
    """Do the login logic"""
    try:
        return perform_login(username, password)
    except db_exceptions.AccountNotFoundError as e:
        raise fastapi.HTTPException(status_code=401, detail=str(e))
    except db_exceptions.InvalidPasswordError as e:
        raise fastapi.HTTPException(status_code=401, detail=str(e))
    except db_exceptions.AccountBannedError as e:
        raise fastapi.HTTPException(status_code=403, detail=str(e))

@router.post('/logout')
def logout(token: Request):
    ucinetid = verify_credentials(token)

    try:
        discard_token(token)
    except Exception as e:
        raise fastapi.HTTPException(status_code=500, detail=str(e))

    response = JSONResponse(content={"success": True})
    response.delete_cookie("token", path="/")
    return response