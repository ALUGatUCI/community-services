import fastapi
import uvicorn

from containers import router as container_router

app = fastapi.FastAPI()
app.include_router(container_router, prefix="/container")

uvicorn.run(app, host='0.0.0.0', port=8000)