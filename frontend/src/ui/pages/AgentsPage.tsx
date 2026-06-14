import React from 'react';
import { useAppState } from '../state';

export default function AgentsPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return (
      <div className="page">
        <div className="card">
          <h3>Agents</h3>
          <p className="muted">{hasUploadedDataset ? 'Run analysis first to view this section.' : 'Upload HR data and run retention analysis to view this section.'}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Agents</h2>
          <p className="muted">See the business-friendly workflow and optional technical diagnostics.</p>
        </div>
        <div className="chip">{s.hrTimeline?.length || 0} workflow steps</div>
      </div>
      <div className="card">
        <h3>HR timeline</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Status</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {(s.hrTimeline || []).map((item: any, i: number) => (
              <tr key={i}>
                <td><b>{item.step}</b></td>
                <td>{String(item.status).toUpperCase()}</td>
                <td>{item.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <details className="detailsBox">
          <summary>Developer diagnostics</summary>
          <pre className="pre">{JSON.stringify(s.developerDiagnostics || [], null, 2)}</pre>
        </details>
      </div>
      {hasValidResults && (
        <div className="grid two">
          <div className="card">
            <h3>Data Analyst output (EDA)</h3>
            <p className="muted">Missing values, distributions, and correlations.</p>
            <details className="detailsBox">
              <summary>Show EDA JSON</summary>
              <pre className="pre">{JSON.stringify(s.results.eda || {}, null, 2)}</pre>
            </details>
          </div>
          <div className="card">
            <h3>ML Engineer output (models)</h3>
            <p className="muted">Leaderboard, selected model, and evaluation artifacts.</p>
            <details className="detailsBox">
              <summary>Show model JSON</summary>
              <pre className="pre">{JSON.stringify(s.results.model || {}, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}
