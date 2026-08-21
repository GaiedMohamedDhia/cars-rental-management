"""Unit tests for isolated Toxiproxy orchestration; no real fault is injected."""

from contextlib import contextmanager
import json

import pytest

import test_runner
from src.toxiproxy_manager import (
    ToxiproxyClient, environment_value, kubernetes_environment_patch,
    kubernetes_manifest, latency_toxic_payload, proxy_payload,
    replace_database_host, replace_environment_value, resource_name,
    write_json_payload,
)


class FakeResponse:
    status_code = 200
    content = b"{}"
    def raise_for_status(self): return None
    def json(self): return {}


def test_authentication_retries_one_server_error_after_recovery(monkeypatch) -> None:
    """Valid auth -> restored infrastructure -> auth again must not end at 500."""
    responses = iter([
        type("Response", (), {"status_code": 500, "json": lambda self: {}})(),
        type("Response", (), {"status_code": 200, "json": lambda self: {"access_token": "opaque-token"}})(),
    ])
    recoveries: list[str] = []
    monkeypatch.setenv("RESILIENCE_TEST_IDENTIFIER", "configured-user")
    monkeypatch.setenv("RESILIENCE_TEST_PASSWORD", "configured-password")
    monkeypatch.setattr(test_runner.requests, "post", lambda *_a, **_k: next(responses))
    test_runner._AUTH_TOKEN_CACHE.clear()
    headers = test_runner._resilience_auth_headers(
        "http://backend/health", recovery=lambda: recoveries.append("restored")
    )
    assert recoveries == ["restored"]
    assert headers == {"Authorization": "Bearer opaque-token"}


def test_authentication_does_not_retry_credential_failure(monkeypatch) -> None:
    calls = []
    response = type("Response", (), {"status_code": 401, "json": lambda self: {}})()
    monkeypatch.setenv("RESILIENCE_TEST_IDENTIFIER", "configured-user")
    monkeypatch.setenv("RESILIENCE_TEST_PASSWORD", "configured-password")
    monkeypatch.setattr(test_runner.requests, "post", lambda *_a, **_k: response)
    test_runner._AUTH_TOKEN_CACHE.clear()
    with pytest.raises(test_runner.ScenarioError, match="HTTP 401"):
        test_runner._resilience_auth_headers(
            "http://backend/health", recovery=lambda: calls.append("wrong")
        )
    assert calls == []


class RecordingSession:
    def __init__(self): self.calls = []; self.enabled = True; self.toxics = []
    def request(self, method, url, json=None, timeout=None):
        self.calls.append((method, url, json, timeout))
        if method == "POST" and json and "enabled" in json:
            self.enabled = json["enabled"]
        if method == "POST" and url.endswith("/toxics"):
            self.toxics = [json]
        if method == "DELETE" and url.endswith("/toxics/latency"):
            self.toxics = []
        response = FakeResponse()
        response.json = lambda: {"enabled": self.enabled, "toxics": self.toxics}
        return response


def test_toxiproxy_api_proxy_enable_disable_and_toxics() -> None:
    session = RecordingSession(); client = ToxiproxyClient("http://127.0.0.1:8474", session=session)
    client.create_proxy("postgres", "0.0.0.0:5433", "database:5432")
    client.disable_proxy("postgres"); client.enable_proxy("postgres")
    client.add_latency_toxic("postgres", 2000, 100); client.remove_latency_toxic("postgres")
    assert session.calls[0][0:2] == ("POST", "http://127.0.0.1:8474/proxies")
    assert any(call[2] == {"enabled": False} for call in session.calls)
    assert any(call[2] == {"enabled": True} for call in session.calls)
    assert any(call[2] and call[2].get("attributes") == {"latency": 2000, "jitter": 100} for call in session.calls)
    assert any(call[0] == "DELETE" for call in session.calls)


def test_database_url_and_unrelated_environment_are_preserved() -> None:
    original = "postgresql://user:password@database:5432/cars?sslmode=disable"
    routed = replace_database_host(original, "temporary-proxy", 5433)
    assert routed == "postgresql://user:password@temporary-proxy:5433/cars?sslmode=disable"
    environment = ["A=1", f"DATABASE_URL={original}", "B=2"]
    changed = replace_environment_value(environment, "DATABASE_URL", routed)
    assert environment_value(changed, "DATABASE_URL") == routed
    assert {"A=1", "B=2"} <= set(changed)


