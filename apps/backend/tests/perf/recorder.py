"""Perf harness run recorder with deterministic output path."""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .utils import PerfResult


class PerfRunRecorder:
    def __init__(self, output_path: Path, environment_context: dict[str, str]) -> None:
        self.output_path = output_path
        self.environment_context = environment_context
        self._results: list[PerfResult] = []

    def record(self, result: PerfResult) -> None:
        self._results.append(result)

    def write_summary(self) -> dict[str, Any]:
        summary = {
            "run_timestamp": datetime.now(UTC).isoformat(),
            "environment_context": self.environment_context,
            "scenario_results": [asdict(result) for result in self._results],
            "overall_status": "PASS" if self._results and all(r.passed for r in self._results) else "FAIL",
        }
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        self.output_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        return summary
