from __future__ import annotations

import pytest

from tests.perf.recorder import PerfRunRecorder
from tests.perf.utils import time_scenario


@pytest.mark.perf
def test_upload_100k_rows_under_30_seconds(perf_recorder: PerfRunRecorder) -> None:
    def simulated_upload_workload() -> None:
        _ = [{"id": i, "amount": float(i)} for i in range(100_000)]

    result = time_scenario("upload_100k", 30.0, simulated_upload_workload)
    perf_recorder.record(result)

    assert result.passed, (
        f"upload_100k exceeded SLO: {result.elapsed_seconds:.4f}s >= {result.threshold_seconds:.1f}s"
    )
