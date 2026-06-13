from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


ROOT = Path(__file__).resolve().parents[2]
SAMPLE_CSV = ROOT / "sample_data" / "sample_hr_attrition.csv"


def _upload_sample(client: TestClient) -> str:
    with SAMPLE_CSV.open("rb") as fh:
        response = client.post(
            "/api/datasets/upload",
            files={"file": ("sample_hr_attrition.csv", fh, "text/csv")},
        )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["dataset_id"]
    assert data["rows"] >= 30
    return data["dataset_id"]


def test_invalid_upload_rejected():
    client = TestClient(app)
    response = client.post(
        "/api/datasets/upload",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 400
    assert "Only CSV" in response.json()["detail"]


def test_analysis_run_produces_required_outputs_and_report():
    client = TestClient(app)
    dataset_id = _upload_sample(client)

    run = client.post(f"/api/analysis/{dataset_id}/run")
    assert run.status_code == 200, run.text
    assert run.json()["status"] == "completed"

    results = client.get(f"/api/analysis/{dataset_id}/results")
    assert results.status_code == 200, results.text
    payload = results.json()

    assert payload["status"] == "completed"
    assert payload.get("executive_summary")
    assert payload.get("model", {}).get("metrics")
    assert payload.get("fairness")
    assert payload.get("retention_plan")
    assert payload.get("employee_risk_records")
    assert payload.get("research_comparison")
    assert payload["research_comparison"].get("baseline")
    assert payload["research_comparison"].get("retainly_multi_agent")

    logs = client.get(f"/api/analysis/{dataset_id}/logs")
    assert logs.status_code == 200
    log_payload = logs.json()
    assert isinstance(log_payload.get("hr_timeline"), list)
    assert isinstance(log_payload.get("developer_diagnostics"), list)

    report = client.get(f"/api/analysis/{dataset_id}/report")
    assert report.status_code == 200
    assert report.headers["content-type"].startswith("application/pdf")
