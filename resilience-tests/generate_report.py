"""Create an atomic, professional A4 PDF from one validated current session."""

from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
import shutil
import textwrap

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
import pandas as pd

from generate_charts import generate_current_session_charts, load_current_session_results
from src.command_runner import redact_secrets
from src.session_store import paths, validate_consistency

ROOT = Path(__file__).resolve().parent
TITLE = "TuniCars+ — Resilience Testing Report"


def _page(pdf: PdfPages, title: str, subtitle: str = ""):
    fig = plt.figure(figsize=(8.27, 11.69), facecolor="white")
    fig.text(.07, .95, title, fontsize=20, fontweight="bold", color="#0f2740")
    if subtitle: fig.text(.07, .92, subtitle, fontsize=10, color="#64748b")
    fig.lines.append(plt.Line2D([.07, .93], [.9, .9], transform=fig.transFigure, color="#06b6d4", linewidth=2))
    return fig


def _wrap(value, width=42): return "\n".join(textwrap.wrap(redact_secrets(str(value or "N/A")), width=width)) or "N/A"


def _table_page(pdf, title, columns, rows, widths=None, *, landscape=False):
    if landscape:
        fig = plt.figure(figsize=(11.69, 8.27), facecolor="white")
        fig.text(.05, .93, title, fontsize=19, fontweight="bold", color="#0f2740")
        fig.lines.append(plt.Line2D([.05,.95],[.89,.89],transform=fig.transFigure,color="#06b6d4",linewidth=2))
        ax = fig.add_axes([.035,.08,.93,.77])
    else:
        fig = _page(pdf, title); ax = fig.add_axes([.06, .08, .88, .79])
    ax.axis("off")
    table = ax.table(cellText=rows, colLabels=columns, cellLoc="left", colLoc="left", loc="upper left", colWidths=widths)
    table.auto_set_font_size(False); table.set_fontsize(6.5 if landscape else 7); table.scale(1, 1.75)
    for (r, _c), cell in table.get_celld().items():
        cell.set_edgecolor("#d7e0ea"); cell.set_linewidth(.5)
        if r == 0: cell.set_facecolor("#0f2740"); cell.get_text().set_color("white"); cell.get_text().set_fontweight("bold")
        elif r % 2 == 0: cell.set_facecolor("#f4f7fb")
    pdf.savefig(fig, bbox_inches="tight"); plt.close(fig)


def _numeric(frame, column): return pd.to_numeric(frame[column], errors="coerce") if column in frame else pd.Series(dtype=float)


def _conclusion(frame):
    counts = frame["Status"].str.upper().value_counts(); total = len(frame)
    passed, failed, skipped = (int(counts.get(x, 0)) for x in ("PASS", "FAIL", "SKIPPED"))
    return f"During this campaign, {passed} of {total} scenarios passed, {failed} failed and {skipped} were skipped. Conclusions are limited to the measured scenarios and recorded environment constraints."


