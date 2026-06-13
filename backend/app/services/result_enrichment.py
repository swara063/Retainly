from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


def _safe_float(x: Any) -> float | None:
    try:
        v = float(x)
        if np.isfinite(v):
            return v
    except Exception:
        pass
    return None


def _risk_band(score: float) -> str:
    if score >= 0.80:
        return "Critical"
    if score >= 0.65:
        return "High"
    if score >= 0.35:
        return "Medium"
    return "Low"


def detect_employee_identity_columns(df: pd.DataFrame) -> dict[str, str | None]:
    normalized = {c: str(c).lower().replace(" ", "").replace("_", "") for c in df.columns}
    id_candidates = ["employeeid", "empid", "employeenumber", "staffid", "workerid", "personid", "id"]
    name_candidates = ["employeename", "name", "fullname", "staffname", "workername"]
    employee_id_column = next((c for c, n in normalized.items() if any(tok in n for tok in id_candidates)), None)
    employee_name_column = next((c for c, n in normalized.items() if any(tok == n or tok in n for tok in name_candidates)), None)
    return {"employee_id_column": employee_id_column, "employee_name_column": employee_name_column}



def _find_column(df: pd.DataFrame, tokens: list[str]) -> str | None:
    normalized = {c: str(c).lower().replace(" ", "").replace("_", "") for c in df.columns}
    for c, n in normalized.items():
        if any(t in n for t in tokens):
            return c
    return None

def _safe_display_value(value: Any) -> str | None:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None
    text = str(value).strip()
    return text or None


def _plain_support_action(factors: list[str], band: str) -> str:
    if band in {"High", "Critical"}:
        return "Prioritize supportive retention outreach, manager check-ins, and workload review."
    if factors:
        return "Offer a supportive check-in, clarify growth opportunities, and review workload and compensation context."
    return "Use a supportive check-in and verify whether any workplace friction needs attention."


def _ethical_note() -> str:
    return "Use for supportive retention outreach, not punitive action."


def _talking_points(factors: list[str]) -> list[str]:
    points = ["Focus on support, not blame.", "Ask what would improve day-to-day work and growth."]
    if factors:
        points.append(f"Discuss the patterns behind: {', '.join(factors[:3])}.")
    return points


def _factor_messages(row: pd.Series, df: pd.DataFrame, department_col: str | None, department_value: str | None) -> list[str]:
    out: list[str] = []
    for col in df.columns:
        if col == department_col:
            continue
        norm = str(col).lower().replace(" ", "").replace("_", "")
        value = row.get(col)
        num = _safe_float(value)
        sval = _safe_display_value(value)
        if "overtime" in norm and sval and sval.lower() in {"yes", "1", "true"}:
            out.append("Sustained overtime pattern")
        elif "jobsatisfaction" in norm and num is not None and num <= 2:
            out.append("Low job satisfaction")
        elif "worklifebalance" in norm and num is not None and num <= 2:
            out.append("Work-life balance concern")
        elif "yearsatcompany" in norm and num is not None and num <= 1:
            out.append("Early-tenure employee")
        elif "distancefromhome" in norm and num is not None and num >= 15:
            out.append("Long commute distance")
        elif ("managerrating" in norm or "performancerating" in norm) and num is not None and num <= 2:
            out.append("Low manager rating")
        elif "promotionlast2years" in norm and sval and sval.lower() in {"no", "0", "false"}:
            out.append("No recent promotion")
        elif "monthlyincome" in norm and num is not None and department_col and department_value and pd.api.types.is_numeric_dtype(df[col]):
            try:
                dept_vals = pd.to_numeric(df.loc[df[department_col].astype(str) == str(department_value), col], errors="coerce").dropna()
                if len(dept_vals) and num < float(np.nanmedian(dept_vals)):
                    out.append("Below-segment compensation signal")
            except Exception:
                pass
    seen = []
    for item in out:
        if item not in seen:
            seen.append(item)
    return seen[:5]


def _safe_raw_fields(row: pd.Series, cols: list[str]) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for col in cols:
        if col in row.index:
            payload[col] = _safe_display_value(row.get(col))
    return payload


def _priority_from_rate_and_risk(attrition_rate: float | None, avg_risk: float | None) -> str:
    rate = attrition_rate if attrition_rate is not None else 0.0
    risk = avg_risk if avg_risk is not None else 0.0
    if rate >= 0.25 or risk >= 0.70:
        return "High"
    if rate >= 0.15 or risk >= 0.55:
        return "Medium"
    return "Low"


