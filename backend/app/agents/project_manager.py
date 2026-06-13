import pandas as pd
from app.agents.base import BaseAgent

class ProjectManagerAgent(BaseAgent):
    name = "Project Manager Agent"

    def run(self, context: dict) -> dict:
        self.log("running", "Validating dataset shape, file readability, and minimum project requirements.")
        dataset_path = context["dataset_path"]
        df = pd.read_csv(dataset_path)
        if df.empty:
            raise ValueError("Dataset is empty.")
        if df.shape[0] < 30:
            self.log("warning", "Dataset has fewer than 30 rows; model metrics may be unstable.")
        if df.shape[1] < 4:
            raise ValueError("Dataset needs at least four columns for meaningful analysis.")
        context["dataframe"] = df
        context["dataset_profile"] = {"rows": int(df.shape[0]), "columns": int(df.shape[1]), "column_names": list(df.columns)}
        self.log("completed", f"Dataset validated: {df.shape[0]} rows and {df.shape[1]} columns.")
        return context
