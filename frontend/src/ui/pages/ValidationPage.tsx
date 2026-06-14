import React from 'react';

function Card({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="muted" style={{ marginTop: 8 }}>{text}</p>
      {children}
    </div>
  );
}

export default function ValidationPage() {
  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Validation &amp; Method Proof</h2>
          <p className="muted">Retainly’s HR website is a risk-scoring product. The model validation is maintained separately using labeled benchmark attrition datasets.</p>
        </div>
      </div>

      <div className="grid one">
        <Card
          title="Validation Notebook"
          text="Run the notebook in Colab to reproduce baseline-vs-Retainly training, metrics, charts, top drivers, and responsible-AI review."
        >
          <div className="btnRow" style={{ marginTop: 12 }}>
            <a className="download" href="https://colab.research.google.com/github/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">Open in Colab</a>
          </div>
        </Card>

        <Card
          title="Research Outputs"
          text="Generated outputs include metric comparison tables, charts, top drivers, fairness review, and HR action summaries."
        >
          <div className="btnRow" style={{ marginTop: 12 }}>
            <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/research_outputs/dataset_comparison_results.csv" target="_blank" rel="noreferrer">View results CSV</a>
            <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/research_outputs/dataset_comparison_summary.json" target="_blank" rel="noreferrer">View summary JSON</a>
            <a className="download secondary" href="https://github.com/swara063/Retainly/tree/main/research_outputs" target="_blank" rel="noreferrer">View charts folder</a>
          </div>
        </Card>

        <Card
          title="How to interpret"
          text="Baseline models are normal classifiers. Retainly is a multi-agent workflow that adds preprocessing, model selection, threshold tuning, explainability, responsible-AI review, employee prioritization, and HR action planning."
        />
      </div>
    </div>
  );
}
