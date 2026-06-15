import React from 'react';
import { useAppState } from '../state';
import { EmptyState, PageShell, SectionCard } from '../components/PageLayout';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

export default function OverviewPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <PageShell title="Hotspots" subtitle="Risk concentration by department, role, workload, satisfaction, and tenure."><EmptyState title="Run analysis first to view this section." description={hasUploadedDataset ? 'Hotspot analysis will appear after analysis completes.' : 'Upload HR data to begin hotspot analysis.'} /></PageShell>;
  }

  const topRiskSegments = Array.isArray(s.results.risk_segments) ? [...s.results.risk_segments].sort((a, b) => Number(b.average_predicted_risk || 0) - Number(a.average_predicted_risk || 0)) : [];
  const departments = topRiskSegments.filter((r: any) => String(r.segment_name) === 'Department').slice(0, 5);
  const roles = topRiskSegments.filter((r: any) => String(r.segment_name) === 'JobRole').slice(0, 5);
  const workloadPatterns = topRiskSegments.filter((r: any) => String(r.segment_name) === 'OverTime').slice(0, 3);
  const experiencePatterns = topRiskSegments.filter((r: any) => ['JobSatisfaction', 'YearsAtCompany'].includes(String(r.segment_name))).slice(0, 4);

  return (
    <PageShell title="Hotspots" subtitle="Risk concentration by department, role, workload, satisfaction, and tenure.">
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
          {workloadPatterns.length ? workloadPatterns.map((item: any) => <div className="panelHint" key={`${item.segment_name}-${item.group}`}><b>{item.segment_name}:</b> {String(item.group)} — {Math.round(Number(item.average_predicted_risk || 0) * 100)}%</div>) : <Empty text="No workload or overtime pattern available." />}
        </div>
        <div className="card">
          <h3>Satisfaction / tenure patterns</h3>
          {experiencePatterns.length ? experiencePatterns.map((item: any) => <div className="panelHint" key={`${item.segment_name}-${item.group}`}><b>{item.segment_name}:</b> {String(item.group)} — {Math.round(Number(item.average_predicted_risk || 0) * 100)}%</div>) : <div className="panelHint">Review the segment groupings above to understand where retention support is concentrated.</div>}
        </div>
      </div>
    </PageShell>
  );
}
