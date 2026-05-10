from __future__ import annotations

import os
from pathlib import Path

METADATA_DB_PATH = "METADATA_DB_PATH"


def read_path_env(name: str, default: Path) -> Path:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default

    candidate = Path(raw.strip()).expanduser()
    if candidate.is_absolute():
        return candidate

    return (default.parent / candidate).resolve()
