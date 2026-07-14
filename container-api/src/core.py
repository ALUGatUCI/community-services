from pylxd import Client

try:
    client = Client()
except Exception as e:
    raise RuntimeError(f"Failed to connect to LXC: {e}")