import React from 'react';
import { useAppState } from '../state';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

export default function OverviewPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <div className="page"><h2>Hotspots</h2><Empty text={hasUploadedDataset ? 'Run analysis first to view this section.' : 'Upload HR data and run retention analysis to view this section.'} /></div>;
  }

  const topRiskSegments = Array.isArray(s.results.risk_segments) ? [...s.results.risk_segments].sort((a, b) => Number(b.average_predicted_risk || 0) - Number(a.average_predicted_risk || 0)) : [];
  const departments = topRiskSegments.filter((r: any) => String(r.segment_name) === 'Department').slice(0, 5);
  const roles = topRiskSegments.filter((r: any) => String(r.segment_name) === 'JobRole').slice(0, 5);
  const patterns = [
    { label: 'Overtime', value: topRiskSegments.find((r: any) => /over/i.test(String(r.group || '')))?.group },
    { label: 'Job satisfaction', value: topRiskSegments.find((r: any) => /satisfaction/i.test(String(r.group || '')))?.group },
    { label: 'Tenure', value: topRiskSegments.find((r: any) => /year|tenure/i.test(String(r.group || '')))?.group },
    { label: 'Work-life balance', value: topRiskSegments.find((r: any) => /work.?life/i.test(String(r.group || '')))?.group },
  ].filter((item) => item.value);

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Hotspots</h2>
          <p className="muted">Segment-level retention risk only.</p>
        </div>
      </div>
      <div className="grid two">
        <div className="card">
          <h3>Department hotspots</h3>
          {departments.length ? departments.map((r: any) => <div className="panelHint" key={`${r.segment_name}-${r.group}`}><b>{r.group}</b> — {Math.round(Number(r.average_predicted_risk || 0) * 100)}%</div>) : <Empty text="No department hotspot data available." />}
        </div>
        <div className="card">
          <h3>Role hotspots</h3>
          {roles.length ? roles.map((r: any) => <div className="panelHint" key={`${r.segment_name}-${r.group}`}><b>{r.group}</b> — {Math.round(Number(r.average_predicted_risk || 0) * 100)}%</div>) : <Empty text="No role hotspot data available." />}
        </div>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>Workload / overtime patterns</h3>
          {patterns.length ? patterns.map((item) => <div className="panelHint" key={item.label}><b>{item.label}:</b> {String(item.value)}</div>) : <Empty text="No workload or overtime pattern available." />}
        </div>
        <div className="card">
          <h3>Satisfaction / tenure patterns</h3>
          <div className="panelHint">Review the segment groupings above to understand where retention support is concentrated.</div>
        </div>
      </div>
    </div>
  );
}
