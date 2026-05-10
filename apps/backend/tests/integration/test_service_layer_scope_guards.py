from __future__ import annotations

from pathlib import Path


def test_sqlite3_usage_remains_in_service_layer() -> None:
    service_dir = Path(__file__).resolve().parents[2] / "app" / "services"
    service_sources = "\n".join(path.read_text(encoding="utf-8") for path in service_dir.glob("*.py"))

    assert "sqlite3" in service_sources


def test_startup_and_handlers_do_not_require_sqlmodel_session_migration() -> None:
    main_path = Path(__file__).resolve().parents[2] / "app" / "main.py"
    main_source = main_path.read_text(encoding="utf-8")

    assert "Depends(get_session" not in main_source
    assert "from sqlmodel import Session" not in main_source
    assert "Session(" not in main_source
