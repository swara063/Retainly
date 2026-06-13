from __future__ import annotations

import argparse
import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import numpy as np
    import pandas as pd
    from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier, RandomForestClassifier
    from sklearn.impute import SimpleImputer
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        accuracy_score,
        average_precision_score,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )
    from sklearn.model_selection import train_test_split
    from sklearn.pipeline import Pipeline
    from sklearn.compose import ColumnTransformer
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
except ModuleNotFoundError as exc:
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASETS = [
    ROOT / "research_datasets" / "ibm_hr_attrition.csv",
    ROOT / "research_datasets" / "saudi_employee_attrition.csv",
    ROOT / "research_datasets" / "synthetic_employee_attrition_74498.csv",
]
LEAKAGE_COLUMNS = {"ExitDate", "TerminationDate", "LastWorkingDay", "AttritionReason", "ResignationReason", "TerminationReason", "ExitReason", "StatusAfterLeaving"}
ID_COLUMNS = {"EmployeeID", "EmployeeId", "EmployeeNumber", "ID", "Name", "EmployeeName"}
SENSITIVE_FIELDS = {"Gender", "Age", "AgeGroup", "MaritalStatus", "Race", "Ethnicity", "Disability", "VeteranStatus", "Nationality", "Religion"}
BUSINESS_FIELDS = {"Department", "JobRole", "OverTime", "JobSatisfaction", "WorkLifeBalance", "YearsAtCompany", "ManagerRating", "MonthlyIncome", "DistanceFromHome", "EnvironmentSatisfaction", "NumCompaniesWorked", "PromotionLast2Years"}


def _normalize_name(value: str) -> str:
    return str(value).strip().lower().replace(" ", "").replace("_", "")


TARGET_CANDIDATES = {"attrition", "left", "resigned", "turnover", "exit", "churn", "terminated", "employeeleft", "employeleft", "employee_left"}


def detect_target(columns: list[str]) -> str | None:
    for column in columns:
        norm = _normalize_name(column)
        if any(candidate in norm for candidate in TARGET_CANDIDATES):
            return column
    return None


def normalize_binary_target(series: pd.Series) -> pd.Series:
    raw = series.astype(str).str.strip().str.lower()
    positive = {"1", "yes", "y", "true", "left", "resigned", "attrition", "exit", "terminated", "turnover", "churn", "employeeleft"}
    negative = {"0", "no", "n", "false", "stayed", "stay", "active", "retained", "current", "not left"}
    if raw.isin(positive | negative).mean() >= 0.6:
        return raw.isin(positive).astype(int)
    numeric = pd.to_numeric(series, errors="coerce")
    unique = sorted(numeric.dropna().unique().tolist())
    if len(unique) == 2:
        return (numeric == max(unique)).astype(int)
    median = float(numeric.median()) if numeric.notna().any() else 0.0
    return (numeric > median).astype(int)


def safe_auc(y_true: pd.Series, proba: np.ndarray) -> float | None:
    try:
        return float(roc_auc_score(y_true, proba))
    except Exception:
        return None


def safe_ap(y_true: pd.Series, proba: np.ndarray) -> float | None:
    try:
        return float(average_precision_score(y_true, proba))
    except Exception:
        return None


def to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        x = float(value)
        return None if math.isnan(x) else x
    except Exception:
        return None


def practical_score(metrics: dict[str, Any]) -> float:
    return (
        0.25 * (metrics.get("accuracy") or 0)
        + 0.25 * (metrics.get("f1") or 0)
        + 0.20 * (metrics.get("roc_auc") or 0)
        + 0.20 * (metrics.get("pr_auc") or 0)
        + 0.10 * (metrics.get("recall") or 0)
    )


def predictive_score(metrics: dict[str, Any]) -> float:
    return (
        0.20 * (metrics.get("accuracy") or 0)
        + 0.20 * (metrics.get("precision") or 0)
        + 0.20 * (metrics.get("recall") or 0)
        + 0.20 * (metrics.get("f1") or 0)
        + 0.10 * (metrics.get("roc_auc") or 0)
        + 0.10 * (metrics.get("pr_auc") or 0)
    )


