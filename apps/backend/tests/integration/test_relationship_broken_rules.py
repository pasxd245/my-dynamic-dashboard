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


def test_broken_detection_when_column_missing(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-broken"}).json()["id"]

    left = tmp_path / "left.csv"
    left.write_text("key,val\n1,10\n2,20\n", encoding="utf-8")
    with left.open("rb") as handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("left.csv", handle, "text/csv")},
        )

    right = tmp_path / "right.csv"
    right.write_text("key,val2\n1,100\n2,200\n", encoding="utf-8")
    with right.open("rb") as handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("right.csv", handle, "text/csv")},
        )

    profile = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    columns = profile.json()["columns"]
    key_columns = [column["column_id"] for column in columns if column["column_name"] == "key"]

    create = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": key_columns[0],
            "to_column_id": key_columns[1],
            "join_type": "inner",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": True,
        },
    )
    assert create.status_code == 201
    relationship_id = create.json()["id"]

    with sqlite3.connect(tmp_path / "metadata.db") as conn:
        conn.execute("DELETE FROM columns WHERE id = ?", (key_columns[1],))
        conn.commit()

    listed = client.get(f"/api/v1/workspaces/{workspace_id}/relationships")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["broken"] is True

    detail = client.get(
        f"/api/v1/workspaces/{workspace_id}/relationships/{relationship_id}"
    )
    assert detail.status_code == 200
    assert detail.json()["broken"] is True


def test_broken_detection_when_column_types_drift(tmp_path: Path, monkeypatch) -> None:
    client = _client(tmp_path, monkeypatch)

    workspace_id = client.post("/api/v1/workspaces", json={"name": "ws-broken-types"}).json()[
        "id"
    ]

    left = tmp_path / "left.csv"
    left.write_text("key,val\n1,10\n2,20\n", encoding="utf-8")
    with left.open("rb") as handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("left.csv", handle, "text/csv")},
        )

    right = tmp_path / "right.csv"
    right.write_text("key,val2\n1,100\n2,200\n", encoding="utf-8")
    with right.open("rb") as handle:
        client.post(
            f"/api/v1/workspaces/{workspace_id}/sources/upload",
            files={"file": ("right.csv", handle, "text/csv")},
        )

    profile = client.get(f"/api/v1/workspaces/{workspace_id}/profile")
    columns = profile.json()["columns"]
    key_columns = [column["column_id"] for column in columns if column["column_name"] == "key"]

    create = client.post(
        f"/api/v1/workspaces/{workspace_id}/relationships",
        json={
            "from_column_id": key_columns[0],
            "to_column_id": key_columns[1],
            "join_type": "inner",
            "rel_type": "exact_key",
            "low_overlap_acknowledged": True,
        },
    )
    assert create.status_code == 201

    with sqlite3.connect(tmp_path / "metadata.db") as conn:
        conn.execute(
            "UPDATE columns SET effective_type = 'string' WHERE id = ?", (key_columns[1],)
        )
        conn.commit()

    listed = client.get(f"/api/v1/workspaces/{workspace_id}/relationships")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["broken"] is True
