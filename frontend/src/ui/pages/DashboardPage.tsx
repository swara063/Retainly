import React from 'react';
import { AlertTriangle, Sparkles, Upload } from 'lucide-react';
import { API_BASE, fetchJson, sleep, uploadCsvWithProgress } from '../api';
import ProgressBar from '../components/ProgressBar';
import AgentTimeline from '../components/AgentTimeline';
import { useAppDispatch, useAppState } from '../state';

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'neutral' }) {
  return <div className={`statCard ${tone || 'neutral'}`}><span>{label}</span><b>{value}</b></div>;
}

function EmptyNote({ text }: { text: string }) {
  return <div className="panelHint">{text}</div>;
}

export default function DashboardPage() {
  const s = useAppState();
  const set = useAppDispatch();
  const progress = s.progress || { percent: 0, status: 'idle', current_agent: '', current_step: '' };

  async function uploadOnly() {
    if (!s.file) return;
    set((p) => ({ ...p, error: '', results: null, modelTrust: null, hrTimeline: [], developerDiagnostics: [], progress: null, loading: true, phase: 'uploading', uploadPct: 0 }));
    try {
      const data = await uploadCsvWithProgress(s.file, (pct) => set((p) => ({ ...p, uploadPct: pct })));
      if (!data?.dataset_id) throw new Error('Upload succeeded but no dataset id was returned.');
      set((p) => ({ ...p, datasetId: data.dataset_id, columns: data.columns || [], rows: typeof data.rows === 'number' ? data.rows : null, uploadPct: 100, phase: 'uploaded' }));
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Upload failed.', phase: 'failed' }));
    } finally {
      set((p) => ({ ...p, loading: false }));
      window.setTimeout(() => set((p) => ({ ...p, uploadPct: 0 })), 600);
    }
  }

  async function analyze() {
    if (!s.file) return;
    if (!s.datasetId) await uploadOnly();
    const id = s.datasetId;
    if (!id) return;
    set((p) => ({ ...p, error: '', results: null, modelTrust: null, hrTimeline: [], developerDiagnostics: [], progress: null, loading: true, phase: 'analyzing' }));
    try {
      await fetchJson(`${API_BASE}/analysis/${id}/run?async_mode=true`, { method: 'POST' });
      const startedAt = Date.now();
      while (Date.now() - startedAt < 1000 * 60 * 8) {
        const progressRes = await fetchJson(`${API_BASE}/analysis/${id}/progress`).catch(() => null);
        if (progressRes) set((p) => ({ ...p, progress: progressRes }));
        const [logsRes, resultsRes] = await Promise.allSettled([
          fetchJson(`${API_BASE}/analysis/${id}/logs`).catch(() => ({ hr_timeline: [], developer_diagnostics: [] })),
          fetch(`${API_BASE}/analysis/${id}/results`),
        ]);
        if (logsRes.status === 'fulfilled') {
          const payload: any = logsRes.value || {};
          set((p) => ({ ...p, hrTimeline: Array.isArray(payload.hr_timeline) ? payload.hr_timeline : [], developerDiagnostics: Array.isArray(payload.developer_diagnostics) ? payload.developer_diagnostics : [] }));
        }
        if (resultsRes.status === 'fulfilled' && resultsRes.value.ok) {
          const data = await resultsRes.value.json().catch(() => ({}));
          if (data?.status === 'failed') throw new Error(data?.error || 'Analysis failed on the backend.');
          if (data?.status === 'completed') {
            const missingEmployeeRisk = !Array.isArray(data?.employee_risk);
            set((p) => ({ ...p, results: data, modelTrust: data?.model_trust || p.modelTrust, phase: 'completed', error: missingEmployeeRisk ? 'Analysis completed but employee risk results are missing. Please check backend output.' : '' }));
            break;
          }
        }
        await sleep(900);
      }
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Analysis failed.', phase: 'failed' }));
    } finally {
      set((p) => ({ ...p, loading: false }));
    }
  }

  const hasUploadedDataset = Boolean(s.datasetId);
  const isAnalysisComplete = s.phase === 'completed' && s.results?.status === 'completed';
  const hasValidResults = isAnalysisComplete && Array.isArray(s.results?.employee_risk);
  const results = hasValidResults ? s.results : {};
  const exec = results.executive_summary || {};
  const topRiskSegments = Array.isArray(results.risk_segments) ? [...results.risk_segments].sort((a, b) => Number(b.average_predicted_risk || 0) - Number(a.average_predicted_risk || 0)) : [];
  const topRiskDepartment = topRiskSegments.find((r: any) => String(r.segment_name) === 'Department') || topRiskSegments[0];
  const topRiskRole = topRiskSegments.find((r: any) => String(r.segment_name) === 'JobRole') || topRiskSegments[0];
  const topRiskDriver = String((results.explainability?.top_features || [])[0]?.feature || '—');
  const recommendations: string[] = results.recommendations || [];
  const confidence = String(results.confidence_summary?.confidence_level || results.confidence_summary?.plain_english || 'Review recommended');

  return (
    <div className="dashboard">
      <section className="heroNew">
        <div className="heroText">
          <div className="eyebrow">Retainly</div>
          <h1>Retention Command Center for HR Teams</h1>
          <p className="subtitle">Upload HR data, run the multi-agent analysis, and review the high-level retention summary.</p>
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

      <section className="card">
        <b>Upload HR data</b>
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
          <button onClick={() => void uploadOnly()} disabled={!s.file || s.loading}>Re-upload</button>
        </div>
        {s.error ? <div className="panelError"><AlertTriangle size={16} /> {s.error}</div> : null}
      </section>

      <section className="card">
        <b>Prediction Reliability</b>
        <div className="panelHint" style={{ marginTop: 12 }}>
          <div><b>Status:</b> {String(results.model_trust?.status || s.modelTrust?.status || 'Review recommended')}</div>
          <div><b>Model basis:</b> {String(results.model_trust?.model_basis || s.modelTrust?.model_basis || 'Pretrained attrition-risk model')}</div>
          <div><b>Training source:</b> {String(results.model_trust?.training_source || s.modelTrust?.training_source || 'Benchmark attrition datasets configured in research_datasets/')}</div>
        </div>
      </section>

      <section className="card">
        <b>Validation &amp; Method Proof</b>
        <div className="panelHint" style={{ marginTop: 12 }}>
          Retainly’s multi-agent workflow is validated separately using labeled benchmark attrition datasets. The website applies that validated workflow to current HR data for risk scoring and retention planning.
        </div>
        <div className="btnRow" style={{ marginTop: 12 }}>
          <a className="download secondary" href="/validation">View validation proof</a>
        </div>
      </section>

      {hasValidResults ? (
        <>
          <section className="card">
            <b>Command Center Summary</b>
            <div className="summaryGrid" style={{ marginTop: 12 }}>
              <StatCard label="Employees analyzed" value={String(exec.rows_analyzed ?? s.rows ?? '—')} />
              <StatCard label="High-risk employees" value={String((results.employee_risk || []).filter((r: any) => ['High', 'Critical'].includes(String(r.risk_band))).length || '—')} tone="warn" />
              <StatCard label="Highest-risk department" value={String(topRiskDepartment?.group || '—')} tone="warn" />
              <StatCard label="Highest-risk role" value={String(topRiskRole?.group || '—')} tone="warn" />
              <StatCard label="Top risk driver" value={topRiskDriver} />
              <StatCard label="Data quality score" value={String(results.data_quality?.data_quality_score ?? '—')} />
              <StatCard label="Prediction reliability" value={confidence} />
            </div>
          </section>

          <section className="card">
            <b>Top 3 actions</b>
            <div className="grid one" style={{ marginTop: 12 }}>
              {(recommendations.slice(0, 3).length ? recommendations.slice(0, 3) : ['Run analysis first to view this section.']).map((item, index) => (
                <div className="panelHint" key={index}>{item}</div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="card">
          <EmptyNote text={!hasUploadedDataset ? 'Upload HR data and run retention analysis to view the command center summary.' : s.phase === 'uploaded' ? 'Upload complete. Run Multi-Agent Analysis to generate the summary.' : 'Run analysis first to view the command center summary.'} />
        </section>
      )}
    </div>
  );
}
