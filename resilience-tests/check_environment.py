"""Inspect local TuniCars+ resilience prerequisites without changing them."""

from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen
from src.command_runner import run_command

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "results" / "processed" / "environment_check.json"
REQUIRED_IMPORTS = ("requests", "psutil", "pandas", "matplotlib", "yaml", "jinja2", "pytest")
SWARM_SERVICES = ("cars-rental_frontend", "cars-rental_backend", "cars-rental_database")


def command(args: list[str], timeout: float = 8) -> tuple[int, str]:
    try:
        result = run_command(args, timeout_seconds=timeout)
        return result.returncode, (result.stdout + result.stderr).strip()
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return 127, str(exc)


def health(url: str) -> bool:
    try:
        with urlopen(url, timeout=2) as response:
            return response.status == 200
    except (URLError, OSError, TimeoutError):
        return False


def item(name: str, status: str, detail: str, critical: bool = False) -> dict[str, Any]:
    return {"name": name, "status": status, "detail": detail, "critical": critical}


def inspect_environment() -> dict[str, Any]:
    checks: list[dict[str, Any]] = []
    version_ok = sys.version_info >= (3, 11)
    checks.append(item("Python", "OK" if version_ok else "ERROR", sys.version.split()[0], True))
    in_venv = sys.prefix != getattr(sys, "base_prefix", sys.prefix)
    checks.append(item("Virtual environment", "OK" if in_venv else "WARNING", sys.prefix))
    checks.append(item("requirements.txt", "OK" if (ROOT / "requirements.txt").exists() else "ERROR", str(ROOT / "requirements.txt"), True))

    missing = [name for name in REQUIRED_IMPORTS if importlib.util.find_spec(name) is None]
    checks.append(item("Python dependencies", "OK" if not missing else "ERROR", "complete" if not missing else "missing: " + ", ".join(missing), True))

    docker = shutil.which("docker")
    checks.append(item("Docker CLI", "OK" if docker else "ERROR", docker or "not found"))
    docker_ok, docker_info = command(["docker", "info", "--format", "{{.ServerVersion}}"], 10) if docker else (127, "not found")
    checks.append(item("Docker daemon", "OK" if docker_ok == 0 else "ERROR", docker_info or "unavailable"))
    swarm_ok, swarm_state = command(["docker", "info", "--format", "{{.Swarm.LocalNodeState}}"], 10) if docker_ok == 0 else (127, "unavailable")
    swarm_active = swarm_ok == 0 and "active" in swarm_state.lower()
    checks.append(item("Docker Swarm", "OK" if swarm_active else "WARNING", swarm_state or "inactive"))

    service_output = ""
    if swarm_active:
        _, service_output = command(["docker", "service", "ls", "--format", "{{.Name}}"], 10)
    for service in SWARM_SERVICES:
        present = service in service_output.splitlines()
        checks.append(item(f"Swarm service {service}", "OK" if present else "WARNING", "present" if present else "not found"))

    kubectl = shutil.which("kubectl")
    minikube = shutil.which("minikube")
    checks.append(item("kubectl CLI", "OK" if kubectl else "WARNING", kubectl or "not found"))
    checks.append(item("Minikube CLI", "OK" if minikube else "WARNING", minikube or "not found"))
    mini_code, mini_state = command(["minikube", "status"], 20) if minikube else (127, "not found")
    checks.append(item("Minikube", "OK" if mini_code == 0 else "WARNING", mini_state[:500] or "stopped"))

    if kubectl:
        node_code, nodes = command(["kubectl", "get", "nodes", "--no-headers"], 12)
        pod_code, pods = command(["kubectl", "get", "pods", "--no-headers"], 12)
        service_code, services = command(["kubectl", "get", "services", "--no-headers"], 12)
        checks.append(item("Kubernetes nodes", "OK" if node_code == 0 and nodes else "WARNING", nodes[:1000] or "unavailable"))
        checks.append(item("Kubernetes pods", "OK" if pod_code == 0 and pods else "WARNING", pods[:1000] or "unavailable"))
        checks.append(item("Kubernetes services", "OK" if service_code == 0 and services else "WARNING", services[:1000] or "unavailable"))

    checks.append(item("Swarm backend health", "OK" if health("http://localhost:8000/health") else "WARNING", "http://localhost:8000/health"))
    checks.append(item("Kubernetes forwarded health", "OK" if health("http://localhost:8001/health") else "WARNING", "http://localhost:8001/health"))

    results = ROOT / "results"
    results.mkdir(parents=True, exist_ok=True)
    writable = os.access(results, os.W_OK)
    checks.append(item("Results write access", "OK" if writable else "ERROR", str(results), True))
    disk = shutil.disk_usage(ROOT)
    checks.append(item("Available disk space", "OK" if disk.free >= 500 * 1024**2 else "WARNING", f"{disk.free / 1024**3:.2f} GiB"))
    critical_errors = sum(check["status"] == "ERROR" and check["critical"] for check in checks)
    return {"project": "TuniCars+", "checks": checks, "critical_errors": critical_errors}


def main() -> int:
    report = inspect_environment()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for check in report["checks"]:
        print(f"[{check['status']}] {check['name']}: {check['detail']}")
    print(f"Environment report: {OUTPUT}")
    return 1 if report["critical_errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
