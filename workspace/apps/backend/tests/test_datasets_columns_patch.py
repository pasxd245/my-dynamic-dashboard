"""R152 (F7) — PATCH /datasets/{id}/columns: the `hidden` view-hint.

Covers the backend half: the visibility PATCH (round-trip, replace semantics,
validation) + the presentation-only doctrine (parquet never touched) + the
refresh carry-forward (hidden survives a refresh by name; a dropped column
loses its hint).
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.db import get_conn
from app.main import app
from app.storage import dataset_dir
from tests._conformance import validate_response

_CONTRACT = "datasets/columns-patch.contract.yaml"
_V1 = b"id,name,amount,signed_up\n1,Alice,42.5,2024-01-15\n2,Bob,17.0,2024-02-03\n"
# Cumulative re-export, same schema, one more row (the FM refresh cadence).
_V2 = _V1 + b"3,Cara,99.0,2024-03-01\n"
# A re-export that DROPS the `signed_up` column (schema drift).
_V_DROP = b"id,name,amount\n1,Alice,42.5\n2,Bob,17.0\n"


def _make_workspace(client: TestClient, name: str = "Marketing") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _csv_upload(client: TestClient, content: bytes) -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("export.csv", content, "text/csv")},
    )
    return resp.json()["temp_id"]


def _create_dataset(client: TestClient, ws: str, content: bytes = _V1) -> dict:
    temp = _csv_upload(client, content)
    resp = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": temp, "items": [{"name": "leads"}]},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()[0]


def _hidden_names(ds: dict) -> set[str]:
    return {c["name"] for c in ds["columns"] if c.get("hidden")}


@pytest.mark.unit
def test_set_visibility_round_trips_hidden() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)

        resp = client.patch(
            f"/datasets/{ds['id']}/columns",
            json={"hidden": ["amount", "signed_up"]},
        )

        assert resp.status_code == 200, resp.text
        body = resp.json()
        validate_response(_CONTRACT, 200, body)
        assert _hidden_names(body) == {"amount", "signed_up"}
        # Visible columns omit `hidden` entirely (wire: absent = visible).
        visible = [c for c in body["columns"] if c["name"] in {"id", "name"}]
        assert all("hidden" not in c for c in visible)

        # Persisted — a GET reflects the same set.
        got = client.get(f"/datasets/{ds['id']}").json()
        assert _hidden_names(got) == {"amount", "signed_up"}


@pytest.mark.unit
def test_set_visibility_replace_semantics_clears_and_reassigns() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": ["amount"]})

        # Replace with a different set — `amount` becomes visible, `name` hidden.
        resp = client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": ["name"]})
        assert _hidden_names(resp.json()) == {"name"}

        # Empty list clears every hint.
        cleared = client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": []})
        assert _hidden_names(cleared.json()) == set()


@pytest.mark.unit
def test_set_visibility_unknown_column_returns_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        resp = client.patch(
            f"/datasets/{ds['id']}/columns",
            json={"hidden": ["amount", "nope"]},
        )

    assert resp.status_code == 422
    assert resp.json() == {"code": "unknown_column", "column": "nope"}
    validate_response(_CONTRACT, 422, resp.json())


@pytest.mark.unit
def test_set_visibility_hiding_every_column_returns_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        resp = client.patch(
            f"/datasets/{ds['id']}/columns",
            json={"hidden": ["id", "name", "amount", "signed_up"]},
        )

    assert resp.status_code == 422
    assert resp.json() == {"code": "no_visible_columns"}
    validate_response(_CONTRACT, 422, resp.json())


@pytest.mark.unit
def test_set_visibility_unknown_dataset_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.patch("/datasets/ds_deadbeef/columns", json={"hidden": []})

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response(_CONTRACT, 404, resp.json())


@pytest.mark.unit
def test_set_visibility_duplicate_names_returns_422_detail() -> None:
    """uniqueItems on the wire — a duplicate is a malformed request (FastAPI
    {detail} envelope), not a domain error."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        resp = client.patch(
            f"/datasets/{ds['id']}/columns",
            json={"hidden": ["amount", "amount"]},
        )

    assert resp.status_code == 422
    assert "detail" in resp.json()  # FastAPI validation envelope, not {code}


@pytest.mark.unit
def test_set_visibility_never_touches_the_parquet() -> None:
    """The presentation-vs-compute doctrine: the hint writes columns_json only —
    the parquet, row_count, and column_count are untouched."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        parquet = dataset_dir(ws, ds["id"]) / "parsed.parquet"
        before = parquet.read_bytes()

        resp = client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": ["amount"]})
        body = resp.json()

        assert parquet.read_bytes() == before  # byte-identical — not rewritten
        assert body["rowCount"] == ds["rowCount"]
        assert body["columnCount"] == ds["columnCount"]


@pytest.mark.unit
def test_refresh_carries_hidden_forward_by_name() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _V1)
        client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": ["amount"]})

        # Replace refresh with a cumulative re-export (same schema).
        temp = _csv_upload(client, _V2)
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ds["id"]}]},
        )
        assert resp.status_code == 201, resp.text
        updated = resp.json()[0]
        assert updated["rowCount"] == 3  # whole-table replace happened
        assert _hidden_names(updated) == {"amount"}  # hint survived the refresh


@pytest.mark.unit
def test_refresh_drops_hint_for_a_column_that_disappeared() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws, _V1)
        # Hide one column that will survive (name) and one that will vanish (signed_up).
        client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": ["name", "signed_up"]})

        temp = _csv_upload(client, _V_DROP)  # no `signed_up` column
        resp = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ds["id"]}]},
        )
        assert resp.status_code == 201, resp.text
        updated = resp.json()[0]
        cols = {c["name"] for c in updated["columns"]}
        assert "signed_up" not in cols  # column gone
        assert _hidden_names(updated) == {"name"}  # its hint survived; the gone one dropped


@pytest.mark.unit
def test_columns_json_omits_hidden_key_when_visible() -> None:
    """Stored shape stays minimal: only hidden columns carry the key (mirrors
    the wire omit-when-unset)."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": ["amount"]})

        with get_conn() as con:
            row = con.execute(
                "SELECT columns_json FROM datasets WHERE id = ?", (ds["id"],)
            ).fetchone()
        stored = json.loads(row["columns_json"])
        by_name = {c["name"]: c for c in stored}
        assert by_name["amount"].get("hidden") is True
        assert "hidden" not in by_name["id"]  # visible → key omitted, never False
