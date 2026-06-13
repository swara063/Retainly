import React from 'react';
import { AlertTriangle, BarChart3, FileText, Search, ShieldCheck, Sparkles, Upload, Users } from 'lucide-react';
import { API_BASE, fetchJson, sleep, uploadCsvWithProgress } from '../api';
import AgentTimeline from '../components/AgentTimeline';
import ConfusionMatrix from '../components/ConfusionMatrix';
import FeatureBarChart from '../components/FeatureBarChart';
import ProgressBar from '../components/ProgressBar';
import { useAppDispatch, useAppState } from '../state';

function SectionTitle({ icon, title, subtitle, id }: { icon: React.ReactNode; title: string; subtitle?: string; id?: string }) {
  return (
    <div className="sectionHeader" id={id}>
      <div className="sectionIcon">{icon}</div>
      <div>
        <h2>{title}</h2>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  return (
    <div className={`statCard ${tone || 'neutral'}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function numOrDash(x: any, digits = 3) {
  const n = Number(x);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function bandTone(v: string) {
  const s = String(v || '').toLowerCase();
  if (s.includes('high') || s.includes('critical')) return 'bad';
  if (s.includes('medium')) return 'warn';
  if (s.includes('low')) return 'good';
  return 'neutral';
}

function calibrationStatus(metrics: any) {
  const calibration = metrics?.calibration || {};
  const gap = Number(calibration.calibration_gap);
  const brier = Number(calibration.brier_score);
  if ((calibration.warning && String(calibration.warning).length) || (Number.isFinite(gap) && gap >= 0.12) || (Number.isFinite(brier) && brier >= 0.22)) {
    return { label: 'Directional', tone: 'warn' as const };
  }
  return { label: 'Calibrated', tone: 'good' as const };
}

function scrubCalibrationWarning(value: any) {
  const clone = JSON.parse(JSON.stringify(value ?? {}));
  if (clone?.metrics?.calibration?.warning) {
    clone.metrics.calibration.warning = 'Hidden in compact view';
  }
  return clone;
}

function getRiskSegments(results: any, segmentName: string) {
  const segs = Array.isArray(results?.risk_segments) ? results.risk_segments : [];
  return segs.filter((s: any) => s?.segment_name === segmentName).slice(0, 4);
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
  const [detailLoading, setDetailLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function loadPreview() {
      if (!s.datasetId) return;
      try {
        const data = await fetchJson(`${API_BASE}/datasets/${s.datasetId}/preview`);
        if (cancelled) return;
        setPreview(data);
      } catch (e: any) {
        if (!cancelled) {
          set((p) => ({ ...p, error: e?.message || 'Failed to load smart import summary.' }));
        }
      }
    }
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [s.datasetId, set]);

  React.useEffect(() => {
    if (!s.datasetId) return;
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
        if (cancelled) return;
        setEmployeeExplorer(data);
      } catch (e: any) {
        if (!cancelled) {
          set((p) => ({ ...p, error: e?.message || 'Failed to load employee explorer.' }));
        }
      } finally {
        if (!cancelled) setEmployeeLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [s.datasetId, employeeQuery, employeeDepartment, employeeJobRole, employeeRiskBand, employeeSort, set]);

  React.useEffect(() => {
    if (!selectedEmployee || !s.datasetId) {
      setSelectedEmployeeDetail(null);
      return;
    }
    let cancelled = false;
    async function loadDetail() {
      try {
        setDetailLoading(true);
        const data = await fetchJson(`${API_BASE}/analysis/${s.datasetId}/employees/${selectedEmployee.row_index}`);
        if (!cancelled) setSelectedEmployeeDetail(data);
      } catch (e: any) {
        if (!cancelled) {
          set((p) => ({ ...p, error: e?.message || 'Failed to load employee detail.' }));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [s.datasetId, selectedEmployee, set]);

  async function uploadOnly(fileOverride?: File | null) {
    const file = fileOverride || s.file;
    if (!file) return;
    set((p) => ({ ...p, error: '', results: null, hrTimeline: [], developerDiagnostics: [], datasetId: '', columns: [], rows: null, loading: true, phase: 'uploading', uploadPct: 0 }));
    try {
      const data = await uploadCsvWithProgress(file, (pct) => set((p) => ({ ...p, uploadPct: pct })));
      if (!data?.dataset_id) throw new Error('Upload succeeded but no dataset id was returned.');
      set((p) => ({ ...p, datasetId: data.dataset_id, columns: data.columns || [], rows: typeof data.rows === 'number' ? data.rows : null, uploadPct: 100 }));
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Upload failed.' }));
    } finally {
      set((p) => ({ ...p, loading: false, phase: 'idle' }));
      setTimeout(() => set((p) => ({ ...p, uploadPct: 0 })), 700);
    }
  }

  async function handleFileChange(file: File | null) {
    set((p) => ({ ...p, file }));
    if (file) {
      await uploadOnly(file);
    }
  }

  async function analyze() {
    if (!s.file || !s.datasetId) return;
    set((p) => ({ ...p, error: '', results: null, hrTimeline: [], developerDiagnostics: [], loading: true, phase: 'analyzing' }));
    try {
      await fetchJson(`${API_BASE}/analysis/${s.datasetId}/run?async_mode=true`, { method: 'POST' });
      const startedAt = Date.now();
      const deadlineMs = 1000 * 60 * 8;
      let completed = false;
      while (Date.now() - startedAt < deadlineMs) {
        const [logsRes, resultsRes] = await Promise.allSettled([
          fetchJson(`${API_BASE}/analysis/${s.datasetId}/logs`).catch(() => ({ hr_timeline: [], developer_diagnostics: [] })),
          fetch(`${API_BASE}/analysis/${s.datasetId}/results`),
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
            set((p) => ({ ...p, results: data }));
            completed = true;
            break;
          }
        }
        await sleep(900);
      }
      if (!completed) throw new Error('Analysis did not finish in time. Please try again with a smaller CSV or check the backend logs.');
    } catch (e: any) {
      set((p) => ({ ...p, error: e?.message || 'Analysis failed.' }));
    } finally {
      set((p) => ({ ...p, loading: false, phase: 'idle' }));
      setTimeout(() => set((p) => ({ ...p, uploadPct: 0 })), 700);
    }
  }

  const results = s.results || {};
  const exec = results.executive_summary || {};
  const model = results.model || {};
  const metrics = model.metrics || {};
  const fairness = results.fairness || {};
  const confidenceSummary = results.confidence_summary || model.confidence_summary || {};
  const retentionPlan = Array.isArray(results.retention_plan) ? results.retention_plan : [];
  const topDept = getRiskSegments(results, 'Department');
  const topRoles = getRiskSegments(results, 'JobRole');
  const overtime = getRiskSegments(results, 'OverTime');
  const satisfaction = getRiskSegments(results, 'JobSatisfaction');
  const tenure = getRiskSegments(results, 'YearsAtCompany');
  const topDrivers = Array.isArray(results?.explainability?.top_features) ? results.explainability.top_features.slice(0, 8) : [];

  const inferredTarget = preview?.inferred_target_column;
  const importWarnings = Array.isArray(preview?.warnings) ? preview.warnings : [];
  const attritionFieldDetected = Boolean(inferredTarget);
  const detectedConfidenceLow = !attritionFieldDetected || importWarnings.length >= 2;

  const smartImportScore = Number(results?.data_quality?.data_quality_score ?? preview?.data_quality_score ?? 0);
  const highestRiskSegment = (() => {
    const candidates = [...topDept, ...topRoles, ...overtime, ...satisfaction, ...tenure];
    if (!candidates.length) return '—';
    const sorted = [...candidates].sort((a, b) => (Number(b.average_predicted_risk || 0) - Number(a.average_predicted_risk || 0)));
    const pick = sorted[0];
    return `${pick.segment_name}: ${pick.group}`;
  })();

  const prioritySegmentCount = Array.isArray(results?.employee_risk)
    ? results.employee_risk.filter((r: any) => ['High', 'Critical'].includes(String(r?.risk_band))).length
    : Number(exec.high_risk_employees || 0);

  const selectedModel = model.selected_model || '—';
  const modelReliability = metrics.model_reliability_label || exec.model_reliability_label || '—';
  const calibration = calibrationStatus(metrics);
  const fairnessRisk = fairness.overall_risk || exec.fairness_risk || '—';

  const confidenceText = confidenceSummary.plain_english || (detectedConfidenceLow
    ? 'Retainly could use a quick check on the outcome field, so the smart import summary is shown with a caution note.'
    : 'Retainly understood your dataset and found the fields needed for retention analysis.');

  const canRun = Boolean(s.datasetId) && !s.loading;
  const employeeFilters = employeeExplorer?.available_filters || { departments: [], job_roles: [], risk_bands: [], employee_labels: [] };

  return (
    <div className="dashboard">
      <section className="heroNew">
        <div className="heroText">
          <div className="eyebrow">Retainly</div>
          <h1>Retention Command Center for HR Teams</h1>
          <p className="subtitle">Upload HR data and get attrition hotspots, fairness signals, and a practical retention action plan.</p>
          <div className="heroCtas">
            <button className="primary" onClick={() => document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' })}>
              Upload HR CSV
            </button>
            <span className="heroNote">No coding. No ML setup. Decision-support only.</span>
          </div>
          <div className="pillRow">
            <span className="pill"><Users size={16} /> HR-ready summary</span>
            <span className="pill"><ShieldCheck size={16} /> Fairness checks</span>
            <span className="pill"><Sparkles size={16} /> Action planning</span>
          </div>
        </div>
          <div className="heroAside card">
            <div className="asideTitle">
              <b>Workflow</b>
              <span className="muted">Simple retention flow</span>
            </div>
          <ol className="steps">
            <li className={s.file ? 'done' : ''}><span>1</span> Upload HR data</li>
            <li className={s.datasetId ? 'done' : ''}><span>2</span> Smart import</li>
            <li className={s.results ? 'done' : ''}><span>3</span> Run retention analysis</li>
            <li className={s.results?.retention_plan?.length ? 'done' : ''}><span>4</span> Review action plan</li>
          </ol>
          <div className="panelHint">Need an explanation? Open the chatbot from the top bar for HR questions on this dataset.</div>
          <div className="panelHint">Retainly reads your file, highlights where risk is concentrated, and turns it into a practical retention plan.</div>
        </div>
      </section>

      <section id="upload">
        <SectionTitle icon={<Upload size={18} />} title="Upload HR data" subtitle="Drop in an HR export and Retainly will prepare the import summary." />
        <div className="grid two">
          <div className="card uploadPanel">
            <div className="panelTitle">
              <Upload size={18} />
              <div>
                <b>Step 1 - Upload HR data</b>
                <div className="muted">CSV only. Your file stays within this Retainly workspace.</div>
              </div>
            </div>
            <label className="fileBox">
              <Upload size={18} />
              <input type="file" accept=".csv" onChange={(e) => void handleFileChange(e.target.files?.[0] || null)} />
              <div className="fileMeta">
                <b>{s.file?.name || 'Choose an HR CSV file'}</b>
                <span className="muted">{s.datasetId ? 'Smart import complete' : 'Uploading and preparing smart import'}</span>
              </div>
            </label>
            {s.phase === 'uploading' && <ProgressBar pct={s.uploadPct} label={`${s.uploadPct}% uploaded`} />}
            <div className="btnRow">
              <button onClick={() => void uploadOnly()} disabled={s.loading || !s.file}>{s.datasetId ? 'Re-upload' : 'Upload'}</button>
              <button className="primary" onClick={analyze} disabled={!canRun}>
                Run Retention Analysis
              </button>
            </div>
            {!s.datasetId ? <div className="panelHint"><b>Next:</b> Upload is in progress or pending. Retainly will enable analysis as soon as import finishes.</div> : null}
            <div className="panelHint">
              <b>{confidenceSummary.label ? `Confidence level: ${confidenceSummary.label}.` : 'Confidence level: Directional.'}</b> {confidenceText}
              {confidenceSummary.recommended_use ? <div className="muted tiny" style={{ marginTop: 6 }}>{confidenceSummary.recommended_use}</div> : null}
            </div>
            <div className="btnRow single" style={{ marginTop: 10 }}>
              <button className="primary" type="button" onClick={analyze} disabled={!canRun}>Run Retention Analysis</button>
            </div>
            {s.error ? <div className="panelError"><AlertTriangle size={16} /> {s.error}</div> : null}
          </div>

          <div className="card uploadPanel">
            <div className="panelTitle">
              <Sparkles size={18} />
              <div>
                <b>Step 2 - Smart import</b>
                <div className="muted">Retainly summarizes what it found in your dataset.</div>
              </div>
            </div>
            {s.datasetId ? (
              <>
                <div className="panelHero">
                  <b>{confidenceSummary.plain_english || confidenceText}</b>
                  <p className="muted">{confidenceSummary.limitations || 'This summary explains what will be used for retention analysis in plain English.'}</p>
                </div>
                <div className="summaryGrid">
                  <StatCard label="Employees detected" value={String(s.rows ?? s.results?.dataset_profile?.rows ?? '—')} />
                  <StatCard label="Columns detected" value={String(preview?.columns?.length || s.columns.length || '—')} />
                  <StatCard label="Attrition field detected" value={attritionFieldDetected ? 'Yes' : 'Needs review'} tone={attritionFieldDetected ? 'good' : 'warn'} />
                  <StatCard label="Department / role fields detected" value={preview?.inferred_categorical_columns?.some((c: string) => /department|jobrole/i.test(c)) ? 'Yes' : 'Partial'} />
                  <StatCard label="Engagement / workload signals detected" value={preview?.inferred_categorical_columns?.some((c: string) => /satisfaction|overtime|worklife|absentee|promotion|salary|rating/i.test(c)) ? 'Yes' : 'Partial'} />
                  <StatCard label="Fairness check fields detected" value={preview?.inferred_sensitive_attributes?.length ? 'Yes' : 'Limited'} />
                  <StatCard label="Data quality score" value={smartImportScore ? `${smartImportScore}/100` : '—'} tone={smartImportScore >= 75 ? 'good' : smartImportScore >= 55 ? 'warn' : 'bad'} />
                </div>
                <div className="panelHint">
                  <b>Plain-English summary:</b> Retainly understood your dataset and found the fields needed for retention analysis.
                </div>
                {importWarnings.length ? (
                  <div className="panelWarn">
                    <b>Notes:</b>
                    <ul>
                      {importWarnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                ) : (
                  <div className="panelHint">Smart import looks ready.</div>
                )}
              </>
            ) : (
              <div className="emptyPreview">
                <b>Smart import summary will appear here after upload.</b>
                <p className="muted">You will see employees detected, data quality, and any plain-English warnings before running analysis.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="command-center">
        <SectionTitle icon={<Users size={18} />} title="Retention Command Center" subtitle="The most important HR signals appear first." />
          <div className="grid four">
            <StatCard label="Employees analyzed" value={String(exec.rows_analyzed ?? s.results?.dataset_profile?.rows ?? '—')} />
            <StatCard label="Observed attrition rate" value={exec.attrition_rate != null ? `${Math.round(Number(exec.attrition_rate) * 100)}%` : '—'} />
            <StatCard label="Highest-risk segment" value={highestRiskSegment} tone="warn" />
            <StatCard label="Employees in priority segments" value={String(prioritySegmentCount || '—')} tone="warn" />
            <StatCard label="Confidence level" value={String(modelReliability)} tone={bandTone(String(modelReliability))} />
            <StatCard label="Risk score quality" value={calibration.label} tone={calibration.tone} />
            <StatCard label="Fairness risk" value={String(fairnessRisk)} tone={bandTone(String(fairnessRisk))} />
          </div>
        {!s.results ? (
          <div className="card previewPanel">
            <b>What this section will show after analysis</b>
            <p className="muted">A concise view of where retention risk is concentrated, which teams need attention, and whether the model can be trusted enough for decision support.</p>
          </div>
        ) : null}
      </section>

      <section id="hotspots">
        <SectionTitle icon={<Sparkles size={18} />} title="What HR should do next" subtitle="Five prioritized actions to start with." />
        <div className="grid two">
          {(Array.isArray(results.retention_plan) && retentionPlan.length ? retentionPlan.slice(0, 5) : Array.from({ length: 5 })).map((action: any, index: number) => (
            <div className="card actionCard" key={index}>
              {action ? (
                <>
                  <div className="actionTop">
                    <span className={`priorityTag ${String(action.priority || 'Low').toLowerCase()}`}>{action.priority || 'Low'}</span>
                    <span className="muted tiny">{action.timeline || 'Timeline varies'}</span>
                  </div>
                  <h3>{action.title}</h3>
                  <div className="muted tiny"><b>Target group:</b> {action.target_segment || '—'}</div>
                  <div className="muted tiny" style={{ marginTop: 6 }}><b>Why it matters:</b> {action.reason || '—'}</div>
                  <div style={{ marginTop: 8 }}><b>Recommended HR action:</b> {action.recommended_action || '—'}</div>
                  <div className="panelHint" style={{ marginTop: 10 }}><b>Success metric:</b> {action.expected_business_impact || 'Track retention movement and manager feedback.'}</div>
                </>
              ) : (
                <div className="emptyPreview">
                  <b>Action card coming soon</b>
                  <p className="muted">After analysis, this slot becomes a prioritized retention action.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="employee-explorer">
        <SectionTitle icon={<Search size={18} />} title="At-Risk Employee Explorer" subtitle="Search, filter, and review employees with the highest retention-support priority." />
        {!s.results ? (
          <div className="card previewPanel">
            <b>Employee Explorer will appear after analysis</b>
            <p className="muted">Once analysis finishes, you can search by employee name or ID, filter by department, role, and risk band, and open a detailed support profile.</p>
          </div>
        ) : (
          <div className="grid two">
            <div className="card">
              <div className="btnRow single" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <label className="muted tiny">Search employee by name or ID</label>
                  <input
                    className="textInput"
                    placeholder="Search employee by name or ID"
                    list="employee-labels"
                    value={employeeQuery}
                    onChange={(e) => setEmployeeQuery(e.target.value)}
                  />
                  <datalist id="employee-labels">
                    {(employeeFilters.employee_labels || []).map((label: string) => <option key={label} value={label} />)}
                  </datalist>
                </div>
              </div>
              <div className="grid three" style={{ marginTop: 12 }}>
                <label>
                  <div className="muted tiny">Department</div>
                  <select value={employeeDepartment} onChange={(e) => setEmployeeDepartment(e.target.value)}>
                    <option value="">All</option>
                    {(employeeFilters.departments || []).map((value: string) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <div className="muted tiny">Job role</div>
                  <select value={employeeJobRole} onChange={(e) => setEmployeeJobRole(e.target.value)}>
                    <option value="">All</option>
                    {(employeeFilters.job_roles || []).map((value: string) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label>
                  <div className="muted tiny">Risk band</div>
                  <select value={employeeRiskBand} onChange={(e) => setEmployeeRiskBand(e.target.value)}>
                    <option value="">All</option>
                    {(employeeFilters.risk_bands || ['Low', 'Medium', 'High', 'Critical']).map((value: string) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </div>
              <div className="btnRow single" style={{ marginTop: 12 }}>
                <label className="muted tiny">
                  Sort
                  <select value={employeeSort} onChange={(e) => setEmployeeSort(e.target.value as 'risk_desc' | 'risk_asc')}>
                    <option value="risk_desc">Highest risk first</option>
                    <option value="risk_asc">Lowest risk first</option>
                  </select>
                </label>
                <div className="chip">{employeeExplorer.total || 0} employees</div>
              </div>
              {employeeExplorer.warnings?.length ? <div className="panelHint" style={{ marginTop: 12 }}>{employeeExplorer.warnings[0]}</div> : null}
              {employeeLoading ? <div className="panelHint" style={{ marginTop: 12 }}>Loading employee risk results...</div> : null}
              <div style={{ overflowX: 'auto', marginTop: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Risk</th>
                      <th>Band</th>
                      <th>Top factors</th>
                      <th>Suggested action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(employeeExplorer.records || []).length ? (employeeExplorer.records || []).map((item: any) => (
                      <tr key={item.row_index} style={{ cursor: 'pointer' }} onClick={() => setSelectedEmployee(item)}>
                        <td><b>{item.display_label}</b></td>
                        <td>{item.department || '—'}</td>
                        <td>{item.job_role || '—'}</td>
                        <td>{Number(item.risk_percent || 0).toFixed(0)}%</td>
                        <td><span className={`priorityTag ${String(item.risk_band || 'low').toLowerCase()}`}>{item.risk_band}</span></td>
                        <td>{(item.top_risk_factors || []).slice(0, 2).join('; ') || '—'}</td>
                        <td>{item.recommended_support_action || '—'}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7}><div className="emptyPreview">No matching employees found. Try a different search or filter.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3>Employee Risk Profile</h3>
              {selectedEmployeeDetail ? (
                <>
                  <div className="panelHero">
                    <b>{selectedEmployeeDetail.employee?.display_label || selectedEmployee?.display_label || 'Selected employee'}</b>
                    <p className="muted">{selectedEmployeeDetail.similar_segment_insight}</p>
                  </div>
                  <div className="summaryGrid">
                    <StatCard label="Employee name / ID" value={String(selectedEmployeeDetail.employee?.employee_name || selectedEmployeeDetail.employee?.employee_id || selectedEmployeeDetail.employee?.display_label || '—')} />
                    <StatCard label="Department" value={String(selectedEmployeeDetail.employee?.department || '—')} />
                    <StatCard label="Role" value={String(selectedEmployeeDetail.employee?.job_role || '—')} />
                    <StatCard label="Risk band" value={String(selectedEmployeeDetail.employee?.risk_band || '—')} tone={bandTone(String(selectedEmployeeDetail.employee?.risk_band || ''))} />
                    <StatCard label="Risk score" value={`${Number(selectedEmployeeDetail.employee?.risk_percent || 0).toFixed(0)}%`} tone="warn" />
                  </div>
                  <div className="panelHint"><b>Why this employee needs attention:</b> {selectedEmployeeDetail.employee?.top_risk_factors?.join('; ') || 'Review in context with the manager.'}</div>
                  <div className="panelHint"><b>Recommended HR support:</b> {selectedEmployeeDetail.recommended_support_action}</div>
                  <div className="panelHint"><b>Suggested talking points:</b> {(selectedEmployeeDetail.manager_hr_talking_points || []).join(' ')}</div>
                  <div className="panelHint"><b>Ethical reminder:</b> {selectedEmployeeDetail.ethical_note}</div>
                  <div className="panelHint"><b>Confidence summary:</b> {selectedEmployeeDetail.model_confidence_summary?.plain_english || 'Use as directional guidance.'}</div>
                  {selectedEmployeeDetail.employee?.raw_fields ? (
                    <details className="detailsBox" style={{ marginTop: 12 }}>
                      <summary>Selected safe fields</summary>
                      <pre className="pre">{JSON.stringify(selectedEmployeeDetail.employee.raw_fields, null, 2)}</pre>
                    </details>
                  ) : null}
                </>
              ) : (
                <div className="emptyPreview">
                  <b>{detailLoading ? 'Loading employee profile...' : 'Select an employee to see the detailed risk profile.'}</b>
                  <p className="muted">This view explains why the employee is a retention-support priority and what HR can do next.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <SectionTitle icon={<Sparkles size={18} />} title="Risk Hotspots" subtitle="Where attrition risk is concentrated, which groups need attention, and what pattern is driving risk." />
        <div className="grid three">
          <div className="card">
            <h3>Department hotspots</h3>
            {topDept.length ? topDept.map((r: any) => <div className="spotRow" key={`${r.segment_name}-${r.group}`}><b>{r.group}</b><span>{numOrDash(r.average_predicted_risk)}</span></div>) : <div className="emptyPreview">Department-level risk will appear here after analysis.</div>}
          </div>
          <div className="card">
            <h3>Job role hotspots</h3>
            {topRoles.length ? topRoles.map((r: any) => <div className="spotRow" key={`${r.segment_name}-${r.group}`}><b>{r.group}</b><span>{numOrDash(r.average_predicted_risk)}</span></div>) : <div className="emptyPreview">Role-level risk will appear here after analysis.</div>}
          </div>
          <div className="card">
            <h3>What pattern is driving risk</h3>
            {overtime.length || satisfaction.length || tenure.length ? (
              <div className="patternList">
                {overtime.slice(0, 2).map((r: any) => <div className="panelHint" key={`ot-${r.group}`}>Overtime: {r.group} signals {r.priority} attention.</div>)}
                {satisfaction.slice(0, 2).map((r: any) => <div className="panelHint" key={`js-${r.group}`}>Satisfaction: {r.group} is linked to {r.priority} retention priority.</div>)}
                {tenure.slice(0, 2).map((r: any) => <div className="panelHint" key={`yr-${r.group}`}>Tenure: {r.group} is where risk tends to cluster.</div>)}
              </div>
            ) : (
              <div className="emptyPreview">Patterns around overtime, satisfaction, and tenure will show here after analysis.</div>
            )}
          </div>
        </div>
      </section>

      <section id="report">
        <SectionTitle id="report" icon={<FileText size={18} />} title="Review action plan" subtitle="Download the PDF report for leadership review." />
        <div className="card reportCta">
          <div>
            <b>Download the Retainly report</b>
            <div className="muted">Includes the executive summary, hotspots, action plan, fairness notes, and appendix.</div>
          </div>
          <a className={`download ${s.datasetId ? '' : 'disabledLink'}`} href={s.datasetId ? `${API_BASE}/analysis/${s.datasetId}/report` : undefined as any}>
            <FileText size={18} /> Download PDF report
          </a>
        </div>
      </section>

      <section id="model-notes">
        <SectionTitle icon={<BarChart3 size={18} />} title="Model & Method Notes" subtitle="Secondary details for the team that wants to inspect the method later." />
        <details className="detailsBox">
          <summary>Open model and method notes</summary>
          <div className="grid two" style={{ marginTop: 12 }}>
            <div className="card">
              <h3>Model notes</h3>
              <table className="table">
                <tbody>
                  <tr><td>Selected model</td><td>{selectedModel}</td></tr>
                  <tr><td>Recall</td><td>{numOrDash(metrics.recall)}</td></tr>
                  <tr><td>Precision</td><td>{numOrDash(metrics.precision)}</td></tr>
                  <tr><td>F1</td><td>{numOrDash(metrics.f1)}</td></tr>
                  <tr><td>ROC-AUC</td><td>{numOrDash(metrics.roc_auc)}</td></tr>
                  <tr><td>PR-AUC</td><td>{numOrDash(metrics.pr_auc)}</td></tr>
                  <tr><td>Confidence level</td><td>{String(modelReliability)}</td></tr>
                  <tr><td>Risk score quality</td><td>{calibration.label}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>Confusion matrix</h3>
              <ConfusionMatrix matrix={model.confusion_matrix} />
            </div>
          </div>
          <details className="detailsBox" style={{ marginTop: 12 }}>
            <summary>Show compact model JSON</summary>
            <pre className="pre">{JSON.stringify(scrubCalibrationWarning({ selected_model: model.selected_model, metrics: model.metrics, confusion_matrix: model.confusion_matrix }), null, 2)}</pre>
          </details>
          <div className="card" style={{ marginTop: 12 }}>
            <h3>Top employee signals</h3>
            <FeatureBarChart features={topDrivers} />
          </div>
        </details>
      </section>

      <section id="timeline">
        <SectionTitle icon={<Sparkles size={18} />} title="Business-friendly timeline" subtitle="A simple status path, not a raw log feed." />
        <div className="card">
          <AgentTimeline items={s.hrTimeline} />
        </div>
      </section>

      <section>
        <details className="detailsBox">
          <summary>Developer diagnostics</summary>
          <div className="card" style={{ marginTop: 12 }}>
            <p className="muted">Collapsed by default. Technical details stay here for debugging and deployment checks.</p>
            {s.developerDiagnostics?.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {s.developerDiagnostics.map((item, index) => (
                    <tr key={`${item.timestamp || index}`}>
                      <td><b>{item.agent}</b></td>
                      <td>{String(item.status).toUpperCase()}</td>
                      <td>{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No developer diagnostics captured for this run.</p>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
