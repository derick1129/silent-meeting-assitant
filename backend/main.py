import uvicorn
from backend.config import get_settings
from backend.api.server import create_app

app = create_app()

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("backend.main:app", host=settings.host, port=settings.port, reload=True)
