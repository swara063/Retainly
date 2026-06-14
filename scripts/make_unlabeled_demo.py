from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "research_datasets" / "synthetic_employee_attrition_74498test.csv"
DEFAULT_OUTPUT = ROOT / "sample_data" / "retainly_demo_unlabeled.csv"
TARGET_CANDIDATES = ("Attrition", "attrition", "Left", "left", "Turnover", "turnover")


def detect_target(columns: list[str]) -> str | None:
    for column in columns:
        if column in TARGET_CANDIDATES:
            return column
    for column in columns:
        lower = str(column).lower()
        if "attrition" in lower or "turnover" in lower or lower == "left":
            return column
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Create the unlabeled website demo CSV from the synthetic test split.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Input labeled CSV")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output unlabeled CSV")
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    if not input_path.exists():
        raise SystemExit(f"Input CSV not found: {input_path}")

    df = pd.read_csv(input_path)
    target = detect_target(list(df.columns))
    if target:
        df = df.drop(columns=[target])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"saved {output_path}")
    print(f"rows={len(df)} columns={len(df.columns)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
