from __future__ import annotations

import os
from typing import Any

import httpx
from app.storage.local_store import latest_result_path, load_json


DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1"
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


class ChatConfigError(RuntimeError):
    pass


def _require_key():
    if not os.getenv("GROQ_API_KEY", ""):
        return


def groq_config() -> tuple[str, str, str]:
    return (
        os.getenv("GROQ_BASE_URL", DEFAULT_GROQ_BASE_URL),
        os.getenv("GROQ_API_KEY", ""),
        os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL),
    )


def build_system_prompt() -> str:
    return (
        "You are Retainly Help, an HR-friendly assistant for an employee attrition analytics dashboard.\n"
        "Rules:\n"
        "- Explain results in simple, non-technical language first, then (optionally) provide technical detail.\n"
        "- Do not lead with raw ML metrics such as accuracy, precision, F1, ROC-AUC, or PR-AUC.\n"
        "- Use HR-friendly metric names in user-facing answers: recall = risk capture rate; precision = review efficiency; ROC-AUC = ranking quality; PR-AUC = attrition detection quality.\n"
        "- If accuracy or precision looks low, explain that attrition data is imbalanced and Retainly is tuned for supportive risk screening, not automated decisions.\n"
        "- Mention raw accuracy/precision/F1/ROC-AUC only when the user explicitly asks for technical metrics, model details, or method notes.\n"
        "- When explaining model usefulness, prefer top-risk evaluation: top 10%/top 20% risk capture and attrition rate in highest-risk groups.\n"
        "- Never suggest using model outputs for automatic termination/punitive actions.\n"
        "- Be clear that insights are correlations/patterns, not guaranteed causation.\n"
        "- If the user asks for a decision, respond with a decision-support framing.\n"
        "- Use the latest uploaded dataset's results as source material when available.\n"
        "- Answer questions using the provided executive summary, hotspots, action plan, fairness notes, top-risk evaluation, and explainability signals.\n"
        "- If something is missing from the results, say so plainly instead of guessing.\n"
        "- Include brief source anchors such as 'Based on the executive summary', 'Based on hotspot analysis', or 'Based on model explainability'.\n"
        "- When helpful, name the exact field or segment you are referencing.\n"
        "- Keep responses concise and actionable (bulleted steps when helpful).\n"
    )


def _fmt(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, float):
        return f"{value:.3f}"
    if isinstance(value, int):
        return str(value)
    return str(value)


def _pct(value: Any) -> str:
    try:
        if value is None:
            return "—"
        return f"{float(value) * 100:.0f}%"
    except Exception:
        return _fmt(value)


def _compact_list(items: Any, limit: int = 5) -> str:
    if not isinstance(items, list) or not items:
        return "—"
    parts = []
    for item in items[:limit]:
        if isinstance(item, dict):
            parts.append(", ".join(f"{k}={_fmt(v)}" for k, v in item.items() if k in {"segment_name", "group", "priority", "average_predicted_risk", "attrition_rate", "target_segment", "title", "timeline"}))
        else:
            parts.append(_fmt(item))
    return " | ".join(parts)


def build_context_snippet(results: dict[str, Any] | None) -> str:
    if not results:
        return "No analysis results available yet."
    model = results.get("model") or {}
    metrics = model.get("metrics") or {}
    model_label = model.get("selected_model") or "Retainly pretrained attrition-risk model"
    fairness = results.get("fairness") or {}
    explain = results.get("explainability") or {}
    exec_sum = results.get("executive_summary") or {}
    hotspots = results.get("risk_segments") or []
    plan = results.get("retention_plan") or []
    dq = results.get("data_quality") or {}
    top_features = explain.get("top_features") or []
    shap = (explain.get("shap") or {}) if isinstance(explain, dict) else {}
    shap_top = shap.get("global_importance") or []
    action_titles = [a.get("title") for a in plan if isinstance(a, dict) and a.get("title")]
    hotspot_labels = []
    for item in hotspots[:6]:
        if isinstance(item, dict):
            hotspot_labels.append(f"{item.get('segment_name')}={item.get('group')} (priority={item.get('priority')}, risk={_fmt(item.get('average_predicted_risk'))})")
    return (
        "Latest Retainly analysis context:\n"
        f"- Dataset ID: {_fmt(results.get('dataset_id'))}\n"
        f"- Employees analyzed: {_fmt(exec_sum.get('rows_analyzed') or (results.get('dataset_profile') or {}).get('rows'))}\n"
        f"- Observed attrition rate: {_pct(exec_sum.get('attrition_rate'))}\n"
        f"- Model confidence: {_fmt(exec_sum.get('model_reliability_label') or metrics.get('model_reliability_label'))}\n"
        f"- Fairness review status: {_fmt(fairness.get('overall_risk'))}\n"
        f"- Risk capture rate (recall): {_pct(metrics.get('recall'))}\n"
        f"- Review efficiency (precision): {_pct(metrics.get('precision'))}\n"
        f"- Ranking quality (ROC-AUC): {_fmt(metrics.get('roc_auc'))}\n"
        f"- Attrition detection quality (PR-AUC): {_fmt(metrics.get('pr_auc'))}\n"
        f"- Top 10% risk capture: {_pct(metrics.get('recall_at_top_10_percent'))}; attrition rate in top 10%: {_pct(metrics.get('attrition_rate_in_top_10_percent'))}\n"
        f"- Top 20% risk capture: {_pct(metrics.get('recall_at_top_20_percent'))}; attrition rate in top 20%: {_pct(metrics.get('attrition_rate_in_top_20_percent'))}\n"
        f"- Selected model for method notes: {_fmt(model_label)}\n"
        f"- Action plan summary: {_compact_list(plan, limit=3)}\n"
        f"- Hotspots summary: {_compact_list(hotspots, limit=4)}\n"
        f"- Top HR signals/drivers: {_compact_list(top_features, limit=5)}\n"
        f"- SHAP summary: {_compact_list(shap_top, limit=5)}\n"
        f"- Data quality score: {_fmt((dq or {}).get('data_quality_score'))}\n"
        f"- Data quality warnings: {_compact_list((dq or {}).get('warnings'), limit=3)}\n"
        f"- Action plan titles: {', '.join(action_titles[:5]) if action_titles else '—'}\n"
        f"- Hotspot anchors: {' | '.join(hotspot_labels) if hotspot_labels else '—'}\n"
        "- Chat guidance: Lead with HR interpretation. Keep raw metrics in method notes unless explicitly requested.\n"
    )


