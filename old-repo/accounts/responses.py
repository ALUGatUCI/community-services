from pydantic import BaseModel

class AccountConfirmed(BaseModel):
    confirmed: bool