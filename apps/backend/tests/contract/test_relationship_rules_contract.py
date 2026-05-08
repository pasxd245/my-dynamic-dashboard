from pathlib import Path

from fastapi.testclient import TestClient

from app.core.metadata_db import init_metadata_db
from app.main import app
import app.main as main_module


def _client(tmp_path: Path, monkeypatch) -> TestClient:
    db_path = tmp_path / "metadata.db"
    parquet_root = tmp_path / "parquet"
    monkeypatch.setattr(main_module, "DB_PATH", db_path)
    monkeypatch.setattr(main_module, "PARQUET_ROOT", parquet_root)
    init_metadata_db(db_path)
    return TestClient(app)


def _seed_workspace_with_two_uploads(client: TestClient, tmp_path: Path) -> tuple[str, str, str]:
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-rel"}).json()["id"]

    first = tmp_path / "left.csv"
    first.write_text("key,a\n1,10\n2,20\n3,30\n", encoding="utf-8")
    with first.open("rb") as handle:
        left_response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("left.csv", handle, "text/csv")},
        )
    assert left_response.status_code == 200

    second = tmp_path / "right.csv"
    second.write_text("key,b\n2,200\n3,300\n4,400\n", encoding="utf-8")
    with second.open("rb") as handle:
        right_response = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("right.csv", handle, "text/csv")},
        )
    assert right_response.status_code == 200

    profile = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    assert profile.status_code == 200
    columns = profile.json()["columns"]

    left_key = next(c["column_id"] for c in columns if c["column_name"] == "key")
    right_b = next(c["column_id"] for c in columns if c["column_name"] == "b")
    return workspace_id, left_key, right_b


def test_create_relationship_rule_contract_shape(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _seed_workspace_with_two_uploads(
        client, tmp_path
    )

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

    assert response.status_code == 201
    payload = response.json()
    assert set(payload.keys()) == {
        "id",
        "workspace_id",
        "from_column_id",
        "to_column_id",
        "join_type",
        "rel_type",
        "status",
        "overlap_pct",
        "cardinality",
        "low_overlap_acknowledged",
        "override_reason",
        "actor",
        "broken",
        "created_at",
        "updated_at",
    }


def test_review_relationship_contract_errors_and_success(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _seed_workspace_with_two_uploads(
        client, tmp_path
    )

    create = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "inner",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": True,
        },
    )
    assert create.status_code == 201
    relationship_id = create.json()["id"]

    bad_action = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "noop"},
    )
    assert bad_action.status_code == 400

    reviewed = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "reviewed", "reason": "looks valid"},
    )
    assert reviewed.status_code == 200
    assert reviewed.json()["status"] == "reviewed"


def test_list_and_get_relationship_contract_shape(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _seed_workspace_with_two_uploads(
        client, tmp_path
    )

    create = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "inner",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": True,
        },
    )
    relationship_id = create.json()["id"]

    listed = client.get(f"/api/v1/workspaces/{workspace_id}/relationships")
    assert listed.status_code == 200
    assert "items" in listed.json()
    assert len(listed.json()["items"]) >= 1

    detail = client.get(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}"
    )
    assert detail.status_code == 200
    detail_payload = detail.json()
    assert "audit" in detail_payload
    assert isinstance(detail_payload["audit"], list)


def test_update_and_delete_relationship_contract(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _seed_workspace_with_two_uploads(
        client, tmp_path
    )

    create = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "inner",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": True,
        },
    )
    assert create.status_code == 201
    relationship_id = create.json()["id"]

    update = client.put(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "left",
            "rel_type": "normalized_key",
        },
    )
    assert update.status_code == 200
    assert update.json()["status"] == "suggested"

    delete = client.delete(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}"
    )
    assert delete.status_code == 204
