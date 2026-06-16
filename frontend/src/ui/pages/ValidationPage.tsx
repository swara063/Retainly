import React from 'react';
import { Download, ExternalLink } from 'lucide-react';
import { PageShell, SectionCard } from '../components/PageLayout';

const asset = (path: string) => path;

const buttons = [
  {
    label: 'Open runnable Colab notebook',
    href: 'https://colab.research.google.com/github/swara063/Retainly/blob/main/notebooks/retainly_validation_colab_upload_notebook_v4.ipynb',
    description: 'Upload your own labeled attrition CSVs and reproduce the comparison.',
    primary: true,
    external: true,
  },
  {
    label: 'Download hosted notebook',
    href: asset('/notebooks/retainly_validation_colab_upload_notebook_v4.ipynb'),
    description: 'Hosted unrun notebook file for manual Colab upload if needed.',
    primary: false,
  },
  {
    label: 'View executed validation proof',
    href: asset('/project_docs/retainly_validation_proof.pdf'),
    description: 'View the already-run validation proof used for this project.',
    primary: true,
  },
  {
    label: 'Download results CSV',
    href: asset('/research_outputs/dataset_comparison_results.csv'),
    description: 'Metric-level comparison across all validation datasets.',
    primary: false,
  },
  {
    label: 'Download summary JSON',
    href: asset('/research_outputs/dataset_comparison_summary.json'),
    description: 'Averaged baseline and Retainly validation summary.',
    primary: false,
  },
  {
    label: 'Open charts folder',
    href: asset('/research_outputs/'),
    description: 'Static v4 charts and exported validation files.',
    primary: false,
  },
];

const datasets = [
  {
    name: 'IBM HR Attrition',
    detail: 'Realistic imbalanced HR attrition benchmark.',
  },
  {
    name: 'Employee Attrition Prediction Dataset',
    detail: 'Independent labeled attrition dataset used to test generalization.',
  },
  {
    name: 'Synthetic 74k Attrition Dataset',
    detail: 'Synthetic stress-test dataset used to test scaling and workflow robustness.',
  },
];

const metrics = [
  { label: 'Accuracy', baseline: '0.797', retainly: '0.711', winner: 'Baseline' },
  { label: 'Precision', baseline: '0.632', retainly: '0.412', winner: 'Baseline' },
  { label: 'Recall', baseline: '0.362', retainly: '0.563', winner: 'Retainly' },
  { label: 'F1', baseline: '0.408', retainly: '0.476', winner: 'Retainly' },
  { label: 'ROC-AUC', baseline: '0.677', retainly: '0.685', winner: 'Retainly' },
  { label: 'Final decision-support score', baseline: '0.449', retainly: '0.695', winner: 'Retainly' },
];

const charts = [
  {
    title: 'Core metric comparison',
    src: asset('/research_outputs/dataset_comparison_core_metrics.png'),
    caption: 'Core metrics compare normal baseline ML against Retainly. Baseline is more conservative on accuracy and precision, while Retainly improves recall, F1, ROC-AUC, and final decision-support value.',
  },
  {
    title: 'Top-k ranking metrics',
    src: asset('/research_outputs/dataset_comparison_topk_metrics.png'),
    caption: 'Top-k metrics evaluate whether the highest-ranked employees contain actual leavers. These are computed using probability-ranked risk scores, not hard class labels.',
  },
  {
    title: 'Final decision-support score',
    src: asset('/research_outputs/dataset_comparison_final_score.png'),
    caption: 'The final decision-support score combines predictive performance with platform capabilities such as model selection, explainability, HR actions, agent traceability, and Fair Use Check.',
  },
  {
    title: 'Fair Use Check summary',
    src: asset('/research_outputs/fair_use_check_summary.png'),
    caption: 'Fair Use Check verifies that sensitive fields were removed from scoring and that validation results are suitable for supportive HR review.',
  },
];

