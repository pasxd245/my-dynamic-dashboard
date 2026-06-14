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
                "joins": [{"relationshipId": rel_id, "type": "inner"}],
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
    return {"q": q, "filters": filters or [], "advanced": [], "joins": [{"relationshipId": rel_id, "type": "inner"}]}


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


# ─── R73 multi-join chain (N-source fold) + R74 join graph (tree topology) ───


def _seed3(client: TestClient) -> tuple[str, str, str, str]:
    """Workspace + three same-schema datasets (deals, accounts, owners)."""
    ws = client.post("/workspaces", json={"name": "Marketing"}).json()["id"]
    return (
        ws,
        _commit_csv(client, ws, "deals"),
        _commit_csv(client, ws, "accounts"),
        _commit_csv(client, ws, "owners"),
    )


def _chain_def(rel_ids: list[str], *, filters=None, q=None) -> dict:
    return {
        "q": q,
        "filters": filters or [],
        "advanced": [],
        "joins": [{"relationshipId": r, "type": "inner"} for r in rel_ids],
    }


@pytest.mark.unit
def test_create_and_run_chain() -> None:
    # Deals ⋈ Accounts ⋈ Owners on id over three identical 3-row tables → 3 rows,
    # 4+4+4 = 12 effective cells per row.
    with TestClient(app) as client:
        ws, deals, accounts, owners = _seed3(client)
        rel1 = _declare_id_join(client, ws, deals, accounts)
        rel2 = _declare_id_join(client, ws, accounts, owners)
        created = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "Deals × Accounts × Owners", "datasetId": deals, "definition": _chain_def([rel1, rel2])},
        )
        assert created.status_code == 201, created.text
        validate_response("queries/post.contract.yaml", 201, created.json())
        qid = created.json()["id"]
        resp = client.get(f"/queries/{qid}/rows")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert all(len(r) == 12 for r in body["rows"])
    validate_response("queries/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_chain_resolved_columns_qualified_across_all_sources() -> None:
    with TestClient(app) as client:
        ws, deals, accounts, owners = _seed3(client)
        rel1 = _declare_id_join(client, ws, deals, accounts)
        rel2 = _declare_id_join(client, ws, accounts, owners)
        qid = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "DAO", "datasetId": deals, "definition": _chain_def([rel1, rel2])},
        ).json()["id"]
        body = client.get(f"/queries/{qid}").json()

    names = [c["name"] for c in body["resolvedColumns"]]
    # `id`/`name`/`amount`/`signed_up` each appear in all three sources → all qualified.
    assert names == [
        "deals.id", "deals.name", "deals.amount", "deals.signed_up",
        "accounts.id", "accounts.name", "accounts.amount", "accounts.signed_up",
        "owners.id", "owners.name", "owners.amount", "owners.signed_up",
    ]
    validate_response("queries/detail-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_star_executes_a_non_tail_branch() -> None:
    # R74: a 2nd hop that branches from the SOURCE (deals→owners) while the tail is
    # accounts — a STAR (deals joined to both accounts and owners), not a path. R73
    # rejected this as nonlinear_chain; R74 runs it: the engine joins T2 (owners)
    # against T0 (deals, the hop's own left), not T1. 4+4+4 = 12 effective cells.
    with TestClient(app) as client:
        ws, deals, accounts, owners = _seed3(client)
        rel1 = _declare_id_join(client, ws, deals, accounts)
        rel_branch = _declare_id_join(client, ws, deals, owners)  # left = deals (the source) — a branch
        created = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "Deals ⋈ {Accounts, Owners}", "datasetId": deals, "definition": _chain_def([rel1, rel_branch])},
        )
        assert created.status_code == 201, created.text
        validate_response("queries/post.contract.yaml", 201, created.json())
        resp = client.get(f"/queries/{created.json()['id']}/rows")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert all(len(r) == 12 for r in body["rows"])
    validate_response("queries/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_disconnected_join_is_422() -> None:
    # R74: a hop whose LEFT dataset is not yet in the graph (accounts→owners while
    # the source is deals and accounts hasn't been joined) is disconnected → 422.
    with TestClient(app) as client:
        ws, deals, accounts, owners = _seed3(client)
        rel_ao = _declare_id_join(client, ws, accounts, owners)  # left = accounts ∉ graph
        resp = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "disconnected", "datasetId": deals, "definition": _chain_def([rel_ao])},
        )
    assert resp.status_code == 422, resp.text


