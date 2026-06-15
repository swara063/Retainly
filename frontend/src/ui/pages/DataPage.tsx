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
          <SectionCard key={index} title={String(item.title || `Action ${index + 1}`)} subtitle="Supportive HR action card">
            <div className="actionMetaRow">
              <span className={`priorityTag ${String(item.priority || 'Medium').toLowerCase() === 'high' ? 'high' : String(item.priority || 'Medium').toLowerCase() === 'medium' ? 'medium' : 'low'}`}>{String(item.priority || 'Medium')}</span>
              <span className="muted tiny">Target group: {String(item.target_segment || 'Review highest-risk segments')}</span>
            </div>
            <div className="actionCardGrid">
              <div className="actionField"><b>Why it matters</b><p>{String(item.reason || item.why_it_matters || 'Review this segment with HR context.')}</p></div>
              <div className="actionField"><b>Recommended action</b><p>{String(item.recommended_action || 'Use this recommendation as a supportive retention intervention.')}</p></div>
              <div className="actionField"><b>Timeline</b><p>{String(item.timeline || '30 days')}</p></div>
              <div className="actionField"><b>Success metric</b><p>{String(item.success_metric || 'Fewer high-risk employees in the next review cycle.')}</p></div>
            </div>
          </SectionCard>
        ))}
      </div>
    </PageShell>
  );
}
