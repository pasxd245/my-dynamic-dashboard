"""R76: Query × Query composition — a Query whose DRIVING source is another saved
Query (a ``qr_``), run via the unified ``ds_``/``qr_`` resolver (J-2′).

Covers: create + run a composed query (the base's own filters bake into its
sub-relation); the composed effective column space + ``sourceId`` round-trip;
arbitrary nesting (a base that is itself composed); and the ``composition_cycle``
guard (a query that, directly or transitively, builds on itself) blocking the run
instead of recursing forever — crafted at the DB layer, since the API won't let a
cycle be created (the driving source is set at create, before the loop can exist).

Seeds a workspace with two CSVs (both sample.csv: id,name,amount,signed_up; ids
1/2/3, amounts 42.5/17.0/99.9). The base is a Query on ``deals``; the composed
query joins ``accounts`` on ``id`` (self-id, so all base rows match).
"""

from __future__ import annotations

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
    ws = client.post("/workspaces", json={"name": "Marketing"}).json()["id"]
    return ws, _commit_csv(client, ws, "deals"), _commit_csv(client, ws, "accounts")


def _declare_id_join(client: TestClient, ws: str, left: str, right: str) -> dict:
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
    return resp.json()


def _qrel(rel: dict) -> dict:
    """COPY-ON-PICK (R88): a query-owned relationship copied from a governed rel."""
    return {
        "id": "qrel_" + rel["id"].split("_", 1)[1],
        "leftSourceId": rel["leftDatasetId"],
        "leftColumn": rel["leftColumn"],
        "rightSourceId": rel["rightDatasetId"],
        "rightColumn": rel["rightColumn"],
        "cardinality": rel["cardinality"],
        "originRelationshipId": rel["id"],
    }


def _create_query(
    client: TestClient,
    ws: str,
    *,
    name: str,
    dataset_id: str,
    source_id: str | None = None,
    rels: list[dict] | None = None,
    filters: list | None = None,
):
    # R88 — copy-on-pick each governed rel into a query-owned `relationships[]`
    # entry; the hops reference them by `queryRelId`.
    qrels = [_qrel(r) for r in (rels or [])]
    body = {
        "name": name,
        # R79 — the single canonical driving source: the composed base (`qr_`)
        # when given, else the root dataset (`ds_`).
        "sourceId": source_id if source_id is not None else dataset_id,
        "definition": {
            "q": None,
            "filters": filters or [],
            "advanced": [],
            "relationships": qrels,
            "joins": [{"queryRelId": qr["id"], "type": "inner"} for qr in qrels],
        },
    }
    return client.post(f"/workspaces/{ws}/queries", json=body)


@pytest.mark.unit
def test_create_and_run_composed_query() -> None:
    """A query whose source is a saved Query (the base) joins another dataset and
    runs via the recursive resolver; sourceId + resolvedColumns round-trip."""
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel = _declare_id_join(client, ws, deals, accounts)
        base = _create_query(client, ws, name="Deals base", dataset_id=deals)
        assert base.status_code == 201, base.text
        base_id = base.json()["id"]

        composed = _create_query(
            client,
            ws,
            name="Deals (composed) × Accounts",
            dataset_id=deals,
            source_id=base_id,
            rels=[rel],
        )
        assert composed.status_code == 201, composed.text
        validate_response("queries/post.contract.yaml", 201, composed.json())
        assert composed.json()["sourceId"] == base_id
        qid = composed.json()["id"]

        # GET carries sourceId + the composed effective columns.
        detail = client.get(f"/queries/{qid}")
        assert detail.status_code == 200, detail.text
        validate_response("queries/detail-get.contract.yaml", 200, detail.json())
        assert detail.json()["sourceId"] == base_id
        assert detail.json().get("resolvedColumns"), "a composed query exposes its effective columns"

        # RUN: the base's rows (all 3) fed through the self-id join → 3 rows.
        run = client.get(f"/queries/{qid}/rows")
        assert run.status_code == 200, run.text
        validate_response("queries/rows-get.contract.yaml", 200, run.json())
        assert run.json()["total"] == 3


