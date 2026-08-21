"""Remove only framework-owned temporary files and recorded subprocesses."""

from __future__ import annotations

import json
from pathlib import Path
import os
import signal

ROOT = Path(__file__).resolve().parent
STATE = ROOT / "results" / "processed" / "runtime_state.json"


def main() -> int:
    removed = 0
    if STATE.exists():
        try:
            state = json.loads(STATE.read_text(encoding="utf-8"))
            for pid in state.get("framework_process_ids", []):
                try:
                    os.kill(int(pid), signal.SIGTERM)
                    print(f"[OK] Stopped framework process {pid}")
                except (OSError, ValueError):
                    print(f"[WARNING] Framework process {pid} was not running")
        finally:
            STATE.unlink(missing_ok=True)
            removed += 1
    for folder in (ROOT / "results" / "raw", ROOT / "results" / "processed"):
        if folder.exists():
            for candidate in folder.glob("tunicars_temp_*"):
                if candidate.is_file():
                    candidate.unlink()
                    removed += 1
    print(f"[OK] Safe cleanup complete. Removed {removed} framework-owned temporary item(s).")
    print("[OK] No stack, volume, database, Minikube resource, or application container was deleted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
