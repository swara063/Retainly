# System Architecture

## Architecture style

The system follows a modular full-stack architecture:

- React frontend for user interaction
- FastAPI backend for APIs and orchestration
- Multi-agent service layer for analytics workflow
- Local storage layer for datasets, results, logs, reports, and model artifacts
- PDF reporting layer for academic and managerial outputs

## High-level flow

```text
User -> React Dashboard -> FastAPI API -> Multi-Agent Pipeline -> Results/Logs/Report -> Dashboard
```

## Agent pipeline

```text
Project Manager Agent
        ↓
Column Mapper Agent
        ↓
Data Analyst Agent
        ↓
ML Engineer Agent
        ↓
Fairness Auditor Agent
        ↓
Insights Agent
        ↓
Report Generator
```

## Why multi-agent architecture matters

The agent design improves transparency. Each stage has a clear responsibility, independent logs, and academically explainable behavior. This helps during viva because the system can be defended as a responsible AI workflow rather than a black-box prediction model.
