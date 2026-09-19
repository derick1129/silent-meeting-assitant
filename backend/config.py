from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    dev_mode: str = "mock"  # "mock" | "local_vision" | "production"
    camera_id: int = 0
    frame_width: int = 640
    frame_height: int = 480
    fps: int = 30
    confidence_threshold: float = 0.70
    cooldown_seconds: float = 1.5
    deepgram_api_key: str = ""
    gemini_api_key: str = ""
    host: str = "127.0.0.1"
    port: int = 8000

@lru_cache()
def get_settings() -> Settings:
    return Settings()
