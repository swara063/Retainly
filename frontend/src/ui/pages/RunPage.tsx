import React from 'react';
import { Download } from 'lucide-react';
import { API_BASE } from '../api';
import { useAppState } from '../state';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

export default function RunPage() {
  const s = useAppState();
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <div className="page"><h2>Report</h2><Empty text="Run analysis to generate a report." /></div>;
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Report</h2>
          <p className="muted">Download and export only.</p>
        </div>
      </div>
      <div className="card">
        <h3>Downloads</h3>
        <div className="btnRow" style={{ marginTop: 12 }}>
          <a className="download" href={`${API_BASE}/analysis/${s.datasetId}/report`}><Download size={18} /> PDF report</a>
          <a className="download secondary" href={`${API_BASE}/analysis/${s.datasetId}/results.json`}><Download size={18} /> Results JSON</a>
        </div>
        <div className="panelHint" style={{ marginTop: 12 }}>This report is for retention-support planning, not automatic employment decisions.</div>
        <div className="panelHint" style={{ marginTop: 8 }}>
          Research validation notebook available separately.{' '}
          <a href="https://github.com/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">Open validation notebook</a>
        </div>
      </div>
    </div>
  );
}
