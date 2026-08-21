import json

from src.result_writer import write_json


def test_json_result_writing(tmp_path) -> None:
    destination = tmp_path / "raw" / "results.json"
    write_json(destination, [{"platform": "kubernetes", "status": "SKIPPED"}])
    assert json.loads(destination.read_text(encoding="utf-8"))[0]["status"] == "SKIPPED"