@pytest.mark.unit
def test_composed_base_filter_applies() -> None:
    """The base Query's OWN filters define its virtual table — they bake into the
    composed run (a composed query reads the base's filtered rows, not all rows)."""
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        rel = _declare_id_join(client, ws, deals, accounts)
        # Base keeps only amount > 40 → ids 1 (42.5) + 3 (99.9) = 2 rows.
        base = _create_query(
            client,
            ws,
            name="Big deals",
            dataset_id=deals,
            filters=[{"col": 2, "dtype": "float", "op": "gt", "val": 40}],
        )
        assert base.status_code == 201, base.text
        composed = _create_query(
            client,
            ws,
            name="Big deals × Accounts",
            dataset_id=deals,
            source_id=base.json()["id"],
            rels=[rel],
        )
        assert composed.status_code == 201, composed.text
        run = client.get(f"/queries/{composed.json()['id']}/rows")
        assert run.status_code == 200, run.text
        assert run.json()["total"] == 2, "the base's amount>40 filter carried into the composed run"


@pytest.mark.unit
def test_composed_nesting_resolves() -> None:
    """Arbitrary nesting (J-1): a query whose base is ITSELF composed resolves to
    the correct rows (the resolver recurses through both levels)."""
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        a = _create_query(client, ws, name="A (deals)", dataset_id=deals)
        b = _create_query(client, ws, name="B on A", dataset_id=deals, source_id=a.json()["id"])
        assert b.status_code == 201, b.text
        c = _create_query(client, ws, name="C on B", dataset_id=deals, source_id=b.json()["id"])
        assert c.status_code == 201, c.text
        run = client.get(f"/queries/{c.json()['id']}/rows")
        assert run.status_code == 200, run.text
        assert run.json()["total"] == 3, "C → B → A → deals resolves all rows (depth-2 nesting)"


@pytest.mark.unit
def test_composition_self_cycle_blocks_run() -> None:
    """A query whose source is ITSELF (a direct cycle) is blocked on run with 409
    composition_cycle — never an infinite recursion. Crafted at the DB layer (the
    API won't create it: the base must exist before it can be referenced)."""
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        a = _create_query(client, ws, name="A", dataset_id=deals)
        aid = a.json()["id"]
        with db.get_conn() as con:
            con.execute("UPDATE queries SET source_id = ? WHERE id = ?", (aid, aid))
            con.commit()
        run = client.get(f"/queries/{aid}/rows")
        assert run.status_code == 409, run.text
        assert run.json()["code"] == "composition_cycle"


@pytest.mark.unit
def test_composition_transitive_cycle_blocks_run() -> None:
    """A transitive cycle (A builds on B builds on A) is blocked on run with 409
    composition_cycle. Crafted at the DB layer (closing the loop)."""
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        a = _create_query(client, ws, name="A", dataset_id=deals)
        b = _create_query(client, ws, name="B on A", dataset_id=deals, source_id=a.json()["id"])
        aid, bid = a.json()["id"], b.json()["id"]
        # Close the loop: A now builds on B (which builds on A).
        with db.get_conn() as con:
            con.execute("UPDATE queries SET source_id = ? WHERE id = ?", (bid, aid))
            con.commit()
        run = client.get(f"/queries/{aid}/rows")
        assert run.status_code == 409, run.text
        assert run.json()["code"] == "composition_cycle"


# ── R91: query×query joins — a saved Query joined IN on a hop's RIGHT side ───────
# Distinct from composition above (a `qr_` as the DRIVING base): here a `qr_` is a
# NON-driving, joined-in source resolved through the same `resolve_source` as a
# subquery exposing its EFFECTIVE columns. The edge is free-form (`rightSourceId` is
# a `qr_`, no governed origin — the governed ER stays dataset-only).


