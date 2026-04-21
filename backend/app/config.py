from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Meal Planner API"
    cors_origins: str = (
        "http://localhost:8081,http://127.0.0.1:8081,"
        "http://localhost:8082,http://127.0.0.1:8082,"
        "http://localhost:19006,http://127.0.0.1:19006,"
        "http://localhost:3000,http://127.0.0.1:3000"
    )
    database_url: str = f"sqlite:///{_BACKEND_ROOT / 'data' / 'meal_planner.db'}"
    uploads_dir: Path = _BACKEND_ROOT / "data" / "uploads"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
