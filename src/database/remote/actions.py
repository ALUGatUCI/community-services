import database.remote.bridge as bridge
from configuration.configuration import read_config_file

def add_user(email: str, is_confirmed: bool = False, is_banned: bool = False):
    collection = bridge.get_collection(read_config_file("pocketbase_collection"))

    data = {
        "email": email,
        "isConfirmed": is_confirmed,
        "isBanned": is_banned,
    }

    collection.create(data)

def delete_user(email: str):
    collection = bridge.get_collection(read_config_file("pocketbase_collection"))
    records = collection.get_list(1, 1, {"email": email})
    if records.items:
        collection.delete(records.items[0].id)
    else:
        raise ValueError(f"User with email {email} not found")

def update_user(email: str, is_confirmed: bool, is_banned: bool):
    collection = bridge.get_collection(read_config_file("pocketbase_collection"))
    records = collection.get_list(1, 1, {"email": email})
    if records.items:
        collection.update(records.items[0].id, {
            "isConfirmed": is_confirmed,
            "isBanned": is_banned,
        })
    else:
        raise ValueError(f"User with email {email} not found")

def get_user(email: str) -> dict | None:
    collection = bridge.get_collection(read_config_file("pocketbase_collection"))
    records = collection.get_list(1, 1, {"email": email})
    if records.items:
        return records.items[0]

    return None
