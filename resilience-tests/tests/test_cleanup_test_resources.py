"""Safety tests for resilience-only cleanup."""

from __future__ import annotations

import subprocess

from cleanup_test_resources import cleanup_resources, is_test_resource


def test_allow_list_never_matches_application_resources() -> None:
    assert is_test_resource("rt-toxiproxy-swarm-123")
    assert is_test_resource("tunicars-cpu-stress-123")
    assert not is_test_resource("cars-rental_backend")
    assert not is_test_resource("cars-rental-db")
    assert not is_test_resource("minikube")


def test_cleanup_removes_only_prefixed_resources() -> None:
    calls: list[list[str]] = []

    def runner(command: list[str]) -> subprocess.CompletedProcess[str]:
        calls.append(command)
        stdout = ""
        if command[:3] == ["docker", "service", "ls"]:
            stdout = "cars-rental_backend\nrt-toxiproxy-test\n"
        elif command[:3] == ["docker", "ps", "-a"]:
            stdout = "cars-rental-db\ntunicars-memory-stress-abc\n"
        return subprocess.CompletedProcess(command, 0, stdout, "")

    actions = cleanup_resources(runner=runner)
    assert "remove rt-toxiproxy-test" in actions
    assert "remove tunicars-memory-stress-abc" in actions
    removals = [command for command in calls if command[:3] in (["docker", "service", "rm"], ["docker", "rm", "-f"])]
    assert all("cars-rental" not in " ".join(command) for command in removals)