def _join_in_query(
    client: TestClient,
    ws: str,
    *,
    name: str,
    driving_ds: str,
    left_col: str,
    joined_qr: str,
    right_col: str,
    card: str = "one_to_one",
):
    """Create a Query driving on a dataset that joins a saved Query IN on the right
    (a free-form query×query edge — `rightSourceId` is the joined-in `qr_`)."""
    qrel = {
        "id": "qrel_a1b2c3d4",
        "leftSourceId": driving_ds,
        "leftColumn": left_col,
        "rightSourceId": joined_qr,
        "rightColumn": right_col,
        "cardinality": card,
        "originRelationshipId": None,
    }
    return client.post(
        f"/workspaces/{ws}/queries",
        json={
            "name": name,
            "sourceId": driving_ds,
            "definition": {
                "q": None,
                "filters": [],
                "advanced": [],
                "relationships": [qrel],
                "joins": [{"queryRelId": qrel["id"], "type": "inner"}],
            },
        },
    )


@pytest.mark.unit
def test_query_x_query_join_runs_in_duckdb() -> None:
    """A saved Query joined IN on the right resolves as a subquery and RUNS: deals ⋈
    (Query on accounts) on id → 3 self-id matches. The create validates the `qr_`
    right side, and the run produces rows via the recursive resolver."""
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        base = _create_query(client, ws, name="Accounts base", dataset_id=accounts)
        assert base.status_code == 201, base.text
        bid = base.json()["id"]

        a = _join_in_query(
            client, ws, name="Deals ⋈ (Accounts query)", driving_ds=deals,
            left_col="id", joined_qr=bid, right_col="id",
        )
        assert a.status_code == 201, a.text
        validate_response("queries/post.contract.yaml", 201, a.json())
        qid = a.json()["id"]

        run = client.get(f"/queries/{qid}/rows")
        assert run.status_code == 200, run.text
        validate_response("queries/rows-get.contract.yaml", 200, run.json())
        assert run.json()["total"] == 3, "deals (3) ⋈ Accounts-query (3) on id → 3 self-id matches"


@pytest.mark.unit
def test_query_x_query_effective_columns_qualified() -> None:
    """Decision 5 — a joined-in query contributes its effective columns; names that
    collide across the nested boundary are qualified by the SOURCE display name (the
    dataset name AND the joined-in query's name), so the outer effective space stays
    unambiguous (`deals.id` vs `Accounts base.id`)."""
    with TestClient(app) as client:
        ws, deals, accounts = _seed(client)
        bid = _create_query(client, ws, name="Accounts base", dataset_id=accounts).json()["id"]
        a = _join_in_query(
            client, ws, name="Deals ⋈ (Accounts query)", driving_ds=deals,
            left_col="id", joined_qr=bid, right_col="id",
        )
        assert a.status_code == 201, a.text
        detail = client.get(f"/queries/{a.json()['id']}")
        assert detail.status_code == 200, detail.text
        names = [c["name"] for c in detail.json().get("resolvedColumns", [])]
        # sample.csv columns (id,name,amount,signed_up) collide across both sources →
        # every one is qualified, by the dataset name on the left and the QUERY name on
        # the right.
        assert "deals.id" in names, names
        assert "Accounts base.id" in names, names


@pytest.mark.unit
def test_query_x_query_self_join_in_cycle_blocks_run() -> None:
    """A query that joins ITSELF in on the right (`rightSourceId` = its own id) is
    blocked on run with 409 composition_cycle — the same `visited` guard the driving
    base uses, now threaded through the right-side resolve. Crafted at the DB layer
    (the API won't create a self-reference before the query exists)."""
    import json

    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        aid = _create_query(client, ws, name="A", dataset_id=deals).json()["id"]
        self_join_def = {
            "q": None,
            "filters": [],
            "advanced": [],
            "relationships": [
                {
                    "id": "qrel_dead0001",
                    "leftSourceId": deals,
                    "leftColumn": "id",
                    "rightSourceId": aid,  # joins ITSELF in
                    "rightColumn": "id",
                    "cardinality": "one_to_one",
                    "originRelationshipId": None,
                }
            ],
            "joins": [{"queryRelId": "qrel_dead0001", "type": "inner"}],
        }
        with db.get_conn() as con:
            con.execute("UPDATE queries SET definition_json = ? WHERE id = ?", (json.dumps(self_join_def), aid))
            con.commit()
        run = client.get(f"/queries/{aid}/rows")
        assert run.status_code == 409, run.text
        assert run.json()["code"] == "composition_cycle"
