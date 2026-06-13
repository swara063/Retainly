import React from 'react';
import { useAppState } from '../state';

export default function ModelPage() {
  const s = useAppState();
  return (
    <div className="page">
      <div className="card">
        <h3>Developer notes</h3>
        <p className="muted">{s.results ? 'Model details stay hidden from the normal HR view.' : 'Run analysis first to view this section.'}</p>
      </div>
    </div>
  );
}
