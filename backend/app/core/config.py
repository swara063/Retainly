from pathlib import Path
import os

from dotenv import load_dotenv
from pydantic import BaseModel

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = PROJECT_ROOT / ".env"
load_dotenv(ENV_PATH, override=False)

class Settings(BaseModel):
    PROJECT_ROOT: Path = PROJECT_ROOT
    ENV_PATH: Path = ENV_PATH
    STORAGE_DIR: Path = PROJECT_ROOT / "storage"
    DATASET_DIR: Path = STORAGE_DIR / "datasets"
    RESULT_DIR: Path = STORAGE_DIR / "results"
    REPORT_DIR: Path = STORAGE_DIR / "reports"
    MODEL_DIR: Path = STORAGE_DIR / "models"
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]
    CORS_ORIGIN_REGEX: str | None = os.getenv("CORS_ORIGIN_REGEX") or r"https://.*\.onrender\.com"
    MAX_UPLOAD_MB: int = 50

settings = Settings()
