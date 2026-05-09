from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.core.logging import correlation_id_ctx
from app.schemas import ConnectionStatus, DependencyStatus


def _utc_now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


@dataclass
class PreflightService:
    metadata_db_path: Path

    def evaluate(self) -> ConnectionStatus:
        db_ready = self.metadata_db_path.exists()

        dependency = DependencyStatus(
            name="metadata_db",
            status="ok" if db_ready else "failed",
            detail=str(self.metadata_db_path),
        )

        if db_ready:
            status = "ready"
            summary = "Builder dependencies are ready."
            guidance = "You can continue with builder workflow actions."
            degraded_capabilities: list[str] = []
        else:
            status = "unavailable"
            summary = "Builder dependencies are unavailable."
            guidance = "Restore metadata database availability, then refresh preflight status."
            degraded_capabilities = ["upload_source", "schema_sheet", "query", "results_saved"]

        return ConnectionStatus(
            status=status,
            last_checked_at_utc=_utc_now_iso(),
            summary=summary,
            guidance=guidance,
            dependencies=[dependency],
            degraded_capabilities=degraded_capabilities,
            correlation_id=correlation_id_ctx.get(),
        )