@pytest.mark.unit
def test_cyclic_join_is_422() -> None:
    # R74: a hop whose RIGHT dataset is already in the graph (a dataset joined twice
    # — a diamond/self-join) breaks the acyclic (tree) rule → 422.
    with TestClient(app) as client:
        ws, deals, accounts, _owners = _seed3(client)
        rel1 = _declare_id_join(client, ws, deals, accounts)
        rel_back = _declare_id_join(client, ws, accounts, deals)  # right = deals, already in graph
        resp = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "cyclic", "datasetId": deals, "definition": _chain_def([rel1, rel_back])},
        )
    assert resp.status_code == 422, resp.text


@pytest.mark.unit
def test_preview_chain_is_stateless() -> None:
    with TestClient(app) as client:
        ws, deals, accounts, owners = _seed3(client)
        rel1 = _declare_id_join(client, ws, deals, accounts)
        rel2 = _declare_id_join(client, ws, accounts, owners)
        resp = _preview(client, ws, deals, _chain_def([rel1, rel2]))
        listed = client.get(f"/workspaces/{ws}/queries").json()

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total"] == 3
    assert all(len(r) == 12 for r in body["rows"])
    assert len(body["resolvedColumns"]) == 12
    assert listed == []  # stateless — no persistence
    validate_response("queries/preview.contract.yaml", 200, body)


@pytest.mark.unit
def test_put_grows_a_single_join_into_a_chain() -> None:
    # Save a single join, then PUT a 2-hop chain → the saved run re-runs the chain.
    with TestClient(app) as client:
        ws, deals, accounts, owners = _seed3(client)
        rel1 = _declare_id_join(client, ws, deals, accounts)
        rel2 = _declare_id_join(client, ws, accounts, owners)
        qid = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "DA", "datasetId": deals, "definition": _chain_def([rel1])},
        ).json()["id"]
        put = client.put(f"/queries/{qid}", json={"definition": _chain_def([rel1, rel2])})
        body = put.json()
        rerun = client.get(f"/queries/{qid}/rows").json()

    assert put.status_code == 200, put.text
    assert len(body["resolvedColumns"]) == 12
    validate_response("queries/put.contract.yaml", 200, body)
    assert all(len(r) == 12 for r in rerun["rows"])


@pytest.mark.unit
def test_put_grows_a_chain_into_a_star() -> None:
    # R74 integration — the full tree lifecycle vs the real app: save a single join
    # (deals⋈accounts), then PUT a STAR (add deals→owners, a 2nd hop branching from
    # the SOURCE, not the tail) → the saved run re-runs the tree (12 effective cells)
    # and a stateless preview of the same unsaved star matches.
    with TestClient(app) as client:
        ws, deals, accounts, owners = _seed3(client)
        rel1 = _declare_id_join(client, ws, deals, accounts)
        rel_branch = _declare_id_join(client, ws, deals, owners)  # left = deals (the source)
        qid = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "DA", "datasetId": deals, "definition": _chain_def([rel1])},
        ).json()["id"]
        star = _chain_def([rel1, rel_branch])
        preview = _preview(client, ws, deals, star)
        put = client.put(f"/queries/{qid}", json={"definition": star})
        body = put.json()
        rerun = client.get(f"/queries/{qid}/rows").json()

    assert preview.status_code == 200, preview.text
    assert len(preview.json()["resolvedColumns"]) == 12
    assert put.status_code == 200, put.text
    assert len(body["resolvedColumns"]) == 12
    validate_response("queries/put.contract.yaml", 200, body)
    assert rerun["total"] == 3
    assert all(len(r) == 12 for r in rerun["rows"])


