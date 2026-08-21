"""Docker Swarm adapter exported for integrations and tests."""

from test_runner import Platform, swarm_state


def create_swarm_platform(*, dry_run: bool = False) -> Platform:
    return Platform("swarm", dry_run=dry_run)


__all__ = ["create_swarm_platform", "swarm_state"]
