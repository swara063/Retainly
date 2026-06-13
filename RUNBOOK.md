# Retainly / Attrition Intelligence Platform — Runbook

This project runs fully locally. A Groq API key is optional: without it, Retainly uses deterministic fallback text for chat and insights.

## Prerequisites

- **Python:** 3.11 recommended.
- **Local Mac note:** use the conda setup below. Plain `pip install -r requirements.txt` can try to compile SciPy/scikit-learn/SHAP on some macOS setups.
- **Node.js + npm:** any modern version

## Backend (FastAPI)

```bash
cd hr_attrition_intelligence_platform/backend
conda create -y -p ./.conda python=3.11 numpy=1.26 pandas=2.2 scikit-learn=1.5 matplotlib=3.9 seaborn=0.13 joblib=1.4
./.conda/bin/python -m pip install fastapi==0.111.0 "uvicorn[standard]==0.30.1" python-multipart==0.0.9 jinja2==3.1.4 reportlab==4.2.0 pydantic==2.7.4 httpx==0.27.0 python-dotenv==1.0.1 pytest==8.2.2
./.conda/bin/uvicorn app.main:app --reload --port 8000
```

- Health: `http://localhost:8000/`
- Swagger: `http://localhost:8000/docs`

## Frontend (Vite + React)

```bash
cd hr_attrition_intelligence_platform/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Optional Groq setup

```bash
cd hr_attrition_intelligence_platform/backend
cp .env.example .env
# edit .env and set GROQ_API_KEY
```

Do not commit `.env`. On Render, add `GROQ_API_KEY` in the service environment variables.

## “Proof it works” tests (API demo)

With the backend running:

```bash
cd hr_attrition_intelligence_platform
./backend/.conda/bin/python scripts/generate_sample_dataset.py --rows 1500 --output sample_data/retainly_demo_hr.csv
./backend/.conda/bin/python scripts/demo_api.py --csv sample_data/retainly_demo_hr.csv
```

This prints:
- uploaded `dataset_id`
- selected model + metrics
- baseline vs Retainly agent-workflow comparison
- number of agent log entries
- LLM narrative status
- a report download URL

## Tests

```bash
cd hr_attrition_intelligence_platform
./backend/.conda/bin/python -m pytest backend/tests -q
```

## Generating a better demo dataset (ChatGPT prompt)

Use this prompt in ChatGPT to generate a higher-signal CSV so the demo produces clearer metrics and more meaningful explanations.

Copy/paste prompt:

```text
Create a realistic-looking synthetic HR attrition dataset as CSV (no code), with 2500 rows.

Output requirements:
- Return ONLY raw CSV (header + rows), no markdown, no explanation.
- Use comma as separator, quote fields only if needed.
- No blank lines.
- Keep missing values low (<=2% cells) but include a few realistic missing entries in non-critical columns.

Columns (use exactly these names):
EmployeeID (unique int), Age (int), Gender (Male/Female), Department (Sales/R&D/HR/Support),
JobRole (Executive/Engineer/Manager/Analyst/Specialist), MonthlyIncome (int, INR),
YearsAtCompany (int), OverTime (Yes/No), JobSatisfaction (1-4 int),
DistanceFromHome (int 1-40), WorkLifeBalance (1-4 int),
TrainingTimesLastYear (0-6 int), PerformanceRating (1-4 int),
EnvironmentSatisfaction (1-4 int), NumCompaniesWorked (0-8 int),
PromotionInLast2Years (Yes/No), Attrition (Yes/No)

Data realism constraints:
- Attrition rate overall ~18% (between 15% and 22%).
- Make Attrition meaningfully predictable (target ROC-AUC ~0.75–0.85 possible with standard models).
- Strong risk factors: OverTime=Yes, low JobSatisfaction, low WorkLifeBalance, no promotion, long DistanceFromHome,
  low MonthlyIncome relative to role/department, frequent job changes (NumCompaniesWorked high), low EnvironmentSatisfaction.
- Protective factors: higher income, recent promotion, higher satisfaction, fewer companies worked, balanced work-life.
- Add mild department/jobrole differences (e.g., Sales slightly higher attrition; HR slightly lower), but avoid extreme bias.
- Avoid unrealistic perfect rules; keep noise so it’s not 99% accurate.
- Ensure numeric ranges are plausible and distributions are non-uniform.
```

Save it as `retainly_demo_attrition.csv` and upload it in the UI.

## Demo script (what to show in a presentation)

1. Start backend, open `http://localhost:8000/docs`
2. Upload `sample_data/retainly_demo_hr.csv` via UI (`http://localhost:5173`)
3. Click **Run Multi-Agent Analysis**
4. Show:
   - execution timeline (agent-by-agent)
   - baseline vs Retainly agent comparison
   - model metrics
   - top predictive features chart
   - fairness summary
   - employee risk explorer
   - Groq chatbot / LLM narrative if the key is configured
5. Download the PDF report
