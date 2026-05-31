import dotenv
import os

dotenv.load_dotenv()

# Cache environment variables to avoid reading from the environment multiple times
# and improve performance (changes will require a restart however, but it's worth it)
cached_keys = dict()

def _verify_config():
    # Verify that all required environment variables are set
    required_keys = [
        "secret_key", # Use this command to generate a secret key: openssl rand -hex 32
        "port",
        "acc_limit",
        "cpu_limit",
        "ram_limit",
        "disk_limit",
        "fingerprint_image",
        "email",
        "email_key",
        "smtp_host",
        "smtp_port",
        "pocketbase_url",
        "pocketbase_username",
        "pocketbase_password",
    ]

    for key in required_keys:
        if not os.getenv(key):
            raise ValueError(f"Missing required configuration key: {key}")

def cache_config():
    global cached_keys

    _verify_config()
    for key in os.environ:
        cached_keys[key] = os.getenv(key)

def read_config_file(key: str):
    return cached_keys.get(key)