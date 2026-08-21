"""Real, guarded resilience scenarios for Docker Swarm and Kubernetes."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import socket
import statistics
import subprocess
import threading
import time
from typing import Any, Callable, Iterator
from uuid import uuid4
from urllib.parse import urlsplit

import psutil
import requests
import yaml

from src.command_runner import CommandResult, format_command, parse_json_output, run_command, safe_stderr, safe_stdout
from src.metrics_collector import average, maximum, percentile_95
from src.toxiproxy_manager import (
    TOXIPROXY_IMAGE, ToxiproxyClient, environment_value, kubernetes_environment_patch,
    kubernetes_manifest, replace_database_host, resource_name, write_json_payload,
)

ROOT = Path(__file__).resolve().parent
CONFIG = yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))
PDF_SCENARIOS = ("container-kill", "node-failure", "cpu", "memory", "network-partition", "latency")
NA = "N/A"
NOT_REQUIRED = "Not Required"
NOT_MEASURED = "Not Measured"


class ScenarioError(RuntimeError):
    def __init__(self, message: str, *, command: str = "", exit_code: int | str = NA, stdout: str = "", stderr: str = "", error_type: str = "ScenarioError", solution: str = "Check the environment and platform logs.") -> None:
        super().__init__(message)
        self.command = command
        self.exit_code = exit_code
        self.stdout = stdout
        self.stderr = stderr
        self.error_type = error_type
        self.solution = solution


class ScenarioCancelled(RuntimeError):
    pass


class ScenarioSkip(RuntimeError):
    """A precise environmental limitation discovered before fault injection."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def result_template(platform: str, scenario: str, repetition: int) -> dict[str, Any]:
    return {
        "session_id": "", "test_id": f"{platform}-{scenario}-{repetition}-{uuid4().hex[:8]}",
        "timestamp_start": utc_now(), "timestamp_end": NA,
        "platform": platform, "scenario": scenario, "repetition": repetition,
        "status": "RUNNING", "detection_time_seconds": NA,
        "recovery_time_seconds": NA, "first_healthy_response_seconds": NA,
        "total_test_duration_seconds": NA, "recovery_required": NA,
        "recovery_success": NA, "http_success_count": 0, "http_failure_count": 0,
        "availability_percent": NOT_MEASURED, "average_response_time_ms": NOT_MEASURED,
        "p95_response_time_ms": NOT_MEASURED, "maximum_response_time_ms": NOT_MEASURED,
        "maximum_cpu_percent": NOT_MEASURED, "maximum_memory_mb": NOT_MEASURED,
        "injection_method": NA, "injection_started": NA,
        "injection_confirmed": False, "degradation_observed": False,
        "restoration_success": NA, "baseline_average_response_time_ms": NOT_MEASURED,
        "baseline_median_response_time_ms": NOT_MEASURED,
        "baseline_p95_response_time_ms": NOT_MEASURED,
        "injected_average_response_time_ms": NOT_MEASURED,
        "injected_median_response_time_ms": NOT_MEASURED,
        "injected_p95_response_time_ms": NOT_MEASURED,
        "recovery_average_response_time_ms": NOT_MEASURED,
        "recovery_median_response_time_ms": NOT_MEASURED,
        "recovery_p95_response_time_ms": NOT_MEASURED,
        "replicas_before": NOT_MEASURED, "replicas_after": NOT_MEASURED,
        "restarted_tasks": 0, "old_task_id": NA, "new_task_id": NA,
        "old_resource_name": NA, "new_resource_name": NA, "error_count": 0,
        "error_message": "", "skip_reason": "", "notes": "",
    }


def finish(record: dict[str, Any], started: float) -> dict[str, Any]:
    record["timestamp_end"] = utc_now()
    record["total_test_duration_seconds"] = round(time.monotonic() - started, 3)
    return record


def skip(record: dict[str, Any], reason: str, started: float) -> dict[str, Any]:
    record.update(status="SKIPPED", recovery_required=NA, recovery_success=NA, skip_reason=reason, notes=reason)
    return finish(record, started)


def fail(record: dict[str, Any], error: Exception, started: float) -> dict[str, Any]:
    if isinstance(error, ScenarioCancelled):
        record.update(status="CANCELLED", recovery_success=NA, error_count=0, error_message=str(error), notes="Cancelled by user.")
        return finish(record, started)
    recovery_was_required = record.get("recovery_required") is True
    record.update(status="FAIL", recovery_success=False if recovery_was_required else NA, error_count=1, error_message=str(error))
    if isinstance(error, ScenarioError):
        record["_error_context"] = {
            "command": error.command, "exit_code": error.exit_code,
            "stdout": error.stdout, "stderr": error.stderr,
            "error_type": error.error_type, "suggested_solution": error.solution,
        }
    return finish(record, started)


def require_ok(outcome: CommandResult, solution: str) -> str:
    if outcome.returncode != 0:
        message = safe_stderr(outcome).strip() or safe_stdout(outcome).strip() or "Command failed"
        raise ScenarioError(message, command=format_command(outcome.args), exit_code=outcome.returncode, stdout=safe_stdout(outcome), stderr=safe_stderr(outcome), error_type="CommandError", solution=solution)
    return outcome.stdout.strip()


def port_forward_ready_output(output: str) -> bool:
    """Recognize kubectl's normal IPv4 or IPv6 forwarding startup lines."""
    return "Forwarding from 127.0.0.1:" in output or "Forwarding from [::1]:" in output


def select_local_port(preferred: int) -> tuple[int, bool]:
    """Return the preferred free port, otherwise a dynamically allocated port."""
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", preferred)) != 0:
            return preferred, False
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1]), True


def poll_health(url: str, timeout_seconds: float, interval_seconds: float = 1, *, request_timeout_seconds: float = 4, logger: Any = None, cancel_event: threading.Event | None = None) -> dict[str, Any]:
    """Poll an HTTP health endpoint until 200 or timeout and retain real samples."""
    deadline = time.monotonic() + timeout_seconds
    samples: list[dict[str, Any]] = []
    previous_state: str | None = None
    while time.monotonic() < deadline:
        if cancel_event and cancel_event.is_set():
            raise ScenarioCancelled("Current scenario cancelled by user.")
        started = time.perf_counter(); status = 0
        try:
            status = requests.get(url, timeout=request_timeout_seconds).status_code
        except requests.RequestException:
            status = 0
        elapsed_ms = (time.perf_counter() - started) * 1000
        samples.append({"status": status, "response_ms": elapsed_ms, "time": time.monotonic(), "cpu": psutil.cpu_percent(interval=None), "memory_mb": psutil.virtual_memory().used / 1024**2})
        state = "healthy" if status == 200 else "unhealthy"
        if state != previous_state and logger:
            logger(f"[HEALTH] {url} -> {state} (HTTP {status or 'unreachable'})")
        previous_state = state
        if status == 200:
            return {"success": True, "samples": samples, "first_healthy_seconds": timeout_seconds - max(0, deadline - time.monotonic())}
        time.sleep(max(0.1, interval_seconds))
    return {"success": False, "samples": samples, "first_healthy_seconds": None}


def require_healthy_baseline(platform: "Platform", url: str) -> None:
    """Block fault injection when the application is already unhealthy."""
    baseline = poll_health(url, min(180, platform.timeout), max(2, platform.interval), request_timeout_seconds=platform.request_timeout, logger=platform.logger, cancel_event=platform.cancel_event)
    if not baseline["success"]:
        raise ScenarioError("Precondition failed: backend was not healthy before injection.", error_type="PreconditionFailed", solution="Repair the selected platform and verify HTTP /health = 200 before running resilience tests.")


def collect_http_samples(url: str, duration_seconds: float, interval_seconds: float, request_timeout_seconds: float, *, headers: dict[str, str] | None = None, cancel_event: threading.Event | None = None) -> list[dict[str, Any]]:
    """Collect endpoint availability and latency without manufacturing samples."""
    samples: list[dict[str, Any]] = []
    deadline = time.monotonic() + max(0, duration_seconds)
    while time.monotonic() < deadline:
        if cancel_event and cancel_event.is_set():
            raise ScenarioCancelled("Current scenario cancelled by user.")
        started = time.perf_counter(); status = 0
        try:
            status = requests.get(url, headers=headers, timeout=request_timeout_seconds).status_code
        except requests.RequestException:
            status = 0
        samples.append({"time": time.monotonic(), "status": status, "response_ms": (time.perf_counter() - started) * 1000})
        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(max(0.05, interval_seconds), remaining))
    return samples


def sample_metrics(samples: list[dict[str, Any]]) -> dict[str, Any]:
    successes = [item for item in samples if 200 <= int(item["status"]) < 300]
    response = [float(item["response_ms"]) for item in samples]
    return {
        "http_success_count": len(successes), "http_failure_count": len(samples) - len(successes),
        "availability_percent": round(100 * len(successes) / len(samples), 2) if samples else NOT_MEASURED,
        "average_response_time_ms": round(average(response), 3) if response else NOT_MEASURED,
        "median_response_time_ms": round(statistics.median(response), 3) if response else NOT_MEASURED,
        "p95_response_time_ms": round(percentile_95(response), 3) if response else NOT_MEASURED,
        "maximum_response_time_ms": round(maximum(response), 3) if response else NOT_MEASURED,
    }


class HealthSampler:
    def __init__(self, url: str, interval: float = 0.5) -> None:
        self.url = url
        self.interval = max(0.2, interval)
        self.samples: list[dict[str, Any]] = []
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        def collect() -> None:
            while not self._stop.is_set():
                started = time.perf_counter()
                status = 0
                try:
                    response = requests.get(self.url, timeout=max(3.0, self.interval * 4))
                    status = response.status_code
                except requests.RequestException:
                    pass
                self.samples.append({"time": time.monotonic(), "status": status, "response_ms": (time.perf_counter() - started) * 1000, "cpu": psutil.cpu_percent(interval=None), "memory_mb": psutil.virtual_memory().used / 1024**2})
                self._stop.wait(self.interval)
        self._thread = threading.Thread(target=collect, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)

    def apply(self, record: dict[str, Any]) -> None:
        successes = [sample for sample in self.samples if sample["status"] == 200]
        failures = len(self.samples) - len(successes)
        response_times = [sample["response_ms"] for sample in self.samples]
        record.update(
            http_success_count=len(successes), http_failure_count=failures,
            availability_percent=round(len(successes) * 100 / len(self.samples), 2) if self.samples else NOT_MEASURED,
            average_response_time_ms=round(average(response_times), 3) if response_times else NOT_MEASURED,
            p95_response_time_ms=round(percentile_95(response_times), 3) if response_times else NOT_MEASURED,
            maximum_response_time_ms=round(maximum(response_times), 3) if response_times else NOT_MEASURED,
            maximum_cpu_percent=round(maximum([sample["cpu"] for sample in self.samples]), 2) if self.samples else NOT_MEASURED,
            maximum_memory_mb=round(maximum([sample["memory_mb"] for sample in self.samples]), 2) if self.samples else NOT_MEASURED,
        )

    def first_healthy_after(self, event: float) -> float | None:
        sample = next((item for item in self.samples if item["time"] >= event and item["status"] == 200), None)
        return sample["time"] - event if sample else None

    def first_recovery_after(self, event: float) -> float | None:
        relevant = [item for item in self.samples if item["time"] >= event]
        first_failure = next((item for item in relevant if item["status"] != 200), None)
        threshold = first_failure["time"] if first_failure else event
        sample = next((item for item in relevant if item["time"] > threshold and item["status"] == 200), None)
        return sample["time"] - event if sample else None


