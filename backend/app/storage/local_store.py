import json
from glob import glob
from pathlib import Path
from typing import Any
from app.core.config import settings


def ensure_storage() -> None:
    for path in [settings.STORAGE_DIR, settings.DATASET_DIR, settings.RESULT_DIR, settings.REPORT_DIR, settings.MODEL_DIR]:
        path.mkdir(parents=True, exist_ok=True)


def dataset_path(dataset_id: str) -> Path:
    return settings.DATASET_DIR / f"{dataset_id}.csv"


def metadata_path(dataset_id: str) -> Path:
    return settings.DATASET_DIR / f"{dataset_id}.metadata.json"

def mapping_path(dataset_id: str) -> Path:
    return settings.DATASET_DIR / f"{dataset_id}.mapping.json"


def result_path(dataset_id: str) -> Path:
    return settings.RESULT_DIR / f"{dataset_id}.results.json"


def log_path(dataset_id: str) -> Path:
    return settings.RESULT_DIR / f"{dataset_id}.logs.json"


def report_path(dataset_id: str) -> Path:
    return settings.REPORT_DIR / f"{dataset_id}.pdf"


def save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def latest_result_path() -> Path | None:
    candidates = list(settings.RESULT_DIR.glob("*.results.json"))
    if not candidates:
        return None
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0]
