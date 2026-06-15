import React from 'react';
import { useAppState } from '../state';
import { EmptyState, PageShell } from '../components/PageLayout';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

export default function AgentsPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <PageShell title="Agents" subtitle="Workflow timeline and collapsed diagnostics."><EmptyState title="Run analysis first to view this section." description={hasUploadedDataset ? 'Workflow timeline will appear after analysis completes.' : 'Upload HR data to begin workflow analysis.'} /></PageShell>;
  }

  return (
    <PageShell title="Agents" subtitle="Workflow timeline and collapsed diagnostics.">
      <div className="pageHeader">
        <div>
          <h2>Agents</h2>
          <p className="muted">Workflow transparency only.</p>
        </div>
        <div className="chip">{s.hrTimeline?.length || 0} steps</div>
      </div>
      <div className="grid two">
        {[
          ['Project Manager Agent', 'Orchestrates workflow, validates completion, and tracks stage progress.'],
          ['Data Analyst Agent', 'Checks data quality and profiles departments, roles, workload, satisfaction, and tenure patterns.'],
          ['ML Engineer Agent', 'Loads the pretrained Retainly model and scores employee risk for website analysis.'],
          ['Insights Agent', 'Turns risk scores into employee profiles, hotspots, action plan, report content, and chatbot context.'],
        ].map(([title, text]) => (
          <div className="card" key={title}>
            <h3>{title}</h3>
            <div className="panelHint">{text}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Step</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>
            {(s.hrTimeline || []).map((item: any, index: number) => (
              <tr key={index}>
                <td><b>{item.step}</b></td>
                <td>{String(item.status).toUpperCase()}</td>
                <td>{item.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="detailsBox" style={{ marginTop: 12 }}>
          <summary>Developer diagnostics</summary>
          <pre className="pre">{JSON.stringify(s.developerDiagnostics || [], null, 2)}</pre>
        </details>
      </div>
    </PageShell>
  );
}
