# Retainly

A full-stack, explainable, ethically-aware multi-agent HR attrition analytics platform designed as an M.Tech major project. Retainly lets a user upload an HR CSV dataset, automatically maps columns, performs EDA, trains multiple machine-learning models, compares a plain baseline against the multi-agent workflow, evaluates fairness, generates employee risk rankings, uses Groq for optional HR narrative/chat support, and produces a downloadable report.

## Why this is major-project grade

This is not just a classifier. It is structured as an end-to-end decision-support platform with:

- Multi-agent pipeline architecture
- Baseline model vs Retainly agent-workflow comparison
- Automated dataset validation and column mapping
- EDA and visual analytics
- Multiple ML model comparison
- Feature importance and explainability
- Fairness and bias analysis
- Transparent execution timeline
- PDF/HTML report generation
- React dashboard
- FastAPI backend
- Sample synthetic dataset generator
- Clean documentation for implementation, viva, and dissertation writing

## Repository layout

```text
backend/                 FastAPI backend and analytics pipeline
frontend/                React + TypeScript dashboard
sample_data/             Demo HR attrition dataset
project_docs/            Academic and engineering documentation
scripts/                 Helper scripts
```

## Quick start

### Backend: local Mac / conda path

```bash
cd backend
conda create -y -p ./.conda python=3.11 numpy=1.26 pandas=2.2 scikit-learn=1.5 matplotlib=3.9 seaborn=0.13 joblib=1.4
./.conda/bin/python -m pip install fastapi==0.111.0 "uvicorn[standard]==0.30.1" python-multipart==0.0.9 jinja2==3.1.4 reportlab==4.2.0 pydantic==2.7.4 httpx==0.27.0 python-dotenv==1.0.1 pytest==8.2.2
./.conda/bin/python ../scripts/generate_sample_dataset.py --rows 1500 --output ../sample_data/retainly_demo_hr.csv
./.conda/bin/uvicorn app.main:app --reload --port 8000
```

Open API docs at `http://localhost:8000/docs`.

### Backend: Render/Linux path

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Groq / LLM setup

Do not commit API keys. Copy `backend/.env.example` to `backend/.env` and set:

```bash
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Groq is used in two places:

- Chatbot: answers HR questions from the latest Retainly results.
- Insights Agent: generates an optional HR executive narrative from structured model/fairness/action-plan outputs.

If no key is configured, the app still works with deterministic fallback text.

## Demo proof

With backend running:

```bash
./backend/.conda/bin/python scripts/demo_api.py --csv sample_data/retainly_demo_hr.csv
```

The output prints selected model metrics, agent logs, baseline-vs-Retainly metric deltas, LLM narrative status, and the PDF report URL.

## Render deployment

This repo includes a [`render.yaml`](./render.yaml) blueprint for deploying the backend and frontend as separate Render services.

Recommended setup:

1. Create the GitHub-connected Render service from the repo root.
2. Use the backend web service with `backend` as the root directory and `uvicorn app.main:app --host 0.0.0.0 --port $PORT` as the start command.
3. Use the frontend static site with `frontend` as the root directory and `npm ci && npm run build` as the build command.
4. Set the frontend `VITE_API_BASE_URL` to your backend Render URL plus `/api`.
5. Set backend `CORS_ORIGINS` to include your frontend Render URL.

## API flow

1. `POST /api/datasets/upload`
2. `POST /api/analysis/{dataset_id}/run`
3. `GET /api/analysis/{dataset_id}/results`
4. `GET /api/analysis/{dataset_id}/logs`
5. `GET /api/analysis/{dataset_id}/report`

## Ethical disclaimer

This platform is a decision-support and academic analytics tool. It must not be used as the sole basis for employment, termination, promotion, salary, or disciplinary decisions.
