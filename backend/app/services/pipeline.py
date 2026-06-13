from app.agents.project_manager import ProjectManagerAgent
from app.agents.column_mapper import ColumnMapperAgent
from app.agents.data_analyst import DataAnalystAgent
from app.agents.ml_engineer import MLEngineerAgent
from app.agents.fairness_auditor import FairnessAuditorAgent
from app.agents.insights_agent import InsightsAgent
from app.services.logging_service import AgentLogger
from app.services.logging_service import build_developer_diagnostics, build_hr_timeline
from app.services.report_service import build_pdf_report
from app.services.result_enrichment import (
    build_data_quality,
    build_employee_risk,
    build_employee_risk_records,
    build_executive_summary,
    build_retention_plan,
    build_risk_segments,
)
from app.storage.local_store import dataset_path, mapping_path, result_path, save_json, load_json

class AttritionPipeline:
    def __init__(self, dataset_id: str):
        self.dataset_id = dataset_id
        self.logger = AgentLogger(dataset_id)
        self.user_mapping = None
        try:
            mp = mapping_path(dataset_id)
            if mp.exists():
                self.user_mapping = load_json(mp)
        except Exception as exc:
            self.logger.add("Dataset Mapping", "warning", f"Could not load saved mapping: {exc}")

        self.agents = [
            ProjectManagerAgent(self.logger),
            ColumnMapperAgent(self.logger),
            DataAnalystAgent(self.logger),
            MLEngineerAgent(self.logger),
            FairnessAuditorAgent(self.logger),
            InsightsAgent(self.logger),
        ]

    def run(self) -> dict:
        self.logger.add("Pipeline", "started", "End-to-end analysis pipeline started.")
        context = {"dataset_id": self.dataset_id, "dataset_path": dataset_path(self.dataset_id)}
        try:
            for agent in self.agents:
                context = agent.run(context)
                if isinstance(agent, ProjectManagerAgent) and self.user_mapping:
                    # Inject user-confirmed mapping right after dataframe is loaded.
                    context["column_mapping"] = self.user_mapping
                    self.logger.add("Dataset Mapping", "confirmed", "Using user-confirmed dataset mapping.")
            results: dict = {
                "dataset_id": self.dataset_id,
                "status": "completed",
                "dataset_profile": context.get("dataset_profile"),
                "column_mapping": context.get("column_mapping"),
                "eda": context.get("eda"),
                "model": context.get("model"),
                "explainability": context.get("explainability"),
                "fairness": context.get("fairness"),
                "insights": context.get("insights"),
                "recommendations": context.get("recommendations"),
                "research_comparison": context.get("research_comparison") or (context.get("model") or {}).get("research_comparison"),
                "llm_insights": context.get("llm_insights"),
            }
            if context.get("model", {}).get("confidence_summary"):
                results["confidence_summary"] = context["model"]["confidence_summary"]
            raw_logs = self.logger.all()
            results["hr_timeline"] = build_hr_timeline(raw_logs)
            results["developer_diagnostics"] = build_developer_diagnostics(raw_logs)

            # Enriched, HR-useful outputs (keeps existing keys intact)
            df = context.get("dataframe")
            mapping = context.get("column_mapping") or {}
            target_col = mapping.get("target")
            artifacts = context.get("model_artifacts") or {}
            pipe = artifacts.get("pipeline")

            if df is not None and pipe is not None:
                try:
                    exec_summary = build_executive_summary(df=df, target_col=target_col, results=results)
                    results["executive_summary"] = exec_summary
                except Exception as exc:
                    self.logger.add("ExecutiveSummary", "failed", str(exc))
                    results["executive_summary"] = {"error": str(exc)}

                try:
                    employee_risk = build_employee_risk(
                        df=df,
                        target_col=target_col,
                        pipeline=pipe,
                        top_features=((results.get("explainability") or {}).get("top_features") or []),
                    )
                    results["employee_risk"] = employee_risk
                except Exception as exc:
                    self.logger.add("EmployeeRisk", "failed", str(exc))
                    results["employee_risk"] = []

                try:
                    confidence_label = ((results.get("confidence_summary") or {}).get("label") or (results.get("model") or {}).get("confidence_summary", {}).get("label"))
                    employee_records, identifier_warnings = build_employee_risk_records(
                        df=df,
                        target_col=target_col,
                        pipeline=pipe,
                        top_features=((results.get("explainability") or {}).get("top_features") or []),
                        model_confidence_label=confidence_label,
                    )
                    results["employee_risk_records"] = employee_records
                    if identifier_warnings:
                        results.setdefault("warnings", [])
                        results["warnings"].extend(identifier_warnings)
                except Exception as exc:
                    self.logger.add("EmployeeRiskRecords", "failed", str(exc))
                    results["employee_risk_records"] = []

                try:
                    import pandas as pd

                    risk_scores = pd.Series([r.get("risk_score", 0.0) for r in results.get("employee_risk", [])])
                    segs = build_risk_segments(df=df, target_col=target_col, risk_scores=risk_scores)
                    results["risk_segments"] = segs
                except Exception as exc:
                    self.logger.add("RiskSegments", "failed", str(exc))
                    results["risk_segments"] = []

                try:
                    fairness_risk = (results.get("fairness") or {}).get("overall_risk")
                    plan = build_retention_plan(
                        top_drivers=((results.get("explainability") or {}).get("top_features") or []),
                        risk_segments=results.get("risk_segments") or [],
                        fairness_risk=fairness_risk,
                    )
                    results["retention_plan"] = plan
                except Exception as exc:
                    self.logger.add("RetentionPlan", "failed", str(exc))
                    results["retention_plan"] = []

                try:
                    dq = build_data_quality(df=df, target_col=target_col)
                    results["data_quality"] = dq
                except Exception as exc:
                    self.logger.add("DataQuality", "failed", str(exc))
                    results["data_quality"] = {"error": str(exc)}
            elif df is not None:
                results["executive_summary"] = {
                    "rows_analyzed": int(df.shape[0]),
                    "columns_analyzed": int(df.shape[1]),
                    "selected_model": (results.get("model") or {}).get("selected_model"),
                    "recommended_use": "Decision-support for HR planning, manager coaching, and workforce risk review.",
                    "confidence_summary": results.get("confidence_summary") or ((results.get("model") or {}).get("confidence_summary") or {}),
                }

            save_json(result_path(self.dataset_id), results)
            build_pdf_report(self.dataset_id, results)
            self.logger.add("Pipeline", "completed", "Pipeline completed and report generated.")
            return results
        except Exception as exc:
            self.logger.add("Pipeline", "failed", str(exc))
            failure = {"dataset_id": self.dataset_id, "status": "failed", "error": str(exc)}
            save_json(result_path(self.dataset_id), failure)
            raise
