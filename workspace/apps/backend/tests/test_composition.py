"""R167: Query × Query composition is RETIRED — and this file is what holds it retired.

Until R167 a Query's driving source could be another saved Query (a ``qr_``), and R91
additionally allowed a ``qr_`` on the RIGHT of a join hop. Both are refused by the closed
Query concept — a Query is a live table over DATASETS only
(``.agents/design/data-management/_noun-model.md`` § D5). R166 withdrew every surface that
offered it; R167 narrowed the wire, so the refusal is now **structural**: the ``sourceId``
and ``rightSourceId`` patterns are ``^ds_…``, and a ``qr_`` is a ``422`` from the model
rather than a guard some endpoint remembers to run. That is why the tests below assert on
the SHAPE being rejected and not on a hand-written branch — there is no branch left to
regress.

**R168 retired the ``composition_cycle`` ERROR CODE — and kept the GUARD.** R167 left the
code dormant against one open question: whether a Workflow source resolves LIVE, the only
way cycles could return. R168 ruled it FROZEN for good, so the reactivating condition can
never fire and the wire stopped advertising an error no request can provoke.

**The DB-crafted tests below are what survived that, and they are not vestigial.**
Deleting the guard would not make a cycle impossible — it would make one FATAL. The API
cannot express a self-referencing query since R167, but the DB does not know that, and a
crafted row would recurse until the stack gives out. So these tests craft the state at the
DB layer and prove the guard still returns a REFUSAL rather than a stack overflow. The
internal ``source_cycle`` reason has no dedicated code any more, so each consumer maps it
through its own generic "this source can't resolve" fallback — ``relationship_stale`` on
the queries rows path, ``query_stale`` on the workflow run path. Which code it is matters
far less than that there IS one: the assertion worth keeping is 409, not 500.

**The guard is not uniform, which the last test pins down.** It covers the DRIVING source
and is GONE for the right-of-hop case: R167 resolves a hop's right through
``_resolve_dataset_leaf`` directly, so that path never reaches the composition machinery
and a crafted ``qr_`` there is `relationship_stale` — truthfully "this edge does not name
a dataset". That half can never come back: a hop's right is a ``DsId`` in the type system,
not a policy someone could relax.

Seeds a workspace with two CSVs (both sample.csv: id,name,amount,signed_up; ids 1/2/3).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


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


def _plain_query(client: TestClient, ws: str, *, name: str, dataset_id: str):
    """A dataset-rooted query — the only kind that can be created since R167."""
    return client.post(
        f"/workspaces/{ws}/queries",
        json={
            "name": name,
            "sourceId": dataset_id,
            "definition": {"q": None, "filters": [], "advanced": [], "relationships": [], "joins": []},
        },
    )


# ── The retirement, asserted where it is enforced: the wire ──────────────────────


@pytest.mark.unit
def test_a_query_cannot_be_built_on_another_query() -> None:
    """Entry point #1 (a `qr_` DRIVING source) is refused at create — by the
    `sourceId` pattern, so create/update/preview agree by construction."""
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        base_id = _plain_query(client, ws, name="Base", dataset_id=deals).json()["id"]

        resp = _plain_query(client, ws, name="On the base", dataset_id=base_id)

        assert resp.status_code == 422, resp.text
        assert "sourceId" in resp.text, "the refusal must name the offending field"


@pytest.mark.unit
def test_a_query_cannot_be_joined_in_on_the_right_of_a_hop() -> None:
    """Entry point #3 (R91's `qr_` on a hop's RIGHT) is refused at create. The
    driving source being a legal `ds_` is exactly what makes this test worth its
    keep: narrowing only `sourceId` would let this form through."""
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        other_id = _plain_query(client, ws, name="Other", dataset_id=deals).json()["id"]

        resp = client.post(
            f"/workspaces/{ws}/queries",
            json={
                "name": "Joined to a query",
                "sourceId": deals,  # a legal dataset — the qr_ is on the RIGHT
                "definition": {
                    "q": None,
                    "filters": [],
                    "advanced": [],
                    "relationships": [
                        {
                            "id": "qrel_dead0001",
                            "leftSourceId": deals,
                            "leftColumn": "id",
                            "rightSourceId": other_id,
                            "rightColumn": "id",
                            "cardinality": "one_to_one",
                            "originRelationshipId": None,
                        }
                    ],
                    "joins": [{"queryRelId": "qrel_dead0001", "type": "inner"}],
                },
            },
        )

        assert resp.status_code == 422, resp.text
        assert "rightSourceId" in resp.text


@pytest.mark.unit
def test_preview_refuses_a_composed_source_too() -> None:
    """Preview narrows in step with create — otherwise the builder could preview a
    shape it can never save, which is the drift the single pattern exists to stop."""
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        base_id = _plain_query(client, ws, name="Base", dataset_id=deals).json()["id"]

        resp = client.post(
            f"/workspaces/{ws}/queries/preview",
            json={
                "sourceId": base_id,
                "definition": {"q": None, "filters": [], "advanced": [], "relationships": [], "joins": []},
            },
        )

        assert resp.status_code == 422, resp.text


# ── The guard — kept under test so it is not mistaken for dead code ─────────────


@pytest.mark.unit
def test_cycle_guard_still_fires_on_a_direct_self_reference() -> None:
    """A query whose source is ITSELF is REFUSED on run (409) rather than recursing
    forever. Unreachable through the API since R167 (the pattern refuses it), so it is
    crafted at the DB layer. R168 — the refusal carries this path's generic drift code
    rather than a dedicated one: what matters is that the guard turns a stack overflow
    into an answer."""
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        aid = _plain_query(client, ws, name="A", dataset_id=deals).json()["id"]
        with db.get_conn() as con:
            con.execute("UPDATE queries SET source_id = ? WHERE id = ?", (aid, aid))
            con.commit()

        run = client.get(f"/queries/{aid}/rows")

        assert run.status_code == 409, run.text
        assert run.json()["code"] == "relationship_stale"


@pytest.mark.unit
def test_cycle_guard_still_fires_on_a_transitive_loop() -> None:
    """A → B → A is blocked on run. Both legs are crafted at the DB layer now: since
    R167 neither can be created through the API, which is the point."""
    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        aid = _plain_query(client, ws, name="A", dataset_id=deals).json()["id"]
        bid = _plain_query(client, ws, name="B", dataset_id=deals).json()["id"]
        with db.get_conn() as con:
            con.execute("UPDATE queries SET source_id = ? WHERE id = ?", (aid, bid))  # B → A
            con.execute("UPDATE queries SET source_id = ? WHERE id = ?", (bid, aid))  # A → B
            con.commit()

        run = client.get(f"/queries/{aid}/rows")

        assert run.status_code == 409, run.text
        assert run.json()["code"] == "relationship_stale"


@pytest.mark.unit
def test_a_crafted_query_on_the_right_is_stale_not_a_cycle() -> None:
    """A crafted `qr_` on a hop's RIGHT is `relationship_stale`, NOT a cycle — and
    that is the correct answer, not a regression.

    R167 resolves a hop's right through `_resolve_dataset_leaf` directly, so the join
    path never reaches the composition machinery: a `qr_` there is simply not a
    dataset, the edge cannot be used, and nothing can recurse. Flag-don't-crash still
    holds (409, a guided state), the reason is just truthful about what is wrong.

    **This sharpens where the guard applies.** It covers the DRIVING source, where a
    crafted row could otherwise recurse, and is absent for the right-of-hop case,
    which can never need it: a hop's right is a `DsId` in the type system now, not a
    policy someone could relax."""
    import json

    with TestClient(app) as client:
        ws, deals, _accounts = _seed(client)
        aid = _plain_query(client, ws, name="A", dataset_id=deals).json()["id"]
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
        assert run.json()["code"] == "relationship_stale"
