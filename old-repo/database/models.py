from pydantic import BaseModel, SecretStr
from typing import Optional
import sqlmodel


class AccountLogin(BaseModel):
    email: str
    password: str

class BaseAccount(BaseModel):
    email: str | None = None
    disabled: bool | None = None

class Request(sqlmodel.SQLModel, table=True):
    id: int = sqlmodel.Field(foreign_key="account.id", default=None, primary_key=True, index=True)
    request: str = sqlmodel.Field(nullable=False)

class Account(sqlmodel.SQLModel, table=True):
    id: Optional[int] = sqlmodel.Field(default=None, primary_key=True)
    email: str = sqlmodel.Field(index=True, unique=True)
    password: str = sqlmodel.Field(nullable=False, default=None)
    confirmed: bool = sqlmodel.Field(default=False)
    banned: bool = sqlmodel.Field(default=False)
    confirmation_code: str = sqlmodel.Field(unique=True)

class Container(sqlmodel.SQLModel, table=True):
    id: int = sqlmodel.Field(foreign_key="account.id", default=None, primary_key=True, index=True)
    ssh_port: int = sqlmodel.Field(unique=True)
    forward_ports: list[int] = sqlmodel.Field(sa_column=sqlmodel.Column(sqlmodel.JSON))

class AccountCreation(BaseModel):
    email: str
    password: SecretStr

class ContainerRequest(BaseModel):
    request_body: str