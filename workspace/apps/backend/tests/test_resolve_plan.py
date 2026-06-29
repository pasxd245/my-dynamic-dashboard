"""R106 — unit tests for the extracted ``_resolve_plan`` resolver seam.

``_resolve_plan`` is the shared front half of create / update / run / preview:
it branches single-dataset vs multi-source and normalizes a resolve failure to a
``reason`` string, leaving the reason→HTTP mapping to each endpoint. The endpoint
contracts are covered by the integration suites (test_queries / test_joins /
test_composition); these tests pin the helper's own contract directly — the plan
shape and the unified ``source_missing`` classification (absent OR cross-workspace).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.db import get_conn
from app.main import app
from app.routers.queries import _resolve_plan

_FIXTURES = Path(__file__).parent / "fixtures"
_COLUMNS = ["id", "name", "amount", "signed_up"]  # sample.csv header


def _commit_csv(client: TestClient, ws_name: str = "Marketing") -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": ws_name}).json()["id"]
    upload = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", (_FIXTURES / "sample.csv").read_bytes(), "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": upload["temp_id"], "items": [{"name": "leads"}]},
    ).json()[0]
    return ws, ds["id"]


@pytest.mark.unit
def test_single_dataset_source_resolves_to_a_single_plan() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)

    with get_conn() as con:
        plan, reason = _resolve_plan(con, ds_id, [], {}, ws)

    assert reason is None
    assert plan["kind"] == "single"
    assert plan["ds"]["id"] == ds_id
    # ``columns`` is the validation/effective space the callers read uniformly.
    assert [c["name"] for c in plan["columns"]] == _COLUMNS


@pytest.mark.unit
def test_absent_dataset_is_source_missing() -> None:
    with TestClient(app) as client:
        ws, _ = _commit_csv(client)

    with get_conn() as con:
        plan, reason = _resolve_plan(con, "ds_00000000", [], {}, ws)

    assert plan is None
    assert reason == "source_missing"


@pytest.mark.unit
def test_cross_workspace_dataset_is_source_missing() -> None:
    """The unified workspace check: a real dataset, but resolved against a
    different workspace, is ``source_missing`` (reproduces the inline membership
    check create/preview do on a user-supplied sourceId)."""
    with TestClient(app) as client:
        _, ds_id = _commit_csv(client, ws_name="Owner")
        other_ws = client.post("/workspaces", json={"name": "Other"}).json()["id"]

    with get_conn() as con:
        plan, reason = _resolve_plan(con, ds_id, [], {}, other_ws)

    assert plan is None
    assert reason == "source_missing"


@pytest.mark.unit
def test_composed_query_source_routes_to_the_join_branch() -> None:
    """A ``qr_`` driving source is multi-source even with an empty chain, so it
    delegates to ``_resolve_chain`` and yields a ``join`` plan whose ``columns``
    are the resolved EFFECTIVE columns."""
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        q = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "base", "sourceId": ds_id, "definition": {"q": None, "filters": [], "advanced": []}},
        ).json()
        qid = q["id"]

    with get_conn() as con:
        plan, reason = _resolve_plan(con, qid, [], {}, ws)

    assert reason is None
    assert plan["kind"] == "join"
    assert plan["payload"]["effective"] is plan["columns"]
    assert [c["name"] for c in plan["columns"]] == _COLUMNS


@pytest.mark.unit
def test_composition_cycle_surfaces_as_reason() -> None:
    """A query whose definition composes on ITSELF resolves to the
    ``composition_cycle`` reason (the chain's cycle guard, surfaced unmapped)."""
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        q = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "self", "sourceId": ds_id, "definition": {"q": None, "filters": [], "advanced": []}},
        ).json()
        qid = q["id"]
        # Drift the persisted source to point at itself — a cycle no save would allow.
        with get_conn() as con:
            con.execute("UPDATE queries SET source_id = ? WHERE id = ?", (qid, qid))
            con.commit()

    with get_conn() as con:
        plan, reason = _resolve_plan(con, qid, [], {}, ws)

    assert plan is None
    assert reason == "composition_cycle"
