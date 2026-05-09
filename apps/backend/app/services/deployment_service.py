from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.metadata_db import get_connection, init_metadata_db
from app.schemas import AuditEvent, DeploymentBundleDto


class DeploymentService:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def get_current_deployment(self) -> DeploymentBundleDto | None:
        init_metadata_db(self._db_path)
        with get_connection(self._db_path) as conn:
            row = conn.execute(
                """
                SELECT bundle_id, release_version, backend_image, builder_image,
                       dashboard_image, compose_revision, env_contract_version,
                       status, created_at_utc, backup_set_reference
                FROM deployment_bundles
                ORDER BY created_at_utc DESC
                LIMIT 1
                """
            ).fetchone()

        if row is None:
            return None

        return DeploymentBundleDto(
            bundle_id=str(row["bundle_id"]),
            release_version=str(row["release_version"]),
            backend_image=str(row["backend_image"]),
            builder_image=str(row["builder_image"]),
            dashboard_image=str(row["dashboard_image"]),
            compose_revision=str(row["compose_revision"]),
            env_contract_version=str(row["env_contract_version"]),
            status=str(row["status"]),
            created_at_utc=str(row["created_at_utc"]),
            backup_set_reference=str(row["backup_set_reference"]) if row["backup_set_reference"] else None,
        )

    def record_deployment_event(
        self,
        *,
        bundle_id: str,
        event_type: str,
        operator_id: str,
        message: str | None,
    ) -> AuditEvent:
        now = datetime.now(timezone.utc).isoformat()
        init_metadata_db(self._db_path)

        with get_connection(self._db_path) as conn:
            existing = conn.execute(
                "SELECT bundle_id FROM deployment_bundles WHERE bundle_id = ?",
                (bundle_id,),
            ).fetchone()
            if existing is None:
                conn.execute(
                    """
                    INSERT INTO deployment_bundles (
                        bundle_id, release_version, backend_image, builder_image,
                        dashboard_image, compose_revision, env_contract_version,
                        status, created_at_utc, created_by, backup_set_reference
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                    """,
                    (
                        bundle_id,
                        "unknown",
                        "unknown",
                        "unknown",
                        "unknown",
                        "unknown",
                        "unknown",
                        "draft",
                        now,
                        operator_id,
                    ),
                )

            event_id = str(uuid.uuid4())
            conn.execute(
                """
                INSERT INTO deployment_events (
                    event_id, bundle_id, event_type, operator_id, message, service, severity, created_at_utc
                ) VALUES (?, ?, ?, ?, ?, 'backend', 'INFO', ?)
                """,
                (event_id, bundle_id, event_type, operator_id, message, now),
            )

        return AuditEvent(
            event_id=event_id,
            event_type=event_type,
            service="backend",
            severity="INFO",
            message=message or f"{event_type} recorded",
            timestamp_utc=now,
        )
