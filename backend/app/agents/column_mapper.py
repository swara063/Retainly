from app.agents.base import BaseAgent

TARGET_CANDIDATES = ["attrition", "left", "resigned", "turnover", "exit", "churn"]
SENSITIVE_CANDIDATES = ["gender", "sex", "age", "maritalstatus", "marital_status", "department", "jobrole", "job_role"]

class ColumnMapperAgent(BaseAgent):
    name = "Column Mapper Agent"

    def run(self, context: dict) -> dict:
        existing = context.get("column_mapping")
        if isinstance(existing, dict) and existing.get("target"):
            self.log("skipped", "Using user-confirmed column mapping.")
            return context
        self.log("running", "Mapping target, sensitive attributes, numeric features, and categorical features.")
        df = context["dataframe"]
        normalized = {c: c.lower().replace(" ", "").replace("_", "") for c in df.columns}
        target = None
        for col, norm in normalized.items():
            if any(candidate in norm for candidate in TARGET_CANDIDATES):
                target = col
                break
        if target is None:
            target = df.columns[-1]
            self.log("warning", f"No obvious attrition column found. Using last column as target: {target}.")

        numeric = [c for c in df.select_dtypes(include="number").columns if c != target]
        categorical = [c for c in df.columns if c not in numeric and c != target]
        sensitive = [c for c in df.columns if normalized[c] in SENSITIVE_CANDIDATES or any(s in normalized[c] for s in SENSITIVE_CANDIDATES)]
        mapping = {
            "target": target,
            "numeric_features": numeric,
            "categorical_features": categorical,
            "sensitive_attributes": sensitive,
        }
        context["column_mapping"] = mapping
        self.log("completed", f"Target mapped to '{target}'. Sensitive columns detected: {sensitive or 'none'}.")
        return context