def test_database_url_special_characters_are_not_manually_escaped() -> None:
    original = "postgresql://usér:p%22ass%5Cword@database:5432/cars?application_name=TuniCars%2B"
    routed = replace_database_host(original, "proxy-éphémère", 5433)
    assert routed == "postgresql://usér:p%22ass%5Cword@proxy-éphémère:5433/cars?application_name=TuniCars%2B"


def test_payload_builders_are_json_serializable_dictionaries() -> None:
    proxy = proxy_payload('proxy-"unicode-é"', "0.0.0.0:5433", "database:5432")
    toxic = latency_toxic_payload(2000, 100)
    assert proxy == {"name": 'proxy-"unicode-é"', "listen": "0.0.0.0:5433", "upstream": "database:5432", "enabled": True}
    assert toxic["name"] == "latency"
    assert toxic["attributes"] == {"latency": 2000, "jitter": 100}


def test_kubernetes_patch_file_is_valid_utf8_json_and_preserves_values(tmp_path) -> None:
    environment = [{"name": "A", "value": "C:\\Temp\\fichier"}, {"name": "DATABASE_URL", "value": 'postgresql://u:p%22ass@database:5432/café'}]
    payload = kubernetes_environment_patch("backend", environment)
    destination = tmp_path / "patch.json"
    write_json_payload(destination, payload)
    decoded = json.loads(destination.read_text(encoding="utf-8"))
    assert decoded["spec"]["template"]["spec"]["containers"][0]["env"] == environment


def test_resource_names_are_unique_and_dns_safe() -> None:
    one = resource_name("kubernetes", "ABC-123", 100)
    two = resource_name("kubernetes", "ABC-123", 101)
    assert one != two
    assert one == one.lower() and len(one) <= 63 and "_" not in one


def test_kubernetes_manifest_contains_only_temporary_deployment_and_service() -> None:
    manifest = kubernetes_manifest("rt-toxiproxy-test", "default")
    assert [item["kind"] for item in manifest["items"]] == ["Deployment", "Service"]
    assert manifest["items"][0]["spec"]["template"]["spec"]["containers"][0]["image"] == "ghcr.io/shopify/toxiproxy:2.9.0"
    probe = manifest["items"][0]["spec"]["template"]["spec"]["containers"][0]["readinessProbe"]
    assert probe["httpGet"] == {"path": "/version", "port": "api"}
    ports = manifest["items"][1]["spec"]["ports"]
    assert {item["port"] for item in ports} == {8474, 5433}


class FakePlatform:
    name = "swarm"; dry_run = False; interval = 0.01; request_timeout = 1; timeout = 2
    cancel_event = None; logger = None
    def prerequisites(self): return None
    @contextmanager
    def health_access(self): yield "http://localhost:8000/health"


class FakeToxiproxy:
    def __init__(self, *_args, **_kwargs): self.disabled = False; self.toxic = False
    def wait_for_api(self, *_args): return None
    def create_proxy(self, *_args): return {}
    def proxy_is_enabled(self, _name, expected): return self.disabled is (not expected)
    def disable_proxy(self, *_args): self.disabled = True; return {}
    def enable_proxy(self, *_args): self.disabled = False; return {}
    def add_latency_toxic(self, *_args): self.toxic = True; return {}
    def remove_latency_toxic(self, *_args): self.toxic = False; return {}
    def latency_toxic_is_present(self, *_args): return self.toxic


def test_api_state_helpers_verify_proxy_and_latency_toxic() -> None:
    class StatefulSession:
        def request(self, method, url, json=None, timeout=None):
            response = FakeResponse()
            response.json = lambda: {
                "enabled": False,
                "toxics": [{"name": "latency", "type": "latency", "attributes": {"latency": 2000, "jitter": 100}}],
            }
            return response
    client = ToxiproxyClient("http://tox", session=StatefulSession())
    assert client.proxy_is_enabled("postgres", False)
    assert client.latency_toxic_is_present("postgres", 2000, 100)


