from pydantic import BaseModel

class ConfirmationCode(BaseModel):
    code: str