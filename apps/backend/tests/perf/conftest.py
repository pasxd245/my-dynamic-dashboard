from __future__ import annotations

import platform
from pathlib import Path
import sys

import pytest

from tests.perf.recorder import PerfRunRecorder


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Keep perf tests opt-in unless explicit perf marker selection is requested."""
    markexpr = (config.getoption("-m") or "").strip()
    if "perf" in markexpr:
        return

    skip_perf = pytest.mark.skip(reason="perf tests are opt-in; run with -m perf")
    for item in items:
        if "perf" in item.keywords:
            item.add_marker(skip_perf)


@pytest.fixture(scope="session")
def perf_environment_context() -> dict[str, str]:
    return {
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
    }


@pytest.fixture(scope="session")
def perf_recorder(perf_environment_context: dict[str, str]) -> PerfRunRecorder:
    output_path = Path(__file__).resolve().parent / "artifacts" / "perf-last-run.json"
    recorder = PerfRunRecorder(output_path=output_path, environment_context=perf_environment_context)
    yield recorder
    recorder.write_summary()
