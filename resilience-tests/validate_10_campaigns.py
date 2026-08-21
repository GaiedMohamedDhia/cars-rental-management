"""Run and prove ten consecutive complete resilience campaigns without intervention."""

from __future__ import annotations

import csv
from datetime import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4

import requests

from src.session_store import paths, read_rows

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "results" / "validation-10-runs.json"
TABLE = ROOT / "results" / "validation-10-runs.csv"
EXPECTED = {(platform, scenario) for platform in ("swarm", "kubernetes") for scenario in ("container-kill", "node-failure", "cpu", "memory", "network-partition", "latency")}
VALIDATION_LOCK = ROOT / "results" / "validation.lock"


def command(args: list[str], timeout: int = 60) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=ROOT, text=True, encoding="utf-8", errors="replace", capture_output=True, timeout=timeout, check=False)


def temporary_resources() -> list[str]:
    leftovers: list[str] = []
    docker = command(["docker", "ps", "-a", "--format", "{{.Names}}"])
    leftovers.extend(name for name in docker.stdout.splitlines() if name.startswith("tunicars-") and "-stress-" in name)
    services = command(["docker", "service", "ls", "--format", "{{.Name}}"])
    leftovers.extend(name for name in services.stdout.splitlines() if name.startswith("rt-toxiproxy-"))
    pods = command(["kubectl", "get", "pods", "-n", "default", "-o", "name"])
    leftovers.extend(name for name in pods.stdout.splitlines() if "tunicars-" in name or "toxiproxy" in name)
    resources = command(["kubectl", "get", "deployment,service", "-n", "default", "-o", "name"])
    leftovers.extend(name for name in resources.stdout.splitlines() if "toxiproxy" in name)
    return sorted(set(leftovers))


def verify_platforms() -> None:
    swarm = command(["docker", "service", "ls", "--filter", "label=com.docker.stack.namespace=cars-rental", "--format", "{{.Name}}={{.Replicas}}"])
    if swarm.returncode or len([line for line in swarm.stdout.splitlines() if line.endswith("=1/1")]) != 3:
        raise RuntimeError("Swarm services are not all 1/1: " + swarm.stdout + swarm.stderr)
    if requests.get("http://127.0.0.1:8000/health", timeout=10).status_code != 200:
        raise RuntimeError("Swarm backend /health is not HTTP 200")
    readyz = command(["kubectl", "get", "--raw=/readyz"], timeout=30)
    if readyz.returncode or "ok" not in readyz.stdout.lower():
        raise RuntimeError("Kubernetes API is not ready: " + readyz.stdout + readyz.stderr)
    deployments = command(["kubectl", "get", "deployment", "backend", "frontend", "database", "-n", "default", "-o", "json"])
    payload = json.loads(deployments.stdout)
    for item in payload.get("items", []):
        desired = int(item.get("spec", {}).get("replicas", 1)); ready = int(item.get("status", {}).get("readyReplicas") or 0)
        if ready != desired: raise RuntimeError(f"Kubernetes {item['metadata']['name']} is {ready}/{desired}")


def write_summary(rows: list[dict]) -> None:
    OUTPUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    fields = ("run", "session_id", "pass", "fail", "skipped", "duration_seconds", "charts", "pdf", "pdf_path", "cleanup")
    with TABLE.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields); writer.writeheader(); writer.writerows(rows)


def validate_session(run_number: int, session_id: str, duration: float) -> dict:
    active = paths(session_id); rows = read_rows(active["csv"])
    pairs = {(row.get("Platform", ""), row.get("Scenario", "")) for row in rows}
    statuses = [row.get("Status", "").upper() for row in rows]
    charts = [item for item in active["charts"].glob("*.png") if item.stat().st_size > 0]
    report_ok = active["report"].exists() and active["report"].stat().st_size > 0
    leftovers = temporary_resources()
    meta = json.loads(active["meta"].read_text(encoding="utf-8"))
    errors = []
    if len(rows) != 12 or pairs != EXPECTED: errors.append(f"expected 12 unique pairs, got {len(rows)} rows/{len(pairs)} pairs")
    if statuses.count("FAIL"): errors.append(f"{statuses.count('FAIL')} FAIL result(s)")
    if meta.get("state") != "COMPLETED": errors.append(f"session state is {meta.get('state')}")
    if not charts: errors.append("no non-empty chart")
    if not report_ok: errors.append("report missing or empty")
    if leftovers: errors.append("temporary resources: " + ", ".join(leftovers))
    verify_platforms()
    result = {"run": run_number, "session_id": session_id, "pass": statuses.count("PASS"), "fail": statuses.count("FAIL"), "skipped": statuses.count("SKIPPED"), "duration_seconds": round(duration, 2), "charts": len(charts), "pdf": "YES" if report_ok else "NO", "pdf_path": str(active["report"]), "cleanup": "CLEAN" if not leftovers else "DIRTY"}
    if errors: raise RuntimeError("; ".join(errors))
    return result


def main() -> int:
    owner = uuid4().hex
    VALIDATION_LOCK.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = VALIDATION_LOCK.open("x", encoding="utf-8")
    except FileExistsError as exc:
        raise RuntimeError("Another ten-run stability validation is already active.") from exc
    with fd:
        fd.write(f"{os.getpid()}:{owner}")
    child_env = dict(os.environ, RESILIENCE_VALIDATION_OWNER=owner)
    try:
        completed: list[dict] = []
        for run_number in range(1, 11):
            before = {item.name for item in (ROOT / "results" / "sessions").iterdir() if item.is_dir()}
            started = time.monotonic()
            log = ROOT / "results" / "logs" / f"validation_run_{run_number:02d}_{datetime.now():%Y%m%d_%H%M%S}.log"
            with log.open("w", encoding="utf-8") as stream:
                process = subprocess.run([sys.executable, "-u", "run_all_tests.py", "--repetitions", "1"], cwd=ROOT, env=child_env, text=True, encoding="utf-8", errors="replace", stdout=stream, stderr=subprocess.STDOUT, check=False)
            after = {item.name for item in (ROOT / "results" / "sessions").iterdir() if item.is_dir()}
            created = sorted(after - before)
            if len(created) != 1: raise RuntimeError(f"Run {run_number} created {len(created)} sessions: {created}")
            result = validate_session(run_number, created[0], time.monotonic() - started)
            completed.append(result); write_summary(completed)
            print(f"[VALIDATED] {run_number}/10 {result}", flush=True)
            if process.returncode not in {0}: raise RuntimeError(f"Run {run_number} CLI exit code {process.returncode}; inspect {log}")
        return 0
    finally:
        VALIDATION_LOCK.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
