import resilience_gui
from src.command_runner import CommandResult
import run_all_tests
from run_all_tests import PDF_SCENARIOS, planned_campaign
from test_runner import result_template


def test_default_campaign_contains_only_pdf_scenarios() -> None:
    plan = planned_campaign("swarm", None, 1)
    assert [scenario for _, scenario, _ in plan] == list(PDF_SCENARIOS)


def test_gui_scenarios_match_pdf_scenarios() -> None:
    selected = {scenario for scenario in resilience_gui.SCENARIOS.values() if scenario}
    assert selected == set(PDF_SCENARIOS)


def test_both_platform_plan_contains_twelve_tests_in_required_order() -> None:
    plan = resilience_gui.suite_plan("Both", list(PDF_SCENARIOS))
    assert len(plan) == 12
    assert plan[:6] == [("swarm", scenario) for scenario in PDF_SCENARIOS]
    assert plan[6:] == [("kubernetes", scenario) for scenario in PDF_SCENARIOS]


def test_final_status_does_not_depend_on_process_exit_code() -> None:
    assert resilience_gui.final_suite_status(["PASS", "SKIPPED"]) == "Finished — PASS"
    assert resilience_gui.final_suite_status(["PASS", "FAIL"]) == "Finished — MIXED RESULTS"
    assert resilience_gui.final_suite_status(["FAIL", "SKIPPED"]) == "Finished — FAIL"
    assert resilience_gui.final_suite_status(["PASS"], cancelled=True) == "Finished — CANCELLED"


def test_results_columns_have_required_visible_order() -> None:
    assert [name for name, _ in resilience_gui.RESULT_COLUMNS] == [
        "scenario", "platform", "detection_time_seconds", "recovery_time_seconds",
        "recovery_required", "recovery_success", "average_response_time_ms",
        "p95_response_time_ms", "baseline_average_response_time_ms",
        "injected_average_response_time_ms", "injection_confirmed",
        "degradation_observed", "restoration_success",
        "maximum_cpu_percent", "maximum_memory_mb",
        "http_success_count", "http_failure_count", "availability_percent",
        "status", "skip_reason", "error_message",
    ]


def test_latest_session_rows_filters_previous_campaigns() -> None:
    rows = [
        {"session_id": "old", "scenario": "cpu"},
        {"session_id": "new", "scenario": "cpu"},
        {"session_id": "new", "scenario": "memory"},
    ]
    assert resilience_gui.latest_session_rows(rows) == rows[1:]


def test_latest_session_filter_also_applies_to_error_rows() -> None:
    errors = [
        {"session_id": "old", "error_message": "old failure"},
        {"session_id": "new", "error_message": "current failure"},
    ]
    assert resilience_gui.latest_session_rows(errors) == [errors[-1]]


def test_active_empty_session_never_falls_back_to_old_cancelled_row() -> None:
    old = [{"session_id": "old", "status": "CANCELLED", "scenario": "cpu"}]
    assert resilience_gui.select_session_rows(old, session_id="current", allow_latest_fallback=False) == []
    assert resilience_gui.select_session_rows(old, session_id="current", allow_latest_fallback=False, show_all=True) == old


def test_partial_current_session_grows_one_row_at_a_time() -> None:
    rows = [{"session_id": "old", "status": "CANCELLED", "scenario": "cpu"}]
    assert resilience_gui.select_session_rows(rows, session_id="new", allow_latest_fallback=False) == []
    rows.append({"session_id": "new", "status": "PASS", "scenario": "container-kill"})
    assert len(resilience_gui.select_session_rows(rows, session_id="new", allow_latest_fallback=False)) == 1
    rows.append({"session_id": "new", "status": "SKIPPED", "scenario": "node-failure"})
    selected = resilience_gui.select_session_rows(rows, session_id="new", allow_latest_fallback=False)
    assert [row["scenario"] for row in selected] == ["container-kill", "node-failure"]
    rows.append({"session_id": "new", "status": "PASS", "scenario": "cpu"})
    assert len(resilience_gui.select_session_rows(rows, session_id="new", allow_latest_fallback=False)) == 3


