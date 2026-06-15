import React from 'react';
import { useAppState } from '../state';
import { EmptyState, PageShell, SectionCard } from '../components/PageLayout';

function Empty({ text }: { text: string }) {
  return <div className="card"><div className="panelHint">{text}</div></div>;
}

function hotspotWhy(segmentName: string, group: string, averageRisk: number) {
  const moderateNote = averageRisk < 0.6 ? 'This is one of the highest segments in this upload, but absolute risk remains moderate.' : 'This segment stands out for prioritized retention support.';
  if (segmentName === 'Department') return `Department-level concentration may indicate workload, compensation, manager, or process friction. ${moderateNote}`;
  if (segmentName === 'JobRole') return `Role-level concentration may indicate workload, growth-path, pay, or manager enablement gaps. ${moderateNote}`;
  if (segmentName === 'OverTime') return `Workload and overtime patterns are often preventable retention risks when they persist over time. ${moderateNote}`;
  return `This pattern helps explain where retention support appears most needed in the current upload. ${moderateNote}`;
}

function hotspotResponse(segmentName: string, group: string) {
  if (segmentName === 'Department') return `Run an HRBP review for ${group}, check workload, promotion visibility, compensation bands, and manager feedback.`;
  if (segmentName === 'JobRole') return `Use stay interviews, workload review, and career path clarification for employees in ${group}.`;
  if (segmentName === 'OverTime') return `Review sustained overtime expectations, rebalance staffing, and schedule supportive manager check-ins.`;
  if (segmentName === 'JobSatisfaction') return `Review satisfaction drivers, manager support, workload fairness, and day-to-day blockers for this group.`;
  if (segmentName === 'YearsAtCompany') return `Use onboarding or growth-path support depending on tenure stage, and validate with manager context.`;
  return 'Review the underlying team context and use a supportive retention intervention.';
}

function segmentDerivation(segmentName: string, group: string) {
  if (segmentName === 'Department') return `Average employee risk score within ${group} compared with other departments.`;
  if (segmentName === 'JobRole') return `Average employee risk score among employees in the ${group} role.`;
  if (segmentName === 'OverTime') return `Average employee risk score within the overtime/workload group ${group}.`;
  return `Average employee risk score within the ${segmentName} group ${group}.`;
}

function HotspotCard({ item }: { item: any }) {
  const risk = Number(item?.average_predicted_risk || 0);
  return (
    <div className="hotspotCard">
      <div className="hotspotHead">
        <div>
          <h4>{String(item?.group || 'Unknown segment')}</h4>
          <div className="muted tiny">{String(item?.segment_name || 'Segment hotspot')}</div>
        </div>
        <span className={`priorityTag ${String(item?.priority || 'Low').toLowerCase() === 'high' ? 'high' : String(item?.priority || 'Low').toLowerCase() === 'medium' ? 'medium' : 'low'}`}>{String(item?.priority || 'Low')}</span>
      </div>
      <div className="hotspotMetaGrid">
        <div className="statMini"><span>Average risk</span><b>{Math.round(risk * 100)}%</b></div>
        <div className="statMini"><span>Employees</span><b>{String(item?.employee_count || 0)}</b></div>
      </div>
      <div className="actionField">
        <b>How derived</b>
        <p>{segmentDerivation(String(item?.segment_name || ''), String(item?.group || ''))}</p>
      </div>
      <div className="actionField">
        <b>Why it matters</b>
        <p>{hotspotWhy(String(item?.segment_name || ''), String(item?.group || ''), risk)}</p>
      </div>
      <div className="actionField">
        <b>Suggested HR response</b>
        <p>{hotspotResponse(String(item?.segment_name || ''), String(item?.group || ''))}</p>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const s = useAppState();
  const hasUploadedDataset = Boolean(s.datasetId || s.file);
  const hasValidResults = s.phase === 'completed' && s.results?.status === 'completed' && Array.isArray(s.results?.employee_risk);
  if (!hasValidResults) {
    return <PageShell title="Hotspots" subtitle="Risk concentration by department, role, workload, satisfaction, and tenure."><EmptyState title="Run analysis first to view this section." description={hasUploadedDataset ? 'Hotspot analysis will appear after analysis completes.' : 'Upload HR data to begin hotspot analysis.'} /></PageShell>;
  }

  const topRiskSegments = Array.isArray(s.results.risk_segments) ? [...s.results.risk_segments].sort((a, b) => Number(b.average_predicted_risk || 0) - Number(a.average_predicted_risk || 0)) : [];
  const departments = topRiskSegments.filter((r: any) => String(r.segment_name) === 'Department').slice(0, 5);
  const roles = topRiskSegments.filter((r: any) => String(r.segment_name) === 'JobRole').slice(0, 5);
  const workloadPatterns = topRiskSegments.filter((r: any) => String(r.segment_name) === 'OverTime').slice(0, 3);
  const experiencePatterns = topRiskSegments.filter((r: any) => ['JobSatisfaction', 'YearsAtCompany'].includes(String(r.segment_name))).slice(0, 4);

  return (
    <PageShell title="Hotspots" subtitle="Risk concentration by department, role, workload, satisfaction, and tenure.">
      <div className="pageHeader">
        <div>
          <h2>Hotspots</h2>
          <p className="muted">Segment-level retention risk only.</p>
        </div>
      </div>
      <div className="grid two">
        <SectionCard title="Department hotspots" subtitle="Average risk, team size, why it matters, and supportive HR response.">
          <div className="hotspotList">{departments.length ? departments.map((r: any) => <HotspotCard key={`${r.segment_name}-${r.group}`} item={r} />) : <Empty text="No department hotspot data available." />}</div>
        </SectionCard>
        <SectionCard title="Role hotspots" subtitle="Role-level concentration and recommended supportive follow-up.">
          <div className="hotspotList">{roles.length ? roles.map((r: any) => <HotspotCard key={`${r.segment_name}-${r.group}`} item={r} />) : <Empty text="No role hotspot data available." />}</div>
        </SectionCard>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <SectionCard title="Workload / overtime patterns" subtitle="Patterns derived from overtime or workload-related groupings.">
          <div className="hotspotList">{workloadPatterns.length ? workloadPatterns.map((item: any) => <HotspotCard key={`${item.segment_name}-${item.group}`} item={item} />) : <Empty text="No workload or overtime pattern available." />}</div>
        </SectionCard>
        <SectionCard title="Satisfaction / tenure patterns" subtitle="Experience patterns that help explain where retention support is concentrated.">
          <div className="hotspotList">{experiencePatterns.length ? experiencePatterns.map((item: any) => <HotspotCard key={`${item.segment_name}-${item.group}`} item={item} />) : <div className="panelHint">Review the segment groupings above to understand where retention support is concentrated.</div>}</div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
