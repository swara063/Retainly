import uuid
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from app.models.schemas import UploadResponse, RunAnalysisResponse
from app.models.chat_schemas import ChatRequest, ChatResponse
from app.storage.local_store import dataset_path, mapping_path, metadata_path, result_path, log_path, report_path, progress_path, save_json, load_json
from app.services.result_enrichment import detect_employee_identity_columns
from app.services.logging_service import build_developer_diagnostics, build_hr_timeline
from app.services.pipeline import AttritionPipeline
from app.services.chat_service import groq_chat, ChatConfigError, build_source_notes, load_latest_results
from app.services.mapping_service import build_preview_payload
from app.core.config import settings

router = APIRouter()

@router.post("/datasets/upload", response_model=UploadResponse)
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")
    content = await file.read()
    max_bytes = int(settings.MAX_UPLOAD_MB) * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File is too large. Maximum upload size is {settings.MAX_UPLOAD_MB} MB.")
    dataset_id = uuid.uuid4().hex[:12]
    path = dataset_path(dataset_id)
    path.write_bytes(content)
    try:
        df = pd.read_csv(path)
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {exc}")
    if df.shape[0] < 30:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Please upload at least 30 employee rows so the analysis can find meaningful patterns.")
    if df.shape[1] < 4:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Please upload a richer HR CSV with at least 4 columns, including an attrition/left/stayed outcome field.")
    metadata = {"dataset_id": dataset_id, "original_filename": file.filename, "columns": list(df.columns), "rows": int(df.shape[0]), "status": "uploaded"}
    save_json(metadata_path(dataset_id), metadata)
    return UploadResponse(dataset_id=dataset_id, columns=list(df.columns), rows=int(df.shape[0]), status="uploaded")


def run_pipeline_task(dataset_id: str):
    AttritionPipeline(dataset_id).run()

@router.post("/analysis/{dataset_id}/run", response_model=RunAnalysisResponse)
def run_analysis(dataset_id: str, background_tasks: BackgroundTasks, async_mode: bool = False):
    if not dataset_path(dataset_id).exists():
        raise HTTPException(status_code=404, detail="Dataset not found.")
    if async_mode:
        background_tasks.add_task(run_pipeline_task, dataset_id)
        return RunAnalysisResponse(dataset_id=dataset_id, status="running", message="Analysis started in background.")
    AttritionPipeline(dataset_id).run()
    return RunAnalysisResponse(dataset_id=dataset_id, status="completed", message="Analysis completed.")

@router.get("/analysis/{dataset_id}/results")
def get_results(dataset_id: str):
    path = result_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Results not found. Run analysis first.")
    return load_json(path)


@router.get("/analysis/{dataset_id}/progress")
def get_progress(dataset_id: str):
    path = progress_path(dataset_id)
    if not path.exists():
        return {
            "dataset_id": dataset_id,
            "status": "queued",
            "percent": 0,
            "current_agent": "Project Manager Agent",
            "current_step": "waiting",
            "elapsed_seconds": 0,
            "estimated_total_seconds": 0,
            "estimated_remaining_seconds": 0,
            "steps": [],
        }
    return load_json(path)


def _load_employee_records(dataset_id: str) -> tuple[list[dict], dict]:
    path = result_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Results not found. Run analysis first.")
    data = load_json(path)
    records = data.get("employee_risk_records") or []
    if not isinstance(records, list):
        records = []
    return records, data


def _normalize(text: str | None) -> str:
    return str(text or "").strip().lower()


def _build_available_filters(records: list[dict], limit_labels: int = 150) -> dict:
    departments = sorted({str(r.get("department")) for r in records if r.get("department") not in [None, "None", ""]})
    job_roles = sorted({str(r.get("job_role")) for r in records if r.get("job_role") not in [None, "None", ""]})
    risk_bands = sorted({str(r.get("risk_band")) for r in records if r.get("risk_band")})
    labels = []
    seen = set()
    for r in records:
        label = str(r.get("display_label") or r.get("employee_name") or r.get("employee_id") or r.get("row_index") or "")
        if label and label not in seen:
            labels.append(label)
            seen.add(label)
        if len(labels) >= limit_labels:
            break
    return {"departments": departments, "job_roles": job_roles, "risk_bands": risk_bands, "employee_labels": labels}


def _filter_employee_records(records: list[dict], *, search: str | None, department: str | None, job_role: str | None, risk_band: str | None) -> list[dict]:
    dept = _normalize(department)
    role = _normalize(job_role)
    band = _normalize(risk_band)
    query = _normalize(search)

    def match(record: dict) -> bool:
        if dept and _normalize(record.get("department")) != dept:
            return False
        if role and _normalize(record.get("job_role")) != role:
            return False
        if band and _normalize(record.get("risk_band")) != band:
            return False
        if query:
            hay = " ".join(
                _normalize(record.get(field))
                for field in ["employee_id", "employee_name", "display_label", "department", "job_role"]
            )
            if query not in hay:
                return False
        return True

    return [r for r in records if match(r)]


