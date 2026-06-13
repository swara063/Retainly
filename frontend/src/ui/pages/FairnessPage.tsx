import React from 'react';
import { useAppState } from '../state';

function chipClass(risk: string) {
  const r = String(risk || '').toLowerCase();
  if (r.includes('high')) return 'chip high';
  if (r.includes('moderate')) return 'chip mod';
  if (r.includes('low')) return 'chip low';
  return 'chip';
}

function pct(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '—';
}

export default function FairnessPage() {
  const s = useAppState();
  const fairness = s.results?.fairness;
  if (!fairness) {
    return (
      <div className="page">
        <div className="card">
          <h3>Fairness</h3>
          <p className="muted">Run an analysis first.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Fairness checks</h2>
          <p className="muted">Shows whether employee signals behave very differently across groups that need careful review.</p>
        </div>
        <div className={chipClass(fairness.overall_risk)}>Overall risk: {String(fairness.overall_risk)}</div>
      </div>
      <div className="grid two">
        <div className="card">
          <h3>Fairness summary</h3>
          <p className="muted">{fairness.ethical_disclaimer}</p>
          <table className="table">
            <tbody>
              <tr><td><b>Audited attributes</b></td><td>{(fairness.audited_attributes || []).join(', ') || '—'}</td></tr>
            </tbody>
          </table>
          <div className="panelHint">{fairness.ethical_disclaimer}</div>
          <details className="detailsBox">
            <summary>Show raw fairness JSON</summary>
            <pre className="pre">{JSON.stringify(fairness || {}, null, 2)}</pre>
          </details>
        </div>
        <div className="card">
          <h3>Group-wise audits</h3>
          {fairness.attribute_audits && Object.keys(fairness.attribute_audits).length ? (
            Object.entries(fairness.attribute_audits).map(([attr, audit]: any) => (
              <div key={attr} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <b>{attr}</b>
                  <span className={chipClass(audit.risk_level)}>{String(audit.risk_level)}</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  Prediction-rate gap: {pct(audit.prediction_rate_gap)} · False-positive gap: {pct(audit.false_positive_rate_gap)}
                </div>
                <table className="table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Group</th>
                      <th>Count</th>
                      <th>Pred rate</th>
                      <th>FPR</th>
                      <th>FNR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(audit.groups || []).map((g: any) => (
                      <tr key={g.group}>
                        <td><b>{g.group}</b></td>
                        <td>{g.count}</td>
                        <td>{pct(g.prediction_rate)}</td>
                        <td>{pct(g.false_positive_rate)}</td>
                        <td>{pct(g.false_negative_rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          ) : (
            <p className="muted">No fairness-check fields were available to review.</p>
          )}
        </div>
      </div>
    </div>
  );
}
