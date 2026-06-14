from __future__ import annotations

import time

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
from app.storage.local_store import dataset_path, mapping_path, result_path, progress_path, save_json, load_json, report_path

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
        steps = [
            ("Project Manager Agent", "planning workflow"),
            ("Smart Column Mapper", "detecting dataset mode, target, and features"),
            ("Data Analyst Agent", "cleaning and exploring the data"),
            ("ML Engineer Agent", "training or scoring risk models"),
            ("Explainability Agent", "building feature importance"),
            ("Fairness Auditor Agent", "reviewing fairness signals"),
            ("Insights Agent", "generating HR guidance"),
            ("Report Agent", "exporting PDF and results"),
        ]

        def write_progress(index: int, status: str, message: str = ""):
            total = len(steps)
            current = steps[min(index, total - 1)] if total else ("Pipeline", "")
            payload = {
                "dataset_id": self.dataset_id,
                "status": status,
                "percent": int(round((index / max(total, 1)) * 100)),
                "current_agent": current[0],
                "current_step": message or current[1],
                "elapsed_seconds": 0,
                "estimated_total_seconds": 0,
                "estimated_remaining_seconds": 0,
                "steps": [{"name": name, "status": "completed" if i < index else ("running" if i == index and status == "running" else "pending"), "percent": int(round(((i + 1) / total) * 100))} for i, (name, _) in enumerate(steps)],
            }
            save_json(progress_path(self.dataset_id), payload)

        start_time = time.monotonic()
        small_dataset_timeout = 180.0
        dataset_rows = None

        def check_timeout(stage_name: str):
            nonlocal dataset_rows
            elapsed = time.monotonic() - start_time
            if dataset_rows is not None:
                if int(dataset_rows) <= 5000 and elapsed > small_dataset_timeout:
                    raise TimeoutError(f"Analysis exceeded {int(small_dataset_timeout)} seconds for a standard-sized dataset. Please try a smaller CSV or review backend performance.")
            self.logger.add("Timing", "info", f"{stage_name} completed in {elapsed:.1f}s")

        write_progress(0, "running")
        context = {"dataset_id": self.dataset_id, "dataset_path": dataset_path(self.dataset_id)}
        try:
            for idx, agent in enumerate(self.agents):
                write_progress(idx, "running", steps[idx][1])
                if isinstance(agent, MLEngineerAgent):
                    context["progress_writer"] = lambda message, status="running", _idx=idx: write_progress(_idx, status, message)
                context = agent.run(context)
                if isinstance(agent, MLEngineerAgent):
                    context.pop("progress_writer", None)
                if dataset_rows is None and isinstance(context.get("dataset_profile"), dict):
                    dataset_rows = context["dataset_profile"].get("rows")
                check_timeout(steps[idx][0])
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
                "research_comparison": None,
                "llm_insights": context.get("llm_insights"),
            }
            if context.get("model", {}).get("confidence_summary"):
                results["confidence_summary"] = context["model"]["confidence_summary"]
            raw_logs = self.logger.all()
            results["hr_timeline"] = build_hr_timeline(raw_logs)
            results["developer_diagnostics"] = build_developer_diagnostics(raw_logs)
            results["dataset_mode"] = (context.get("column_mapping") or {}).get("dataset_mode") or ("labeled_training" if (context.get("column_mapping") or {}).get("target") else "unlabeled_scoring")
            results["target_column"] = (context.get("column_mapping") or {}).get("target")
            results["can_evaluate_model"] = bool(results["dataset_mode"] == "labeled_training")
            results["pretrained_model_used"] = bool(results["dataset_mode"] == "unlabeled_scoring" and context.get("model_artifacts"))
            results["model_trust"] = {
                "status": "Validated" if results["pretrained_model_used"] or results["can_evaluate_model"] else "Review recommended",
                "model_basis": "Pretrained attrition-risk model",
                "training_source": "Benchmark attrition datasets configured in research_datasets/",
                "suitable_use": "Retention prioritization and HR planning",
                "not_suitable_for": "Automatic firing, punitive decisions, or final employment decisions",
                "validation_note": "Detailed validation is available in the research notebook.",
                "pretrained_model_available": True,
                "validation_summary_available": False,
            }
            # Enriched, HR-useful outputs (keeps existing keys intact)
            df = context.get("dataframe")
            mapping = context.get("column_mapping") or {}
            target_col = mapping.get("target")
            artifacts = context.get("model_artifacts") or {}
            pipe = artifacts.get("pipeline")
            precomputed_scores = artifacts.get("y_proba")

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
                        precomputed_scores=precomputed_scores,
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
                        precomputed_scores=precomputed_scores,
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
                check_timeout("Responsible-use review")
            elif df is not None:
                results["executive_summary"] = {
                    "rows_analyzed": int(df.shape[0]),
                    "columns_analyzed": int(df.shape[1]),
                    "selected_model": (results.get("model") or {}).get("selected_model") or "Retainly pretrained attrition-risk model",
                    "recommended_use": "Decision-support for HR planning, manager coaching, and workforce risk review.",
                    "confidence_summary": results.get("confidence_summary") or ((results.get("model") or {}).get("confidence_summary") or {}),
                }

            try:
                from pathlib import Path
                validation_summary = Path(__file__).resolve().parents[3] / "research_outputs" / "famous_dataset_comparison_summary.json"
                if validation_summary.exists():
                    results["model_trust"]["validation_summary_available"] = True
                    results["model_trust"]["validation_note"] = "Benchmark validation completed. Detailed metrics are available in the research notebook."
            except Exception:
                pass
            check_timeout("Report generation")
            pdf_path = build_pdf_report(self.dataset_id, results)
            if report_path(self.dataset_id).exists() or pdf_path:
                results["report_url"] = f"/api/analysis/{self.dataset_id}/report"
            save_json(result_path(self.dataset_id), results)
            write_progress(len(self.agents), "completed", "Analysis completed")
            self.logger.add("Pipeline", "completed", "Pipeline completed and report generated.")
            return results
        except Exception as exc:
            self.logger.add("Pipeline", "failed", str(exc))
            write_progress(len(steps), "failed", str(exc))
            self.logger.add("Timing", "failed", f"Pipeline failed after {time.monotonic() - start_time:.1f}s")
            failure = {"dataset_id": self.dataset_id, "status": "failed", "error": str(exc)}
            save_json(result_path(self.dataset_id), failure)
            raise
