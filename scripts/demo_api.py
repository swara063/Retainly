"""
Website-oriented API smoke test for Retainly.

Usage:
  python scripts/demo_api.py --csv sample_data/retainly_demo_unlabeled.csv
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_API = "http://127.0.0.1:8000/api"


def http_json(url: str, method: str = "GET", body: bytes | None = None, headers: dict[str, str] | None = None):
    request = urllib.request.Request(url, data=body, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def wait_for_results(api: str, dataset_id: str, attempts: int = 10, delay: float = 1.0) -> dict:
    last_error: Exception | None = None
    for _ in range(attempts):
        try:
            return http_json(f"{api}/analysis/{dataset_id}/results")
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code != 404:
                raise
            time.sleep(delay)
    if last_error:
        raise last_error
    raise RuntimeError("Results were not available after polling.")


def post_csv(url: str, csv_path: Path) -> dict:
    boundary = "----retainlyboundary"
    content = csv_path.read_bytes()
    body = b"".join(
        [
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="file"; filename="{csv_path.name}"\r\n'.encode(),
            b"Content-Type: text/csv\r\n\r\n",
            content,
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    return http_json(
        url,
        method="POST",
        body=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default=DEFAULT_API, help="Base API URL")
    parser.add_argument("--csv", required=True, help="Path to unlabeled website demo CSV")
    args = parser.parse_args()

    api = args.api.rstrip("/")
    csv_path = Path(args.csv).expanduser().resolve()
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    started = time.time()
    print("1) Checking backend health...")
    root = http_json(api.replace("/api", "/"))
    health = http_json(f"{api}/health")
    print(f"   root={root}")
    print(f"   health={health}")

    print("2) Uploading CSV...")
    upload = post_csv(f"{api}/datasets/upload", csv_path)
    dataset_id = upload["dataset_id"]
    print(f"   upload_success=yes dataset_id={dataset_id} rows={upload.get('rows')}")

    print("3) Starting analysis...")
    http_json(f"{api}/analysis/{dataset_id}/run?async_mode=true", method="POST", body=b"")

    completed = False
    last_progress = {}
    for _ in range(120):
        last_progress = http_json(f"{api}/analysis/{dataset_id}/progress")
        state = str(last_progress.get("status", ""))
        if state == "completed":
            completed = True
            break
        if state == "failed":
            raise SystemExit(f"Analysis failed: {last_progress.get('error') or last_progress.get('current_step')}")
        time.sleep(1)

    if not completed:
        raise SystemExit("Analysis did not complete within 120 seconds.")

    print("4) Fetching results...")
    results = wait_for_results(api, dataset_id)
    employee_risk = results.get("employee_risk") or []
    action_plan = results.get("retention_plan") or results.get("action_plan") or []
    report_url = results.get("report_url") or f"/api/analysis/{dataset_id}/report"

    print("5) Checking chatbot...")
    chat = http_json(
        f"{api}/chat",
        method="POST",
        body=json.dumps({"question": "What should HR do first?", "dataset_id": dataset_id}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )

    elapsed = round(time.time() - started, 1)
    print(f"analysis_completed={'yes' if completed else 'no'}")
    print(f"elapsed_seconds={elapsed}")
    print(f"employee_risk_count={len(employee_risk)}")
    print(f"action_plan_count={len(action_plan)}")
    print(f"report_url={report_url}")
    print(f"chatbot_answer_works={'yes' if bool(chat.get('answer')) else 'no'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