@pytest.mark.unit
def test_outer_joins_keep_unmatched_rows() -> None:
    # R75 — join deals.id (1,2,3) ↔ accounts.amount (42.5,17.0,99.9): integer↔float
    # (dtype-compatible) with ZERO overlap. The join type now decides which rows
    # survive: inner=0; left keeps all 3 left rows (right NULL); right keeps all 3
    # right rows (left NULL); full keeps the union = 6. Proves the per-hop keyword.
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel = client.post(
            f"/workspaces/{ws}/relationships",
            json={
                "leftDatasetId": deals,
                "leftColumn": "id",
                "rightDatasetId": accounts,
                "rightColumn": "amount",
                "cardinality": "one_to_one",
            },
        ).json()["id"]

        def run(kind: str) -> dict:
            definition = {"q": None, "filters": [], "advanced": [], "joins": [{"relationshipId": rel, "type": kind}]}
            qid = client.post(
                f"/workspaces/{ws}/queries",
                json={"name": kind, "datasetId": deals, "definition": definition},
            ).json()["id"]
            return client.get(f"/queries/{qid}/rows").json()

        inner, left, right, full = (run(k) for k in ("inner", "left", "right", "full"))

    assert inner["total"] == 0
    assert left["total"] == 3
    assert right["total"] == 3
    assert full["total"] == 6
    # Left join: every row keeps its 4 deals cells; the 4 accounts cells are NULL
    # (no match), and the RowsPage shape (8 cells) is unchanged.
    assert all(len(r) == 8 for r in left["rows"])
    assert all(all(c is None for c in r[4:]) for r in left["rows"])
    validate_response("queries/rows-get.contract.yaml", 200, left)


@pytest.mark.unit
def test_put_flips_join_type_inner_to_left() -> None:
    # R75 integration — the full lifecycle vs the real app: save an INNER join on a
    # zero-overlap key (0 rows), PUT the same hop as LEFT, and the saved run now
    # keeps all 3 left rows. The join type round-trips through persistence + run.
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel = client.post(
            f"/workspaces/{ws}/relationships",
            json={
                "leftDatasetId": deals,
                "leftColumn": "id",
                "rightDatasetId": accounts,
                "rightColumn": "amount",
                "cardinality": "one_to_one",
            },
        ).json()["id"]
        base = {"q": None, "filters": [], "advanced": []}
        qid = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "flip", "datasetId": deals, "definition": {**base, "joins": [{"relationshipId": rel, "type": "inner"}]}},
        ).json()["id"]
        before = client.get(f"/queries/{qid}/rows").json()
        put = client.put(
            f"/queries/{qid}",
            json={"definition": {**base, "joins": [{"relationshipId": rel, "type": "left"}]}},
        )
        after = client.get(f"/queries/{qid}/rows").json()

    assert before["total"] == 0  # inner: no matches
    assert put.status_code == 200, put.text
    validate_response("queries/put.contract.yaml", 200, put.json())
    assert after["total"] == 3  # left: all left rows kept


@pytest.mark.unit
def test_per_hop_stale_blocks_the_chain() -> None:
    # Drift the SECOND hop's key (owners.id) after save → the chain can't run →
    # 409 relationship_stale (the per-hop gate names the chain unavailable).
    with TestClient(app) as client:
        ws, deals, accounts, owners = _seed3(client)
        rel1 = _declare_id_join(client, ws, deals, accounts)
        rel2 = _declare_id_join(client, ws, accounts, owners)
        qid = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "DAO", "datasetId": deals, "definition": _chain_def([rel1, rel2])},
        ).json()["id"]
        with db.get_conn() as con:
            row = con.execute("SELECT columns_json FROM datasets WHERE id = ?", (owners,)).fetchone()
            cols = [c for c in json.loads(row["columns_json"]) if c["name"] != "id"]
            con.execute("UPDATE datasets SET columns_json = ? WHERE id = ?", (json.dumps(cols), owners))
            con.commit()
        resp = client.get(f"/queries/{qid}/rows")

    assert resp.status_code == 409
    assert resp.json() == {"code": "relationship_stale"}


@pytest.mark.unit
def test_legacy_single_join_folds_to_chain_on_read() -> None:
    # Back-compat: a persisted R71/R72 definition with a single `join` reads back
    # as a length-1 `joins` chain (the BE normalize-on-read shim) and runs.
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel_id = _declare_id_join(client, ws, deals, accounts)
        qid = _create_join(client, ws, deals, rel_id).json()["id"]
        # Rewrite storage to the LEGACY single-`join` shape, as R71/R72 saved it.
        legacy = {"q": None, "filters": [], "advanced": [], "join": {"relationshipId": rel_id, "type": "inner"}}
        with db.get_conn() as con:
            con.execute("UPDATE queries SET definition_json = ? WHERE id = ?", (json.dumps(legacy), qid))
            con.commit()
        fetched = client.get(f"/queries/{qid}").json()
        run = client.get(f"/queries/{qid}/rows").json()

    assert fetched["definition"]["joins"] == [{"relationshipId": rel_id, "type": "inner"}]
    assert "join" not in fetched["definition"]
    assert run["total"] == 3
    validate_response("queries/detail-get.contract.yaml", 200, fetched)
