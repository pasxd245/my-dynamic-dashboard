from __future__ import annotations

import json
import logging
import sys
from contextvars import ContextVar
from datetime import datetime, timezone


correlation_id_ctx: ContextVar[str | None] = ContextVar("correlation_id", default=None)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "service": getattr(record, "service", "backend"),
            "level": record.levelname,
            "event_type": getattr(record, "event_type", "runtime"),
            "message": record.getMessage(),
        }

        if hasattr(record, "correlation_id"):
            payload["correlation_id"] = record.correlation_id
        else:
            correlation_id = correlation_id_ctx.get()
            if correlation_id:
                payload["correlation_id"] = correlation_id

        for key in ("workspace_id", "query_id", "dashboard_id", "relationship_id", "run_id"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)

        return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def configure_backend_logging(level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("app")
    logger.setLevel(getattr(logging, level, logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    logger.handlers = [handler]
    logger.propagate = False

    return logger
