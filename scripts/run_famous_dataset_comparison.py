from __future__ import annotations

import csv
import json
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]
DATASETS = [
    ("ibm_hr_attrition", ROOT / "research_datasets" / "ibm_hr_attrition.csv"),
    ("saudi_employee_attrition", ROOT / "research_datasets" / "saudi_employee_attrition.csv"),
]
OUT_DIR = ROOT / "research_outputs"
OUT_DIR.mkdir(exist_ok=True)


def detect_target(columns: list[str]) -> str | None:
    candidates = ["attrition", "left", "resigned", "turnover", "exit", "churn", "terminated", "employeleft", "employee_left"]
    for col in columns:
        norm = col.lower().replace(" ", "").replace("_", "")
        if any(c in norm for c in candidates):
            return col
    return None


def load_csv(path: Path):
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def main() -> int:
    available = [(name, path) for name, path in DATASETS if path.exists()]
    missing = [path for _, path in DATASETS if not path.exists()]
    if missing and not available:
        print("No famous datasets found.")
        for p in missing:
            print(f"Missing: {p}")
        print("Please download the dataset and place it at research_datasets/<filename>. The notebook will continue with any available dataset.")
        return 0

    summary = []
    for name, path in available:
        rows = load_csv(path)
        cols = rows[0].keys() if rows else []
        target = detect_target(list(cols))
        summary.append({"dataset": name, "path": str(path), "rows": len(rows), "columns": len(list(cols)), "target_column": target or "(unlabeled)"})

    (OUT_DIR / "famous_dataset_comparison_summary.json").write_text(json.dumps({"datasets": summary, "note": "Implement the full notebook comparison here if the datasets are available."}, indent=2), encoding="utf-8")
    (OUT_DIR / "famous_dataset_comparison_results.csv").write_text("dataset,rows,columns,target_column\n" + "\n".join(f"{r['dataset']},{r['rows']},{r['columns']},{r['target_column']}" for r in summary), encoding="utf-8")
    print("Found datasets:")
    for row in summary:
        print(f"- {row['dataset']}: rows={row['rows']} columns={row['columns']} target={row['target_column']}")
    if missing:
        print("Missing file(s):")
        for p in missing:
            print(f"- {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
