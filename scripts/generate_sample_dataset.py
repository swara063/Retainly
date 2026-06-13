from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


DEPARTMENTS = ["Sales", "R&D", "HR", "Finance", "IT", "Operations", "Customer Support"]
JOB_ROLES_BY_DEPT: dict[str, list[str]] = {
    "Sales": ["Sales Executive", "Sales Representative", "Account Manager", "Sales Manager"],
    "R&D": ["Data Scientist", "Research Scientist", "Software Engineer", "Lab Technician", "Product Engineer"],
    "HR": ["HR Generalist", "Recruiter", "HR Business Partner"],
    "Finance": ["Financial Analyst", "Accountant", "Finance Manager"],
    "IT": ["IT Support", "Systems Administrator", "Security Analyst"],
    "Operations": ["Operations Analyst", "Operations Manager", "Supply Chain Specialist"],
    "Customer Support": ["Support Specialist", "Customer Success Manager", "Support Lead"],
}


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1 / (1 + np.exp(-x))


def _choice(rng: np.random.Generator, items: list[str], p: list[float] | None = None, size: int = 1) -> np.ndarray:
    return rng.choice(np.array(items, dtype=object), size=size, replace=True, p=p)


def _bounded_int(rng: np.random.Generator, mean: float, sd: float, lo: int, hi: int, size: int) -> np.ndarray:
    x = rng.normal(mean, sd, size=size)
    return np.clip(np.round(x), lo, hi).astype(int)


def _risk_band(score: float) -> str:
    if score >= 0.80:
        return "Critical"
    if score >= 0.65:
        return "High"
    if score >= 0.35:
        return "Medium"
    return "Low"