class Platform:
    def __init__(self, name: str, *, dry_run: bool = False, cancel_event: threading.Event | None = None, logger: Any = None, process_holder: dict[str, subprocess.Popen[str] | None] | None = None, context_switcher: Any = None) -> None:
        self.name = name
        self.dry_run = dry_run
        self.cancel_event = cancel_event
        self.logger = logger
        self.process_holder = process_holder
        self.context_switcher = context_switcher
        self.timeout = float(CONFIG["tests"]["health_timeout_seconds"])
        self.interval = float(CONFIG["tests"]["polling_interval_seconds"])
        self.request_timeout = float(CONFIG["tests"].get("request_timeout_seconds", 4))
        self.created_port_forward: subprocess.Popen[str] | None = None
        self.namespace = "default"
        self.deployment = "backend"
        self.container_name = "backend"
        self.current_context = "Unknown"
        self.service = CONFIG["swarm"]["backend_service"] if name == "swarm" else "backend"
        self.pod_selector = "app=backend"
        self.health_url = CONFIG["swarm"]["health_url"] if name == "swarm" else CONFIG["kubernetes"]["local_backend_url"]

    def command(self, args: list[str], timeout: float = 30, *, cleanup: bool = False) -> CommandResult:
        if not cleanup:
            self.check_cancelled()
        if self.logger:
            self.logger(f"[COMMAND] {format_command(args)}")
        result = run_command(args, dry_run=self.dry_run, timeout_seconds=timeout, cwd=ROOT.parent, cancel_event=None if cleanup else self.cancel_event, on_output=self.logger, process_holder=self.process_holder)
        if args and args[0] == "kubectl" and result.returncode != 0 and not cleanup:
            diagnostic = f"{safe_stdout(result)} {safe_stderr(result)}".lower()
            stale = any(marker in diagnostic for marker in ("connection refused", "no connection could be made", "current-context is not set", "localhost:"))
            transient = stale or any(marker in diagnostic for marker in ("tls handshake timeout", "i/o timeout", "temporarily unavailable", "connection reset", "context deadline exceeded"))
            if transient:
                category = "KUBE_CONTEXT_STALE" if stale else "KUBE_API_UNREACHABLE"
                if self.logger:
                    self.logger(f"[{category}] kubectl failed transiently; refreshing Minikube context and retrying once.")
                run_command(["minikube", "update-context"], timeout_seconds=60, cwd=ROOT.parent, on_output=self.logger)
                run_command(["kubectl", "config", "use-context", "minikube"], timeout_seconds=30, cwd=ROOT.parent, on_output=self.logger)
                result = run_command(args, dry_run=self.dry_run, timeout_seconds=timeout, cwd=ROOT.parent, cancel_event=self.cancel_event, on_output=self.logger, process_holder=self.process_holder)
        if self.logger:
            self.logger(f"[COMMAND RESULT] exit={result.returncode} raw={result.raw_returncode} hex={result.hexadecimal_returncode} duration={result.duration_seconds}s")
        if not cleanup and (result.returncode == 130 or (self.cancel_event and self.cancel_event.is_set())):
            raise ScenarioCancelled("Current scenario cancelled by user.")
        if not cleanup and result.returncode != 0 and args[0] in {"kubectl", "minikube"}:
            diagnostic = f"{safe_stdout(result)} {safe_stderr(result)}".lower()
            category = "KUBE_COMMAND_TIMEOUT" if result.returncode == 124 or "timed out" in diagnostic else ("KUBE_API_UNREACHABLE" if any(marker in diagnostic for marker in ("connection refused", "tls handshake timeout", "unable to connect to the server")) else "KUBE_COMMAND_FAILED")
            details = (
                f"Kubernetes command failed. Command: {format_command(args)}; namespace: {self.namespace}; "
                f"current context: {self.current_context}; exit code: {result.returncode}; "
                f"raw exit code: {result.raw_returncode}; hexadecimal exit code: {result.hexadecimal_returncode}; "
                f"duration: {result.duration_seconds}s; stdout: {safe_stdout(result).strip() or '<empty>'}; "
                f"stderr: {safe_stderr(result).strip() or '<empty>'}"
            )
            raise ScenarioError(details, command=format_command(args), exit_code=result.returncode, stdout=safe_stdout(result), stderr=safe_stderr(result), error_type=category, solution="Review the exact command output, run minikube status, and verify kubectl context and cluster resources.")
        return result

    def check_cancelled(self) -> None:
        if self.cancel_event and self.cancel_event.is_set():
            raise ScenarioCancelled("Current scenario cancelled by user.")

    def prerequisites(self) -> None:
        executable = "docker" if self.name == "swarm" else "kubectl"
        if not shutil.which(executable):
            raise ScenarioError(f"{executable} is not installed or not in PATH.", error_type="MissingTool", solution=f"Install {executable} and restart the application.")
        if self.name == "swarm":
            state = require_ok(self.command(["docker", "info", "--format", "{{.Swarm.LocalNodeState}}"]), "Start Docker Desktop and initialize/deploy Docker Swarm.")
            if state.strip().lower() != "active":
                raise ScenarioError("Docker Swarm is inactive.", error_type="SwarmInactive", solution="Run docker swarm init and deploy docker-stack.yml.")
            require_ok(self.command(["docker", "service", "inspect", self.service]), f"Deploy the stack and verify service {self.service}.")
            ensure_swarm_backend_healthy(self)
        else:
            if not shutil.which("minikube"):
                raise ScenarioError("Minikube is not installed or not in PATH.", error_type="MissingTool", solution="Install Minikube and start the cluster.")
            minikube_status = self.command(["minikube", "status", "--output=json"], timeout=60, cleanup=True)
            status_text = minikube_status.stdout.lower()
            api_running = '"apiserver": "running"' in status_text or '"apiserver":"running"' in status_text
            host_running = '"host": "running"' in status_text or '"host":"running"' in status_text
            kubelet_running = '"kubelet": "running"' in status_text or '"kubelet":"running"' in status_text
            kubeconfig_ok = '"kubeconfig": "configured"' in status_text or '"kubeconfig":"configured"' in status_text
            if not (api_running and host_running and kubelet_running):
                # Minikube's Docker-driver status command can be slow on Windows.
                # A responsive Minikube API with the correct context is the
                # authoritative control-plane precondition in that case.
                api_running = self.ensure_kubernetes_api_ready()
                host_running = api_running; kubelet_running = api_running; kubeconfig_ok = api_running
            if not (api_running and host_running and kubelet_running):
                raise ScenarioError("Minikube control plane is not running.", command="minikube status", exit_code=minikube_status.returncode, stdout=minikube_status.stdout, error_type="MinikubeUnavailable", solution="Run: minikube start")
            if not kubeconfig_ok:
                require_ok(self.command(["minikube", "update-context"], timeout=60), "Refresh the Minikube kubeconfig context.")
            if minikube_status.returncode != 0 and self.logger:
                self.logger("[WARNING] Minikube reports a partially degraded profile; the API server is running, so Kubernetes checks will continue.")
            context = require_ok(self.command(["kubectl", "config", "current-context"]), "Configure kubectl for Minikube.").strip()
            self.current_context = context
            if context != "minikube":
                warning = "Minikube is running but kubectl is using another context."
                if self.logger:
                    self.logger(f"[WARNING] {warning} Current context: {context}")
                accepted = bool(self.context_switcher and self.context_switcher(context))
                if not accepted:
                    raise ScenarioError(warning, error_type="WrongKubernetesContext", solution="Run: kubectl config use-context minikube")
                require_ok(self.command(["kubectl", "config", "use-context", "minikube"]), "Run: kubectl config use-context minikube")
                context = require_ok(self.command(["kubectl", "config", "current-context"]), "Verify the selected kubectl context.").strip()
                self.current_context = context
                if context != "minikube":
                    raise ScenarioError(f"kubectl context remained {context!r} after switching.", error_type="WrongKubernetesContext", solution="Run: minikube update-context, then kubectl config use-context minikube")
            self.ensure_kubernetes_api_ready()
            require_ok(self.command(["kubectl", "get", "nodes"]), "Run minikube start and verify the API server.")
            require_ok(self.command(["kubectl", "get", "pods", "-A"]), "Verify Minikube workloads and API connectivity.")
            require_ok(self.command(["kubectl", "get", "services", "-A"]), "Verify Kubernetes services.")
            require_ok(self.command(["kubectl", "get", "deployments", "-A"]), "Verify Kubernetes deployments.")
            self.discover_kubernetes()
            self.ensure_kubernetes_backend_ready()
            deployments = parse_json_output(self.command(["kubectl", "get", "deployments", "database", "backend", "frontend", "-n", self.namespace, "-o", "json"]), "kubectl get application deployments", self.logger)
            for item in deployments.get("items", []):
                desired = int(item.get("spec", {}).get("replicas", 1)); ready = int(item.get("status", {}).get("readyReplicas") or 0)
                if ready != desired:
                    raise ScenarioError(f"Precondition failed: Kubernetes deployment {item['metadata']['name']} is {ready}/{desired} Ready.", error_type="PreconditionFailed")

    def ensure_kubernetes_api_ready(self, timeout: float = 120) -> bool:
        """Refresh kubeconfig and retry EOF/TLS/transient API failures before declaring unavailable."""
        deadline = time.monotonic() + timeout
        last = ""
        while time.monotonic() < deadline:
            self.command(["minikube", "update-context"], timeout=60, cleanup=True)
            self.command(["kubectl", "config", "use-context", "minikube"], timeout=30, cleanup=True)
            context = self.command(["kubectl", "config", "current-context"], timeout=20, cleanup=True)
            probe = self.command(["kubectl", "get", "--raw=/readyz"], timeout=30, cleanup=True)
            last = f"context={context.stdout.strip()!r}; stdout={safe_stdout(probe).strip()!r}; stderr={safe_stderr(probe).strip()!r}"
            if context.stdout.strip() == "minikube" and probe.returncode == 0 and "ok" in probe.stdout.lower():
                self.current_context = "minikube"
                return True
            if self.logger: self.logger(f"[KUBE_API_RETRY] {last}")
            time.sleep(max(2, self.interval))
        raise ScenarioError(f"Kubernetes API remained unavailable after bounded context refresh retries. Last probe: {last}", error_type="KUBE_API_UNREACHABLE", solution="Inspect minikube status and Docker Desktop networking; the full sanitized probe history is in the execution log.")

    def discover_kubernetes(self) -> None:
        payload = parse_json_output(self.command(["kubectl", "get", "deployments", "-A", "-o", "json"]), "kubectl get deployments", self.logger)
        def deployment_score(item: dict[str, Any]) -> tuple[int, int]:
            metadata = item.get("metadata", {}); spec = item.get("spec", {}); status = item.get("status", {})
            searchable = " ".join([metadata.get("name", ""), *map(str, metadata.get("labels", {}).values())]).lower().replace("_", "-")
            containers = spec.get("template", {}).get("spec", {}).get("containers", [])
            score = 8 if "backend" in searchable or "cars-rental-backend" in searchable else 0
            score += sum(4 for container in containers if "backend" in f"{container.get('name', '')} {container.get('image', '')}".lower())
            score += sum(3 for container in containers for port in container.get("ports", []) if port.get("containerPort") == 8000)
            return score, int(status.get("readyReplicas") or 0)
        candidates = sorted(payload.get("items", []), key=deployment_score, reverse=True)
        candidates = [item for item in candidates if deployment_score(item)[0] > 0]
        if not candidates:
            raise ScenarioError("Backend deployment not found.", error_type="ResourceMissing", solution="Deploy the backend Kubernetes deployment.")
        selected = candidates[0]
        self.namespace = selected["metadata"]["namespace"]
        self.deployment = selected["metadata"]["name"]
        containers = selected.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
        backend_container = next((container for container in containers if "backend" in f"{container.get('name', '')} {container.get('image', '')}".lower() or any(port.get("containerPort") == 8000 for port in container.get("ports", []))), containers[0] if containers else {})
        self.container_name = backend_container.get("name", "backend")
        selector_labels = selected.get("spec", {}).get("selector", {}).get("matchLabels", {})
        self.pod_selector = ",".join(f"{key}={value}" for key, value in selector_labels.items()) or "app=backend"
        services = parse_json_output(self.command(["kubectl", "get", "services", "-n", self.namespace, "-o", "json"]), "kubectl get services", self.logger)
        def service_score(item: dict[str, Any]) -> int:
            metadata = item.get("metadata", {}); spec = item.get("spec", {})
            searchable = " ".join([metadata.get("name", ""), *map(str, metadata.get("labels", {}).values())]).lower().replace("_", "-")
            score = 8 if "backend" in searchable or "cars-rental-backend" in searchable else 0
            score += sum(3 for port in spec.get("ports", []) if port.get("port") == 8000 or str(port.get("targetPort")) == "8000")
            return score
        matches = sorted(services.get("items", []), key=service_score, reverse=True)
        matches = [item for item in matches if service_score(item) > 0]
        if not matches:
            raise ScenarioError("Backend service not found.", error_type="ResourceMissing", solution="Create the backend Kubernetes Service.")
        self.service = matches[0]["metadata"]["name"]
        pods = [pod for pod in self.k8s_pods() if k8s_ready(pod)]
        if self.logger:
            self.logger(f"[OK] Kubernetes namespace: {self.namespace}")
            self.logger(f"[OK] Backend deployment: {self.deployment}")
            self.logger(f"[OK] Backend service: {self.service}")
            self.logger(f"[OK] Backend pod: {pods[0]['metadata']['name'] if pods else 'Not Ready'}")
            self.logger(f"[OK] Backend container: {self.container_name}")
            self.logger(f"[OK] Backend node: {pods[0].get('spec', {}).get('nodeName', 'Unknown') if pods else 'Not Ready'}")

    def ensure_kubernetes_backend_ready(self) -> dict[str, Any]:
        ready_timeout = int(CONFIG["kubernetes"].get("pod_ready_timeout_seconds", 180))
        deadline = time.monotonic() + ready_timeout
        while time.monotonic() < deadline:
            self.check_cancelled()
            deployment = parse_json_output(self.command(["kubectl", "get", "deployment", self.deployment, "-n", self.namespace, "-o", "json"], timeout=20), "kubectl get backend deployment readiness", self.logger)
            desired = int(deployment.get("spec", {}).get("replicas", 1)); available = int(deployment.get("status", {}).get("availableReplicas") or 0)
            pods = self.k8s_pods()
            ready = [pod for pod in pods if k8s_ready(pod)]
            fatal = next((pod_failure_reason(pod) for pod in pods if pod_failure_reason(pod)), "")
            if fatal:
                raise ScenarioError(f"Backend pod cannot become Ready: {fatal}", error_type="KUBE_COMMAND_FAILED")
            generation = int(deployment.get("metadata", {}).get("generation", 0))
            observed = int(deployment.get("status", {}).get("observedGeneration") or generation)
            updated = int(deployment.get("status", {}).get("updatedReplicas") or available)
            deployment_containers = deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
            container_name = getattr(self, "container_name", "backend")
            desired_container = next((item for item in deployment_containers if item.get("name") == container_name), {})
            desired_database_url = next((item.get("value") for item in desired_container.get("env", []) if item.get("name") == "DATABASE_URL"), None)
            matching_ready = []
            for pod in ready:
                pod_container = next((item for item in pod.get("spec", {}).get("containers", []) if item.get("name") == container_name), {})
                pod_database_url = next((item.get("value") for item in pod_container.get("env", []) if item.get("name") == "DATABASE_URL"), None)
                if desired_database_url is None or pod_database_url == desired_database_url:
                    matching_ready.append(pod)
            if observed >= generation and updated >= desired and available >= desired and matching_ready:
                return matching_ready[0]
            time.sleep(2)
        raise ScenarioError("No Ready backend pod exists after the readiness deadline.", error_type="KUBE_COMMAND_TIMEOUT", solution="Inspect backend pod conditions, events, logs, PostgreSQL readiness, and CNI/DNS.")

    def wait_for_backend_endpoint(self, expected_pod_ip: str = "", timeout: float | None = None) -> None:
        """Wait until EndpointSlice exposes a Ready backend endpoint, optionally the replacement pod IP."""
        deadline = time.monotonic() + (timeout or self.timeout)
        while time.monotonic() < deadline:
            result = self.command(["kubectl", "get", "endpointslice", "-n", self.namespace, "-l", f"kubernetes.io/service-name={self.service}", "-o", "json"], cleanup=True, timeout=20)
            if result.returncode == 0:
                try:
                    payload = json.loads(result.stdout)
                except json.JSONDecodeError:
                    payload = {}
                ready_addresses = [address for item in payload.get("items", []) for endpoint in item.get("endpoints", []) if endpoint.get("conditions", {}).get("ready", True) for address in endpoint.get("addresses", [])]
                if ready_addresses and (not expected_pod_ip or expected_pod_ip in ready_addresses):
                    return
            time.sleep(self.interval)
        raise ScenarioError("Backend EndpointSlice did not expose the new Ready pod before timeout.", error_type="KUBE_API_UNREACHABLE")

    def k8s_pods(self) -> list[dict[str, Any]]:
        deployment = parse_json_output(self.command(["kubectl", "get", "deployment", self.deployment, "-n", self.namespace, "-o", "json"]), "kubectl get backend deployment", self.logger)
        labels = deployment.get("spec", {}).get("selector", {}).get("matchLabels", {})
        selector = ",".join(f"{key}={value}" for key, value in labels.items())
        args = ["kubectl", "get", "pods", "-n", self.namespace, "-o", "json"]
        if selector:
            args += ["-l", selector]
        return parse_json_output(self.command(args), "kubectl get backend pods", self.logger).get("items", [])

    @contextmanager
    def health_access(self) -> Iterator[str]:
        if self.name == "swarm" or self.dry_run:
            yield self.health_url
            return
        # Never reuse an arbitrary process already listening on the configured
        # port. It may be a user's stale port-forward bound to a replaced pod.
        # Every Kubernetes health context owns, monitors and closes its forward.
        self.wait_for_backend_endpoint(timeout=min(self.timeout, 60))
        port, changed = select_local_port(int(CONFIG["kubernetes"]["port_forward_local_port"]))
        if changed and self.logger:
            self.logger(f"[WARNING] Preferred port is occupied by a non-working endpoint; using local port {port}.")
        self.health_url = f"http://127.0.0.1:{port}/health"
        command = ["kubectl", "port-forward", f"service/{self.service}", f"{port}:8000", "-n", self.namespace]
        startupinfo = None; creationflags = 0
        if os.name == "nt":
            startupinfo = subprocess.STARTUPINFO(); startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            creationflags = subprocess.CREATE_NO_WINDOW
        if self.logger:
            self.logger(f"[COMMAND] {format_command(command)}")
            self.logger(f"[PORT_FORWARD_RECREATED] Forwarding service/{self.service} on 127.0.0.1:{port}.")
        process = subprocess.Popen(command, cwd=ROOT.parent, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", shell=False, startupinfo=startupinfo, creationflags=creationflags)
        self.created_port_forward = process
        port_forward_output: list[str] = []
        forward_ready = threading.Event()
        def relay_port_forward() -> None:
            if not process.stdout:
                return
            for line in process.stdout:
                port_forward_output.append(line)
                if port_forward_ready_output(line):
                    forward_ready.set()
                if self.logger:
                    self.logger(line.rstrip())
        threading.Thread(target=relay_port_forward, daemon=True).start()
        if self.process_holder is not None:
            self.process_holder["process"] = process
        try:
            deadline = time.monotonic() + float(CONFIG["kubernetes"].get("port_forward_startup_timeout_seconds", 60))
            while time.monotonic() < deadline:
                self.check_cancelled()
                if process.poll() is not None:
                    output = "".join(port_forward_output)
                    raise ScenarioError(f"Kubernetes port-forward failed: {output}", command=format_command(command), exit_code=process.returncode or 1, stdout=output, error_type="PORT_FORWARD_DIED", solution="Verify the backend EndpointSlice; the framework will recreate only its own forward on the next health access.")
                if forward_ready.is_set():
                    health = poll_health(self.health_url, min(10, max(1, deadline - time.monotonic())), self.interval, request_timeout_seconds=self.request_timeout, logger=self.logger, cancel_event=self.cancel_event)
                    if health["success"]:
                        break
                time.sleep(0.2)
            else:
                raise ScenarioError("Kubernetes backend port-forward health timeout.", command=format_command(command), error_type="PORT_FORWARD_HEALTH_TIMEOUT", solution="Verify the backend Service targetPort and pod readiness.")
            yield self.health_url
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
            if self.created_port_forward is process:
                self.created_port_forward = None
            if self.process_holder is not None and self.process_holder.get("process") is process:
                self.process_holder["process"] = None

    def stop_port_forward(self) -> None:
        process = self.created_port_forward
        if process and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        if self.created_port_forward is process:
            self.created_port_forward = None
        if self.process_holder is not None and self.process_holder.get("process") is process:
            self.process_holder["process"] = None


def swarm_state(platform: Platform) -> dict[str, Any]:
    tasks = require_ok(platform.command(["docker", "service", "ps", platform.service, "--filter", "desired-state=running", "--no-trunc", "--format", "{{.ID}}|{{.CurrentState}}|{{.Node}}"]), "Verify the Swarm backend service.").splitlines()
    running = next((line for line in tasks if "Running" in line), "")
    task_id = running.split("|", 1)[0] if running else ""
    node = running.split("|")[-1] if running else ""
    container_filter = f"label=com.docker.swarm.task.id={task_id}" if task_id else f"label=com.docker.swarm.service.name={platform.service}"
    containers = require_ok(platform.command(["docker", "ps", "--filter", container_filter, "--format", "{{.ID}}"]), "Verify the backend task is running locally.").splitlines()
    replicas = require_ok(platform.command(["docker", "service", "inspect", platform.service, "--format", "{{if .Spec.Mode.Replicated}}{{.Spec.Mode.Replicated.Replicas}}{{else}}global{{end}}"]), "Inspect Swarm replicas.")
    return {"task": task_id, "node": node, "container": containers[0] if containers else "", "replicas": replicas}


def k8s_ready(pod: dict[str, Any]) -> bool:
    return pod.get("status", {}).get("phase") == "Running" and any(condition.get("type") == "Ready" and condition.get("status") == "True" for condition in pod.get("status", {}).get("conditions", []))


def pod_failure_reason(pod: dict[str, Any]) -> str:
    """Return an actionable terminal/waiting reason, never treating Pending itself as terminal."""
    status = pod.get("status", {})
    for container in (*status.get("initContainerStatuses", []), *status.get("containerStatuses", [])):
        waiting = container.get("state", {}).get("waiting", {})
        reason = str(waiting.get("reason", ""))
        if reason in {"CrashLoopBackOff", "ImagePullBackOff", "ErrImagePull", "CreateContainerError", "InvalidImageName"}:
            return f"{reason}: {waiting.get('message', '')}".strip()
        terminated = container.get("state", {}).get("terminated", {})
        if terminated and int(terminated.get("exitCode", 0)) != 0:
            return f"Container exited {terminated.get('exitCode')}: {terminated.get('reason', '')}".strip()
    for condition in status.get("conditions", []):
        if condition.get("type") == "PodScheduled" and condition.get("status") == "False" and condition.get("reason") == "Unschedulable":
            return f"Unschedulable: {condition.get('message', '')}".strip()
    return ""


def pod_event_message(platform: Platform, pod_name: str) -> str:
    result = platform.command(["kubectl", "get", "events", "-n", platform.namespace, "--field-selector", f"involvedObject.name={pod_name}", "--sort-by=.lastTimestamp", "-o", "json"], cleanup=True, timeout=20)
    if result.returncode != 0:
        return ""
    try:
        items = json.loads(result.stdout).get("items", [])
    except json.JSONDecodeError:
        return ""
    return " | ".join(str(item.get("message", "")) for item in items[-3:] if item.get("message"))


def usable_ready_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return Ready, schedulable nodes that can receive replacement pods."""
    return [
        node for node in nodes
        if not node.get("spec", {}).get("unschedulable", False)
        and any(condition.get("type") == "Ready" and condition.get("status") == "True" for condition in node.get("status", {}).get("conditions", []))
    ]


def run_container_kill(platform: Platform, repetition: int) -> dict[str, Any]:
    record = result_template(platform.name, "container-kill", repetition)
    started = time.monotonic()
    sampler: HealthSampler | None = None
    try:
        platform.prerequisites()
        if platform.dry_run:
            return skip(record, "Dry-run: no resource was terminated.", started)
        with platform.health_access() as url:
            require_healthy_baseline(platform, url)
            sampler = HealthSampler(url, platform.interval)
            if platform.name == "swarm":
                before = swarm_state(platform)
                if not before["container"]:
                    return skip(record, f"Backend task {before['task'] or 'unknown'} is assigned to Swarm node {before['node'] or 'unknown'}, but no reachable local Docker engine exposes its container; a safe remote kill is unavailable.", started)
                record.update(old_task_id=before["task"], old_resource_name=before["container"], replicas_before=before["replicas"])
                record["recovery_required"] = True; sampler.start(); event = time.monotonic()
                require_ok(platform.command(["docker", "rm", "-f", before["container"]]), "Inspect Docker events and Swarm service logs.")
                detection = None; after = before
                deadline = event + platform.timeout
                while time.monotonic() < deadline:
                    platform.check_cancelled()
                    after = swarm_state(platform)
                    if detection is None and after["task"] != before["task"]:
                        detection = time.monotonic() - event
                    if after["task"] and after["task"] != before["task"] and after["container"]:
                        try:
                            if requests.get(url, timeout=2).status_code == 200:
                                break
                        except requests.RequestException:
                            pass
                    time.sleep(platform.interval)
                sampler.stop(); sampler.apply(record)
                healthy = after["task"] != before["task"] and any(sample["status"] == 200 for sample in sampler.samples if sample["time"] >= event)
                record.update(status="PASS" if healthy else "FAIL", detection_time_seconds=round(detection, 3) if detection is not None else NOT_MEASURED, recovery_time_seconds=round(time.monotonic() - event, 3) if healthy else NOT_MEASURED, first_healthy_response_seconds=round(sampler.first_healthy_after(event), 3) if sampler.first_healthy_after(event) is not None else NOT_MEASURED, recovery_required=True, recovery_success=healthy, new_task_id=after["task"] or NA, new_resource_name=after["container"] or NA, replicas_after=after["replicas"], restarted_tasks=int(after["task"] != before["task"]))
                record["notes"] = "docker rm CLI success is distinct from the expected forced backend container termination (commonly exit code 137)."
            else:
                pods = [pod for pod in platform.k8s_pods() if k8s_ready(pod)]
                if not pods:
                    return skip(record, "No ready backend pod exists.", started)
                old = pods[0]; old_name = old["metadata"]["name"]; old_uid = old["metadata"]["uid"]
                record.update(old_task_id=old_uid, old_resource_name=old_name, replicas_before=len(pods))
                record["recovery_required"] = True; sampler.start(); event = time.monotonic()
                require_ok(platform.command(["kubectl", "delete", "pod", old_name, "-n", platform.namespace, "--wait=false"]), "Inspect backend deployment events.")
                detection = None; replacement = None; deadline = event + platform.timeout
                while time.monotonic() < deadline:
                    platform.check_cancelled()
                    current = platform.k8s_pods()
                    if detection is None and not any(pod["metadata"].get("uid") == old_uid for pod in current):
                        detection = time.monotonic() - event
                    replacement = next((pod for pod in current if pod["metadata"].get("uid") != old_uid and k8s_ready(pod)), None)
                    if replacement:
                        break
                    time.sleep(platform.interval)
                recovered_at = None
                if replacement:
                    require_ok(platform.command(["kubectl", "rollout", "status", f"deployment/{platform.deployment}", "-n", platform.namespace, "--timeout=180s"], timeout=195), "Inspect replacement backend rollout events.")
                    replacement_ip = replacement.get("status", {}).get("podIP", "")
                    platform.wait_for_backend_endpoint(replacement_ip, timeout=platform.timeout)
                    platform.stop_port_forward()
                    last_forward_error: ScenarioError | None = None
                    for attempt in range(1, 4):
                        try:
                            platform.wait_for_backend_endpoint(replacement_ip, timeout=min(platform.timeout, 60))
                            with platform.health_access() as recovery_url:
                                sampler.url = recovery_url
                                health = poll_health(recovery_url, platform.timeout, platform.interval, request_timeout_seconds=platform.request_timeout, logger=platform.logger, cancel_event=platform.cancel_event)
                                sampler.samples.extend(health["samples"])
                                if health["success"]:
                                    recovered_at = time.monotonic()
                            if recovered_at is not None:
                                break
                        except ScenarioError as exc:
                            if exc.error_type not in {"PORT_FORWARD_DIED", "PORT_FORWARD_HEALTH_TIMEOUT"}:
                                raise
                            last_forward_error = exc
                            platform.stop_port_forward()
                            if platform.logger:
                                platform.logger(f"[PORT_FORWARD_RECREATED] Attempt {attempt}/3 failed after pod replacement; retrying the service forward.")
                            time.sleep(platform.interval)
                    if recovered_at is None and last_forward_error is not None:
                        raise last_forward_error
                sampler.stop(); sampler.apply(record)
                healthy = replacement is not None and recovered_at is not None
                first_recovery = sampler.first_recovery_after(event)
                record.update(status="PASS" if healthy else "FAIL", detection_time_seconds=round(detection, 3) if detection is not None else NOT_MEASURED, recovery_time_seconds=round(recovered_at - event, 3) if recovered_at else NOT_MEASURED, first_healthy_response_seconds=round(first_recovery, 3) if first_recovery is not None else NOT_MEASURED, recovery_required=True, recovery_success=healthy, new_task_id=replacement["metadata"]["uid"] if replacement else NA, new_resource_name=replacement["metadata"]["name"] if replacement else NA, replicas_after=len([pod for pod in platform.k8s_pods() if k8s_ready(pod)]), restarted_tasks=int(replacement is not None))
        if record["status"] == "FAIL":
            record.update(error_count=1, error_message="Replacement backend did not become healthy before timeout.")
        return finish(record, started)
    except Exception as exc:
        if sampler:
            sampler.stop(); sampler.apply(record)
        return fail(record, exc, started)


def _memory_quantity_mib(value: str) -> int:
    text = value.strip()
    units = (("Ki", 1 / 1024), ("Mi", 1), ("Gi", 1024), ("K", 1 / 1000), ("M", 1), ("G", 1000))
    for suffix, factor in units:
        if text.endswith(suffix):
            return int(float(text[:-len(suffix)]) * factor)
    return int(float(text) / (1024 * 1024))


def _cpu_quantity_millicores(value: str) -> int:
    text = value.strip()
    return int(float(text[:-1])) if text.endswith("m") else int(float(text) * 1000)


def _safe_kubernetes_cpu(platform: Platform, node_name: str, configured_workers: int) -> tuple[int, int, int]:
    """Return workers, request mCPU and limit mCPU that fit the target node."""
    if not node_name:
        return 1, 100, 500
    node = parse_json_output(platform.command(["kubectl", "get", "node", node_name, "-o", "json"]), "kubectl get CPU stress target node", platform.logger)
    allocatable = _cpu_quantity_millicores(str(node.get("status", {}).get("allocatable", {}).get("cpu", "1")))
    top = platform.command(["kubectl", "top", "node", node_name, "--no-headers"], cleanup=True, timeout=30)
    used = allocatable // 2
    if top.returncode == 0 and top.stdout.strip():
        cpu_value = next((part for part in top.stdout.split()[1:] if part.endswith("m")), "")
        if cpu_value:
            used = _cpu_quantity_millicores(cpu_value)
    safe = max(250, allocatable - used - max(500, allocatable // 4))
    limit = min(1500, safe)
    request = min(250, max(100, limit // 4))
    workers = max(1, min(configured_workers, max(1, limit // 500)))
    return workers, request, limit


def _safe_kubernetes_memory_mb(platform: Platform, node_name: str, requested_mb: int) -> int:
    """Choose bounded memory pressure from allocatable and currently used memory."""
    if not node_name:
        return min(requested_mb, 256)
    node = parse_json_output(
        platform.command(["kubectl", "get", "node", node_name, "-o", "json"]),
        "kubectl get stress target node", platform.logger,
    )
    allocatable_mb = _memory_quantity_mib(str(node.get("status", {}).get("allocatable", {}).get("memory", "0")))
    top = platform.command(["kubectl", "top", "node", node_name, "--no-headers"], cleanup=True, timeout=30)
    if top.returncode == 0 and top.stdout.strip():
        columns = top.stdout.split()
        memory_value = next((value for value in columns[1:] if value.endswith(("Ki", "Mi", "Gi"))), "")
        used_mb = _memory_quantity_mib(memory_value) if memory_value else allocatable_mb // 2
    else:
        # Metrics Server is optional. Reserve 50% and use a conservative cap.
        used_mb = allocatable_mb // 2
    safe_available = allocatable_mb - used_mb - max(512, allocatable_mb // 5)
    if safe_available < 128:
        raise ScenarioError("Insufficient allocatable memory for a safe Kubernetes pressure test.", error_type="PreconditionFailed")
    # Keep enough headroom for PostgreSQL, kubelet and the backend on the same
    # Minikube node. 256 MiB is still a real sustained VM pressure workload,
    # while 512 MiB repeatedly restarted the application under test itself.
    # A two-node Minikube cluster sharing Docker Desktop with Swarm has little
    # stable headroom after all six application workloads are Ready. 128 MiB
    # remains a real sustained allocation, while larger values can OOM the
    # backend rather than test its orchestrator recovery path.
    return 128


def run_bounded_pressure(platform: Platform, repetition: int, scenario: str) -> dict[str, Any]:
    record = result_template(platform.name, scenario, repetition); started = time.monotonic()
    duration_key = "cpu_duration_seconds" if scenario == "cpu" else "memory_duration_seconds"
    duration = int(CONFIG["tests"][duration_key]); unique = f"tunicars-{scenario}-stress-{uuid4().hex[:8]}"
    sampler: HealthSampler | None = None
    try:
        platform.prerequisites()
        if platform.dry_run:
            return skip(record, "Dry-run: no stress workload was created.", started)
        with platform.health_access() as url:
            require_healthy_baseline(platform, url)
            sampler = HealthSampler(url, platform.interval); sampler.start(); event = time.monotonic()
            if platform.name == "swarm":
                # A host-wide unbounded CPU hog can starve Docker Desktop's
                # control plane and even prevent timeout/health processes from
                # being scheduled. Two capped workers still create measured
                # CPU pressure while reserving capacity for recovery.
                cpu_workers = max(1, min(int(CONFIG["tests"]["cpu_workers"]), 2))
                swarm_memory_mb = min(int(CONFIG["tests"]["memory_size_mb"]), 128)
                workload = f"stress --cpu {cpu_workers}" if scenario == "cpu" else f"stress --vm 1 --vm-bytes {swarm_memory_mb}M --vm-keep"
                # polinux/stress has shown a non-deterministic internal
                # --timeout for VM workers on Docker Desktop. A shell watchdog
                # provides an independent, observable upper bound.
                # polinux/stress ships BusyBox timeout (no GNU -k option).
                bounded = f"timeout -s KILL {duration}s {workload}; rc=$?; [ $rc -eq 137 ] || exit $rc; exit 0"
                stress_args = ["sh", "-c", bounded]
                run_options = ["--cpus", str(cpu_workers)] if scenario == "cpu" else []
                create = platform.command(["docker", "run", "-d", "--name", unique, *run_options, "polinux/stress", *stress_args], timeout=60)
                require_ok(create, "Verify Docker image access and available host resources.")
                # Image startup plus graceful VM-worker teardown can exceed 90s
                # on Docker Desktop; the workload still has its own hard timeout.
                deadline = time.monotonic() + duration + 180; exit_code: int | None = None
                while time.monotonic() < deadline:
                    platform.check_cancelled()
                    inspect = platform.command(["docker", "inspect", unique, "--format", "{{json .State}}"], cleanup=True, timeout=15)
                    if inspect.returncode != 0:
                        time.sleep(1); continue
                    state = parse_json_output(inspect, "docker inspect stress container state", platform.logger)
                    if not bool(state.get("Running", False)):
                        exit_code = int(state.get("ExitCode", -1)); break
                    time.sleep(1)
                logs = platform.command(["docker", "logs", unique], cleanup=True, timeout=20)
                if exit_code is None:
                    raise ScenarioError("Swarm stress container exceeded its scenario deadline.", command=f"docker inspect {unique}", stdout=safe_stdout(logs), stderr=safe_stderr(logs), error_type="STRESS_COMMAND_TIMEOUT")
                if exit_code != 0:
                    raise ScenarioError(f"Swarm stress container exited with code {exit_code}.", stdout=safe_stdout(logs), stderr=safe_stderr(logs), error_type="StressWorkloadError")
            else:
                backend_pods = [pod for pod in platform.k8s_pods() if k8s_ready(pod)]
                if not backend_pods:
                    raise ScenarioError("No Ready backend pod exists for the pressure test.", error_type="ResourceMissing", solution="Restore the backend deployment before retrying.")
                backend_node = backend_pods[0].get("spec", {}).get("nodeName", "")
                memory_mb = int(CONFIG["tests"]["memory_size_mb"])
                cpu_workers = int(CONFIG["tests"]["cpu_workers"])
                cpu_request, cpu_limit = 250, 1500
                if scenario == "memory":
                    memory_mb = _safe_kubernetes_memory_mb(platform, backend_node, memory_mb)
                    if platform.logger:
                        platform.logger(f"[MEMORY] Safe stress allocation selected: {memory_mb} MiB on node {backend_node}.")
                else:
                    cpu_workers, cpu_request, cpu_limit = _safe_kubernetes_cpu(platform, backend_node, cpu_workers)
                    if platform.logger:
                        platform.logger(f"[CPU] Safe stress selected: workers={cpu_workers}, request={cpu_request}m, limit={cpu_limit}m on {backend_node}.")
                workload = f"stress --cpu {cpu_workers}" if scenario == "cpu" else f"stress --vm 1 --vm-bytes {memory_mb}M --vm-keep"
                bounded = f"timeout -s KILL {duration}s {workload}; rc=$?; [ $rc -eq 137 ] || exit $rc; exit 0"
                command = ["sh", "-c", bounded]
                resource_limits = (
                    {"requests": {"cpu": f"{cpu_request}m", "memory": "64Mi"}, "limits": {"cpu": f"{cpu_limit}m", "memory": "256Mi"}}
                    if scenario == "cpu"
                    else {"requests": {"cpu": "100m", "memory": f"{memory_mb}Mi"}, "limits": {"cpu": "500m", "memory": f"{memory_mb + 256}Mi"}}
                )
                pod_spec: dict[str, Any] = {
                    "containers": [{
                        "name": unique,
                        "image": "polinux/stress",
                        # ``latest`` otherwise implies imagePullPolicy=Always.
                        # Repeated campaigns must reuse the image already cached
                        # by Minikube instead of depending on Docker Hub again.
                        "imagePullPolicy": "IfNotPresent",
                        "command": [command[0]],
                        "args": command[1:],
                        "resources": resource_limits,
                    }],
                }
                if backend_node:
                    pod_spec["nodeName"] = backend_node
                overrides = json.dumps({"spec": pod_spec})
                run_args = ["kubectl", "run", unique, "-n", platform.namespace, "--image=polinux/stress", "--restart=Never"]
                if overrides:
                    run_args.append(f"--overrides={overrides}")
                # The complete command already lives in the JSON override.
                # Supplying it again after `--command --` causes kubectl to
                # merge/override the container process differently across
                # client versions and left memory stress running indefinitely.
                require_ok(platform.command(run_args), "Verify image access and Kubernetes resource capacity.")
                deadline = time.monotonic() + duration + 180; phase = ""; observed_running = False; pending_since = time.monotonic()
                while time.monotonic() < deadline:
                    platform.check_cancelled()
                    result = platform.command(["kubectl", "get", "pod", unique, "-n", platform.namespace, "-o", "json"], cleanup=True, timeout=15)
                    if result.returncode != 0:
                        time.sleep(1)
                        continue
                    try:
                        pod = json.loads(result.stdout)
                    except json.JSONDecodeError:
                        time.sleep(1); continue
                    phase = str(pod.get("status", {}).get("phase", ""))
                    failure_reason = pod_failure_reason(pod)
                    if failure_reason:
                        events = pod_event_message(platform, unique)
                        raise ScenarioError(f"STRESS_POD_UNSCHEDULABLE: {failure_reason}" + (f" Events: {events}" if events else ""), error_type="STRESS_POD_UNSCHEDULABLE")
                    observed_running = observed_running or phase == "Running"
                    if phase in {"Succeeded", "Failed"}:
                        break
                    if phase == "Pending" and time.monotonic() - pending_since > 60:
                        events = pod_event_message(platform, unique)
                        raise ScenarioError(f"STRESS_POD_UNSCHEDULABLE: pod remained Pending for 60 seconds." + (f" Events: {events}" if events else ""), error_type="STRESS_POD_UNSCHEDULABLE")
                    time.sleep(1)
                final_pod = platform.command(["kubectl", "get", "pod", unique, "-n", platform.namespace, "-o", "json"], cleanup=True, timeout=30)
                stress_logs = platform.command(["kubectl", "logs", unique, "-n", platform.namespace], cleanup=True, timeout=30)
                final_payload: dict[str, Any] = {}
                if final_pod.returncode == 0 and final_pod.stdout.strip():
                    try:
                        final_payload = json.loads(final_pod.stdout)
                    except json.JSONDecodeError:
                        final_payload = {}
                terminated = next(
                    (
                        status.get("state", {}).get("terminated", {})
                        for status in final_payload.get("status", {}).get("containerStatuses", [])
                        if status.get("state", {}).get("terminated") is not None
                    ),
                    None,
                )
                completed_successfully = phase == "Succeeded" or (
                    isinstance(terminated, dict) and int(terminated.get("exitCode", -1)) == 0
                )
                if platform.logger:
                    platform.logger(f"[STRESS] Pod {unique}: phase={phase or 'Unknown'}, observed_running={observed_running}, logs captured={stress_logs.returncode == 0}.")
                if not completed_successfully:
                    raise ScenarioError(
                        f"Stress pod finished with phase {phase or 'Unknown'}.",
                        stdout=safe_stdout(stress_logs), stderr=safe_stderr(stress_logs),
                        error_type="StressWorkloadError",
                        solution="Inspect the captured pod JSON/logs and Kubernetes events.",
                    )
            if any(sample["status"] != 200 for sample in sampler.samples):
                recovery_deadline = time.monotonic() + platform.timeout
                while time.monotonic() < recovery_deadline:
                    failures_so_far = [sample for sample in sampler.samples if sample["status"] != 200]
                    if any(sample["status"] == 200 and sample["time"] > failures_so_far[-1]["time"] for sample in sampler.samples):
                        break
                    platform.check_cancelled()
                    time.sleep(platform.interval)
            sampler.stop(); sampler.apply(record)
            failures = [sample for sample in sampler.samples if sample["status"] != 200]
            healthy_after_failure = bool(failures) and any(sample["status"] == 200 and sample["time"] > failures[-1]["time"] for sample in sampler.samples)
            final_healthy = bool(sampler.samples and sampler.samples[-1]["status"] == 200)
            record.update(status="PASS", notes=f"Bounded stress workload completed; final backend health: {'healthy' if final_healthy else 'unhealthy'}.")
            if failures:
                detection = failures[0]["time"] - event
                recovery = next((sample["time"] - failures[0]["time"] for sample in sampler.samples if sample["time"] > failures[0]["time"] and sample["status"] == 200), None)
                record.update(detection_time_seconds=round(detection, 3), recovery_required=True, recovery_success=healthy_after_failure, recovery_time_seconds=round(recovery, 3) if recovery is not None else NOT_MEASURED)
            else:
                record.update(recovery_required=False, recovery_success=NOT_REQUIRED, recovery_time_seconds=NA, first_healthy_response_seconds=NA)
            if record["http_success_count"] == 0 or (failures and not healthy_after_failure):
                record.update(status="FAIL", recovery_required=True, recovery_success=False, error_count=1, error_message="No healthy backend response was observed during the stress test.")
            return finish(record, started)
    except Exception as exc:
        if sampler:
            sampler.stop(); sampler.apply(record)
        return fail(record, exc, started)
    finally:
        if platform.name == "kubernetes" and not platform.dry_run:
            platform.command(["kubectl", "delete", "pod", unique, "-n", platform.namespace, "--ignore-not-found=true", "--wait=false"], cleanup=True)
        elif platform.name == "swarm" and not platform.dry_run:
            platform.command(["docker", "rm", "-f", unique], cleanup=True)


def run_node_failure(platform: Platform, repetition: int) -> dict[str, Any]:
    record = result_template(platform.name, "node-failure", repetition)
    started = time.monotonic()
    restore: list[str] | None = None
    sampler: HealthSampler | None = None
    try:
        platform.prerequisites()
        if platform.name == "swarm":
            rows = require_ok(platform.command(["docker", "node", "ls", "--format", "{{.ID}}|{{.Hostname}}|{{.ManagerStatus}}|{{.Availability}}|{{.Status}}"]), "Verify Swarm nodes.").splitlines()
            ready_nodes = [row.split("|") for row in rows if row.endswith("|Ready")]
            if len(ready_nodes) < 2:
                return skip(record, "Single-node Docker Swarm cannot demonstrate real node rescheduling.", started)
            before = swarm_state(platform)
            target = next((node for node in ready_nodes if node[1] == before["node"] and node[3] == "Active"), None)
            if target is None:
                raise ScenarioError("The backend task could not be mapped to an Active Ready Swarm node.", error_type="ResourceDiscoveryError", solution="Compare docker service ps with docker node ls.")
            restore = ["docker", "node", "update", "--availability", "active", target[0]]
            if platform.dry_run:
                return skip(record, "Dry-run: no Swarm node was drained.", started)
            with platform.health_access() as url:
                sampler = HealthSampler(url, platform.interval); sampler.start()
                record.update(old_task_id=before["task"], old_resource_name=target[1], replicas_before=before["replicas"])
                record["recovery_required"] = True; event = time.monotonic()
                require_ok(platform.command(["docker", "node", "update", "--availability", "drain", target[0]]), "Restore the drained node to Active.")
                deadline = event + platform.timeout; after = before; detection = None; recovered_at = None
                while time.monotonic() < deadline:
                    platform.check_cancelled(); after = swarm_state(platform)
                    if detection is None and after["task"] != before["task"]:
                        detection = time.monotonic() - event
                    if after["task"] and after["task"] != before["task"]:
                        try:
                            if requests.get(url, timeout=2).status_code == 200:
                                recovered_at = time.monotonic(); break
                        except requests.RequestException:
                            pass
                    time.sleep(platform.interval)
                sampler.stop(); sampler.apply(record)
                success = after["task"] != before["task"] and recovered_at is not None
                record.update(status="PASS" if success else "FAIL", detection_time_seconds=round(detection, 3) if detection is not None else NOT_MEASURED, recovery_time_seconds=round(recovered_at - event, 3) if recovered_at else NOT_MEASURED, first_healthy_response_seconds=round(sampler.first_healthy_after(event), 3) if sampler.first_healthy_after(event) is not None else NOT_MEASURED, recovery_required=True, recovery_success=success, new_task_id=after["task"] or NA, new_resource_name=after["node"] or NA, replicas_after=after["replicas"], restarted_tasks=int(after["task"] != before["task"]))
        else:
            nodes = parse_json_output(platform.command(["kubectl", "get", "nodes", "-o", "json"]), "kubectl get nodes", platform.logger).get("items", [])
            all_ready_nodes = [node for node in nodes if any(condition.get("type") == "Ready" and condition.get("status") == "True" for condition in node.get("status", {}).get("conditions", []))]
            if len(all_ready_nodes) >= 2 and not bool(CONFIG["kubernetes"].get("inter_node_network_safe", True)):
                return skip(record, "Minikube inter-node CNI/DNS does not provide a safe backend-to-PostgreSQL path after rescheduling.", started)
            ready_nodes = usable_ready_nodes(nodes)
            if len(ready_nodes) < 2:
                return skip(record, "Single-node Kubernetes cannot demonstrate real pod rescheduling after node failure.", started)
            pods = [pod for pod in platform.k8s_pods() if k8s_ready(pod)]
            if not pods:
                raise ScenarioError("No Ready backend pod exists for node failure.", error_type="ResourceMissing", solution="Restore the backend deployment before retrying.")
            old_pod = pods[0]; old_uid = old_pod["metadata"]["uid"]; backend_node = old_pod.get("spec", {}).get("nodeName", "")
            target_node = next((node for node in ready_nodes if node["metadata"]["name"] == backend_node), None)
            if target_node is None:
                raise ScenarioError("The backend pod is not running on a Ready Kubernetes node.", error_type="ResourceDiscoveryError", solution="Inspect pod nodeName and kubectl get nodes.")
            target_labels = target_node.get("metadata", {}).get("labels", {})
            target_is_control_plane = any(key in target_labels for key in ("node-role.kubernetes.io/control-plane", "node-role.kubernetes.io/master"))
            worker_nodes = [node for node in ready_nodes if not any(key in node.get("metadata", {}).get("labels", {}) for key in ("node-role.kubernetes.io/control-plane", "node-role.kubernetes.io/master"))]
            if target_is_control_plane and worker_nodes:
                worker_name = worker_nodes[0]["metadata"]["name"]
                require_ok(platform.command(["kubectl", "cordon", backend_node]), "Uncordon the control-plane node.")
                try:
                    require_ok(platform.command(["kubectl", "delete", "pod", old_pod["metadata"]["name"], "-n", platform.namespace, "--wait=false"]), "Restore the backend deployment.")
                    placement_deadline = time.monotonic() + platform.timeout
                    replacement = None
                    while time.monotonic() < placement_deadline:
                        platform.check_cancelled()
                        replacement = next((pod for pod in platform.k8s_pods() if pod["metadata"].get("uid") != old_uid and k8s_ready(pod) and pod.get("spec", {}).get("nodeName") == worker_name), None)
                        if replacement:
                            break
                        time.sleep(platform.interval)
                    if replacement is None:
                        platform.command(["kubectl", "cordon", worker_name], cleanup=True)
                        platform.command(["kubectl", "uncordon", backend_node], cleanup=True)
                        current_pods = platform.k8s_pods()
                        for pod in current_pods:
                            platform.command(["kubectl", "delete", "pod", pod["metadata"]["name"], "-n", platform.namespace, "--force", "--grace-period=0"], cleanup=True)
                        restore_deadline = time.monotonic() + platform.timeout
                        while time.monotonic() < restore_deadline:
                            if any(k8s_ready(pod) and pod.get("spec", {}).get("nodeName") == backend_node for pod in platform.k8s_pods()):
                                break
                            time.sleep(platform.interval)
                        platform.command(["kubectl", "uncordon", worker_name], cleanup=True)
                        return skip(record, "The Ready worker cannot host the backend because cross-node Kubernetes service networking/DNS is unavailable in the current Minikube environment.", started)
                    old_pod = replacement; old_uid = replacement["metadata"]["uid"]; backend_node = worker_name
                    target_node = worker_nodes[0]
                finally:
                    platform.command(["kubectl", "uncordon", target_node["metadata"]["name"] if target_node is not None and target_node["metadata"]["name"] == backend_node else old_pod.get("spec", {}).get("nodeName", backend_node)], cleanup=True)
                    platform.command(["kubectl", "uncordon", next((node["metadata"]["name"] for node in ready_nodes if any(key in node.get("metadata", {}).get("labels", {}) for key in ("node-role.kubernetes.io/control-plane", "node-role.kubernetes.io/master"))), "minikube")], cleanup=True)
            target = target_node["metadata"]["name"]; restore = ["kubectl", "uncordon", target]
            if platform.dry_run:
                return skip(record, "Dry-run: no Kubernetes node was drained.", started)
            with platform.health_access() as url:
                sampler = HealthSampler(url, platform.interval); sampler.start()
                record.update(old_task_id=old_uid, old_resource_name=target, replicas_before=len(pods), recovery_required=True); event = time.monotonic()
                require_ok(platform.command(["kubectl", "cordon", target]), "Uncordon the selected node.")
                require_ok(platform.command(["kubectl", "drain", target, "--ignore-daemonsets", "--delete-emptydir-data", "--force", "--timeout=120s"], 150), "Uncordon the node and inspect PodDisruptionBudgets.")
                deadline = event + platform.timeout; replacement = None; detection = None; recovered_at = None
                while time.monotonic() < deadline:
                    platform.check_cancelled(); current = platform.k8s_pods()
                    if detection is None and (not any(pod["metadata"].get("uid") == old_uid for pod in current) or any(pod["metadata"].get("uid") == old_uid and pod["metadata"].get("deletionTimestamp") for pod in current)):
                        detection = time.monotonic() - event
                    replacement = next((pod for pod in current if pod["metadata"].get("uid") != old_uid and k8s_ready(pod)), None)
                    if replacement:
                        try:
                            if requests.get(url, timeout=2).status_code == 200:
                                recovered_at = time.monotonic(); break
                        except requests.RequestException:
                            pass
                    time.sleep(platform.interval)
                sampler.stop(); sampler.apply(record)
                success = replacement is not None and recovered_at is not None
                record.update(status="PASS" if success else "FAIL", detection_time_seconds=round(detection, 3) if detection is not None else NOT_MEASURED, recovery_time_seconds=round(recovered_at - event, 3) if recovered_at else NOT_MEASURED, first_healthy_response_seconds=round(sampler.first_healthy_after(event), 3) if sampler.first_healthy_after(event) is not None else NOT_MEASURED, recovery_required=True, recovery_success=success, new_task_id=replacement["metadata"]["uid"] if replacement else NA, new_resource_name=replacement["metadata"]["name"] if replacement else NA, replicas_after=len([pod for pod in platform.k8s_pods() if k8s_ready(pod)]), restarted_tasks=int(replacement is not None))
        if record["status"] == "FAIL":
            record.update(error_count=1, error_message="Real node rescheduling or backend health recovery was not observed before timeout.")
        return finish(record, started)
    except Exception as exc:
        if sampler:
            sampler.stop(); sampler.apply(record)
        return fail(record, exc, started)
    finally:
        if restore and not platform.dry_run:
            platform.command(restore, cleanup=True)


_SWARM_ORIGINAL_STATE: dict[str, Any] | None = None


def get_swarm_backend_url(platform: Platform) -> str:
    """Discover the IPv4 published backend port instead of trusting stale config."""
    inspect = platform.command(["docker", "service", "inspect", platform.service, "--format", "{{json .Endpoint.Spec.Ports}}"], cleanup=True, timeout=20)
    ports = parse_json_output(inspect, "docker service inspect backend published ports", platform.logger) if inspect.returncode == 0 and inspect.stdout.strip() not in {"", "null"} else []
    published = next((int(item["PublishedPort"]) for item in ports if int(item.get("TargetPort", 0)) == 8000 and item.get("PublishedPort")), 8000)
    return f"http://127.0.0.1:{published}/health"


def capture_swarm_backend_state(platform: Platform) -> dict[str, Any]:
    payload = parse_json_output(platform.command(["docker", "service", "inspect", platform.service], cleanup=True, timeout=30), "docker service inspect backend baseline", platform.logger)[0]
    spec = payload.get("Spec", {}); task = spec.get("TaskTemplate", {}); container = task.get("ContainerSpec", {})
    environment = list(container.get("Env") or [])
    return {
        "image": container.get("Image", ""),
        "replicas": int(spec.get("Mode", {}).get("Replicated", {}).get("Replicas", 1)),
        "environment": environment,
        "database_url": environment_value(environment, "DATABASE_URL"),
    }


def collect_swarm_diagnostics(platform: Platform) -> str:
    commands = (
        ["docker", "service", "ps", platform.service, "--no-trunc"],
        ["docker", "service", "inspect", platform.service, "--pretty"],
        ["docker", "ps", "-a", "--filter", f"label=com.docker.swarm.service.name={platform.service}"],
        ["docker", "service", "logs", "--tail", "80", platform.service],
        ["docker", "service", "logs", "--tail", "40", CONFIG["swarm"]["database_service"]],
        ["docker", "network", "ls"],
    )
    output = []
    for command in commands:
        result = platform.command(command, cleanup=True, timeout=30)
        output.append(f"$ {format_command(command)}\n{safe_stdout(result)}\n{safe_stderr(result)}")
    return "\n".join(output)


def cleanup_temporary_resources(platform: Platform) -> None:
    """Remove only framework-owned stress/Toxiproxy resources."""
    if platform.name == "swarm":
        result = platform.command(["docker", "service", "ls", "--format", "{{.Name}}"], cleanup=True, timeout=30)
        for name in result.stdout.splitlines():
            if name.startswith("rt-toxiproxy-"):
                platform.command(["docker", "service", "rm", name], cleanup=True, timeout=60)
        result = platform.command(["docker", "ps", "-a", "--format", "{{.Names}}"], cleanup=True, timeout=30)
        for name in result.stdout.splitlines():
            if name.startswith("tunicars-") and "-stress-" in name:
                platform.command(["docker", "rm", "-f", name], cleanup=True, timeout=30)
    else:
        platform.command(["kubectl", "delete", "pod", "-n", platform.namespace, "-l", "resilience-test=true", "--ignore-not-found=true", "--wait=false"], cleanup=True, timeout=60)
        platform.command(["kubectl", "delete", "service,deployment", "-n", platform.namespace, "-l", "app=toxiproxy", "--ignore-not-found=true", "--wait=false"], cleanup=True, timeout=60)


def restore_swarm_backend(platform: Platform, original: dict[str, Any]) -> None:
    """Restore the mutable backend fields used by scenarios and resume paused updates."""
    current = capture_swarm_backend_state(platform)
    original_database = original.get("database_url")
    if original_database and current.get("database_url") != original_database:
        result = platform.command(["docker", "service", "update", "--detach", "--env-rm", "DATABASE_URL", "--env-add", f"DATABASE_URL={original_database}", platform.service], cleanup=True, timeout=90)
        if result.returncode != 0:
            raise ScenarioError("Unable to restore the original Swarm DATABASE_URL.", command="docker service update", exit_code=result.returncode, stdout=safe_stdout(result), stderr=safe_stderr(result), error_type="CLEANUP_FAILURE")
    if int(current.get("replicas", 1)) != int(original.get("replicas", 1)):
        platform.command(["docker", "service", "scale", f"{platform.service}={original['replicas']}"], cleanup=True, timeout=60)
    update_result = platform.command(["docker", "service", "inspect", platform.service, "--format", "{{json .UpdateStatus}}"], cleanup=True, timeout=20)
    if update_result.returncode == 0 and update_result.stdout.strip() not in {"", "null", "<no value>"}:
        update = parse_json_output(update_result, "docker service inspect backend update recovery", platform.logger)
        if str(update.get("State", "")).lower() == "paused":
            # Reapply the known-good spec and continue rather than preserving a toxic paused rollout.
            resume = platform.command(["docker", "service", "update", "--detach", "--update-failure-action", "continue", "--force", platform.service], cleanup=True, timeout=90)
            if resume.returncode != 0:
                raise ScenarioError("Paused Swarm backend update could not be resumed with the restored configuration.", error_type="CLEANUP_FAILURE", stderr=safe_stderr(resume))
    _wait_swarm_service(platform, timeout=180)


def ensure_swarm_backend_healthy(platform: Platform, timeout: float = 180) -> None:
    """Wait for all application services and a real HTTP 200 clean baseline."""
    expected = int(CONFIG["swarm"].get("expected_replicas", 1))
    deadline = time.monotonic() + timeout
    services = (CONFIG["swarm"]["database_service"], CONFIG["swarm"]["backend_service"], CONFIG["swarm"]["frontend_service"])
    platform.health_url = get_swarm_backend_url(platform)
    while time.monotonic() < deadline:
        all_ready = True
        for service in services:
            result = platform.command(["docker", "service", "ls", "--filter", f"name={service}", "--format", "{{.Replicas}}"], cleanup=True, timeout=20)
            if result.returncode != 0 or result.stdout.strip() != f"{expected}/{expected}":
                all_ready = False; break
        if all_ready:
            try:
                if requests.get(platform.health_url, timeout=platform.request_timeout).status_code == 200:
                    return
            except requests.RequestException:
                pass
        time.sleep(max(2, platform.interval))
    diagnostics = collect_swarm_diagnostics(platform)
    if platform.logger: platform.logger("[SWARM_DIAGNOSTICS]\n" + diagnostics)
    raise ScenarioError("Precondition failed: Swarm services did not reach 1/1 and backend /health did not return HTTP 200 before timeout.", error_type="PRECONDITION_FAILURE", stdout=diagnostics, solution="Inspect the captured service, task, backend, database, and network diagnostics.")


def _wait_swarm_service(platform: Platform, timeout: float = 180) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        inspect = platform.command(["docker", "service", "inspect", platform.service, "--format", "{{json .UpdateStatus}}"], cleanup=True)
        if inspect.returncode == 0 and inspect.stdout.strip() not in {"", "null", "<no value>"}:
            update = parse_json_output(inspect, "docker service inspect backend update status", platform.logger)
            if str(update.get("State", "")).lower() == "paused":
                time.sleep(max(2, platform.interval)); continue
        output = platform.command(["docker", "service", "ps", platform.service, "--filter", "desired-state=running", "--format", "{{.CurrentState}}"], cleanup=True)
        replicas = platform.command(["docker", "service", "ls", "--filter", f"name={platform.service}", "--format", "{{.Replicas}}"], cleanup=True)
        if output.returncode == 0 and any(line.startswith("Running") for line in output.stdout.splitlines()) and replicas.stdout.strip() == "1/1": return
        time.sleep(platform.interval)
    raise ScenarioError("Swarm backend service did not return to Running state before timeout.", error_type="BackendNotReady", solution="Inspect docker service ps and docker service logs.")


def _wait_probe(url: str, headers: dict[str, str] | None, timeout: float, request_timeout: float, *, process: subprocess.Popen[str] | None = None) -> float | None:
    started = time.monotonic(); deadline = started + timeout
    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            return None
        try:
            if 200 <= requests.get(url, headers=headers, timeout=request_timeout).status_code < 300:
                return time.monotonic() - started
        except requests.RequestException:
            pass
        time.sleep(0.5)
    return None


def _start_kubectl_port_forward(platform: Platform, service: str, local_port: int, remote_port: int) -> subprocess.Popen[str]:
    command = ["kubectl", "port-forward", f"service/{service}", f"{local_port}:{remote_port}", "-n", platform.namespace]
    startupinfo = None; creationflags = 0
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO(); startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        creationflags = subprocess.CREATE_NO_WINDOW
    process = subprocess.Popen(command, cwd=ROOT.parent, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace", shell=False, startupinfo=startupinfo, creationflags=creationflags)
    lines: list[str] = []; ready = threading.Event()
    def relay() -> None:
        if process.stdout:
            for line in process.stdout:
                lines.append(line)
                if port_forward_ready_output(line):
                    ready.set()
                if platform.logger:
                    platform.logger(line.rstrip())
    threading.Thread(target=relay, daemon=True).start()
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise ScenarioSkip(f"Toxiproxy Kubernetes port-forward exited before becoming ready: {''.join(lines).strip()}")
        if ready.wait(0.2):
            return process
    process.terminate()
    raise ScenarioSkip("Toxiproxy Kubernetes API port-forward did not become ready within 30 seconds.")


def _wait_kubernetes_service_endpoint(platform: Platform, service: str, timeout: float) -> None:
    """Wait for a Ready EndpointSlice address before opening a service forward."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = platform.command([
            "kubectl", "get", "endpointslice", "-n", platform.namespace,
            "-l", f"kubernetes.io/service-name={service}", "-o", "json",
        ], cleanup=True, timeout=20)
        if result.returncode == 0:
            try:
                payload = json.loads(result.stdout)
            except json.JSONDecodeError:
                payload = {}
            ready = [
                address for item in payload.get("items", [])
                for endpoint in item.get("endpoints", [])
                if endpoint.get("conditions", {}).get("ready") is True
                for address in endpoint.get("addresses", [])
            ]
            if ready:
                return
        time.sleep(platform.interval)
    raise ScenarioError(
        f"Toxiproxy Service {service!r} never exposed a Ready EndpointSlice.",
        error_type="TOXIPROXY_ENDPOINT_NOT_READY",
    )


