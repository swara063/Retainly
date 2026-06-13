# Retainly - Abstract Alignment Check

This build is aligned with the submitted master plan/abstract while keeping the later HR usefulness improvements.

## Core abstract requirements covered

- End-to-end web platform: React frontend + FastAPI backend.
- Custom CSV upload with validation and smart import.
- Simulated multi-agent architecture: Project Manager, Column Mapper, Data Analyst, ML Engineer, Fairness Auditor, Insights Agent.
- Multi-agent execution is real backend orchestration, not only frontend labels. The pipeline calls each agent sequentially and stores agent logs/timeline.
- Automated data-science workflow: upload -> smart column mapping -> preprocessing/EDA -> model training -> explainability -> insights/action plan -> PDF report.
- EDA dashboard/data story: missing values, distributions, correlations, dataset profile.
- Model training: Logistic Regression, Random Forest, Gradient Boosting, plus ensemble/threshold selection for stronger HR prioritization.
- Explainability: SHAP when practical; built-in model feature importance/permutation fallback always keeps explanations available.
- Insights generator: HR-focused summaries, risk drivers, risk segments, retention actions.
- Agent Activity Monitor: clean HR timeline plus optional diagnostics.
- Report export: PDF generated after pipeline completion.
- Groq layer: chatbot uses Groq when GROQ_API_KEY is configured; deterministic HR-safe fallback is used if the key/provider is unavailable.
- Privacy/ethics: no punitive decision wording; decision-support disclaimer included.

## Added after abstract without breaking it

- At-risk employee explorer.
- Search by employee ID/name/row reference.
- Highest-risk-to-lowest-risk sorting.
- Employee profile with top factors and supportive HR action.
- Separate pages instead of one overwhelming page.
- HR-friendly wording instead of exposing dataset mapping/model internals first.

## Verification performed

- Backend Python compile passed.
- Frontend npm build passed.
- Smoke pipeline completed on sample HR attrition CSV.
- Agent timeline generated.
- Employee risk records generated.
- Retention action plan generated.
- Explainability output returned as Available.
- PDF report generated.
- Real API keys are not committed in backend/.env.
