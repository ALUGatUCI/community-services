from fastapi import FastAPI, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from accounts.accounts import login_to_account, router as accounts
from containers import router as containers
from configuration import configuration
from database import database
from database.remote.bridge import initialize_pocketbase
import platform
import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

secure_mode = os.environ.get("ALUGVPS_SECURE_MODE", "1") != "0"

app = FastAPI()

app.mount("/website", StaticFiles(directory=os.path.join(BASE_DIR, "website"), html=True), name="website")

@app.on_event("startup")
def on_startup():
    try:
        database.create_db_and_tables()
    except Exception as e:
        print(f"Error creating database tables: {e}")
        sys.exit(1)

    try:
        initialize_pocketbase()
    except Exception as e:
        print(f"Error initializing PocketBase: {e}")
        sys.exit(1)

@app.post("/token")
def login_with_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    token = login_to_account(form_data.username, form_data.password)

    response = JSONResponse(content={"success": True})
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=secure_mode,
        samesite="strict",
        max_age=1800,
        path="/"
    )

    return response

# 404 error page
@app.exception_handler(404)
async def not_found(request, exc):
    return RedirectResponse(url="/website/404.html")

# Serve the main HTML page
@app.get("/")
async def read_index():
    return RedirectResponse(url="/website/index.html")

def _launch_app():
    app.include_router(containers, prefix="/containers")
    app.include_router(accounts, prefix="/accounts")

    uvicorn.run(app, host="0.0.0.0", port=int(configuration.read_config_file("port")))

if __name__ == "__main__":
    # Do a platform check
    if platform.system() != "Linux":
        print("You must be running Linux for this software to function")
        sys.exit(0)

    # Check if the environment variables are set
    try:
        configuration.cache_config()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

    _launch_app() # Main function

    sys.exit(0)