def _stop_process(process: subprocess.Popen[str] | None) -> None:
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


_AUTH_TOKEN_CACHE: dict[str, str] = {}


def _resilience_auth_headers(
    health_url: str, *, recovery: Callable[[], None] | None = None,
) -> dict[str, str] | None:
    """Return an in-memory bearer token without logging credentials or JWTs."""
    token_env = str(CONFIG["tests"].get("database_probe_token_env", "RESILIENCE_API_TOKEN"))
    token = os.getenv(token_env, "").strip()
    if token:
        return {"Authorization": f"Bearer {token}"}

    parsed = urlsplit(health_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    cached = _AUTH_TOKEN_CACHE.get(origin)
    if cached:
        return {"Authorization": f"Bearer {cached}"}

    identifier_env = str(CONFIG["tests"].get("authentication_identifier_env", "RESILIENCE_TEST_IDENTIFIER"))
    password_env = str(CONFIG["tests"].get("authentication_password_env", "RESILIENCE_TEST_PASSWORD"))
    identifier = os.getenv(identifier_env, "").strip()
    password = os.getenv(password_env, "")
    if not identifier or not password:
        return None
    response = None
    attempts = 2 if recovery is not None else 1
    for attempt in range(attempts):
        try:
            response = requests.post(
                f"{origin}/auth/login",
                json={"identifier": identifier, "password": password},
                timeout=float(CONFIG["tests"].get("request_timeout_seconds", 4)),
            )
        except requests.RequestException as exc:
            if attempt + 1 < attempts:
                recovery(); continue
            raise ScenarioError("Resilience-test authentication endpoint is unreachable.", error_type="AUTH_ENDPOINT_UNREACHABLE") from exc
        if response.status_code < 500 or attempt + 1 >= attempts:
            break
        # Retry only a server/infrastructure failure after bounded recovery.
        # 401/403 responses remain immediate real credential failures.
        recovery()
    assert response is not None
    auth_categories = {
        401: "AUTH_INVALID_CREDENTIALS",
        404: "AUTH_ROUTE_NOT_FOUND",
        422: "AUTH_REQUEST_INVALID",
    }
    if response.status_code != 200:
        category = auth_categories.get(response.status_code, "AUTH_SERVER_ERROR" if response.status_code >= 500 else "AUTH_REQUEST_INVALID")
        raise ScenarioError(
            f"Resilience-test authentication failed with HTTP {response.status_code}.",
            error_type=category,
            solution=f"Verify {identifier_env} and {password_env}; tokens and passwords are never logged.",
        )
    try:
        issued = str(response.json().get("access_token", "")).strip()
    except (ValueError, AttributeError) as exc:
        raise ScenarioError("Login returned an invalid token response.", error_type="AUTH_TOKEN_MISSING") from exc
    if not issued:
        raise ScenarioError("Login response did not contain an access token.", error_type="AUTH_TOKEN_MISSING")
    _AUTH_TOKEN_CACHE[origin] = issued
    return {"Authorization": f"Bearer {issued}"}


def _database_probe(health_url: str) -> tuple[str, dict[str, str] | None]:
    parsed = urlsplit(health_url)
    path = str(CONFIG["tests"].get("database_probe_path", "/cars"))
    if not path.startswith("/"):
        path = f"/{path}"
    url = f"{parsed.scheme}://{parsed.netloc}{path}"
    return url, _resilience_auth_headers(health_url)


def _discover_database_probe(
    health_url: str, request_timeout: float,
    *, recovery: Callable[[], None] | None = None,
) -> tuple[str, str, dict[str, str]]:
    """Prefer a public DB-backed GET; authenticate only when routes require it."""
    configured = str(CONFIG["tests"].get("database_probe_path", "/cars"))
    candidates = list(dict.fromkeys([configured, "/cars", "/renters", "/rentals"]))
    parsed = urlsplit(health_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    statuses: list[str] = []

    def try_candidates(headers: dict[str, str] | None, label: str) -> tuple[str, str, dict[str, str]] | None:
        protected_seen = False
        for path in candidates:
            normalized = path if path.startswith("/") else f"/{path}"
            url = f"{origin}{normalized}"
            try:
                response = requests.get(url, headers=headers, timeout=request_timeout)
            except requests.RequestException:
                statuses.append(f"{normalized}={label}:unreachable")
                continue
            statuses.append(f"{normalized}={label}:HTTP {response.status_code}")
            protected_seen = protected_seen or response.status_code in {401, 403}
            if 200 <= response.status_code < 300:
                return normalized, url, headers or {}
        return None if protected_seen else None

    public = try_candidates(None, "public")
    if public:
        return public
    headers = (
        _resilience_auth_headers(health_url, recovery=recovery)
        if recovery is not None else _resilience_auth_headers(health_url)
    )
    if not headers:
        raise ScenarioSkip(
            "Database probe routes require authentication, but neither RESILIENCE_API_TOKEN nor "
            "RESILIENCE_TEST_IDENTIFIER/RESILIENCE_TEST_PASSWORD is configured. Observed: " + ", ".join(statuses)
        )
    authenticated = try_candidates(headers, "authenticated")
    if authenticated:
        return authenticated
    raise ScenarioError(
        "No safe database-dependent GET endpoint returned 2xx before fault injection: " + ", ".join(statuses),
        error_type="PreconditionFailed",
        solution="Verify test-account permissions and the configured /cars, /renters or /rentals routes.",
    )


def _swarm_toxiproxy_setup(platform: Platform, name: str, api_port: int) -> dict[str, Any]:
    spec = parse_json_output(platform.command(["docker", "service", "inspect", platform.service, "--format", "{{json .Spec}}"]), "docker service inspect backend spec", platform.logger)
    container = spec.get("TaskTemplate", {}).get("ContainerSpec", {})
    environment = container.get("Env") or []
    original = environment_value(environment, "DATABASE_URL")
    if not original:
        raise ScenarioSkip("Backend DATABASE_URL is not exposed through the Swarm service environment, so traffic cannot be rerouted safely without modifying application code.")
    networks = spec.get("TaskTemplate", {}).get("Networks") or []
    if not networks:
        raise ScenarioSkip("The Swarm backend service has no inspectable overlay network, so an isolated Toxiproxy service cannot be attached safely.")
    network_id = networks[0].get("Target")
    network = require_ok(platform.command(["docker", "network", "inspect", network_id, "--format", "{{.Name}}"]), "Inspect the backend overlay network.")
    create = ["docker", "service", "create", "--name", name, "--network", network, "--publish", f"published={api_port},target=8474,mode=host", "--replicas", "1", TOXIPROXY_IMAGE]
    result = platform.command(create, timeout=120)
    if result.returncode != 0:
        platform.command(["docker", "service", "rm", name], cleanup=True, timeout=60)
        raise ScenarioSkip(f"The official Toxiproxy image/service could not be started in Swarm: {(safe_stderr(result) or safe_stdout(result)).strip()}")
    deadline = time.monotonic() + 90
    while time.monotonic() < deadline:
        state = platform.command(["docker", "service", "ps", name, "--filter", "desired-state=running", "--format", "{{.CurrentState}}"], cleanup=True)
        if state.returncode == 0 and any(line.startswith("Running") for line in state.stdout.splitlines()):
            break
        time.sleep(1)
    else:
        platform.command(["docker", "service", "rm", name], cleanup=True, timeout=60)
        raise ScenarioSkip("The temporary Swarm Toxiproxy task did not reach Running state.")
    return {"original": original, "proxy_host": name, "api_url": f"http://127.0.0.1:{api_port}", "resource": name, "process": None, "manifest": None}


def _kubernetes_toxiproxy_setup(platform: Platform, name: str, api_port: int) -> dict[str, Any]:
    deployment = parse_json_output(platform.command(["kubectl", "get", "deployment", platform.deployment, "-n", platform.namespace, "-o", "json"]), "kubectl get backend deployment environment", platform.logger)
    containers = deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
    selected = next((item for item in containers if item.get("name") == platform.container_name), containers[0] if containers else {})
    environment = selected.get("env") or []
    entry = next((item for item in environment if item.get("name") == "DATABASE_URL"), None)
    if not entry or "value" not in entry:
        raise ScenarioSkip("Backend DATABASE_URL is not a literal Deployment environment value, so it cannot be preserved and rerouted safely.")
    original = entry["value"]
    manifest_path = ROOT / "results" / "processed" / f"{name}.yaml"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(yaml.safe_dump(kubernetes_manifest(name, platform.namespace), sort_keys=False), encoding="utf-8")
    result = platform.command(["kubectl", "apply", "-f", str(manifest_path)], timeout=120)
    if result.returncode != 0:
        platform.command(["kubectl", "delete", "-f", str(manifest_path), "--ignore-not-found=true", "--wait=false"], cleanup=True, timeout=60)
        manifest_path.unlink(missing_ok=True)
        raise ScenarioSkip(f"Required Kubernetes permissions are unavailable or Toxiproxy resources could not be created: {(safe_stderr(result) or safe_stdout(result)).strip()}")
    try:
        require_ok(platform.command(["kubectl", "rollout", "status", f"deployment/{name}", "-n", platform.namespace, "--timeout=120s"], timeout=135), "Inspect the temporary Toxiproxy pod and image pull status.")
        _wait_kubernetes_service_endpoint(platform, name, float(CONFIG.get("toxiproxy", {}).get("api_start_timeout_seconds", 60)))
        process = None
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                process = _start_kubectl_port_forward(platform, name, api_port, 8474)
                probe = ToxiproxyClient(f"http://127.0.0.1:{api_port}", timeout=5)
                probe.wait_for_api(15)
                probe._request("GET", "/proxies")
                if platform.logger:
                    platform.logger(f"[TOXIPROXY] Kubernetes API verified via service/{name} on 127.0.0.1:{api_port} (/version and /proxies).")
                break
            except Exception as exc:
                last_error = exc
                _stop_process(process); process = None
                if platform.logger:
                    platform.logger(f"[TOXIPROXY] API forward attempt {attempt}/3 failed; rediscovering the Ready service endpoint.")
                _wait_kubernetes_service_endpoint(platform, name, 30)
                time.sleep(float(CONFIG.get("toxiproxy", {}).get("api_retry_interval_seconds", 2)))
        if process is None:
            raise ScenarioError(
                f"Toxiproxy Kubernetes API remained unreachable after three verified service port-forward attempts: {last_error}",
                error_type="TOXIPROXY_API_UNREACHABLE",
            )
    except Exception:
        platform.command(["kubectl", "delete", "-f", str(manifest_path), "--ignore-not-found=true", "--wait=false"], cleanup=True, timeout=60)
        manifest_path.unlink(missing_ok=True)
        raise
    return {"original": original, "proxy_host": name, "api_url": f"http://127.0.0.1:{api_port}", "resource": name, "process": process, "manifest": manifest_path}


def _reroute_database(platform: Platform, database_url: str) -> None:
    if platform.name == "swarm":
        require_ok(platform.command(["docker", "service", "update", "--detach", "--env-rm", "DATABASE_URL", "--env-add", f"DATABASE_URL={database_url}", platform.service], timeout=60), "Restore the original Swarm DATABASE_URL and inspect service update errors.")
        _wait_swarm_service(platform)
    else:
        deployment = parse_json_output(
            platform.command(["kubectl", "get", "deployment", platform.deployment, "-n", platform.namespace, "-o", "json"]),
            "kubectl get backend deployment before DATABASE_URL patch", platform.logger,
        )
        containers = deployment.get("spec", {}).get("template", {}).get("spec", {}).get("containers", [])
        selected = next((item for item in containers if item.get("name") == platform.container_name), None)
        if selected is None:
            raise ScenarioError("Backend container was not found while building the DATABASE_URL patch.", error_type="ResourceDiscoveryError")
        updated_env = [item for item in (selected.get("env") or []) if item.get("name") != "DATABASE_URL"]
        updated_env.append({"name": "DATABASE_URL", "value": database_url})
        patch_path = ROOT / "results" / "processed" / f"database-env-{uuid4().hex}.json"
        patch_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            write_json_payload(patch_path, kubernetes_environment_patch(platform.container_name, updated_env))
            require_ok(platform.command(["kubectl", "patch", "deployment", platform.deployment, "-n", platform.namespace, "--type=strategic", "--patch-file", str(patch_path)], timeout=60), "Restore the original Kubernetes DATABASE_URL.")
        finally:
            patch_path.unlink(missing_ok=True)
        platform.ensure_kubernetes_backend_ready()


def _cleanup_toxiproxy(platform: Platform, state: dict[str, Any]) -> bool:
    restored = False
    client = state.get("client")
    try:
        if client and state.get("proxy_disabled"):
            client.enable_proxy(state.get("proxy_name", "postgres"))
            state["proxy_disabled"] = False
        if client and state.get("toxic_active"):
            client.remove_latency_toxic(state.get("proxy_name", "postgres"))
            state["toxic_active"] = False
        if state.get("rerouted") and state.get("original"):
            _reroute_database(platform, state["original"])
            with platform.health_access() as health_url:
                restored = _wait_probe(health_url, None, platform.timeout, platform.request_timeout) is not None
                probe_path = state.get("probe_path")
                if restored and probe_path:
                    parsed = urlsplit(health_url)
                    probe_url = f"{parsed.scheme}://{parsed.netloc}{probe_path}"
                    restored = _wait_probe(probe_url, state.get("probe_headers"), platform.timeout, platform.request_timeout) is not None
            if not restored:
                raise ScenarioError("Backend health or its database probe did not recover after restoring DATABASE_URL.", error_type="RestorationFailed")
        else:
            restored = True
    finally:
        _stop_process(state.get("process"))
        if state.get("resource"):
            if platform.name == "swarm":
                platform.command(["docker", "service", "rm", state["resource"]], cleanup=True, timeout=60)
            else:
                manifest = state.get("manifest")
                if manifest:
                    platform.command(["kubectl", "delete", "-f", str(manifest), "--ignore-not-found=true", "--wait=false"], cleanup=True, timeout=60)
                    try:
                        Path(manifest).unlink(missing_ok=True)
                    except OSError:
                        pass
    return restored


def run_toxiproxy_scenario(platform: Platform, repetition: int, scenario: str) -> dict[str, Any]:
    record = result_template(platform.name, scenario, repetition); started = time.monotonic()
    state: dict[str, Any] = {}; client: ToxiproxyClient | None = None; proxy_name = "postgres"
    selected_probe_path = ""
    try:
        platform.prerequisites()
        if platform.dry_run:
            return skip(record, "Dry-run: Toxiproxy lifecycle, rerouting, injection and restoration commands were validated without execution.", started)
        def recover_auth_infrastructure() -> None:
            # Idempotent bounded recovery before retrying a transient login 5xx.
            cleanup_temporary_resources(platform)
            if platform.name == "swarm":
                baseline = _SWARM_ORIGINAL_STATE or capture_swarm_backend_state(platform)
                restore_swarm_backend(platform, baseline)
                ensure_swarm_backend_healthy(platform)
            else:
                platform.stop_port_forward()
                platform.ensure_kubernetes_backend_ready()

        with platform.health_access() as initial_health_url:
            selected_probe_path, initial_probe_url, initial_headers = _discover_database_probe(
                initial_health_url, platform.request_timeout,
                recovery=recover_auth_infrastructure,
            )
            if platform.logger:
                platform.logger(f"[PREFLIGHT] Authenticated database probe selected: {selected_probe_path} (HTTP 2xx).")
        name = resource_name(platform.name, record["test_id"])
        api_port, _ = select_local_port(int(CONFIG["tests"].get("toxiproxy_api_port", 18474)))
        state = _swarm_toxiproxy_setup(platform, name, api_port) if platform.name == "swarm" else _kubernetes_toxiproxy_setup(platform, name, api_port)
        # The control plane must not inherit the shorter application request
        # timeout used to measure degradation. Docker Desktop can briefly take
        # longer while the backend is reconnecting to PostgreSQL.
        client = ToxiproxyClient(state["api_url"], timeout=max(10.0, platform.request_timeout))
        state.update(client=client, proxy_name=proxy_name, proxy_disabled=False, toxic_active=False)
        try:
            client.wait_for_api(30)
        except RuntimeError as exc:
            raise ScenarioError(
                f"The Toxiproxy API could not be reached after the temporary resource started: {exc}",
                error_type="TOXIPROXY_API_UNREACHABLE",
            ) from exc
        upstream = f"{CONFIG[platform.name]['database_service'] if platform.name == 'swarm' else CONFIG['kubernetes'].get('database_service', 'database')}:5432"
        client.create_proxy(proxy_name, "0.0.0.0:5433", upstream)
        if not client.proxy_is_enabled(proxy_name, True):
            raise ScenarioError("Toxiproxy proxy creation was not confirmed by its API.", error_type="InjectionNotConfirmed")
        if platform.logger:
            platform.logger("[TOXIPROXY] Proxy status: enabled; backend rerouting in progress.")
        routed = replace_database_host(state["original"], state["proxy_host"], 5433)
        _reroute_database(platform, routed); state["rerouted"] = True
        with platform.health_access() as health_url:
            parsed_health = urlsplit(health_url)
            probe_url = f"{parsed_health.scheme}://{parsed_health.netloc}{selected_probe_path}"
            headers = _resilience_auth_headers(health_url)
            state.update(probe_path=selected_probe_path, probe_headers=headers)
            baseline = collect_http_samples(probe_url, float(CONFIG["tests"].get("baseline_duration_seconds", 5)), platform.interval, platform.request_timeout, headers=headers, cancel_event=platform.cancel_event)
            baseline_metrics = sample_metrics(baseline)
            if not baseline or baseline_metrics["http_success_count"] == 0:
                status = baseline[-1]["status"] if baseline else 0
                if status in {401, 403}:
                    raise ScenarioSkip("Database-dependent endpoint requires authentication and no resilience-test credentials or RESILIENCE_API_TOKEN were provided.")
                raise ScenarioSkip(f"Database-dependent endpoint {probe_url} did not return a successful baseline response (last HTTP status: {status or 'unreachable'}).")
            record["baseline_average_response_time_ms"] = baseline_metrics["average_response_time_ms"]
            record["baseline_median_response_time_ms"] = baseline_metrics["median_response_time_ms"]
            record["baseline_p95_response_time_ms"] = baseline_metrics["p95_response_time_ms"]
            if platform.logger:
                platform.logger(f"[TOXIPROXY] Baseline latency: {record['baseline_average_response_time_ms']} ms")
            record["injection_method"] = "Toxiproxy"
            record["recovery_required"] = True
            record["injection_started"] = utc_now(); event = time.monotonic()
            if scenario == "network-partition":
                client.disable_proxy(proxy_name); state["proxy_disabled"] = True
                record["injection_confirmed"] = client.proxy_is_enabled(proxy_name, False)
                if not record["injection_confirmed"]:
                    raise ScenarioError("Toxiproxy did not confirm the disabled proxy state.", error_type="InjectionNotConfirmed")
                if platform.logger:
                    platform.logger("[TOXIPROXY] Partition enabled; proxy status: disabled.")
                injected = collect_http_samples(probe_url, float(CONFIG["tests"].get("network_partition_duration_seconds", 15)), platform.interval, platform.request_timeout, headers=headers, cancel_event=platform.cancel_event)
                metrics = sample_metrics(injected); record.update(metrics)
                record["injected_average_response_time_ms"] = metrics["average_response_time_ms"]
                record["injected_median_response_time_ms"] = metrics["median_response_time_ms"]
                record["injected_p95_response_time_ms"] = metrics["p95_response_time_ms"]
                min_failures = int(CONFIG.get("toxiproxy", {}).get("network_failure_min_count", 1))
                record["degradation_observed"] = metrics["http_failure_count"] >= min_failures and metrics["availability_percent"] < baseline_metrics["availability_percent"]
                if platform.logger:
                    platform.logger(f"[TOXIPROXY] Degradation observed: {record['degradation_observed']}; HTTP failures: {metrics['http_failure_count']}")
                first_failure = next((item for item in injected if not 200 <= int(item["status"]) < 300), None)
                record["detection_time_seconds"] = round(first_failure["time"] - event, 3) if first_failure else NOT_MEASURED
                client.enable_proxy(proxy_name); state["proxy_disabled"] = False
                if not client.proxy_is_enabled(proxy_name, True):
                    raise ScenarioError("Toxiproxy did not confirm proxy re-enablement.", error_type="RestorationFailed")
                if platform.logger:
                    platform.logger("[TOXIPROXY] Partition disabled; proxy status: enabled; waiting for recovery.")
            else:
                tox_config = CONFIG.get("toxiproxy", {})
                latency_ms = int(tox_config.get("latency_ms", CONFIG["tests"].get("degraded_latency_ms", 2000)))
                jitter_ms = int(tox_config.get("latency_jitter_ms", CONFIG["tests"].get("degraded_jitter_ms", 100)))
                client.add_latency_toxic(proxy_name, latency_ms, jitter_ms); state["toxic_active"] = True; record["injection_confirmed"] = True
                record["injection_confirmed"] = client.latency_toxic_is_present(proxy_name, latency_ms, jitter_ms)
                if not record["injection_confirmed"]:
                    raise ScenarioError("Toxiproxy did not report the configured latency toxic.", error_type="InjectionNotConfirmed")
                if platform.logger:
                    platform.logger(f"[TOXIPROXY] Latency toxic active: {latency_ms} ms ± {jitter_ms} ms")
                injected = collect_http_samples(probe_url, float(CONFIG["tests"].get("degraded_duration_seconds", 60)), platform.interval, max(platform.request_timeout, latency_ms / 1000 + 3), headers=headers, cancel_event=platform.cancel_event)
                metrics = sample_metrics(injected); record.update(metrics)
                record["injected_average_response_time_ms"] = metrics["average_response_time_ms"]
                record["injected_median_response_time_ms"] = metrics["median_response_time_ms"]
                record["injected_p95_response_time_ms"] = metrics["p95_response_time_ms"]
                threshold = float(tox_config.get("latency_min_increase_ms", max(250.0, latency_ms * 0.5)))
                multiplier = float(tox_config.get("latency_min_multiplier", 1.5))
                injected_average = metrics["average_response_time_ms"]
                baseline_average = float(baseline_metrics["average_response_time_ms"])
                record["degradation_observed"] = isinstance(injected_average, (int, float)) and float(injected_average) >= baseline_average + threshold and float(injected_average) >= baseline_average * multiplier
                if platform.logger:
                    platform.logger(f"[TOXIPROXY] Injected average: {metrics['average_response_time_ms']} ms; P95: {metrics['p95_response_time_ms']} ms")
                record["detection_time_seconds"] = round(max(0, next((item["time"] - event for item in injected if item["response_ms"] >= float(baseline_metrics["average_response_time_ms"]) + threshold), 0)), 3)
                client.remove_latency_toxic(proxy_name); state["toxic_active"] = False
                if client.latency_toxic_is_present(proxy_name, latency_ms, jitter_ms):
                    raise ScenarioError("Latency toxic is still present after removal.", error_type="RestorationFailed")
                if platform.logger:
                    platform.logger("[TOXIPROXY] Latency toxic inactive; waiting for recovery.")
            recovery_started = time.monotonic()
            recovery_timeout = float(CONFIG.get("toxiproxy", {}).get("recovery_timeout_seconds", platform.timeout))
            recovery = _wait_probe(
                probe_url, headers, recovery_timeout, platform.request_timeout,
                process=platform.created_port_forward if platform.name == "kubernetes" else None,
            )
            if recovery is None and platform.name == "kubernetes":
                # DATABASE_URL rollout may replace the pod backing the original
                # service forward. Recreate only the framework-owned forward,
                # then retry the DB-backed endpoint through the new pod.
                platform.stop_port_forward()
                platform.ensure_kubernetes_backend_ready()
                with platform.health_access() as recovered_health_url:
                    parsed_recovered = urlsplit(recovered_health_url)
                    recovered_probe_url = f"{parsed_recovered.scheme}://{parsed_recovered.netloc}{selected_probe_path}"
                    recovery = _wait_probe(recovered_probe_url, headers, recovery_timeout, platform.request_timeout)
                    if recovery is not None:
                        probe_url = recovered_probe_url
            recovery_success = recovery is not None
            if scenario == "latency" and recovery_success:
                recovered_samples = collect_http_samples(
                    probe_url, float(CONFIG["tests"].get("baseline_duration_seconds", 5)),
                    platform.interval, platform.request_timeout, headers=headers,
                    cancel_event=platform.cancel_event,
                )
                recovered_metrics = sample_metrics(recovered_samples)
                recovered_average = recovered_metrics["average_response_time_ms"]
                record["recovery_average_response_time_ms"] = recovered_average
                record["recovery_median_response_time_ms"] = recovered_metrics["median_response_time_ms"]
                record["recovery_p95_response_time_ms"] = recovered_metrics["p95_response_time_ms"]
                recovery_limit = float(baseline_metrics["average_response_time_ms"]) + max(250.0, float(baseline_metrics["average_response_time_ms"]) * 1.5)
                recovery_success = isinstance(recovered_average, (int, float)) and float(recovered_average) <= recovery_limit
                if platform.logger:
                    platform.logger(f"[TOXIPROXY] Post-toxic average: {recovered_average} ms; recovery limit: {round(recovery_limit, 3)} ms.")
            record["recovery_time_seconds"] = round(time.monotonic() - recovery_started, 3) if recovery_success else NOT_MEASURED
            record["recovery_success"] = recovery_success
            if platform.logger:
                platform.logger(f"[TOXIPROXY] Recovery status: {'healthy' if recovery is not None else 'timeout'}")
            passed = bool(record["injection_confirmed"] and record["degradation_observed"] and recovery_success)
            record["status"] = "PASS" if passed else "FAIL"
            if not passed:
                record.update(error_count=1, error_message="Toxiproxy injection completed, but observable degradation and recovery did not both satisfy the PASS conditions.")
    except ScenarioSkip as exc:
        return skip(record, str(exc), started)
    except Exception as exc:
        return fail(record, exc, started)
    finally:
        if state:
            try:
                record["restoration_success"] = _cleanup_toxiproxy(platform, state)
                if record["restoration_success"] is False:
                    record.update(status="FAIL", error_count=1, error_message="Critical: original DATABASE_URL restoration failed.", recovery_success=False)
            except Exception as cleanup_error:
                record.update(status="FAIL", restoration_success=False, error_count=1, error_message=f"Critical cleanup/restoration failure: {cleanup_error}", recovery_success=False)
    return finish(record, started)


def run_network_partition(platform: Platform, repetition: int) -> dict[str, Any]:
    return run_toxiproxy_scenario(platform, repetition, "network-partition")


def run_degraded_latency(platform: Platform, repetition: int) -> dict[str, Any]:
    return run_toxiproxy_scenario(platform, repetition, "latency")


def run_cpu_saturation(platform: Platform, repetition: int) -> dict[str, Any]:
    return run_bounded_pressure(platform, repetition, "cpu")


def run_memory_pressure(platform: Platform, repetition: int) -> dict[str, Any]:
    return run_bounded_pressure(platform, repetition, "memory")


ROUTES = {
    "container-kill": run_container_kill, "node-failure": run_node_failure,
    "cpu": run_cpu_saturation, "memory": run_memory_pressure,
    "network-partition": run_network_partition, "latency": run_degraded_latency,
}


def preflight_platform(platform_name: str, *, logger: Any = None, context_switcher: Any = None) -> None:
    """Validate the complete platform baseline without injecting a fault."""
    platform = Platform(platform_name, logger=logger, context_switcher=context_switcher)
    platform.prerequisites()
    with platform.health_access() as health_url:
        require_healthy_baseline(platform, health_url)


def prepare_clean_baseline(platform: Platform) -> dict[str, Any] | None:
    """Remove leaked test resources and verify the entire target before injection."""
    global _SWARM_ORIGINAL_STATE
    cleanup_temporary_resources(platform)
    platform.prerequisites()
    if platform.name == "swarm":
        ensure_swarm_backend_healthy(platform)
        state = capture_swarm_backend_state(platform)
        if _SWARM_ORIGINAL_STATE is None:
            _SWARM_ORIGINAL_STATE = state
        return dict(_SWARM_ORIGINAL_STATE)
    platform.ensure_kubernetes_backend_ready()
    with platform.health_access() as health_url:
        require_healthy_baseline(platform, health_url)
    return None


def finalize_scenario_environment(platform: Platform, original: dict[str, Any] | None) -> None:
    """Bounded finally-stage restoration required before the next scenario."""
    cleanup_temporary_resources(platform)
    if platform.name == "swarm":
        if original:
            restore_swarm_backend(platform, original)
        ensure_swarm_backend_healthy(platform)
    else:
        platform.ensure_kubernetes_backend_ready()
        with platform.health_access() as health_url:
            require_healthy_baseline(platform, health_url)


def execute(platform_name: str, scenario: str, repetition: int, *, dry_run: bool = False, cancel_event: threading.Event | None = None, logger: Any = None, process_holder: dict[str, subprocess.Popen[str] | None] | None = None, context_switcher: Any = None) -> dict[str, Any]:
    if platform_name not in {"swarm", "kubernetes"}:
        raise ValueError(f"Unsupported platform: {platform_name}")
    handler = ROUTES.get(scenario)
    if handler is None:
        raise ValueError(f"Unsupported scenario: {scenario}")
    if dry_run:
        record = result_template(platform_name, scenario, repetition)
        return skip(record, "Dry-run: the execution route was validated and no platform command was executed.", time.monotonic())
    platform = Platform(platform_name, dry_run=dry_run, cancel_event=cancel_event, logger=logger, process_holder=process_holder, context_switcher=context_switcher)
    original: dict[str, Any] | None = None
    record: dict[str, Any] | None = None
    try:
        original = prepare_clean_baseline(platform)
        record = handler(platform, repetition)
    except Exception as exc:
        record = fail(result_template(platform_name, scenario, repetition), exc, time.monotonic())
    finally:
        try:
            finalize_scenario_environment(platform, original)
        except Exception as cleanup_error:
            if record is None:
                record = fail(result_template(platform_name, scenario, repetition), cleanup_error, time.monotonic())
            else:
                previous = str(record.get("error_message") or "").strip()
                record.update(
                    status="FAIL", recovery_success=False, restoration_success=False,
                    error_count=max(1, int(record.get("error_count") or 0)),
                    error_message=(previous + " | " if previous else "") + f"CLEANUP FAILURE: {cleanup_error}",
                    _error_context={"error_type": "CLEANUP_FAILURE", "suggested_solution": "Inspect restoration diagnostics; the next scenario will run its own clean-baseline gate."},
                )
    assert record is not None
    return record


def error_record(record: dict[str, Any]) -> dict[str, Any] | None:
    if record["status"] != "FAIL":
        return None
    context = record.get("_error_context", {})
    return {
        "timestamp": record["timestamp_end"], "session_id": record.get("session_id", ""), "platform": record["platform"], "scenario": record["scenario"],
        "command": context.get("command", ""), "exit_code": context.get("exit_code", NA),
        "stdout": context.get("stdout", ""), "stderr": context.get("stderr", ""),
        "error_type": context.get("error_type", "ScenarioFailure"), "error_message": record["error_message"],
        "suggested_solution": context.get("suggested_solution", "Check Docker/Kubernetes events, resource availability, and the latest framework log."),
    }
