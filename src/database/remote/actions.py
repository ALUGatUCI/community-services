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
