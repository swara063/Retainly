from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

from app.storage.local_store import log_path, load_json, report_path


def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _p(text: str, style: ParagraphStyle) -> Paragraph:
    return Paragraph(text.replace("\n", "<br/>"), style)


def _wrap_cell(value: Any, style: ParagraphStyle) -> Paragraph:
    return _p("—" if value is None else str(value), style)


def _kv_table(rows: list[tuple[str, Any]], *, col_widths: list[float], header: tuple[str, str] = ("Item", "Value")) -> Table:
    styles = getSampleStyleSheet()
    head_style = ParagraphStyle("HeadCell", parent=styles["BodyText"], fontSize=9.2, leading=11, textColor=colors.white)
    label_style = ParagraphStyle("LabelCell", parent=styles["BodyText"], fontSize=9.1, leading=11, textColor=colors.HexColor("#0F172A"))
    value_style = ParagraphStyle("ValueCell", parent=styles["BodyText"], fontSize=9.1, leading=11.5, textColor=colors.HexColor("#0F172A"))
    data = [[_p(header[0], head_style), _p(header[1], head_style)]]
    for k, v in rows:
        data.append([_wrap_cell(k, label_style), _wrap_cell(v, value_style)])
    t = Table(data, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 10),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                ("TOPPADDING", (0, 0), (-1, 0), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("FONTSIZE", (0, 1), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


def _table(headers: list[str], rows: list[list[Any]], *, col_widths: list[float]) -> Table:
    styles = getSampleStyleSheet()
    head_style = ParagraphStyle("TableHeadCell", parent=styles["BodyText"], fontSize=9.2, leading=11, textColor=colors.white)
    body_style = ParagraphStyle("TableBodyCell", parent=styles["BodyText"], fontSize=8.7, leading=10.5, textColor=colors.HexColor("#0F172A"))
    data = [[_p(str(h), head_style) for h in headers]]
    for r in rows:
        data.append([_wrap_cell(v, body_style) for v in r])
    t = Table(data, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 9.5),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 9),
                ("TOPPADDING", (0, 0), (-1, 0), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                ("FONTSIZE", (0, 1), (-1, -1), 8.4),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


def _action_card(action: dict[str, Any], width: float) -> Table:
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("CardTitle", parent=styles["Heading3"], fontSize=11, leading=13, spaceAfter=2, textColor=colors.HexColor("#0F172A"))
    body_style = ParagraphStyle("CardBody", parent=styles["BodyText"], fontSize=9.3, leading=11.4, textColor=colors.HexColor("#0F172A"))
    body_rows = [[_p(f"<b>{str(action.get('title') or 'Retention action')}</b>", title_style)]]
    for k, v in [
        ("Priority", action.get("priority")),
        ("Target segment", action.get("target_segment")),
        ("Recommended action", action.get("recommended_action") or action.get("title")),
        ("Why it matters", action.get("reason") or action.get("why_it_matters")),
        ("Timeline", action.get("timeline")),
        ("Expected impact", action.get("expected_business_impact")),
    ]:
        body_rows.append([_p(f"<b>{k}:</b> {( '—' if v is None else str(v) )}", body_style)])
    card = Table(body_rows, colWidths=[width], hAlign="LEFT")
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.0, colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return card


def _action_card_block(action: dict[str, Any]) -> list[Any]:
    return [KeepTogether([_action_card(action, width=6.8 * inch)]), Spacer(1, 8)]


def _fmt_pct(x: Any, digits: int = 1) -> str:
    try:
        v = float(x)
        if v != v:
            return "—"
        return f"{100.0 * v:.{digits}f}%"
    except Exception:
        return "—"


def _fmt_num(x: Any, digits: int = 3) -> str:
    try:
        v = float(x)
        if v != v:
            return "—"
        return f"{v:.{digits}f}"
    except Exception:
        return "—"


def _top_segments(results: dict, segment_name: str, limit: int = 6) -> list[dict]:
    segs = results.get("risk_segments") or []
    if not isinstance(segs, list):
        return []
    pick = [s for s in segs if isinstance(s, dict) and s.get("segment_name") == segment_name]
    pick.sort(key=lambda s: (s.get("priority") != "High", -(s.get("average_predicted_risk") or 0.0), -(s.get("employee_count") or 0)))
    return pick[:limit]


def _agent_timeline(dataset_id: str, limit: int = 16) -> list[dict[str, Any]]:
    try:
        p = log_path(dataset_id)
        if not p.exists():
            return []
        logs = load_json(p)
        if not isinstance(logs, list):
            return []
        keep = [l for l in logs if isinstance(l, dict)]
        return keep[-limit:]
    except Exception:
        return []


def build_pdf_report(dataset_id: str, results: dict) -> str:
    path = report_path(dataset_id)
    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        rightMargin=42,
        leftMargin=42,
        topMargin=46,
        bottomMargin=46,
        title="Retainly Attrition Intelligence Report",
        author="Retainly",
    )

    styles = getSampleStyleSheet()
    title = ParagraphStyle("TitleX", parent=styles["Title"], fontSize=21, leading=24, spaceAfter=8, textColor=colors.HexColor("#0F172A"))
    subtitle = ParagraphStyle("SubtitleX", parent=styles["BodyText"], fontSize=10.5, leading=13.5, spaceAfter=6, textColor=colors.HexColor("#475569"))
    h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=14, leading=17, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor("#0F172A"))
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=11.5, leading=14, spaceBefore=8, spaceAfter=5, textColor=colors.HexColor("#0F172A"))
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=9.7, leading=13, textColor=colors.HexColor("#0F172A"))
    muted = ParagraphStyle("Muted", parent=body, textColor=colors.HexColor("#475569"))
    small = ParagraphStyle("Small", parent=body, fontSize=8.8, leading=11.4, textColor=colors.HexColor("#475569"))
    section_rule = Table([[""]], colWidths=[6.9 * inch])
    section_rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E2E8F0")), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0), ("LINEBELOW", (0, 0), (-1, -1), 0, colors.white)]))

    exec_sum = results.get("executive_summary") or {}
    model = results.get("model") or {}
    metrics = (model.get("metrics") or {}) if isinstance(model, dict) else {}
    dataset_mode = results.get("dataset_mode") or "labeled_training"
    can_evaluate_model = bool(results.get("can_evaluate_model"))
    fairness = results.get("fairness") or {}
    explain = results.get("explainability") or {}

    employees_analyzed = exec_sum.get("rows_analyzed") or (results.get("dataset_profile") or {}).get("rows") or "—"
    columns_analyzed = exec_sum.get("columns_analyzed") or (results.get("dataset_profile") or {}).get("columns") or "—"
    attr_rate = exec_sum.get("attrition_rate")
    model_trust = results.get("model_trust") or {}

    recall = metrics.get("recall")
    f1 = metrics.get("f1")
    roc_auc = metrics.get("roc_auc")
    pr_auc = metrics.get("pr_auc")
    selected_model = (model.get("selected_model") if isinstance(model, dict) else None) or "Retainly pretrained attrition-risk model"
    reliability = metrics.get("model_reliability_label") or exec_sum.get("model_reliability_label") or "—"

    fairness_risk = exec_sum.get("fairness_risk") or fairness.get("overall_risk") or "—"
    recommended_use = exec_sum.get("recommended_use") or (
        "Use Retainly as decision-support to prioritize retention outreach and workplace improvements. "
        "Review fairness signals and validate with HR partners before taking action. "
        "Do not use this report as the sole basis for employment decisions."
    )

    retention_plan = results.get("retention_plan") or []
    dq = results.get("data_quality") or {}
    leaderboard = model.get("leaderboard") or []
    employee_records = [record for record in (results.get("employee_risk_records") or []) if isinstance(record, dict)]

    story: list[Any] = []

    # 1) Cover
    story.append(_p("Retainly Attrition Intelligence Report", title))
    story.append(_p(f"<b>Dataset ID:</b> {dataset_id}", body))
    story.append(_p(f"<b>Generated:</b> {_now_utc_iso()}", body))
    story.append(_p("Retention decision-support for HR teams", subtitle))
    story.append(Spacer(1, 10))
    story.append(
        _p(
            "<b>Ethical-use disclaimer:</b> This report is for decision-support only. "
            "It highlights potential attrition risk patterns and suggested retention actions. "
            "Do not use outputs for punitive decisions or as the sole basis for employment outcomes. "
            "Always apply HR policy, local law, and fairness review.",
            muted,
        )
    )
    story.append(Spacer(1, 16))

    # 2) Executive Summary
    story.append(section_rule)
    story.append(_p("Executive Summary", h1))
    if can_evaluate_model:
        story.append(_kv_table([("Employees analyzed", employees_analyzed),("Columns analyzed", columns_analyzed),("Priority employees", (exec_sum.get("high_risk_employees") or results.get("employee_risk_high_count") or 0)),("Highest-risk department", exec_sum.get("highest_risk_department") or "—"),("Highest-risk role", exec_sum.get("highest_risk_role") or "—"),("Prediction reliability", reliability),("Model basis", model_trust.get("model_basis") or "Pretrained attrition-risk model"),("Training source", model_trust.get("training_source") or "Benchmark attrition datasets configured in research_datasets/"),("Suitable use", model_trust.get("suitable_use") or "Retention prioritization and HR planning"),("Not suitable for", model_trust.get("not_suitable_for") or "Automatic firing, punitive decisions, or final employment decisions"),("Fairness review", fairness_risk)], col_widths=[2.3 * inch, 3.9 * inch]))
    else:
        story.append(_kv_table([("Dataset mode", dataset_mode),("Employees analyzed", employees_analyzed),("Columns analyzed", columns_analyzed),("Priority employees", (exec_sum.get("high_risk_employees") or results.get("employee_risk_high_count") or 0)),("Highest-risk department", exec_sum.get("highest_risk_department") or "—"),("Highest-risk role", exec_sum.get("highest_risk_role") or "—"),("Prediction reliability", reliability),("Fairness review", fairness_risk)], col_widths=[2.3 * inch, 3.9 * inch]))
    story.append(Spacer(1, 10))
    story.append(_p(f"<b>Recommended use:</b> {recommended_use}", body))

    # 3) Risk Hotspots
    story.append(section_rule)
    story.append(_p("Risk Hotspots", h1))
    story.append(_p("Top department risks", h2))
    dept_rows = _top_segments(results, "Department")
    if dept_rows:
        story.append(
            _table(
                ["Department", "Employees", "Attrition rate", "Avg predicted risk", "Priority"],
                [
                    [r.get("group"), r.get("employee_count"), _fmt_pct(r.get("attrition_rate")), _fmt_num(r.get("average_predicted_risk")), r.get("priority")]
                    for r in dept_rows
                ],
                col_widths=[1.6 * inch, 0.9 * inch, 1.1 * inch, 1.3 * inch, 0.9 * inch],
            )
        )
    else:
        story.append(_p("No department segmentation available (Department column not found).", small))
    story.append(Spacer(1, 10))

    story.append(_p("Top job-role risks", h2))
    role_rows = _top_segments(results, "JobRole")
    if role_rows:
        story.append(
            _table(
                ["Job role", "Employees", "Attrition rate", "Avg predicted risk", "Priority"],
                [
                    [r.get("group"), r.get("employee_count"), _fmt_pct(r.get("attrition_rate")), _fmt_num(r.get("average_predicted_risk")), r.get("priority")]
                    for r in role_rows
                ],
                col_widths=[2.1 * inch, 0.8 * inch, 1.0 * inch, 1.3 * inch, 0.9 * inch],
            )
        )
    else:
        story.append(_p("No job-role segmentation available (JobRole column not found).", small))

    story.append(Spacer(1, 10))
    story.append(_p("Patterns: overtime, satisfaction, tenure", h2))
    pattern_rows: list[list[Any]] = []
    for seg in ("OverTime", "JobSatisfaction", "YearsAtCompany"):
        pick = _top_segments(results, seg, limit=3)
        for r in pick:
            pattern_rows.append([seg, r.get("group"), r.get("employee_count"), _fmt_pct(r.get("attrition_rate")), _fmt_num(r.get("average_predicted_risk")), r.get("priority")])
    if pattern_rows:
        story.append(
            _table(
                ["Segment", "Group", "Employees", "Attrition rate", "Avg predicted risk", "Priority"],
                pattern_rows,
                col_widths=[1.2 * inch, 1.7 * inch, 0.8 * inch, 1.0 * inch, 1.2 * inch, 0.9 * inch],
            )
        )
    else:
        story.append(_p("No overtime/satisfaction/tenure patterns available.", small))

    # 4) Retention Action Plan
    story.append(section_rule)
    story.append(_p("What HR Should Do Next", h1))
    if isinstance(retention_plan, list) and retention_plan:
        for a in retention_plan[:8]:
            if not isinstance(a, dict):
                continue
            story.extend(_action_card_block(a))
        story.append(Spacer(1, 8))
        story.append(_p("All actions should be implemented with employee-supportive wording and measured via small pilots where possible.", muted))
    else:
        story.append(_p("No retention plan available. Run analysis to generate action recommendations.", small))

    # 5) Employee Priority Summary
    story.append(section_rule)
    story.append(_p("Employee Priority Summary", h1))
    if employee_records:
        top_records = sorted(employee_records, key=lambda row: (float(row.get("risk_score") or 0), float(row.get("risk_percentile") or 0)), reverse=True)[:10]
        story.append(
            _table(
                ["Employee", "Department", "Role", "Risk score", "Risk band", "Priority rank", "Top factors", "Suggested support action"],
                [
                    [
                        row.get("display_label") or row.get("employee_name") or row.get("employee_id"),
                        row.get("department") or "—",
                        row.get("job_role") or "—",
                        _fmt_pct(row.get("risk_score"), 0),
                        row.get("risk_band") or "—",
                        row.get("priority_tier") or "—",
                        "; ".join((row.get("top_risk_factors") or [])[:2]) or "—",
                        row.get("recommended_support_action") or "—",
                    ]
                    for row in top_records
                ],
                col_widths=[1.0 * inch, 0.85 * inch, 0.85 * inch, 0.7 * inch, 0.7 * inch, 0.8 * inch, 1.3 * inch, 1.7 * inch],
            )
        )
    else:
        story.append(_p("No employee-level priority list available.", small))

    # 6) Model & Method Notes
    story.append(section_rule)
    story.append(_p("Model & Method Notes", h1))
    if can_evaluate_model:
        story.append(_p("Metrics", h2))
        metric_rows = [
            ("Selected model", selected_model),
            ("Risk capture rate", _fmt_num(recall)),
            ("Review efficiency", _fmt_num(metrics.get("precision"))),
            ("F1 balance score", _fmt_num(f1)),
            ("Ranking quality", _fmt_num(roc_auc)),
            ("Attrition detection quality", _fmt_num(pr_auc)),
            ("Top 10% risk capture", _fmt_num(metrics.get("recall_at_top_10_percent"))),
            ("Top 20% risk capture", _fmt_num(metrics.get("recall_at_top_20_percent"))),
            ("Attrition rate in top 10%", _fmt_pct(metrics.get("attrition_rate_in_top_10_percent"))),
            ("Attrition rate in top 20%", _fmt_pct(metrics.get("attrition_rate_in_top_20_percent"))),
            ("Class balance (test positive rate)", _fmt_pct(((metrics.get("class_balance") or {}).get("test") or {}).get("positive_rate"))),
        ]
        story.append(_kv_table(metric_rows, col_widths=[2.6 * inch, 3.6 * inch]))
    else:
        story.append(
            _kv_table(
                [
                    ("Mode", "Unlabeled HR risk scoring"),
                    ("Model basis", model_trust.get("model_basis") or "Pretrained Retainly attrition-risk model"),
                    ("Output", "Directional risk ranking, hotspots, action plan, and employee prioritization"),
                    ("Validation", "Benchmark validation is maintained separately in the Validation page and notebook."),
                    ("Suitable use", model_trust.get("suitable_use") or "Retention planning and supportive HR outreach"),
                    ("Not suitable for", model_trust.get("not_suitable_for") or "Automatic employment decisions"),
                ],
                col_widths=[2.4 * inch, 3.8 * inch],
            )
        )

    calib_warning = ((metrics.get("calibration") or {}).get("warning") if isinstance(metrics, dict) else None)
    if calib_warning and can_evaluate_model:
        story.append(Spacer(1, 8))
        story.append(_p(f"<b>Calibration note:</b> {calib_warning} This does not invalidate the model; it just means probability scores should be read as approximate.", muted))

    if can_evaluate_model:
        story.append(Spacer(1, 10))
        story.append(_p("Confusion matrix (test set)", h2))
        cm = model.get("confusion_matrix")
        if isinstance(cm, list) and cm and isinstance(cm[0], list):
            try:
                cm_rows = [[str(x) for x in r] for r in cm]
                cm_table = _table(["Pred 0", "Pred 1"], cm_rows, col_widths=[1.0 * inch, 1.0 * inch])
                story.append(cm_table)
            except Exception:
                story.append(_p("Confusion matrix will appear when the selected model returns matrix output.", small))
        else:
            story.append(_p("Confusion matrix will appear when the selected model returns matrix output.", small))

        story.append(Spacer(1, 10))
        story.append(_p("Leaderboard (HR score ordering)", h2))
        if isinstance(leaderboard, list) and leaderboard:
            rows = []
            for m in leaderboard[:6]:
                if not isinstance(m, dict):
                    continue
                rows.append([m.get("model_type"), _fmt_num(m.get("recall")), _fmt_num(m.get("pr_auc")), _fmt_num(m.get("roc_auc")), _fmt_num(m.get("f1"))])
            story.append(_table(["Model", "Recall", "PR-AUC", "ROC-AUC", "F1"], rows, col_widths=[1.5 * inch, 0.9 * inch, 0.9 * inch, 0.9 * inch, 0.7 * inch]))
        else:
            story.append(_p("Model leaderboard will appear when multiple model summaries are returned.", small))

    # 7) Explainability
    story.append(_p("Explainability", h1))
    top_feats = (explain.get("top_features") or []) if isinstance(explain, dict) else []
    story.append(_p("Top predictive features", h2))
    if isinstance(top_feats, list) and top_feats:
        rows = []
        for f in top_feats[:10]:
            if not isinstance(f, dict):
                continue
            feat = f.get("feature")
            imp = f.get("importance")
            interpretation = (
                "Higher or lower values of this factor are associated with attrition risk in this dataset. "
                "Validate with HR context before acting."
            )
            rows.append([feat, _fmt_num(abs(float(imp)) if imp is not None else None), interpretation])
        story.append(_table(["Feature", "Importance", "Plain-English interpretation"], rows, col_widths=[1.7 * inch, 0.8 * inch, 3.5 * inch]))
    elif can_evaluate_model:
        story.append(_p("No explainability output available.", small))
    else:
        story.append(_p("Top signals are expressed in employee factors, segment hotspots, and action priorities rather than technical model diagnostics.", small))

    # 8) Agent Workflow
    story.append(section_rule)
    story.append(_p("Agent Workflow", h1))
    workflow_rows = [
        ["Project Manager Agent", "Orchestrates the workflow, validates completion, and tracks stages."],
        ["Data Analyst Agent", "Checks data quality and profiles departments, roles, workload, satisfaction, and tenure patterns."],
        ["ML Engineer Agent", "Loads the pretrained Retainly model and scores employee risk for website analysis."],
        ["Insights Agent", "Converts risk scores into employee profiles, hotspots, actions, report content, and chatbot context."],
    ]
    story.append(_table(["Agent", "Role in website analysis"], workflow_rows, col_widths=[2.0 * inch, 4.9 * inch]))

    # 9) Fairness & Responsible AI
    story.append(section_rule)
    story.append(_p("Fairness & Responsible AI", h1))
    audited = (fairness.get("audited_attributes") or fairness.get("attributes") or []) if isinstance(fairness, dict) else []
    story.append(_p(f"<b>Audited attributes:</b> {', '.join(audited) if audited else '—'}", body))
    story.append(Spacer(1, 6))
    story.append(_p(f"<b>Bias risk:</b> {fairness.get('overall_risk', '—') if isinstance(fairness, dict) else '—'}", body))
    if isinstance(fairness, dict) and fairness.get("group_differences"):
        gd = fairness.get("group_differences")
        story.append(Spacer(1, 8))
        story.append(_p("Group differences (summary)", h2))
        story.append(_p(str(gd), small))
    story.append(Spacer(1, 8))
    story.append(
        _p(
            "Safe-use recommendations: focus on supportive interventions (manager coaching, workload improvements, growth pathways). "
            "Avoid targeting individuals for punitive actions. Monitor for disparate impact and confirm with policy and legal guidance.",
            muted,
        )
    )

    # 10) Appendix
    story.append(section_rule)
    story.append(_p("Appendix", h1))
    story.append(_p("Dataset quality warnings", h2))
    warnings = (dq.get("warnings") or []) if isinstance(dq, dict) else []
    if warnings:
        for w in warnings[:10]:
            story.append(_p(f"• {w}", small))
    else:
        story.append(_p("No data quality warnings reported.", small))

    story.append(Spacer(1, 8))
    story.append(_p("Agent execution timeline (recent)", h2))
    timeline = _agent_timeline(dataset_id)
    if timeline:
        for l in timeline:
            story.append(
                _kv_table(
                    [
                        ("Timestamp", l.get("timestamp")),
                        ("Agent", l.get("agent")),
                        ("Status", l.get("status")),
                        ("Message", l.get("message")),
                    ],
                    col_widths=[1.25 * inch, 5.35 * inch],
                )
            )
            story.append(Spacer(1, 6))
    else:
        story.append(_p("No agent timeline available.", small))

    doc.build(story)
    return str(path)
