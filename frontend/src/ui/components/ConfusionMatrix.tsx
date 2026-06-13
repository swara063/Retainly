import React from 'react';

function normalizeMatrix(matrix: any): number[][] | null {
  if (!matrix) return null;
  if (Array.isArray(matrix) && Array.isArray(matrix[0])) return matrix.map((r: any[]) => r.map((x) => Number(x)));
  if (typeof matrix === 'object' && Array.isArray(matrix.matrix)) return normalizeMatrix(matrix.matrix);
  return null;
}

export default function ConfusionMatrix({ matrix }: { matrix: any }) {
  const m = normalizeMatrix(matrix);
  if (!m) return <p className="muted">Confusion matrix will appear after model evaluation.</p>;

  const flat = m.flat().filter((x) => Number.isFinite(x));
  const max = flat.length ? Math.max(...flat) : 1;

  return (
    <div className="cm">
      <div className="cmGrid" style={{ gridTemplateColumns: `repeat(${m[0]?.length || 2}, 1fr)` }}>
        {m.map((row, i) =>
          row.map((val, j) => {
            const v = Number.isFinite(val) ? val : 0;
            const pct = Math.max(0, Math.min(1, max ? v / max : 0));
            return (
              <div key={`${i}-${j}`} className="cmCell" style={{ background: `rgba(49, 85, 212, ${0.08 + 0.22 * pct})` }}>
                <b>{Number.isFinite(val) ? String(val) : '—'}</b>
                <span className="muted tiny">{i},{j}</span>
              </div>
            );
          }),
        )}
      </div>
      <div className="muted tiny" style={{ marginTop: 8 }}>Rows = actual, columns = predicted (when available).</div>
    </div>
  );
}

