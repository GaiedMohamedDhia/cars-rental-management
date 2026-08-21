"""Keep pytest temporary files isolated per process on Windows."""

from pathlib import Path
import os


_TEMP_ROOT = Path(__file__).resolve().parent / "results" / "processed" / f"pytest-{os.getpid()}"
_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
os.environ["PYTEST_DEBUG_TEMPROOT"] = str(_TEMP_ROOT)
