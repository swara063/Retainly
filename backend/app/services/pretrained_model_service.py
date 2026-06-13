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


def align_frame_to_model(df: pd.DataFrame, model: Any) -> pd.DataFrame:
    expected = list(getattr(model, "feature_names_in_", []) or [])
    if not expected:
        preprocessor = getattr(model, "named_steps", {}).get("preprocessor") if hasattr(model, "named_steps") else None
        expected = list(getattr(preprocessor, "feature_names_in_", []) or [])
    if not expected:
        return df.copy()
    aligned = df.copy()
    for column in expected:
        if column not in aligned.columns:
            aligned[column] = pd.NA
    return aligned[expected]

