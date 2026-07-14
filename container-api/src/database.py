import psycopg
from psycopg_pool import AsyncConnectionPool

from config import get_env_var

def _conninfo() -> str:
    return (
        f"host={get_env_var('db_host')} "
        f"port={get_env_var('db_port')} "
        f"dbname={get_env_var('db_dbname')} "
        f"user={get_env_var('db_user')} "
        f"password={get_env_var('db_password')}"
    )

def _ensure_tables_exist() -> None:
    """Create the app's tables if they don't already exist."""
    # Separate connection, this time TO the app database.
    with psycopg.connect(_conninfo()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS containers (
                    ucinetid      TEXT PRIMARY KEY,
                    ssh_port      INTEGER NOT NULL,
                    forward_ports INTEGER[]
                );
                """
            )
        conn.commit()

_ensure_tables_exist()
pool = AsyncConnectionPool(_conninfo(), open=False)
