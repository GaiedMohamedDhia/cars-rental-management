import csv
from contextlib import contextmanager
import socket
import time
from pathlib import Path

import pytest

import run_all_tests
import test_runner
from src.command_runner import CommandResult
from test_runner import NA, NOT_MEASURED, NOT_REQUIRED, PDF_SCENARIOS, execute, result_template


REQUIRED_FIELDS = {
    "session_id", "test_id", "timestamp_start", "timestamp_end", "platform", "scenario", "repetition", "status",
    "detection_time_seconds", "recovery_time_seconds", "first_healthy_response_seconds",
    "total_test_duration_seconds", "recovery_required", "recovery_success", "http_success_count",
    "http_failure_count", "availability_percent", "average_response_time_ms", "p95_response_time_ms",
    "maximum_response_time_ms", "maximum_cpu_percent", "maximum_memory_mb", "replicas_before",
    "replicas_after", "restarted_tasks", "old_task_id", "new_task_id", "old_resource_name",
    "new_resource_name", "error_count", "error_message", "skip_reason", "notes",
}


def test_result_schema_is_complete_and_semantic() -> None:
    record = result_template("swarm", "cpu", 1)
    assert REQUIRED_FIELDS <= set(record)
    assert record["detection_time_seconds"] == NA
    assert record["average_response_time_ms"] == NOT_MEASURED


@pytest.mark.parametrize("scenario", PDF_SCENARIOS)
def test_each_pdf_route_has_a_non_mutating_dry_run(scenario: str) -> None:
    record = execute("kubernetes", scenario, 1, dry_run=True)
    assert record["scenario"] == scenario
    assert record["status"] == "SKIPPED"
    assert "Dry-run" in record["skip_reason"]


def test_unsupported_scenario_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsupported scenario"):
        execute("swarm", "rolling-update", 1, dry_run=True)


