"""Dotted-key constants for config fields.

All config reads route through these to avoid magic strings at
call sites. Mirrors `workspace/config/values.yaml` structure
(dotted to flat).

Drifted-pattern reference: `apps/backend/app/shared.py` (Fields
class), lines 37-48.
"""

from __future__ import annotations


class Fields:
    """Dotted-key constants matching `values.yaml` paths."""

    # backend.*
    BACKEND_HOST = "backend.host"
    BACKEND_PORT = "backend.port"
    BACKEND_WORKERS = "backend.workers"
    BACKEND_LOG_LEVEL = "backend.log_level"
    BACKEND_CORS_ALLOW_ORIGINS = "backend.cors_allow_origins"
    BACKEND_UPLOAD_MAX_BYTES = "backend.upload_max_bytes"