def load_latest_results() -> dict[str, Any] | None:
    try:
        path = latest_result_path()
        if not path or not path.exists():
            return None
        data = load_json(path)
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def build_source_notes(results: dict[str, Any] | None) -> list[str]:
    if not results:
        return ["No analysis results available yet."]
    notes: list[str] = ["Based on the latest uploaded dataset results."]
    exec_sum = results.get("executive_summary") or {}
    model = results.get("model") or {}
    fairness = results.get("fairness") or {}
    explain = results.get("explainability") or {}
    hotspots = results.get("risk_segments") or []
    plan = results.get("retention_plan") or []
    dq = results.get("data_quality") or {}

    if exec_sum:
        notes.append("Based on the executive summary: employees analyzed, attrition rate, model reliability, and fairness risk.")
    if isinstance(hotspots, list) and hotspots:
        notes.append("Based on hotspot analysis: department, role, overtime, satisfaction, and tenure segments.")
    if isinstance(plan, list) and plan:
        notes.append("Based on the retention action plan: prioritized HR actions and timelines.")
    if isinstance(explain.get("shap"), dict) and explain["shap"].get("global_importance"):
        notes.append("Based on SHAP explainability: global feature importance rankings.")
    if isinstance(explain.get("top_features"), list) and explain["top_features"]:
        notes.append("Based on top predictive features from the model explanation.")
    if fairness:
        notes.append(f"Based on fairness review: {fairness.get('overall_risk', '—')}.")
    if dq:
        notes.append(f"Based on data quality review: score {dq.get('data_quality_score', '—')} with warnings if present.")
    if model:
        notes.append(f"Based on the selected model method notes: {model.get('selected_model') or 'Retainly pretrained attrition-risk model'} and HR-facing risk-screening metrics.")
    return notes[:8]


