from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.core.config import settings

PRETRAINED_MODEL_PATH = settings.MODEL_DIR / "retainly_pretrained.joblib"
PRETRAINED_METADATA_PATH = settings.MODEL_DIR / "retainly_pretrained_metadata.json"


def pretrained_model_exists() -> bool:
    return PRETRAINED_MODEL_PATH.exists()


def load_pretrained_model() -> Any:
    if not PRETRAINED_MODEL_PATH.exists():
        raise FileNotFoundError(f"Pretrained model not found at {PRETRAINED_MODEL_PATH}")
    return joblib.load(PRETRAINED_MODEL_PATH)


def load_pretrained_metadata() -> dict[str, Any]:
    if not PRETRAINED_METADATA_PATH.exists():
        return {}
    import json

    return json.loads(PRETRAINED_METADATA_PATH.read_text(encoding="utf-8"))


def _feature_name_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    try:
        return [str(item) for item in list(value)]
    except Exception:
        return []


def align_frame_to_model(df: pd.DataFrame, model: Any) -> pd.DataFrame:
    expected = _feature_name_list(getattr(model, "feature_names_in_", None))
    if not expected:
        preprocessor = getattr(model, "named_steps", {}).get("preprocessor") if hasattr(model, "named_steps") else None
        expected = _feature_name_list(getattr(preprocessor, "feature_names_in_", None))
    if not expected:
        return df.copy()
    aligned = df.copy()
    for column in expected:
        if column not in aligned.columns:
            aligned[column] = pd.NA
    return aligned[expected]
