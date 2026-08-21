"""Regression coverage for isolated current/history report packages."""

from datetime import datetime
import json
import os

import pytest

from src import session_store


def test_validation_lock_blocks_an_unrelated_campaign(monkeypatch, tmp_path):
    monkeypatch.setattr(session_store, "RESULTS_ROOT", tmp_path)
    monkeypatch.setattr(session_store, "CAMPAIGN_LOCK", tmp_path / "campaign.lock")
    monkeypatch.setattr(session_store, "VALIDATION_LOCK", tmp_path / "validation.lock")
    session_store.VALIDATION_LOCK.write_text(f"{os.getpid()}:owner-token", encoding="utf-8")
    monkeypatch.delenv("RESILIENCE_VALIDATION_OWNER", raising=False)
    with pytest.raises(RuntimeError, match="second worker"):
        session_store.acquire_campaign_lock()


def test_validation_owner_child_can_acquire_campaign_lock(monkeypatch, tmp_path):
    monkeypatch.setattr(session_store, "RESULTS_ROOT", tmp_path)
    monkeypatch.setattr(session_store, "CAMPAIGN_LOCK", tmp_path / "campaign.lock")
    monkeypatch.setattr(session_store, "VALIDATION_LOCK", tmp_path / "validation.lock")
    session_store.VALIDATION_LOCK.write_text(f"{os.getpid()}:owner-token", encoding="utf-8")
    monkeypatch.setenv("RESILIENCE_VALIDATION_OWNER", "owner-token")
    session_store.acquire_campaign_lock()
    assert session_store.CAMPAIGN_LOCK.exists()
    session_store.release_campaign_lock()


def _redirect(monkeypatch, tmp_path):
    sessions = tmp_path / "results" / "sessions"; active = tmp_path / "results" / "active_session.json"
    monkeypatch.setattr(session_store, "SESSIONS", sessions); monkeypatch.setattr(session_store, "ACTIVE", active)
    return sessions, active


def _record(session, status="PASS"):
    return {"session_id": session, "timestamp_end": "2026-08-13T10:00:00Z", "platform": "swarm", "scenario": "cpu", "repetition": 1,
            "status": status, "detection_time_seconds": "N/A", "recovery_time_seconds": "N/A", "recovery_required": False,
            "recovery_success": "Not Required", "average_response_time_ms": 12.5, "p95_response_time_ms": 15,
            "maximum_response_time_ms": 18, "http_success_count": 3, "http_failure_count": 0, "availability_percent": 100,
            "maximum_cpu_percent": 25, "maximum_memory_mb": 128, "error_count": 0, "error_message": "", "skip_reason": "", "notes": "measured"}


def test_unique_session_format():
    one = session_store.new_session_id(datetime(2026, 8, 13, 12, 30, 45)); two = session_store.new_session_id(datetime(2026, 8, 13, 12, 30, 45))
    assert one.startswith("20260813_123045_") and one != two


def test_new_session_archives_current_and_clears_active_charts(monkeypatch, tmp_path):
    sessions, _active = _redirect(monkeypatch, tmp_path)
    session_store.start_session("old", platforms=["Docker Swarm"], total=1)
    (sessions / "old" / "charts" / "old.png").write_bytes(b"old"); (sessions / "old" / "report.pdf").write_bytes(b"pdf")
    session_store.start_session("new", platforms=["Kubernetes"], total=1)
    assert (sessions / "old" / "charts" / "old.png").exists()
    assert (sessions / "old" / "report.pdf").exists()
    assert not list((sessions / "new" / "charts").glob("*.png"))


def test_progressive_current_csv_json_and_consistency(monkeypatch, tmp_path):
    _redirect(monkeypatch, tmp_path); session_store.start_session("active", platforms=["Docker Swarm"], total=2)
    first = _record("active"); second = dict(_record("active"), scenario="memory", repetition=1)
    session_store.save_session_records([first]); assert len(session_store.read_rows()) == 1
    session_store.save_session_records([first, second], finished=True); assert len(session_store.read_rows()) == 2
    payload = json.loads(session_store.paths()["json"].read_text(encoding="utf-8"))
    assert payload["session_id"] == session_store.validate_consistency() == "active"


def test_mixed_session_is_rejected(monkeypatch, tmp_path):
    _redirect(monkeypatch, tmp_path); session_store.start_session("active", platforms=["Docker Swarm"], total=1)
    with pytest.raises(ValueError, match="Mixed session"):
        session_store.save_session_records([_record("other")])


def test_only_real_failures_enter_errors_and_secrets_are_not_added(monkeypatch, tmp_path):
    _redirect(monkeypatch, tmp_path); session_store.start_session("active", platforms=["Docker Swarm"], total=2)
    skipped = _record("active", "SKIPPED"); skipped["skip_reason"] = "single node"
    failed = dict(_record("active", "FAIL"), scenario="latency", error_count=1, error_message="safe failure")
    failed["_error_context"] = {"command": "safe", "error_type": "Test", "suggested_solution": "inspect"}
    session_store.save_session_records([skipped, failed])
    errors = session_store.read_rows(session_store.paths()["errors"])
    assert len(errors) == 1 and errors[0]["Error Message"] == "safe failure"


def test_explicit_state_machine_persists_terminal_states(monkeypatch, tmp_path):
    _redirect(monkeypatch, tmp_path); session_store.start_session("state", platforms=["Docker Swarm"], total=1)
    assert session_store.get_state() == "STARTING"
    session_store.set_state("RUNNING"); assert session_store.get_state() == "RUNNING"
    session_store.set_state("STOPPING"); assert session_store.get_state() == "STOPPING"
    meta=session_store.set_state("CANCELLED"); assert session_store.get_state() == "CANCELLED" and meta["finished_at"]


def test_active_pointer_resolves_exact_session_paths(monkeypatch, tmp_path):
    sessions, _active = _redirect(monkeypatch, tmp_path); session_store.start_session("selected", platforms=["Kubernetes"], total=1)
    assert session_store.current_session_id() == "selected"
    assert session_store.paths()["report"] == sessions / "selected" / "report.pdf"
