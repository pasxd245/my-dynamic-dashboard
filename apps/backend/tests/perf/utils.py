"""Shared timing helpers for opt-in perf harness."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from time import perf_counter
from typing import Any, Callable


@dataclass
class PerfResult:
    scenario_id: str
    elapsed_seconds: float
    threshold_seconds: float
    passed: bool

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def time_scenario(scenario_id: str, threshold_seconds: float, fn: Callable[[], Any]) -> PerfResult:
    started = perf_counter()
    fn()
    elapsed = perf_counter() - started
    return PerfResult(
        scenario_id=scenario_id,
        elapsed_seconds=elapsed,
        threshold_seconds=threshold_seconds,
        passed=elapsed < threshold_seconds,
    )
