import React from 'react';
import { useAppState } from '../state';
import { API_BASE, fetchJson } from '../api';

type Msg = { role: 'user' | 'assistant'; text: string; sources?: string[] };

function riskChip(risk: string) {
  const r = String(risk || '').toLowerCase();
  if (r.includes('high')) return 'chip high';
  if (r.includes('moderate')) return 'chip mod';
  if (r.includes('low')) return 'chip low';
  return 'chip';
}

export default function ChatPage() {
  const s = useAppState();
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([]);

  async function send() {
    const q = input.trim();
    if (!q || !hasValidResults) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: 'Thinking…' }]);
    setSending(true);
    try {
      const data = await fetchJson<{ answer: string; sources?: string[] }>(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, dataset_id: s.datasetId || null }),
      });
      setMsgs((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant' && last.text === 'Thinking…') copy[copy.length - 1] = { role: 'assistant', text: data.answer || '(No answer)', sources: data.sources || [] };
        return copy;
      });
    } catch (e: any) {
      setMsgs((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        const msg = e?.message || 'Chat failed.';
        if (last?.role === 'assistant' && last.text === 'Thinking…') copy[copy.length - 1] = { role: 'assistant', text: `Retainly Help could not reach the assistant service just now. Try again, or use the dashboard insights and action plan already generated.` };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  const fairness = hasValidResults ? (s.results?.fairness?.overall_risk || '—') : '—';

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h2>Help Chat</h2>
          <p className="muted">Plain-language explanations for HR stakeholders.</p>
        </div>
        <div className={riskChip(fairness)} title="Current fairness risk (from the latest run)">Fairness: {String(fairness)}</div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}><b>{hasValidResults ? 'Retainly Help is ready.' : (hasUploadedDataset ? 'Run analysis first to use the chatbot.' : 'Upload HR data and run retention analysis to view this section.')}</b></div>
      <div className="chat">
        <div className="chatLog">
          {msgs.map((m, i) => (
            <div className={`msg ${m.role}`} key={i}>
              <div className="who">{m.role === 'user' ? 'You' : 'Retainly'}</div>
              <div className="bubble">
                <div>{m.text}</div>
                {m.role === 'assistant' && Array.isArray(m.sources) && m.sources.length ? (
                  <div className="chatSources">
                    <div className="chatSourcesLabel">Sources used</div>
                    <ul>
                      {m.sources.map((source, index) => <li key={index}>{source}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="chatInputRow">
          <input
            className="chatInput"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasValidResults ? 'Ask about the current analysis' : 'Run analysis first to ask questions'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            disabled={!hasValidResults}
          />
          <button className="primary" onClick={send} disabled={sending || !hasValidResults}>Send</button>
        </div>
      </div>
    </div>
  );
}
