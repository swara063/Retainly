import pandas as pd
from app.agents.base import BaseAgent

class FairnessAuditorAgent(BaseAgent):
    name = "Fairness Auditor Agent"

    def _risk_level(self, gap: float) -> str:
        if gap < 0.10:
            return "Low"
        if gap < 0.20:
            return "Moderate"
        return "High"

    def run(self, context: dict) -> dict:
        self.log("running", "Evaluating prediction-rate and error-rate differences across available group attributes.")
        artifacts = context["model_artifacts"]
        X_test = artifacts["X_test"].copy()
        y_pred = pd.Series(artifacts["y_pred"], index=X_test.index)
        raw_y_test = artifacts.get("y_test") or []
        has_labeled_outcomes = len(raw_y_test) == len(X_test.index) and len(X_test.index) > 0
        y_test = pd.Series(raw_y_test, index=X_test.index) if has_labeled_outcomes else None
        sensitive = [c for c in context["column_mapping"].get("sensitive_attributes", []) if c in X_test.columns]
        audits = {}
        for col in sensitive:
            group_df = pd.DataFrame({"group": X_test[col].astype(str), "predicted": y_pred})
            if y_test is not None:
                group_df["actual"] = y_test
            rows = []
            for group, part in group_df.groupby("group"):
                if len(part) < 3:
                    continue
                prediction_rate = float(part["predicted"].mean())
                false_positive_rate = None
                false_negative_rate = None
                if y_test is not None:
                    false_positive_rate = float(((part["predicted"] == 1) & (part["actual"] == 0)).sum() / max((part["actual"] == 0).sum(), 1))
                    false_negative_rate = float(((part["predicted"] == 0) & (part["actual"] == 1)).sum() / max((part["actual"] == 1).sum(), 1))
                rows.append({
                    "group": group,
                    "count": int(len(part)),
                    "prediction_rate": prediction_rate,
                    "false_positive_rate": false_positive_rate,
                    "false_negative_rate": false_negative_rate,
                })
            if rows:
                pred_gap = max(r["prediction_rate"] for r in rows) - min(r["prediction_rate"] for r in rows)
                fp_values = [r["false_positive_rate"] for r in rows if r["false_positive_rate"] is not None]
                fp_gap = (max(fp_values) - min(fp_values)) if fp_values else 0.0
                audits[col] = {"groups": rows, "prediction_rate_gap": pred_gap, "false_positive_rate_gap": fp_gap, "risk_level": self._risk_level(max(pred_gap, fp_gap))}
        context["fairness"] = {
            "audited_attributes": list(audits.keys()),
            "attribute_audits": audits,
            "overall_risk": max([a["risk_level"] for a in audits.values()], key=["Low", "Moderate", "High"].index) if audits else "Not Available",
            "ethical_disclaimer": "This tool provides analytical insights and should not be used as the sole basis for HR decisions.",
            "audit_mode": "group_prediction_review" if y_test is None else "group_prediction_and_error_review",
        }
        self.log("completed", f"Fairness audit completed for {len(audits)} attribute(s).")
        return context
