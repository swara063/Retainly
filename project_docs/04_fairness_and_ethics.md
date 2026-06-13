# Fairness and Ethics Framework

## Purpose

HR analytics has direct ethical implications. This system therefore includes fairness auditing and an explicit decision-support disclaimer.

## Audited attributes

The pipeline automatically checks available group columns such as Gender, Age, Department, JobRole, and MaritalStatus when present.

## Metrics

- Prediction rate difference
- False positive rate difference
- False negative rate difference

## Risk levels

- Low: group metric gap below 0.10
- Moderate: gap from 0.10 to 0.20
- High: gap above 0.20

## Ethical safeguards

The system clearly states that predictions must not be used as the sole basis for hiring, firing, promotion, compensation, or disciplinary decisions.