def test_persist_creates_structured_empty_error_header(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(run_all_tests, "ROOT", tmp_path)
    record = execute("swarm", "network-partition", 1, dry_run=True)
    run_all_tests.persist([record])
    with (tmp_path / "results" / "logs" / "errors.csv").open(encoding="utf-8", newline="") as stream:
        assert csv.DictReader(stream).fieldnames == ["timestamp", "session_id", "platform", "scenario", "command", "exit_code", "stdout", "stderr", "error_type", "error_message", "suggested_solution"]


@pytest.mark.parametrize("scenario", ["cpu", "memory"])
def test_healthy_pressure_does_not_require_recovery(monkeypatch, scenario: str) -> None:
    class FakePlatform:
        name = "swarm"
        dry_run = False
        interval = 0
        namespace = "default"
        logger = None

        def prerequisites(self): pass

        @contextmanager
        def health_access(self):
            yield "http://example.test/health"

        def check_cancelled(self): pass
        def command(self, args, timeout=30, cleanup=False):
            if args[:2] == ["docker", "inspect"]:
                return CommandResult(tuple(args), 0, '{"Running":false,"ExitCode":0}')
            return CommandResult(tuple(args), 0)

    class FakeSampler:
        def __init__(self, *_args, **_kwargs):
            self.samples = [{"time": time.monotonic(), "status": 200, "response_ms": 5, "cpu": 10, "memory_mb": 100}]
        def start(self): pass
        def stop(self): pass
        def apply(self, record):
            record.update(http_success_count=1, http_failure_count=0, average_response_time_ms=5, p95_response_time_ms=5, maximum_response_time_ms=5, maximum_cpu_percent=10, maximum_memory_mb=100, availability_percent=100)

    monkeypatch.setattr(test_runner, "HealthSampler", FakeSampler)
    monkeypatch.setattr(test_runner, "require_healthy_baseline", lambda *_args, **_kwargs: None)
    monkeypatch.setitem(test_runner.CONFIG["tests"], "cpu_duration_seconds", 0)
    monkeypatch.setitem(test_runner.CONFIG["tests"], "memory_duration_seconds", 0)
    record = test_runner.run_bounded_pressure(FakePlatform(), 1, scenario)
    assert record["status"] == "PASS"
    assert record["recovery_required"] is False
    assert record["recovery_success"] == NOT_REQUIRED
    assert record["recovery_time_seconds"] == NA


def test_swarm_discovery_uses_full_task_id_for_container_label() -> None:
    seen: list[list[str]] = []

    class FakePlatform:
        service = "cars-rental_backend"

        def command(self, args, timeout=30, cleanup=False):
            seen.append(args)
            if args[:3] == ["docker", "service", "ps"]:
                return CommandResult(tuple(args), 0, stdout="full-task-id|Running 1 second ago|worker\n")
            if args[:2] == ["docker", "ps"]:
                return CommandResult(tuple(args), 0, stdout="container-id\n")
            return CommandResult(tuple(args), 0, stdout="1\n")

    state = test_runner.swarm_state(FakePlatform())
    assert state["container"] == "container-id"
    assert "--no-trunc" in seen[0]
    assert "label=com.docker.swarm.task.id=full-task-id" in seen[1]


@pytest.mark.parametrize("line", [
    "Forwarding from 127.0.0.1:8001 -> 8000",
    "Forwarding from [::1]:8001 -> 8000",
])
def test_valid_port_forward_output_is_recognized(line: str) -> None:
    assert test_runner.port_forward_ready_output(line)
    assert not test_runner.port_forward_ready_output("error: unable to listen")


def test_dynamic_port_selection_when_preferred_is_occupied() -> None:
    with socket.socket() as occupied:
        occupied.bind(("127.0.0.1", 0)); occupied.listen(1)
        preferred = occupied.getsockname()[1]
        selected, changed = test_runner.select_local_port(preferred)
    assert changed is True
    assert selected != preferred


def test_kubernetes_health_access_never_reuses_unknown_existing_forward(monkeypatch) -> None:
    platform = test_runner.Platform("kubernetes", dry_run=False)
    platform.service = "backend"; platform.namespace = "default"; platform.timeout = 1
    platform.health_url = "http://127.0.0.1:8001/health"
    monkeypatch.setattr(platform, "wait_for_backend_endpoint", lambda **_kwargs: None)
    monkeypatch.setattr(test_runner, "select_local_port", lambda preferred: (18001, True))
    monkeypatch.setattr(test_runner.requests, "get", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unknown forward must not be probed/reused")))

    class Process:
        stdout = None; returncode = 0
        def poll(self): return 1

    monkeypatch.setattr(test_runner.subprocess, "Popen", lambda *_args, **_kwargs: Process())
    with pytest.raises(test_runner.ScenarioError) as error:
        with platform.health_access():
            pass
    assert error.value.error_type == "PORT_FORWARD_DIED"


def test_health_poll_retries_until_http_200(monkeypatch) -> None:
    statuses = iter([ConnectionError(), 503, 200])

    def fake_get(_url, timeout):
        value = next(statuses)
        if isinstance(value, Exception):
            raise test_runner.requests.RequestException(str(value))
        return type("Response", (), {"status_code": value})()

    monkeypatch.setattr(test_runner.requests, "get", fake_get)
    result = test_runner.poll_health("http://backend/health", 1, 0.01, request_timeout_seconds=0.1)
    assert result["success"] is True
    assert [sample["status"] for sample in result["samples"]] == [0, 503, 200]


def test_backend_ready_wait_runs_rollout_wait_and_returns_ready_pod() -> None:
    commands: list[list[str]] = []
    ready_pod = {"status": {"phase": "Running", "conditions": [{"type": "Ready", "status": "True"}]}}

    class FakePlatform:
        deployment = "backend"
        namespace = "default"
        pod_selector = "app=backend"
        interval = 0
        logger = None
        def check_cancelled(self): pass
        def command(self, args, timeout=30):
            commands.append(args)
            return CommandResult(tuple(args), 0, stdout='{"spec":{"replicas":1},"status":{"availableReplicas":1}}')
        def k8s_pods(self):
            return [ready_pod]

    selected = test_runner.Platform.ensure_kubernetes_backend_ready(FakePlatform())
    assert selected is ready_pod
    assert commands[0][1:3] == ["get", "deployment"]


def test_failure_before_injection_does_not_claim_failed_recovery() -> None:
    record = test_runner.fail(result_template("kubernetes", "cpu", 1), RuntimeError("precondition"), time.monotonic())
    assert record["status"] == "FAIL"
    assert record["recovery_success"] == NA


def test_skipped_node_failure_has_na_recovery_semantics() -> None:
    record = test_runner.skip(result_template("kubernetes", "node-failure", 1), "Single-node Kubernetes", time.monotonic())
    assert record["status"] == "SKIPPED"
    assert record["recovery_required"] == NA
    assert record["recovery_success"] == NA


def test_usable_node_count_excludes_cordoned_and_not_ready_nodes() -> None:
    def node(name, ready, unschedulable=False):
        return {"metadata": {"name": name}, "spec": {"unschedulable": unschedulable}, "status": {"conditions": [{"type": "Ready", "status": "True" if ready else "False"}]}}
    nodes = [node("control-plane", True), node("cordoned-worker", True, True), node("failed-worker", False)]
    assert [item["metadata"]["name"] for item in test_runner.usable_ready_nodes(nodes)] == ["control-plane"]
def test_memory_quantity_and_safe_kubernetes_selection() -> None:
    assert test_runner._memory_quantity_mib("1048576Ki") == 1024
    assert test_runner._memory_quantity_mib("2Gi") == 2048

    class Platform:
        logger = None
        def command(self, args, cleanup=False, timeout=30):
            if args[:3] == ["kubectl", "get", "node"]:
                return CommandResult(tuple(args), 0, '{"status":{"allocatable":{"memory":"4Gi"}}}')
            return CommandResult(tuple(args), 0, "minikube 500m 12% 1024Mi 25%")

    assert test_runner._safe_kubernetes_memory_mb(Platform(), "minikube", 512) == 128


def test_pressure_watchdog_uses_busybox_compatible_timeout() -> None:
    source = Path(test_runner.__file__).read_text(encoding="utf-8")
    assert "timeout -s KILL" in source
    assert "timeout -s TERM -k" not in source
    assert '["--cpus", str(cpu_workers)]' in source


def test_pending_pod_is_not_terminal_and_unschedulable_is_extracted() -> None:
    pending = {"status": {"phase": "Pending", "conditions": [{"type": "PodScheduled", "status": "True"}]}}
    assert test_runner.pod_failure_reason(pending) == ""
    blocked = {"status": {"phase": "Pending", "conditions": [{"type": "PodScheduled", "status": "False", "reason": "Unschedulable", "message": "0/1 nodes are available: insufficient cpu"}]}}
    assert "insufficient cpu" in test_runner.pod_failure_reason(blocked)


def test_safe_cpu_selection_is_bounded_by_available_node_cpu() -> None:
    class Platform:
        logger = None
        def command(self, args, cleanup=False, timeout=30):
            if args[:3] == ["kubectl", "get", "node"]:
                return CommandResult(tuple(args), 0, '{"status":{"allocatable":{"cpu":"2"}}}')
            return CommandResult(tuple(args), 0, "minikube 1200m 60% 1Gi 25%")
    workers, request, limit = test_runner._safe_kubernetes_cpu(Platform(), "minikube", 4)
    assert workers == 1
    assert 100 <= request <= limit <= 500


def test_backend_endpoint_rejects_old_ip_and_accepts_replacement(monkeypatch) -> None:
    payloads = iter([
        '{"items":[{"endpoints":[{"addresses":["10.0.0.1"],"conditions":{"ready":true}}]}]}',
        '{"items":[{"endpoints":[{"addresses":["10.0.0.2"],"conditions":{"ready":true}}]}]}',
    ])

    class Platform:
        namespace = "default"; service = "backend"; timeout = 1; interval = 0; logger = None
        def command(self, *_args, **_kwargs):
            return CommandResult(("kubectl",), 0, next(payloads))

    test_runner.Platform.wait_for_backend_endpoint(Platform(), "10.0.0.2", timeout=1)


def test_kubectl_transient_failure_refreshes_context_and_retries(monkeypatch) -> None:
    calls: list[tuple[str, ...]] = []

    def run(args, **_kwargs):
        args = tuple(args); calls.append(args)
        if args[:2] == ("kubectl", "get") and sum(call[:2] == ("kubectl", "get") for call in calls) == 1:
            return CommandResult(args, 1, stderr="Unable to connect to the server: tls handshake timeout")
        return CommandResult(args, 0, stdout="ok")

    monkeypatch.setattr(test_runner, "run_command", run)
    platform = test_runner.Platform("kubernetes")
    result = platform.command(["kubectl", "get", "nodes"])
    assert result.returncode == 0
    assert ("minikube", "update-context") in calls
    assert calls.count(("kubectl", "get", "nodes")) == 2


def test_kubernetes_stress_image_is_not_repulled_between_campaigns() -> None:
    """A cached stress image must make repeated runs registry-independent."""
    source = Path(test_runner.__file__).read_text(encoding="utf-8")
    assert '"imagePullPolicy": "IfNotPresent"' in source
