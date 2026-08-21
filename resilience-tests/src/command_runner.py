"""Safe, shell-free command execution with dry-run and secret redaction."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import os
import queue
import re
import subprocess
import threading
import time
from typing import Callable, MutableMapping, Sequence


@dataclass(frozen=True)
class CommandResult:
    """Normalized outcome of a command invocation."""

    args: tuple[str, ...]
    returncode: int
    stdout: str = ""
    stderr: str = ""
    safe_stdout: str = ""
    safe_stderr: str = ""
    dry_run: bool = False
    duration_seconds: float = 0.0
    raw_returncode: int = 0
    hexadecimal_returncode: str = "0x00000000"


def redact_secrets(value: str) -> str:
    """Mask common credential forms before a value reaches logs."""

    redacted = re.sub(
        r'(?i)("(?:password|secret(?:_key)?|token|authorization|access_token|refresh_token)[A-Z0-9_]*"\s*:\s*")([^"]*)(")',
        r'\1[REDACTED]\3',
        value,
    )
    redacted = re.sub(
        r"(?i)((?:password|secret(?:_key)?|token|authorization|access_token|refresh_token)[A-Z0-9_]*)(\s*[=:]\s*)([^\s]+)",
        r"\1\2[REDACTED]",
        redacted,
    )
    redacted = re.sub(
        r"(?i)(bearer\s+)([A-Za-z0-9._~+/-]+)",
        r"\1[REDACTED]",
        redacted,
    )
    redacted = re.sub(
        r"(?i)([a-z][a-z0-9+.-]*://[^\s:/@]+:)([^\s@]+)(@)",
        r"\1[REDACTED]\3",
        redacted,
    )
    return redacted


def format_command(args: Sequence[str]) -> str:
    """Return a readable, redacted representation without shell quoting semantics."""

    return redact_secrets(" ".join(str(part) for part in args))


def safe_stdout(result: CommandResult) -> str:
    return result.safe_stdout or redact_secrets(result.stdout)


def safe_stderr(result: CommandResult) -> str:
    return result.safe_stderr or redact_secrets(result.stderr)


def parse_json_output(result: CommandResult, command_name: str, logger: Callable[[str], None] | None = None):
    """Parse stdout only, with redacted diagnostics and no stderr contamination."""
    command = format_command(result.args) or command_name
    raw = result.stdout.strip()
    if logger:
        logger(f"[JSON] Command: {command}")
        logger(f"[JSON] Stdout length: {len(raw)}")
        logger(f"[JSON] Stdout preview: {redact_secrets(raw[:300])}")
    if result.returncode != 0:
        raise ValueError(f"{command_name} failed with exit code {result.returncode}: {safe_stderr(result) or safe_stdout(result)}")
    if not raw:
        raise ValueError(f"{command_name} returned empty JSON output")
    if raw[0] not in "[{":
        raise ValueError(f"{command_name} returned non-JSON stdout; first character is {raw[0]!r}")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        if logger:
            logger(f"[JSON] Parse error line: {exc.lineno}")
            logger(f"[JSON] Parse error column: {exc.colno}")
        raise ValueError(f"{command_name} returned malformed JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc


def run_command(
    args: Sequence[str],
    *,
    dry_run: bool = False,
    timeout_seconds: float = 30,
    cwd: Path | None = None,
    cancel_event: threading.Event | None = None,
    on_output: Callable[[str], None] | None = None,
    process_holder: MutableMapping[str, subprocess.Popen[str] | None] | None = None,
) -> CommandResult:
    """Execute an argument vector safely, or return its dry-run representation."""

    normalized = tuple(str(part) for part in args)
    if not normalized:
        raise ValueError("Command arguments cannot be empty")
    if timeout_seconds <= 0:
        raise ValueError("timeout_seconds must be positive")
    if dry_run:
        return CommandResult(normalized, 0, stdout=f"[DRY-RUN] {format_command(normalized)}", dry_run=True)
    startupinfo = None
    creationflags = 0
    if os.name == "nt":
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        creationflags = subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP
    started = time.monotonic()
    process = subprocess.Popen(
        normalized, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", errors="replace", shell=False,
        startupinfo=startupinfo, creationflags=creationflags,
    )
    if process_holder is not None:
        process_holder["process"] = process
    stdout_lines: list[str] = []; stderr_lines: list[str] = []
    safe_stdout_lines: list[str] = []; safe_stderr_lines: list[str] = []
    output_queue: queue.Queue[tuple[str, str | None]] = queue.Queue()

    def reader(stream_name: str, stream) -> None:
        for line in stream:
            output_queue.put((stream_name, line))
        output_queue.put((stream_name, None))

    assert process.stdout is not None and process.stderr is not None
    threading.Thread(target=reader, args=("stdout", process.stdout), daemon=True).start()
    threading.Thread(target=reader, args=("stderr", process.stderr), daemon=True).start()
    timed_out = False
    cancelled = False
    streams_finished = 0

    def terminate_owned_process_tree() -> None:
        if process.poll() is not None:
            return
        if os.name == "nt":
            subprocess.run(
                ["taskkill.exe", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                check=False, shell=False, creationflags=subprocess.CREATE_NO_WINDOW,
            )
        else:
            process.terminate()
    try:
        while process.poll() is None or streams_finished < 2:
            try:
                stream_name, line = output_queue.get(timeout=0.1)
                if line is None:
                    streams_finished += 1
                else:
                    cleaned = redact_secrets(line)
                    if stream_name == "stdout":
                        stdout_lines.append(line); safe_stdout_lines.append(cleaned)
                    else:
                        stderr_lines.append(line); safe_stderr_lines.append(cleaned)
                    if on_output:
                        on_output(cleaned.rstrip())
            except queue.Empty:
                pass
            if cancel_event and cancel_event.is_set() and process.poll() is None:
                cancelled = True
                terminate_owned_process_tree()
            if time.monotonic() - started > timeout_seconds and process.poll() is None:
                timed_out = True
                terminate_owned_process_tree()
            if (cancelled or timed_out) and process.poll() is None:
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
        returncode = process.wait()
    finally:
        if process_holder is not None and process_holder.get("process") is process:
            process_holder["process"] = None
    duration = time.monotonic() - started
    raw = int(returncode)
    unsigned = raw & 0xFFFFFFFF
    signed = unsigned - 0x100000000 if unsigned >= 0x80000000 else unsigned
    stdout = "".join(stdout_lines); stderr = "".join(stderr_lines)
    clean_stdout = "".join(safe_stdout_lines); clean_stderr = "".join(safe_stderr_lines)
    if timed_out:
        stderr += f"\nCommand timed out after {timeout_seconds} seconds."
        clean_stderr += f"\nCommand timed out after {timeout_seconds} seconds."
        signed = 124
    elif cancelled:
        stderr += "\nCommand cancelled by user."
        clean_stderr += "\nCommand cancelled by user."
        signed = 130
    return CommandResult(
        normalized, signed, stdout=stdout, stderr=stderr, safe_stdout=clean_stdout, safe_stderr=clean_stderr, duration_seconds=round(duration, 3),
        raw_returncode=raw, hexadecimal_returncode=f"0x{unsigned:08X}",
    )