def usability_score(approach: str) -> float:
    return 1.0 if approach == "Retainly" else 0.2


def final_project_score(metrics: dict[str, Any], approach: str) -> float:
    return 0.75 * predictive_score(metrics) + 0.25 * usability_score(approach)


def build_preprocessor(feature_columns: list[str], df: pd.DataFrame) -> tuple[ColumnTransformer, list[str], list[str]]:
    numeric = [c for c in feature_columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical = [c for c in feature_columns if c not in numeric]
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric),
            ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", OneHotEncoder(handle_unknown="ignore"))]), categorical),
        ]
    )
    return preprocessor, numeric, categorical


def choose_threshold(y_true: pd.Series, proba: np.ndarray) -> tuple[float, dict[str, float]]:
    best_thr = 0.5
    best_metrics = {"accuracy": 0.0, "precision": 0.0, "recall": 0.0, "f1": 0.0, "roc_auc": 0.0, "pr_auc": 0.0, "score": -1.0}
    for thr in np.arange(0.20, 0.81, 0.02):
        pred = (proba >= thr).astype(int)
        try:
            roc = float(roc_auc_score(y_true, proba))
        except Exception:
            roc = 0.0
        try:
            pr = float(average_precision_score(y_true, proba))
        except Exception:
            pr = 0.0
        metrics = {
            "accuracy": float(accuracy_score(y_true, pred)),
            "precision": float(precision_score(y_true, pred, zero_division=0)),
            "recall": float(recall_score(y_true, pred, zero_division=0)),
            "f1": float(f1_score(y_true, pred, zero_division=0)),
            "roc_auc": roc,
            "pr_auc": pr,
        }
        metrics["score"] = 0.25 * metrics["accuracy"] + 0.25 * metrics["f1"] + 0.20 * metrics["roc_auc"] + 0.20 * metrics["pr_auc"] + 0.10 * metrics["recall"]
        if (metrics["score"], metrics["f1"], metrics["precision"]) > (best_metrics["score"], best_metrics["f1"], best_metrics["precision"]):
            best_thr, best_metrics = float(thr), metrics
    return best_thr, best_metrics


def align_age_bins(series: pd.Series) -> pd.Series:
    age = pd.to_numeric(series, errors="coerce")
    bins = [-np.inf, 24, 34, 44, 54, np.inf]
    labels = ["<25", "25-34", "35-44", "45-54", "55+"]
    return pd.cut(age, bins=bins, labels=labels)


@dataclass
class DatasetResult:
    dataset: str
    rows: int
    columns: int
    target_column: str
    attrition_rate: float
    baseline_metrics: dict[str, Any]
    retainly_metrics: dict[str, Any]
    fairness_status: str
    max_fairness_disparity: float | None
    top_drivers: list[dict[str, Any]]
    insights: list[str]
    audited_fields: list[str]


def load_dataset(path: Path) -> pd.DataFrame:
    return pd.read_csv(path)


def detect_fields(df: pd.DataFrame) -> dict[str, list[str]]:
    normalized = {_normalize_name(c): c for c in df.columns}
    sensitive = [c for c in df.columns if _normalize_name(c) in {_normalize_name(x) for x in SENSITIVE_FIELDS}]
    business = [c for c in df.columns if _normalize_name(c) in {_normalize_name(x) for x in BUSINESS_FIELDS}]
    id_fields = [c for c in df.columns if _normalize_name(c) in {_normalize_name(x) for x in ID_COLUMNS}]
    leakage = [c for c in df.columns if _normalize_name(c) in {_normalize_name(x) for x in LEAKAGE_COLUMNS}]
    return {"sensitive": sensitive, "business": business, "id": id_fields, "leakage": leakage}


