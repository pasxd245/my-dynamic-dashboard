from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any


class DashboardJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "service": "dashboard",
            "level": record.levelname,
            "event_type": getattr(record, "event_type", "dashboard_runtime"),
            "message": record.getMessage(),
        }
        if hasattr(record, "run_id"):
            payload["run_id"] = record.run_id
        if hasattr(record, "correlation_id"):
            payload["correlation_id"] = record.correlation_id
        return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def configure_dashboard_logging() -> logging.Logger:
    logger = logging.getLogger("dashboard")
    level_name = os.getenv("DASHBOARD_LOG_LEVEL", "INFO").upper()
    logger.setLevel(getattr(logging, level_name, logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(DashboardJsonFormatter())

    logger.handlers = [handler]
    logger.propagate = False
    return logger
