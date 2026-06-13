import React from 'react';
import { FileText } from 'lucide-react';
import { API_BASE } from '../api';
import { useAppState } from '../state';

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metricTile"><span>{label}</span><b>{value}</b></div>;
}

export default function OverviewPage() {
  const s = useAppState();
  if (!s.results) {
    return <div className="page"><div className="card"><b>Run analysis first to view your hotspots.</b></div></div>;
  }

  const exec = s.results.executive_summary || {};
  const topRiskSegments = Array.isArray(s.results.risk_segments) ? [...s.results.risk_segments].sort((a, b) => Number(b.average_predicted_risk || 0) - Number(a.average_predicted_risk || 0)) : [];
  const topRisk = topRiskSegments[0];
  const hotspots = topRiskSegments.slice(0, 5);

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Hotspots</h2>
          <p className="muted">Where retention risk is concentrated.</p>
        </div>
        <div className="btnRow single" style={{ maxWidth: 420 }}>
          <a className="download" href={`${API_BASE}/analysis/${s.datasetId}/report`}><FileText size={18} /> Download PDF report</a>
        </div>
      </div>
      <div className="grid two">
        <div className="card">
          <h3>Risk concentration</h3>
          <div className="metricGrid">
            <Metric label="Employees analyzed" value={String(exec.rows_analyzed ?? s.rows ?? '—')} />
            <Metric label="Highest-risk group" value={topRisk ? `${topRisk.segment_name}: ${topRisk.group}` : '—'} />
            <Metric label="Top risk driver" value={String((s.results.explainability?.top_features || [])[0]?.feature || '—')} />
            <Metric label="Data quality score" value={String(s.results.data_quality?.data_quality_score ?? '—')} />
          </div>
          <div className="panelHint">Top risk groups: {hotspots.map((r: any) => r.group).filter(Boolean).join(', ') || '—'}</div>
        </div>
        <div className="card">
          <h3>Hotspots list</h3>
          {hotspots.length ? (
            <ul>
              {hotspots.map((r: any, i: number) => <li key={i}><b>{r.segment_name}:</b> {r.group} ({Math.round(Number(r.average_predicted_risk || 0) * 100)}%)</li>)}
            </ul>
          ) : <p className="muted">Run analysis first to view this section.</p>}
        </div>
      </div>
    </div>
  );
}
