import React from 'react';
import { Download } from 'lucide-react';
import { API_BASE } from '../api';
import { useAppState } from '../state';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

export default function RunPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  const [reportAvailable, setReportAvailable] = React.useState(false);
  const [reportChecked, setReportChecked] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function check() {
      setReportChecked(false);
      setReportAvailable(false);
      if (!hasValidResults || !s.datasetId) {
        setReportChecked(true);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/analysis/${s.datasetId}/report`, { method: 'HEAD' });
        if (!cancelled) setReportAvailable(res.ok);
      } catch {
        if (!cancelled) setReportAvailable(false);
      } finally {
        if (!cancelled) setReportChecked(true);
      }
    }
    void check();
    return () => { cancelled = true; };
  }, [hasValidResults, s.datasetId]);

  if (!hasUploadedDataset) {
    return <div className="page"><h2>Report</h2><Empty text="Upload HR data and run retention analysis to generate a report." /></div>;
  }

  if (s.phase === 'uploaded') {
    return <div className="page"><h2>Report</h2><Empty text="Upload complete. Run retention analysis to generate the report." /></div>;
  }

  if (s.phase === 'analyzing' || s.phase === 'uploading') {
    return <div className="page"><h2>Report</h2><Empty text="Report will be available after analysis completes." /></div>;
  }

  if (!hasValidResults) {
    return <div className="page"><h2>Report</h2><Empty text={hasUploadedDataset ? 'Run analysis first to view this section.' : 'Upload HR data and run retention analysis to generate a report.'} /></div>;
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
        {!reportChecked ? <div className="panelHint" style={{ marginTop: 12 }}>Checking report availability...</div> : null}
        {reportChecked && !reportAvailable ? <div className="panelError" style={{ marginTop: 12 }}>Analysis completed but report file was not returned.</div> : null}
        <div className="btnRow" style={{ marginTop: 12 }}>
          {reportAvailable ? <a className="download" href={`${API_BASE}/analysis/${s.datasetId}/report`}><Download size={18} /> PDF report</a> : null}
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
