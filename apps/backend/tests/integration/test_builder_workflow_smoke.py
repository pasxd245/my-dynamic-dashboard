from __future__ import annotations

from pathlib import Path
import subprocess

import pytest
from fastapi.testclient import TestClient

from app.core.metadata_db import init_metadata_db
from app.main import app
import app.main as main_module


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "metadata.db"
    parquet_root = tmp_path / "parquet"
    monkeypatch.setattr(main_module, "DB_PATH", db_path)
    monkeypatch.setattr(main_module, "PARQUET_ROOT", parquet_root)
    main_module.BUILDER_SESSION_SERVICE.reset_active_context()
    init_metadata_db(db_path)
    return TestClient(app)


def test_smoke_stage_order_and_first_failure_attribution(client: TestClient) -> None:
    response = client.post(
        "/api/v1/ops/smoke/builder-workflow",
        json={"simulate_failure_stage": "validate_query"},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["status"] == "failed"
    assert body["first_failed_stage"] == "validate_query"

    stages = body["stages"]
    assert [stage["stage"] for stage in stages] == [
        "create_workspace",
        "upload_source",
        "validate_query",
        "list_saved_queries",
    ]
    assert stages[0]["status"] == "passed"
    assert stages[1]["status"] == "passed"
    assert stages[2]["status"] == "failed"
    assert stages[3]["status"] == "skipped"


def test_smoke_script_exit_behavior_success_vs_failure() -> None:
    script_path = Path(__file__).resolve().parents[4] / "scripts" / "dev" / "builder-workflow-smoke.sh"

    success = subprocess.run(
        ["bash", str(script_path)],
        env={"BUILDER_SMOKE_MODE": "stub"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert success.returncode == 0
    assert "status=passed" in success.stdout

    failure = subprocess.run(
        ["bash", str(script_path)],
        env={"BUILDER_SMOKE_MODE": "stub", "BUILDER_SMOKE_FAIL_STAGE": "upload_source"},
        capture_output=True,
        text=True,
        check=False,
    )
    assert failure.returncode != 0
    assert "status=failed" in failure.stdout
    assert "first_failed_stage=upload_source" in failure.stdout
