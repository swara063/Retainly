import React from 'react';
import { useAppState } from '../state';
import { PageShell } from '../components/PageLayout';
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

  if (!results) {
    if (q.includes('what is retainly')) {
      return 'Retainly is an HR retention intelligence app that scores employee attrition risk, surfaces hotspots, and helps HR plan supportive interventions.';
    }
    if (q.includes('multi-agent') || q.includes('workflow')) {
      return 'Retainly uses a multi-agent workflow to handle upload checks, data analysis, model selection, explainability, fairness review, insights, and report generation.';
    }
    if (q.includes('what kind of csv') || q.includes('upload')) {
      return 'Upload a CSV with employee-level HR data. A labeled attrition/outcome column is best for evaluation; if it is missing, Retainly can still score risk.';
    }
    if (q.includes('accuracy metrics') || q.includes('no accuracy')) {
      return 'If the uploaded dataset is unlabeled, Retainly cannot calculate accuracy-style metrics. It focuses on risk scoring, ranking, hotspots, and action planning.';
    }
    if (q.includes('validated') || q.includes('how is the model validated') || q.includes('where is the validation notebook')) {
      return 'Retainly’s workflow is validated separately in the research notebook using labeled benchmark attrition datasets. You can open the notebook in Colab from the Validation page.';
    }
    if (q.includes('difference between website and notebook')) {
      return 'The website is the HR product for risk scoring and planning. The notebook is the separate validation workspace used to reproduce benchmark training, metrics, charts, and review results.';
    }
    if (q.includes('firing')) {
      return 'No. Retainly is a decision-support tool for retention planning only and should not be used as the sole basis for firing or any automatic employment action.';
    }
    return 'Ask general questions about Retainly, the workflow, datasets, validation, or how to use the app. Dataset-specific answers become available after analysis.';
  }

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
  if (q.includes('employee ') || q.match(/\b\d+\b/) || q.includes('name')) {
    const needle = q.replace(/[^\w\s]/g, ' ').trim();
    const found = employees.find((r: any) => {
      const hay = `${r.employee_id || ''} ${r.employee_name || ''} ${r.display_label || ''}`.toLowerCase();
      return needle.split(/\s+/).filter(Boolean).some((part) => hay.includes(part));
    });
    if (!found) return 'I could not find that employee in the latest analysis results.';
    const factors = Array.isArray(found.top_risk_factors) ? found.top_risk_factors.join('; ') : '—';
    return [
      `EmployeeID / EmployeeName: ${found.employee_id || '—'} / ${found.employee_name || found.display_label || '—'}`,
      `risk_signal: ${Math.round(Number(found.risk_score || 0) * 100)}`,
      `priority_level: ${found.priority_level || found.risk_band || '—'}`,
      `priority_rank: ${found.priority_tier || '—'}`,
      `department: ${found.department || '—'}`,
      `role: ${found.job_role || '—'}`,
      `top factors: ${factors}`,
      `suggested support action: ${found.recommended_support_action || 'Review with the manager and plan a supportive check-in.'}`,
    ].join('\n');
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
  const suggestedQuestions = hasValidResults
    ? [
        'Which employees are most at risk?',
        'What hotspots were found?',
        'What should HR do first?',
        'Explain the action plan.',
        'What does the report say?',
        'Can this be used for firing?',
      ]
    : [
        'What is Retainly?',
        'What kind of CSV should I upload?',
        'How is the model validated?',
        'Can this be used for firing?',
      ];

  React.useEffect(() => {
    setMsgs([]);
  }, [s.datasetId]);

  async function send(prefilled?: string) {
    const q = (prefilled ?? input).trim();
    if (!q) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: 'Thinking…' }]);
    setSending(true);
    try {
      const canUseDataset = hasValidResults && s.datasetId;
      const payload = canUseDataset ? { question: q, dataset_id: s.datasetId, results: s.results } : { question: q, dataset_id: null, results: null };
      let answer = buildLocalAnswer(q, canUseDataset ? s.results : null);
      if (canUseDataset) {
        try {
          const data = await fetchJson<{ answer?: string }>(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          answer = String(data?.answer || answer);
        } catch {
          answer = buildLocalAnswer(q, s.results);
        }
      }
      setMsgs((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant' && last.text === 'Thinking…') copy[copy.length - 1] = { role: 'assistant', text: answer };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  const fairness = hasValidResults ? (s.results?.fairness?.overall_risk || '—') : '—';

  return (
    <PageShell title="Chatbot" subtitle="General Q&A before analysis; dataset-specific Q&A after analysis.">
      <div className="pageHeader">
        <div>
          <h2>Chatbot</h2>
          <p className="muted">Ask general questions about Retainly, the workflow, datasets, validation, or how to use the app. Dataset-specific answers become available after analysis.</p>
        </div>
        <div className={riskChip(fairness)}>Fairness: {String(fairness)}</div>
      </div>
      <div className="card chatIntroCard" style={{ marginBottom: 12 }}>
        <b>{hasValidResults ? 'Dataset-specific answers are available for the latest analysis.' : 'Ask general questions about Retainly, the workflow, datasets, validation, or how to use the app. Dataset-specific answers become available after analysis.'}</b>
      </div>
      <div className="chipRow" style={{ marginBottom: 12 }}>
        {suggestedQuestions.map((question) => (
          <button key={question} className="ghostToggle" type="button" onClick={() => send(question)} disabled={sending}>
            {question}
          </button>
        ))}
      </div>
      <div className="chat compact">
        <div className="chatLog">
          {!msgs.length ? <div className="chatStarter"><b>Start here</b><p>Ask about employees, hotspots, actions, report findings, validation, or responsible use.</p></div> : null}
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
            placeholder="Ask about employees, hotspots, actions, report findings, validation, or responsible use."
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <button className="primary" onClick={() => void send()} disabled={sending}>Send</button>
        </div>
      </div>
    </PageShell>
  );
}
