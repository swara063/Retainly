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

  const actionCards = (Array.isArray(s.results.retention_plan) ? s.results.retention_plan : []).slice(0, 8);

  return (
    <PageShell title="Action Plan" subtitle="Only HR action cards.">
      <div className="pageHeader">
        <div>
          <h2>Action Plan</h2>
          <p className="muted">Full HR action plan only.</p>
        </div>
      </div>
      <div className="grid one">
        {actionCards.map((item: any, index: number) => (
          <div className="card" key={index}>
            <div className="panelTitle">
              <b>Priority {String(item.priority || 'Medium')}</b>
              <div className="muted">Target group, why it matters, action, timeline, success metric</div>
            </div>
            <div className="panelHint"><b>Target group:</b> {String(item.target_segment || 'Review highest-risk segments')}</div>
            <div className="panelHint"><b>Why it matters:</b> {String(item.reason || item.why_it_matters || 'Review this segment with HR context.')}</div>
            <div className="panelHint"><b>Action:</b> {String(item.recommended_action || 'Use this recommendation as a supportive retention intervention.')}</div>
            <div className="panelHint"><b>Timeline:</b> {String(item.timeline || '30 days')}</div>
            <div className="panelHint"><b>Success metric:</b> {String(item.success_metric || 'Fewer high-risk employees in the next review cycle.')}</div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
