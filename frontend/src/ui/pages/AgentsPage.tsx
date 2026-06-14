import React from 'react';
import { useAppState } from '../state';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

export default function AgentsPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <div className="page"><h2>Agents</h2><Empty text={hasUploadedDataset ? 'Run analysis first to view this section.' : 'Upload HR data and run retention analysis to view this section.'} /></div>;
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Agents</h2>
          <p className="muted">Workflow transparency only.</p>
        </div>
        <div className="chip">{s.hrTimeline?.length || 0} steps</div>
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
    </div>
  );
}
