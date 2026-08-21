import csv

from src.result_writer import write_csv


def test_csv_result_writing(tmp_path) -> None:
    destination = tmp_path / "raw" / "results.csv"
    write_csv(destination, [{"scenario": "cpu", "recovery_time_seconds": None}])
    with destination.open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    assert rows == [{"scenario": "cpu", "recovery_time_seconds": ""}]


def test_csv_writer_accepts_historical_and_new_metric_schemas(tmp_path) -> None:
    destination = tmp_path / "raw" / "results.csv"
    write_csv(destination, [
        {"session_id": "old", "scenario": "cpu", "status": "PASS"},
        {"session_id": "new", "scenario": "latency", "status": "PASS", "injection_method": "Toxiproxy", "restoration_success": True},
    ])
    with destination.open(encoding="utf-8", newline="") as stream:
        reader = csv.DictReader(stream); rows = list(reader)
    assert reader.fieldnames == ["session_id", "scenario", "status", "injection_method", "restoration_success"]
    assert rows[0]["injection_method"] == ""
    assert rows[1]["injection_method"] == "Toxiproxy"
