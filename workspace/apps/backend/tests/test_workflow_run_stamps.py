"""R187 (W-7): a workflow run is stamped by the server — a run id, a per-workflow
run number, the workflow's definition hash, and per source what it read (a query's
definition hash + its datasets' `dataVersion`, a workflow's run id). On read, a
source that moved since the run flags the output stale; the output stays readable.

R174 W-7 measured the opposite: delete the source query and the workflow went on
serving its frozen rows with nothing to say so."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.metadata import definition_version
from tests._conformance import validate_response

_CSV = b"agent,calls\nLy,1\nMinh,2\n"
_CSV2 = b"agent,calls\nLy,5\nMinh,7\n"
_EMPTY = {"q": None, "filters": [], "advanced": []}
_AGG = [{"kind": "aggregate", "dimensions": ["agent"], "measures": [{"col": "calls", "agg": "sum"}]}]


def _upload(client: TestClient, content: bytes) -> str:
    return client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("c.csv", content, "text/csv")}).json()[
        "temp_id"
    ]


def _seed(client: TestClient) -> tuple[str, str, str, str]:
    ws = client.post("/workspaces", json={"name": "S"}).json()["id"]
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": _upload(client, _CSV), "items": [{"name": "calls"}]}
    ).json()[0]["id"]
    qid = client.post(
        f"/workspaces/{ws}/queries", json={"name": "by agent", "sourceId": ds, "definition": {**_EMPTY, "steps": _AGG}}
    ).json()["id"]
    wid = client.post(f"/workspaces/{ws}/workflows", json={"name": "wf", "definition": {"sources": [qid], "steps": []}})
    assert wid.status_code == 201, wid.text
    return ws, ds, qid, wid.json()["id"]


def _refresh(client: TestClient, ws: str, ds: str) -> None:
    r = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": _upload(client, _CSV2), "items": [{"name": "x", "target_dataset_id": ds}]},
    )
    assert r.status_code == 201, r.text


@pytest.mark.unit
def test_a_run_is_stamped_with_what_it_read() -> None:
    with TestClient(app) as client:
        _ws, ds, qid, wid = _seed(client)
        unrun = client.get(f"/workflows/{wid}").json()
        run = client.post(f"/workflows/{wid}/run").json()
        q = client.get(f"/queries/{qid}").json()

    assert "run" not in unrun and "staleSources" not in unrun
    validate_response("workflows/run-post.contract.yaml", 200, run)
    stamp = run["run"]
    assert stamp["number"] == 1
    assert stamp["id"].startswith("run_")
    assert stamp["definitionHash"] == definition_version(run["definition"])
    assert stamp["sources"] == [
        {"id": qid, "definitionHash": definition_version(q["definition"]), "dataVersions": {ds: 1}}
    ]
    assert "staleSources" not in run


@pytest.mark.unit
def test_rerun_counts_up_with_a_new_id() -> None:
    with TestClient(app) as client:
        _ws, _ds, _qid, wid = _seed(client)
        one = client.post(f"/workflows/{wid}/run").json()["run"]
        two = client.post(f"/workflows/{wid}/run").json()["run"]

    assert (one["number"], two["number"]) == (1, 2)
    assert one["id"] != two["id"]
    assert one["definitionHash"] == two["definitionHash"]


@pytest.mark.unit
def test_a_refreshed_dataset_flags_the_output_until_rerun() -> None:
    with TestClient(app) as client:
        ws, ds, qid, wid = _seed(client)
        client.post(f"/workflows/{wid}/run")
        _refresh(client, ws, ds)
        stale = client.get(f"/workflows/{wid}")
        listed = client.get(f"/workspaces/{ws}/workflows").json()
        rows = client.get(f"/workflows/{wid}/rows?unpaged=true").json()["rows"]
        rerun = client.post(f"/workflows/{wid}/run").json()

    validate_response("workflows/detail-get.contract.yaml", 200, stale.json())
    assert stale.json()["staleSources"] == [{"sourceId": qid, "name": "by agent", "reason": "data_refreshed"}]
    assert listed[0]["staleSources"][0]["reason"] == "data_refreshed"
    # The frozen output is still the pre-refresh answer, readable as it was.
    assert {r[0]: float(r[1]) for r in rows} == {"Ly": 1.0, "Minh": 2.0}
    assert "staleSources" not in rerun
    assert rerun["run"]["sources"][0]["dataVersions"] == {ds: 2}


@pytest.mark.unit
def test_an_edited_source_query_flags_definition_changed() -> None:
    with TestClient(app) as client:
        _ws, _ds, qid, wid = _seed(client)
        client.post(f"/workflows/{wid}/run")
        edit = client.put(
            f"/queries/{qid}",
            json={"definition": {**_EMPTY, "q": "Ly", "steps": _AGG}},
        )
        stale = client.get(f"/workflows/{wid}").json()

    assert edit.status_code == 200, edit.text
    assert stale["staleSources"][0]["reason"] == "definition_changed"


@pytest.mark.unit
def test_a_deleted_source_flags_missing_and_the_output_survives() -> None:
    """R174 W-7, inverted: the output still serves (an archive), but no longer reads
    as healthy."""
    with TestClient(app) as client:
        _ws, _ds, qid, wid = _seed(client)
        client.post(f"/workflows/{wid}/run")
        client.delete(f"/queries/{qid}")
        stale = client.get(f"/workflows/{wid}").json()
        rows = client.get(f"/workflows/{wid}/rows")

    assert stale["staleSources"] == [{"sourceId": qid, "reason": "source_missing"}]
    assert rows.status_code == 200 and rows.json()["total"] == 2


@pytest.mark.unit
def test_a_rerun_workflow_source_flags_its_consumer() -> None:
    with TestClient(app) as client:
        ws, _ds, _qid, a = _seed(client)
        client.post(f"/workflows/{a}/run")
        b = client.post(f"/workspaces/{ws}/workflows", json={"name": "B", "definition": {"sources": [a], "steps": []}})
        bid = b.json()["id"]
        run_b = client.post(f"/workflows/{bid}/run").json()
        client.post(f"/workflows/{a}/run")
        stale = client.get(f"/workflows/{bid}").json()

    assert run_b["run"]["sources"][0]["runId"].startswith("run_")
    assert stale["staleSources"] == [{"sourceId": a, "name": "wf", "reason": "source_rerun"}]


@pytest.mark.unit
def test_a_definition_change_clears_the_stamp_but_not_the_count() -> None:
    with TestClient(app) as client:
        _ws, _ds, qid, wid = _seed(client)
        client.post(f"/workflows/{wid}/run")
        client.post(f"/workflows/{wid}/run")
        edited = client.put(
            f"/workflows/{wid}",
            json={"name": "wf", "definition": {"sources": [qid], "steps": [{"kind": "top_n", "col": "calls", "n": 1}]}},
        ).json()
        third = client.post(f"/workflows/{wid}/run").json()

    assert "run" not in edited
    assert third["run"]["number"] == 3


@pytest.mark.unit
def test_no_request_body_can_write_a_stamp() -> None:
    with TestClient(app) as client:
        ws, _ds, qid, wid = _seed(client)
        fake = {"id": "run_00000000", "number": 9, "definitionHash": "x", "sources": []}
        create = client.post(
            f"/workspaces/{ws}/workflows",
            json={"name": "w2", "definition": {"sources": [qid], "steps": []}, "run": fake},
        )
        update = client.put(
            f"/workflows/{wid}", json={"name": "wf", "definition": {"sources": [qid], "steps": []}, "run": fake}
        )

    assert create.status_code == 422
    assert update.status_code == 422
