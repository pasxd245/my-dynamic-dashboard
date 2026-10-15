"""R185 (W-4): a dataset carries a server-stamped data identity — `refreshedAt`
(when its rows last changed) and `dataVersion` (1 at commit, +1 on every
successful refresh). No request can set either; a rename or a column-visibility
change leaves both alone; a failed refresh leaves both alone."""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient

from app import db
from app.main import app
from tests._conformance import validate_response

_A = b"key,calls\n1,5\n2,3\n"
_B = b"key,calls\n2,4\n3,9\n"
_DUP = b"key,calls\n7,1\n7,2\n"


def _upload(client: TestClient, content: bytes) -> str:
    resp = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("e.csv", content, "text/csv")})
    return resp.json()["temp_id"]


def _create(client: TestClient) -> tuple[str, dict]:
    ws = client.post("/workspaces", json={"name": "V"}).json()["id"]
    resp = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": _upload(client, _A), "items": [{"name": "calls"}]})
    assert resp.status_code == 201, resp.text
    return ws, resp.json()[0]


def _refresh(client: TestClient, ws: str, ds_id: str, content: bytes, **extra):
    item = {"name": "IGNORED", "target_dataset_id": ds_id, **extra}
    return client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": _upload(client, content), "items": [item]})


def _detail(client: TestClient, ds_id: str) -> dict:
    return client.get(f"/datasets/{ds_id}").json()


@pytest.mark.unit
def test_commit_stamps_version_one_at_created_time() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        detail = client.get(f"/datasets/{ds['id']}")
        listed = client.get("/datasets", params={"workspace_id": ws})

    assert ds["dataVersion"] == 1
    assert ds["refreshedAt"] == ds["createdAt"]
    validate_response("datasets/detail-get.contract.yaml", 200, detail.json())
    validate_response("datasets/get.contract.yaml", 200, listed.json())
    assert detail.json()["dataVersion"] == 1
    assert listed.json()[0]["dataVersion"] == 1


@pytest.mark.unit
def test_every_refresh_mode_bumps_the_version_and_restamps() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        time.sleep(1.1)  # stamps are second-resolution
        r1 = _refresh(client, ws, ds["id"], _B)  # replace
        r2 = _refresh(client, ws, ds["id"], _A, merge_key=["key"])
        r3 = _refresh(client, ws, ds["id"], _B, refresh_mode="append")
        after = _detail(client, ds["id"])

    for r in (r1, r2, r3):
        assert r.status_code == 201, r.text
        validate_response("datasets/batch-post.contract.yaml", 201, r.json())
    v1 = r1.json()[0]
    assert v1["dataVersion"] == 2
    assert v1["refreshedAt"] > ds["refreshedAt"]
    assert v1["createdAt"] == ds["createdAt"]  # identity unchanged
    assert r2.json()["datasets"][0]["dataVersion"] == 3
    assert r3.json()["datasets"][0]["dataVersion"] == 4
    assert after["dataVersion"] == 4


@pytest.mark.unit
def test_rename_and_column_visibility_do_not_touch_the_data_identity() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        renamed = client.patch(f"/datasets/{ds['id']}", json={"name": "calls 2"})
        hidden = client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": ["calls"]})
        after = _detail(client, ds["id"])

    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["dataVersion"] == 1
    assert hidden.status_code == 200, hidden.text
    assert hidden.json()["dataVersion"] == 1
    assert after["dataVersion"] == 1
    assert after["refreshedAt"] == ds["refreshedAt"]


@pytest.mark.unit
def test_a_failed_refresh_leaves_the_version_alone() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        bad = _refresh(client, ws, ds["id"], _DUP, merge_key=["key"])
        after = _detail(client, ds["id"])

    assert bad.status_code == 422
    assert bad.json()["code"] == "merge_duplicate_keys"
    assert after["dataVersion"] == 1
    assert after["refreshedAt"] == ds["refreshedAt"]


@pytest.mark.unit
def test_no_request_body_can_set_the_data_identity() -> None:
    with TestClient(app) as client:
        ws, ds = _create(client)
        patch = client.patch(f"/datasets/{ds['id']}", json={"name": "x", "dataVersion": 99})
        commit = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": _upload(client, _A), "items": [{"name": "y", "dataVersion": 99}]},
        )
        refresh = _refresh(client, ws, ds["id"], _B, refreshedAt="2000-01-01T00:00:00Z")
        after = _detail(client, ds["id"])

    assert patch.status_code == 422
    assert commit.status_code == 422
    assert refresh.status_code == 422
    assert after["dataVersion"] == 1
    assert after["name"] == "calls"


@pytest.fixture
def _restore_db_path():
    original = db.get_db_path()
    yield
    db.set_db_path(original)


def _cols(path: Path) -> list[str]:
    con = sqlite3.connect(path)
    try:
        return [r[1] for r in con.execute("PRAGMA table_info(datasets)").fetchall()]
    finally:
        con.close()


def test_migration_0006_backfills_existing_datasets_and_downgrades(tmp_path: Path, _restore_db_path) -> None:
    path = tmp_path / "m.sqlite"
    db.set_db_path(path)
    cfg = db._alembic_config()
    command.upgrade(cfg, "0005_metadata_entries")
    con = sqlite3.connect(path)
    con.execute("INSERT INTO workspaces (id, name, created_at) VALUES ('ws_00000001', 'W', '2026-01-01T00:00:00Z')")
    con.execute(
        "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
        "source_format, sheet_name, created_at) VALUES ('ds_00000001', 'ws_00000001', 'd', 1, 1, 1, "
        "'[{\"name\":\"a\",\"dtype\":\"string\"}]', 'csv', NULL, '2026-02-03T04:05:06Z')"
    )
    con.commit()
    con.close()

    command.upgrade(cfg, "head")
    con = sqlite3.connect(path)
    row = con.execute("SELECT refreshed_at, data_version FROM datasets").fetchone()
    con.close()
    assert row == ("2026-02-03T04:05:06Z", 1)

    command.downgrade(cfg, "0005_metadata_entries")
    assert "data_version" not in _cols(path)
    assert "refreshed_at" not in _cols(path)
    con = sqlite3.connect(path)
    assert con.execute("SELECT count(*) FROM datasets").fetchone()[0] == 1
    con.close()
