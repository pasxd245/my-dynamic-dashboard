from __future__ import annotations

import importlib
from pathlib import Path

from fastapi import FastAPI


def test_required_backend_layout_scaffolds_exist() -> None:
    app_root = Path(__file__).resolve().parents[2] / "app"

    required_paths = [
        app_root / "__main__.py",
        app_root / "shared.py",
        app_root / "resources" / "default.yaml",
        app_root / "api" / "upload.py",
        app_root / "api" / "workspaces.py",
        app_root / "api" / "relationships.py",
        app_root / "api" / "queries.py",
        app_root / "api" / "saved_queries.py",
        app_root / "api" / "dashboards.py",
        app_root / "api" / "deployment.py",
        app_root / "apps" / "upload_app.py",
        app_root / "apps" / "workspace_app.py",
        app_root / "apps" / "relationship_app.py",
        app_root / "apps" / "query_app.py",
        app_root / "apps" / "dashboard_app.py",
        app_root / "apps" / "deployment_app.py",
    ]

    missing = [str(path.relative_to(app_root.parent)) for path in required_paths if not path.exists()]
    assert not missing, f"Missing scaffold paths: {missing}"


def test_realigned_entrypoints_import_cleanly() -> None:
    main_module = importlib.import_module("app.main")
    cli_module = importlib.import_module("app.__main__")

    assert hasattr(main_module, "app")
    assert isinstance(main_module.app, FastAPI)
    assert getattr(cli_module, "__name__", "") == "app.__main__"
