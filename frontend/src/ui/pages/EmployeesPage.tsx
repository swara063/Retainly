import React from 'react';
import { Search, Users } from 'lucide-react';
import { API_BASE, fetchJson } from '../api';
import { useAppDispatch, useAppState } from '../state';
import { EmptyState, PageShell, SectionCard } from '../components/PageLayout';

function toneForBand(band: string) {
  const b = String(band || '').toLowerCase();
  if (b.includes('critical') || b.includes('high')) return 'high';
  if (b.includes('medium')) return 'medium';
  return 'low';
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="emptyPreview"><b>{title}</b><p className="muted">{text}</p></div>;
}

export default function EmployeesPage() {
  const s = useAppState();
  const set = useAppDispatch();
  const [query, setQuery] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [jobRole, setJobRole] = React.useState('');
  const [riskBand, setRiskBand] = React.useState('');
  const [sort, setSort] = React.useState<'risk_desc' | 'risk_asc'>('risk_desc');
  const [explorer, setExplorer] = React.useState<any>({ records: [], total: 0, available_filters: { departments: [], job_roles: [], risk_bands: [], employee_labels: [] }, warnings: [] });
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<any | null>(null);
  const [detail, setDetail] = React.useState<any | null>(null);

  React.useEffect(() => {
    if (!s.datasetId || !s.results) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (query.trim()) params.set('search', query.trim());
        if (department) params.set('department', department);
        if (jobRole) params.set('job_role', jobRole);
        if (riskBand) params.set('risk_band', riskBand);
        params.set('sort', sort);
        params.set('limit', '100');
        const data = await fetchJson(`${API_BASE}/analysis/${s.datasetId}/employees?${params.toString()}`);
        if (!cancelled) setExplorer(data);
      } catch (e: any) {
        if (!cancelled) set((p) => ({ ...p, error: e?.message || 'Failed to load employee risk list.' }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [s.datasetId, s.results, query, department, jobRole, riskBand, sort, set]);

  React.useEffect(() => {
    if (!selected || !s.datasetId) { setDetail(null); return; }
    let cancelled = false;
    async function loadDetail() {
      try {
        const data = await fetchJson(`${API_BASE}/analysis/${s.datasetId}/employees/${selected.row_index}`);
        if (!cancelled) setDetail(data);
      } catch (e: any) {
        if (!cancelled) set((p) => ({ ...p, error: e?.message || 'Failed to load employee profile.' }));
      }
    }
    loadDetail();
    return () => { cancelled = true; };
  }, [selected, s.datasetId, set]);

  const filters = explorer.available_filters || { departments: [], job_roles: [], risk_bands: [], employee_labels: [] };
  if (!s.datasetId) {
    return <PageShell title="Employees" subtitle="Employee search, ranking, and profile only."><EmptyState title="Run analysis to view employee risk ranking." description="Simple ranking and profile view will appear here after analysis." /></PageShell>;
  }

  if (!s.results) {
    return <PageShell title="Employees" subtitle="Employee search, ranking, and profile only."><EmptyState title="Run analysis to view employee risk ranking." description="Simple ranking and profile view will appear here after analysis." /></PageShell>;
  }

  return (
    <PageShell title="Employees" subtitle="Employee search, ranking, and profile only.">
      <div className="pageHeader">
        <div>
          <h2>At-Risk Employee Explorer</h2>
          <p className="muted">Search by employee name or ID, filter by team signals, and open a supportive retention profile.</p>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="panelTitle"><Search size={18} /><div><b>Find an employee</b><div className="muted">Use the dropdown suggestions or type any part of the name/ID.</div></div></div>
          <div className="grid one" style={{ marginTop: 14 }}>
            <label>
              <div className="muted tiny">Employee name or ID</div>
              <input className="textInput" placeholder="Start typing employee name or ID" list="employee-labels-page" value={query} onChange={(e) => setQuery(e.target.value)} />
              <datalist id="employee-labels-page">
                {(filters.employee_labels || []).map((label: string) => <option key={label} value={label} />)}
              </datalist>
            </label>
          </div>
          <div className="grid three" style={{ marginTop: 12 }}>
            <label><div className="muted tiny">Department</div><select value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">All</option>{(filters.departments || []).map((v: string) => <option key={v} value={v}>{v}</option>)}</select></label>
            <label><div className="muted tiny">Job role</div><select value={jobRole} onChange={(e) => setJobRole(e.target.value)}><option value="">All</option>{(filters.job_roles || []).map((v: string) => <option key={v} value={v}>{v}</option>)}</select></label>
            <label><div className="muted tiny">Risk band</div><select value={riskBand} onChange={(e) => setRiskBand(e.target.value)}><option value="">All</option>{(filters.risk_bands || ['Low', 'Medium', 'High', 'Critical']).map((v: string) => <option key={v} value={v}>{v}</option>)}</select></label>
          </div>
          <div className="btnRow single" style={{ marginTop: 12 }}>
            <label className="muted tiny">Sort<select value={sort} onChange={(e) => setSort(e.target.value as 'risk_desc' | 'risk_asc')}><option value="risk_desc">Most at-risk first</option><option value="risk_asc">Least at-risk first</option></select></label>
            <div className="chip">Showing {explorer.records?.length || 0} of {explorer.total || 0}</div>
          </div>
          {loading ? <div className="panelHint" style={{ marginTop: 12 }}>Loading employee risk list...</div> : null}
          {explorer.warnings?.length ? <div className="panelHint" style={{ marginTop: 12 }}>{explorer.warnings[0]}</div> : null}
        </div>

        <div className="card">
          <div className="panelTitle"><Users size={18} /><div><b>How to use this page</b><div className="muted">Supportive intervention, not punitive action.</div></div></div>
          <div className="panelHint" style={{ marginTop: 12 }}><b>Recommended use:</b> Start with the highest risk bands, validate with HR context, and plan stay interviews, workload review, manager coaching, or growth-path support.</div>
          <div className="panelHint"><b>Privacy note:</b> Results are row-level decision-support signals. Do not use them as the sole basis for employment action.</div>
        </div>
      </div>

      <div className="grid two">
        <div className="card employeeListCard">
          <h3>Employees ranked by retention risk</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Employee</th><th>Department</th><th>Role</th><th>Risk score</th><th>Risk band</th><th>Priority rank</th><th>Top factors</th></tr></thead>
              <tbody>
                {(explorer.records || []).length ? explorer.records.map((item: any) => (
                  <tr key={item.row_index} className={selected?.row_index === item.row_index ? 'selectedRow' : ''} onClick={() => setSelected(item)} style={{ cursor: 'pointer' }}>
                    <td><b>{item.display_label}</b></td>
                    <td>{item.department || '—'}</td>
                    <td>{item.job_role || '—'}</td>
                    <td>{Number(item.risk_percent || 0).toFixed(0)}%</td>
                    <td><span className={`priorityTag ${toneForBand(item.risk_band)}`}>{item.risk_band}</span></td>
                    <td>{item.priority_tier || '—'}</td>
                    <td>{(item.top_risk_factors || []).slice(0, 2).join('; ') || '—'}</td>
                  </tr>
                )) : <tr><td colSpan={7}><Empty title="No matching employees found" text="Clear the search or filters to see the full ranking." /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Employee retention-support profile</h3>
          {detail ? (
            <>
              <div className="panelHero"><b>{detail.employee?.display_label || 'Selected employee'}</b><p className="muted">{detail.similar_segment_insight}</p></div>
              <div className="summaryGrid" style={{ marginTop: 12 }}>
                <div className="statCard"><span>Name / ID</span><b>{String(detail.employee?.employee_name || detail.employee?.employee_id || detail.employee?.display_label || '—')}</b></div>
                <div className="statCard"><span>Department</span><b>{String(detail.employee?.department || '—')}</b></div>
                <div className="statCard"><span>Role</span><b>{String(detail.employee?.job_role || '—')}</b></div>
                <div className="statCard"><span>Risk score</span><b>{Number(detail.employee?.risk_percent || 0).toFixed(0)}%</b></div>
                <div className="statCard"><span>Priority rank</span><b>{String(detail.employee?.priority_tier || '—')}</b></div>
              </div>
              <div className="panelHint"><b>Why this employee needs attention:</b> {detail.employee?.top_risk_factors?.join('; ') || 'Review with manager context.'}</div>
              <div className="panelHint"><b>Recommended HR support:</b> {detail.recommended_support_action}</div>
              <div className="panelHint"><b>Talking points:</b> {(detail.manager_hr_talking_points || []).join(' ')}</div>
              <div className="panelHint"><b>Ethical reminder:</b> {detail.ethical_note}</div>
            </>
          ) : <Empty title="Select an employee" text="Click any row to see the individual support profile, reasons, and suggested HR talking points." />}
        </div>
      </div>
    </PageShell>
  );
}
