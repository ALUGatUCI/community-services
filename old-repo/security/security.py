import string
from sqlmodel import select

from configuration import configuration
import jwt
from fastapi import HTTPException, status, Request
from jwt import InvalidTokenError
from pwdlib import PasswordHash

from database import database
from database.models import Account

SECRET_KEY = configuration.read_config_file("secret_key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

password_hasher = PasswordHash.recommended()

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)

discarded_tokens = []

def _get_token_from_cookie(request: Request) -> str:
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token

def verify_credentials(request: Request):
    token = _get_token_from_cookie(request)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")

        if email is None:
            raise credentials_exception

        ucinetid = email[:payload.get("sub").index("@")]

    except InvalidTokenError:
        raise credentials_exception

    # Ensure the user isn't banned
    if database.session.exec(select(Account.banned).where(Account.email == email)).first():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is banned")

    # Ensure the token isn't discord (due to logout)
    if token in discarded_tokens:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token is discarded")

    return ucinetid

def validate_password(password: str):
    if password.strip() == "":
        raise Exception("Password is required")

    if len(password) < 8:
        raise Exception("Password is too short")

    if not any(c.islower() for c in password):
        raise Exception(
            "Password must contain at least one lowercase character"
        )

    if not any(c.isupper() for c in password):
        raise Exception(
            "Password must contain at least one uppercase character"
        )

    if not any(c.isdigit() for c in password):
        raise Exception(
            "Password must contain at least one digit"
        )

    if not any(c in string.punctuation for c in password):
        raise Exception(
            "Password must contain at least one punctuation"
        )

def check_confirmation_status(ucinetid: str):
    session = database.session

    statement = select(Account.confirmed).where(Account.email == f"{ucinetid}@uci.edu")
    result = session.exec(statement).first()

    if result is None:
        return False

    return result

def discard_token(token: Request):
    discarded_tokens.append(token)