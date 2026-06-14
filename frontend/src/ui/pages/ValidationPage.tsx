import React from 'react';
import { EmptyState, PageShell, SectionCard } from '../components/PageLayout';

const charts = [
  {
    title: 'Core metric comparison',
    src: 'https://raw.githubusercontent.com/swara063/Retainly/main/research_outputs/dataset_comparison_core_metrics.png',
    explanation: 'Compares baseline models and Retainly on Accuracy, Precision, Recall, F1, ROC-AUC, and PR-AUC. For attrition, Recall, F1, and PR-AUC are especially important because leavers are usually the minority class.',
  },
  {
    title: 'Top-k prioritization metrics',
    src: 'https://raw.githubusercontent.com/swara063/Retainly/main/research_outputs/dataset_comparison_topk_metrics.png',
    explanation: 'Shows how well each approach identifies actual leavers within the highest-risk employee groups. This matters because HR teams usually act on a prioritized risk list.',
  },
  {
    title: 'Final decision-support score',
    src: 'https://raw.githubusercontent.com/swara063/Retainly/main/research_outputs/dataset_comparison_final_score.png',
    explanation: 'Combines predictive performance with platform capabilities such as explainability, responsible-AI review, employee prioritization, and HR action planning.',
  },
];

function ChartBlock({ title, src, explanation }: { title: string; src: string; explanation: string }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <SectionCard title={title} subtitle={explanation}>
      <div style={{ marginTop: 12 }}>
        {!failed ? (
          <img
            src={src}
            alt={title}
            style={{ width: '100%', borderRadius: 12, border: '1px solid #e2e8f0' }}
            onError={() => setFailed(true)}
          />
        ) : (
          <EmptyState title="Chart unavailable" description="Chart will appear here after research_outputs are generated and pushed." />
        )}
      </div>
    </SectionCard>
  );
}

export default function ValidationPage() {
  return (
    <PageShell title="Validation & Method Proof" subtitle="The website is the HR risk-scoring product. This page links to the separate benchmark validation used to defend the Retainly multi-agent method.">
      <SectionCard title="Validation Notebook" subtitle="Run the notebook in Colab to reproduce baseline-vs-Retainly training, metrics, charts, top drivers, and responsible-AI review.">
        <div className="btnRow" style={{ marginTop: 12 }}>
          <a className="download" href="https://colab.research.google.com/github/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">Open reproducible source notebook in Colab</a>
          <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">View notebook source on GitHub</a>
          <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison_executed.ipynb" target="_blank" rel="noreferrer">View executed validation notebook</a>
          <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/project_docs/retainly_validation_report.html" target="_blank" rel="noreferrer">View validation report</a>
        </div>
        <div className="panelHint" style={{ marginTop: 12 }}>
          Colab opens the notebook source. To reproduce results, run all cells after adding the benchmark datasets. For a submitted proof artifact, upload an executed notebook or exported PDF.
        </div>
      </SectionCard>

      <SectionCard title="Research Outputs" subtitle="Generated outputs include metric comparison tables, charts, top drivers, fairness review, and HR action summaries.">
        <div className="btnRow" style={{ marginTop: 12 }}>
          <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/research_outputs/dataset_comparison_results.csv" target="_blank" rel="noreferrer">View results CSV</a>
          <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/research_outputs/dataset_comparison_summary.json" target="_blank" rel="noreferrer">View summary JSON</a>
          <a className="download secondary" href="https://github.com/swara063/Retainly/tree/main/research_outputs" target="_blank" rel="noreferrer">View charts folder</a>
          <a className="download secondary" href="#charts-explained">View charts with explanation</a>
        </div>
      </SectionCard>

      <SectionCard title="How to interpret" subtitle="Baseline models are normal classifiers. Retainly is a multi-agent workflow that adds preprocessing, model selection, threshold tuning, explainability, responsible-AI review, employee prioritization, and HR action planning." />

      <div id="charts-explained" className="card sectionCard">
        <h3>Charts with explanation</h3>
        <p className="muted" style={{ marginTop: 8 }}>These visual summaries explain how the validation evidence should be read.</p>
      </div>
      {charts.map((chart) => (
        <ChartBlock key={chart.title} title={chart.title} src={chart.src} explanation={chart.explanation} />
      ))}
    </PageShell>
  );
}
