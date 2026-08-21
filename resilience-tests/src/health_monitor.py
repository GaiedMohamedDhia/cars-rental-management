"""Pure health-transition models and timing calculations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class HealthObservation:
    timestamp: float
    healthy: bool
    response_time_ms: float | None = None


@dataclass(frozen=True)
class RecoveryTiming:
    detection_time_seconds: float | None
    recovery_time_seconds: float | None
    recovery_success: bool
    recovery_required: bool


def calculate_recovery_timing(
    observations: Iterable[HealthObservation], *, event_time: float
) -> RecoveryTiming:
    """Calculate first unhealthy detection and subsequent healthy recovery."""

    ordered = sorted(observations, key=lambda item: item.timestamp)
    after_event = [item for item in ordered if item.timestamp >= event_time]
    first_failure = next((item for item in after_event if not item.healthy), None)
    if first_failure is None:
        return RecoveryTiming(None, None, True, False)
    recovered = next(
        (item for item in after_event if item.timestamp >= first_failure.timestamp and item.healthy),
        None,
    )
    return RecoveryTiming(
        detection_time_seconds=first_failure.timestamp - event_time,
        recovery_time_seconds=(recovered.timestamp - first_failure.timestamp) if recovered else None,
        recovery_success=recovered is not None,
        recovery_required=True,
    )
