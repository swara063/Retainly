import React from 'react';
import { useAppState } from '../state';
import { EmptyState, PageShell, SectionCard } from '../components/PageLayout';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

export default function DataPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <PageShell title="Action Plan" subtitle="Only HR action cards."><EmptyState title="Run analysis first to view this section." description={hasUploadedDataset ? 'Action cards will appear after analysis completes.' : 'Upload HR data to generate the action plan.'} /></PageShell>;
  }

  const recommendations: string[] = s.results.recommendations || [];
  const actionCards = (recommendations.length ? recommendations : ['Review the generated results after analysis.']).slice(0, 8);
  const priorities = ['High', 'Medium', 'Low'];

  return (
    <PageShell title="Action Plan" subtitle="Only HR action cards.">
      <div className="pageHeader">
        <div>
          <h2>Action Plan</h2>
          <p className="muted">Full HR action plan only.</p>
        </div>
      </div>
      <div className="grid one">
        {actionCards.map((item, index) => (
          <div className="card" key={index}>
            <div className="panelTitle">
              <b>Priority {priorities[index] || 'Low'}</b>
              <div className="muted">Target group, why it matters, action, timeline, success metric</div>
            </div>
            <div className="panelHint"><b>Target group:</b> {String(s.results.risk_segments?.[index]?.group || 'Review highest-risk segments')}</div>
            <div className="panelHint"><b>Why it matters:</b> {String(item)}</div>
            <div className="panelHint"><b>Action:</b> Use this recommendation as a supportive retention intervention.</div>
            <div className="panelHint"><b>Timeline:</b> 30 days</div>
            <div className="panelHint"><b>Success metric:</b> Fewer high-risk employees in the next review cycle.</div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