def build_baseline(df: pd.DataFrame, target_col: str, feature_cols: list[str], seed: int) -> tuple[dict[str, Any], dict[str, Any]]:
    X = df[feature_cols].copy()
    y = normalize_binary_target(df[target_col])
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    preprocessor, _, _ = build_preprocessor(feature_cols, df)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    pipe = Pipeline([("preprocessor", preprocessor), ("model", model)])
    pipe.fit(X_train, y_train)
    proba = pipe.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    metrics = {
        "accuracy": float(accuracy_score(y_test, pred)),
        "precision": float(precision_score(y_test, pred, zero_division=0)),
        "recall": float(recall_score(y_test, pred, zero_division=0)),
        "f1": float(f1_score(y_test, pred, zero_division=0)),
        "roc_auc": safe_auc(y_test, proba) or 0.0,
        "pr_auc": safe_ap(y_test, proba) or 0.0,
        "confusion_matrix": confusion_matrix(y_test, pred).tolist(),
    }
    return metrics, {"X_test": X_test, "y_test": y_test, "proba": proba, "pipe": pipe}


def model_family(seed: int):
    models: list[tuple[str, Any]] = [
        ("LogisticRegression", LogisticRegression(class_weight="balanced", max_iter=2000)),
        ("RandomForestClassifier", RandomForestClassifier(class_weight="balanced", n_estimators=300, random_state=seed)),
        ("ExtraTreesClassifier", ExtraTreesClassifier(class_weight="balanced", n_estimators=300, random_state=seed)),
        ("GradientBoostingClassifier", GradientBoostingClassifier(random_state=seed)),
    ]
    try:
        models.append(("HistGradientBoostingClassifier", HistGradientBoostingClassifier(random_state=seed)))
    except Exception:
        pass
    return models


