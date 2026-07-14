import psycopg
from psycopg import sql
from psycopg_pool import AsyncConnectionPool

from config import get_env_var

DB_NAME = "alugcscontainers"

def _conninfo(dbname: str) -> str:
    return (
        f"host={get_env_var('db_host')} "
        f"port={get_env_var('db_port')} "
        f"dbname={dbname} "
        f"user={get_env_var('db_user')} "
        f"password={get_env_var('db_password')}"
    )

def _ensure_database_exists() -> None:
    """Create the app database if it doesn't already exist."""
    # Connect to the 'postgres' maintenance DB; autocommit is required for CREATE DATABASE.
    with psycopg.connect(_conninfo("postgres"), autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
            if cur.fetchone() is None:
                # DB name is an identifier, not a value — sql.Identifier quotes it safely.
                cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DB_NAME)))

def _ensure_tables_exist() -> None:
    """Create the app's tables if they don't already exist."""
    # Separate connection, this time TO the app database.
    with psycopg.connect(_conninfo(DB_NAME)) as conn:
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

_ensure_database_exists()
_ensure_tables_exist()
pool = AsyncConnectionPool(_conninfo(DB_NAME), open=False)
