"""Filesystem paths derived from the backend package location.

Single home for `Path(__file__).resolve().parents[N]` resolution.
Other modules (`storage`, `db`, `settings`) import constants from
here instead of recomputing the backend root locally.

- ``BACKEND_ROOT`` — the ``workspace/apps/backend/`` directory.
- ``DEFAULT_DATA_DIR`` — fallback runtime data root
  (``<BACKEND_ROOT>/data``) used when ``backend.data_dir`` is not
  set in config.
- ``DEFAULT_CONFIG_PATH`` — Layer-1 yaml path
  (``<BACKEND_ROOT>/data/config/default.yaml``). Bootstrap-fixed:
  the config loader can't read its own location from config.
"""

from __future__ import annotations

from pathlib import Path


# `_config/paths.py` lives at `app/_config/paths.py`; parents[2] is
# the backend package root (`workspace/apps/backend/`).
BACKEND_ROOT: Path = Path(__file__).resolve().parents[2]

DEFAULT_DATA_DIR: Path = BACKEND_ROOT / "data"

DEFAULT_CONFIG_PATH: Path = DEFAULT_DATA_DIR / "config" / "default.yaml"
