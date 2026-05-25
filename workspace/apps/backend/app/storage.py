"""Filesystem layout helpers — temp uploads + committed datasets.

Two trees live under the backend data root:

- ``uploads_tmp/<temp_id>/`` — server-generated temp uploads.
  Holds ``original.<ext>`` and a small ``meta.json``. 24h TTL is
  swept by ``app.jobs.tmp_sweep`` (R30), spawned by the FastAPI
  lifespan.
- ``datasets/<workspace_id>/<dataset_id>/`` — committed datasets.
  Holds ``original.<ext>`` (the source file copy), ``parsed.parquet``
  (the parsed table), and ``source.json`` (audit metadata).

The data root resolves from ``backend.data_dir`` in config (set via
values.yaml or ``MDD_BACKEND__DATA_DIR=...``); ``None`` falls back
to ``paths.DEFAULT_DATA_DIR``. Tests override via
``set_data_root(...)`` for hermetic isolation.
"""

from __future__ import annotations

from pathlib import Path

from app._config import CONFIG
from app._config.paths import BACKEND_ROOT, DEFAULT_DATA_DIR


def _resolve_data_root() -> Path:
    """Return the configured data root, falling back to the default.

    Relative paths in ``backend.data_dir`` are anchored at
    ``BACKEND_ROOT`` so the config can use short forms like
    ``data-prod/``.
    """
    configured = CONFIG.settings.backend.data_dir
    if configured is None:
        return DEFAULT_DATA_DIR
    p = Path(configured)
    return p if p.is_absolute() else BACKEND_ROOT / p


_data_root: Path = _resolve_data_root()


def set_data_root(path: Path | str) -> None:
    global _data_root
    _data_root = Path(path)


def get_data_root() -> Path:
    return _data_root


def temp_uploads_dir() -> Path:
    p = get_data_root() / "uploads_tmp"
    p.mkdir(parents=True, exist_ok=True)
    return p


def temp_upload_dir(temp_id: str) -> Path:
    return temp_uploads_dir() / temp_id


def datasets_dir() -> Path:
    p = get_data_root() / "datasets"
    p.mkdir(parents=True, exist_ok=True)
    return p


def dataset_dir(workspace_id: str, dataset_id: str) -> Path:
    return datasets_dir() / workspace_id / dataset_id
