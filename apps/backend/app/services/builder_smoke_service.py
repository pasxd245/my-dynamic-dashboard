from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.schemas import SmokeFlowResult, SmokeRunRequest, SmokeStageKey, SmokeStageResult


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


STAGE_ORDER: list[SmokeStageKey] = [
    "create_workspace",
    "upload_source",
    "validate_query",
    "list_saved_queries",
]


@dataclass
class BuilderSmokeService:
    _runs: dict[str, SmokeFlowResult] = field(default_factory=dict)

    def run_workflow_smoke(self, request: SmokeRunRequest) -> SmokeFlowResult:
        run_id = str(uuid.uuid4())
        started_at = _utc_now_iso()
        stages: list[SmokeStageResult] = []
        first_failed_stage: SmokeStageKey | None = None

        for stage in STAGE_ORDER:
            if first_failed_stage is not None:
                stages.append(
                    SmokeStageResult(
                        stage=stage,
                        status="skipped",
                        message="Skipped because an earlier stage failed.",
                        diagnostics={"first_failed_stage": first_failed_stage},
                    )
                )
                continue

            if request.simulate_failure_stage == stage:
                first_failed_stage = stage
                stages.append(
                    SmokeStageResult(
                        stage=stage,
                        status="failed",
                        message=f"Stage {stage} failed during smoke run.",
                        diagnostics={"reason": "simulated_failure"},
                    )
                )
                continue

            stages.append(
                SmokeStageResult(
                    stage=stage,
                    status="passed",
                    message=f"Stage {stage} passed.",
                    diagnostics={"sequence_index": STAGE_ORDER.index(stage)},
                )
            )

        result = SmokeFlowResult(
            run_id=run_id,
            status="failed" if first_failed_stage else "passed",
            started_at_utc=started_at,
            completed_at_utc=_utc_now_iso(),
            first_failed_stage=first_failed_stage,
            stages=stages,
        )
        self._runs[run_id] = result
        return result

    def get_run(self, run_id: str) -> SmokeFlowResult | None:
        return self._runs.get(run_id)
