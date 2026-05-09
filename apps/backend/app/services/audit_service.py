from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.metadata_db import get_connection, init_metadata_db
from app.schemas import AuditEvent


class AuditService:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path

    def emit(
        self,
        *,
        event_type: str,
        message: str,
        service: str = "backend",
        severity: str = "INFO",
        correlation_id: str | None = None,
        bundle_id: str | None = None,
        operator_id: str | None = None,
    ) -> AuditEvent:
        init_metadata_db(self._db_path)
        now = datetime.now(timezone.utc).isoformat()
        event_id = str(uuid.uuid4())

        if bundle_id and operator_id:
            with get_connection(self._db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO deployment_events (
                        event_id, bundle_id, event_type, operator_id, message,
                        service, severity, created_at_utc
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        event_id,
                        bundle_id,
                        event_type,
                        operator_id,
                        message,
                        service,
                        severity,
                        now,
                    ),
                )

        return AuditEvent(
            event_id=event_id,
            event_type=event_type,
            service=service,
            severity=severity,
            message=message,
            timestamp_utc=now,
            correlation_id=correlation_id,
        )
