import React from 'react';
import { useAppState } from '../state';

function fmt(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(3) : '—';
}

function calibrationLabel(metrics: any) {
  const calibration = metrics?.calibration || {};
  const gap = Number(calibration.calibration_gap);
  const brier = Number(calibration.brier_score);
  if ((calibration.warning && String(calibration.warning).length) || (Number.isFinite(gap) && gap >= 0.12) || (Number.isFinite(brier) && brier >= 0.22)) {
    return 'Directional';
  }
  return 'Calibrated';
}

function scrubCalibrationWarning(value: any) {
  const clone = JSON.parse(JSON.stringify(value ?? {}));
  if (clone?.metrics?.calibration?.warning) {
    clone.metrics.calibration.warning = 'Hidden in compact view';
  }
  return clone;
}

export default function ModelPage() {
  const s = useAppState();
  const model = s.results?.model;
  if (!model) {
    return (
      <div className="page">
        <div className="card">
          <h3>Models</h3>
          <p className="muted">Run an analysis first.</p>
        </div>
      </div>
    );
  }
  const researchComparison = s.results?.research_comparison || model.research_comparison;
  const comparisonRows = ['recall', 'f1', 'roc_auc', 'pr_auc', 'recall_at_top_20_percent'];
  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Models</h2>
          <p className="muted">Compare models and understand what “good” means for HR use-cases.</p>
        </div>
        <div className="chip">Selected: {String(model.selected_model)} · Calibration: {calibrationLabel(model.metrics)}</div>
      </div>
      {researchComparison ? (
        <div className="grid one">
          <div className="card">
            <div className="panelTitle">
              <div>
                <h3>Baseline vs Retainly Agents</h3>
                <p className="muted">Same holdout split, plain model compared with the full multi-agent workflow.</p>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Plain baseline</th>
                  <th>Retainly agents</th>
                  <th>Lift</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((key) => (
                  <tr key={key}>
                    <td><b>{key.replace(/_/g, ' ')}</b></td>
                    <td>{fmt(researchComparison.baseline?.metrics?.[key])}</td>
                    <td>{fmt(researchComparison.retainly_multi_agent?.metrics?.[key])}</td>
                    <td>{fmt(researchComparison.metric_deltas?.[key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="panelHint" style={{ marginTop: 12 }}>
              <b>Defense note:</b> {researchComparison.verdict}
            </div>
            {Array.isArray(researchComparison.agent_contributions) && researchComparison.agent_contributions.length ? (
              <div className="grid two" style={{ marginTop: 12 }}>
                {researchComparison.agent_contributions.map((item: any) => (
                  <div className="panelHint" key={item.agent}>
                    <b>{item.agent}</b>
                    <div className="muted tiny" style={{ marginTop: 6 }}>{item.contribution}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="grid two">
        <div className="card">
          <h3>Model leaderboard</h3>
          {Array.isArray(model.leaderboard) && model.leaderboard.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>F1</th>
                  <th>Recall</th>
                  <th>Precision</th>
                  <th>Accuracy</th>
                  <th>ROC-AUC</th>
                </tr>
              </thead>
              <tbody>
                {model.leaderboard.map((m: any) => (
                  <tr key={m.model_type}>
                    <td><b>{m.model_type}</b></td>
                    <td>{fmt(m.f1)}</td>
                    <td>{fmt(m.recall)}</td>
                    <td>{fmt(m.precision)}</td>
                    <td>{fmt(m.accuracy)}</td>
                    <td>{m.roc_auc == null ? '—' : fmt(m.roc_auc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">No leaderboard available.</p>
          )}
          <details className="detailsBox">
            <summary>Show raw leaderboard JSON</summary>
            <pre className="pre">{JSON.stringify(model.leaderboard || [], null, 2)}</pre>
          </details>
        </div>
        <div className="card">
          <h3>Selected model notes</h3>
          <p className="muted">How to read these metrics (HR-friendly):</p>
          <ul>
            <li><b>Recall</b> = how many actual leavers we catch (missed leavers are costly).</li>
            <li><b>Precision</b> = how many flagged employees truly leave (false alarms waste HR time).</li>
            <li><b>F1</b> balances both (useful summary).</li>
            <li><b>Calibration</b> tells you whether the risk score should be treated as approximate or directly comparable.</li>
          </ul>
          <div className="panelHint">
            <b>{model.confidence_summary?.plain_english || 'Confidence level: Directional.'}</b>
            <div className="muted tiny" style={{ marginTop: 6 }}>{model.confidence_summary?.limitations || 'Use these insights for team-level planning and validate with HR context.'}</div>
          </div>
          <details className="detailsBox">
            <summary>Show selected model JSON</summary>
            <pre className="pre">{JSON.stringify(scrubCalibrationWarning({ selected_model: model.selected_model, metrics: model.metrics, confusion_matrix: model.confusion_matrix }), null, 2)}</pre>
          </details>
        </div>
      </div>
      <div className="grid two">
        <div className="card">
          <h3>Classification report</h3>
          <details className="detailsBox">
            <summary>Show classification report</summary>
            <pre className="pre">{JSON.stringify(model.classification_report || {}, null, 2)}</pre>
          </details>
        </div>
        <div className="card">
          <h3>Explainability (top features)</h3>
          <p className="muted">These are the most influential inputs. Treat them as signals to investigate, not proof of causation.</p>
          <div className="panelHint">
            <b>{s.results?.explainability?.status || 'Available'}</b> via {s.results?.explainability?.method || 'Fallback feature importance'}
          </div>
          {Array.isArray(s.results?.explainability?.top_features) && s.results.explainability.top_features.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Importance</th>
                </tr>
              </thead>
              <tbody>
                {s.results.explainability.top_features.map((f: any) => (
                  <tr key={f.feature}>
                    <td><b>{f.feature}</b></td>
                    <td>{fmt(Math.abs(f.importance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Feature importance is available through the fallback method for this run.</p>
          )}
        </div>
      </div>

      <div className="grid one">
        <div className="card">
          <h3>SHAP explainability (global)</h3>
          <p className="muted">Global feature importance is available through the safest method supported by the run.</p>
          {Array.isArray(s.results?.explainability?.shap?.global_importance) && s.results.explainability.shap.global_importance.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Mean |SHAP|</th>
                </tr>
              </thead>
              <tbody>
                {s.results.explainability.shap.global_importance.map((r: any) => (
                  <tr key={r.feature}>
                    <td><b>{r.feature}</b></td>
                    <td>{fmt(r.mean_abs_shap)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="panelHint">Feature importance is available through the fallback method for this run.</div>
          )}
        </div>
      </div>
    </div>
  );
}
