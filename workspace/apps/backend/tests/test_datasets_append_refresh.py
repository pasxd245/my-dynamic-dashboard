"""R155 § Refresh append mode — keyless union / accumulate periodic exports.

Covers keep-all union semantics (every committed row KEPT + every incoming row
appended, duplicates preserved — no key, no dup-guard, the difference from
merge), D5 result-schema-is-incoming, the append report wrapper (201 shape 3),
the explicit `refresh_mode` discriminator + its 422 guards (append + merge_key
contradictory; refresh_mode on a create item), and the commitSettings memory
(refresh_mode=append + overlap_check_field remembered / carried forward).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response

# Committed A (2 rows) + incoming B (3 rows, DISJOINT except a duplicated
# "North" region — append keeps BOTH, no dedup).
_A = b"region,calls\nNorth,5\nSouth,3\n"
_B = b"region,calls\nEast,4\nWest,9\nNorth,7\n"


def _make_workspace(client: TestClient, name: str = "CRM") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _csv_upload(client: TestClient, content: bytes, name: str = "export.csv") -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": (name, content, "text/csv")},
    )
    return resp.json()["temp_id"]


def _create_dataset(client: TestClient, ws: str, content: bytes = _A) -> dict:
    temp = _csv_upload(client, content)
    resp = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": temp, "items": [{"name": "calls"}]})
    assert resp.status_code == 201, resp.text
    return resp.json()[0]


def _append_refresh(client: TestClient, ws: str, ds_id: str, content: bytes, **item_extra):
    temp = _csv_upload(client, content)
    item = {"name": "IGNORED", "target_dataset_id": ds_id, "refresh_mode": "append", **item_extra}
    return client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": temp, "items": [item]})


def _rows(client: TestClient, ds_id: str) -> list[list[str | None]]:
    return client.get(f"/datasets/{ds_id}/rows", params={"page_size": 100}).json()["rows"]


@pytest.mark.unit
def test_append_keeps_all_rows_including_duplicates() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _A)
        assert ds["rowCount"] == 2

        resp = _append_refresh(client, ws, ds["id"], _B)
        assert resp.status_code == 201, resp.text
        body = resp.json()
        validate_response("datasets/batch-post.contract.yaml", 201, body)

        # Append report wrapper (contract 201 shape 3), not the plain array.
        assert body["append"] == {"appended": 3, "total": 5}
        updated = body["datasets"][0]
        assert updated["id"] == ds["id"]  # identity kept — dependents survive
        assert updated["name"] == "calls"
        assert updated["rowCount"] == 5  # 2 committed + 3 appended, all kept

        rows = _rows(client, ds["id"])
        assert len(rows) == 5
        regions = sorted(r[0] for r in rows)
        # North appears TWICE (committed 5 + incoming 7) — duplicates preserved.
        assert regions == ["East", "North", "North", "South", "West"]


@pytest.mark.unit
def test_append_does_not_fire_the_merge_dup_key_guard() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _A)
        # The same "North" twice in one incoming file would be a loud 422 under
        # MERGE (merge_duplicate_keys); APPEND keeps both — no key to violate.
        incoming_dup = b"region,calls\nNorth,7\nNorth,8\n"
        resp = _append_refresh(client, ws, ds["id"], incoming_dup)
        assert resp.status_code == 201, resp.text
        assert resp.json()["append"] == {"appended": 2, "total": 4}


@pytest.mark.unit
def test_append_result_schema_is_incoming_d5() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _A)  # region,calls
        # Incoming DROPS calls and ADDS source: result schema = incoming's; the
        # kept committed rows NULL-fill `source` and lose `calls`.
        incoming = b"region,source\nEast,web\n"
        resp = _append_refresh(client, ws, ds["id"], incoming)
        assert resp.status_code == 201, resp.text
        assert resp.json()["append"] == {"appended": 1, "total": 3}

        detail = client.get(f"/datasets/{ds['id']}").json()
        assert [c["name"] for c in detail["columns"]] == ["region", "source"]
        rows = _rows(client, ds["id"])
        by_region = {r[0]: r[1] for r in rows}
        assert by_region["East"] == "web"  # incoming row
        assert by_region["North"] is None  # kept committed row NULL-fills the added column
        assert by_region["South"] is None


@pytest.mark.unit
def test_append_with_merge_key_is_422_contradictory() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _A)
        resp = _append_refresh(client, ws, ds["id"], _B, merge_key=["region"])
        assert resp.status_code == 422, resp.text
        assert "keyless" in str(resp.json()["detail"])
        assert client.get(f"/datasets/{ds['id']}").json()["rowCount"] == 2  # untouched


@pytest.mark.unit
def test_refresh_mode_on_create_item_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        temp = _csv_upload(client, _A)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "calls", "refresh_mode": "append"}]},
        )
        assert resp.status_code == 422, resp.text
        assert "target_dataset_id" in str(resp.json()["detail"])


@pytest.mark.unit
def test_explicit_refresh_mode_replace_still_returns_array() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _A)
        temp = _csv_upload(client, _B)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ds["id"], "refresh_mode": "replace"}]},
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        validate_response("datasets/batch-post.contract.yaml", 201, body)
        assert isinstance(body, list)  # replace shape unchanged
        assert body[0]["rowCount"] == 3  # replace: committed-only rows GONE


@pytest.mark.unit
def test_commit_settings_remember_append_mode_and_overlap_field() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _A)

        settings = client.get(f"/datasets/{ds['id']}/refresh-settings").json()
        assert "refresh_mode" not in settings
        assert "overlap_check_field" not in settings

        # After an append refresh: mode + overlap field remembered.
        assert _append_refresh(client, ws, ds["id"], _B, overlap_check_field="region").status_code == 201
        settings = client.get(f"/datasets/{ds['id']}/refresh-settings").json()
        validate_response("datasets/refresh-settings-get.contract.yaml", 200, settings)
        assert settings["refresh_mode"] == "append"
        assert settings["overlap_check_field"] == "region"

        # A later REPLACE flips the mode default but carries the overlap field
        # forward (per-dataset memory, not per-run — the F9 pattern).
        temp = _csv_upload(client, _B)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ds["id"]}]},
        )
        assert resp.status_code == 201, resp.text
        settings = client.get(f"/datasets/{ds['id']}/refresh-settings").json()
        assert settings["refresh_mode"] == "replace"
        assert settings["overlap_check_field"] == "region"
