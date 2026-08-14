"""R134: Workflow run → materialize + rows.

Running a workflow resolves its (v1: single) source query via the shared query
engine, applies the workflow's transform steps, writes the TYPED output to
parquet, and captures the output schema (`resolvedColumns` + `materializedAt`).
`GET /workflows/{id}/rows` pages that materialized output; before the first run
there is no output, so it 404s.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response
from tests.test_workflows import _STEP, _create, _query_source


@pytest.mark.unit
def test_run_materializes_and_captures_schema() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[_STEP]).json()["id"]
        resp = client.post(f"/workflows/{wid}/run")

    assert resp.status_code == 200
    body = resp.json()
    # The aggregate step's output schema is captured: dimension `name` + `amount` sum.
    assert [c["name"] for c in body["resolvedColumns"]] == ["name", "amount"]
    assert body["materializedAt"].endswith("Z")
    validate_response("workflows/run-post.contract.yaml", 200, body)


@pytest.mark.unit
def test_rows_after_run_returns_grouped_output() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[_STEP]).json()["id"]
        client.post(f"/workflows/{wid}/run")
        rows = client.get(f"/workflows/{wid}/rows")

    assert rows.status_code == 200
    body = rows.json()
    # One row per distinct `name` (the aggregate dimension); each has 2 cells.
    assert body["total"] == len(body["rows"]) >= 1
    assert all(len(r) == 2 for r in body["rows"])
    validate_response("workflows/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_run_passthrough_no_steps_materializes_source_columns() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[]).json()["id"]
        run = client.post(f"/workflows/{wid}/run")
        rows = client.get(f"/workflows/{wid}/rows?unpaged=true")

    assert run.status_code == 200
    # No steps → the materialized output IS the source query's columns.
    assert [c["name"] for c in run.json()["resolvedColumns"]] == ["id", "name", "amount", "signed_up", "Source.Name"]
    assert rows.status_code == 200
    assert rows.json()["total"] == len(rows.json()["rows"]) >= 1


@pytest.mark.unit
def test_rows_before_run_returns_404() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid).json()["id"]
        resp = client.get(f"/workflows/{wid}/rows")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_run_unknown_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.post("/workflows/wf_00000000/run")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_run_after_source_query_deleted_returns_409() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid).json()["id"]
        client.delete(f"/queries/{qid}")
        resp = client.post(f"/workflows/{wid}/run")
    assert resp.status_code == 409
    assert resp.json() == {"code": "query_stale"}


# ─── R135: multi-query consolidation (UNION) + output-as-source ──────


def _create_multi(client: TestClient, ws: str, sources: list[str], name: str, steps=None):
    return client.post(
        f"/workspaces/{ws}/workflows",
        json={"name": name, "definition": {"sources": sources, "steps": steps or []}},
    )


@pytest.mark.unit
def test_consolidate_stacks_rows_via_union() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        one = _create(client, ws, qid, name="one", steps=[]).json()["id"]
        client.post(f"/workflows/{one}/run")
        n1 = client.get(f"/workflows/{one}/rows?unpaged=true").json()["total"]
        # Consolidating the SAME query twice unions its rows → 2× the single count.
        two = _create_multi(client, ws, [qid, qid], name="two", steps=[]).json()["id"]
        client.post(f"/workflows/{two}/run")
        n2 = client.get(f"/workflows/{two}/rows?unpaged=true").json()["total"]

    assert n1 >= 1
    assert n2 == 2 * n1


@pytest.mark.unit
def test_workflow_output_used_as_source() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        a = _create(client, ws, qid, name="A", steps=[]).json()["id"]
        client.post(f"/workflows/{a}/run")
        na = client.get(f"/workflows/{a}/rows?unpaged=true").json()["total"]
        # Workflow B reads A's MATERIALIZED output as a source (loop closes).
        created_b = _create_multi(client, ws, [a], name="B", steps=[])
        assert created_b.status_code == 201  # wf_ source accepted (not 422)
        bid = created_b.json()["id"]
        run_b = client.post(f"/workflows/{bid}/run")
        nb = client.get(f"/workflows/{bid}/rows?unpaged=true").json()["total"]

    assert run_b.status_code == 200
    assert nb == na >= 1


@pytest.mark.unit
def test_run_with_unrun_workflow_source_returns_409() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        a = _create(client, ws, qid, name="A").json()["id"]  # created but NOT run → no output
        bid = _create_multi(client, ws, [a], name="B").json()["id"]
        resp = client.post(f"/workflows/{bid}/run")
    assert resp.status_code == 409
    assert resp.json() == {"code": "query_stale"}


@pytest.mark.unit
def test_create_with_unknown_workflow_source_returns_422() -> None:
    with TestClient(app) as client:
        ws, _qid = _query_source(client)
        resp = _create_multi(client, ws, ["wf_00000000"], name="bad")
    assert resp.status_code == 422


# ── R168 (D1): a source query is consolidated as WHAT IT RETURNS ────────────────
#
# `build_consolidated_relation` used to stack each source's resolved relation without
# applying that source's OWN steps, so a Workflow over a SHAPED query read the
# un-shaped rows — and, because a run materializes, FROZE them. R168 ruled that
# consolidating a query means consolidating what the query returns, and repaired it in
# `resolve_source`'s `qr_` branch (Workflow's reader, and nothing else's).
#
# These tests assert the RULING, not the call site: a workflow's view of a source and
# that source's own `/rows` are the same table. They cannot pass while any layer drops
# the steps, wherever the fold happens to live.


def _shaped_query(client: TestClient, ws: str, ds_id: str, *, name: str, steps: list) -> str:
    """A saved query that SHAPES — the case the pre-R168 consolidation flattened."""
    return client.post(
        f"/workspaces/{ws}/queries",
        json={
            "name": name,
            "sourceId": ds_id,
            "definition": {"q": None, "filters": [], "advanced": [], "relationships": [], "joins": [], "steps": steps},
        },
    ).json()["id"]


def _dataset_of(client: TestClient, qid: str) -> tuple[str, str]:
    q = client.get(f"/queries/{qid}").json()
    return q["workspaceId"], q["sourceId"]


@pytest.mark.unit
def test_workflow_over_a_shaped_query_materializes_the_SHAPED_rows() -> None:
    """The defect, inverted: the workflow's output IS the source query's answer.

    Pre-R168 this materialized every raw row and every raw column instead — the seed's
    demo was a 4-row aggregate query freezing 120 un-shaped rows."""
    with TestClient(app) as client:
        ws, plain_qid = _query_source(client)
        _ws, ds_id = _dataset_of(client, plain_qid)
        shaped = _shaped_query(client, ws, ds_id, name="revenue by name", steps=[_STEP])
        # What the source query answers on its OWN detail page.
        q_rows = client.get(f"/queries/{shaped}/rows?unpaged=true").json()

        wid = _create(client, ws, shaped, steps=[]).json()["id"]  # no steps of its own
        run = client.post(f"/workflows/{wid}/run")
        w_rows = client.get(f"/workflows/{wid}/rows?unpaged=true").json()

    assert run.status_code == 200
    # The captured schema is the query's POST-step space, not the dataset's raw columns.
    assert [c["name"] for c in run.json()["resolvedColumns"]] == ["name", "amount"]
    assert w_rows["total"] == q_rows["total"]
    assert sorted(w_rows["rows"]) == sorted(q_rows["rows"]), "same query, same answer, both readers"


@pytest.mark.unit
def test_a_workflow_step_can_use_a_column_the_source_query_derived() -> None:
    """The builder's promise, made true.

    `useSourceColumns` feeds the StepsEditor a `qr_` source's `resolvedColumns` — the
    query's POST-step columns — so the UI offers a derived column to build a workflow
    step on. Pre-R168 the run validated against the PRE-step space and refused it with
    `step_invalid`: the UI offered a column the run rejected."""
    with TestClient(app) as client:
        ws, plain_qid = _query_source(client)
        _ws, ds_id = _dataset_of(client, plain_qid)
        derive = {"kind": "derive", "name": "double", "left": "amount", "op": "*", "right": {"kind": "const", "value": 2}}
        shaped = _shaped_query(client, ws, ds_id, name="with a derived column", steps=[derive])
        # `double` exists only AFTER the source query's step — and the builder lists it.
        assert "double" in [c["name"] for c in client.get(f"/queries/{shaped}").json()["resolvedColumns"]]

        wid = _create(
            client, ws, shaped, steps=[{"kind": "top_n", "col": "double", "n": 2, "descending": True}]
        ).json()["id"]
        run = client.post(f"/workflows/{wid}/run")

    assert run.status_code == 200, f"the run refused a column the builder offered: {run.text}"
    assert "double" in [c["name"] for c in run.json()["resolvedColumns"]]


@pytest.mark.unit
def test_consolidating_two_shaped_queries_unions_their_ANSWERS() -> None:
    """The noun, end to end: consolidate is a union of what the sources return, and the
    workflow's own steps are POST-union shaping (R168 Q3)."""
    with TestClient(app) as client:
        ws, plain_qid = _query_source(client)
        _ws, ds_id = _dataset_of(client, plain_qid)
        a = _shaped_query(client, ws, ds_id, name="A shaped", steps=[_STEP])
        b = _shaped_query(client, ws, ds_id, name="B shaped", steps=[_STEP])
        n_one = client.get(f"/queries/{a}/rows?unpaged=true").json()["total"]

        wid = _create_multi(client, ws, [a, b], name="both", steps=[]).json()["id"]
        client.post(f"/workflows/{wid}/run")
        both = client.get(f"/workflows/{wid}/rows?unpaged=true").json()

    # Self-consolidation doubles the SHAPED row count — not the raw one.
    assert both["total"] == n_one * 2
    assert all(len(r) == 2 for r in both["rows"]), "the union carries the shaped column space"
