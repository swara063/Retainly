from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import numpy as np
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


def _expected_features(model: Any, metadata: dict[str, Any] | None = None) -> list[str]:
    expected = _feature_name_list((metadata or {}).get("features"))
    if expected:
        return expected
    expected = _feature_name_list(getattr(model, "feature_names_in_", None))
    if not expected:
        preprocessor = getattr(model, "named_steps", {}).get("preprocessor") if hasattr(model, "named_steps") else None
        expected = _feature_name_list(getattr(preprocessor, "feature_names_in_", None))
    return expected


def _safe_float(value: Any) -> float | None:
    try:
        if value is None or value is pd.NA:
            return None
    except Exception:
        pass
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    try:
        numeric = float(value)
        if np.isfinite(numeric):
            return numeric
    except Exception:
        pass
    return None


def _safe_string(value: Any, default: str = "Unknown") -> str:
    try:
        if value is None or value is pd.NA or pd.isna(value):
            return default
    except Exception:
        pass
    text = str(value).strip()
    if not text or text.lower() in {"nat", "nan", "none", "null"}:
        return default
    return text


def _datetime_to_ordinal(series: pd.Series) -> pd.Series:
    dt = pd.to_datetime(series, errors="coerce", utc=True)
    return dt.map(lambda value: float(value.toordinal()) if pd.notna(value) else np.nan)


def _sanitize_numeric_series(series: pd.Series, default: Any = 0.0) -> pd.Series:
    if pd.api.types.is_datetime64_any_dtype(series):
        numeric = _datetime_to_ordinal(series)
    else:
        cleaned = series.astype("object").replace(r"^\s*$", pd.NA, regex=True)
        numeric = pd.to_numeric(cleaned, errors="coerce")
        if float(numeric.notna().mean() or 0.0) < 0.35:
            dt_numeric = _datetime_to_ordinal(cleaned)
            if float(dt_numeric.notna().mean() or 0.0) > float(numeric.notna().mean() or 0.0):
                numeric = dt_numeric
    fallback = _safe_float(default)
    median = numeric.dropna().median() if numeric.notna().any() else np.nan
    fill_value = float(median) if pd.notna(median) else (fallback if fallback is not None else 0.0)
    return numeric.fillna(fill_value).astype(float)


def _sanitize_categorical_series(series: pd.Series, default: Any = "Unknown") -> pd.Series:
    cleaned = series.copy()
    if pd.api.types.is_datetime64_any_dtype(cleaned):
        cleaned = pd.to_datetime(cleaned, errors="coerce").dt.strftime("%Y-%m-%d")
    return cleaned.map(lambda value: _safe_string(value, _safe_string(default)))


def sanitize_frame_for_model(df: pd.DataFrame, model: Any, metadata: dict[str, Any] | None = None) -> pd.DataFrame:
    metadata = metadata or {}
    expected = _expected_features(model, metadata)
    if not expected:
        return df.copy()
    numeric_features = set(_feature_name_list(metadata.get("numeric_features")))
    defaults = metadata.get("defaults") or {}
    aligned = pd.DataFrame(index=df.index)
    for column in expected:
        source = df[column] if column in df.columns else pd.Series([defaults.get(column)] * len(df), index=df.index, dtype="object")
        if column in numeric_features:
            aligned[column] = _sanitize_numeric_series(source, defaults.get(column, 0.0))
        else:
            aligned[column] = _sanitize_categorical_series(source, defaults.get(column, "Unknown"))
    return aligned[expected]


def align_frame_to_model(df: pd.DataFrame, model: Any, metadata: dict[str, Any] | None = None) -> pd.DataFrame:
    return sanitize_frame_for_model(df, model, metadata)


def heuristic_risk_score(row: pd.Series) -> float:
    score = 0.35
    lowered = {str(column).lower().replace(" ", "").replace("_", ""): column for column in row.index}

    def get_column(*tokens: str) -> Any:
        for norm, original in lowered.items():
            if any(token in norm for token in tokens):
                return row.get(original)
        return None

    overtime = _safe_string(get_column("overtime", "extrahours", "workload"), "No").lower()
    if overtime in {"yes", "true", "1"}:
        score += 0.12

    for token, bump, threshold in [
        ("jobsatisfaction", 0.10, 2.0),
        ("worklifebalance", 0.08, 2.0),
        ("performancerating", 0.05, 2.0),
        ("managerrating", 0.05, 2.0),
    ]:
        value = _safe_float(get_column(token))
        if value is not None and value <= threshold:
            score += bump

    years = _safe_float(get_column("yearsatcompany", "tenure", "serviceyears"))
    if years is not None and years < 1.0:
        score += 0.08

    distance = _safe_float(get_column("distancefromhome", "commute"))
    if distance is not None and distance >= 15.0:
        score += 0.05

    promotions = get_column("promotionlast2years", "numberofpromotions", "promotions")
    promo_num = _safe_float(promotions)
    promo_text = _safe_string(promotions, "").lower()
    if (promo_num is not None and promo_num <= 0) or promo_text in {"no", "false", "0"}:
        score += 0.05

    return float(min(max(score, 0.05), 0.95))


def score_with_fallback(df: pd.DataFrame, model: Any, metadata: dict[str, Any] | None = None) -> tuple[np.ndarray, int]:
    sanitized = sanitize_frame_for_model(df, model, metadata)
    fallback_rows = 0
    try:
        proba = np.asarray(model.predict_proba(sanitized)[:, 1], dtype=float)
    except Exception:
        proba = np.full(len(sanitized), np.nan, dtype=float)
    for index in range(len(sanitized)):
        if np.isfinite(proba[index]):
            continue
        try:
            row = sanitized.iloc[[index]]
            proba[index] = float(np.asarray(model.predict_proba(row)[:, 1], dtype=float)[0])
        except Exception:
            proba[index] = heuristic_risk_score(df.iloc[index] if index < len(df) else sanitized.iloc[index])
            fallback_rows += 1
    proba = np.clip(np.nan_to_num(proba, nan=0.5, posinf=0.95, neginf=0.05), 0.0, 1.0)
    return proba, fallback_rows
