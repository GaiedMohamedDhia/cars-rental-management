"""Safely remove only temporary resources created by resilience scenarios.

This module deliberately uses an allow-list of test prefixes. It never removes
application services, Minikube nodes, volumes, or persistent database data.
"""

from __future__ import annotations

import argparse
import subprocess
from collections.abc import Callable


ALLOWED_PREFIXES = (
    "rt-toxiproxy-",
    "tunicars-cpu-stress-",
    "tunicars-memory-stress-",
    "backend-check-",
)


def is_test_resource(name: str) -> bool:
    """Return true only for names owned by the resilience framework."""
    return any(name.startswith(prefix) for prefix in ALLOWED_PREFIXES)


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=False)


def cleanup_resources(*, dry_run: bool = False, runner: Callable[[list[str]], subprocess.CompletedProcess[str]] = _run) -> list[str]:
    """Discover and remove allow-listed Docker and Kubernetes resources."""
    actions: list[str] = []

    docker_queries = (
        (["docker", "service", "ls", "--format", "{{.Name}}"], ["docker", "service", "rm"]),
        (["docker", "ps", "-a", "--format", "{{.Names}}"], ["docker", "rm", "-f"]),
    )
    for query, remove in docker_queries:
        result = runner(query)
        if result.returncode != 0:
            continue
        for name in {line.strip() for line in result.stdout.splitlines() if line.strip()}:
            if is_test_resource(name):
                actions.append(f"remove {name}")
                if not dry_run:
                    runner([*remove, name])

    for kind in ("deployment", "service", "pod"):
        result = runner(["kubectl", "get", kind, "-A", "-o", "jsonpath={range .items[*]}{.metadata.namespace}{'|'}{.metadata.name}{'\\n'}{end}"])
        if result.returncode != 0:
            continue
        for line in result.stdout.splitlines():
            if "|" not in line:
                continue
            namespace, name = line.split("|", 1)
            if is_test_resource(name):
                actions.append(f"remove {kind}/{namespace}/{name}")
                if not dry_run:
                    runner(["kubectl", "delete", kind, name, "-n", namespace, "--ignore-not-found=true", "--wait=false"])
    return actions


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List matching resources without deleting them.")
    args = parser.parse_args()
    actions = cleanup_resources(dry_run=args.dry_run)
    print("\n".join(actions) if actions else "No resilience test resources found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
