import React from 'react';
import { useAppState } from '../state';
import { API_BASE, fetchJson } from '../api';

type Msg = { role: 'user' | 'assistant'; text: string };

function riskChip(risk: string) {
  const r = String(risk || '').toLowerCase();
  if (r.includes('high')) return 'chip high';
  if (r.includes('moderate')) return 'chip mod';
  if (r.includes('low')) return 'chip low';
  return 'chip';
}

function buildLocalAnswer(question: string, results: any): string {
  const q = question.toLowerCase();
  const employees = Array.isArray(results?.employee_risk_records) ? results.employee_risk_records : [];
  const segments = Array.isArray(results?.risk_segments) ? results.risk_segments : [];
  const topEmployees = [...employees].sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0)).slice(0, 5);
  const topDept = segments.find((r: any) => String(r.segment_name) === 'Department');
  const topRole = segments.find((r: any) => String(r.segment_name) === 'JobRole');
  const actions = Array.isArray(results?.retention_plan) ? results.retention_plan : [];

  if (q.includes('which employees') || q.includes('most at risk')) {
    if (!topEmployees.length) return 'No employee risk list is available in this analysis.';
    return `Highest-risk employees: ${topEmployees.map((r: any) => r.employee_label || r.employee_id || `Row ${r.row_index}`).join(', ')}.`;
  }
  if (q.includes('which department') || q.includes('department needs attention')) {
    return topDept ? `The department needing attention most is ${topDept.group}, with average risk around ${Math.round(Number(topDept.average_predicted_risk || 0) * 100)}%.` : 'No department hotspot is available in this analysis.';
  }
  if (q.includes('what should hr do first')) {
    return actions.length ? `Start with: ${actions[0].title || 'the top action'} — ${actions[0].recommended_action || actions[0].action || 'review the recommended support step.'}` : 'Start with the top recommended action from the action plan and review the highest-risk employees first.';
  }
  if (q.includes('why are there no accuracy metrics')) {
    return 'Retainly is designed for risk screening and retention planning. If the uploaded dataset does not have a labeled attrition outcome, accuracy metrics are not available; instead, the workflow focuses on ranking, hotspots, and action planning.';
  }
  if (q.includes('how was this validated')) {
    return 'Retainly’s model workflow is validated separately in the research notebook using labeled benchmark attrition datasets. The website applies that validated workflow to current HR datasets for risk scoring and retention planning.';
  }
  if (q.includes('can this be used for firing')) {
    return 'No. Retainly is a decision-support tool for retention planning only. It should not be used as the sole basis for firing or any automatic employment decision.';
  }
  if (q.includes('role')) {
    return topRole ? `The role needing attention most is ${topRole.group}, with average risk around ${Math.round(Number(topRole.average_predicted_risk || 0) * 100)}%.` : 'No role hotspot is available in this analysis.';
  }
  return 'Based on the latest analysis, use the employee explorer, hotspots, and action plan to guide supportive HR follow-up.';
}

export default function ChatPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [usedGroq, setUsedGroq] = React.useState(false);

  React.useEffect(() => {
    setMsgs([]);
  }, [s.datasetId]);

  async function send() {
    const q = input.trim();
    if (!q || !hasValidResults || !s.datasetId) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: 'Thinking…' }]);
    setSending(true);
    try {
      const data = await fetchJson<{ answer?: string; sources?: string[]; groq_used?: boolean }>(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, dataset_id: s.datasetId, results: s.results }),
      });
      const answer = String(data?.answer || buildLocalAnswer(q, s.results));
      setUsedGroq(Boolean(data?.groq_used));
      setMsgs((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant' && last.text === 'Thinking…') copy[copy.length - 1] = { role: 'assistant', text: answer };
        return copy;
      });
    } catch {
      setUsedGroq(false);
      setMsgs((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant' && last.text === 'Thinking…') {
          copy[copy.length - 1] = { role: 'assistant', text: buildLocalAnswer(q, s.results) };
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  const fairness = hasValidResults ? (s.results?.fairness?.overall_risk || '—') : '—';

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Chatbot</h2>
          <p className="muted">Dataset Q&amp;A only after analysis.</p>
        </div>
        <div className={riskChip(fairness)}>Fairness: {String(fairness)}</div>
      </div>
      {!hasValidResults ? (
        <div className="card"><b>Retainly chatbot becomes available after analysis is complete.</b></div>
      ) : null}
      <div className="chat">
        <div className="chatLog">
          {msgs.map((m, i) => (
            <div className={`msg ${m.role}`} key={i}>
              <div className="who">{m.role === 'user' ? 'You' : 'Retainly'}</div>
              <div className="bubble"><div>{m.text}</div></div>
            </div>
          ))}
        </div>
        <div className="chatInputRow">
          <input
            className="chatInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasValidResults ? 'Ask about the current analysis' : 'Retainly chatbot becomes available after analysis is complete.'}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            disabled={!hasValidResults}
          />
          <button className="primary" onClick={send} disabled={!hasValidResults || sending}>Send</button>
        </div>
      </div>
      {usedGroq ? null : hasValidResults ? <div className="panelHint" style={{ marginTop: 12 }}>Retainly fallback chatbot is active.</div> : null}
    </div>
  );
}
