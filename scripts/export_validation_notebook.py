from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_SOURCE = ROOT / "notebooks" / "retainly_dataset_comparison.ipynb"
NOTEBOOK_EXECUTED = ROOT / "notebooks" / "retainly_dataset_comparison_executed.ipynb"
HTML_REPORT = ROOT / "project_docs" / "retainly_validation_report.html"
PDF_REPORT = ROOT / "project_docs" / "retainly_validation_report.pdf"
DATASETS = [
    ROOT / "research_datasets" / "ibm_hr_attrition.csv",
    ROOT / "research_datasets" / "saudi_employee_attrition.csv",
    ROOT / "research_datasets" / "synthetic_employee_attrition_74498.csv",
]


def have(module: str) -> bool:
    return importlib.util.find_spec(module) is not None


def require(module: str):
    if not have(module):
        raise RuntimeError(f"Missing required dependency: {module}. Install with: pip install nbconvert nbformat ipykernel")


def check_datasets() -> list[Path]:
    missing = [path for path in DATASETS if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing benchmark datasets: " + ", ".join(str(p) for p in missing))
    return DATASETS


def run_dataset_comparison() -> None:
    script = ROOT / "scripts" / "run_dataset_comparison.py"
    print(f"[1/3] Running benchmark comparison: {script}")
    subprocess.run([sys.executable, str(script)], cwd=ROOT, check=True)


def execute_notebook() -> None:
    require("nbformat")
    require("nbconvert")
    require("ipykernel")

    import nbformat
    from nbconvert import HTMLExporter, NotebookExporter
    from nbconvert.preprocessors import ExecutePreprocessor

    print(f"[2/3] Executing notebook: {NOTEBOOK_SOURCE}")
    nb = nbformat.read(NOTEBOOK_SOURCE.open("r", encoding="utf-8"), as_version=4)
    ep = ExecutePreprocessor(timeout=3600, kernel_name="python3", allow_errors=False)
    ep.preprocess(nb, {"metadata": {"path": str(ROOT)}})

    NOTEBOOK_EXECUTED.parent.mkdir(parents=True, exist_ok=True)
    HTML_REPORT.parent.mkdir(parents=True, exist_ok=True)
    executed_data = nbformat.writes(nb)
    NOTEBOOK_EXECUTED.write_text(executed_data, encoding="utf-8")
    print(f"[2/3] Saved executed notebook: {NOTEBOOK_EXECUTED}")

    print(f"[3/3] Exporting HTML report: {HTML_REPORT}")
    html_exporter = HTMLExporter()
    html_body, _ = html_exporter.from_notebook_node(nb)
    HTML_REPORT.write_text(html_body, encoding="utf-8")
    print(f"[3/3] Saved HTML report: {HTML_REPORT}")

    try:
        from nbconvert import PDFExporter
        pdf_exporter = PDFExporter()
        pdf_data, _ = pdf_exporter.from_notebook_node(nb)
        PDF_REPORT.write_bytes(pdf_data)
        print(f"[3/3] Saved PDF report: {PDF_REPORT}")
    except Exception as exc:
        print(f"[3/3] PDF export skipped: {exc}")


def main() -> int:
    if not NOTEBOOK_SOURCE.exists():
        raise FileNotFoundError(f"Notebook not found: {NOTEBOOK_SOURCE}")
    check_datasets()
    run_dataset_comparison()
    execute_notebook()
    print("\nValidation artifact export complete.")
    print(f"Executed notebook: {NOTEBOOK_EXECUTED}")
    print(f"HTML report: {HTML_REPORT}")
    if PDF_REPORT.exists():
        print(f"PDF report: {PDF_REPORT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
