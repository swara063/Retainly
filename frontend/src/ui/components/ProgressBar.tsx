import React from 'react';

export default function ProgressBar({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="progress">
      <div className="bar">
        <div className="fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="muted">{label || `${pct}%`}</div>
    </div>
  );
}

