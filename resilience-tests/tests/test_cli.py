import run_all_tests
from run_all_tests import PDF_SCENARIOS, main, planned_campaign
from test_runner import result_template


def test_campaign_plan_size() -> None:
    assert len(planned_campaign("swarm", "container-kill", 2)) == 2


def test_default_both_platform_campaign_contains_twelve_tests() -> None:
    assert len(planned_campaign(None, None, 1)) == 12


def test_default_campaign_is_exactly_the_pdf_scenarios() -> None:
    assert [scenario for _, scenario, _ in planned_campaign("swarm", None, 1)] == list(PDF_SCENARIOS)


def test_dry_run_is_successful_and_non_destructive(capsys) -> None:
    assert main(["--platform", "kubernetes", "--scenario", "container-kill", "--dry-run"]) == 0
    output = capsys.readouterr().out
    assert "SKIPPED" in output
    assert "no Docker or Kubernetes command was executed" in output


def test_failed_scenario_does_not_stop_remaining_suite(tmp_path, monkeypatch) -> None:
    calls: list[str] = []

    def fake_execute(platform: str, scenario: str, repetition: int, **_kwargs):
        calls.append(scenario)
        record = result_template(platform, scenario, repetition)
        record.update(status="FAIL" if len(calls) == 1 else "PASS", timestamp_end="now", total_test_duration_seconds=0)
        return record

    monkeypatch.setattr(run_all_tests, "execute", fake_execute)
    monkeypatch.setattr(run_all_tests, "ROOT", tmp_path)
    monkeypatch.setattr(run_all_tests, "start_session", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(run_all_tests, "save_session_records", lambda *_args, **_kwargs: None)
    assert main(["--platform", "swarm", "--repetitions", "1"]) == 1
    assert calls == list(PDF_SCENARIOS)