def test_incremental_persistence_upserts_without_duplicates(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(run_all_tests, "ROOT", tmp_path)
    old = result_template("swarm", "cpu", 1); old.update(session_id="old", status="CANCELLED")
    run_all_tests.persist([old])
    current_one = result_template("swarm", "container-kill", 1); current_one.update(session_id="new", status="PASS")
    run_all_tests.persist([current_one])
    rows = resilience_gui.read_csv_rows(tmp_path / "results" / "raw" / "all_results.csv")
    assert len(resilience_gui.select_session_rows(rows, session_id="new", allow_latest_fallback=False)) == 1
    current_two = result_template("swarm", "node-failure", 1); current_two.update(session_id="new", status="SKIPPED")
    run_all_tests.persist([current_one, current_two])
    run_all_tests.persist([current_one, current_two])
    rows = resilience_gui.read_csv_rows(tmp_path / "results" / "raw" / "all_results.csv")
    selected = resilience_gui.select_session_rows(rows, session_id="new", allow_latest_fallback=False)
    assert len(selected) == 2
    assert len({(row["session_id"], row["platform"], row["scenario"], row["repetition"]) for row in selected}) == 2


def test_save_result_progressively_keeps_prior_current_session_rows(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(run_all_tests, "ROOT", tmp_path)
    for expected, scenario in enumerate(("container-kill", "node-failure", "cpu"), 1):
        record = result_template("kubernetes", scenario, 1)
        record.update(session_id="active", status="PASS")
        run_all_tests.save_result(record)
        rows = resilience_gui.read_csv_rows(tmp_path / "results" / "raw" / "all_results.csv")
        assert len(resilience_gui.select_session_rows(rows, session_id="active", allow_latest_fallback=False)) == expected


def test_successful_latest_session_can_hide_all_historical_errors() -> None:
    results = [{"session_id": "failed"}, {"session_id": "successful"}]
    errors = [{"session_id": "failed", "error_message": "old failure"}]
    current = resilience_gui.latest_session_id(results)
    assert [row for row in errors if row.get("session_id") == current] == []


def test_readable_current_csv_headers_are_normalized_for_gui(tmp_path) -> None:
    path=tmp_path/"results.csv"
    path.write_text("Session ID,Platform,Scenario,Status,HTTP Failures\nactive,swarm,cpu,PASS,0\n",encoding="utf-8")
    row=resilience_gui.read_csv_rows(path)[0]
    assert row["session_id"]=="active" and row["scenario"]=="cpu" and row["status"]=="PASS"


def test_terminal_session_state_is_explicit() -> None:
    assert resilience_gui.terminal_session_state(["PASS","SKIPPED"])=="COMPLETED"
    assert resilience_gui.terminal_session_state(["PASS","FAIL"])=="FAILED"
    assert resilience_gui.terminal_session_state([],cancelled=True)=="CANCELLED"
    assert resilience_gui.terminal_session_state([], expected_total=12)=="FAILED"
    assert resilience_gui.terminal_session_state(["PASS"] * 11, expected_total=12)=="FAILED"
    assert resilience_gui.terminal_session_state(["PASS"] * 12, expected_total=12)=="COMPLETED"


def test_suite_counters_are_rebuilt_from_persisted_rows() -> None:
    rows = [
        {"status": "PASS"}, {"status": "PASS"}, {"status": "FAIL"},
        {"status": "SKIPPED"},
    ]
    assert resilience_gui.suite_counts_from_rows(rows) == {
        "completed": 4, "passed": 2, "failed": 1,
        "skipped": 1, "cancelled": 0,
    }


def test_unique_session_rows_replaces_duplicate_scenario_result() -> None:
    rows = [
        {"session_id": "s", "platform": "swarm", "scenario": "cpu", "status": "FAIL"},
        {"session_id": "s", "platform": "swarm", "scenario": "cpu", "status": "PASS"},
        {"session_id": "s", "platform": "kubernetes", "scenario": "cpu", "status": "PASS"},
    ]
    selected = resilience_gui.unique_session_rows(rows)
    assert len(selected) == 2
    assert selected[0]["status"] == "PASS"


def test_kubernetes_health_uses_api_proxy_and_retries_transient_error() -> None:
    calls = []
    def runner(command, **_kwargs):
        calls.append(command)
        if len(calls) == 1:
            return CommandResult(tuple(command), 1, stderr="tls handshake timeout")
        return CommandResult(tuple(command), 0, '{"status":"healthy"}')
    assert resilience_gui.kubernetes_backend_healthy(runner, attempts=2)
    assert len(calls) == 2
    assert "services/backend:8000/proxy/health" in calls[-1][-1]