def _reliability_label(recall: float | None, precision: float | None, f1: float | None, roc_auc: float | None) -> str:
    r = recall or 0.0
    p = precision or 0.0
    f = f1 or 0.0
    a = roc_auc or 0.0
    if f >= 0.80 and r >= 0.75 and a >= 0.80:
        return "Excellent"
    if f >= 0.70 and r >= 0.65 and a >= 0.75:
        return "Good"
    if f >= 0.55 or r >= 0.55 or a >= 0.60:
        return "Directional"
    return "Directional"


def _confidence_summary(label: str, validation_note: str | None = None) -> dict[str, str]:
    plain_english = {
        "Excellent": "Confidence level: Excellent. Retainly is suitable for team-level prioritization and monitoring.",
        "Good": "Confidence level: Good. Use these insights for retention planning and manager conversations.",
        "Directional": "Confidence level: Directional. Use these insights for team-level planning and validate with HR context.",
        "Directional": "Confidence level: Directional. Use these insights for team-level planning and validate with HR context.",
    }.get(label, "Confidence level: Directional. Use these insights for team-level planning and validate with HR context.")
    return {
        "label": label,
        "plain_english": plain_english,
        "recommended_use": "Decision-support for HR planning, manager coaching, and workforce risk review.",
        "limitations": validation_note or "Review results alongside fairness checks and HR context.",
    }


def build_executive_summary(*, df: pd.DataFrame, target_col: str, results: dict) -> dict[str, Any]:
    metrics = (results.get("model") or {}).get("metrics") or {}
    recall = _safe_float(metrics.get("recall"))
    precision = _safe_float(metrics.get("precision"))
    f1 = _safe_float(metrics.get("f1"))
    roc_auc = _safe_float(metrics.get("roc_auc"))

    fairness_risk = (results.get("fairness") or {}).get("overall_risk", "—")
    selected_model = (results.get("model") or {}).get("selected_model", "—")

    attrition_rate = None
    try:
        y = df[target_col]
        # If target is numeric 0/1, use mean; else treat common positive strings as "attrition".
        if pd.api.types.is_numeric_dtype(y):
            attrition_rate = float(pd.to_numeric(y, errors="coerce").dropna().astype(float).mean())
        else:
            s = y.astype(str).str.strip().str.lower()
            pos = s.isin({"1", "yes", "true", "left", "attrition"})
            attrition_rate = float(pos.mean())
    except Exception:
        attrition_rate = None

    reliability = _reliability_label(recall, precision, f1, roc_auc)
    validation_note = (results.get("model") or {}).get("confidence_summary", {}).get("limitations")

    recommended_use = (
        "Use Retainly as decision-support to prioritize retention outreach and workplace improvements. "
        "Validate findings with HRBPs and managers, review fairness signals, and test interventions with small pilots. "
        "Do not use this output as the sole basis for employment decisions."
    )

    return {
        "rows_analyzed": int(df.shape[0]),
        "columns_analyzed": int(df.shape[1]),
        "attrition_rate": attrition_rate,
        "selected_model": selected_model,
        "model_recall": recall,
        "model_precision": precision,
        "model_f1": f1,
        "model_roc_auc": roc_auc,
        "model_reliability_label": reliability,
        "fairness_risk": fairness_risk,
        "recommended_use": recommended_use,
        "confidence_summary": _confidence_summary(reliability, validation_note),
    }


