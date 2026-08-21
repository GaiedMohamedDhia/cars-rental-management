from src.health_monitor import HealthObservation, calculate_recovery_timing


def test_detection_and_recovery_times() -> None:
    result = calculate_recovery_timing(
        [
            HealthObservation(10.0, True),
            HealthObservation(12.5, False),
            HealthObservation(18.0, True),
        ],
        event_time=11.0,
    )
    assert result.detection_time_seconds == 1.5
    assert result.recovery_time_seconds == 5.5
    assert result.recovery_success is True
    assert result.recovery_required is True


def test_no_failure_means_no_recovery_time() -> None:
    result = calculate_recovery_timing([HealthObservation(2.0, True)], event_time=1.0)
    assert result.recovery_required is False
    assert result.recovery_time_seconds is None
