from configuration import read_config_file
from pocketbase import PocketBase

client = PocketBase(read_config_file("pocketbase_url"))

user_data = client.collection("users").auth_with_password(
    read_config_file("pocketbase_username"),
    read_config_file("pocketbase_password"),
)

if not user_data.is_valid:
    raise RuntimeError("Invalid credentials")

def get_collection(collection_name):
    return client.collection(collection_name)