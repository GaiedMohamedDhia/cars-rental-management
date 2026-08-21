"""Isolated Toxiproxy lifecycle and API helpers for resilience scenarios."""

from __future__ import annotations

from dataclasses import dataclass
import json
import re
import time
from typing import Any, Callable
from urllib.parse import urlsplit, urlunsplit

import requests


TOXIPROXY_IMAGE = "ghcr.io/shopify/toxiproxy:2.9.0"


def validate_json_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Fail clearly before an invalid payload reaches an external API."""
    try:
        json.dumps(payload, ensure_ascii=False)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Payload is not JSON serializable: {exc}") from exc
    return payload


def proxy_payload(name: str, listen: str, upstream: str) -> dict[str, Any]:
    return validate_json_payload({"name": name, "listen": listen, "upstream": upstream, "enabled": True})


def latency_toxic_payload(latency_ms: int, jitter_ms: int) -> dict[str, Any]:
    return validate_json_payload({
        "name": "latency", "type": "latency", "stream": "downstream", "toxicity": 1.0,
        "attributes": {"latency": latency_ms, "jitter": jitter_ms},
    })


def kubernetes_environment_patch(container_name: str, environment: list[dict[str, Any]]) -> dict[str, Any]:
    return validate_json_payload({
        "spec": {"template": {"spec": {"containers": [{"name": container_name, "env": environment}]}}},
    })


def write_json_payload(path, payload: dict[str, Any]) -> None:
    """Write UTF-8 JSON without shell quoting or manual escaping."""
    with path.open("w", encoding="utf-8", newline="\n") as stream:
        json.dump(validate_json_payload(payload), stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def resource_name(platform: str, session_id: str, timestamp: int | None = None) -> str:
    """Return a DNS-safe, collision-resistant temporary resource name."""
    stamp = timestamp if timestamp is not None else int(time.time())
    token = re.sub(r"[^a-z0-9]", "", session_id.lower())[:8] or "session"
    return f"rt-toxiproxy-{platform}-{token}-{stamp}"[:63].rstrip("-")


def replace_database_host(database_url: str, host: str, port: int = 5433) -> str:
    """Reroute a PostgreSQL URL while preserving credentials, database and options."""
    parsed = urlsplit(database_url)
    if not parsed.scheme or not parsed.hostname:
        raise ValueError("DATABASE_URL is not a valid absolute database URL")
    userinfo = ""
    if parsed.username is not None:
        userinfo = parsed.username
        if parsed.password is not None:
            userinfo += f":{parsed.password}"
        userinfo += "@"
    return urlunsplit((parsed.scheme, f"{userinfo}{host}:{port}", parsed.path, parsed.query, parsed.fragment))


def environment_value(environment: list[str], key: str) -> str | None:
    prefix = f"{key}="
    return next((item[len(prefix):] for item in environment if item.startswith(prefix)), None)


def replace_environment_value(environment: list[str], key: str, value: str | None) -> list[str]:
    """Replace one environment entry without changing unrelated variables."""
    prefix = f"{key}="
    result = [item for item in environment if not item.startswith(prefix)]
    if value is not None:
        result.append(f"{key}={value}")
    return result


@dataclass
class ToxiproxyClient:
    base_url: str
    timeout: float = 5.0
    session: requests.Session | None = None

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        if payload is not None:
            validate_json_payload(payload)
        client = self.session or requests
        response = client.request(method, f"{self.base_url.rstrip('/')}{path}", json=payload, timeout=self.timeout)
        response.raise_for_status()
        if not response.content:
            return {}
        return response.json()

    def wait_for_api(self, timeout_seconds: float = 30) -> None:
        deadline = time.monotonic() + timeout_seconds
        last_error: Exception | None = None
        while time.monotonic() < deadline:
            try:
                self._request("GET", "/version")
                return
            except (requests.RequestException, ValueError) as exc:
                last_error = exc
                time.sleep(0.5)
        raise RuntimeError(f"Toxiproxy API did not become ready: {last_error}")

    def create_proxy(self, name: str, listen: str, upstream: str) -> dict[str, Any]:
        return self._request("POST", "/proxies", proxy_payload(name, listen, upstream))

    def get_proxy(self, name: str) -> dict[str, Any]:
        return self._request("GET", f"/proxies/{name}")

    def proxy_is_enabled(self, name: str, expected: bool) -> bool:
        return self.get_proxy(name).get("enabled") is expected

    def latency_toxic_is_present(self, name: str, latency_ms: int, jitter_ms: int) -> bool:
        toxics = self.get_proxy(name).get("toxics") or []
        return any(
            toxic.get("name") == "latency"
            and toxic.get("type") == "latency"
            and int((toxic.get("attributes") or {}).get("latency", -1)) == latency_ms
            and int((toxic.get("attributes") or {}).get("jitter", -1)) == jitter_ms
            for toxic in toxics
        )

    def set_enabled(self, name: str, enabled: bool) -> dict[str, Any]:
        try:
            result = self._request("POST", f"/proxies/{name}", {"enabled": enabled})
        except requests.Timeout:
            # The control request may have been applied even when its response
            # missed the client deadline. Confirm state before retrying it.
            if self.proxy_is_enabled(name, enabled):
                return self.get_proxy(name)
            result = self._request("POST", f"/proxies/{name}", {"enabled": enabled})
        if not self.proxy_is_enabled(name, enabled):
            raise RuntimeError(f"Toxiproxy did not persist enabled={enabled} for proxy {name!r}")
        return result

    def enable_proxy(self, name: str) -> dict[str, Any]:
        return self.set_enabled(name, True)

    def disable_proxy(self, name: str) -> dict[str, Any]:
        return self.set_enabled(name, False)

    def add_latency_toxic(self, proxy: str, latency_ms: int, jitter_ms: int) -> dict[str, Any]:
        return self._request("POST", f"/proxies/{proxy}/toxics", latency_toxic_payload(latency_ms, jitter_ms))

    def remove_latency_toxic(self, proxy: str) -> dict[str, Any]:
        try:
            result = self._request("DELETE", f"/proxies/{proxy}/toxics/latency")
        except requests.Timeout:
            # DELETE is idempotent from the scenario's perspective. A timeout
            # is successful if the API confirms that the toxic is now absent.
            if not any(toxic.get("name") == "latency" for toxic in (self.get_proxy(proxy).get("toxics") or [])):
                return {}
            result = self._request("DELETE", f"/proxies/{proxy}/toxics/latency")
        if any(toxic.get("name") == "latency" for toxic in (self.get_proxy(proxy).get("toxics") or [])):
            raise RuntimeError(f"Latency toxic remained active on proxy {proxy!r}")
        return result


def kubernetes_manifest(name: str, namespace: str, api_port: int = 8474, proxy_port: int = 5433) -> dict[str, Any]:
    """Build temporary Deployment and Service resources without touching global networking."""
    labels = {"app": name, "managed-by": "tun icars-resilience".replace(" ", "-")}
    deployment = {
        "apiVersion": "apps/v1",
        "kind": "Deployment",
        "metadata": {"name": name, "namespace": namespace, "labels": labels},
        "spec": {
            "replicas": 1,
            "selector": {"matchLabels": {"app": name}},
            "template": {
                "metadata": {"labels": labels},
                "spec": {
                    "containers": [{
                        "name": "toxiproxy", "image": TOXIPROXY_IMAGE,
                        "ports": [{"name": "api", "containerPort": api_port}, {"name": "postgres", "containerPort": proxy_port}],
                        "readinessProbe": {
                            "httpGet": {"path": "/version", "port": "api"},
                            "initialDelaySeconds": 1, "periodSeconds": 1,
                            "timeoutSeconds": 1, "failureThreshold": 30,
                        },
                        "resources": {"requests": {"cpu": "25m", "memory": "32Mi"}, "limits": {"cpu": "250m", "memory": "128Mi"}},
                    }],
                },
            },
        },
    }
    service = {
        "apiVersion": "v1", "kind": "Service", "metadata": {"name": name, "namespace": namespace, "labels": labels},
        "spec": {"selector": {"app": name}, "ports": [{"name": "api", "port": api_port, "targetPort": api_port}, {"name": "postgres", "port": proxy_port, "targetPort": proxy_port}]},
    }
    return {"apiVersion": "v1", "kind": "List", "items": [deployment, service]}
