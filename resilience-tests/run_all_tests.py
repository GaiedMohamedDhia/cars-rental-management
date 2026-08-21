"""Execute the six proposal scenarios and persist real outcomes and diagnostics."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import time
import threading
from typing import Any
from uuid import uuid4

from src.result_writer import write_csv, write_csv_with_fields, write_json
from src.session_store import acquire_campaign_lock, new_session_id, release_campaign_lock, save_session_records, set_state, start_session
from test_runner import PDF_SCENARIOS, error_record, execute, fail, result_template

ROOT = Path(__file__).resolve().parent
PLATFORMS = ("swarm", "kubernetes")
SCENARIOS = PDF_SCENARIOS
_PERSIST_LOCK = threading.Lock()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TuniCars+ Resilience Testing Framework")
    parser.add_argument("--platform", choices=PLATFORMS)
    parser.add_argument("--scenario", choices=SCENARIOS)
    parser.add_argument("--repetitions", type=int, default=1)
    parser.add_argument("--non-interactive", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    return parser


def planned_campaign(platform: str | None, scenario: str | None, repetitions: int) -> list[tuple[str, str, int]]:
    if repetitions < 1:
        raise ValueError("repetitions must be at least 1")
    platforms = (platform,) if platform else PLATFORMS
    scenarios = (scenario,) if scenario else PDF_SCENARIOS
    return [(selected_platform, selected_scenario, repetition) for selected_platform in platforms for selected_scenario in scenarios for repetition in range(1, repetitions + 1)]


def persist(records: list[dict[str, Any]]) -> None:
    """Atomically upsert a partial or complete session under a process lock."""
    unique: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    for record in records:
        key = (
            str(record.get("session_id", "")), str(record.get("platform", "")),
            str(record.get("scenario", "")), str(record.get("repetition", "")),
        )
        unique[key] = record
    with _PERSIST_LOCK:
        _persist_unlocked(list(unique.values()))


def save_result(record: dict[str, Any]) -> None:
    """Upsert one completed scenario while retaining prior rows in its session."""
    with _PERSIST_LOCK:
        history_path = ROOT / "results" / "raw" / "all_results.json"
        session_id = str(record.get("session_id", ""))
        current: list[dict[str, Any]] = []
        if history_path.exists():
            try:
                loaded = json.loads(history_path.read_text(encoding="utf-8"))
                current = [item for item in loaded if isinstance(item, dict) and str(item.get("session_id", "")) == session_id]
            except (OSError, json.JSONDecodeError):
                current = []
        key = lambda item: (str(item.get("session_id", "")), str(item.get("platform", "")), str(item.get("scenario", "")), str(item.get("repetition", "")))
        merged = {key(item): item for item in current}
        merged[key(record)] = record
        _persist_unlocked(list(merged.values()))


def _persist_unlocked(records: list[dict[str, Any]]) -> None:
    raw = ROOT / "results" / "raw"
    logs = ROOT / "results" / "logs"
    errors = [entry for record in records if (entry := error_record(record)) is not None]
    warnings = [{
        "timestamp": record["timestamp_end"], "session_id": record.get("session_id", ""), "platform": record["platform"],
        "scenario": record["scenario"], "type": "SKIPPED",
        "message": record["skip_reason"],
    } for record in records if record["status"] == "SKIPPED"]
    clean_records = [{key: value for key, value in record.items() if not key.startswith("_")} for record in records]
    history_path = raw / "all_results.json"
    previous: list[dict[str, Any]] = []
    if history_path.exists():
        try:
            loaded = json.loads(history_path.read_text(encoding="utf-8"))
            if isinstance(loaded, list):
                previous = [item for item in loaded if isinstance(item, dict)]
        except (OSError, json.JSONDecodeError):
            previous = []
    current_sessions = {str(record.get("session_id", "")) for record in clean_records}
    previous = [record for record in previous if str(record.get("session_id", "")) not in current_sessions]
    all_records = previous + clean_records
    write_csv(raw / "all_results.csv", all_records)
    write_json(history_path, all_records)
    error_history_path = logs / "errors.json"
    previous_errors: list[dict[str, Any]] = []
    if error_history_path.exists():
        try:
            loaded_errors = json.loads(error_history_path.read_text(encoding="utf-8"))
            if isinstance(loaded_errors, list):
                previous_errors = [item for item in loaded_errors if isinstance(item, dict)]
        except (OSError, json.JSONDecodeError):
            previous_errors = []
    previous_errors = [item for item in previous_errors if str(item.get("session_id", "")) not in current_sessions]
    all_errors = previous_errors + errors
    write_json(error_history_path, all_errors)
    write_csv_with_fields(logs / "errors.csv", all_errors, ("timestamp", "session_id", "platform", "scenario", "command", "exit_code", "stdout", "stderr", "error_type", "error_message", "suggested_solution"))
    write_json(logs / "warnings.json", warnings)
    write_csv_with_fields(logs / "warnings.csv", warnings, ("timestamp", "session_id", "platform", "scenario", "type", "message"))
    latest_error = logs / "latest_error.log"
    if errors:
        latest_error.parent.mkdir(parents=True, exist_ok=True)
        latest_error.write_text("\n\n".join(f"[{item['timestamp']}] {item['platform']} {item['scenario']}\n{item['error_type']}: {item['error_message']}\nCommand: {item['command']}\nSolution: {item['suggested_solution']}" for item in errors) + "\n", encoding="utf-8")
    elif latest_error.exists():
        latest_error.unlink()


def main(argv: list[str] | None = None, *, forced_platform: str | None = None) -> int:
    args = build_parser().parse_args(argv)
    platform = forced_platform or args.platform
    try:
        plan = planned_campaign(platform, args.scenario, args.repetitions)
    except ValueError as exc:
        print(f"[ERROR] {exc}")
        return 2
    if not args.dry_run:
        try: acquire_campaign_lock()
        except RuntimeError as exc:
            print(f"[ERROR] {exc}"); return 2
    print(f"[RUNNING] Campaign contains {len(plan)} execution(s).")
    session_id = new_session_id()
    if not args.dry_run:
        labels = ["Docker Swarm" if name == "swarm" else "Kubernetes" for name in dict.fromkeys(item[0] for item in plan)]
        start_session(session_id, platforms=labels, total=len(plan))
    records: list[dict[str, Any]] = []
    for index, (selected_platform, scenario, repetition) in enumerate(plan, 1):
        print(f"[RUNNING] {index}/{len(plan)} {selected_platform} {scenario} repetition {repetition}")
        try:
            record = execute(selected_platform, scenario, repetition, dry_run=args.dry_run)
        except Exception as exc:
            record = fail(result_template(selected_platform, scenario, repetition), exc, time.monotonic())
        record["session_id"] = session_id
        records.append(record)
        detail = record.get("skip_reason") or record.get("error_message") or record.get("notes") or "completed"
        print(f"[{record['status']}] {selected_platform}:{scenario} - {detail}")
        if not args.dry_run:
            try:
                save_session_records(records, session_id=session_id)
                persist(records)
            except Exception as exc:
                print(f"[ERROR] Could not persist the latest scenario result: {exc}")
    if args.dry_run:
        print(f"[OK] All {len(plan)} planned proposal routes validated; no Docker or Kubernetes command was executed.")
        return 0
    artifact_status = {"charts": "Not generated", "report": "Not generated"}
    try:
        save_session_records(records, finished=True, session_id=session_id)
        persist(records)
        set_state("COMPLETED", session_id)
    except Exception as exc:
        print(f"[ERROR] Final result persistence failed: {type(exc).__name__}: {exc}")
        try: set_state("FAILED", session_id)
        except Exception: pass
    try:
        from generate_charts import generate_current_session_charts
        charts = generate_current_session_charts(session_id)
        artifact_status["charts"] = f"Generated ({len(charts)})"
        print(f"[ARTIFACT] Charts: {artifact_status['charts']}")
    except Exception as exc:
        artifact_status["charts"] = f"Failed: {type(exc).__name__}: {exc}"
        print(f"[ERROR] CHART GENERATION FAILURE: {artifact_status['charts']}")
    try:
        from generate_report import generate_current_session_report
        report = generate_current_session_report(session_id)
        if not report.exists() or report.stat().st_size <= 0: raise OSError("generated PDF is missing or empty")
        artifact_status["report"] = f"Generated ({report.stat().st_size} bytes)"
        print(f"[ARTIFACT] Report: {artifact_status['report']}")
    except Exception as exc:
        artifact_status["report"] = f"Failed: {type(exc).__name__}: {exc}"
        print(f"[ERROR] REPORT GENERATION FAILURE: {artifact_status['report']}")
    counts = {status: sum(record["status"] == status for record in records) for status in ("PASS", "FAIL", "SKIPPED")}
    print(f"Summary: PASS={counts['PASS']} FAIL={counts['FAIL']} SKIPPED={counts['SKIPPED']}")
    print(f"Results: {ROOT / 'results' / 'current'}")
    release_campaign_lock()
    return 1 if counts["FAIL"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
