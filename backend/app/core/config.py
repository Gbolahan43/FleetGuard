from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.ml_path import DEFAULT_MODEL_DIR, REPO_ROOT


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    aws_region: str = "us-east-1"
    model_path: Path = DEFAULT_MODEL_DIR
    bedrock_model_id: str = "anthropic.claude-3-haiku-20240307-v1:0"
    bedrock_enabled: bool = False
    persist_incidents: bool = False
    top_n_anomalies: int = 10
    cors_origins: str = "*"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if not settings.model_path.is_absolute():
        return settings.model_copy(update={"model_path": (REPO_ROOT / settings.model_path).resolve()})
    return settings
