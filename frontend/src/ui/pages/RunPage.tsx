import React from 'react';
import { Database, Upload } from 'lucide-react';
import { API_BASE, fetchJson, sleep, uploadCsvWithProgress } from '../api';
import { useAppDispatch, useAppState } from '../state';
import ProgressBar from '../components/ProgressBar';
import AgentTimeline from '../components/AgentTimeline';

export default function RunPage() {
  const s = useAppState();
  const set = useAppDispatch();

  async function uploadOnly() {
    if (!s.file) return alert('Choose a CSV file first.');
    set((p) => ({ ...p, error: '', results: null, modelTrust: null, hrTimeline: [], developerDiagnostics: [], progress: null, selectedEmployee: null, selectedEmployeeDetail: null, datasetId: '', columns: [], loading: true, phase: 'uploading', uploadPct: 0 }));
    try {
      const data = await uploadCsvWithProgress(s.file, (pct) => set((p) => ({ ...p, uploadPct: pct })));
      if (!data?.dataset_id) throw new Error('Upload succeeded but no dataset_id returned.');
      set((p) => ({ ...p, datasetId: data.dataset_id, columns: data.columns || [], rows: typeof data.rows === 'number' ? data.rows : p.rows, uploadPct: 100, phase: 'uploaded' }));
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Upload failed.', phase: 'failed' }));
    } finally {
      set((p) => ({ ...p, loading: false }));
      setTimeout(() => set((p) => ({ ...p, uploadPct: 0 })), 700);
    }
  }

  async function analyze() {
    if (!s.file) return alert('Choose a CSV file first.');
    set((p) => ({ ...p, error: '', results: null, modelTrust: null, hrTimeline: [], developerDiagnostics: [], progress: null, loading: true, phase: 'analyzing' }));
    try {
      let id = s.datasetId;
      if (!id) {
        set((p) => ({ ...p, phase: 'uploading', uploadPct: 0 }));
        const up = await uploadCsvWithProgress(s.file, (pct) => set((p) => ({ ...p, uploadPct: pct })));
        id = up?.dataset_id || '';
        if (!id) throw new Error('Upload did not return a dataset id.');
        set((p) => ({ ...p, datasetId: id, columns: up.columns || [], rows: typeof up.rows === 'number' ? up.rows : p.rows, uploadPct: 100 }));
      }

      set((p) => ({ ...p, phase: 'analyzing' }));
      await fetchJson(`${API_BASE}/analysis/${id}/run?async_mode=true`, { method: 'POST' });

      const startedAt = Date.now();
      const deadlineMs = 1000 * 60 * 8;
      let completed = false;
      while (Date.now() - startedAt < deadlineMs) {
        const [logsRes, resultsRes] = await Promise.allSettled([
          fetchJson(`${API_BASE}/analysis/${id}/logs`).catch(() => ({ hr_timeline: [], developer_diagnostics: [] })),
          fetch(`${API_BASE}/analysis/${id}/results`),
        ]);
        if (logsRes.status === 'fulfilled') {
          const payload: any = logsRes.value || {};
          set((p) => ({
            ...p,
            hrTimeline: Array.isArray(payload.hr_timeline) ? payload.hr_timeline : [],
            developerDiagnostics: Array.isArray(payload.developer_diagnostics) ? payload.developer_diagnostics : [],
          }));
        }
        if (resultsRes.status === 'fulfilled' && resultsRes.value.ok) {
          const data = await resultsRes.value.json().catch(() => ({}));
          if (data?.status === 'failed') throw new Error(data?.error || 'Analysis failed on the backend.');
          if (data?.status === 'completed') {
            const missingEmployeeRisk = !Array.isArray(data?.employee_risk);
            set((p) => ({ ...p, results: data, modelTrust: data?.model_trust || p.modelTrust, phase: 'completed', error: missingEmployeeRisk ? 'Analysis completed but employee risk results are missing. Please check backend output.' : '' }));
            completed = true;
            break;
          }
        }
        await sleep(900);
      }
      if (!completed) throw new Error('Analysis did not finish in time. Please try again with a smaller CSV or check the backend logs.');
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Analysis failed.', phase: 'failed' }));
    } finally {
      set((p) => ({ ...p, loading: false }));
      setTimeout(() => set((p) => ({ ...p, uploadPct: 0 })), 700);
    }
  }

  const canAnalyze = Boolean(s.file) && !s.loading;
  const analyzeDisabledReason = !s.file ? 'Choose a CSV file to enable analysis.' : s.loading ? 'A request is already running.' : '';

  return (
    <div className="page">
      <div className="grid two">
        <div className="card">
          <h3>Execution Timeline</h3>
          <AgentTimeline items={s.hrTimeline} />
        </div>

        <div className="card">
          <div className="panelTitle">
            <Database size={18} />
            <div>
              <b>Start a run</b>
              <div className="muted">Upload CSV → analyze → explore</div>
            </div>
          </div>
          <label className="fileBox">
            <Upload size={18} />
            <input type="file" accept=".csv" onChange={(e) => set((p) => ({ ...p, file: e.target.files?.[0] || null }))} />
            <div className="fileMeta">
              <b>{s.file?.name || 'Choose an HR CSV dataset'}</b>
              <span className="muted">CSV only</span>
            </div>
          </label>
          {s.phase === 'uploading' && <ProgressBar pct={s.uploadPct} label={`${s.uploadPct}% uploaded`} />}
          <div className="btnRow">
            <button onClick={uploadOnly} disabled={s.loading || !s.file}>Upload</button>
            <button className="primary" onClick={analyze} disabled={!canAnalyze}>Analyze</button>
          </div>
          {!canAnalyze && <div className="panelHint"><b>Analyze disabled:</b> {analyzeDisabledReason}</div>}
          {s.error && <div className="panelError"><b>Fix:</b> {s.error}</div>}
          {s.datasetId && (
            <div className="smallRow">
              <span className="muted">Dataset ID</span>
              <code>{s.datasetId}</code>
            </div>
          )}
          <div className="panelHint">After analysis, use the pages on the left to explore what each agent produced.</div>
        </div>
      </div>
    </div>
  );
}
