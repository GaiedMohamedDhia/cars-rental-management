"""Regression tests for manual chart/report generation from existing results."""

from __future__ import annotations

import json
from pathlib import Path

from src import session_store
import generate_charts
import generate_report


def _record(session_id: str, platform: str = "swarm") -> dict:
    return {
        "session_id": session_id, "timestamp_end": "2026-08-13T10:00:00Z",
        "platform": platform, "scenario": "container-kill", "status": "PASS",
        "detection_time_seconds": 1.2, "recovery_time_seconds": 3.4,
        "recovery_required": True, "recovery_success": True,
        "average_response_time_ms": 14.2, "p95_response_time_ms": 18.7,
        "maximum_response_time_ms": 20.0, "http_success_count": 10,
        "http_failure_count": 0, "availability_percent": 100,
        "maximum_cpu_percent": None, "maximum_memory_mb": None,
        "error_count": 0, "error_message": "", "skip_reason": "", "notes": "",
    }


def _session(monkeypatch, tmp_path: Path) -> tuple[Path, Path]:
    sessions = tmp_path / "results" / "sessions"
    active = tmp_path / "results" / "active_session.json"
    monkeypatch.setattr(session_store, "SESSIONS", sessions)
    monkeypatch.setattr(session_store, "ACTIVE", active)
    session_store.start_session("current", platforms=["Docker Swarm"], total=1)
    session_store.save_session_records([_record("current")], finished=True)
    old = sessions / "historical" / "charts"
    old.mkdir(parents=True)
    (old / "keep.png").write_bytes(b"historical")
    return sessions, active


def test_charts_replace_current_preserve_history_and_skip_missing_metrics(monkeypatch, tmp_path):
    sessions, _ = _session(monkeypatch, tmp_path)
    current = session_store.paths()["charts"]
    (current / "obsolete.png").write_bytes(b"old")
    before = session_store.paths()["json"].read_bytes()
    charts = generate_charts.generate_current_session_charts()
    assert charts and all(item.exists() and item.stat().st_size > 0 for item in charts)
    assert not (current / "obsolete.png").exists()
    assert not (current / "cpu_usage.png").exists()
    assert (sessions / "historical" / "charts" / "keep.png").read_bytes() == b"historical"
    assert session_store.paths()["json"].read_bytes() == before


def test_report_uses_current_results_and_generates_missing_charts(monkeypatch, tmp_path):
    _session(monkeypatch, tmp_path)
    before_json = session_store.paths()["json"].read_bytes()
    report = generate_report.generate_current_session_report()
    assert report.exists() and report.stat().st_size > 0
    assert list(session_store.paths()["charts"].glob("*.png"))
    assert session_store.paths()["json"].read_bytes() == before_json
    state = json.loads(session_store.paths()["report_state"].read_text(encoding="utf-8"))
    assert state["session_id"] == "current"


def test_manual_generators_do_not_import_or_call_scenario_runner(monkeypatch, tmp_path):
    _session(monkeypatch, tmp_path)
    import test_runner
    monkeypatch.setattr(test_runner, "execute", lambda *_a, **_k: (_ for _ in ()).throw(AssertionError("test executed")))
    generate_charts.generate_current_session_charts()
    generate_report.generate_current_session_report()
    assert len(session_store.read_rows()) == 1


def test_gui_buttons_call_artifact_worker_not_test_runner():
    source = Path("resilience_gui.py").read_text(encoding="utf-8")
    assert 'def generate_report(self) -> None:\n        self._run_generation("report")' in source
    assert 'def generate_charts(self) -> None:\n        self._run_generation("charts")' in source
    refresh_body = source.split("    def refresh_charts(self) -> None:", 1)[1].split("    def refresh_report", 1)[0]
    assert "execute(" not in refresh_body and "_start_suite(" not in refresh_body
