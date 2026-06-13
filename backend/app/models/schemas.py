from pydantic import BaseModel
from typing import Any

class UploadResponse(BaseModel):
    dataset_id: str
    columns: list[str]
    rows: int
    status: str

class RunAnalysisResponse(BaseModel):
    dataset_id: str
    status: str
    message: str

class AgentLog(BaseModel):
    agent: str
    status: str
    message: str
    timestamp: str

class AnalysisResults(BaseModel):
    dataset_id: str
    status: str
    column_mapping: dict[str, Any]
    eda: dict[str, Any]
    model: dict[str, Any]
    explainability: dict[str, Any]
    fairness: dict[str, Any]
    insights: list[str]
    recommendations: list[str]
    executive_summary: dict[str, Any] | None = None
    employee_risk: list[dict[str, Any]] | None = None
    employee_risk_records: list[dict[str, Any]] | None = None
    risk_segments: list[dict[str, Any]] | None = None
    retention_plan: list[dict[str, Any]] | None = None
    data_quality: dict[str, Any] | None = None
    research_comparison: dict[str, Any] | None = None
    llm_insights: dict[str, Any] | None = None
    hr_timeline: list[dict[str, Any]] | None = None
    developer_diagnostics: list[dict[str, Any]] | None = None
    confidence_summary: dict[str, Any] | None = None
