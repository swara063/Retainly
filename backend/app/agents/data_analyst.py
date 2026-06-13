import numpy as np
from app.agents.base import BaseAgent

class DataAnalystAgent(BaseAgent):
    name = "Data Analyst Agent"

    def run(self, context: dict) -> dict:
        self.log("running", "Generating EDA summary, missing-value profile, distributions, and correlations.")
        df = context["dataframe"].copy()
        mapping = context["column_mapping"]
        target = mapping.get("target")
        missing = df.isna().sum().sort_values(ascending=False).to_dict()
        missing_pct = (df.isna().mean() * 100).round(2).sort_values(ascending=False).to_dict()
        numeric_cols = mapping["numeric_features"]
        categorical_cols = mapping["categorical_features"]
        describe = df[numeric_cols].describe().round(3).to_dict() if numeric_cols else {}
        categorical_summary = {c: df[c].astype(str).value_counts(dropna=False).head(10).to_dict() for c in categorical_cols[:12]}
        correlation = {}
        if len(numeric_cols) >= 2:
            correlation = df[numeric_cols].corr(numeric_only=True).round(3).replace({np.nan: None}).to_dict()
        target_distribution = df[target].astype(str).value_counts(dropna=False).to_dict() if target and target in df.columns else {}
        context["eda"] = {
            "missing_values": missing,
            "missing_percentage": missing_pct,
            "numeric_summary": describe,
            "categorical_summary": categorical_summary,
            "correlation_matrix": correlation,
            "target_distribution": target_distribution,
        }
        self.log("completed", "EDA completed with missing-value, correlation, and distribution summaries.")
        return context