def fallback_hr_answer(question: str, results: dict[str, Any] | None = None) -> str:
    """Deterministic assistant used when Groq is not configured or temporarily offline."""
    if not results:
        results = load_latest_results()
    q = (question or "").lower()
    if not results:
        return (
            "Upload an HR CSV and run retention analysis first. After that I can explain attrition hotspots, "
            "employee risk groups, model notes, fairness checks, and the recommended action plan."
        )
    exec_sum = results.get("executive_summary") or {}
    model = results.get("model") or {}
    metrics = model.get("metrics") or {}
    model_label = model.get("selected_model") or "Retainly pretrained attrition-risk model"
    fairness = results.get("fairness") or {}
    hotspots = [x for x in (results.get("risk_segments") or []) if isinstance(x, dict)]
    plan = [x for x in (results.get("retention_plan") or []) if isinstance(x, dict)]
    explain = results.get("explainability") or {}
    employees = results.get("employee_risk_records") or []

    if "accuracy" in q or "precision" in q or "f1" in q or "roc" in q or "auc" in q or "metric" in q or "model" in q:
        return (
            "Based on the model and method notes: attrition datasets are usually imbalanced, so raw accuracy is not the best first measure of HR usefulness. "
            f"Retainly's risk capture rate is {_pct(metrics.get('recall'))}, review efficiency is {_pct(metrics.get('precision'))}, "
            f"ranking quality is {_fmt(metrics.get('roc_auc'))}, and attrition detection quality is {_fmt(metrics.get('pr_auc'))}. "
            f"Among the top 20% highest-risk employees, Retainly captured {_pct(metrics.get('recall_at_top_20_percent'))} of observed attrition cases. "
            "Use this as supportive screening with HR judgment, not as an automated employment decision."
        )

    if "reliable" in q or "validated" in q or "proof" in q or "how was this validated" in q or "where is the proof" in q:
        return (
            "Retainly’s model workflow is validated separately in the research notebook using labeled benchmark attrition datasets. "
            "The website applies that validated workflow to current HR datasets for risk scoring and retention planning."
        )

    if "employee" in q or "person" in q or "risk" in q:
        top = sorted(employees, key=lambda r: float(r.get("risk_score") or 0), reverse=True)[:5]
        if top:
            lines = ["Based on the employee risk explorer, these are the highest-priority employees for supportive HR follow-up:"]
            for r in top:
                lines.append(f"- {r.get('employee_label') or r.get('employee_id') or ('Row '+str(r.get('row_index')))}: {round(float(r.get('risk_score') or 0)*100)}% risk, band {r.get('risk_band')}. Suggested action: {r.get('recommended_action')}")
            lines.append("Use this for stay interviews, workload review, and support planning — not punitive decisions.")
            return "\n".join(lines)
    if "fair" in q or "bias" in q:
        return (
            f"Based on the fairness review, the current fairness signal is {fairness.get('overall_risk', 'reviewed')}. "
            "Use this as a responsible-AI checkpoint: compare group-level patterns, avoid individual punitive action, and validate interventions with HR context."
        )
    if "feature" in q or "why" in q or "shap" in q or "driver" in q:
        feats = explain.get("top_features") or []
        names = ", ".join(str(f.get("feature")) for f in feats[:5] if isinstance(f, dict)) or "the strongest available workplace signals"
        return (
            f"Based on model explainability, the strongest signals are: {names}. "
            "Treat these as patterns to investigate, not proof of causation. Convert them into HR actions such as stay interviews, manager coaching, workload review, or career pathing."
        )
    if "action" in q or "recommend" in q or "next" in q:
        if plan:
            lines = ["Based on the retention action plan, HR should prioritize:"]
            for a in plan[:5]:
                lines.append(f"- {a.get('title')}: {a.get('recommended_action')} Timeline: {a.get('timeline')}. Success metric: {a.get('success_metric', 'track improvement after intervention')}.")
            return "\n".join(lines)
        return (
            "Run retention analysis to generate the action plan first. "
            "Once results are available, I can summarize the highest-priority HR actions and timelines."
        )
    if "hotspot" in q or "department" in q or "role" in q:
        if hotspots:
            lines = ["Based on hotspot analysis, attrition risk is concentrated in:"]
            for h in hotspots[:5]:
                lines.append(f"- {h.get('segment_name')} = {h.get('group')}: priority {h.get('priority')}, average risk {_fmt(h.get('average_predicted_risk'))}.")
            return "\n".join(lines)
        return (
            f"Based on the latest Retainly analysis: {exec_sum.get('rows_analyzed', 'the uploaded')} employees were analyzed, "
            f"observed attrition rate is {_pct(exec_sum.get('attrition_rate'))}, risk capture rate is {_pct(metrics.get('recall'))}, "
            f"and fairness review status is {fairness.get('overall_risk', 'reviewed')}. "
            f"Model basis: {model_label}. "
            f"Among the top 20% highest-risk employees, Retainly captured {_pct(metrics.get('recall_at_top_20_percent'))} of observed attrition cases. "
            "Start with the action plan and employee explorer for practical HR follow-up."
        )
    return (
        f"Based on the latest Retainly analysis, {exec_sum.get('rows_analyzed', 'the uploaded')} employees were reviewed. "
        "I can help with employee risk, hotspots, action planning, validation notes, and responsible-use guidance."
    )


async def groq_chat(question: str, results: dict[str, Any] | None = None) -> str:
    if not results:
        results = load_latest_results()
    groq_base_url, groq_api_key, groq_model = groq_config()
    if not groq_api_key:
        return fallback_hr_answer(question, results)
    system = build_system_prompt()
    context = build_context_snippet(results)
    messages = [
        {"role": "system", "content": system},
        {"role": "system", "content": context},
        {"role": "user", "content": question},
    ]

    url = f"{groq_base_url.rstrip('/')}/chat/completions"
    headers = {"Authorization": f"Bearer {groq_api_key}"}
    payload = {
        "model": groq_model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 500,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(url, headers=headers, json=payload)
            if r.status_code >= 400:
                return fallback_hr_answer(question, results)
            data = r.json()
            answer = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
            return answer or fallback_hr_answer(question, results)
    except Exception:
        return fallback_hr_answer(question, results)