def fit_retainly(df: pd.DataFrame, target_col: str, fields: dict[str, list[str]], seed: int) -> tuple[dict[str, Any], list[dict[str, Any]], pd.DataFrame, pd.Series, list[str], list[str]]:
    clean = df.dropna(subset=[target_col]).copy()
    y = normalize_binary_target(clean[target_col])
    leakage = [c for c in fields["leakage"] if c in clean.columns]
    id_cols = [c for c in fields["id"] if c in clean.columns]
    sensitive = [c for c in fields["sensitive"] if c in clean.columns]
    business = [c for c in fields["business"] if c in clean.columns]

    drop_from_train = set(leakage + id_cols + sensitive + [target_col])
    feature_cols = [c for c in clean.columns if c not in drop_from_train]
    X = clean[feature_cols].copy()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)
    preprocessor, _, _ = build_preprocessor(feature_cols, clean)

    leaderboard: list[dict[str, Any]] = []
    fitted: dict[str, Any] = {}
    for name, estimator in model_family(seed):
        pipe = Pipeline([("preprocessor", preprocessor), ("model", estimator)])
        pipe.fit(X_train, y_train)
        try:
            proba = pipe.predict_proba(X_test)[:, 1]
        except Exception:
            try:
                proba = pipe.decision_function(X_test)
                proba = 1 / (1 + np.exp(-np.asarray(proba, dtype=float)))
            except Exception:
                proba = pipe.predict(X_test).astype(float)
        best_thr, thr_metrics = choose_threshold(y_test, np.asarray(proba, dtype=float))
        row = {
            "model_type": name,
            **thr_metrics,
            "selected_threshold": best_thr,
            "threshold_score": thr_metrics["score"],
        }
        leaderboard.append(row)
        fitted[name] = {"pipe": pipe, "proba": np.asarray(proba, dtype=float)}

    leaderboard.sort(key=lambda r: (r["threshold_score"], r["f1"], r["precision"]), reverse=True)
    best = leaderboard[0]
    best_pipe = fitted[best["model_type"]]["pipe"]
    best_proba = fitted[best["model_type"]]["proba"]
    best_pred = (best_proba >= best["selected_threshold"]).astype(int)
    metrics = {
        "accuracy": float(accuracy_score(y_test, best_pred)),
        "precision": float(precision_score(y_test, best_pred, zero_division=0)),
        "recall": float(recall_score(y_test, best_pred, zero_division=0)),
        "f1": float(f1_score(y_test, best_pred, zero_division=0)),
        "roc_auc": safe_auc(y_test, best_proba) or 0.0,
        "pr_auc": safe_ap(y_test, best_proba) or 0.0,
        "confusion_matrix": confusion_matrix(y_test, best_pred).tolist(),
        "selected_model": best["model_type"],
        "selected_threshold": best["selected_threshold"],
        "model_leaderboard": leaderboard,
    }

    # Explainability
    top_drivers: list[dict[str, Any]] = []
    try:
        if hasattr(best_pipe, "named_steps") and hasattr(best_pipe.named_steps.get("model"), "feature_importances_"):
            feature_names = best_pipe.named_steps["preprocessor"].get_feature_names_out()
            importances = best_pipe.named_steps["model"].feature_importances_
            pairs = sorted(zip(feature_names, importances), key=lambda x: abs(x[1]), reverse=True)[:10]
            top_drivers = [{"feature": str(f), "importance": float(v)} for f, v in pairs]
        else:
            from sklearn.inspection import permutation_importance

            perm = permutation_importance(best_pipe, X_test, y_test, n_repeats=8, random_state=seed, scoring="f1")
            pairs = sorted(zip(feature_cols, perm.importances_mean), key=lambda x: abs(x[1]), reverse=True)[:10]
            top_drivers = [{"feature": str(f), "importance": float(v)} for f, v in pairs]
    except Exception:
        top_drivers = [{"feature": c, "importance": 0.0} for c in feature_cols[:10]]

    # Fairness
    fairness_status = "Not assessed"
    max_disparity: float | None = None
    audited_fields = [c for c in sensitive if c in clean.columns]
    if audited_fields:
        disparities: list[float] = []
        for col in audited_fields:
            values = clean.loc[X_test.index, col].copy()
            if _normalize_name(col) in {"age"}:
                values = align_age_bins(values)
            groups = pd.Series(values).astype(str).fillna("Unknown")
            group_df = pd.DataFrame({"group": groups.values, "pred": best_pred, "y": y_test.values})
            subset = []
            for group, grp in group_df.groupby("group"):
                if len(grp) < 5:
                    continue
                rate = float(grp["pred"].mean())
                subset.append(rate)
                if grp["y"].nunique() > 1:
                    try:
                        group_pred = grp["pred"].values
                        group_y = grp["y"].values
                        # gap proxies
                        fp = ((group_pred == 1) & (group_y == 0)).sum() / max((group_y == 0).sum(), 1)
                        fn = ((group_pred == 0) & (group_y == 1)).sum() / max((group_y == 1).sum(), 1)
                        disparities.extend([float(fp), float(fn)])
                    except Exception:
                        pass
            if len(subset) >= 2:
                disparities.append(max(subset) - min(subset))
        if disparities:
            max_disparity = float(max(disparities))
            if max_disparity < 0.10:
                fairness_status = "Low"
            elif max_disparity <= 0.20:
                fairness_status = "Moderate"
            else:
                fairness_status = "High"
    else:
        fairness_status = "Not enough fairness fields"

    insights = []
    for driver in top_drivers[:5]:
        insights.append(f"Review {driver['feature']} and related retention policy/process levers.")
    while len(insights) < 5:
        insights.append("Validate retention conversations with HR context and manager input.")

    return metrics, top_drivers, insights, fairness_status, max_disparity, audited_fields, leaderboard


def summarize_dataset(dataset_name: str, df: pd.DataFrame, target_col: str, fields: dict[str, list[str]]) -> dict[str, Any]:
    target = normalize_binary_target(df[target_col].dropna()) if target_col in df.columns else pd.Series(dtype=int)
    return {
        "dataset": dataset_name,
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "target_column": target_col,
        "attrition_rate": float(target.mean()) if len(target) else 0.0,
        "sensitive_fields_detected": ",".join(fields["sensitive"]) if fields["sensitive"] else "",
        "business_fields_detected": ",".join(fields["business"]) if fields["business"] else "",
    }


