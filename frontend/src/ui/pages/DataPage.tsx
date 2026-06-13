import React from 'react';
import { API_BASE } from '../api';
import { useAppState } from '../state';

export default function DataPage() {
  const s = useAppState();
  if (!s.results) {
    return <div className="page"><div className="card"><b>Run analysis first to view this section.</b></div></div>;
  }

  const recommendations: string[] = s.results.recommendations || [];
  const actionCards = recommendations.slice(0, 5);

  return (
    <div className="page">
      <div className="grid two">
        <div className="card">
          <h3>Top recommended actions</h3>
          {actionCards.length ? (
            <table className="table">
              <tbody>
                {actionCards.map((item, index) => (
                  <tr key={index}>
                    <td><b>Action {index + 1}</b></td>
                    <td>{String(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Run analysis first to view this section.</p>
          )}
          <div className="btnRow single" style={{ marginTop: 12 }}>
            <a className="download" href={`${API_BASE}/analysis/${s.datasetId}/report`}>Download PDF report</a>
            <a className="download secondary" href={`${API_BASE}/analysis/${s.datasetId}/results.json`}>Download results JSON</a>
          </div>
          <div className="panelHint" style={{ marginTop: 12 }}>
            Research validation notebook available separately.{' '}
            <a href="https://github.com/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">Open validation notebook</a>
          </div>
        </div>
        <div className="card">
          <h3>Responsible use</h3>
          <p className="muted">Retainly is decision-support only. Use supportive wording such as manager check-ins, stay interviews, workload review, and growth conversations.</p>
          <h4>How to read the report</h4>
          {s.results.insights?.length ? (
            <ul>
              {s.results.insights.slice(0, 4).map((item: string, index: number) => <li key={index}>{item}</li>)}
            </ul>
          ) : (
            <p className="muted">Run analysis first to view this section.</p>
          )}
        </div>
      </div>
    </div>
  );
}
