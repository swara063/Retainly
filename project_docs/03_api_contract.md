# API Contract

## Upload dataset

`POST /api/datasets/upload`

Uploads a CSV dataset and returns the dataset ID, rows, and detected columns.

## Run analysis

`POST /api/analysis/{dataset_id}/run`

Runs the full multi-agent analysis pipeline.

## Get results

`GET /api/analysis/{dataset_id}/results`

Returns EDA, model metrics, feature importance, fairness audit, insights, and recommendations.

## Get logs

`GET /api/analysis/{dataset_id}/logs`

Returns transparent agent execution logs.

## Download report

`GET /api/analysis/{dataset_id}/report`

Downloads the generated PDF report.
