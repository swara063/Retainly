import React from 'react';
import { AlertTriangle, Sparkles, Upload } from 'lucide-react';
import { API_BASE, fetchJson, sleep, uploadCsvWithProgress } from '../api';
import ProgressBar from '../components/ProgressBar';
import AgentTimeline from '../components/AgentTimeline';
import { EmptyState, PageShell, SectionCard } from '../components/PageLayout';
import { useAppDispatch, useAppState } from '../state';

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'neutral' }) {
  return <div className={`statCard ${tone || 'neutral'}`}><span>{label}</span><b>{value}</b></div>;
}

export default function DashboardPage() {
  const s = useAppState();
  const set = useAppDispatch();
  const progress = s.progress || { percent: 0, status: 'idle', current_agent: '', current_step: '' };

  async function uploadCurrentFile() {
    if (!s.file) throw new Error('Choose a CSV file first.');
    set((p) => ({ ...p, error: '', results: null, modelTrust: null, hrTimeline: [], developerDiagnostics: [], progress: null, loading: true, phase: 'uploading', uploadPct: 0 }));
    try {
      const data = await uploadCsvWithProgress(s.file, (pct) => set((p) => ({ ...p, uploadPct: pct })));
      if (!data?.dataset_id) throw new Error('Upload succeeded but no dataset id was returned.');
      set((p) => ({ ...p, datasetId: data.dataset_id, columns: data.columns || [], rows: typeof data.rows === 'number' ? data.rows : null, uploadPct: 100, phase: 'uploaded' }));
      return data;
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Upload failed.', phase: 'failed' }));
      throw e;
    } finally {
      set((p) => ({ ...p, loading: false }));
      window.setTimeout(() => set((p) => ({ ...p, uploadPct: 0 })), 600);
    }
  }

  async function analyze() {
    if (!s.file || s.loading) return;
    set((p) => ({ ...p, error: '', results: null, modelTrust: null, hrTimeline: [], developerDiagnostics: [], progress: null, loading: true, phase: 'analyzing' }));
    try {
      const uploaded = s.datasetId ? { dataset_id: s.datasetId } : await uploadCurrentFile();
      const id = uploaded.dataset_id;
      if (!id) throw new Error('Upload succeeded but no dataset id was returned.');
      await fetchJson(`${API_BASE}/analysis/${id}/run?async_mode=true`, { method: 'POST' });
      const startedAt = Date.now();
      let completed = false;
      while (Date.now() - startedAt < 1000 * 60 * 8) {
        const progressRes = await fetchJson(`${API_BASE}/analysis/${id}/progress`).catch(() => null);
        if (progressRes) {
          set((p) => ({ ...p, progress: progressRes }));
          if ((progressRes as any)?.status === 'failed') throw new Error((progressRes as any)?.message || (progressRes as any)?.error || 'Analysis failed on the backend.');
        }
        const [logsRes, resultsRes] = await Promise.allSettled([
          fetchJson(`${API_BASE}/analysis/${id}/logs`).catch(() => ({ hr_timeline: [], developer_diagnostics: [] })),
          fetch(`${API_BASE}/analysis/${id}/results`),
        ]);
        if (logsRes.status === 'fulfilled') {
          const payload: any = logsRes.value || {};
          set((p) => ({ ...p, hrTimeline: Array.isArray(payload.hr_timeline) ? payload.hr_timeline : [], developerDiagnostics: Array.isArray(payload.developer_diagnostics) ? payload.developer_diagnostics : [] }));
        }
        if (resultsRes.status === 'fulfilled') {
          if (resultsRes.value.ok) {
            const data = await resultsRes.value.json().catch(() => ({}));
            if (data?.status === 'failed') throw new Error(data?.error || 'Analysis failed on the backend.');
            if (data?.status === 'completed') {
              const missingEmployeeRisk = !Array.isArray(data?.employee_risk);
              set((p) => ({ ...p, results: data, modelTrust: data?.model_trust || p.modelTrust, phase: 'completed', error: missingEmployeeRisk ? 'Analysis completed but employee risk results are missing. Please check backend output.' : '' }));
              completed = true;
              break;
            }
          } else if ((resultsRes.value.status || 0) === 404) {
            // Results are often not ready yet while the backend is still running.
            // Keep polling quietly instead of surfacing a premature warning.
          } else if ((resultsRes.value.status || 0) >= 400) {
            const err = await resultsRes.value.json().catch(() => ({}));
            throw new Error((err as any)?.detail || (err as any)?.message || 'Analysis failed on the backend.');
          }
        }
        await sleep(900);
      }
      if (!completed) throw new Error('Analysis timed out. Please try again.');
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Analysis failed.', phase: 'failed' }));
    } finally {
      set((p) => ({ ...p, loading: false }));
    }
  }

  const hasUploadedDataset = Boolean(s.datasetId);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  const results = hasValidResults ? s.results : {};

  return (
    <PageShell>
      <section className="heroNew">
        <div className="heroText">
          <h1>Retention Command Center for HR Teams</h1>
          <p className="subtitle">Upload HR data, run multi-agent retention analysis, and review employee risk, hotspots, actions, reports, and chatbot insights.</p>
          <div className="pillRow">
            <span className="pill">Upload CSV</span>
            <span className="pill">Run analysis</span>
            <span className="pill">Review command center</span>
          </div>
        </div>
        <div className="heroAside card">
          <b>Workflow</b>
          <AgentTimeline items={hasValidResults ? s.hrTimeline : [{ step: 'Project Manager Agent', status: 'waiting', message: 'Upload HR data and run retention analysis to view this section.' }]} />
        </div>
      </section>

      <SectionCard title="Upload HR data" subtitle="CSV upload and analysis start.">
        <label className="fileBox" style={{ marginTop: 12 }}>
          <Upload size={18} />
          <input type="file" accept=".csv" onChange={(e) => set((p) => ({ ...p, file: e.target.files?.[0] || null, datasetId: '', columns: [], rows: null, results: null, modelTrust: null, hrTimeline: [], developerDiagnostics: [], progress: null, error: '', phase: e.target.files?.[0] ? 'idle' : 'idle' }))} />
          <div className="fileMeta">
            <b>{s.file?.name || 'Choose a CSV file'}</b>
            <span className="muted">{s.datasetId ? 'Upload complete' : 'CSV only'}</span>
          </div>
        </label>
        {s.phase === 'uploading' ? <ProgressBar pct={s.uploadPct} label={`${s.uploadPct}% uploaded`} /> : null}
        {progress && progress.status && progress.status !== 'idle' ? <div style={{ marginTop: 12 }}><ProgressBar pct={Number(progress.percent || 0)} label={`${progress.current_agent || 'Running'} • ${progress.current_step || progress.status}`} /></div> : null}
        <div className="btnRow" style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => void analyze()} disabled={!s.file || s.loading}>Run Multi-Agent Analysis</button>
          <button onClick={() => void uploadCurrentFile()} disabled={!s.file || s.loading}>Re-upload</button>
        </div>
        {s.error ? <div className="panelError"><AlertTriangle size={16} /> {s.error}</div> : null}
      </SectionCard>

      <SectionCard title="Prediction Reliability" subtitle="Safe status summary only.">
        {!hasValidResults ? (
          <div className="panelHint" style={{ marginTop: 12 }}>Upload HR data and run retention analysis to view the reliability summary.</div>
        ) : (
          <div className="panelHint" style={{ marginTop: 12 }}>
            <div><b>Status:</b> {String(results.model_trust?.status || s.modelTrust?.status || 'Review recommended')}</div>
            <div><b>Model basis:</b> {String(results.model_trust?.model_basis || s.modelTrust?.model_basis || 'Pretrained attrition-risk model')}</div>
            <div><b>Training source:</b> {String(results.model_trust?.training_source || s.modelTrust?.training_source || 'Benchmark attrition datasets configured in research_datasets/')}</div>
            <div><b>Suitable use:</b> {String(results.model_trust?.suitable_use || 'Retention prioritization and HR planning')}</div>
            <div><b>Not suitable for:</b> {String(results.model_trust?.not_suitable_for || 'Automatic firing, punitive decisions, or final employment decisions')}</div>
          </div>
        )}
      </SectionCard>

      {!hasValidResults ? (
        <div className="panelHint" style={{ marginTop: 2 }}>
          {hasUploadedDataset ? (s.phase === 'uploaded' ? 'Upload complete. Run Multi-Agent Analysis to generate the summary.' : 'Run analysis first to view the command center summary.') : 'Upload HR data and run retention analysis to view the command center summary.'}
        </div>
      ) : (
        <>
          <SectionCard title="Command Center Summary" subtitle="High-level summary after analysis.">
            <div className="summaryGrid" style={{ marginTop: 12 }}>
              <StatCard label="Employees analyzed" value={String(s.rows ?? '—')} />
              <StatCard label="High-risk employees" value={String((results.employee_risk || []).filter((r: any) => ['High', 'Critical'].includes(String(r.risk_band))).length || '—')} tone="warn" />
              <StatCard label="Data quality score" value={String(results.data_quality?.data_quality_score ?? '—')} />
            </div>
          </SectionCard>
          <SectionCard title="Top 3 actions" subtitle="Action priorities only.">
            <div className="grid one" style={{ marginTop: 12 }}>
              {(Array.isArray(results.recommendations) && results.recommendations.length ? results.recommendations.slice(0, 3) : []).map((item: string, index: number) => (
                <div className="panelHint" key={index}>{item}</div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </PageShell>
  );
}
