import os
from typing import Any

import httpx

from app.agents.base import BaseAgent


def _compact_for_llm(context: dict) -> dict[str, Any]:
    model = context.get("model") or {}
    metrics = model.get("metrics") or {}
    fairness = context.get("fairness") or {}
    explainability = context.get("explainability") or {}
    eda = context.get("eda") or {}
    return {
        "selected_model": model.get("selected_model"),
        "hr_friendly_metrics": {
            "risk_capture_rate": metrics.get("recall"),
            "review_efficiency": metrics.get("precision"),
            "ranking_quality": metrics.get("roc_auc"),
            "attrition_detection_quality": metrics.get("pr_auc"),
            "top_10_percent_risk_capture": metrics.get("recall_at_top_10_percent"),
            "top_20_percent_risk_capture": metrics.get("recall_at_top_20_percent"),
            "attrition_rate_in_top_10_percent": metrics.get("attrition_rate_in_top_10_percent"),
            "attrition_rate_in_top_20_percent": metrics.get("attrition_rate_in_top_20_percent"),
        },
        "technical_metrics_for_method_notes_only": {k: metrics.get(k) for k in ["accuracy", "precision", "recall", "f1", "roc_auc", "pr_auc"]},
        "target_distribution": eda.get("target_distribution"),
        "top_features": (explainability.get("top_features") or [])[:6],
        "fairness_risk": fairness.get("overall_risk"),
        "fairness_summary": fairness.get("summary") or fairness.get("ethical_disclaimer"),
        "research_comparison": (model.get("research_comparison") or {}).get("metric_deltas"),
    }


def _generate_llm_hr_brief(context: dict) -> dict[str, Any]:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        return {"enabled": False, "provider": "Groq", "status": "not_configured", "summary": ""}
    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    messages = [
        {
            "role": "system",
            "content": (
                "You are Retainly's HR analytics narrative agent. Convert structured attrition-analysis results "
                "into a short executive brief. Do not invent numbers. Do not recommend punitive employment decisions. "
                "Keep it practical: risk pattern, what HR should do next, fairness caution, and how to defend the method. "
                "Do not lead with raw ML metrics such as accuracy, precision, F1, ROC-AUC, or PR-AUC. "
                "Use HR-friendly terms: risk capture rate, review efficiency, ranking quality, attrition detection quality. "
                "If technical metrics look weak, explain that attrition data is imbalanced and Retainly is tuned for supportive risk screening. "
                "Prefer top-risk evaluation, especially what was captured in the top 10% or top 20% highest-risk employees."
            ),
        },
        {"role": "user", "content": str(_compact_for_llm(context))},
    ]
    try:
        with httpx.Client(timeout=25) as client:
            res = client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": model, "messages": messages, "temperature": 0.2, "max_tokens": 450},
            )
        if res.status_code >= 400:
            return {"enabled": True, "provider": "Groq", "model": model, "status": "provider_error", "summary": ""}
        data = res.json()
        summary = (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()
        return {"enabled": True, "provider": "Groq", "model": model, "status": "completed", "summary": summary}
    except Exception as exc:
        return {"enabled": True, "provider": "Groq", "model": model, "status": "failed", "error": str(exc), "summary": ""}

class InsightsAgent(BaseAgent):
    name = "Insights Agent"

    def _metric_sentence(self, metrics: dict) -> list[str]:
        f1 = float(metrics.get("f1") or 0.0)
        precision = float(metrics.get("precision") or 0.0)
        recall = float(metrics.get("recall") or 0.0)
        accuracy = float(metrics.get("accuracy") or 0.0)
        roc_auc = metrics.get("roc_auc")
        top20 = metrics.get("recall_at_top_20_percent")
        s = [
            f"Risk screening summary: risk capture rate {recall:.3f}, review efficiency {precision:.3f}, and F1 balance {f1:.3f}."
        ]
        if top20 is not None:
            try:
                s.append(f"Top-risk review: the top 20% highest-risk employees captured {float(top20):.3f} of observed attrition cases.")
            except Exception:
                pass
        if roc_auc is not None:
            try:
                s.append(f"Ranking quality: {float(roc_auc):.3f}.")
            except Exception:
                pass
        if recall >= 0.70 and precision < 0.40:
            s.append("Interpretation: the model catches many at-risk employees but will flag some as a precaution. Use as a prioritization list, not a decision.")
        elif recall < 0.55:
            s.append("Interpretation: use this as directional screening and combine it with HR judgment before relying on early interventions.")
        else:
            s.append("Interpretation: treat risk scores as decision-support signals and validate against HR reality before acting.")
        return s

    def run(self, context: dict) -> dict:
        self.log("running", "Generating management-ready insights and recommended interventions.")
        insights: list[str] = []
        recs: list[str] = []
        model = context["model"]
        top_features = context["explainability"].get("top_features", [])
        if top_features:
            top = top_features[0]["feature"]
            insights.append(f"Key driver (most predictive feature): {top}.")
            recs.append(f"Action: investigate what is driving changes in {top} and whether HR policy/process improvements can address it.")
        metrics = model["metrics"]
        insights.append(f"Selected model: {model['selected_model']}.")
        insights.extend(self._metric_sentence(metrics))
        if float(metrics.get("recall") or 0.0) < 0.70:
            recs.append("Action: treat risk scores as directional screening, validate with HR context, and improve data quality/features over time.")
        else:
            recs.append("Action: use risk flags to prioritize retention conversations and check-ins; avoid automated decisions.")
        fairness = context.get("fairness", {})
        if fairness.get("overall_risk") in ["Moderate", "High"]:
            insights.append(f"Fairness audit: {fairness['overall_risk']} risk detected (group-level gaps present).")
            recs.append("Action: review group-wise error rates, validate data quality for sensitive attributes, and include fairness safeguards in any downstream process.")
        else:
            insights.append("No severe group-level bias was detected in the available audit attributes.")
        eda = context.get("eda", {})
        target_dist = eda.get("target_distribution", {})
        if target_dist:
            insights.append(f"Attrition distribution in your data: {target_dist}.")
        recs.append("Action: combine model signals with manager context, workload, compensation bands, and engagement feedback; measure outcomes of interventions.")
        recs.append("Action: set up a monthly monitoring loop (drift + fairness + performance) so the model stays trustworthy over time.")
        llm_brief = _generate_llm_hr_brief(context)
        context["llm_insights"] = llm_brief
        if llm_brief.get("summary"):
            insights.append(f"LLM HR narrative: {llm_brief['summary']}")
        elif llm_brief.get("status") == "not_configured":
            insights.append("LLM HR narrative not generated because GROQ_API_KEY is not configured.")
        context["insights"] = insights
        context["recommendations"] = recs
        self.log("completed", "Insight generation completed.")
        return context
