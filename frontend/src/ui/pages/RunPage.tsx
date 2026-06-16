import React from 'react';
import { Download } from 'lucide-react';
import { API_BASE } from '../api';
import { useAppState } from '../state';
import { EmptyState, PageShell } from '../components/PageLayout';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

export default function RunPage() {
  const s = useAppState();
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <PageShell title="Report" subtitle="Download and export options."><EmptyState title="Run analysis to generate a report." description="The report downloads will appear after analysis completes." /></PageShell>;
  }

  return (
    <PageShell title="Report" subtitle="Download and export options.">
      <div className="card">
        <h3>Downloads</h3>
        <div className="btnRow" style={{ marginTop: 12 }}>
          <a className="download" href={`${API_BASE}/analysis/${s.datasetId}/report`}><Download size={18} /> PDF report</a>
          <a className="download secondary" href={`${API_BASE}/analysis/${s.datasetId}/results.json`}><Download size={18} /> Results JSON</a>
        </div>
        <div className="panelHint" style={{ marginTop: 12 }}>This report is for retention-support planning, not automatic employment decisions. Retention risk signal is a directional model score for retention planning, not a guaranteed probability of resignation.</div>
        <div className="panelHint" style={{ marginTop: 8 }}>
          Research validation notebook available separately.{' '}
          <a href="https://github.com/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">Open validation notebook</a>
        </div>
      </div>
    </PageShell>
  );
}
