"""Shared test fixtures and helpers for backend tests.

Provides:
- autouse reset of the BUILDER_SESSION_SERVICE singleton between tests so no
  active-context state leaks across test runs.
- seed_source_activate(): seeds a parsed source_file row and calls
  PUT /api/v1/workspaces/active-context so guarded endpoints pass.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

from alembic import command
from alembic.config import Config
import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.core.metadata_db import get_connection


@pytest.fixture(autouse=True)
def reset_builder_session() -> None:
    """Reset singleton active-context state before every test."""
    main_module.BUILDER_SESSION_SERVICE.reset_active_context()


def seed_source_activate(client: TestClient, workspace_id: str, source_id: str = "test-src-001") -> None:
    """Seed a parsed source file and set it as the active context.

    Precondition: DB_PATH is already monkeypatched and init_metadata_db called.
    """
    with get_connection(main_module.DB_PATH) as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO source_files (
                id, workspace_id, filename_original, extension, content_hash,
                encoding_detected, parse_status, reject_reason, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'parsed', NULL, ?)
            """,
            (source_id, workspace_id, "test.csv", "csv", "abc123", "utf-8", "2026-01-01T00:00:00Z"),
        )
    r = client.put(
        "/api/v1/workspaces/active-context",
        json={"workspace_id": workspace_id, "source_id": source_id},
    )
    assert r.status_code == 200, f"set_active_context failed: {r.json()}"


@pytest.fixture
def metadata_db_path_tmp(tmp_path: Path) -> Path:
    return tmp_path / "metadata.db"


@pytest.fixture
def alembic_config_for_db(metadata_db_path_tmp: Path) -> Config:
    backend_root = Path(__file__).resolve().parents[1]
    cfg = Config(str(backend_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_root / "alembic"))
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{metadata_db_path_tmp}")
    return cfg


@pytest.fixture
def migrated_metadata_db(metadata_db_path_tmp: Path, alembic_config_for_db: Config) -> Path:
    command.upgrade(alembic_config_for_db, "head")
    return metadata_db_path_tmp


def fetch_table_columns(db_path: Path, table: str) -> set[str]:
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {row[1] for row in rows}
