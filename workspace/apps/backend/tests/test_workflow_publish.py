"""R192 (item 3.6a) — POST /workflows/{id}/publish: a workflow's frozen output
published as a dataset with server-written lineage.

Covers the design's acceptance (workflows.md § Publish): (a) publish twice → one
dataset, version 1 then 2, lineage = the second run; (b) never-run / unstamped /
stale / self-reading each refuse and write nothing; (c) a query reads it; (d) a
workflow reading it flags `data_refreshed` after a re-publish; (e) deleting the
workflow keeps it; (f) an upload refresh into it is refused and its refresh
settings say unavailable; (g) only the server writes lineage; (h) a re-publish
keeps `hidden` on surviving columns and takes the new columns; (i)
`Workflow.published` names it.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from tests._conformance import validate_response
from tests.test_workflows import _STEP, _create, _query_source

_NO_STEPS: list = []


def _ran(client: TestClient, steps=None) -> tuple[str, str, str]:
    """A workspace, its query, and a workflow over it that has run once."""
    ws, qid = _query_source(client)
    wid = _create(client, ws, qid, steps=steps if steps is not None else _NO_STEPS).json()["id"]
    assert client.post(f"/workflows/{wid}/run").status_code == 200
    return ws, qid, wid


def _dataset_count(client: TestClient, ws: str) -> int:
    return len(client.get(f"/datasets?workspace_id={ws}").json())


@pytest.mark.unit
def test_first_publish_creates_a_dataset_with_lineage_then_republish_replaces_it() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        wf = client.get(f"/workflows/{wid}").json()
        first = client.post(f"/workflows/{wid}/publish", json={"name": "  Leads (published)  "})
        rows_1 = client.get(f"/datasets/{first.json()['id']}/rows?page_size=100").json()
        client.post(f"/workflows/{wid}/run")
        wf2 = client.get(f"/workflows/{wid}").json()
        second = client.post(f"/workflows/{wid}/publish", json={"name": "ignored on re-publish"})
        n = _dataset_count(client, ws)

    assert first.status_code == 201, first.text
    ds = first.json()
    validate_response("workflows/publish-post.contract.yaml", 201, ds)
    assert ds["name"] == "Leads (published)"  # trimmed
    assert ds["sourceFormat"] == "workflow"
    assert ds["dataVersion"] == 1
    assert ds["rowCount"] == rows_1["total"] > 0
    assert [c["name"] for c in ds["columns"]] == [c["name"] for c in wf["resolvedColumns"]]
    lin = ds["lineage"]
    assert lin["workflowId"] == wid and lin["workflowName"] == wf["name"]
    assert (lin["runId"], lin["runNumber"], lin["runAt"]) == (wf["run"]["id"], 1, wf["materializedAt"])
    assert lin["definitionHash"] == wf["run"]["definitionHash"]
    assert lin["sources"] == wf["run"]["sources"]

    assert second.status_code == 200, second.text
    validate_response("workflows/publish-post.contract.yaml", 200, second.json())
    assert second.json()["id"] == ds["id"]
    assert second.json()["name"] == ds["name"]
    assert second.json()["dataVersion"] == 2
    assert second.json()["lineage"]["runId"] == wf2["run"]["id"]
    assert second.json()["lineage"]["runNumber"] == 2
    assert n == 2  # the upload + ONE published dataset


@pytest.mark.unit
def test_publish_defaults_the_name_to_the_workflow_and_refuses_a_taken_one() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        taken = client.post(f"/workflows/{wid}/publish", json={"name": "leads"})  # the upload's name
        n_after_taken = _dataset_count(client, ws)
        default = client.post(f"/workflows/{wid}/publish")
        blank = client.post(f"/workflows/{wid}/publish", json={"name": "   "})

    assert taken.status_code == 409 and taken.json() == {"code": "name_taken"}
    validate_response("workflows/publish-post.contract.yaml", 409, taken.json())
    assert n_after_taken == 1
    assert default.status_code == 201 and default.json()["name"] == "wf"
    # A re-publish ignores the name entirely (even a blank one).
    assert blank.status_code == 200


@pytest.mark.unit
def test_refusals_write_nothing() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        never = _create(client, ws, qid, name="never", steps=_NO_STEPS).json()["id"]
        r_never = client.post(f"/workflows/{never}/publish")

        stale_id = _create(client, ws, qid, name="stale", steps=_NO_STEPS).json()["id"]
        client.post(f"/workflows/{stale_id}/run")
        with db.get_conn() as con:  # the source dataset was refreshed since the run
            con.execute("UPDATE datasets SET data_version = data_version + 1 WHERE workspace_id = ?", (ws,))
            con.commit()
        r_stale = client.post(f"/workflows/{stale_id}/publish")

        unstamped = _create(client, ws, qid, name="old run", steps=_NO_STEPS).json()["id"]
        client.post(f"/workflows/{unstamped}/run")
        with db.get_conn() as con:  # a run materialized before R187 carries no stamp
            con.execute("UPDATE workflows SET run_id = NULL, run_json = NULL WHERE id = ?", (unstamped,))
            con.commit()
        r_unstamped = client.post(f"/workflows/{unstamped}/publish")
        n = _dataset_count(client, ws)

    assert r_never.status_code == 409 and r_never.json() == {"code": "not_publishable", "reason": "never_run"}
    assert r_unstamped.json() == {"code": "not_publishable", "reason": "never_run"}
    assert r_stale.status_code == 409
    body = r_stale.json()
    assert body["reason"] == "stale" and body["staleSources"][0]["reason"] == "data_refreshed"
    for r in (r_never, r_stale, r_unstamped):
        validate_response("workflows/publish-post.contract.yaml", 409, r.json())
    assert n == 1  # nothing published


@pytest.mark.unit
def test_a_workflow_reading_its_own_published_dataset_is_refused() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        ds_id = client.post(f"/workflows/{wid}/publish").json()["id"]
        # The workflow's source query now reads the dataset it publishes.
        own_q = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "own", "sourceId": ds_id, "definition": {"q": None, "filters": [], "advanced": []}},
        ).json()["id"]
        wf = client.get(f"/workflows/{wid}").json()
        client.put(f"/workflows/{wid}", json={"name": wf["name"], "definition": {"sources": [own_q], "steps": []}})
        client.post(f"/workflows/{wid}/run")
        resp = client.post(f"/workflows/{wid}/publish")
        version = client.get(f"/datasets/{ds_id}").json()["dataVersion"]

    assert resp.status_code == 409 and resp.json() == {"code": "not_publishable", "reason": "reads_itself"}
    assert version == 1


@pytest.mark.unit
def test_a_query_reads_the_published_dataset_and_a_workflow_over_it_goes_stale_on_republish() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client, steps=[_STEP])
        ds = client.post(f"/workflows/{wid}/publish").json()
        q = client.post(
            f"/workspaces/{ws}/queries",
            json={
                "name": "on published",
                "sourceId": ds["id"],
                "definition": {"q": None, "filters": [], "advanced": []},
            },
        ).json()["id"]
        q_rows = client.get(f"/queries/{q}/rows?unpaged=true").json()
        downstream = _create(client, ws, q, name="downstream", steps=_NO_STEPS).json()["id"]
        client.post(f"/workflows/{downstream}/run")
        client.post(f"/workflows/{wid}/run")
        client.post(f"/workflows/{wid}/publish")
        stale = client.get(f"/workflows/{downstream}").json().get("staleSources")

    assert q_rows["total"] == ds["rowCount"]
    assert stale and stale[0]["reason"] == "data_refreshed"


@pytest.mark.unit
def test_deleting_the_workflow_keeps_the_dataset_and_its_lineage() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        ds = client.post(f"/workflows/{wid}/publish").json()
        assert client.delete(f"/workflows/{wid}").status_code == 204
        after = client.get(f"/datasets/{ds['id']}")

    assert after.status_code == 200
    assert after.json()["lineage"]["workflowId"] == wid


@pytest.mark.unit
def test_an_upload_refresh_into_a_published_dataset_is_refused_and_settings_say_unavailable() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        ds = client.post(f"/workflows/{wid}/publish").json()
        settings = client.get(f"/datasets/{ds['id']}/refresh-settings").json()
        up = client.post(
            "/uploads", data={"sourceFormat": "csv"}, files={"file": ("x.csv", b"a\n1\n", "text/csv")}
        ).json()
        refresh = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={"temp_id": up["temp_id"], "items": [{"name": ds["name"], "target_dataset_id": ds["id"]}]},
        )
        version = client.get(f"/datasets/{ds['id']}").json()["dataVersion"]

    assert settings["available"] is False
    assert refresh.status_code == 422
    assert version == 1


@pytest.mark.unit
def test_lineage_cannot_be_written_by_a_client() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        forged = client.post(f"/workflows/{wid}/publish", json={"name": "x", "lineage": {"runId": "run_00000000"}})
        ds = client.post(f"/workflows/{wid}/publish", json={"name": "x"}).json()
        rename = client.patch(f"/datasets/{ds['id']}", json={"name": "y", "lineage": {}})

    assert forged.status_code == 422  # extra field refused
    assert rename.status_code == 422
    assert ds["lineage"]["runNumber"] == 1


@pytest.mark.unit
def test_republish_keeps_hidden_on_surviving_columns_and_takes_the_new_columns() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)  # passthrough: id, name, amount, signed_up, Source.Name
        ds = client.post(f"/workflows/{wid}/publish").json()
        client.patch(f"/datasets/{ds['id']}/columns", json={"hidden": ["name"]})
        wf = client.get(f"/workflows/{wid}").json()
        client.put(f"/workflows/{wid}", json={"name": wf["name"], "definition": {"sources": [qid], "steps": [_STEP]}})
        client.post(f"/workflows/{wid}/run")
        after = client.post(f"/workflows/{wid}/publish").json()

    cols = {c["name"]: c for c in after["columns"]}
    assert list(cols) == ["name", "amount"]
    assert cols["name"].get("hidden") is True
    assert after["dataVersion"] == 2


@pytest.mark.unit
def test_workflow_published_names_the_dataset_and_the_run() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        before = client.get(f"/workflows/{wid}").json()
        ds = client.post(f"/workflows/{wid}/publish").json()
        after = client.get(f"/workflows/{wid}").json()
        client.post(f"/workflows/{wid}/run")
        moved = client.get(f"/workflows/{wid}").json()

    assert "published" not in before
    assert after["published"] == {
        "datasetId": ds["id"],
        "datasetName": ds["name"],
        "dataVersion": 1,
        "runId": after["run"]["id"],
        "runNumber": 1,
    }
    validate_response("workflows/detail-get.contract.yaml", 200, after)
    assert moved["published"]["runId"] != moved["run"]["id"]  # the workflow ran since


@pytest.mark.unit
def test_publish_unknown_workflow_is_404() -> None:
    with TestClient(app) as client:
        resp = client.post("/workflows/wf_00000000/publish")
    assert resp.status_code == 404 and resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_published_dataset_stores_no_original_file() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        ds = client.post(f"/workflows/{wid}/publish").json()

    from app.storage import dataset_dir

    files = sorted(p.name for p in dataset_dir(ws, ds["id"]).iterdir())
    assert files == ["parsed.parquet", "source.json"]
    assert json.loads((dataset_dir(ws, ds["id"]) / "source.json").read_text()) == {"sourceFormat": "workflow"}
