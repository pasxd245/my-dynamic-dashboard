"""R71: join execution — a Query consumes a Relationship to read two datasets
as one. Create + run a joined query, the effective (collision-qualified) column
space, side-qualified predicates, the relationship_stale run gate, and the
validate-on-save edge guards.

Seeds a workspace with TWO CSV datasets (both sample.csv: id,name,amount,
signed_up) via the real upload→commit path. Because both share the schema, the
join's effective columns exercise the collision-qualification rule on EVERY
column (deals.id / accounts.id, …). The stale path drifts a join key column at
the DB layer (a join can't be saved broken — that's the 422-on-save guard).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _commit_csv(client: TestClient, ws: str, name: str) -> str:
    upload = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", (_FIXTURES / "sample.csv").read_bytes(), "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": upload["temp_id"], "items": [{"name": name}]},
    ).json()[0]
    return ds["id"]


def _seed(client: TestClient) -> tuple[str, str, str]:
    """Workspace + two datasets (deals, accounts) — same schema."""
    ws = client.post("/workspaces", json={"name": "Marketing"}).json()["id"]
    return ws, _commit_csv(client, ws, "deals"), _commit_csv(client, ws, "accounts")


def _declare_id_join(client: TestClient, ws: str, left: str, right: str) -> str:
    """Declare deals.id ↔ accounts.id (integer ↔ integer)."""
    resp = client.post(
        f"/workspaces/{ws}/relationships",
        json={
            "leftDatasetId": left,
            "leftColumn": "id",
            "rightDatasetId": right,
            "rightColumn": "id",
            "cardinality": "one_to_one",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _create_join(client: TestClient, ws: str, left: str, rel_id: str, *, name="Deals × Accounts", filters=None):
    return client.post(
        f"/workspaces/{ws}/queries",
        json={
            "name": name,
            "datasetId": left,
            "definition": {
                "q": None,
                "filters": filters or [],
                "advanced": [],
                "join": {"relationshipId": rel_id, "type": "inner"},
            },
        },
    )


@pytest.mark.unit
def test_create_and_run_joined_query() -> None:
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        created = _create_join(client, ws, deals, rel_id)
        assert created.status_code == 201, created.text
        validate_response("queries/post.contract.yaml", 201, created.json())
        qid = created.json()["id"]

        resp = client.get(f"/queries/{qid}/rows")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    # id ↔ id inner join over identical 3-row tables → 3 matched rows.
    assert body["total"] == 3
    # Effective space = deals(4) ++ accounts(4) = 8 cells per row.
    assert all(len(r) == 8 for r in body["rows"])
    validate_response("queries/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_get_joined_query_exposes_collision_qualified_resolved_columns() -> None:
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        qid = _create_join(client, ws, deals, rel_id).json()["id"]

        resp = client.get(f"/queries/{qid}")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    names = [c["name"] for c in body["resolvedColumns"]]
    # Every column name collides across the two same-schema sides → all qualified.
    assert names == [
        "deals.id",
        "deals.name",
        "deals.amount",
        "deals.signed_up",
        "accounts.id",
        "accounts.name",
        "accounts.amount",
        "accounts.signed_up",
    ]
    validate_response("queries/detail-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_joined_predicate_resolves_against_effective_space() -> None:
    # Filter on effective col 2 = "deals.amount" (float) > 40 → Alice, Carol.
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        qid = _create_join(
            client,
            ws,
            deals,
            rel_id,
            filters=[{"col": 2, "dtype": "float", "op": "gt", "val": 40}],
        ).json()["id"]
        resp = client.get(f"/queries/{qid}/rows")

    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 2


@pytest.mark.unit
def test_run_relationship_stale_blocks_the_join() -> None:
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        qid = _create_join(client, ws, deals, rel_id).json()["id"]

        # Drift the join key away on the left side (post-save) → the edge no
        # longer validates → the join must be BLOCKED, not silently wrong.
        with db.get_conn() as con:
            row = con.execute("SELECT columns_json FROM datasets WHERE id = ?", (deals,)).fetchone()
            cols = [c for c in json.loads(row["columns_json"]) if c["name"] != "id"]
            con.execute("UPDATE datasets SET columns_json = ? WHERE id = ?", (json.dumps(cols), deals))
            con.commit()

        resp = client.get(f"/queries/{qid}/rows")

    assert resp.status_code == 409
    assert resp.json() == {"code": "relationship_stale"}
    validate_response("queries/rows-get.contract.yaml", 409, resp.json())


@pytest.mark.unit
def test_run_query_stale_when_a_joined_predicate_atom_drifts() -> None:
    # A joined query whose FILTER references an effective column that later
    # drifts → 409 query_stale (distinct from the join-key drift above).
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        # Save valid (filter on deals.amount, effective col 2), then drift a
        # NON-key column directly to a definition that can't validate.
        qid = _create_join(client, ws, deals, rel_id).json()["id"]
        drifted = {
            "q": None,
            "filters": [{"col": 99, "dtype": "string", "op": "equals", "val": "x"}],
            "advanced": [],
            "join": {"relationshipId": rel_id, "type": "inner"},
        }
        with db.get_conn() as con:
            con.execute("UPDATE queries SET definition_json = ? WHERE id = ?", (json.dumps(drifted), qid))
            con.commit()
        resp = client.get(f"/queries/{qid}/rows")

    assert resp.status_code == 409
    assert resp.json() == {"code": "query_stale"}


@pytest.mark.unit
def test_save_join_with_unknown_relationship_is_422() -> None:
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        resp = _create_join(client, ws, deals, "rel_00000000")

    assert resp.status_code == 422


@pytest.mark.unit
def test_save_join_on_stale_edge_is_422() -> None:
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        # Drift the key before save → the edge can't be joined → unsavable.
        with db.get_conn() as con:
            row = con.execute("SELECT columns_json FROM datasets WHERE id = ?", (deals,)).fetchone()
            cols = [c for c in json.loads(row["columns_json"]) if c["name"] != "id"]
            con.execute("UPDATE datasets SET columns_json = ? WHERE id = ?", (json.dumps(cols), deals))
            con.commit()
        resp = _create_join(client, ws, deals, rel_id)

    assert resp.status_code == 422


# ─── R72: the construction surface — preview (unsaved) + update (PUT) ────────


def _preview(client: TestClient, ws: str, dataset_id: str, definition: dict, *, page_size: int = 50):
    return client.post(
        f"/workspaces/{ws}/queries/preview?page_size={page_size}",
        json={"datasetId": dataset_id, "definition": definition},
    )


def _joined_def(rel_id: str, *, filters=None, q=None) -> dict:
    return {"q": q, "filters": filters or [], "advanced": [], "join": {"relationshipId": rel_id, "type": "inner"}}


@pytest.mark.unit
def test_preview_joined_definition_runs_unsaved_with_resolved_columns() -> None:
    # R72 — preview an UNSAVED joined working copy: same engine as the saved
    # run, but nothing is persisted; the result carries resolvedColumns.
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        resp = _preview(client, ws, deals, _joined_def(rel_id))
        # Nothing was created — the workspace still lists zero queries.
        listed = client.get(f"/workspaces/{ws}/queries").json()

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert all(len(r) == 8 for r in body["rows"])
    assert [c["name"] for c in body["resolvedColumns"]][:1] == ["deals.id"]
    assert listed == []  # stateless — no persistence
    validate_response("queries/preview.contract.yaml", 200, body)


@pytest.mark.unit
def test_preview_single_source_omits_resolved_columns() -> None:
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        resp = _preview(client, ws, deals, {"q": None, "filters": [], "advanced": []})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert "resolvedColumns" not in body  # single-source → omitted
    validate_response("queries/preview.contract.yaml", 200, body)


@pytest.mark.unit
def test_preview_applies_predicate_over_effective_space() -> None:
    # Effective col 2 = deals.amount (float) > 40 → 2 rows, before any save.
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        resp = _preview(client, ws, deals, _joined_def(rel_id, filters=[{"col": 2, "dtype": "float", "op": "gt", "val": 40}]))

    assert resp.status_code == 200, resp.text
    assert resp.json()["total"] == 2


@pytest.mark.unit
def test_preview_relationship_stale_blocks_the_join() -> None:
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        with db.get_conn() as con:
            row = con.execute("SELECT columns_json FROM datasets WHERE id = ?", (deals,)).fetchone()
            cols = [c for c in json.loads(row["columns_json"]) if c["name"] != "id"]
            con.execute("UPDATE datasets SET columns_json = ? WHERE id = ?", (json.dumps(cols), deals))
            con.commit()
        resp = _preview(client, ws, deals, _joined_def(rel_id))

    assert resp.status_code == 409
    assert resp.json() == {"code": "relationship_stale"}
    validate_response("queries/preview.contract.yaml", 409, resp.json())


@pytest.mark.unit
def test_preview_query_stale_on_a_bad_predicate_atom() -> None:
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        resp = _preview(client, ws, deals, _joined_def(rel_id, filters=[{"col": 99, "dtype": "string", "op": "equals", "val": "x"}]))

    assert resp.status_code == 409
    assert resp.json() == {"code": "query_stale"}


@pytest.mark.unit
def test_preview_unknown_dataset_or_edge_is_422() -> None:
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        bad_ds = _preview(client, ws, "ds_00000000", {"q": None, "filters": [], "advanced": []})
        bad_edge = _preview(client, ws, deals, _joined_def("rel_00000000"))

    assert bad_ds.status_code == 422
    assert bad_edge.status_code == 422


@pytest.mark.unit
def test_update_definition_persists_and_reruns_live() -> None:
    # R72 — the construction surface's Save: PUT a new definition; the saved
    # query re-runs the NEW definition. Definition-only (name unchanged).
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        qid = _create_join(client, ws, deals, rel_id).json()["id"]
        # Add a cross-source predicate (effective col 2 = deals.amount > 40).
        put = client.put(
            f"/queries/{qid}",
            json={"definition": _joined_def(rel_id, filters=[{"col": 2, "dtype": "float", "op": "gt", "val": 40}])},
        )
        body = put.json()
        rerun = client.get(f"/queries/{qid}/rows")
        fetched = client.get(f"/queries/{qid}").json()

    assert put.status_code == 200, put.text
    assert body["name"] == "Deals × Accounts"  # name unchanged
    assert body["definition"]["filters"][0]["col"] == 2
    assert [c["name"] for c in body["resolvedColumns"]][0] == "deals.id"
    validate_response("queries/put.contract.yaml", 200, body)
    # Live: the saved run now reflects the edited definition.
    assert rerun.json()["total"] == 2
    assert fetched["definition"]["filters"][0]["col"] == 2


@pytest.mark.unit
def test_update_unknown_query_is_404() -> None:
    with TestClient(app) as client:
        resp = client.put(
            "/queries/qr_00000000",
            json={"definition": {"q": None, "filters": [], "advanced": []}},
        )
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_update_with_unrunnable_definition_is_422() -> None:
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        qid = _create_join(client, ws, deals, rel_id).json()["id"]
        # A bad atom (col out of range) can't be saved — create-time semantics.
        bad_atom = client.put(
            f"/queries/{qid}",
            json={"definition": _joined_def(rel_id, filters=[{"col": 99, "dtype": "string", "op": "equals", "val": "x"}])},
        )
        # A join on an unknown edge → unsavable.
        bad_edge = client.put(f"/queries/{qid}", json={"definition": _joined_def("rel_00000000")})

    assert bad_atom.status_code == 422
    assert bad_edge.status_code == 422
