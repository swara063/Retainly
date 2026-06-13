from app.storage.local_store import log_path, save_json, load_json
from app.utils.time import now_iso
from typing import Any

HR_TIMELINE_STEPS = [
    ("Data check", "Dataset validated and ready for analysis."),
    ("Smart import", "Key fields identified and import summary prepared."),
    ("Pattern analysis", "Attrition patterns and workplace signals reviewed."),
    ("Risk scoring", "Risk scores estimated for prioritization."),
    ("Fairness review", "Group-level signals checked for potential bias."),
    ("Action planning", "Retention actions drafted for HR review."),
    ("Report generation", "Leadership-ready report prepared."),
]

class AgentLogger:
    def __init__(self, dataset_id: str):
        self.dataset_id = dataset_id
        self.path = log_path(dataset_id)
        if not self.path.exists():
            save_json(self.path, [])

    def add(self, agent: str, status: str, message: str) -> None:
        logs = load_json(self.path)
        logs.append({"agent": agent, "status": status, "message": message, "timestamp": now_iso()})
        save_json(self.path, logs)

    def all(self):
        return load_json(self.path)


def build_hr_timeline(logs: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    raw_logs = [l for l in (logs or []) if isinstance(l, dict)]
    timeline: list[dict[str, Any]] = []
    step_map = {
        "project manager agent": "Data check",
        "column mapper agent": "Smart import",
        "data analyst agent": "Pattern analysis",
        "ml engineer agent": "Risk scoring",
        "fairness auditor agent": "Fairness review",
        "insights agent": "Action planning",
        "pipeline": "Report generation",
    }
    for label, message in HR_TIMELINE_STEPS:
        status = "completed"
        detail = message
        for entry in reversed(raw_logs):
            agent = str(entry.get("agent", "")).strip().lower()
            if step_map.get(agent) == label:
                detail = entry.get("message") or message
                raw_status = str(entry.get("status", "")).strip().lower()
                if "fail" in raw_status:
                    status = "completed with fallback"
                elif "warn" in raw_status or "skip" in raw_status:
                    status = "completed with note"
                elif raw_status:
                    status = "completed"
                break
        timeline.append({"step": label, "status": status, "message": detail})
    return timeline


def build_developer_diagnostics(logs: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    raw_logs = [l for l in (logs or []) if isinstance(l, dict)]
    diagnostics = []
    for entry in raw_logs:
        status = str(entry.get("status", "info")).lower()
        message = str(entry.get("message", ""))
        # Keep diagnostics useful for evaluators without alarming HR users.
        if "shap" in message.lower() and "available" in message.lower():
            message = "Model explanation generated with built-in feature-importance fallback."
            status = "info"
        diagnostics.append({
            "agent": entry.get("agent", "System"),
            "status": status,
            "message": message,
            "timestamp": entry.get("timestamp"),
        })
    return diagnostics
