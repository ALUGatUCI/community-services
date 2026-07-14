import communications.communications as communications
from database.models import Account
from sqlmodel import Session

def _get_ucinetid_email(user_id: int, sql_session: Session) -> str:
    account = sql_session.get(Account, user_id)
    if account:
        return account.email

    raise ValueError(f"Account with user_id {user_id} not found")

def _get_confirmation_code(user_id: int, sql_session: Session) -> str:
    account = sql_session.get(Account, user_id)
    if account:
        return account.confirmation_code

    raise ValueError(f"Account with user_id {user_id} not found")

async def approval_email(user_id: int, sql_session: Session):
    email = _get_ucinetid_email(user_id, sql_session)
    await communications.send_email(
        "Container Approval",
        email,
        (f"Hello there,\n"
        f"Your container has been approved. Thank you for using ALUG@UCI Community VPS Services.\n"
        f"Here is your temporary login password: {_get_confirmation_code(user_id, sql_session)}")
    )

async def not_selected_email(user_id: int, sql_session: Session):
    email = _get_ucinetid_email(user_id, sql_session)
    await communications.send_email(
        "Container Not Selected",
        email,
        ("Hello there,\n"
        "Thank you for applying for a container. After a careful review of your request, we regret to inform you that your container has not been selected."
        "We have limited server capacity, which makes us unable to fulfill your request at this time.\n"
        "Please check back again later if we have any available slots.\n"
        "Thank you for using ALUG@UCI Community VPS Services.\n"
        "Please contact the ALUG@UCI staff for more information or if you would like to appeal.")
    )