const agents = [
  {
    name: 'Project Manager Agent',
    detail: 'Created repeatable validation workflow and tracked each stage.',
  },
  {
    name: 'Data Analyst Agent',
    detail: 'Detected attrition target, removed ID/leakage/sensitive fields, and prepared features.',
  },
  {
    name: 'ML Engineer Agent',
    detail: 'Compared candidate models, tuned thresholds, and selected the Retainly model.',
  },
  {
    name: 'Insights Agent',
    detail: 'Generated top drivers, HR actions, charts, Fair Use Check, and final summary.',
  },
];

const topDrivers = [
  ['employee_attrition_datasettrain', 'Monthly: Income', '0.149'],
  ['employee_attrition_datasettrain', 'Hourly: Rate', '0.135'],
  ['employee_attrition_datasettrain', 'Training hours last year', '0.111'],
  ['employee_attrition_datasettrain', 'Distance from home', '0.089'],
  ['employee_attrition_datasettrain', 'Work-life balance', '0.050'],
  ['employee_attrition_datasettrain', 'Absenteeism', '0.047'],
  ['employee_attrition_datasettrain', 'Years in current role', '0.045'],
  ['employee_attrition_datasettrain', 'Years at company', '0.043'],
];

const hrActions = [
  ['employee_attrition_datasettrain', 'Monthly: Income', 'High', 'Review compensation-band positioning and market competitiveness for affected groups.'],
  ['employee_attrition_datasettrain', 'Hourly: Rate', 'High', 'Review compensation-band positioning and market competitiveness for affected groups.'],
  ['employee_attrition_datasettrain', 'Training hours last year', 'High', 'Review training access, skill-building plans, and development conversations for affected groups.'],
  ['employee_attrition_datasettrain', 'Distance from home', 'Medium', 'Explore commute flexibility, hybrid scheduling, or location-support options for affected employees.'],
  ['employee_attrition_datasettrain', 'Work-life balance', 'Medium', 'Run a pulse survey and manager coaching plan for teams with weaker work-life balance signals.'],
  ['employee_attrition_datasettrain', 'Absenteeism', 'Medium', 'Review Absenteeism patterns with HRBP and managers, then validate with engagement and manager feedback.'],
];

function ValidationButton({ label, href, description, primary, external }: (typeof buttons)[number]) {
  return (
    <a className={`validationButton ${primary ? 'primary' : ''}`} href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
      <span>
        <b>{label}</b>
        <small>{description}</small>
      </span>
      {external ? <ExternalLink size={18} /> : <Download size={18} />}
    </a>
  );
}

function ChartBlock({ title, src, caption }: { title: string; src: string; caption: string }) {
  return (
    <SectionCard title={title} subtitle={caption}>
      <div className="validationChartWrap">
        <img className="validationChart" src={src} alt={title} />
      </div>
    </SectionCard>
  );
}

