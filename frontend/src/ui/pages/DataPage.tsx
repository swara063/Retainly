import React from 'react';
import { useAppState } from '../state';

function TopTable({ title, rows }: { title: string; rows: { key: string; value: any }[] }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {!rows.length ? (
        <p className="muted">Not available.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td><b>{r.key}</b></td>
                <td>{String(r.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function DataPage() {
  const s = useAppState();
  if (!s.results) {
    return (
      <div className="page">
        <div className="card">
          <h3>Data & EDA</h3>
          <p className="muted">Run an analysis first (go to Run).</p>
        </div>
      </div>
    );
  }

  const mapping = s.results.column_mapping || {};
  const eda = s.results.eda || {};
  const missingPct: Record<string, any> = eda.missing_percentage || {};
  const topMissing = Object.entries(missingPct)
    .sort((a: any, b: any) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 10)
    .map(([k, v]) => ({ key: k, value: `${v}%` }));

  const targetDist: Record<string, any> = eda.target_distribution || {};
  const distRows = Object.entries(targetDist).map(([k, v]) => ({ key: k, value: v }));

  return (
    <div className="page">
      <div className="grid two">
        <div className="card">
          <h3>Smart import details</h3>
          <p className="muted">A quick summary of the employee signals Retainly used for the retention review.</p>
          <table className="table">
            <tbody>
              <tr><td><b>Attrition outcome</b></td><td>{mapping.target || '—'}</td></tr>
              <tr><td><b>Employee signals</b></td><td>{(mapping.numeric_features || []).join(', ') || '—'}</td></tr>
              <tr><td><b>Context fields</b></td><td>{(mapping.categorical_features || []).slice(0, 20).join(', ') || '—'}</td></tr>
              <tr><td><b>Fairness checks</b></td><td>{(mapping.sensitive_attributes || []).join(', ') || '—'}</td></tr>
            </tbody>
          </table>
          <details className="detailsBox">
            <summary>Show technical details</summary>
            <pre className="pre">{JSON.stringify(mapping, null, 2)}</pre>
          </details>
        </div>

        <TopTable title="Attrition distribution" rows={distRows} />
      </div>

      <div className="grid two">
        <TopTable title="Top missing fields (by %)" rows={topMissing} />
        <div className="card">
          <h3>EDA details</h3>
          <p className="muted">A technical appendix for deeper review if the HR team wants to inspect the underlying summary.</p>
          <details className="detailsBox">
            <summary>Show EDA JSON</summary>
            <pre className="pre">{JSON.stringify(eda, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}
