import string
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import sqlmodel
import jwt
from security import SECRET_KEY, ACCESS_TOKEN_EXPIRE_MINUTES, password_hasher as ph, ALGORITHM
from database.models import Account
import database.database as database
from communications import send_email
import database.exceptions as exceptions
import asyncio
import random
import fastapi
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated

class Token(BaseModel):
    access_token: str
    token_type: str

def _generate_random_confirmation_code():
    """Generate a random confirmation code"""

    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(10))

def _create_access_token(data: dict, expires_delta: timedelta | None = None):
    """Create an access token"""
    to_encode = data.copy()
    if expires_delta:
        expires = datetime.now(timezone.utc) + expires_delta
    else:
        expires = datetime.now(timezone.utc) + timedelta(minutes=30)

    to_encode.update({"exp": expires})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

    return encoded_jwt

async def send_confirmation_email(new_account: Account):
    subject = "ALUG@UCI VPS Services Account Confirmation"
    send_to = new_account.email
    contents = (
        f"Hello,\n"
        "If you didn't sign up to use ALUG@UCI's VPS services, please ignore this email.\n"
        "Otherwise, please enter this confirmation code to continue the account creation process.\n"
        f"Code: {new_account.confirmation_code}"
    )

    await send_email(subject, send_to, contents)

async def add_account_to_database(account: Annotated[OAuth2PasswordRequestForm, fastapi.Depends()]):
    """Create an account and add it to the database"""

    # Start by hashing the password
    hashed_password = await asyncio.to_thread(ph.hash, account.password) # Run in async thread to prevent block

    # Get the database session
    session = database.session

    # Create the account with the Account class
    new_account = Account(
        email = account.username,
        password = hashed_password,
        confirmed = False,
        banned = False,
        confirmation_code = _generate_random_confirmation_code()
    )

    session.add(new_account)
    session.commit()
    session.refresh(new_account)

    # Send a confirmation email
    await send_confirmation_email(new_account)


def perform_login(email: str, password: str):
    """Perform a login and return a token"""
    session = database.session # Get the session

    statement = sqlmodel.select(Account).where(email == Account.email) # See if an account with that communications exists
    result = session.exec(statement).first()

    if result is None: # If it doesn't, raise an error
        raise exceptions.AccountNotFoundError(email)

    # If an account was found, we check the password matches
    if ph.verify(password, result.password):
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = _create_access_token(
            {"sub" : result.email}, expires_delta=access_token_expires
        )
    else:
        raise exceptions.InvalidPasswordError()

    # Check the account is not banned
    if result.banned:
        raise exceptions.AccountBannedError()

    return access_token

def get_all_accounts_db() -> list[Account]:
    session = database.session
    statement = sqlmodel.select(Account)
    result = session.exec(statement).all()
    return result