"""
End-to-end API demo for the Attrition Intelligence Platform.

Usage:
  python scripts/demo_api.py --csv sample_data/sample_hr_attrition.csv

Prereqs:
  - Backend running at http://localhost:8000
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.request
from pathlib import Path


API = "http://localhost:8000/api"


def http_json(url: str, method: str = "GET", body: bytes | None = None, headers: dict[str, str] | None = None):
    req = urllib.request.Request(url, data=body, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        return json.loads(data.decode("utf-8"))


def post_multipart_csv(url: str, csv_path: Path):
    boundary = "----retainlyboundary"
    content = csv_path.read_bytes()
    filename = csv_path.name
    parts: list[bytes] = []
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(
        (
            f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
            f"Content-Type: text/csv\r\n\r\n"
        ).encode()
    )
    parts.append(content)
    parts.append(b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    return http_json(
        url,
        method="POST",
        body=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default=API, help="Base API URL (default: http://localhost:8000/api)")
    ap.add_argument("--csv", required=True, help="Path to HR CSV")
    ap.add_argument("--async", dest="async_mode", action="store_true", help="Run analysis in background")
    args = ap.parse_args()

    base = args.api.rstrip("/")
    csv_path = Path(args.csv).expanduser().resolve()
    if not csv_path.exists():
        raise SystemExit(f"CSV not found: {csv_path}")

    print("1) Uploading dataset…")
    upload = post_multipart_csv(f"{base}/datasets/upload", csv_path)
    dataset_id = upload["dataset_id"]
    print(f"   dataset_id={dataset_id} rows={upload.get('rows')} cols={len(upload.get('columns', []))}")

    print("2) Running analysis…")
    run_url = f"{base}/analysis/{dataset_id}/run"
    if args.async_mode:
        run = http_json(f"{run_url}?async_mode=true", method="POST", body=b"")
        print(f"   status={run.get('status')} (background)")
        print("   polling results…")
        for _ in range(120):
            try:
                _ = http_json(f"{base}/analysis/{dataset_id}/results")
                break
            except Exception:
                time.sleep(1)
        else:
            raise SystemExit("Timed out waiting for results.")
    else:
        run = http_json(run_url, method="POST", body=b"")
        print(f"   status={run.get('status')}")

    print("3) Fetching results…")
    results = http_json(f"{base}/analysis/{dataset_id}/results")
    model = results.get("model", {})
    metrics = (model.get("metrics") or {})
    print(f"   selected_model={model.get('selected_model')}")
    if metrics:
        cleaned: dict[str, float | str] = {}
        for k, v in metrics.items():
            if isinstance(v, (int, float)):
                cleaned[k] = round(float(v), 4)
            else:
                cleaned[k] = v
        print(f"   metrics={cleaned}")

    print("4) Fetching logs…")
    logs = http_json(f"{base}/analysis/{dataset_id}/logs")
    hr_timeline = logs.get("hr_timeline", []) if isinstance(logs, dict) else []
    diagnostics = logs.get("developer_diagnostics", []) if isinstance(logs, dict) else logs
    print(f"   hr_timeline_steps={len(hr_timeline)} developer_log_entries={len(diagnostics)}")
    if diagnostics:
        last = diagnostics[-1]
        print(f"   last={last.get('agent')} {last.get('status')}: {last.get('message')}")

    comparison = results.get("research_comparison") or model.get("research_comparison") or {}
    if comparison:
        print("5) Baseline vs Retainly agents:")
        baseline_metrics = (comparison.get("baseline") or {}).get("metrics") or {}
        agents = (comparison.get("retainly_multi_agent") or {}).get("metrics") or {}
        deltas = comparison.get("metric_deltas") or {}
        for key in ["recall", "f1", "roc_auc", "pr_auc", "recall_at_top_20_percent"]:
            print(f"   {key}: baseline={baseline_metrics.get(key)} retainly={agents.get(key)} delta={deltas.get(key)}")
        print(f"   verdict={comparison.get('verdict')}")

    llm = results.get("llm_insights") or {}
    print(f"6) LLM narrative: {llm.get('status', 'not_available')}")

    print("7) Report URL (download in browser):")
    print(f"   {base}/analysis/{dataset_id}/report")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
