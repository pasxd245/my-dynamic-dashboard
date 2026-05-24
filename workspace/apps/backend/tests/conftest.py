"""Shared fixtures.

Points the backend's SQLite + data root at a fresh per-test temp
directory so tests are hermetic and parallelism-safe.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app import db, storage


@pytest.fixture(autouse=True)
def _isolated_backend_data(tmp_path: Path):
    db.set_db_path(tmp_path / "app.sqlite")
    storage.set_data_root(tmp_path / "data")
    db.bootstrap_schema()
    yield
