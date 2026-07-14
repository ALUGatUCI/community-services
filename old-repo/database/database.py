import sqlmodel
import pathlib
import os

if os.getuid() != 0:
    path = pathlib.Path.home() / ".alugvps-server" / "alugvps.db"
else:
    path = pathlib.Path("/var/lib/alugvps-server/alugvps.db")

if not path.parent.exists():
    path.parent.mkdir(parents=True)

engine = sqlmodel.create_engine(f"sqlite:///{path}", connect_args={'check_same_thread': False})
session = None

def create_db_and_tables():
    global session

    sqlmodel.SQLModel.metadata.create_all(engine)
    session = sqlmodel.Session(engine)