export default function ValidationPage() {
  return (
    <PageShell title="Validation & Method Proof" subtitle="A focused proof page for the v4 Retainly validation artifacts.">
      <SectionCard title="What this validation proves" subtitle="Retainly was validated on three labeled attrition datasets against a normal baseline ML workflow.">
        <p className="validationLead">
          The comparison includes model selection, threshold tuning, explainability, HR action generation, agent traceability, and Fair Use Check. Retainly improves recall, F1, ROC-AUC, Fair Use readiness, actionability, and final decision-support score. Baseline remains stronger on raw accuracy and precision.
        </p>
        <div className="validationButtonGrid">
          {buttons.map((button) => (
            <ValidationButton key={button.label} {...button} />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="What was tested" subtitle="Three labeled attrition datasets were used to check generalization, imbalance handling, and workflow robustness.">
        <div className="validationCardGrid">
          {datasets.map((dataset) => (
            <div className="validationMiniCard" key={dataset.name}>
              <h4>{dataset.name}</h4>
              <p>{dataset.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Baseline vs Retainly" subtitle="Averaged v4 validation metrics across the three datasets.">
        <div className="validationMetricGrid">
          {metrics.map((metric) => (
            <div className="validationMetric" key={metric.label}>
              <div className="validationMetricTop">
                <b>{metric.label}</b>
                <span className={`chip ${metric.winner === 'Retainly' ? 'low' : 'mod'}`}>{metric.winner}</span>
              </div>
              <div className="validationMetricValues">
                <span>Baseline <strong>{metric.baseline}</strong></span>
                <span>Retainly <strong>{metric.retainly}</strong></span>
              </div>
            </div>
          ))}
        </div>
        <div className="panelHint">
          Baseline remains stronger on raw accuracy and precision. Retainly performs better on recall, F1, ROC-AUC, Fair Use readiness, actionability, and final decision-support score.
        </div>
      </SectionCard>

      {charts.map((chart) => (
        <ChartBlock key={chart.title} {...chart} />
      ))}

      <SectionCard title="Fair Use Check" subtitle="Status: Safe for supportive HR review">
        <div className="validationTextGrid">
          <p><b>What Retainly checked:</b> Retainly checked whether sensitive employee attributes could unfairly influence retention-risk recommendations.</p>
          <p><b>What Retainly did:</b> Sensitive fields such as Gender, Age, and Marital Status were excluded from model training and scoring wherever present.</p>
          <p><b>What Retainly verified:</b> After scoring, Retainly checked whether priority recommendations were unfairly concentrated in any available sensitive group.</p>
          <p><b>Result:</b> No major unfair concentration was found in the selected fair-use checks across the validation datasets.</p>
          <p><b>How HR should use this:</b> Use Retainly for stay interviews, workload review, career-growth support, manager coaching, and retention planning.</p>
          <p><b>Important limit:</b> Do not use Retainly as the only basis for firing, demotion, salary cuts, disciplinary action, or other punitive decisions.</p>
        </div>
        <div className="btnRow single" style={{ marginTop: 14 }}>
          <a className="download secondary" href={asset('/research_outputs/fair_use_summary.csv')}><Download size={18} /> Download Fair Use Summary</a>
        </div>
      </SectionCard>

      <SectionCard title="Multi-Agent Workflow Validated" subtitle="The proof includes a traceable sequence of agent responsibilities, not just a final metric table.">
        <div className="validationCardGrid">
          {agents.map((agent) => (
            <div className="validationMiniCard" key={agent.name}>
              <h4>{agent.name}</h4>
              <p>{agent.detail}</p>
            </div>
          ))}
        </div>
        <div className="btnRow single" style={{ marginTop: 14 }}>
          <a className="download secondary" href={asset('/research_outputs/agent_trace_summary.csv')}><Download size={18} /> Download Agent Trace</a>
        </div>
      </SectionCard>

      <SectionCard title="Top drivers and HR actions" subtitle="Compact preview from the generated v4 outputs. Full files are available below.">
        <div className="validationTables">
          <div>
            <h4>Top Drivers</h4>
            <table className="table">
              <thead><tr><th>Dataset</th><th>Driver</th><th>Importance</th></tr></thead>
              <tbody>
                {topDrivers.map(([dataset, driver, importance]) => (
                  <tr key={`${dataset}-${driver}`}><td>{dataset}</td><td>{driver}</td><td>{importance}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h4>HR Actions</h4>
            <table className="table">
              <thead><tr><th>Dataset</th><th>Driver</th><th>Priority</th><th>Action</th></tr></thead>
              <tbody>
                {hrActions.map(([dataset, driver, priority, action]) => (
                  <tr key={`${dataset}-${driver}`}><td>{dataset}</td><td>{driver}</td><td>{priority}</td><td>{action}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="btnRow" style={{ marginTop: 14 }}>
          <a className="download secondary" href={asset('/research_outputs/top_drivers_summary.csv')}><Download size={18} /> Download Top Drivers</a>
          <a className="download secondary" href={asset('/research_outputs/hr_actions_summary.csv')}><Download size={18} /> Download HR Actions</a>
        </div>
      </SectionCard>

      <SectionCard title="Conclusion">
        <p className="validationLead">
          Retainly does not simply optimize raw accuracy. It is designed for HR attrition intervention, where identifying more potential leavers, explaining drivers, generating safe HR actions, and checking fair use are important. Across three labeled validation datasets, Retainly improved recall, F1, ROC-AUC, and final decision-support score compared with a normal baseline ML workflow, while remaining transparent that baseline models can be stronger on raw accuracy and precision.
        </p>
      </SectionCard>
    </PageShell>
  );
}
