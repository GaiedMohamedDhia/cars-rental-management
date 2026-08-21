"""Atomic JSON and CSV persistence for already-collected result records."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any, Iterable, Mapping


def _atomic_text_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.replace(path)


def write_json(path: Path, records: Iterable[Mapping[str, Any]]) -> None:
    _atomic_text_write(path, json.dumps(list(records), ensure_ascii=False, indent=2) + "\n")


def write_csv(path: Path, records: Iterable[Mapping[str, Any]]) -> None:
    rows = list(records)
    if not rows:
        _atomic_text_write(path, "")
        return
    # Historical sessions may predate newly collected metrics. Build a stable
    # ordered union instead of rejecting newer rows with extra fields.
    fieldnames = list(dict.fromkeys(key for row in rows for key in row.keys()))
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames, extrasaction="raise")
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def write_csv_with_fields(path: Path, records: Iterable[Mapping[str, Any]], fieldnames: Iterable[str]) -> None:
    """Atomically write a CSV with a stable header even when there are no rows."""
    rows = list(records)
    fields = list(fieldnames)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="raise")
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)
