from __future__ import annotations

import tomllib
from pathlib import Path


def test_dashboard_pyproject_contract() -> None:
    pyproject = Path(__file__).resolve().parents[2] / "pyproject.toml"
    data = tomllib.loads(pyproject.read_text(encoding="utf-8"))

    assert data["project"]["name"] == "my-dynamic-dashboard-dashboard"
    assert data["tool"]["hatch"]["version"]["tag-pattern"] == "apps/dashboard/v(?P<version>.*)"
    markers = data["tool"]["pytest"]["ini_options"]["markers"]
    assert "unit: dashboard unit-layer tests" in markers
    assert "integration: dashboard integration-layer tests" in markers
