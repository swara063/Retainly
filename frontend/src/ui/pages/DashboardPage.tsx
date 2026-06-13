import React from 'react';
import { AlertTriangle, FileText, Search, Sparkles, Upload, Users } from 'lucide-react';
import { API_BASE, fetchJson, sleep, uploadCsvWithProgress } from '../api';
import AgentTimeline from '../components/AgentTimeline';
import ProgressBar from '../components/ProgressBar';
import { useAppDispatch, useAppState } from '../state';

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return <div className="sectionHeader"><div className="sectionIcon">{icon}</div><div><h2>{title}</h2>{subtitle ? <p className="muted">{subtitle}</p> : null}</div></div>;
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  return <div className={`statCard ${tone || 'neutral'}`}><span>{label}</span><b>{value}</b></div>;
}

export default function DashboardPage() {
  const s = useAppState();
  const set = useAppDispatch();
  const [preview, setPreview] = React.useState<any | null>(null);
  const [employeeQuery, setEmployeeQuery] = React.useState('');
  const [employeeDepartment, setEmployeeDepartment] = React.useState('');
  const [employeeJobRole, setEmployeeJobRole] = React.useState('');
  const [employeeRiskBand, setEmployeeRiskBand] = React.useState('');
  const [employeeSort, setEmployeeSort] = React.useState<'risk_desc' | 'risk_asc'>('risk_desc');
  const [employeeExplorer, setEmployeeExplorer] = React.useState<any>({ records: [], total: 0, available_filters: { departments: [], job_roles: [], risk_bands: [], employee_labels: [] }, warnings: [] });
  const [employeeLoading, setEmployeeLoading] = React.useState(false);
  const [selectedEmployee, setSelectedEmployee] = React.useState<any | null>(null);
  const [selectedEmployeeDetail, setSelectedEmployeeDetail] = React.useState<any | null>(null);
  const progress = s.progress || { percent: 0, status: 'idle', current_agent: '', current_step: '' };

  React.useEffect(() => {
    if (!s.datasetId) return;
    fetchJson(`${API_BASE}/datasets/${s.datasetId}/preview`).then(setPreview).catch(() => setPreview(null));
  }, [s.datasetId]);

  React.useEffect(() => {
    if (!s.datasetId || !s.results) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setEmployeeLoading(true);
        const params = new URLSearchParams();
        if (employeeQuery.trim()) params.set('search', employeeQuery.trim());
        if (employeeDepartment) params.set('department', employeeDepartment);
        if (employeeJobRole) params.set('job_role', employeeJobRole);
        if (employeeRiskBand) params.set('risk_band', employeeRiskBand);
        params.set('sort', employeeSort);
        params.set('limit', '50');
        const data = await fetchJson(`${API_BASE}/analysis/${s.datasetId}/employees?${params.toString()}`);
        if (!cancelled) setEmployeeExplorer(data);
      } catch {
        if (!cancelled) setEmployeeExplorer({ records: [], total: 0, available_filters: { departments: [], job_roles: [], risk_bands: [], employee_labels: [] }, warnings: [] });
      } finally {
        if (!cancelled) setEmployeeLoading(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [s.datasetId, s.results, employeeQuery, employeeDepartment, employeeJobRole, employeeRiskBand, employeeSort]);

  React.useEffect(() => {
    if (!selectedEmployee || !s.datasetId) return setSelectedEmployeeDetail(null);
    let cancelled = false;
    fetchJson(`${API_BASE}/analysis/${s.datasetId}/employees/${selectedEmployee.row_index}`).then((data) => { if (!cancelled) setSelectedEmployeeDetail(data); }).catch(() => { if (!cancelled) setSelectedEmployeeDetail(null); });
    return () => { cancelled = true; };
  }, [s.datasetId, selectedEmployee]);

  async function uploadOnly(fileOverride?: File | null) {
    const file = fileOverride || s.file;
    if (!file) return;
    set((p) => ({ ...p, error: '', results: null, hrTimeline: [], developerDiagnostics: [], loading: true, phase: 'uploading', uploadPct: 0 }));
    try {
      const data = await uploadCsvWithProgress(file, (pct) => set((p) => ({ ...p, uploadPct: pct })));
      if (!data?.dataset_id) throw new Error('Upload succeeded but no dataset id was returned.');
      set((p) => ({ ...p, datasetId: data.dataset_id, columns: data.columns || [], rows: typeof data.rows === 'number' ? data.rows : null, uploadPct: 100 }));
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Upload failed.' }));
    } finally {
      set((p) => ({ ...p, loading: false, phase: 'idle' }));
      window.setTimeout(() => set((p) => ({ ...p, uploadPct: 0 })), 600);
    }
  }

  async function analyze() {
    if (!s.datasetId && !s.file) return;
    if (!s.datasetId && s.file) await uploadOnly();
    const id = s.datasetId || '';
    if (!id) return;
    set((p) => ({ ...p, error: '', results: null, hrTimeline: [], developerDiagnostics: [], loading: true, phase: 'analyzing' }));
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
          set((p) => ({ ...p, results: data }));
          break;
        }
        await sleep(900);
      }
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Analysis failed.' }));
    } finally {
      set((p) => ({ ...p, loading: false, phase: 'idle' }));
    }
  }

  const results = s.results || {};
  const modelTrust = results.model_trust || s.modelTrust || {};
  const exec = results.executive_summary || {};
  const topRiskSegments = Array.isArray(results.risk_segments) ? [...results.risk_segments].sort((a, b) => Number(b.average_predicted_risk || 0) - Number(a.average_predicted_risk || 0)) : [];
  const topRisk = topRiskSegments[0];
  const recommendations: string[] = results.recommendations || [];
  const employeeFilters = employeeExplorer?.available_filters || { departments: [], job_roles: [], risk_bands: [], employee_labels: [] };
  const dashboardReady = Boolean(s.results);

  return (
    <div className="dashboard">
      <section className="heroNew">
        <div className="heroText">
          <div className="eyebrow">Retainly</div>
          <h1>Retention Command Center for HR Teams</h1>
          <p className="subtitle">Upload current HR data, identify employees and teams that may need retention support, and generate a practical action plan.</p>
          <div className="pillRow">
            <span className="pill">1. Upload HR data</span>
            <span className="pill">2. Smart import</span>
            <span className="pill">3. Run retention analysis</span>
            <span className="pill">4. Review employees, hotspots, and action plan</span>
          </div>
        </div>
        <div className="heroAside card">
          <b>Workflow</b>
          <AgentTimeline items={s.hrTimeline.length ? s.hrTimeline : [{ step: 'Project Manager Agent', status: 'waiting', message: 'Run analysis to begin.' }]} />
        </div>
</section>

      <section id="trust">
        <div className="card">
          <b>Prediction Reliability</b>
          <div className="panelHint" style={{ marginTop: 12 }}>
            <div><b>Status:</b> {modelTrust.status || 'Review recommended'}</div>
            <div><b>Model basis:</b> {modelTrust.model_basis || 'Pretrained attrition-risk model'}</div>
            <div><b>Training source:</b> {modelTrust.training_source || 'Benchmark attrition datasets configured in research_datasets/'}</div>
            <div><b>Suitable use:</b> {modelTrust.suitable_use || 'Retention prioritization and HR planning'}</div>
            <div><b>Not suitable for:</b> {modelTrust.not_suitable_for || 'Automatic firing, punitive decisions, or final employment decisions'}</div>
            <div><b>Validation note:</b> {modelTrust.validation_note || 'Detailed validation is available in the research notebook.'}</div>
          </div>
          {modelTrust.validation_summary_available ? <div className="panelHint" style={{ marginTop: 10 }}>Benchmark validation completed. Detailed metrics are available in the research notebook.</div> : null}
        </div>
      </section>

      <section id="validation">
        <div className="card">
          <b>Validation & Method Proof</b>
          <div className="panelHint" style={{ marginTop: 12 }}>
            Retainly’s multi-agent prediction workflow is validated separately using labeled benchmark attrition datasets. The validation notebook compares standard ML baselines against the Retainly multi-agent pipeline.
          </div>
          <div className="btnRow" style={{ marginTop: 12 }}>
            <a className="download secondary" href="https://github.com/swara063/Retainly/blob/main/notebooks/retainly_dataset_comparison.ipynb" target="_blank" rel="noreferrer">Open validation notebook</a>
            <a className="download secondary" href="https://github.com/swara063/Retainly/tree/main/research_outputs" target="_blank" rel="noreferrer">View research outputs</a>
          </div>
        </div>
      </section>

      <section id="upload">
        <SectionTitle icon={<Upload size={18} />} title="Upload HR data" subtitle="CSV upload, re-upload, and analysis start." />
        <div className="grid two">
          <div className="card uploadPanel">
            <label className="fileBox">
              <Upload size={18} />
              <input type="file" accept=".csv" onChange={(e) => set((p) => ({ ...p, file: e.target.files?.[0] || null }))} />
              <div className="fileMeta"><b>{s.file?.name || 'Choose a CSV file'}</b><span className="muted">{s.datasetId ? 'Data uploaded' : 'CSV only'}</span></div>
            </label>
            {s.phase === 'uploading' ? <ProgressBar pct={s.uploadPct} label={`${s.uploadPct}% uploaded`} /> : null}
            <div className="btnRow">
              <button className="primary" onClick={() => void analyze()} disabled={!s.file || s.loading}>Run Retention Analysis</button>
              <button onClick={() => void uploadOnly()} disabled={!s.file || s.loading}>Re-upload</button>
            </div>
            {progress && progress.status && progress.status !== 'idle' ? (<div style={{ marginTop: 12 }}><ProgressBar pct={Number(progress.percent || 0)} label={`${progress.current_agent || 'Running'} • ${progress.current_step || progress.status}`}/></div>) : null}
            {s.error ? <div className="panelError"><AlertTriangle size={16} /> {s.error}</div> : null}
          </div>
          <div className="card">
            <b>Smart import summary</b>
            <div className="summaryGrid" style={{ marginTop: 12 }}>
              <StatCard label="Employees analyzed" value={String(exec.rows_analyzed ?? s.rows ?? '—')} />
              <StatCard label="High-risk employees" value={String((results.employee_risk || []).filter((r: any) => ['High', 'Critical'].includes(String(r.risk_band))).length || '—')} tone="warn" />
              <StatCard label="Highest-risk department" value={topRisk ? String(topRisk.segment_name === 'Department' ? topRisk.group : topRisk.group) : '—'} tone="warn" />
              <StatCard label="Highest-risk role" value={topRisk ? String(topRisk.segment_name === 'JobRole' ? topRisk.group : (topRiskSegments.find((r: any) => r.segment_name === 'JobRole')?.group || '—')) : '—'} tone="warn" />
              <StatCard label="Top risk driver" value={String((results.explainability?.top_features || [])[0]?.feature || '—')} />
              <StatCard label="Data quality score" value={String(results.data_quality?.data_quality_score ?? '—')} />
            </div>
            <div className="panelHint" style={{ marginTop: 12 }}>{results.dataset_mode === 'unlabeled_scoring' ? 'This dataset does not include actual attrition outcomes, so evaluation metrics cannot be calculated for this upload. Retainly is using the pretrained attrition model to estimate risk.' : (results.confidence_summary?.plain_english || 'Run analysis to view your retention dashboard.')}</div>
          </div>
        </div>
      </section>

      <section id="analysis">
        <SectionTitle icon={<Sparkles size={18} />} title="Agent Activity Monitor" subtitle="Waiting / Running / Completed / Needs attention." />
        <div className="card">
          <div className="summaryGrid">
            {['Project Manager Agent', 'Data Analyst Agent', 'ML Engineer Agent', 'Explainability Engine', 'Insights Agent', 'Report Generator'].map((name) => {
              const log = (s.hrTimeline || []).find((item) => String(item.step || '').toLowerCase().includes(name.toLowerCase().replace(' agent', '')));
              const status = String(log?.status || (dashboardReady ? 'completed' : 'waiting'));
              const tone = status.includes('completed') ? 'good' : status.includes('attention') ? 'warn' : 'neutral';
              return <StatCard key={name} label={name} value={status} tone={tone as any} />;
            })}
          </div>
          <div style={{ marginTop: 12 }}><AgentTimeline items={s.hrTimeline} /></div>
        </div>
      </section>

      <section id="employees">
        <SectionTitle icon={<Users size={18} />} title="Employee Explorer" subtitle="Sorted highest risk first, with search and profile view." />
        {!dashboardReady ? (
          <div className="card"><b>Run analysis first to view this section.</b></div>
        ) : (
          <div className="grid two">
            <div className="card">
              <label><div className="muted tiny">Search EmployeeID or EmployeeName</div><input className="textInput" value={employeeQuery} onChange={(e) => setEmployeeQuery(e.target.value)} placeholder="Search by ID or name" list="employee-labels" /></label>
              <datalist id="employee-labels">{(employeeFilters.employee_labels || []).map((label: string) => <option key={label} value={label} />)}</datalist>
              <div className="grid three" style={{ marginTop: 12 }}>
                <label><div className="muted tiny">Department</div><select value={employeeDepartment} onChange={(e) => setEmployeeDepartment(e.target.value)}><option value="">All</option>{(employeeFilters.departments || []).map((value: string) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label><div className="muted tiny">JobRole</div><select value={employeeJobRole} onChange={(e) => setEmployeeJobRole(e.target.value)}><option value="">All</option>{(employeeFilters.job_roles || []).map((value: string) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label><div className="muted tiny">RiskBand</div><select value={employeeRiskBand} onChange={(e) => setEmployeeRiskBand(e.target.value)}><option value="">All</option>{(employeeFilters.risk_bands || ['Low', 'Medium', 'High', 'Critical']).map((value: string) => <option key={value} value={value}>{value}</option>)}</select></label>
              </div>
              <label style={{ marginTop: 12, display: 'block' }}><div className="muted tiny">Sort</div><select value={employeeSort} onChange={(e) => setEmployeeSort(e.target.value as 'risk_desc' | 'risk_asc')}><option value="risk_desc">Highest risk first</option><option value="risk_asc">Lowest risk first</option></select></label>
              {employeeLoading ? <div className="panelHint" style={{ marginTop: 12 }}>Loading employees...</div> : null}
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table className="table">
                  <thead><tr><th>Employee</th><th>Department</th><th>Role</th><th>Risk score</th><th>Risk band</th><th>Top factors</th><th>Suggested support action</th></tr></thead>
                  <tbody>
                    {(employeeExplorer.records || []).map((item: any) => (
                      <tr key={item.row_index} style={{ cursor: 'pointer' }} onClick={() => setSelectedEmployee(item)}>
                        <td><b>{item.display_label}</b></td>
                        <td>{item.department || '—'}</td>
                        <td>{item.job_role || '—'}</td>
                        <td>{Math.round(Number(item.risk_percent || 0))}%</td>
                        <td>{item.risk_band || '—'}</td>
                        <td>{(item.top_risk_factors || []).slice(0, 2).join('; ') || '—'}</td>
                        <td>{item.recommended_support_action || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <b>Employee profile</b>
              {selectedEmployeeDetail ? (
                <>
                  <div className="summaryGrid" style={{ marginTop: 12 }}>
                    <StatCard label="EmployeeID / Name" value={String(selectedEmployeeDetail.employee?.employee_id || selectedEmployeeDetail.employee?.employee_name || selectedEmployeeDetail.employee?.display_label || '—')} />
                    <StatCard label="Department" value={String(selectedEmployeeDetail.employee?.department || '—')} />
                    <StatCard label="JobRole" value={String(selectedEmployeeDetail.employee?.job_role || '—')} />
                    <StatCard label="Risk score" value={`${Math.round(Number(selectedEmployeeDetail.employee?.risk_percent || 0))}%`} tone="warn" />
                    <StatCard label="Risk band" value={String(selectedEmployeeDetail.employee?.risk_band || '—')} tone="warn" />
                  </div>
                  <div className="panelHint"><b>Top factors:</b> {(selectedEmployeeDetail.employee?.top_risk_factors || []).join('; ') || 'Review in context with the manager.'}</div>
                  <div className="panelHint"><b>Suggested support:</b> {selectedEmployeeDetail.recommended_support_action || 'Use a supportive check-in and review workload.'}</div>
                  <div className="panelHint"><b>HR talking points:</b> {(selectedEmployeeDetail.manager_hr_talking_points || []).join(' ')}</div>
                </>
              ) : <div className="panelHint" style={{ marginTop: 12 }}>Select an employee to see the profile.</div>}
            </div>
          </div>
        )}
      </section>

      <section id="hotspots">
        <SectionTitle icon={<Search size={18} />} title="Hotspots" subtitle="Where retention risk is concentrated." />
        <div className="grid two">
          <div className="card">
            <h3>Department / role hotspots</h3>
            {topRiskSegments.length ? topRiskSegments.slice(0, 5).map((r: any) => <div className="panelHint" key={`${r.segment_name}-${r.group}`}><b>{r.segment_name}:</b> {r.group} ({Math.round(Number(r.average_predicted_risk || 0) * 100)}%)</div>) : <div className="panelHint">Run analysis first to view this section.</div>}
          </div>
          <div className="card">
            <h3>Top 3 recommended actions</h3>
            {recommendations.length ? recommendations.slice(0, 3).map((item, index) => <div className="panelHint" key={index}>{item}</div>) : <div className="panelHint">Run analysis first to view this section.</div>}
            <div className="btnRow single" style={{ marginTop: 12 }}><a className="download secondary" href="#action-plan">View full action plan</a></div>
          </div>
        </div>
      </section>

      <section id="action-plan">
        <SectionTitle icon={<Sparkles size={18} />} title="Action Plan" subtitle="Supportive actions and next steps." />
        <div className="card">
          {recommendations.length ? recommendations.slice(0, 5).map((item, index) => <div className="panelHint" key={index}>{item}</div>) : <div className="panelHint">Run analysis first to view this section.</div>}
        </div>
      </section>

      <section id="report">
        <SectionTitle icon={<FileText size={18} />} title="Report" subtitle="Download the PDF report." />
        <div className="card reportCta">
          <div><b>Download PDF report</b><div className="muted">Includes the executive summary, hotspots, action plan, and responsible-use notes.</div></div>
          <a className={`download ${s.datasetId ? '' : 'disabledLink'}`} href={s.datasetId ? `${API_BASE}/analysis/${s.datasetId}/report` : undefined as any}><FileText size={18} /> Download PDF report</a>
        </div>
      </section>

      <section id="ask">
        <SectionTitle icon={<Search size={18} />} title="Chatbot" subtitle="Ask Retainly only if it is working." />
        <div className="card"><div className="panelHint">{dashboardReady ? 'Open the Chatbot tab to ask questions about the current analysis.' : 'Run analysis first to view this section.'}</div></div>
      </section>
    </div>
  );
}
