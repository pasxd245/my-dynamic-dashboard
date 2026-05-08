from pathlib import Path

from fastapi.testclient import TestClient

from app.core.metadata_db import init_metadata_db
from app.main import app
import app.main as main_module


def test_create_workspace_contract_shape() -> None:
    client = TestClient(app)

    response = client.post("/api/v1/workspaces", json={"name": "demo"})

    assert response.status_code == 200
    payload = response.json()
    assert set(payload.keys()) == {"id", "name", "status", "manifest_version"}
    assert payload["name"] == "demo"
    assert payload["status"] == "draft"
    assert payload["manifest_version"] == 1


def test_relationship_endpoint_exists_and_handles_valid_payload(
    tmp_path: Path,
    monkeypatch,
) -> None:
    db_path = tmp_path / "metadata.db"
    parquet_root = tmp_path / "parquet"
    monkeypatch.setattr(main_module, "DB_PATH", db_path)
    monkeypatch.setattr(main_module, "PARQUET_ROOT", parquet_root)
    init_metadata_db(db_path)

    client = TestClient(app)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-smoke-rel"}).json()[
        "id"
    ]

    left = tmp_path / "left.csv"
    left.write_text("a,b\n1,10\n2,20\n", encoding="utf-8")
    with left.open("rb") as handle:
        upload = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("left.csv", handle, "text/csv")},
        )
    assert upload.status_code == 200

    profile = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    columns = profile.json()["columns"]
    from_column_id = next(c["column_id"] for c in columns if c["column_name"] == "a")
    to_column_id = next(c["column_id"] for c in columns if c["column_name"] == "b")

    response = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "inner",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": True,
        },
    )

    assert response.status_code != 500
