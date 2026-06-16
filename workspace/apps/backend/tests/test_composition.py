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


def _declare_id_join(client: TestClient, ws: str, left: str, right: str) -> str:
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


def _create_query(
    client: TestClient,
    ws: str,
    *,
    name: str,
    dataset_id: str,
    source_id: str | None = None,
    joins: list | None = None,
    filters: list | None = None,
):
    body = {
        "name": name,
        # R79 — the single canonical driving source: the composed base (`qr_`)
        # when given, else the root dataset (`ds_`).
        "sourceId": source_id if source_id is not None else dataset_id,
        "definition": {"q": None, "filters": filters or [], "advanced": [], "joins": joins or []},
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
            joins=[{"relationshipId": rel, "type": "inner"}],
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
            joins=[{"relationshipId": rel, "type": "inner"}],
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
