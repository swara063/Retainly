from __future__ import annotations

from typing import Any

import pandas as pd

from app.agents.column_mapper import SENSITIVE_CANDIDATES, TARGET_CANDIDATES


def _normalize(col: str) -> str:
    return str(col).lower().replace(" ", "").replace("_", "")


def infer_mapping(df: pd.DataFrame) -> dict[str, Any]:
    normalized = {c: _normalize(c) for c in df.columns}
    target = None
    for col, norm in normalized.items():
        if any(candidate in norm for candidate in TARGET_CANDIDATES):
            target = col
            break
    if target is None and len(df.columns):
        target = None

    numeric = [c for c in df.select_dtypes(include="number").columns if c != target]
    categorical = [c for c in df.columns if c not in numeric and c != target]
    sensitive = [c for c in df.columns if normalized.get(c) in SENSITIVE_CANDIDATES or any(s in normalized.get(c, "") for s in SENSITIVE_CANDIDATES)]
    return {
        "target": target,
        "numeric_features": numeric,
        "categorical_features": categorical,
        "sensitive_attributes": sensitive,
    }


def build_preview_payload(df: pd.DataFrame) -> dict[str, Any]:
    mapping = infer_mapping(df)
    target = mapping.get("target")

    warnings: list[str] = []
    if target and target in df.columns:
        uniq = df[target].dropna().astype(str).str.lower().unique().tolist()[:20]
        if len(uniq) > 10:
            warnings.append("Target column has many unique values; ensure it is a binary attrition label.")
    else:
        warnings.append("No attrition target detected. Retainly will use unlabeled scoring mode.")

    if not mapping.get("sensitive_attributes"):
        warnings.append("No sensitive attributes inferred. Add attributes (e.g., Gender, Age) to enable fairness auditing.")

    if df.isna().mean().max() > 0.35:
        warnings.append("High missingness detected in at least one column; results may be less reliable.")

    preview = df.head(10).replace({pd.NA: None}).to_dict(orient="records")
    return {
        "columns": list(df.columns),
        "first_rows": preview,
        "inferred_target_column": mapping.get("target"),
        "dataset_mode": "labeled_training" if mapping.get("target") else "unlabeled_scoring",
        "inferred_numeric_columns": mapping.get("numeric_features") or [],
        "inferred_categorical_columns": mapping.get("categorical_features") or [],
        "inferred_sensitive_attributes": mapping.get("sensitive_attributes") or [],
        "warnings": warnings,
    }