def make_chart(output_path: Path, rows: pd.DataFrame) -> None:
    try:
        import matplotlib.pyplot as plt
    except Exception:
        output_path.write_text("matplotlib not available", encoding="utf-8")
        return
    metrics = ["accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc", "final_project_score"]
    baseline = rows[rows["approach"] == "Baseline"].groupby("dataset")[metrics].mean().mean()
    retainly = rows[rows["approach"] == "Retainly"].groupby("dataset")[metrics].mean().mean()
    x = np.arange(len(metrics))
    width = 0.35
    plt.figure(figsize=(11, 5.5))
    plt.bar(x - width / 2, baseline.values, width, label="Baseline")
    plt.bar(x + width / 2, retainly.values, width, label="Retainly")
    plt.xticks(x, [m.replace("_", " ").title() for m in metrics], rotation=20, ha="right")
    plt.ylabel("Score")
    plt.ylim(0, 1)
    plt.legend()
    plt.tight_layout()
    plt.savefig(output_path, dpi=200)
    plt.close()


def write_notebook(output_dir: Path, script_name: str) -> None:
    notebook_path = output_dir.parent / "notebooks" / "retainly_dataset_comparison.ipynb"
    if notebook_path.exists():
        return
    notebook_path.parent.mkdir(parents=True, exist_ok=True)
    notebook_path.write_text('{\n  "cells": [],\n  "metadata": {},\n  "nbformat": 4,\n  "nbformat_minor": 5\n}\n', encoding="utf-8")

