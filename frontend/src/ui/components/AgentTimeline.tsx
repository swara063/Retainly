import React from 'react';
import type { HRTimelineEntry } from '../state';

function tone(status: string) {
  const s = String(status || '').toLowerCase();
  if (s.includes('review')) return 'warn';
  if (s.includes('completed')) return 'ok';
  return 'muted';
}

export default function AgentTimeline({ items }: { items: HRTimelineEntry[] }) {
  if (!items.length) return <p className="muted">No HR timeline available yet. Upload and analyze to see the workflow stages.</p>;
  return (
    <div className="agentTimeline">
      {items.map((item, index) => (
        <div className="agentBlock" key={`${item.step}-${index}`}>
          <div className="agentHeader">
            <div className="agentName">
              <b>{item.step}</b>
              <span className={`agentStatus ${tone(item.status)}`}>{item.status}</span>
            </div>
          </div>
          <div className="agentSteps">
            <div className="agentStep">
              <div className={`dot ${tone(item.status)}`} />
              <div className="stepBody">
                <div className="stepTop">
                  <span className="stepMsg">{item.message || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