def build_employee_risk(
    *,
    df: pd.DataFrame,
    target_col: str,
    pipeline: Any,
    top_features: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    X = df.drop(columns=[target_col], errors="ignore")
    try:
        proba = pipeline.predict_proba(X)[:, 1]
    except Exception:
        proba = pipeline.predict(X)
    scores = pd.Series(proba).astype(float).clip(0, 1)

    global_top = []
    if isinstance(top_features, list):
        for f in top_features:
            name = f.get("feature")
            if isinstance(name, str) and name:
                global_top.append(name)
    global_top = global_top[:5]

    out: list[dict[str, Any]] = []
    for idx, score in scores.items():
        top_risk_factors = []
        for col in global_top[:3]:
            if col in df.columns:
                val = df.iloc[int(idx)][col]
                sval = None if pd.isna(val) else str(val)
                top_risk_factors.append({"feature": col, "value": sval})
        row_number = int(df.index[int(idx)]) if int(idx) < len(df.index) else int(idx)
        out.append(
            {
                "row_index": row_number,
                "risk_score": float(score),
                "risk_band": _risk_band(float(score)),
                "top_risk_factors": top_risk_factors,
            }
        )
    return out


def build_employee_risk_records(
    *,
    df: pd.DataFrame,
    target_col: str,
    pipeline: Any,
    top_features: list[dict[str, Any]] | None,
    model_confidence_label: str | None = None,
    employee_id_column: str | None = None,
    employee_name_column: str | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    identity = detect_employee_identity_columns(df)
    employee_id_column = employee_id_column or identity["employee_id_column"]
    employee_name_column = employee_name_column or identity["employee_name_column"]
    warnings: list[str] = []
    if not employee_id_column and not employee_name_column:
        warnings.append("No employee identifier found. Showing row-based references.")

    X = df.drop(columns=[target_col], errors="ignore")
    try:
        proba = pipeline.predict_proba(X)[:, 1]
    except Exception:
        proba = pipeline.predict(X)
    scores = pd.Series(proba).astype(float).clip(0, 1)

    top_feature_names: list[str] = []
    if isinstance(top_features, list):
        for feature in top_features:
            name = feature.get("feature")
            if isinstance(name, str) and name:
                top_feature_names.append(name)
    top_feature_names = top_feature_names[:5]

    records: list[dict[str, Any]] = []
    has_low_confidence = str(model_confidence_label or "").lower() in {"directional", "needs more data"}
    for idx, score in scores.items():
        row = df.iloc[int(idx)]
        dept_col = _find_column(df, ["department", "dept", "team", "businessunit", "function"])
        role_col = _find_column(df, ["jobrole", "role", "position", "designation", "title"])
        dept_value = _safe_display_value(row.get(dept_col)) if dept_col else None
        role_value = _safe_display_value(row.get(role_col)) if role_col else None
        employee_id = _safe_display_value(row.get(employee_id_column)) if employee_id_column else None
        employee_name = _safe_display_value(row.get(employee_name_column)) if employee_name_column else None
        display_label = employee_name or employee_id or f"Row {idx + 1}"
        factors = _factor_messages(row, df, dept_col, dept_value)
        if not factors and top_feature_names:
            factors = [f"Notable signal: {name}" for name in top_feature_names[:3]]
        protective_factors = []
        for label in ["High job satisfaction", "Strong work-life balance", "Recent promotion", "Stable tenure", "Competitive compensation"]:
            if label.lower().startswith("high job satisfaction") and any("jobsatisfaction" in str(c).lower().replace(" ", "").replace("_", "") and _safe_float(row.get(c)) is not None and _safe_float(row.get(c)) >= 4 for c in df.columns):
                protective_factors.append(label)
            elif label.lower().startswith("strong work-life balance") and any("worklifebalance" in str(c).lower().replace(" ", "").replace("_", "") and _safe_float(row.get(c)) is not None and _safe_float(row.get(c)) >= 4 for c in df.columns):
                protective_factors.append(label)
            elif label.lower().startswith("recent promotion") and any("promotionlast2years" in str(c).lower().replace(" ", "").replace("_", "") and _safe_display_value(row.get(c)) in {"Yes", "1", "True"} for c in df.columns):
                protective_factors.append(label)
            elif label.lower().startswith("stable tenure") and any("yearsatcompany" in str(c).lower().replace(" ", "").replace("_", "") and _safe_float(row.get(c)) is not None and _safe_float(row.get(c)) >= 5 for c in df.columns):
                protective_factors.append(label)
            elif label.lower().startswith("competitive compensation") and any("monthlyincome" in str(c).lower().replace(" ", "").replace("_", "") and _safe_float(row.get(c)) is not None and _safe_float(row.get(c)) >= np.nanmedian(pd.to_numeric(df[c], errors="coerce")) for c in df.columns if pd.api.types.is_numeric_dtype(df[c])):
                protective_factors.append(label)
        risk_band = _risk_band(float(score))
        raw_fields = _safe_raw_fields(row, [c for c in [employee_id_column, employee_name_column, dept_col, role_col] if c] + top_feature_names[:3])
        if has_low_confidence:
            ethical_note = "Use as directional guidance. Use for supportive retention outreach, not punitive action."
        else:
            ethical_note = _ethical_note()
        row_number = int(df.index[int(idx)]) if int(idx) < len(df.index) else int(idx)
        records.append(
            {
                "row_index": row_number,
                "employee_id": employee_id,
                "employee_name": employee_name,
                "display_label": display_label if employee_id_column or employee_name_column else f"Row {row_number + 1}",
                "department": dept_value,
                "job_role": role_value,
                "risk_score": float(score),
                "risk_percent": float(score * 100.0),
                "risk_band": risk_band,
                "top_risk_factors": factors[:5],
                "protective_factors": protective_factors[:5],
                "recommended_support_action": _plain_support_action(factors, risk_band),
                "ethical_note": ethical_note,
                "raw_fields": raw_fields,
            }
        )
    return records, warnings


@dataclass(frozen=True)
class SegmentSpec:
    label: str
    column: str
    bucket: str | None = None


def _bucket_tenure(years: float | None) -> str:
    if years is None:
        return "Unknown"
    if years < 1:
        return "<1 year"
    if years < 3:
        return "1–3 years"
    if years < 6:
        return "3–6 years"
    if years < 10:
        return "6–10 years"
    return "10+ years"


def build_risk_segments(
    *,
    df: pd.DataFrame,
    target_col: str,
    risk_scores: pd.Series,
) -> list[dict[str, Any]]:
    dept_col = _find_column(df, ["department", "dept", "team", "businessunit", "function"])
    role_col = _find_column(df, ["jobrole", "role", "position", "designation", "title"])
    overtime_col = _find_column(df, ["overtime", "overtim", "extrahours", "workload"])
    satisfaction_col = _find_column(df, ["jobsatisfaction", "satisfaction", "engagement"])
    tenure_col = _find_column(df, ["yearsatcompany", "tenure", "serviceyears"])
    specs = [
        SegmentSpec("Department", dept_col or "Department"),
        SegmentSpec("JobRole", role_col or "JobRole"),
        SegmentSpec("OverTime", overtime_col or "OverTime"),
        SegmentSpec("JobSatisfaction", satisfaction_col or "JobSatisfaction"),
        SegmentSpec("YearsAtCompany", tenure_col or "YearsAtCompany", bucket="tenure"),
    ]

    segs: list[dict[str, Any]] = []

    y = df[target_col]
    y_num = None
    try:
        if pd.api.types.is_numeric_dtype(y):
            y_num = pd.to_numeric(y, errors="coerce").astype(float)
        else:
            s = y.astype(str).str.strip().str.lower()
            y_num = s.isin({"1", "yes", "true", "left", "attrition"}).astype(float)
    except Exception:
        y_num = pd.Series([np.nan] * len(df), index=df.index)

    base = df.copy()
    base["_risk"] = risk_scores.values
    base["_y"] = y_num.values

    for spec in specs:
        if spec.column not in df.columns:
            continue
        col = base[spec.column]
        if spec.bucket == "tenure":
            bucketed = pd.to_numeric(col, errors="coerce").map(lambda v: _bucket_tenure(_safe_float(v)))
            groups = bucketed.fillna("Unknown")
        else:
            groups = col.astype(str).fillna("Unknown")

        for group_name, g in base.groupby(groups, dropna=False):
            employee_count = int(g.shape[0])
            if employee_count <= 0:
                continue
            attrition_rate = _safe_float(g["_y"].mean())
            avg_risk = _safe_float(g["_risk"].mean())
            segs.append(
                {
                    "segment_name": spec.label,
                    "group": str(group_name),
                    "employee_count": employee_count,
                    "attrition_rate": attrition_rate,
                    "average_predicted_risk": avg_risk,
                    "priority": _priority_from_rate_and_risk(attrition_rate, avg_risk),
                }
            )

    segs.sort(key=lambda x: (x.get("priority") != "High", -(x.get("average_predicted_risk") or 0), -(x.get("employee_count") or 0)))
    return segs


def build_retention_plan(
    *,
    top_drivers: list[dict[str, Any]] | None,
    risk_segments: list[dict[str, Any]] | None,
    fairness_risk: Any,
) -> list[dict[str, Any]]:
    drivers: list[str] = []
    if isinstance(top_drivers, list):
        for d in top_drivers:
            f = d.get("feature")
            if isinstance(f, str) and f:
                drivers.append(f)
    drivers = drivers[:5]

    segs = [s for s in (risk_segments or []) if isinstance(s, dict)]
    segs_sorted = sorted(segs, key=lambda x: (str(x.get("priority")) != "High", -(x.get("average_predicted_risk") or 0), -(x.get("employee_count") or 0)))

    def pick_segment(names: list[str], fallback: str) -> str:
        for name in names:
            for seg in segs_sorted:
                if str(seg.get("segment_name", "")).lower() == name.lower():
                    return f"{seg.get('segment_name')} = {seg.get('group')}"
        if segs_sorted:
            seg = segs_sorted[0]
            return f"{seg.get('segment_name')} = {seg.get('group')}"
        return fallback

    fairness_note = "Use for supportive retention planning, not punitive individual decisions. Review fairness signals before acting."
    if isinstance(fairness_risk, str) and "low" in fairness_risk.lower():
        fairness_note = "Continue fairness monitoring and focus actions on workplace support, not sensitive identity attributes."

    driver_hint = f" Key signals to validate: {', '.join(drivers)}." if drivers else ""
    candidates = [
        {
            "title": "Reduce burnout in workload-heavy teams",
            "target_segment": pick_segment(["OverTime", "Department"], "Employees with sustained overtime"),
            "reason": "Workload pressure is a common preventable reason for attrition." + driver_hint,
            "recommended_action": "Run manager-led workload reviews, rebalance staffing, and schedule stay interviews for affected teams.",
            "priority": "High",
            "timeline": "2-4 weeks",
            "success_metric": "Overtime hours down 15% and stay interview completion above 80%.",
            "expected_business_impact": "Reduces burnout-driven resignations and improves team stability.",
            "ethical_note": fairness_note,
        },
        {
            "title": "Stabilize the highest-risk department",
            "target_segment": pick_segment(["Department"], "Highest-risk department"),
            "reason": "Attrition appears concentrated in a team-level segment where HR can intervene through managers and policies." + driver_hint,
            "recommended_action": "Hold an HRBP review with team leads, identify top friction points, and assign owners for two immediate fixes.",
            "priority": "High",
            "timeline": "2-3 weeks",
            "success_metric": "Manager action plan completed and pulse sentiment improves in the next check-in.",
            "expected_business_impact": "Improves retention focus where the organization has the highest concentration of risk.",
            "ethical_note": fairness_note,
        },
        {
            "title": "Protect high-risk job roles",
            "target_segment": pick_segment(["JobRole"], "Highest-risk job role"),
            "reason": "Role-level patterns often point to workload, growth, market pay, or manager enablement gaps.",
            "recommended_action": "Create a role-specific retention sprint: stay interviews, career path clarification, and compensation-band review.",
            "priority": "High",
            "timeline": "3-6 weeks",
            "success_metric": "Stay interview themes documented and at least three role-level interventions launched.",
            "expected_business_impact": "Reduces regrettable attrition in roles that are expensive or slow to replace.",
            "ethical_note": fairness_note,
        },
        {
            "title": "Improve satisfaction and engagement signals",
            "target_segment": pick_segment(["JobSatisfaction", "WorkLifeBalance"], "Employees with low satisfaction or work-life balance"),
            "reason": "Low satisfaction and poor work-life balance are actionable employee-experience signals.",
            "recommended_action": "Run a focused pulse survey, then address the top two pain points through manager coaching and policy/process cleanup.",
            "priority": "Medium",
            "timeline": "4-6 weeks",
            "success_metric": "Pulse score improves by 10% and repeated pain points reduce in follow-up feedback.",
            "expected_business_impact": "Improves experience in groups most likely to disengage or leave.",
            "ethical_note": fairness_note,
        },
        {
            "title": "Strengthen early-tenure retention",
            "target_segment": pick_segment(["YearsAtCompany"], "Early-tenure employees"),
            "reason": "Early-tenure exits are often preventable with onboarding support and quicker manager feedback loops.",
            "recommended_action": "Add 30/60/90-day check-ins, buddy support, and structured manager feedback for early-tenure employees.",
            "priority": "Medium",
            "timeline": "2-4 weeks",
            "success_metric": "Check-in completion above 90% and early-tenure attrition trending downward next quarter.",
            "expected_business_impact": "Reduces avoidable new-hire churn and improves ramp stability.",
            "ethical_note": fairness_note,
        },
        {
            "title": "Create growth and mobility paths",
            "target_segment": "Employees showing career stagnation signals",
            "reason": "Career uncertainty, low promotion visibility, and limited internal movement can increase resignation risk.",
            "recommended_action": "Publish role paths, run internal mobility campaigns, and require managers to document growth plans for priority groups.",
            "priority": "Medium",
            "timeline": "4-8 weeks",
            "success_metric": "Growth plans created for 80% of priority employees and internal applications increase.",
            "expected_business_impact": "Improves retention by making future opportunities visible before employees start external search.",
            "ethical_note": fairness_note,
        },
        {
            "title": "Review manager support patterns",
            "target_segment": "Teams with low manager-rating or engagement signals",
            "reason": "Manager relationship and team climate are major retention levers and are actionable through coaching.",
            "recommended_action": "Coach managers on 1:1 quality, recognition, workload planning, and follow-through on employee concerns.",
            "priority": "Medium",
            "timeline": "4-6 weeks",
            "success_metric": "Manager 1:1 completion improves and employee pulse comments show fewer unresolved blockers.",
            "expected_business_impact": "Improves trust and reduces preventable manager-related attrition.",
            "ethical_note": fairness_note,
        },
        {
            "title": "Track retention outcomes monthly",
            "target_segment": "All priority segments",
            "reason": "A one-time model run is less useful than a recurring HR review loop.",
            "recommended_action": "Create a monthly Retainly review with HRBPs: hotspots, interventions launched, fairness notes, and measured outcomes.",
            "priority": "Low",
            "timeline": "Monthly",
            "success_metric": "Monthly review completed and intervention outcomes tracked for each priority segment.",
            "expected_business_impact": "Turns attrition analysis into a sustainable retention operating rhythm.",
            "ethical_note": fairness_note,
        },
    ]

    seen: dict[str, int] = {}
    plan: list[dict[str, Any]] = []
    for action in candidates:
        key = str(action["target_segment"])
        if seen.get(key, 0) >= 2:
            continue
        seen[key] = seen.get(key, 0) + 1
        plan.append(action)
    return plan[:8]

def build_data_quality(*, df: pd.DataFrame, target_col: str) -> dict[str, Any]:
    missing_counts = df.isna().sum().sort_values(ascending=False)
    missing_pct = (df.isna().mean() * 100).round(2).sort_values(ascending=False)
    missing_summary = {
        c: {"missing": int(missing_counts[c]), "missing_pct": float(missing_pct[c])}
        for c in missing_counts.index[:25].tolist()
        if int(missing_counts[c]) > 0
    }

    duplicate_rows = int(df.duplicated().sum())

    high_cardinality = []
    for c in df.columns:
        if c == target_col:
            continue
        try:
            nunique = int(df[c].nunique(dropna=True))
            if nunique >= 50 and nunique / max(1, len(df)) >= 0.25:
                high_cardinality.append({"column": c, "unique_values": nunique})
        except Exception:
            pass

    leakage_terms = ("attrition", "left", "exit", "resign", "termination", "separation", "lastworkingday", "notice")
    possible_leakage = []
    for c in df.columns:
        if c == target_col:
            continue
        name = c.replace(" ", "").lower()
        if any(t in name for t in leakage_terms):
            possible_leakage.append(c)

    warnings: list[str] = []
    if duplicate_rows:
        warnings.append(f"{duplicate_rows} duplicate rows detected.")
    if possible_leakage:
        warnings.append("Possible leakage columns present: " + ", ".join(possible_leakage[:8]) + ("…" if len(possible_leakage) > 8 else ""))
    if high_cardinality:
        warnings.append("High-cardinality columns may reduce model stability: " + ", ".join([x["column"] for x in high_cardinality[:8]]) + ("…" if len(high_cardinality) > 8 else ""))
    if missing_summary:
        worst = next(iter(missing_summary.items()))
        warnings.append(f"Missing values present (example: {worst[0]} has {worst[1]['missing_pct']}% missing).")

    score = 100
    score -= min(35, int(round(float(missing_pct.max() if len(missing_pct) else 0) / 2)))
    score -= min(25, duplicate_rows)
    score -= min(20, len(high_cardinality) * 3)
    score -= min(25, len(possible_leakage) * 6)
    score = int(max(0, min(100, score)))

    return {
        "missing_value_summary": missing_summary,
        "duplicate_rows": duplicate_rows,
        "high_cardinality_columns": high_cardinality,
        "possible_leakage_columns": possible_leakage,
        "data_quality_score": score,
        "warnings": warnings,
    }