@router.get("/analysis/{dataset_id}/employees")
def list_employees(
    dataset_id: str,
    search: str | None = None,
    department: str | None = None,
    job_role: str | None = None,
    risk_band: str | None = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = "risk_desc",
):
    records, results = _load_employee_records(dataset_id)
    filtered = _filter_employee_records(records, search=search, department=department, job_role=job_role, risk_band=risk_band)
    reverse = sort != "risk_asc"
    filtered.sort(key=lambda r: (float(r.get("risk_score") or 0), int(r.get("row_index") or 0)), reverse=reverse)
    total = len(filtered)
    records_page = filtered[max(offset, 0): max(offset, 0) + max(limit, 1)]
    available_filters = _build_available_filters(records)
    if not available_filters["risk_bands"]:
        available_filters["risk_bands"] = ["Low", "Medium", "High", "Critical"]
    return {
        "total": total,
        "records": records_page,
        "available_filters": available_filters,
        "warnings": results.get("warnings") or [],
    }


@router.get("/analysis/{dataset_id}/employees/{row_index}")
def get_employee_detail(dataset_id: str, row_index: int):
    records, results = _load_employee_records(dataset_id)
    match = next((r for r in records if int(r.get("row_index")) == int(row_index)), None)
    if not match:
        raise HTTPException(status_code=404, detail="Employee not found.")
    segment_hint = None
    risk_segments = results.get("risk_segments") or []
    if isinstance(risk_segments, list):
        dept = match.get("department")
        role = match.get("job_role")
        candidates = [s for s in risk_segments if isinstance(s, dict) and ((dept and s.get("segment_name") == "Department" and str(s.get("group")) == str(dept)) or (role and s.get("segment_name") == "JobRole" and str(s.get("group")) == str(role)))]
        if candidates:
            pick = sorted(candidates, key=lambda s: float(s.get("average_predicted_risk") or 0), reverse=True)[0]
            segment_hint = f"Employees in {pick.get('segment_name')} = {pick.get('group')} show average risk of {round(float(pick.get('average_predicted_risk') or 0) * 100)}%."
    confidence = results.get("confidence_summary") or ((results.get("model") or {}).get("confidence_summary") or {})
    return {
        "employee": match,
        "similar_segment_insight": segment_hint or "This employee should be interpreted alongside similar peers and manager context.",
        "recommended_support_action": match.get("recommended_support_action"),
        "manager_hr_talking_points": [
            "Use a supportive, non-punitive conversation.",
            "Ask what would reduce friction and improve retention.",
            *([f"Focus on the pattern: {', '.join(match.get('top_risk_factors') or [])}."] if match.get("top_risk_factors") else []),
        ],
        "ethical_note": match.get("ethical_note"),
        "model_confidence_summary": confidence,
        "available_filters": _build_available_filters(records),
    }

@router.get("/analysis/{dataset_id}/logs")
def get_logs(dataset_id: str):
    path = log_path(dataset_id)
    if not path.exists():
        return {"hr_timeline": [], "developer_diagnostics": []}
    raw = load_json(path)
    if not isinstance(raw, list):
        raw = []
    return {"hr_timeline": build_hr_timeline(raw), "developer_diagnostics": build_developer_diagnostics(raw)}

@router.get("/analysis/{dataset_id}/report")
def download_report(dataset_id: str):
    path = report_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report not found. Run analysis first.")
    return FileResponse(path, media_type="application/pdf", filename=f"attrition_report_{dataset_id}.pdf")

@router.get("/analysis/{dataset_id}/results.json")
def download_results_json(dataset_id: str):
    path = result_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Results not found. Run analysis first.")
    return FileResponse(path, media_type="application/json", filename=f"retainly_results_{dataset_id}.json")

@router.get("/datasets/{dataset_id}/download")
def download_dataset(dataset_id: str):
    path = dataset_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found.")
    name = "dataset.csv"
    try:
        meta = load_json(metadata_path(dataset_id))
        original = meta.get("original_filename")
        if isinstance(original, str) and original.lower().endswith(".csv"):
            name = original
    except Exception:
        pass
    return FileResponse(path, media_type="text/csv", filename=name)

@router.get("/datasets/{dataset_id}/metadata")
def get_metadata(dataset_id: str):
    path = metadata_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dataset metadata not found.")
    return load_json(path)

@router.get("/datasets/{dataset_id}/preview")
def preview_dataset(dataset_id: str):
    path = dataset_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found.")
    try:
        df = pd.read_csv(path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {exc}")
    return build_preview_payload(df)


@router.post("/datasets/{dataset_id}/mapping")
def save_dataset_mapping(dataset_id: str, payload: dict):
    path = dataset_path(dataset_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found.")
    required = ["target", "sensitive_attributes", "numeric_features", "categorical_features"]
    for k in required:
        if k not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {k}")
    save_json(mapping_path(dataset_id), payload)
    return {"dataset_id": dataset_id, "status": "saved"}


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    results = None
    if req.dataset_id:
        rp = result_path(req.dataset_id)
        if rp.exists():
            try:
                results = load_json(rp)
            except Exception:
                results = None
    if results is None:
        results = load_latest_results()
    try:
        answer = await groq_chat(req.question, results=results)
        return ChatResponse(answer=answer, sources=build_source_notes(results))
    except ChatConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Chat provider error: {exc}")
