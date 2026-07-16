import fastapi
import uvicorn
from contextlib import asynccontextmanager

from api import router as api_router
import database


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    # Open the async connection pool before serving requests. Without this,
    # every query fails with "the pool is not open yet".
    await database.pool.open()
    try:
        yield
    finally:
        await database.pool.close()


app = fastapi.FastAPI(lifespan=lifespan)
app.include_router(api_router, prefix="/api")

uvicorn.run(app, host='0.0.0.0', port=8000)
