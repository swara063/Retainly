# Validation Artifact Guide

Retainly's benchmark validation is maintained as a separate proof workflow from the HR website.

## Steps

1. Put the benchmark datasets in `research_datasets/`.
2. Activate the backend environment.
3. Install notebook export dependencies:
   ```bash
   pip install nbconvert nbformat ipykernel
   ```
4. Run the benchmark comparison:
   ```bash
   python scripts/run_dataset_comparison.py
   ```
5. Export the executed notebook and HTML report:
   ```bash
   python scripts/export_validation_notebook.py
   ```
6. Commit and push the executed artifacts if needed:
   - `notebooks/retainly_dataset_comparison_executed.ipynb`
   - `project_docs/retainly_validation_report.html`
   - `project_docs/retainly_validation_report.pdf` if generated
   - `research_outputs/*`

## Notes

- The source notebook in GitHub/Colab is useful for reproduction, but the executed notebook is the proof artifact.
- If PDF export is unavailable in your environment, keep the HTML report and executed notebook.
