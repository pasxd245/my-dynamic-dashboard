"""R147 § Refresh merge mode — merge-on-key / precedence.

Covers keep-latest-per-key semantics (incoming wins · committed-only rows
KEPT — the difference from replace), the F5×F2 key guards (unknown / missing
/ dtype-drifted key → 422, dataset untouched), the D2 duplicate-incoming-keys
loud stop (`merge_duplicate_keys` envelope), D5 result-schema-is-incoming,
and the D1/D4 commitSettings memory (merge_key + refresh_mode remembered).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


def _make_workspace(client: TestClient, name: str = "CRM") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _csv_upload(client: TestClient, content: bytes, name: str = "export.csv") -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": (name, content, "text/csv")},
    )
    return resp.json()["temp_id"]


# Committed snapshot A. Incoming snapshot B overlaps on phone 200 + 300
# (status changed — the F5 shape: shared keys, differing rows), adds 400,
# and does NOT carry 100 (committed-only → must be KEPT under merge).
_SNAPSHOT_A = b"phone,status,car\n100,new,Civic\n200,called,CRV\n300,new,City\n"
_SNAPSHOT_B = b"phone,status,car\n200,closed,CRV\n300,called,City\n400,new,HRV\n"
# B with a duplicated key (phone 200 twice, differing rows) — the D2 stop.
_SNAPSHOT_B_DUP = b"phone,status,car\n200,closed,CRV\n200,callback,CRV\n400,new,HRV\n"


def _create_dataset(client: TestClient, ws: str, content: bytes = _SNAPSHOT_A, **item_extra) -> dict:
    temp = _csv_upload(client, content)
    item = {"name": "leads", **item_extra}
    resp = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": temp, "items": [item]})
    assert resp.status_code == 201, resp.text
    return resp.json()[0]


def _merge_refresh(client: TestClient, ws: str, ds_id: str, content: bytes, key: list[str], **item_extra):
    temp = _csv_upload(client, content)
    item = {"name": "IGNORED", "target_dataset_id": ds_id, "merge_key": key, **item_extra}
    return client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": temp, "items": [item]})


def _rows_by_phone(client: TestClient, ds_id: str) -> tuple[dict, dict]:
    # Rows come back stringified (RowsPage: list[list[str | None]]); column
    # order mirrors the dataset's committed columns (detail endpoint).
    cols = client.get(f"/datasets/{ds_id}").json()["columns"]
    idx = {c["name"]: i for i, c in enumerate(cols)}
    body = client.get(f"/datasets/{ds_id}/rows", params={"page_size": 100}).json()
    return {row[idx["phone"]]: row for row in body["rows"]}, idx


@pytest.mark.unit
def test_merge_keeps_committed_only_rows_and_incoming_wins() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _SNAPSHOT_A)
        assert ds["rowCount"] == 3

        resp = _merge_refresh(client, ws, ds["id"], _SNAPSHOT_B, ["phone"])
        assert resp.status_code == 201, resp.text
        body = resp.json()
        validate_response("datasets/batch-post.contract.yaml", 201, body)

        # Merge report wrapper (contract 201 shape 2), not the plain array.
        assert body["merge"] == {"updated": 2, "inserted": 1, "kept": 1}
        updated = body["datasets"][0]
        assert updated["id"] == ds["id"]  # identity kept — dependents survive
        assert updated["name"] == "leads"
        assert updated["rowCount"] == 4  # 2 updated + 1 inserted + 1 kept

        rows, idx = _rows_by_phone(client, ds["id"])
        assert rows["200"][idx["status"]] == "closed"  # incoming wins (D3)
        assert rows["300"][idx["status"]] == "called"
        assert rows["400"][idx["status"]] == "new"  # inserted
        assert rows["100"][idx["status"]] == "new"  # committed-only KEPT — the difference from replace


@pytest.mark.unit
def test_merge_duplicate_incoming_keys_is_loud_typed_422_dataset_untouched() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _SNAPSHOT_A)

        resp = _merge_refresh(client, ws, ds["id"], _SNAPSHOT_B_DUP, ["phone"])
        assert resp.status_code == 422, resp.text
        body = resp.json()
        assert body["code"] == "merge_duplicate_keys"
        assert body["key"] == ["phone"]
        assert body["duplicateKeyCount"] == 1
        assert body["sampleKeys"] == ["200"]
        validate_response("datasets/batch-post.contract.yaml", 422, body)

        # Dataset fully intact.
        assert client.get(f"/datasets/{ds['id']}").json()["rowCount"] == 3
        assert client.get(f"/datasets/{ds['id']}/rows").json()["total"] == 3


@pytest.mark.unit
def test_merge_key_unknown_column_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _SNAPSHOT_A)
        resp = _merge_refresh(client, ws, ds["id"], _SNAPSHOT_B, ["lead_id"])
        assert resp.status_code == 422, resp.text
        assert "lead_id" in str(resp.json()["detail"])
        assert client.get(f"/datasets/{ds['id']}").json()["rowCount"] == 3


@pytest.mark.unit
def test_merge_key_missing_from_incoming_is_blocked_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _SNAPSHOT_A)
        # The key column exists on the dataset but is EXCLUDED from the
        # incoming kept set — the "removed key column" drift blocks merge.
        resp = _merge_refresh(client, ws, ds["id"], _SNAPSHOT_B, ["phone"], excluded_columns=["phone"])
        assert resp.status_code == 422, resp.text
        assert "missing from the incoming file" in str(resp.json()["detail"])
        assert client.get(f"/datasets/{ds['id']}").json()["rowCount"] == 3


@pytest.mark.unit
def test_merge_key_dtype_drift_is_blocked_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _SNAPSHOT_A)  # phone inferred integer
        # Incoming overrides phone → string: the F5×F2 false-non-overlap
        # guard must stop the merge BEFORE any write.
        resp = _merge_refresh(
            client, ws, ds["id"], _SNAPSHOT_B, ["phone"], column_overrides={"phone": {"dtype": "string"}}
        )
        assert resp.status_code == 422, resp.text
        assert "dtype changed" in str(resp.json()["detail"])
        rows, idx = _rows_by_phone(client, ds["id"])
        assert rows["200"][idx["status"]] == "called"  # untouched


@pytest.mark.unit
def test_merge_key_on_create_item_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client, _SNAPSHOT_A)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "leads", "merge_key": ["phone"]}]},
        )
        assert resp.status_code == 422, resp.text
        assert "target_dataset_id" in str(resp.json()["detail"])


@pytest.mark.unit
def test_merge_composite_key() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        # phone alone is NOT unique (the TRÙNG shape) — phone+car is.
        committed = b"phone,car,status\n100,Civic,new\n100,CRV,called\n"
        incoming = b"phone,car,status\n100,CRV,closed\n200,HRV,new\n"
        ds = _create_dataset(client, ws, committed)

        resp = _merge_refresh(client, ws, ds["id"], incoming, ["phone", "car"])
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["merge"] == {"updated": 1, "inserted": 1, "kept": 1}
        rows = client.get(f"/datasets/{ds['id']}/rows", params={"page_size": 100}).json()
        by_pair = {(r[0], r[1]): r[2] for r in rows["rows"]}
        assert by_pair[("100", "CRV")] == "closed"  # composite match updated
        assert by_pair[("100", "Civic")] == "new"  # other same-phone row kept


@pytest.mark.unit
def test_merge_result_schema_is_incoming_d5() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _SNAPSHOT_A)  # phone,status,car
        # Incoming DROPS car and ADDS source: result schema = incoming's;
        # the kept committed row NULL-fills `source` and loses `car`.
        incoming = b"phone,status,source\n200,closed,web\n"
        resp = _merge_refresh(client, ws, ds["id"], incoming, ["phone"])
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["merge"] == {"updated": 1, "inserted": 0, "kept": 2}

        detail = client.get(f"/datasets/{ds['id']}").json()
        assert [c["name"] for c in detail["columns"]] == ["phone", "status", "source"]
        rows, idx = _rows_by_phone(client, ds["id"])
        assert rows["200"][idx["source"]] == "web"
        assert rows["100"][idx["source"]] is None  # kept row NULL-fills the added column


@pytest.mark.unit
def test_commit_settings_remember_merge_key_and_mode() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _SNAPSHOT_A)

        # Fresh create: no refresh memory yet.
        settings = client.get(f"/datasets/{ds['id']}/refresh-settings").json()
        assert "merge_key" not in settings
        assert "refresh_mode" not in settings

        # After a merge refresh: key + mode remembered (D1/D4).
        assert _merge_refresh(client, ws, ds["id"], _SNAPSHOT_B, ["phone"]).status_code == 201
        settings = client.get(f"/datasets/{ds['id']}/refresh-settings").json()
        validate_response("datasets/refresh-settings-get.contract.yaml", 200, settings)
        assert settings["merge_key"] == ["phone"]
        assert settings["refresh_mode"] == "merge"

        # A later REPLACE refresh flips the mode default but carries the
        # declared key forward (the key is per-dataset memory, not per-run).
        temp = _csv_upload(client, _SNAPSHOT_B)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ds["id"]}]},
        )
        assert resp.status_code == 201, resp.text
        settings = client.get(f"/datasets/{ds['id']}/refresh-settings").json()
        validate_response("datasets/refresh-settings-get.contract.yaml", 200, settings)
        assert settings["refresh_mode"] == "replace"
        assert settings["merge_key"] == ["phone"]


@pytest.mark.unit
def test_replace_refresh_unregressed_returns_plain_array() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _SNAPSHOT_A)
        temp = _csv_upload(client, _SNAPSHOT_B)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ds["id"]}]},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        validate_response("datasets/batch-post.contract.yaml", 201, body)
        assert isinstance(body, list)  # R145 shape untouched (no merge_key sent)
        assert body[0]["rowCount"] == 3  # replace: committed-only phone 100 GONE