def generate_current_session_report(session_id: str | None = None) -> Path:
    active = paths(session_id); CHARTS = active["charts"]; CURRENT = active["dir"]
    CURRENT_CSV = active["csv"]; CURRENT_JSON = active["json"]; CURRENT_REPORT = active["report"]
    session_id, frame, payload, _active = load_current_session_results(session_id)
    if frame.empty: raise ValueError("Cannot generate a report without completed tests")
    aliases = {"Scenario":"scenario","Platform":"platform","Status":"status","Detection Time (s)":"detection_time_seconds","Recovery Time (s)":"recovery_time_seconds","Recovery Required":"recovery_required","Recovery Success":"recovery_success","Average Response Time (ms)":"average_response_time_ms","P95 Response Time (ms)":"p95_response_time_ms","HTTP Failures":"http_failure_count","Availability (%)":"availability_percent","Skip Reason":"skip_reason","Error Message":"error_message"}
    for display, internal in aliases.items():
        if display not in frame and internal in frame: frame[display] = frame[internal]
        if display not in frame: frame[display] = ""
    if not CHARTS.exists() or not any(item.stat().st_size for item in CHARTS.glob("*.png")):
        generate_current_session_charts(session_id)
    temporary = CURRENT_REPORT.with_suffix(".pdf.tmp"); temporary.parent.mkdir(parents=True, exist_ok=True)
    with PdfPages(temporary) as pdf:
        fig = plt.figure(figsize=(8.27, 11.69), facecolor="#071426"); fig.text(.08, .73, "TuniCars+", fontsize=34, fontweight="bold", color="white")
        fig.text(.08, .64, "Resilience Testing Report", fontsize=25, color="#22d3ee"); fig.text(.08, .59, "Docker Swarm vs Kubernetes", fontsize=16, color="#cbd5e1")
        fig.text(.08, .45, f"Session ID\n{session_id}\n\nDate\n{payload.get('started_at', '')}", fontsize=11, color="white", linespacing=1.8)
        fig.text(.08, .08, "TuniCars+ · PFA Resilience Study", color="#94a3b8"); pdf.savefig(fig); plt.close(fig)

        fig = _page(pdf, "Executive Summary", session_id); summary = payload["summary"]
        labels = ["Total", "Passed", "Failed", "Skipped", "Cancelled"]
        values = [summary.get(x.lower(), 0) for x in labels]
        for i, (label, val) in enumerate(zip(labels, values)):
            x=.08+(i%3)*.29; y=.77-(i//3)*.15; fig.text(x,y,str(val),fontsize=25,fontweight="bold",color="#0f2740"); fig.text(x,y-.035,label,color="#64748b")
        availability = _numeric(frame, "Availability (%)").mean(); fig.text(.08,.42,f"Overall measured availability: {availability:.2f}%" if pd.notna(availability) else "Overall availability: N/A",fontsize=12)
        fig.text(.08,.34,_wrap(_conclusion(frame),95),fontsize=11,linespacing=1.6); pdf.savefig(fig); plt.close(fig)

        fig = _page(pdf, "Test Environment", "Architecture and technologies")
        fig.text(.1,.78,"Frontend  →  Backend  →  PostgreSQL",fontsize=18,fontweight="bold",color="#0f2740")
        fig.text(.1,.66,"Docker Swarm environment\n• Docker services\n• FastAPI backend\n• Next.js frontend\n• PostgreSQL database",fontsize=11,linespacing=1.7)
        fig.text(.1,.43,"Kubernetes / Minikube environment\n• Kubernetes Deployments and Services\n• Minikube nodes\n• FastAPI · Next.js · PostgreSQL",fontsize=11,linespacing=1.7)
        pdf.savefig(fig); plt.close(fig)

        pivot = pd.crosstab(frame["Scenario"], frame["Platform"]).reset_index()
        _table_page(pdf,"Test Scenarios",list(pivot.columns),[[ _wrap(x,25) for x in row] for row in pivot.values.tolist()])
        full_columns = ["Scenario","Platform","Detection Time (s)","Recovery Time (s)","Recovery Required","Recovery Success","Average Response Time (ms)","P95 Response Time (ms)","HTTP Failures","Availability (%)","Status","Skip Reason","Error Message"]
        display_columns = ["Scenario","Platform","Detection","Recovery","Required","Success","Avg ms","P95 ms","HTTP Fail","Avail. %","Status","Skip Reason","Error Message"]
        for start in range(0,len(frame),12):
            rows=[[_wrap(v,16) for v in row] for row in frame.iloc[start:start+12][full_columns].values.tolist()]
            _table_page(pdf,"Full Results Table",display_columns,rows,[.085,.07,.07,.07,.06,.07,.07,.07,.06,.06,.06,.12,.14],landscape=True)

        for platform in frame["Platform"].drop_duplicates():
            selected=frame[frame["Platform"]==platform]
            for _, row in selected.iterrows():
                fig=_page(pdf,f"{platform} — {row['Scenario']}",f"Status: {row['Status']}")
                fields=["Detection Time (s)","Recovery Time (s)","HTTP Success","HTTP Failures","Availability (%)","CPU (%)","Memory (MB)"]
                text="\n".join(f"{field}: {row.get(field) or 'N/A'}" for field in fields)
                fig.text(.09,.79,text,fontsize=11,linespacing=1.65)
                reason=row.get("Error Message") or row.get("Skip Reason") or row.get("Notes") or "No error or limitation recorded."
                fig.text(.09,.46,"Recorded interpretation",fontsize=13,fontweight="bold"); fig.text(.09,.41,_wrap(reason,90),fontsize=10,linespacing=1.5)
                pdf.savefig(fig); plt.close(fig)

        for chart in sorted(CHARTS.glob("*.png")):
            fig=_page(pdf,chart.stem.replace("_"," ").title(),"Current-session measured data")
            image=plt.imread(chart); ax=fig.add_axes([.07,.17,.86,.67]); ax.imshow(image); ax.axis("off"); pdf.savefig(fig); plt.close(fig)

        failures=frame[frame["Status"].str.upper().eq("FAIL")]
        rows=[[_wrap(row[x],45) for x in ("Platform","Scenario","Status","Error Message")] for _,row in failures.iterrows()]
        _table_page(pdf,"Failures and Errors",["Platform","Scenario","Status","Error"],rows or [["—","—","—","No failures recorded."]])
        skipped=frame[frame["Status"].str.upper().eq("SKIPPED")]
        rows=[[_wrap(row[x],45) for x in ("Platform","Scenario","Skip Reason")] for _,row in skipped.iterrows()]
        _table_page(pdf,"Skipped Tests",["Platform","Scenario","Exact reason"],rows or [["—","—","No skipped tests recorded."]])
        comparison=pd.crosstab(frame["Platform"],frame["Status"].str.upper()).reset_index()
        _table_page(pdf,"Swarm vs Kubernetes Comparison",list(comparison.columns),comparison.astype(str).values.tolist())
        fig=_page(pdf,"Final Conclusion",session_id); fig.text(.09,.75,_wrap(_conclusion(frame),90),fontsize=12,linespacing=1.7); pdf.savefig(fig); plt.close(fig)
    temporary.replace(CURRENT_REPORT)
    state={"session_id":session_id,"generated_at":datetime.now().astimezone().isoformat(),"path":str(CURRENT_REPORT)}
    state_path=CURRENT/"report.json"; state_path.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding="utf-8")
    return CURRENT_REPORT


generate = generate_current_session_report


def main() -> int:
    try: print(f"[OK] Report generated: {generate_current_session_report()}"); return 0
    except Exception as exc: print(f"[ERROR] Report generation failed: {exc}"); return 1


if __name__ == "__main__": raise SystemExit(main())