def test_toxic_delete_timeout_is_accepted_only_when_api_confirms_absence() -> None:
    class AppliedThenTimedOut:
        def request(self, method, url, json=None, timeout=None):
            if method == "DELETE":
                raise test_runner.requests.Timeout("response deadline")
            response = FakeResponse()
            response.json = lambda: {"enabled": True, "toxics": []}
            return response
    client = ToxiproxyClient("http://tox", session=AppliedThenTimedOut())
    assert client.remove_latency_toxic("postgres") == {}


def _scenario_mocks(monkeypatch, sample_batches):
    monkeypatch.setattr(test_runner, "_discover_database_probe", lambda health_url, _timeout, **_kwargs: ("/cars", health_url.replace("/health", "/cars"), {"Authorization": "Bearer test-token"}))
    monkeypatch.setattr(test_runner, "_resilience_auth_headers", lambda _url: {"Authorization": "Bearer test-token"})
    state = {"original": "postgresql://u:p@database:5432/cars", "proxy_host": "tox", "api_url": "http://tox", "resource": "tox", "process": None, "manifest": None}
    monkeypatch.setattr(test_runner, "_swarm_toxiproxy_setup", lambda *_args: state)
    monkeypatch.setattr(test_runner, "_reroute_database", lambda *_args: state.update(rerouted=True))
    cleanup_calls = []
    monkeypatch.setattr(test_runner, "_cleanup_toxiproxy", lambda *_args: cleanup_calls.append(True) or True)
    monkeypatch.setattr(test_runner, "ToxiproxyClient", FakeToxiproxy)
    monkeypatch.setattr(test_runner, "_wait_probe", lambda *_args, **_kwargs: 0.25)
    batches = iter(sample_batches)
    monkeypatch.setattr(test_runner, "collect_http_samples", lambda *_args, **_kwargs: next(batches))
    return state, cleanup_calls


def _samples(statuses, response_ms):
    return [{"time": index + 1.0, "status": status, "response_ms": response_ms} for index, status in enumerate(statuses)]


def test_network_partition_pass_requires_observed_failure_and_cleanup(monkeypatch) -> None:
    _state, cleanup = _scenario_mocks(monkeypatch, [_samples([200, 200], 10), _samples([0, 0], 1000)])
    record = test_runner.run_network_partition(FakePlatform(), 1)
    assert record["status"] == "PASS", record["error_message"]
    assert record["injection_confirmed"] is True and record["degradation_observed"] is True
    assert record["restoration_success"] is True and cleanup == [True]


def test_latency_pass_requires_measured_increase(monkeypatch) -> None:
    _state, cleanup = _scenario_mocks(monkeypatch, [_samples([200, 200], 10), _samples([200, 200], 2100), _samples([200, 200], 12)])
    record = test_runner.run_degraded_latency(FakePlatform(), 1)
    assert record["status"] == "PASS", record["error_message"]
    assert record["baseline_average_response_time_ms"] == 10
    assert record["injected_average_response_time_ms"] == 2100
    assert cleanup == [True]


def test_exception_still_runs_cleanup(monkeypatch) -> None:
    _state, cleanup = _scenario_mocks(monkeypatch, [_samples([200], 10)])
    monkeypatch.setattr(test_runner.ToxiproxyClient, "disable_proxy", lambda *_args: (_ for _ in ()).throw(RuntimeError("injection failed")))
    record = test_runner.run_network_partition(FakePlatform(), 1)
    assert record["status"] == "FAIL"
    assert cleanup == [True]


def test_exact_skip_reason_when_database_url_is_not_inspectable(monkeypatch) -> None:
    reason = "Backend DATABASE_URL is not exposed through the Swarm service environment, so traffic cannot be rerouted safely without modifying application code."
    monkeypatch.setattr(test_runner, "_discover_database_probe", lambda health_url, _timeout, **_kwargs: ("/cars", health_url.replace("/health", "/cars"), {"Authorization": "Bearer test-token"}))
    monkeypatch.setattr(test_runner, "_swarm_toxiproxy_setup", lambda *_args: (_ for _ in ()).throw(test_runner.ScenarioSkip(reason)))
    record = test_runner.run_network_partition(FakePlatform(), 1)
    assert record["status"] == "SKIPPED" and record["skip_reason"] == reason
