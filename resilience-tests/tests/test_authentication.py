"""Authentication tests for database-dependent resilience probes."""

from __future__ import annotations

import test_runner


class _Response:
    status_code = 200

    @staticmethod
    def json() -> dict[str, str]:
        return {"access_token": "temporary-secret-token"}


def test_explicit_token_has_priority(monkeypatch) -> None:
    monkeypatch.setenv("RESILIENCE_API_TOKEN", "explicit-token")
    monkeypatch.setenv("RESILIENCE_TEST_IDENTIFIER", "ignored")
    monkeypatch.setenv("RESILIENCE_TEST_PASSWORD", "ignored")
    monkeypatch.setattr(test_runner.requests, "post", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("login must not run")))
    assert test_runner._resilience_auth_headers("http://127.0.0.1:8000/health") == {"Authorization": "Bearer explicit-token"}


def test_credentials_obtain_and_cache_token_in_memory(monkeypatch) -> None:
    monkeypatch.delenv("RESILIENCE_API_TOKEN", raising=False)
    monkeypatch.setenv("RESILIENCE_TEST_IDENTIFIER", "resilience@example.test")
    monkeypatch.setenv("RESILIENCE_TEST_PASSWORD", "not-logged")
    test_runner._AUTH_TOKEN_CACHE.clear()
    calls: list[dict[str, object]] = []

    def post(_url: str, **kwargs):
        calls.append(kwargs)
        return _Response()

    monkeypatch.setattr(test_runner.requests, "post", post)
    first = test_runner._resilience_auth_headers("http://127.0.0.1:8000/health")
    second = test_runner._resilience_auth_headers("http://127.0.0.1:8000/health")
    assert first == second == {"Authorization": "Bearer temporary-secret-token"}
    assert len(calls) == 1


def test_missing_credentials_returns_no_headers(monkeypatch) -> None:
    for name in ("RESILIENCE_API_TOKEN", "RESILIENCE_TEST_IDENTIFIER", "RESILIENCE_TEST_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    test_runner._AUTH_TOKEN_CACHE.clear()
    assert test_runner._resilience_auth_headers("http://127.0.0.1:8000/health") is None


def test_database_probe_discovers_first_safe_success(monkeypatch) -> None:
    monkeypatch.setattr(test_runner, "_resilience_auth_headers", lambda _url: {"Authorization": "Bearer masked"})

    class Response:
        def __init__(self, status_code: int): self.status_code = status_code

    def get(url: str, **kwargs):
        if not kwargs.get("headers"):
            return Response(401)
        return Response(403 if url.endswith("/cars") else 200)

    monkeypatch.setattr(test_runner.requests, "get", get)
    path, url, headers = test_runner._discover_database_probe("http://127.0.0.1:8000/health", 1)
    assert path == "/renters"
    assert url.endswith("/renters")
    assert headers["Authorization"].startswith("Bearer ")


def test_database_probe_uses_public_route_without_requesting_auth(monkeypatch) -> None:
    monkeypatch.setattr(test_runner, "_resilience_auth_headers", lambda _url: (_ for _ in ()).throw(AssertionError("auth must not be requested")))

    class Response:
        status_code = 200

    monkeypatch.setattr(test_runner.requests, "get", lambda *_args, **_kwargs: Response())
    path, url, headers = test_runner._discover_database_probe("http://127.0.0.1:8000/health", 1)
    assert path == "/cars" and url.endswith("/cars") and headers == {}


def test_authentication_http_status_is_classified(monkeypatch) -> None:
    monkeypatch.delenv("RESILIENCE_API_TOKEN", raising=False)
    monkeypatch.setenv("RESILIENCE_TEST_IDENTIFIER", "user@example.test")
    monkeypatch.setenv("RESILIENCE_TEST_PASSWORD", "hidden")
    test_runner._AUTH_TOKEN_CACHE.clear()

    class Response:
        status_code = 401

    monkeypatch.setattr(test_runner.requests, "post", lambda *_args, **_kwargs: Response())
    try:
        test_runner._resilience_auth_headers("http://127.0.0.1:8000/health")
    except test_runner.ScenarioError as exc:
        assert exc.error_type == "AUTH_INVALID_CREDENTIALS"
    else:
        raise AssertionError("Expected classified authentication failure")


def test_authentication_unreachable_is_classified(monkeypatch) -> None:
    monkeypatch.delenv("RESILIENCE_API_TOKEN", raising=False)
    monkeypatch.setenv("RESILIENCE_TEST_IDENTIFIER", "user@example.test")
    monkeypatch.setenv("RESILIENCE_TEST_PASSWORD", "hidden")
    test_runner._AUTH_TOKEN_CACHE.clear()
    monkeypatch.setattr(test_runner.requests, "post", lambda *_args, **_kwargs: (_ for _ in ()).throw(test_runner.requests.ConnectionError()))
    try:
        test_runner._resilience_auth_headers("http://127.0.0.1:8000/health")
    except test_runner.ScenarioError as exc:
        assert exc.error_type == "AUTH_ENDPOINT_UNREACHABLE"
    else:
        raise AssertionError("Expected unreachable authentication failure")
def test_swarm_stack_rejects_an_empty_secret_key() -> None:
    stack = (test_runner.ROOT.parent / "docker-stack.yml").read_text(encoding="utf-8")
    assert "${SECRET_KEY:?SECRET_KEY must be set" in stack


def test_backend_dotenv_does_not_override_runtime_configuration() -> None:
    database = (test_runner.ROOT.parent / "backend" / "database.py").read_text(encoding="utf-8")
    assert "override=False" in database
    assert "pool_pre_ping=True" in database
    assert "pool_recycle=300" in database
