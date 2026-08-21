"""Regression tests for per-scenario baseline and restoration gates."""

from __future__ import annotations

from types import SimpleNamespace

import test_runner


class FakePlatform:
    name = "swarm"
    timeout = 1
    interval = 0
    request_timeout = 1
    logger = None
    cancel_event = None
    service = "cars-rental_backend"
    health_url = "http://127.0.0.1:8000/health"

    def command(self, args, timeout=30, cleanup=False):
        text = " ".join(args)
        if ".Endpoint.Spec.Ports" in text:
            return SimpleNamespace(returncode=0, stdout='[{"TargetPort":8000,"PublishedPort":8000}]', stderr="", args=args)
        return SimpleNamespace(returncode=0, stdout="1/1", stderr="", args=args)


def test_swarm_backend_url_uses_ipv4_and_discovered_port():
    assert test_runner.get_swarm_backend_url(FakePlatform()) == "http://127.0.0.1:8000/health"


def test_execute_always_restores_after_handler_failure(monkeypatch):
    events = []
    monkeypatch.setattr(test_runner, "prepare_clean_baseline", lambda platform: events.append("prepare") or {"database_url": "original"})
    monkeypatch.setattr(test_runner, "finalize_scenario_environment", lambda platform, state: events.append(("finalize", state["database_url"])))
    monkeypatch.setitem(test_runner.ROUTES, "cpu", lambda *_args: (_ for _ in ()).throw(RuntimeError("injection failed")))
    result = test_runner.execute("swarm", "cpu", 1)
    assert result["status"] == "FAIL"
    assert events == ["prepare", ("finalize", "original")]


def test_cleanup_failure_is_distinct_and_cannot_be_pass(monkeypatch):
    monkeypatch.setattr(test_runner, "prepare_clean_baseline", lambda platform: {})
    monkeypatch.setattr(test_runner, "finalize_scenario_environment", lambda *_args: (_ for _ in ()).throw(RuntimeError("restore timeout")))
    monkeypatch.setitem(test_runner.ROUTES, "cpu", lambda *_args: {**test_runner.result_template("swarm", "cpu", 1), "status": "PASS", "error_count": 0})
    result = test_runner.execute("swarm", "cpu", 1)
    assert result["status"] == "FAIL"
    assert result["_error_context"]["error_type"] == "CLEANUP_FAILURE"


def test_next_execute_gets_a_new_baseline(monkeypatch):
    calls = []
    monkeypatch.setattr(test_runner, "prepare_clean_baseline", lambda platform: calls.append("baseline") or {})
    monkeypatch.setattr(test_runner, "finalize_scenario_environment", lambda *_args: calls.append("restored"))
    monkeypatch.setitem(test_runner.ROUTES, "cpu", lambda *_args: {**test_runner.result_template("swarm", "cpu", 1), "status": "PASS"})
    test_runner.execute("swarm", "cpu", 1); test_runner.execute("swarm", "cpu", 2)
    assert calls == ["baseline", "restored", "baseline", "restored"]
