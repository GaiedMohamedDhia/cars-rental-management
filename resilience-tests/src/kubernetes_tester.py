"""Kubernetes adapter exported for integrations and tests."""

from test_runner import Platform, k8s_ready


def create_kubernetes_platform(*, dry_run: bool = False) -> Platform:
    return Platform("kubernetes", dry_run=dry_run)


__all__ = ["create_kubernetes_platform", "k8s_ready"]
