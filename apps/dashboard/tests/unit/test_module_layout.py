from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_canonical_dashboard_layout_present() -> None:
    expected = [
        ROOT / "src/dashboard/api/backend_client.py",
        ROOT / "src/dashboard/components/dashboard_header.py",
        ROOT / "src/dashboard/components/parameter_panel.py",
        ROOT / "src/dashboard/components/query_panel.py",
        ROOT / "src/dashboard/components/export_controls.py",
        ROOT / "src/dashboard/components/chart_viewer.py",
    ]
    for path in expected:
        assert path.exists(), f"missing canonical module: {path}"


def test_legacy_duplicate_surfaces_removed() -> None:
    forbidden = [
        ROOT / "src/api/__init__.py",
        ROOT / "src/api/dashboard_api.py",
        ROOT / "src/components/__init__.py",
        ROOT / "src/components/dashboard_header.py",
        ROOT / "src/components/parameter_panel.py",
        ROOT / "src/components/query_panel.py",
        ROOT / "src/components/chart_viewer.py",
        ROOT / "src/components/export_controls.py",
    ]
    for path in forbidden:
        assert not path.exists(), f"legacy module should be removed: {path}"
