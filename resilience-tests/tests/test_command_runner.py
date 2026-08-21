import sys
import threading
import pytest

from src.command_runner import CommandResult, parse_json_output, redact_secrets, run_command, safe_stdout


def test_dry_run_does_not_execute_command() -> None:
    result = run_command(["not-a-real-command", "--flag"], dry_run=True)
    assert result.returncode == 0
    assert result.dry_run is True
    assert result.stdout.startswith("[DRY-RUN]")


def test_secret_redaction() -> None:
    redacted = redact_secrets("token=abc123 password:hello Authorization=BearerSecret SECRET_KEY=private-value")
    assert "abc123" not in redacted
    assert "hello" not in redacted
    assert "BearerSecret" not in redacted
    assert "private-value" not in redacted
    assert redacted.count("[REDACTED]") == 4


def test_command_result_contains_readable_return_code_metadata() -> None:
    result = run_command([sys.executable, "-c", "raise SystemExit(7)"])
    assert result.returncode == 7
    assert result.raw_returncode == 7
    assert result.hexadecimal_returncode == "0x00000007"
    assert result.duration_seconds >= 0


def test_running_process_can_be_cancelled() -> None:
    cancelled = threading.Event()
    timer = threading.Timer(0.2, cancelled.set)
    timer.start()
    try:
        result = run_command([sys.executable, "-c", "import time; time.sleep(10)"], cancel_event=cancelled, timeout_seconds=15)
    finally:
        timer.cancel()
    assert result.returncode == 130


def test_json_parser_uses_stdout_only_when_stderr_contains_warning() -> None:
    result = CommandResult(("docker", "inspect"), 0, stdout='{"value":"ok"}', stderr="warning: daemon message")
    assert parse_json_output(result, "docker inspect") == {"value": "ok"}


def test_json_parser_handles_unicode_quotes_and_windows_paths() -> None:
    raw = '{"text":"Réparation \\"urgente\\"","path":"C:\\\\Temp\\\\résultat.json"}'
    result = CommandResult(("kubectl", "get"), 0, stdout=raw)
    parsed = parse_json_output(result, "kubectl get")
    assert parsed["text"] == 'Réparation "urgente"'
    assert parsed["path"] == "C:\\Temp\\résultat.json"


def test_json_parser_rejects_empty_and_malformed_output_with_diagnostics() -> None:
    with pytest.raises(ValueError, match="empty JSON output"):
        parse_json_output(CommandResult(("docker", "inspect"), 0, stdout="  "), "docker inspect")
    logs = []
    with pytest.raises(ValueError, match="line 1, column"):
        parse_json_output(CommandResult(("docker", "inspect"), 0, stdout='{"secret":"unterminated}'), "docker inspect", logs.append)
    assert any("Parse error line:" in line for line in logs)
    assert any("Parse error column:" in line for line in logs)


def test_raw_json_remains_parseable_while_logged_output_masks_secrets() -> None:
    script = 'print(\'{"DATABASE_URL":"postgresql://user:p%22ass@database:5432/cars","SECRET_KEY":"private"}\')'
    result = run_command([sys.executable, "-c", script])
    assert parse_json_output(result, "python json")["SECRET_KEY"] == "private"
    assert "private" not in safe_stdout(result)
    assert "p%22ass" not in safe_stdout(result)
