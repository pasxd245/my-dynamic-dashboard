from __future__ import annotations

from io import StringIO

import pytest

from tests.perf.recorder import PerfRunRecorder
from tests.perf.utils import time_scenario


@pytest.mark.perf
def test_export_under_30_seconds(perf_recorder: PerfRunRecorder) -> None:
    rows = [{"id": i, "amount": float(i)} for i in range(100_000)]

    def simulated_export_workload() -> None:
        buf = StringIO()
        buf.write("id,amount\n")
        for row in rows:
            buf.write(f"{row['id']},{row['amount']}\n")
        _ = buf.getvalue()

    result = time_scenario("export", 30.0, simulated_export_workload)
    perf_recorder.record(result)

    assert result.passed, (
        f"export exceeded SLO: {result.elapsed_seconds:.4f}s >= {result.threshold_seconds:.1f}s"
    )
