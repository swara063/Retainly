import React from 'react';
import { useAppState } from '../state';
import { EmptyState, PageShell } from '../components/PageLayout';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

function timeOnly(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour12: false });
}

function durationSeconds(start?: string, end?: string) {
  if (!start || !end) return '—';
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '—';
  return `${((b - a) / 1000).toFixed(1)}s`;
}

function summarizeAgent(name: string) {
  if (name === 'Project Manager Agent') {
    return {
      did: 'Started workflow, tracked stages, checked completion, and coordinated handoff.',
      output: 'Completed workflow trace and report-ready status.',
    };
  }
  if (name === 'Data Analyst Agent') {
    return {
      did: 'Validated rows/columns, detected HR fields, checked missing values, and profiled departments, roles, workload, satisfaction, and tenure.',
      output: 'Data quality score, field mapping, and hotspot inputs.',
    };
  }
  if (name === 'ML Engineer Agent') {
    return {
      did: 'Loaded the pretrained Retainly model and scored employees for website analysis without benchmark training.',
      output: 'Employee risk scores, bands, and relative priority ranking.',
    };
  }
  if (name === 'Insights Agent') {
    return {
      did: 'Converted risk scores into employee profiles, hotspots, action guidance, report content, and chatbot context.',
      output: 'Action plan, report summary, and chatbot-ready context.',
    };
  }
  return {
    did: 'Converted risk scores into employee profiles, hotspots, action guidance, report content, and chatbot context.',
    output: 'Action plan, report summary, and chatbot-ready context.',
  };
}

export default function AgentsPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <PageShell title="Agents" subtitle="Workflow timeline and collapsed diagnostics."><EmptyState title="Run analysis first to view this section." description={hasUploadedDataset ? 'Workflow timeline will appear after analysis completes.' : 'Upload HR data to begin workflow analysis.'} /></PageShell>;
  }

  const diagnostics = Array.isArray(s.developerDiagnostics) ? s.developerDiagnostics : [];
  const agentNames = ['Project Manager Agent', 'Data Analyst Agent', 'ML Engineer Agent', 'Insights Agent'];
  const agentCards = agentNames.map((name) => {
    const related = diagnostics.filter((item: any) => {
      const agent = String(item?.agent || '');
      if (name === 'Data Analyst Agent') return agent === 'Data Analyst Agent' || agent === 'Column Mapper Agent';
      if (name === 'Insights Agent') return agent === 'Insights Agent';
      return agent === name;
    });
    const started = related.find((item: any) => String(item?.status) === 'running')?.timestamp;
    const ended = [...related].reverse().find((item: any) => ['completed', 'warning', 'failed'].includes(String(item?.status)))?.timestamp;
    const finalStatus = [...related].reverse().find((item: any) => item?.status)?.status || 'completed';
    const summary = summarizeAgent(name);
    return { name, started, ended, finalStatus, ...summary };
  });

  return (
    <PageShell title="Agents" subtitle="Workflow timeline and collapsed diagnostics.">
      <div className="pageHeader">
        <div>
          <h2>Agents</h2>
          <p className="muted">Workflow transparency only.</p>
        </div>
        <div className="chip">{s.hrTimeline?.length || 0} steps</div>
      </div>
      <div className="grid two">
        {agentCards.map((card) => (
          <div className="card" key={card.name}>
            <div className="agentHeader">
              <div>
                <h3>{card.name}</h3>
                <div className="muted tiny">Status: {String(card.finalStatus).toUpperCase()}</div>
              </div>
              <span className={`agentStatus ${String(card.finalStatus).includes('fail') ? 'bad' : String(card.finalStatus).includes('warn') ? 'warn' : 'ok'}`}>{String(card.finalStatus)}</span>
            </div>
            <div className="agentMetaGrid">
              <div className="statMini"><span>Start</span><b>{timeOnly(card.started)}</b></div>
              <div className="statMini"><span>End</span><b>{timeOnly(card.ended)}</b></div>
              <div className="statMini"><span>Duration</span><b>{durationSeconds(card.started, card.ended)}</b></div>
            </div>
            <div className="actionField">
              <b>What it did</b>
              <p>{card.did}</p>
            </div>
            <div className="actionField">
              <b>Output produced</b>
              <p>{card.output}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <details open className="detailsBox">
          <summary>Workflow steps</summary>
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Step</th><th>Status</th><th>Message</th></tr></thead>
            <tbody>
              {(s.hrTimeline || []).map((item: any, index: number) => (
                <tr key={index}>
                  <td><b>{item.step}</b></td>
                  <td>{String(item.status).toUpperCase()}</td>
                  <td>{item.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
        <details className="detailsBox" style={{ marginTop: 12 }}>
          <summary>Developer diagnostics</summary>
          <pre className="pre">{JSON.stringify(s.developerDiagnostics || [], null, 2)}</pre>
        </details>
      </div>
    </PageShell>
  );
}
