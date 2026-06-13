from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[1]
BACKEND_MODELS = ROOT / "backend" / "storage" / "models"
RESEARCH_DATASETS = [
    ROOT / "research_datasets" / "synthetic_employee_attrition_74498.csv",
    ROOT / "research_datasets" / "ibm_hr_attrition.csv",
    ROOT / "research_datasets" / "saudi_employee_attrition.csv",
]

TARGET_CANDIDATES = ["attrition", "left", "resigned", "turnover", "exit", "churn"]


def _find_target_column(df: pd.DataFrame) -> str | None:
    normalized = {c: str(c).lower().replace(" ", "").replace("_", "") for c in df.columns}
    for col, norm in normalized.items():
        if any(candidate in norm for candidate in TARGET_CANDIDATES):
            return col
    return None


def _load_datasets() -> list[tuple[Path, pd.DataFrame, str]]:
    loaded: list[tuple[Path, pd.DataFrame, str]] = []
    for path in RESEARCH_DATASETS:
        if not path.exists():
            continue
        df = pd.read_csv(path)
        target = _find_target_column(df)
        if target:
            loaded.append((path, df, target))
    return loaded


def _normalize_target(series: pd.Series) -> pd.Series:
    if pd.api.types.is_numeric_dtype(series):
        return pd.to_numeric(series, errors="coerce").fillna(0).astype(int)
    text = series.astype(str).str.strip().str.lower()
    return text.isin({"1", "yes", "true", "left", "attrition", "y"}).astype(int)


def main() -> int:
    datasets = _load_datasets()
    if not datasets:
        print("No labeled research datasets found.")
        print("Add one or more of:")
        for path in RESEARCH_DATASETS:
            print(f" - {path}")
        return 0

    frames: list[pd.DataFrame] = []
    for path, df, target in datasets:
        work = df.copy()
        work["__target__"] = _normalize_target(work[target])
        work["__source__"] = path.name
        work = work.dropna(subset=["__target__"])
        frames.append(work)

    combined = pd.concat(frames, ignore_index=True)
    y = combined.pop("__target__").astype(int)
    combined.pop("__source__", None)
    combined = combined.drop(columns=[c for c in combined.columns if c in {"Attrition", "attrition"}], errors="ignore")

    numeric_features = list(combined.select_dtypes(include="number").columns)
    categorical_features = [c for c in combined.columns if c not in numeric_features]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric_features),
            ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", OneHotEncoder(handle_unknown="ignore"))]), categorical_features),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", LogisticRegression(max_iter=2000, class_weight="balanced")),
        ]
    )
    model.fit(combined, y)

    BACKEND_MODELS.mkdir(parents=True, exist_ok=True)
    model_path = BACKEND_MODELS / "retainly_pretrained.joblib"
    metadata_path = BACKEND_MODELS / "retainly_pretrained_metadata.json"

    joblib.dump(model, model_path)
    metadata: dict[str, Any] = {
        "model_path": str(model_path),
        "training_rows": int(len(combined)),
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "datasets_used": [path.name for path, _, _ in datasets],
        "target_name": "__target__",
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Saved pretrained model to {model_path}")
    print(f"Saved metadata to {metadata_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
