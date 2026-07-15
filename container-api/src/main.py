import fastapi
import uvicorn

from api import router as api_router

app = fastapi.FastAPI()
app.include_router(api_router, prefix="/container")

uvicorn.run(app, host='0.0.0.0', port=8000)