from __future__ import annotations

import json
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


ROOT = Path(__file__).resolve().parents[1]
TRAIN_DATASET = ROOT / "research_datasets" / "synthetic_employee_attrition_74498train.csv"
MODELS_DIR = ROOT / "backend" / "storage" / "models"
MODEL_PATH = MODELS_DIR / "retainly_pretrained.joblib"
METADATA_PATH = MODELS_DIR / "retainly_pretrained_metadata.json"
MODELS_DIR.mkdir(parents=True, exist_ok=True)


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def detect_target(df: pd.DataFrame) -> str:
    for column in df.columns:
        norm = normalize_name(column)
        if norm in {"attrition", "left", "turnover", "status"} or "attrition" in norm or "turnover" in norm:
            return column
    raise ValueError("Could not detect target column in synthetic training dataset.")


def normalize_target(series: pd.Series) -> pd.Series:
    raw = series.astype(str).str.strip().str.lower()
    positive = {"1", "yes", "y", "true", "left", "leaver", "attrition", "resigned", "exit", "exited", "terminated", "turnover", "churn"}
    negative = {"0", "no", "n", "false", "stayed", "stay", "active", "retained", "current", "not left"}
    if raw.isin(positive | negative).mean() >= 0.6:
        return raw.isin(positive).astype(int)
    numeric = pd.to_numeric(series, errors="coerce")
    unique = sorted(numeric.dropna().unique().tolist())
    if len(unique) == 2:
        return (numeric == max(unique)).astype(int)
    median = float(numeric.median()) if numeric.notna().any() else 0.0
    return (numeric > median).astype(int)


def build_preprocessor(df: pd.DataFrame, feature_columns: list[str]) -> tuple[ColumnTransformer, list[str], list[str]]:
    numeric = [column for column in feature_columns if pd.api.types.is_numeric_dtype(df[column])]
    categorical = [column for column in feature_columns if column not in numeric]
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric),
            ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", OneHotEncoder(handle_unknown="ignore", max_categories=30))]), categorical),
        ]
    )
    return preprocessor, numeric, categorical


def practical_score(metrics: dict[str, float]) -> float:
    return (
        0.42 * metrics["recall"]
        + 0.28 * metrics["pr_auc"]
        + 0.18 * metrics["roc_auc"]
        + 0.12 * metrics["f1"]
    )


def main() -> int:
    if not TRAIN_DATASET.exists():
        raise SystemExit(f"Training dataset not found: {TRAIN_DATASET}")

    df = pd.read_csv(TRAIN_DATASET)
    target_column = detect_target(df)
    y = normalize_target(df[target_column]).astype(int)
    X = df.drop(columns=[target_column]).copy()

    useful_columns = []
    for column in X.columns:
        if X[column].isna().mean() < 0.65 and X[column].nunique(dropna=True) > 1:
            useful_columns.append(column)
    X = X[useful_columns]

    preprocessor, numeric, categorical = build_preprocessor(X, list(X.columns))
    models = {
        "LogisticRegression": LogisticRegression(max_iter=1000, class_weight="balanced"),
        "RandomForest": RandomForestClassifier(n_estimators=120, random_state=42, class_weight="balanced_subsample", n_jobs=-1, min_samples_leaf=4),
        "GradientBoosting": GradientBoostingClassifier(random_state=42, n_estimators=120),
    }

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    best: tuple[float, str, Pipeline, dict[str, float]] | None = None
    leaderboard: list[dict[str, float | str]] = []
    for name, model in models.items():
        pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])
        pipeline.fit(X_train, y_train)
        proba = pipeline.predict_proba(X_test)[:, 1]
        best_threshold = 0.5
        best_metrics: dict[str, float] | None = None
        best_score = -1.0
        for threshold in np.linspace(0.20, 0.70, 26):
            pred = (proba >= threshold).astype(int)
            metrics = {
                "precision": float(precision_score(y_test, pred, zero_division=0)),
                "recall": float(recall_score(y_test, pred, zero_division=0)),
                "f1": float(f1_score(y_test, pred, zero_division=0)),
                "roc_auc": float(roc_auc_score(y_test, proba)),
                "pr_auc": float(average_precision_score(y_test, proba)),
            }
            score = practical_score(metrics)
            if score > best_score:
                best_score = score
                best_threshold = float(threshold)
                best_metrics = metrics
        assert best_metrics is not None
        row = {"model": name, "selected_threshold": round(best_threshold, 3), **{key: round(value, 4) for key, value in best_metrics.items()}}
        leaderboard.append(row)
        if best is None or best_score > best[0]:
            best = (best_score, name, pipeline, row)

    assert best is not None
    _, selected_name, selected_pipeline, selected_metrics = best

    defaults: dict[str, float | str] = {}
    for column in X.columns:
        if column in numeric:
            median = pd.to_numeric(X[column], errors="coerce").median()
            defaults[column] = float(median) if pd.notna(median) else 0.0
        else:
            mode = X[column].mode(dropna=True)
            defaults[column] = str(mode.iloc[0]) if not mode.empty else "Unknown"

    metadata = {
        "selected_model": selected_name,
        "model_type": selected_name,
        "training_dataset": TRAIN_DATASET.name,
        "website_mode": "unlabeled_risk_scoring",
        "target_column": target_column,
        "features": list(X.columns),
        "numeric_features": numeric,
        "categorical_features": categorical,
        "defaults": defaults,
        "selected_threshold": selected_metrics["selected_threshold"],
        "metrics": selected_metrics,
        "leaderboard": leaderboard,
        "training_rows": int(len(X)),
        "training_sources": [TRAIN_DATASET.name],
        "confidence_label": "Directional",
        "plain_english": "Confidence level: Directional. Use these insights for team-level planning and validate with HR context.",
        "limitations": "Website model trained for unlabeled employee risk scoring. Validation metrics are maintained separately in the benchmark notebook and scripts.",
    }

    joblib.dump(selected_pipeline, MODEL_PATH)
    METADATA_PATH.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"saved model {MODEL_PATH}")
    print(f"saved metadata {METADATA_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
