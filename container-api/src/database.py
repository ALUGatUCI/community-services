import psycopg
from psycopg_pool import AsyncConnectionPool

from config import get_env_var

def _conninfo() -> str:
    return (
        f"host={get_env_var('DB_HOST')} "
        f"port={get_env_var('DB_PORT')} "
        f"dbname={get_env_var('DB_DBNAME')} "
        f"user={get_env_var('DB_USER')} "
        f"password={get_env_var('DB_PASSWORD')}"
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

async def get_container_count() -> int:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT COUNT(*) FROM containers",
            )
            count = await cur.fetchone()

    return count[0] if count else 0


async def get_ssh_port(ucinetid: str) -> int | None:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT ssh_port FROM containers WHERE ucinetid = %s;",
                (ucinetid,)
            )
            row = await cur.fetchone()

    return row[0] if row else None

async def get_forward_ports(ucinetid: str) -> list[int]:
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT forward_ports FROM containers WHERE ucinetid = %s;",
                (ucinetid,)
            )
            row = await cur.fetchone()

    return row[0] if row else []