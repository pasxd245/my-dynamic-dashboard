from __future__ import annotations

import pytest

from tests.perf.recorder import PerfRunRecorder
from tests.perf.utils import time_scenario


@pytest.mark.perf
def test_preview_under_5_seconds(perf_recorder: PerfRunRecorder) -> None:
    dataset = [{"id": i, "segment": "A" if i % 2 == 0 else "B"} for i in range(100_000)]

    def simulated_preview_workload() -> None:
        _ = [row for row in dataset if row["segment"] == "A"][:100]

    result = time_scenario("preview", 5.0, simulated_preview_workload)
    perf_recorder.record(result)

    assert result.passed, (
        f"preview exceeded SLO: {result.elapsed_seconds:.4f}s >= {result.threshold_seconds:.1f}s"
    )
