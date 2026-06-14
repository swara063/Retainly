import React from 'react';

function Card({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="card" style={{ maxWidth: 980 }}>
      <h3>{title}</h3>
      <p className="muted" style={{ marginTop: 8 }}>{text}</p>
      {children}
    </div>
  );
}

function ChartBlock({ title, src, explanation }: { title: string; src: string; explanation: string }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="card" style={{ maxWidth: 980 }}>
      <h3>{title}</h3>
      <div style={{ marginTop: 12 }}>
        {!failed ? (
          <img
            src={src}
            alt={title}
            style={{ width: '100%', borderRadius: 12, border: '1px solid #e2e8f0' }}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="panelHint">Chart will appear here after research_outputs are generated and pushed.</div>
        )}
      </div>
      <p className="muted" style={{ marginTop: 12 }}>{explanation}</p>
    </div>
  );
}

export default function ValidationPage() {
  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Validation &amp; Method Proof</h2>
          <p className="muted">The website is the HR risk-scoring product. This page links to the separate benchmark validation used to defend the Retainly multi-agent method.</p>
        </div>
      </div>

      <div className="grid one">
        <Card
          title="Validation Notebook"
          text="Run the notebook in Colab to reproduce baseline-vs-Retainly training, metrics, charts, top drivers, and responsible-AI review."
        >
          <div className="btnRow" style={{ marginTop: 12 }}>
            <a className="download" href="https://colab.research.google.com/github/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">Open reproducible source notebook in Colab</a>
            <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">View notebook source on GitHub</a>
            <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison_executed.ipynb" target="_blank" rel="noreferrer">View executed validation notebook</a>
            <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/project_docs/retainly_validation_report.html" target="_blank" rel="noreferrer">View validation report</a>
          </div>
          <div className="panelHint" style={{ marginTop: 12 }}>
            Colab opens the notebook source. To reproduce results, run all cells after adding the benchmark datasets. For a submitted proof artifact, upload an executed notebook or exported PDF.
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
            <a className="download secondary" href="#charts-explained">View charts with explanation</a>
          </div>
        </Card>

        <Card
          title="How to interpret"
          text="Baseline models are normal classifiers. Retainly is a multi-agent workflow that adds preprocessing, model selection, threshold tuning, explainability, responsible-AI review, employee prioritization, and HR action planning."
        />

        <div id="charts-explained" className="card" style={{ maxWidth: 980 }}>
          <h3>Charts with explanation</h3>
          <p className="muted" style={{ marginTop: 8 }}>These visual summaries explain how the validation evidence should be read.</p>
        </div>

        <ChartBlock
          title="Core Metrics"
          src="https://raw.githubusercontent.com/swara063/Retainly/main/research_outputs/dataset_comparison_core_metrics.png"
          explanation="Compares standard baseline models against Retainly on accuracy, precision, recall, F1, ROC-AUC, and PR-AUC. Retainly should be interpreted mainly through recall, F1, and PR-AUC because attrition data is imbalanced."
        />

        <ChartBlock
          title="Top-k Metrics"
          src="https://raw.githubusercontent.com/swara063/Retainly/main/research_outputs/dataset_comparison_topk_metrics.png"
          explanation="Shows how well each approach identifies actual leavers within the highest-risk employee groups. This is important because HR teams usually act on prioritized risk lists."
        />

        <ChartBlock
          title="Final Score"
          src="https://raw.githubusercontent.com/swara063/Retainly/main/research_outputs/dataset_comparison_final_score.png"
          explanation="Combines predictive performance with decision-support capabilities such as explainability, responsible-AI review, employee prioritization, and HR action planning."
        />
      </div>
    </div>
  );
}
