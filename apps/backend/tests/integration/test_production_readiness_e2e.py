from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_production_readiness_e2e_entrypoint() -> None:
    client = TestClient(app)

    assert client.get("/health").status_code in (200, 503)
    assert client.get("/api/v1/ops/backups").status_code == 200

    run = client.post("/api/v1/ops/backups/run")
    assert run.status_code == 202
    backup_id = run.json()["run_id"]

    restore = client.post(
        "/api/v1/ops/restore",
        json={"backup_id": backup_id, "operator_id": "e2e"},
    )
    assert restore.status_code == 202


def test_production_artifacts_exist_for_readiness_suite() -> None:
    repo_root = Path(__file__).resolve().parents[4]
    required_files = [
        "devops/compose.prod.yml",
        "devops/compose.yaml",
        "scripts/ops/backup.sh",
        "scripts/ops/restore.sh",
        "scripts/ops/deploy-release.sh",
        "scripts/ops/rollback-release.sh",
        "docs/operations/deployment-guide.md",
    ]
    for path in required_files:
        assert (repo_root / path).exists(), f"missing required artifact: {path}"