def generate_hr_attrition_demo(rows: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    employee_ids = np.arange(100001, 100001 + rows, dtype=int)

    # Age: typical working population with fewer extremes.
    age = _bounded_int(rng, mean=34.5, sd=8.2, lo=18, hi=60, size=rows)

    gender = _choice(rng, ["Male", "Female"], p=[0.56, 0.44], size=rows)

    dept = _choice(
        rng,
        DEPARTMENTS,
        p=[0.22, 0.26, 0.08, 0.10, 0.10, 0.14, 0.10],
        size=rows,
    )

    # JobRole depends on department.
    jobrole = np.empty(rows, dtype=object)
    for d in DEPARTMENTS:
        idx = np.where(dept == d)[0]
        if idx.size == 0:
            continue
        roles = JOB_ROLES_BY_DEPT[d]
        # Within dept, skew toward IC roles.
        base_p = np.array([0.35, 0.25, 0.20, 0.20]) if len(roles) == 4 else None
        if base_p is not None and len(base_p) != len(roles):
            base_p = None
        jobrole[idx] = _choice(rng, roles, p=(base_p.tolist() if base_p is not None else None), size=idx.size)

    # Tenure (YearsAtCompany): right-skew with many early-tenure employees.
    years_at_company = np.clip(rng.gamma(shape=2.2, scale=2.2, size=rows), 0, 25)
    years_at_company = np.round(years_at_company, 1)

    # YearsInCurrentRole correlates with tenure.
    years_in_role = np.clip(years_at_company - rng.gamma(shape=1.6, scale=1.2, size=rows), 0, 20)
    years_in_role = np.round(years_in_role, 1)

    # OverTime: more common in Sales + Operations + Support, and for early tenure.
    base_ot = np.where(np.isin(dept, ["Sales", "Operations", "Customer Support"]), 0.38, 0.22)
    base_ot = base_ot + np.where(years_at_company < 2.0, 0.10, 0.0) - np.where(years_at_company > 7.0, 0.06, 0.0)
    base_ot = np.clip(base_ot, 0.08, 0.65)
    overtime = np.where(rng.random(rows) < base_ot, "Yes", "No")

    # Ratings and satisfaction: correlated but noisy.
    manager_rating = _bounded_int(rng, mean=3.4, sd=0.8, lo=1, hi=5, size=rows)
    environment_satisfaction = _bounded_int(rng, mean=3.1, sd=0.9, lo=1, hi=4, size=rows)
    job_satisfaction = np.clip(
        _bounded_int(rng, mean=3.0, sd=0.85, lo=1, hi=4, size=rows) - (overtime == "Yes").astype(int) * rng.integers(0, 2, size=rows),
        1,
        4,
    ).astype(int)
    work_life_balance = np.clip(
        _bounded_int(rng, mean=3.0, sd=0.75, lo=1, hi=4, size=rows) - (overtime == "Yes").astype(int),
        1,
        4,
    ).astype(int)

    # Performance: mostly 3/4, rare 2/5.
    performance_rating = _choice(rng, ["2", "3", "4", "5"], p=[0.06, 0.63, 0.29, 0.02], size=rows).astype(int)

    # DistanceFromHome: log-ish distribution, longer commutes somewhat less common.
    distance = np.clip(np.round(rng.lognormal(mean=2.1, sigma=0.55, size=rows)), 1, 45).astype(int)

    training_times = np.clip(rng.poisson(lam=2.2, size=rows), 0, 8).astype(int)

    # PromotionLast2Years correlated with tenure + performance; relatively rare.
    promo_prob = 0.06 + 0.02 * (performance_rating >= 4).astype(float) + 0.02 * (years_at_company >= 4.0).astype(float)
    promo_prob = np.clip(promo_prob, 0.02, 0.22)
    promotion_last_2 = (rng.random(rows) < promo_prob).astype(int)

    # SalaryHikePercent correlated with performance and promotions.
    salary_hike = np.clip(
        rng.normal(loc=12.0, scale=3.5, size=rows)
        + 2.0 * (performance_rating >= 4).astype(float)
        + 2.5 * promotion_last_2.astype(float),
        4,
        25,
    )
    salary_hike = np.round(salary_hike, 1)

    # MonthlyIncome: depends on department/role and tenure; add noise.
    dept_pay = {
        "Sales": 52000,
        "R&D": 74000,
        "HR": 56000,
        "Finance": 70000,
        "IT": 68000,
        "Operations": 60000,
        "Customer Support": 50000,
    }
    role_bump = np.zeros(rows)
    role_bump += np.where(np.char.find(jobrole.astype(str), "Manager") >= 0, 22000, 0)
    role_bump += np.where(np.char.find(jobrole.astype(str), "Director") >= 0, 35000, 0)
    role_bump += np.where(np.char.find(jobrole.astype(str), "Data Scientist") >= 0, 18000, 0)
    base_income = np.array([dept_pay[str(d)] for d in dept], dtype=float)
    monthly_income = base_income + role_bump + (years_at_company * 3200.0) + rng.normal(0, 9000, size=rows)
    monthly_income = np.clip(monthly_income, 22000, 210000)
    monthly_income = np.round(monthly_income, 0).astype(int)

    # AbsenteeismDays: poisson-like; higher with low satisfaction / poor WLB.
    absentee = rng.poisson(lam=2.0, size=rows).astype(float)
    absentee += (job_satisfaction <= 2).astype(float) * rng.poisson(lam=2.0, size=rows)
    absentee += (work_life_balance <= 2).astype(float) * rng.poisson(lam=1.5, size=rows)
    absentee += np.clip(rng.normal(0, 1.2, size=rows), -1.0, 3.0)
    absentee = np.clip(np.round(absentee), 0, 24).astype(int)

    # Risk model: logistic with meaningful correlations + noise.
    # Start with base rate around ~0.20 then adjust.
    low_income = (monthly_income < np.percentile(monthly_income, 35)).astype(float)
    long_commute = (distance >= 25).astype(float)
    early_tenure = (years_at_company < 2.0).astype(float)
    no_promo = (promotion_last_2 == 0).astype(float)
    low_mgr = (manager_rating <= 2).astype(float)
    high_abs = (absentee >= 7).astype(float)
    low_js = (job_satisfaction <= 2).astype(float)
    low_wlb = (work_life_balance <= 2).astype(float)

    # Certain dept-role combinations (not leakage; just plausible variation).
    combo_risk = np.zeros(rows)
    combo_risk += np.where((dept == "Sales") & (overtime == "Yes"), 0.25, 0.0)
    combo_risk += np.where((dept == "Customer Support") & (distance >= 25), 0.18, 0.0)
    combo_risk += np.where((dept == "Operations") & (job_satisfaction <= 2), 0.12, 0.0)
    combo_risk += np.where((dept == "R&D") & (jobrole.astype(str) == "Lab Technician"), 0.10, 0.0)

    # Linear log-odds with noise; avoid making it too easy.
    z = (
        -2.75
        + 0.85 * (overtime == "Yes").astype(float)
        + 0.55 * low_js
        + 0.48 * low_wlb
        + 0.35 * long_commute
        + 0.40 * low_income
        + 0.30 * no_promo
        + 0.45 * low_mgr
        + 0.42 * high_abs
        + 0.30 * early_tenure
        + combo_risk
        + rng.normal(0, 0.55, size=rows)
    )

    # Slightly reduce risk for older employees and strong performance, but keep mild.
    z += -0.10 * (age >= 45).astype(float)
    z += -0.12 * (performance_rating >= 4).astype(float)

    risk_score = _sigmoid(z)

    attrition = np.where(rng.random(rows) < risk_score, "Yes", "No")

    df = pd.DataFrame(
        {
            "EmployeeID": employee_ids,
            "Age": age,
            "Gender": gender,
            "Department": dept,
            "JobRole": jobrole,
            "MonthlyIncome": monthly_income,
            "YearsAtCompany": years_at_company,
            "YearsInCurrentRole": years_in_role,
            "OverTime": overtime,
            "JobSatisfaction": job_satisfaction,
            "WorkLifeBalance": work_life_balance,
            "PerformanceRating": performance_rating,
            "DistanceFromHome": distance,
            "TrainingTimesLastYear": training_times,
            "EnvironmentSatisfaction": environment_satisfaction,
            "ManagerRating": manager_rating,
            "PromotionLast2Years": promotion_last_2,
            "SalaryHikePercent": salary_hike,
            "AbsenteeismDays": absentee,
            "Attrition": attrition,
        }
    )

    return df


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a realistic HR attrition demo dataset for Retainly.")
    parser.add_argument("--rows", type=int, default=1500, help="Number of rows to generate (default: 1500).")
    parser.add_argument("--output", type=str, default="sample_data/retainly_demo_hr.csv", help="Output CSV path.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default: 42).")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    out_path = (root / args.output).resolve() if not Path(args.output).is_absolute() else Path(args.output).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df = generate_hr_attrition_demo(rows=int(args.rows), seed=int(args.seed))
    df.to_csv(out_path, index=False)

    attr_rate = float((df["Attrition"] == "Yes").mean())
    print(f"output: {out_path}")
    print(f"rows: {len(df)}")
    print(f"attrition_rate: {attr_rate:.3f}")
    print(f"columns: {df.shape[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
