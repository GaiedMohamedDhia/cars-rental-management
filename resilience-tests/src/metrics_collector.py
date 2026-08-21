"""Pure statistical helpers for measured response and resource samples."""

from __future__ import annotations

import math
from statistics import fmean
from typing import Iterable


def valid_samples(values: Iterable[float | None]) -> list[float]:
    return [float(value) for value in values if value is not None and not math.isnan(float(value))]


def average(values: Iterable[float | None]) -> float | None:
    samples = valid_samples(values)
    return fmean(samples) if samples else None


def percentile_95(values: Iterable[float | None]) -> float | None:
    samples = sorted(valid_samples(values))
    if not samples:
        return None
    rank = max(0, math.ceil(0.95 * len(samples)) - 1)
    return samples[rank]


def maximum(values: Iterable[float | None]) -> float | None:
    samples = valid_samples(values)
    return max(samples) if samples else None