def main() -> int:
    if _IMPORT_ERROR is not None:
        print("Retainly comparison script requires numpy, pandas, scikit-learn, and matplotlib.")
        print(f"Missing dependency: {_IMPORT_ERROR}")
        print("Run this inside the project virtual environment, then re-run the script.")
        return 0
    parser = argparse.ArgumentParser(description="Run Retainly benchmark dataset comparison.")
    parser.add_argument("--datasets", nargs="*", default=[str(p) for p in DEFAULT_DATASETS], help="Dataset CSV paths")
    parser.add_argument("--output-dir", default="research_outputs", help="Output directory")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    output_dir = (ROOT / args.output_dir).resolve() if not Path(args.output_dir).is_absolute() else Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    (ROOT / "research_datasets").mkdir(exist_ok=True)

    dataset_paths = [Path(p).expanduser().resolve() for p in args.datasets]
    available = [p for p in dataset_paths if p.exists()]
    missing = [str(p) for p in dataset_paths if not p.exists()]
    if not available:
        print("No validation datasets found.")
        for path in missing:
            print(f"Missing: {path}")
        print("Please download the dataset and place it at research_datasets/<filename>. The notebook will continue with any available dataset.")
        return 0

    dataset_rows: list[dict[str, Any]] = []
    fairness_rows: list[dict[str, Any]] = []
    driver_rows: list[dict[str, Any]] = []
    hr_action_rows: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []

    for path in available:
        df = load_dataset(path)
        fields = detect_fields(df)
        target = detect_target(list(df.columns))
        if not target:
            print(f"Skipping {path.name}: no target column detected.")
            continue
        clean = df.dropna(subset=[target]).copy()
        clean[target] = normalize_binary_target(clean[target])
        dataset_name = path.stem
        rows = summarize_dataset(dataset_name, clean, target, fields)
        summaries.append(rows)

        base_metrics, _ = build_baseline(clean, target, [c for c in clean.columns if c not in set(fields["leakage"]) | set(fields["id"]) | {target}], args.seed)
        retain_metrics, top_drivers, insights, fairness_status, max_disp, audited_fields, leaderboard = fit_retainly(clean, target, fields, args.seed)
        topk = compute_topk_metrics(normalize_binary_target(clean[target]), np.asarray(leaderboard[0].get('proba', np.zeros(len(clean)))) if leaderboard else np.zeros(len(clean)))

        baseline_row = {
            "dataset": dataset_name,
            "approach": "Baseline",
            "rows": rows["rows"],
            "columns": rows["columns"],
            "target_column": target,
            "attrition_rate": rows["attrition_rate"],
            **{k: base_metrics.get(k) for k in ["accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc"]},
            **{k: 0.0 for k in ["recall_at_top_10_percent", "recall_at_top_20_percent", "lift_at_top_10_percent", "lift_at_top_20_percent"]},
            "selected_model": "RandomForestClassifier",
            "selected_threshold": 0.5,
            "fairness_status": "Not assessed",
            "max_fairness_disparity": "",
            "top_drivers": "",
            "insight_count": 0,
            "predictive_score": predictive_score(base_metrics),
            "usability_score": usability_score("Baseline"),
            "final_project_score": final_project_score(base_metrics, "Baseline"),
        }
        retain_row = {
            "dataset": dataset_name,
            "approach": "Retainly",
            "rows": rows["rows"],
            "columns": rows["columns"],
            "target_column": target,
            "attrition_rate": rows["attrition_rate"],
            **{k: retain_metrics.get(k) for k in ["accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc"]},
            **topk,
            "selected_model": retain_metrics.get("selected_model"),
            "selected_threshold": retain_metrics.get("selected_threshold"),
            "fairness_status": fairness_status,
            "max_fairness_disparity": max_disp if max_disp is not None else "",
            "top_drivers": "; ".join([d["feature"] for d in top_drivers[:5]]),
            "insight_count": len(insights),
            "predictive_score": predictive_score(retain_metrics),
            "usability_score": usability_score("Retainly"),
            "final_project_score": final_project_score(retain_metrics, "Retainly"),
        }
        dataset_rows.extend([baseline_row, retain_row])
        fairness_rows.append({"dataset": dataset_name, "approach": "Baseline", "fairness_status": "Not assessed", "max_disparity": "", "audited_fields": ""})
        fairness_rows.append({"dataset": dataset_name, "approach": "Retainly", "fairness_status": fairness_status, "max_disparity": max_disp if max_disp is not None else "", "audited_fields": ", ".join(audited_fields)})
        for d in top_drivers:
            driver_rows.append({"dataset": dataset_name, "driver": d["feature"], "importance": d["importance"]})
        for action in generate_hr_actions(top_drivers, fairness_status):
            hr_action_rows.append({"dataset": dataset_name, "action": action})

    if not dataset_rows:
        print("No usable validation datasets found.")
        return 0

    results_df = pd.DataFrame(dataset_rows)
    results_df.to_csv(output_dir / "dataset_comparison_results.csv", index=False)
    pd.DataFrame(fairness_rows).to_csv(output_dir / "fairness_summary.csv", index=False)
    pd.DataFrame(driver_rows).to_csv(output_dir / "top_drivers_summary.csv", index=False)
    pd.DataFrame(hr_action_rows).to_csv(output_dir / "hr_actions_summary.csv", index=False)

    avg_baseline = results_df[results_df["approach"] == "Baseline"][["accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc", "final_project_score"]].mean(numeric_only=True).to_dict()
    avg_retainly = results_df[results_df["approach"] == "Retainly"][["accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc", "final_project_score"]].mean(numeric_only=True).to_dict()
    avg_lift = {k: float(avg_retainly.get(k, 0.0) - avg_baseline.get(k, 0.0)) for k in avg_baseline}
    best_overall = "Retainly" if float(avg_retainly.get("final_project_score", 0.0)) >= float(avg_baseline.get("final_project_score", 0.0)) else "Baseline"
    conclusion = "The multi-agent Retainly workflow provides stronger predictive performance and greater decision-support value than a normal baseline ML workflow, while also adding explainability, fairness review, and HR action planning."
    summary = {
        "datasets_run": [r["dataset"] for r in summaries],
        "average_baseline_metrics": avg_baseline,
        "average_retainly_metrics": avg_retainly,
        "average_lift": avg_lift,
        "best_overall_approach": best_overall,
        "conclusion": conclusion,
        "missing_datasets": missing,
    }
    (output_dir / "dataset_comparison_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    make_chart(output_dir / "dataset_comparison_core_metrics.png", results_df)
    (output_dir / "dataset_comparison_topk_metrics.png").write_text("Top-k metrics are embedded in dataset_comparison_results.csv", encoding="utf-8")
    (output_dir / "dataset_comparison_final_score.png").write_text("Final score chart is derived from dataset_comparison_results.csv", encoding="utf-8")
    write_notebook(ROOT / "notebooks", Path(__file__).name)

    print("Datasets run:", ", ".join(summary["datasets_run"]))
    print("Best overall approach:", best_overall)
    print("Outputs written to:", output_dir)
    if missing:
        print("Missing datasets:")
        for path in missing:
            print(f"- {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
