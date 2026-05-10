from __future__ import annotations

from pathlib import Path


def test_streamlit_entrypoint_uses_canonical_imports() -> None:
    entrypoint = Path(__file__).resolve().parents[2] / "streamlit_app.py"
    content = entrypoint.read_text(encoding="utf-8")

    assert "from dashboard.api import DashboardApiClient, DashboardApiError" in content
    assert "from dashboard.components.dashboard_header import" in content
    assert "from dashboard.shared import get_app_config" in content

    assert "from src.api" not in content
    assert "from src.components" not in content
