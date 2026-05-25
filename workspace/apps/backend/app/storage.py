"""Filesystem layout helpers — temp uploads + committed datasets.

Two trees live under the backend data root:

- ``uploads_tmp/<temp_id>/`` — server-generated temp uploads.
  Holds ``original.<ext>`` and a small ``meta.json``. 24h TTL is
  documented in the contract; the sweep job lands in R30
  (``app.jobs.tmp_sweep``), spawned by the FastAPI lifespan.
- ``datasets/<workspace_id>/<dataset_id>/`` — committed datasets.
  Holds ``original.<ext>`` (the source file copy), ``parsed.parquet``
  (the parsed table), and ``source.json`` (audit metadata).

Tests override the data root via ``MDD_DATA_DIR`` or
``set_data_root(...)``.
"""

from __future__ import annotations

import os
from pathlib import Path


_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_DATA_ROOT = _BACKEND_ROOT / "data"

_data_root: Path = Path(os.environ.get("MDD_DATA_DIR", _DEFAULT_DATA_ROOT))


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
