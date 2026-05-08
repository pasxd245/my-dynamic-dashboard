import sqlite3
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


def _create_workspace_with_profiles(
    client: TestClient,
    tmp_path: Path,
    *,
    left_csv: str,
    right_csv: str,
) -> tuple[str, str, str]:
    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-lifecycle"}).json()["id"]

    left = tmp_path / "left.csv"
    left.write_text(left_csv, encoding="utf-8")
    with left.open("rb") as handle:
        resp_left = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("left.csv", handle, "text/csv")},
        )
    assert resp_left.status_code == 200

    right = tmp_path / "right.csv"
    right.write_text(right_csv, encoding="utf-8")
    with right.open("rb") as handle:
        resp_right = client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("right.csv", handle, "text/csv")},
        )
    assert resp_right.status_code == 200

    profile = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    assert profile.status_code == 200

    columns = profile.json()["columns"]
    key_columns = [column["column_id"] for column in columns if column["column_name"] == "key"]
    assert len(key_columns) == 2
    return workspace_id, key_columns[0], key_columns[1]


def test_create_computes_overlap_and_cardinality(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _create_workspace_with_profiles(
        client,
        tmp_path,
        left_csv="key,val\n1,10\n2,20\n3,30\n",
        right_csv="key,val2\n2,200\n3,300\n4,400\n",
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
    payload = create.json()
    assert isinstance(payload["overlap_pct"], float)
    assert 0.0 <= payload["overlap_pct"] <= 1.0
    assert payload["cardinality"] in {"1:1", "1:N", "N:1", "N:N"}


def test_create_requires_low_overlap_acknowledgement(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _create_workspace_with_profiles(
        client,
        tmp_path,
        left_csv="key,val\n1,10\n2,20\n3,30\n",
        right_csv="key,val2\n9,900\n8,800\n7,700\n",
    )

    create = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "inner",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": False,
        },
    )

    assert create.status_code == 409


def test_create_validation_failures(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _create_workspace_with_profiles(
        client,
        tmp_path,
        left_csv="key,val\n1,10\n2,20\n",
        right_csv="key,val2\n1,100\n2,200\n",
    )

    invalid_join = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "cross",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": True,
        },
    )
    assert invalid_join.status_code == 400

    invalid_rel_type = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "inner",
            "rel_type": "unknown",
            "low_overlap_acknowledged": True,
        },
    )
    assert invalid_rel_type.status_code == 400

    missing_column = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": "missing-column",
            "to_column_id": to_column_id,
            "join_type": "inner",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": True,
        },
    )
    assert missing_column.status_code == 404


def test_review_transition_and_low_overlap_override(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _create_workspace_with_profiles(
        client,
        tmp_path,
        left_csv="key,val\n1,10\n2,20\n3,30\n",
        right_csv="key,val2\n1,100\n9,900\n8,800\n",
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

    reviewed = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "reviewed", "reason": "ready"},
    )
    assert reviewed.status_code == 200

    approved = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "approved", "override_reason": "manual validation"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"


def test_approve_requires_override_when_overlap_below_five_percent(
    tmp_path: Path,
    monkeypatch,
) -> None:
    client = _client(tmp_path, monkeypatch)

    many_left_rows = "key,val\n" + "\n".join(f"{i},{i}" for i in range(1, 51)) + "\n"
    right_rows = "key,val2\n999,1\n998,2\n"
    workspace_id, from_column_id, to_column_id = _create_workspace_with_profiles(
        client,
        tmp_path,
        left_csv=many_left_rows,
        right_csv=right_rows,
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

    reviewed = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "reviewed"},
    )
    assert reviewed.status_code == 200

    approved_without_override = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "approved"},
    )
    assert approved_without_override.status_code == 409


def test_review_rejected_and_audit_history(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _create_workspace_with_profiles(
        client,
        tmp_path,
        left_csv="key,val\n1,10\n2,20\n3,30\n",
        right_csv="key,val2\n1,100\n2,200\n3,300\n",
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

    reviewed = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "reviewed", "reason": "checked"},
    )
    assert reviewed.status_code == 200

    rejected = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "rejected", "reason": "not suitable"},
    )
    assert rejected.status_code == 200

    detail = client.get(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}"
    )
    assert detail.status_code == 200
    actions = [event["action"] for event in detail.json()["audit"]]
    assert actions == ["created", "reviewed", "rejected"]


def test_edit_recompute_reset_and_delete_audit_trace(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)
    workspace_id, from_column_id, to_column_id = _create_workspace_with_profiles(
        client,
        tmp_path,
        left_csv="key,val\n1,10\n2,20\n3,30\n",
        right_csv="key,val2\n1,100\n2,200\n4,400\n",
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

    reviewed = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "reviewed"},
    )
    assert reviewed.status_code == 200

    approved = client.patch(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}/review",
        json={"action": "approved", "override_reason": "review complete"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    updated = client.put(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}",
        json={
            "from_column_id": from_column_id,
            "to_column_id": to_column_id,
            "join_type": "left",
            "rel_type": "normalized_key",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "suggested"

    delete = client.delete(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}"
    )
    assert delete.status_code == 204

    with sqlite3.connect(tmp_path / "metadata.db") as conn:
        events = conn.execute(
            "SELECT action FROM relationship_audit WHERE relationship_id = ? ORDER BY timestamp ASC",
            (relationship_id,),
        ).fetchall()
        active = conn.execute(
            "SELECT COUNT(*) FROM relationship_rules WHERE id = ?", (relationship_id,)
        ).fetchone()[0]

    assert [row[0] for row in events] == [
        "created",
        "reviewed",
        "approved",
        "edited",
        "deleted",
    ]
    assert active == 0
