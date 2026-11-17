
"""Owner: Kunal + Lakshya. Weekly executive report from scorecard."""

from pathlib import Path
from datetime import datetime

from backend.tools import get_scorecard

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS = ROOT / "outputs"


def weekly_report():
    OUTPUTS.mkdir(parents=True, exist_ok=True)

    result = get_scorecard()

    rows = result.get("rows", []) if isinstance(result, dict) else []

    if not rows:
        raise ValueError("Scorecard returned no initiative rows.")

    green = [r for r in rows if r.get("status") == "Green"]
    amber = [r for r in rows if r.get("status") == "Amber"]
    red = [r for r in rows if r.get("status") == "Red"]

    lines = [
        "# Nimbus AI — Weekly Executive Report",
        "",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"Scorecard as of: {result.get('as_of', 'Not available')}",
        "",
        "## Executive Summary",
        "",
        f"- Total initiatives: **{len(rows)}**",
        f"- Green: **{len(green)}**",
        f"- Amber: **{len(amber)}**",
        f"- Red: **{len(red)}**",
        f"- At-risk (Amber + Red): **{len(amber) + len(red)}**",
        "",
        "## Initiative Scorecard",
        "",
        "| Initiative | Status | Adoption | ROI | WAU Change |",
        "|---|---|---:|---:|---:|",
    ]

    for r in rows:
        lines.append(
            f"| {r['name']} ({r['initiative_id']}) "
            f"| {r['status']} "
            f"| {r['adoption']:.1%} "
            f"| {r['roi']:.1%} "
            f"| {r['wau_change']:.1%} |"
        )

    lines.extend(["", "## At-Risk Initiatives", ""])

    for r in amber + red:
        lines.extend([
            f"### {r['name']} — {r['status']}",
            f"- Adoption: {r['adoption']:.1%}",
            f"- ROI: {r['roi']:.1%}",
            f"- Payback: {r['payback_months']} months",
            f"- Run-rate vs plan: {r['run_rate_vs_plan']:.1%}",
            "",
        ])

    lines.extend([
        "## Recommended Management Attention",
        "",
        "- **Sales Copilot:** Low adoption and negative ROI. Review adoption barriers and costs.",
        "- **Demand Forecasting Model:** Negative ROI despite high adoption. Investigate benefit realization and cost.",
        "- **Customer FAQ Bot:** Monitor adoption and benefit realization; currently Amber.",
        "- **Churn Predictor:** Monitor ROI and adoption before scaling.",
        "",
        "## Source",
        "",
        result.get("source", "Governed Nimbus AI scorecard"),
    ])

    report_text = "\n".join(lines)

    report_path = OUTPUTS / "weekly_report.md"
    report_path.write_text(report_text, encoding="utf-8")

    return {
        "status": "success",
        "report": report_text,
        "file": str(report_path),
        "initiatives_evaluated": len(rows),
        "green": len(green),
        "amber": len(amber),
        "red": len(red),
        "at_risk_count": len(amber) + len(red),
    }
