"""R186: consolidation guards — W-2 (sources must share a shape), W-3 (provenance,
no silent double-count), W-5 (sources validated on save).

The R174 walk stacked an all-time-by-status query onto a monthly-by-status query of
the SAME orders: the output schema narrowed to the first source (W-2) and the revenue
was counted twice with nothing to tell the rows apart (W-3)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response

_CSV = (
    "status,month,amount,amount_f\n"
    "won,2026-01,10,1.5\n"
    "won,2026-02,20,2.5\n"
    "lost,2026-01,5,0.5\n"
).encode("utf-8")
_EMPTY = {"q": None, "filters": [], "advanced": []}


def _seed(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "G"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("o.csv", _CSV, "text/csv")}).json()
    ds = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "orders"}]})
    return ws, ds.json()[0]["id"]


def _q(client: TestClient, ws: str, ds: str, name: str, steps: list) -> str:
    resp = client.post(f"/workspaces/{ws}/queries", json={"name": name, "sourceId": ds, "definition": {**_EMPTY, "steps": steps}})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _wf(client: TestClient, ws: str, sources: list[str], name: str = "wf", steps: list | None = None):
    return client.post(f"/workspaces/{ws}/workflows", json={"name": name, "definition": {"sources": sources, "steps": steps or []}})


def _by_status(dims: list[str], col: str = "amount") -> list[dict]:
    return [{"kind": "aggregate", "dimensions": dims, "measures": [{"col": col, "agg": "sum"}]}]


@pytest.mark.unit
def test_divergent_sources_are_refused_on_save_instead_of_narrowing() -> None:
    """The R174 W-2 shape: [status, amount] + [status, month, amount] → 422 naming
    the extra column, where it used to save and silently drop `month`."""
    with TestClient(app) as client:
        ws, ds = _seed(client)
        all_time = _q(client, ws, ds, "all time", _by_status(["status"]))
        monthly = _q(client, ws, ds, "monthly", _by_status(["status", "month"]))
        resp = _wf(client, ws, [all_time, monthly])

    assert resp.status_code == 422
    detail = resp.json()["detail"][0]
    assert detail["loc"] == ["body", "definition", "sources", 1]
    assert detail["msg"].startswith("sources_diverge")
    assert "extra ['month']" in detail["msg"]


@pytest.mark.unit
def test_a_type_clash_is_refused_but_integer_and_float_widen() -> None:
    with TestClient(app) as client:
        ws, ds = _seed(client)
        ints = _q(client, ws, ds, "ints", [{"kind": "select", "cols": [{"col": "status"}, {"col": "amount", "name": "v"}]}])
        floats = _q(client, ws, ds, "floats", [{"kind": "select", "cols": [{"col": "status"}, {"col": "amount_f", "name": "v"}]}])
        texts = _q(client, ws, ds, "texts", [{"kind": "select", "cols": [{"col": "status"}, {"col": "month", "name": "v"}]}])
        clash = _wf(client, ws, [ints, texts], name="clash")
        widen = _wf(client, ws, [ints, floats], name="widen")
        run = client.post(f"/workflows/{widen.json()['id']}/run")
        rows = client.get(f"/workflows/{widen.json()['id']}/rows?unpaged=true").json()

    assert clash.status_code == 422
    assert "'v' is integer vs string" in clash.json()["detail"][0]["msg"]
    assert widen.status_code == 201, widen.text
    assert run.status_code == 200
    validate_response("workflows/run-post.contract.yaml", 200, run.json())
    assert run.json()["resolvedColumns"] == [
        {"name": "status", "dtype": "string"},
        {"name": "v", "dtype": "float"},
        {"name": "Source.Query", "dtype": "string"},
    ]
    assert sorted(float(r[1]) for r in rows["rows"]) == [0.5, 1.5, 2.5, 5.0, 10.0, 20.0]


@pytest.mark.unit
def test_overlapping_sources_are_separable_by_provenance() -> None:
    """Same shape, overlapping rows (every order + the won orders): the stacked total
    double-counts the won revenue — and the provenance column is what lets a reader
    see and undo that, which a homogeneous 47-row output never could (R174 W-3)."""
    won_only = [{"kind": "filter", "predicates": [{"col": "status", "op": "equals", "val": "won"}]}]
    with TestClient(app) as client:
        ws, ds = _seed(client)
        every = _q(client, ws, ds, "every order", [])
        won = _q(client, ws, ds, "won orders", won_only)
        wid = _wf(client, ws, [every, won], steps=_by_status(["Source.Query"])).json()["id"]
        run = client.post(f"/workflows/{wid}/run")
        rows = client.get(f"/workflows/{wid}/rows?unpaged=true").json()["rows"]

    assert run.status_code == 200, run.text
    assert {r[0]: float(r[1]) for r in rows} == {"every order": 35.0, "won orders": 30.0}


@pytest.mark.unit
def test_provenance_name_steps_aside_for_a_source_column() -> None:
    rename = [{"kind": "select", "cols": [{"col": "status", "name": "Source.Query"}, {"col": "amount"}]}]
    with TestClient(app) as client:
        ws, ds = _seed(client)
        a = _q(client, ws, ds, "a", rename)
        b = _q(client, ws, ds, "b", rename)
        wid = _wf(client, ws, [a, b]).json()["id"]
        run = client.post(f"/workflows/{wid}/run")

    names = [c["name"] for c in run.json()["resolvedColumns"]]
    assert names == ["Source.Query", "amount", "Source.Query1"]


@pytest.mark.unit
def test_a_single_source_workflow_gains_no_provenance_column() -> None:
    """Backward compatibility: a one-source workflow's output is what it was in rc.2."""
    with TestClient(app) as client:
        ws, ds = _seed(client)
        a = _q(client, ws, ds, "a", _by_status(["status"]))
        wid = _wf(client, ws, [a]).json()["id"]
        run = client.post(f"/workflows/{wid}/run")

    assert [c["name"] for c in run.json()["resolvedColumns"]] == ["status", "amount"]


@pytest.mark.unit
def test_update_is_validated_like_create() -> None:
    with TestClient(app) as client:
        ws, ds = _seed(client)
        a = _q(client, ws, ds, "a", _by_status(["status"]))
        b = _q(client, ws, ds, "b", _by_status(["month"]))
        wid = _wf(client, ws, [a]).json()["id"]
        resp = client.put(f"/workflows/{wid}", json={"name": "wf", "definition": {"sources": [a, b], "steps": []}})

    assert resp.status_code == 422
    assert resp.json()["detail"][0]["msg"].startswith("sources_diverge")


@pytest.mark.unit
def test_shapes_that_diverge_after_save_make_the_run_stale() -> None:
    """Saved same-shape, then one source query was edited to another shape: run is
    drift (409 `query_stale`), and the last good output stays as it was."""
    with TestClient(app) as client:
        ws, ds = _seed(client)
        a = _q(client, ws, ds, "a", _by_status(["status"]))
        b = _q(client, ws, ds, "b", _by_status(["status"]))
        wid = _wf(client, ws, [a, b]).json()["id"]
        first = client.post(f"/workflows/{wid}/run")
        edit = client.put(f"/queries/{b}", json={"definition": {**_EMPTY, "steps": _by_status(["month"])}})
        again = client.post(f"/workflows/{wid}/run")
        rows = client.get(f"/workflows/{wid}/rows?unpaged=true")

    assert first.status_code == 200
    assert edit.status_code == 200, edit.text
    assert again.status_code == 409
    assert again.json() == {"code": "query_stale"}
    assert rows.status_code == 200 and rows.json()["total"] == 4
