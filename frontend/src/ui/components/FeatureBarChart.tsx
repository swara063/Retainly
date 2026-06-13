import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Feature = { feature: string; importance: number };

function toData(features: any[]): Feature[] {
  if (!Array.isArray(features)) return [];
  return features
    .map((f: any) => ({
      feature: String(f?.feature ?? ''),
      importance: Math.abs(Number(f?.importance ?? 0)),
    }))
    .filter((x) => x.feature && Number.isFinite(x.importance))
    .slice(0, 12);
}

export default function FeatureBarChart({ features }: { features: any[] }) {
  const data = toData(features);
  if (!data.length) return <p className="muted">Top feature signals will appear after explainability runs.</p>;

  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 18, top: 6, bottom: 6 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,.08)" />
          <XAxis type="number" tick={{ fill: '#46556d', fontSize: 12 }} />
          <YAxis type="category" dataKey="feature" width={160} tick={{ fill: '#334155', fontSize: 12 }} />
          <Tooltip contentStyle={{ borderRadius: 14, borderColor: 'rgba(15,23,42,.10)' }} />
          <Bar dataKey="importance" fill="rgba(49, 85, 212, .85)" radius={[10, 10, 10, 10]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

