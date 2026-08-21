"""Generate current-session charts exclusively from already persisted results."""

from __future__ import annotations

from datetime import datetime
import json
import os
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / "results" / "processed" / "matplotlib-cache"))
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from src.session_store import paths, validate_consistency

STATUS_COLORS = {"PASS": "#16a34a", "FAIL": "#dc2626", "SKIPPED": "#94a3b8", "CANCELLED": "#f59e0b"}


def load_current_session_results(session_id: str | None = None) -> tuple[str, pd.DataFrame, dict, dict[str, Path]]:
    """Load one validated active session, preferring its JSON results over CSV."""
    active = paths(session_id)
    session_id = validate_consistency(session_id)
    payload = json.loads(active["json"].read_text(encoding="utf-8"))
    records = payload.get("results")
    if isinstance(records, list) and records:
        frame = pd.DataFrame(records)
    elif active["csv"].exists():
        frame = pd.read_csv(active["csv"], dtype=str, keep_default_na=False)
    else:
        raise FileNotFoundError("No current-session JSON or CSV result file exists.")
    if frame.empty:
        raise ValueError("The current session has no completed test result.")
    if "session_id" in frame.columns:
        ids = {str(item) for item in frame["session_id"].dropna() if str(item)}
        if ids and ids != {session_id}:
            raise ValueError(f"Current results contain another session: {sorted(ids)}")
    return session_id, frame, payload, active


def _numeric(frame: pd.DataFrame, name: str) -> pd.Series:
    aliases = {
        "detection_time_seconds": ("detection_time_seconds", "Detection Time (s)"),
        "recovery_time_seconds": ("recovery_time_seconds", "Recovery Time (s)"),
        "average_response_time_ms": ("average_response_time_ms", "Average Response Time (ms)"),
        "p95_response_time_ms": ("p95_response_time_ms", "P95 Response Time (ms)"),
        "availability_percent": ("availability_percent", "Availability (%)"),
        "http_failure_count": ("http_failure_count", "HTTP Failures"),
        "maximum_cpu_percent": ("maximum_cpu_percent", "CPU (%)"),
        "maximum_memory_mb": ("maximum_memory_mb", "Memory (MB)"),
    }
    for candidate in aliases.get(name, (name,)):
        if candidate in frame:
            return pd.to_numeric(frame[candidate].replace({"": None, "N/A": None, "Not Measured": None}), errors="coerce")
    return pd.Series(index=frame.index, dtype=float)


def _column(frame: pd.DataFrame, *names: str) -> pd.Series:
    for name in names:
        if name in frame:
            return frame[name].fillna("").astype(str)
    return pd.Series([""] * len(frame), index=frame.index, dtype=str)


def _style(axis, title: str, ylabel: str = "") -> None:
    axis.set_title(title, fontsize=14, fontweight="bold", color="#0f172a", pad=14)
    axis.set_ylabel(ylabel)
    axis.grid(axis="y", alpha=.2)
    axis.spines[["top", "right"]].set_visible(False)
    axis.tick_params(axis="x", rotation=22)


def _save(fig, chart_dir: Path, filename: str) -> Path:
    target = chart_dir / filename
    fig.tight_layout()
    fig.savefig(target, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    if not target.exists() or target.stat().st_size == 0:
        raise OSError(f"Generated chart is missing or empty: {target}")
    return target


def _metric_chart(frame: pd.DataFrame, chart_dir: Path, column: str, title: str, ylabel: str, filename: str) -> Path | None:
    values = _numeric(frame, column)
    measured = frame.assign(_metric=values).dropna(subset=["_metric"])
    if measured.empty:
        return None
    platforms = _column(measured, "platform", "Platform").replace({"swarm": "Docker Swarm", "kubernetes": "Kubernetes"})
    scenarios = _column(measured, "scenario", "Scenario")
    labels = platforms + " · " + scenarios
    fig, axis = plt.subplots(figsize=(10, 5.4))
    axis.bar(labels, measured["_metric"], color="#2563eb")
    _style(axis, title, ylabel)
    return _save(fig, chart_dir, filename)


def generate_current_session_charts(session_id: str | None = None) -> list[Path]:
    """Replace only active-session charts and return verified non-empty PNGs."""
    session_id, frame, _payload, active = load_current_session_results(session_id)
    chart_dir = active["charts"]
    temporary = active["dir"] / ".charts-generating"
    if temporary.exists():
        shutil.rmtree(temporary)
    temporary.mkdir(parents=True)
    generated: list[Path] = []
    try:
        statuses = _column(frame, "status", "Status").str.upper().value_counts().reindex(STATUS_COLORS, fill_value=0)
        fig, axis = plt.subplots(figsize=(10, 5.4))
        axis.bar(statuses.index, statuses.values, color=[STATUS_COLORS[item] for item in statuses.index])
        for index, count in enumerate(statuses.values):
            axis.text(index, count + .05, str(count), ha="center", fontweight="bold")
        _style(axis, "PASS / FAIL / SKIPPED Summary", "Tests")
        generated.append(_save(fig, temporary, "status_summary.png"))

        comparison = pd.crosstab(_column(frame, "platform", "Platform"), _column(frame, "status", "Status").str.upper())
        comparison = comparison.reindex(columns=list(STATUS_COLORS), fill_value=0)
        fig, axis = plt.subplots(figsize=(10, 5.4))
        comparison.plot.bar(ax=axis, color=[STATUS_COLORS[item] for item in comparison.columns])
        _style(axis, "Docker Swarm vs Kubernetes", "Tests")
        axis.tick_params(axis="x", rotation=0)
        generated.append(_save(fig, temporary, "platform_comparison.png"))

        specifications = (
            ("detection_time_seconds", "Detection Time", "Seconds", "detection_time.png"),
            ("recovery_time_seconds", "Recovery Time", "Seconds", "recovery_time.png"),
            ("average_response_time_ms", "Average Response Time", "Milliseconds", "response_time.png"),
            ("p95_response_time_ms", "P95 Response Time", "Milliseconds", "p95_response_time.png"),
            ("availability_percent", "Availability", "Percent", "availability.png"),
            ("http_failure_count", "HTTP Failures", "Requests", "http_failures.png"),
            ("maximum_cpu_percent", "CPU Usage", "Percent", "cpu_usage.png"),
            ("maximum_memory_mb", "Memory Usage", "MiB", "memory_usage.png"),
        )
        for specification in specifications:
            chart = _metric_chart(frame, temporary, *specification)
            if chart is not None:
                generated.append(chart)

        if chart_dir.exists():
            shutil.rmtree(chart_dir)
        temporary.replace(chart_dir)
        generated = [chart_dir / item.name for item in generated]
        metadata = {
            "session_id": session_id,
            "status": "Generated",
            "generated_at": datetime.now().astimezone().isoformat(),
            "count": len(generated),
            "files": [item.name for item in generated],
        }
        (active["dir"] / "charts.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
        return generated
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise


generate = generate_current_session_charts


def main() -> int:
    try:
        charts = generate_current_session_charts()
        print(f"Generated charts: {len(charts)}")
        return 0
    except Exception as exc:
        print(f"[ERROR] Chart generation failed: {type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
