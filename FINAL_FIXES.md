# Retainly Final Repair Pass

This zip is aligned with the original abstract: React + FastAPI, simulated multi-agent workflow, smart column mapping, EDA/modeling/explainability, HR insights, employee-level risk review, chatbot support, and PDF export.

## What was fixed

- Removed top-bar clutter: no API Docs / Health links in the HR UI.
- Added proper multi-page navigation: Home, Employees, Insights, Data Story, Explainability, Fairness, Agents, Chatbot.
- Added a dedicated At-Risk Employee Explorer page:
  - searchable by employee name or ID
  - dropdown suggestions
  - filters for department, job role, and risk band
  - sorted highest-risk-first by default
  - detail profile with supportive HR action and ethical reminder
- Fixed state persistence so route changes and refreshes do not make pages look empty immediately.
- Fixed analysis polling so the UI does not say completed when backend results are missing or failed.
- Removed default HR-facing advanced mapping controls from the normal flow.
- Made SHAP/explainability fallback stable when calibrated models are used.
- Fixed target encoding so attrition/left/resigned/yes maps to risk class correctly.
- Made retention actions diverse instead of repeating the same overtime segment.
- Kept model metrics honest, but presented them as confidence/directional method notes instead of scary HR-facing warnings.
- Validated frontend production build with `npm run build`.
- Validated backend Python compilation with `python3 -m compileall -q backend/app`.
- Ran a direct pipeline smoke test with generated demo data and verified:
  - status completed
  - target detected
  - employee risk records generated
  - diverse retention plan generated
  - PDF report generated

## Deployment notes

Frontend:
- Use `VITE_API_BASE_URL` or `VITE_API_BASE` pointing to the Render backend origin.
- The frontend normalizes the value and appends `/api` automatically if needed.

Backend:
- Render can run the FastAPI backend with the existing requirements.
- Optional Groq chat requires a Groq key. The core app works without it.

## Ethical use

Retainly is decision-support only. Employee-level risk is shown for supportive retention outreach, not punitive action or automated employment decisions.
