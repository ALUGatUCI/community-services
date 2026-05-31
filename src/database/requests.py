from database.database import session
from database.models import Account, Request as RequestModel, ContainerRequest
from sqlmodel import select

def get_request_by_id(request_id: int) -> RequestModel | None:
    return session.get(RequestModel, request_id)

def create_request(ucinetid: str, request: ContainerRequest):
    acc_id = session.exec(select(Account.id).where(Account.email == f"{ucinetid}@uci.edu")).first()
    # Validate the request is valid
    if session.exec(select(RequestModel.id).where(RequestModel.id == acc_id)).first() is not None:
        raise Exception("You already have a pending request")

    req_len = len(request.request_body.strip())
    if req_len < 300 or req_len > 1000:
        raise Exception("A minimum of 300 characters is required")

    new_request = RequestModel(id=acc_id, request=request.request_body)
    session.add(new_request)
    session.commit()