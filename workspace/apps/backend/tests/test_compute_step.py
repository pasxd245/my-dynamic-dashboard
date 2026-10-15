"""R184: the `compute` step — one function from a closed catalog applied to a
column, appended as a new column. `trim` is the whole catalog today."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response

# The same person typed four ways (trailing space, leading space, NBSP both
# sides, tab) + a blank-ish cell + a clean second person.
_CSV = (
    "agent,calls\n"
    "Ly,1\n"
    "Ly ,2\n"
    " Ly,3\n"
    " Ly ,4\n"
    '"\tLy",5\n'
    "   ,6\n"
    "Minh Anh,7\n"
).encode("utf-8")
_EMPTY = {"q": None, "filters": [], "advanced": []}
_TRIM = {"kind": "compute", "name": "agent_clean", "fn": "trim", "col": "agent"}


def _seed(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "C"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("d.csv", _CSV, "text/csv")}).json()
    ds = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "calls"}]})
    assert ds.status_code == 201, ds.text
    return ws, ds.json()[0]["id"]


def _query(client: TestClient, ws: str, ds: str, steps: list[dict], name: str = "Q"):
    return client.post(f"/workspaces/{ws}/queries", json={"name": name, "sourceId": ds, "definition": {**_EMPTY, "steps": steps}})


@pytest.mark.unit
def test_trim_groups_edge_whitespace_variants_as_one() -> None:
    steps = [
        _TRIM,
        {"kind": "aggregate", "dimensions": ["agent_clean"], "measures": [{"col": "calls", "agg": "sum"}]},
    ]
    with TestClient(app) as client:
        ws, ds = _seed(client)
        q = _query(client, ws, ds, steps)
        assert q.status_code == 201, q.text
        rows = client.get(f"/queries/{q.json()['id']}/rows").json()
        detail = client.get(f"/queries/{q.json()['id']}").json()

    got = {r[0]: r[1] for r in rows["rows"]}
    assert got == {"Ly": "15", "Minh Anh": "7", None: "6"}  # 1+2+3+4+5; the all-space cell is blank
    assert [c["name"] for c in detail["resolvedColumns"]] == ["agent_clean", "calls"]


@pytest.mark.unit
def test_without_trim_the_variants_are_separate_groups() -> None:
    """The control: ingest keeps the edge whitespace, so grouping the raw column
    splits the same person — the gap `trim` closes."""
    agg = [{"kind": "aggregate", "dimensions": ["agent"], "measures": [{"col": "calls", "agg": "sum"}]}]
    with TestClient(app) as client:
        ws, ds = _seed(client)
        q = _query(client, ws, ds, agg).json()
        rows = client.get(f"/queries/{q['id']}/rows").json()["rows"]

    ly_groups = [r[0] for r in rows if r[0] and r[0].strip("\u00a0 \t\n") == "Ly"]
    assert len(ly_groups) >= 4


@pytest.mark.unit
def test_trim_appends_a_string_column_and_keeps_the_source() -> None:
    with TestClient(app) as client:
        ws, ds = _seed(client)
        q = _query(client, ws, ds, [_TRIM]).json()
        rows = client.get(f"/queries/{q['id']}/rows").json()
        detail = client.get(f"/queries/{q['id']}").json()

    names = [c["name"] for c in detail["resolvedColumns"]]
    assert names[:2] == ["agent", "calls"] and names[-1] == "agent_clean"
    assert detail["resolvedColumns"][-1]["dtype"] == "string"
    agent_i, clean_i = names.index("agent"), names.index("agent_clean")
    pairs = [(r[agent_i], r[clean_i]) for r in rows["rows"]]
    assert ("Ly ", "Ly") in pairs and ("Minh Anh", "Minh Anh") in pairs  # source unchanged, inner space kept
    validate_response("queries/detail-get.contract.yaml", 200, detail)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("step", "fragment"),
    [
        ({**_TRIM, "col": "calls"}, "wrong_dtype"),
        ({**_TRIM, "col": "nope"}, "unknown_column"),
        ({**_TRIM, "name": "calls"}, "column_exists"),
    ],
)
def test_bad_compute_is_422_on_save(step: dict, fragment: str) -> None:
    with TestClient(app) as client:
        ws, ds = _seed(client)
        resp = _query(client, ws, ds, [step])

    assert resp.status_code == 422
    assert fragment in resp.text


@pytest.mark.unit
def test_unknown_function_is_rejected_by_the_model() -> None:
    with TestClient(app) as client:
        ws, ds = _seed(client)
        resp = _query(client, ws, ds, [{**_TRIM, "fn": "upper"}])

    assert resp.status_code == 422  # the catalog is closed: not in the enum


@pytest.mark.unit
def test_compute_runs_in_a_workflow_too() -> None:
    with TestClient(app) as client:
        ws, ds = _seed(client)
        qid = _query(client, ws, ds, []).json()["id"]
        wf = client.post(
            f"/workspaces/{ws}/workflows",
            json={
                "name": "W",
                "definition": {
                    "sources": [qid],
                    "steps": [_TRIM, {"kind": "aggregate", "dimensions": ["agent_clean"], "measures": [{"agg": "count"}]}],
                },
            },
        )
        assert wf.status_code == 201, wf.text
        run = client.post(f"/workflows/{wf.json()['id']}/run")
        assert run.status_code == 200, run.text
        rows = client.get(f"/workflows/{wf.json()['id']}/rows").json()

    assert {r[0]: r[1] for r in rows["rows"]} == {"Ly": "5", "Minh Anh": "1", None: "1"}
