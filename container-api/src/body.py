from pydantic import BaseModel

class AddPort(BaseModel):
    name: str
    listen: int
    connect: int

class RemovePort(BaseModel):
    name: str

class CreateContainer(BaseModel):
    ucinetid: str
    password: str