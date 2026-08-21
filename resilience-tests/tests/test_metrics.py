import math

from src.metrics_collector import average, maximum, percentile_95


def test_metric_aggregates_ignore_missing_values() -> None:
    values = [10.0, None, 30.0, math.nan, 20.0]
    assert average(values) == 20.0
    assert maximum(values) == 30.0
    assert percentile_95(values) == 30.0


def test_empty_metrics_remain_missing() -> None:
    assert average([None, math.nan]) is None
    assert percentile_95([]) is None
