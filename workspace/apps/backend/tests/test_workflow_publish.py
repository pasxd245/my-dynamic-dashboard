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


# --- R192 QA — adversarial ---------------------------------------------------


def _two_source(client: TestClient) -> tuple[str, str]:
    """A workspace with two saved queries over two datasets; a workflow over both, run."""
    ws, q1 = _query_source(client)
    up = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("more.csv", b"id,name,amount,signed_up\n9,Zed,10.5,2024-05-01\n", "text/csv")},
    ).json()
    ds2 = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "more"}]}
    ).json()[0]["id"]
    q2 = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": "more", "sourceId": ds2, "definition": {"q": None, "filters": [], "advanced": []}},
    ).json()["id"]
    wid = client.post(
        f"/workspaces/{ws}/workflows", json={"name": "two", "definition": {"sources": [q1, q2], "steps": []}}
    ).json()["id"]
    assert client.post(f"/workflows/{wid}/run").status_code == 200
    return ws, wid


@pytest.mark.unit
def test_qa_publish_with_the_output_parquet_missing_on_disk_is_never_run_and_writes_nothing() -> None:
    from app.storage import workflow_dir

    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        (workflow_dir(ws, wid) / "output.parquet").unlink()
        resp = client.post(f"/workflows/{wid}/publish")
        n = _dataset_count(client, ws)

    assert resp.status_code == 409 and resp.json() == {"code": "not_publishable", "reason": "never_run"}
    assert n == 1


@pytest.mark.unit
def test_qa_two_source_workflow_publishes_its_source_query_column_visible() -> None:
    with TestClient(app) as client:
        ws, wid = _two_source(client)
        wf_rows = client.get(f"/workflows/{wid}/rows?unpaged=true").json()
        ds = client.post(f"/workflows/{wid}/publish").json()
        ds_rows = client.get(f"/datasets/{ds['id']}/rows?page_size=100").json()

    cols = {c["name"]: c for c in ds["columns"]}
    assert "Source.Query" in cols and not cols["Source.Query"].get("hidden")
    assert ds["rowCount"] == wf_rows["total"] == ds_rows["total"] == 4  # 3 + 1
    assert len(ds["lineage"]["sources"]) == 2


@pytest.mark.unit
def test_qa_republish_after_rename_targets_the_same_dataset_and_after_delete_creates_a_new_one() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        first = client.post(f"/workflows/{wid}/publish").json()
        assert client.patch(f"/datasets/{first['id']}", json={"name": "renamed"}).status_code == 200
        client.post(f"/workflows/{wid}/run")
        again = client.post(f"/workflows/{wid}/publish", json={"name": "ignored"})
        published = client.get(f"/workflows/{wid}").json()["published"]
        assert client.delete(f"/datasets/{first['id']}").status_code == 204
        fresh = client.post(f"/workflows/{wid}/publish", json={"name": "fresh"})
        n = _dataset_count(client, ws)

    assert again.status_code == 200
    assert again.json()["id"] == first["id"] and again.json()["name"] == "renamed"
    assert again.json()["dataVersion"] == 2
    assert published["datasetName"] == "renamed"
    assert fresh.status_code == 201
    assert fresh.json()["id"] != first["id"] and fresh.json()["dataVersion"] == 1
    assert n == 2


@pytest.mark.unit
def test_qa_two_workflows_publish_two_datasets_in_one_workspace() -> None:
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        a = _create(client, ws, qid, name="a", steps=_NO_STEPS).json()["id"]
        b = _create(client, ws, qid, name="b", steps=[_STEP]).json()["id"]
        client.post(f"/workflows/{a}/run")
        client.post(f"/workflows/{b}/run")
        ra = client.post(f"/workflows/{a}/publish")
        rb = client.post(f"/workflows/{b}/publish")
        ra2 = client.post(f"/workflows/{a}/publish")
        pa = client.get(f"/workflows/{a}").json()["published"]
        pb = client.get(f"/workflows/{b}").json()["published"]
        n = _dataset_count(client, ws)

    assert (ra.status_code, rb.status_code, ra2.status_code) == (201, 201, 200)
    assert ra.json()["id"] != rb.json()["id"]
    assert ra2.json()["id"] == ra.json()["id"]
    assert pa["datasetId"] == ra.json()["id"] and pb["datasetId"] == rb.json()["id"]
    assert pb["dataVersion"] == 1  # a's re-publish did not touch b's dataset
    assert n == 3


@pytest.mark.unit
def test_qa_publish_name_case_collision_behaves_like_an_upload_commit() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)  # the upload is named "leads"
        up = client.post(
            "/uploads", data={"sourceFormat": "csv"}, files={"file": ("x.csv", b"a\n1\n", "text/csv")}
        ).json()
        upload_case = client.post(
            f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "LEADS"}]}
        )
        publish_case = client.post(f"/workflows/{wid}/publish", json={"name": "Leads"})

    # Whatever the upload commit does with a case-different name, publish does the same.
    assert (upload_case.status_code == 409) == (publish_case.status_code == 409), (
        upload_case.status_code,
        publish_case.status_code,
    )


@pytest.mark.unit
def test_qa_aggregate_over_the_published_dataset_matches_the_workflow_rows() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client, steps=[_STEP])
        wf_rows = client.get(f"/workflows/{wid}/rows?unpaged=true").json()
        ds = client.post(f"/workflows/{wid}/publish").json()
        q = client.post(
            f"/workspaces/{ws}/queries",
            json={"name": "pub", "sourceId": ds["id"], "definition": {"q": None, "filters": [], "advanced": []}},
        ).json()["id"]
        agg = client.post(
            f"/queries/{q}/aggregate", json={"dimensions": [], "measures": [{"col": "amount", "agg": "sum"}]}
        )
        by = client.post(
            f"/queries/{q}/aggregate", json={"dimensions": ["name"], "measures": [{"col": "amount", "agg": "sum"}]}
        )

    assert agg.status_code == 200, agg.text
    validate_response("queries/aggregate.contract.yaml", 200, agg.json())
    wf_total = sum(float(r[1]) for r in wf_rows["rows"])  # [name, amount]
    assert abs(float(agg.json()["rows"][0][0]) - wf_total) < 1e-9
    assert {r[0]: float(r[1]) for r in by.json()["rows"]} == {r[0]: float(r[1]) for r in wf_rows["rows"]}


@pytest.mark.unit
def test_qa_dataset_list_with_a_published_dataset_validates_against_its_contract() -> None:
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        client.post(f"/workflows/{wid}/publish")
        client.post(f"/workflows/{wid}/run")
        client.post(f"/workflows/{wid}/publish")
        listed = client.get(f"/datasets?workspace_id={ws}")
        detail = client.get(f"/datasets/{[d for d in listed.json() if d['sourceFormat'] == 'workflow'][0]['id']}")

    assert listed.status_code == 200
    validate_response("datasets/get.contract.yaml", 200, listed.json())
    validate_response("datasets/detail-get.contract.yaml", 200, detail.json())
    pub = [d for d in listed.json() if d["sourceFormat"] == "workflow"]
    assert len(pub) == 1 and pub[0]["lineage"]["runNumber"] == 2 and pub[0]["dataVersion"] == 2
    assert "publishedWorkflowId" not in pub[0] and "published_workflow_id" not in pub[0]


@pytest.mark.unit
def test_qa_a_workflow_over_another_workflow_publishes_with_the_upstream_in_lineage() -> None:
    with TestClient(app) as client:
        ws, qid, up_wid = _ran(client)
        down = client.post(
            f"/workspaces/{ws}/workflows", json={"name": "down", "definition": {"sources": [up_wid], "steps": []}}
        ).json()["id"]
        assert client.post(f"/workflows/{down}/run").status_code == 200
        ds = client.post(f"/workflows/{down}/publish")
        client.post(f"/workflows/{up_wid}/run")  # upstream re-ran → downstream is out of date
        stale = client.post(f"/workflows/{down}/publish")
        version = client.get(f"/datasets/{ds.json()['id']}").json()["dataVersion"]

    assert ds.status_code == 201, ds.text
    assert [s["id"] for s in ds.json()["lineage"]["sources"]] == [up_wid]
    assert stale.status_code == 409 and stale.json()["reason"] == "stale"
    assert stale.json()["staleSources"][0]["reason"] == "source_rerun"
    assert version == 1


@pytest.mark.unit
def test_republishing_the_same_run_changes_nothing() -> None:
    """R192 review — re-publishing the run that is already published answers the
    dataset as it is: no version bump, so nothing downstream reads "refreshed"."""
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        first = client.post(f"/workflows/{wid}/publish").json()
        again = client.post(f"/workflows/{wid}/publish")

    assert again.status_code == 200
    assert again.json()["dataVersion"] == first["dataVersion"] == 1
    assert again.json()["refreshedAt"] == first["refreshedAt"]


@pytest.mark.unit
def test_an_uploads_file_name_column_stays_hidden_when_published() -> None:
    """R192 review (BA F-2) — `Source.Name` passing through the workflow is hidden
    on the published dataset, as on the upload."""
    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        ds = client.post(f"/workflows/{wid}/publish").json()

    cols = {c["name"]: c for c in ds["columns"]}
    assert cols["Source.Name"].get("hidden") is True
    assert not cols["name"].get("hidden")


@pytest.mark.unit
def test_a_run_finishing_during_the_publish_refuses_it(monkeypatch: pytest.MonkeyPatch) -> None:
    """R192 review (R2) — the output is copied after the stamp was read; if the
    workflow ran again meanwhile, the copy may be the new run's rows under the old
    stamp. The publish is refused as stale and writes nothing."""
    import app.routers.workflows as wf_router

    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        real_stage = wf_router._stage

        def stage_then_rerun(dest_dir, output, cols):  # type: ignore[no-untyped-def]
            n = real_stage(dest_dir, output, cols)
            with db.get_conn() as con:
                con.execute("UPDATE workflows SET run_id = 'run_99999999' WHERE id = ?", (wid,))
                con.commit()
            return n

        monkeypatch.setattr(wf_router, "_stage", stage_then_rerun)
        resp = client.post(f"/workflows/{wid}/publish")
        n = _dataset_count(client, ws)

    assert resp.status_code == 409 and resp.json() == {"code": "not_publishable", "reason": "stale"}
    assert n == 1


@pytest.mark.unit
def test_republish_replaces_a_dataset_whose_directory_was_lost() -> None:
    """R192 review (QA P2-3) — a published dataset whose files vanished from disk
    is re-published into place instead of failing with a 500."""
    import shutil

    from app.storage import dataset_dir

    with TestClient(app) as client:
        ws, qid, wid = _ran(client)
        ds = client.post(f"/workflows/{wid}/publish").json()
        shutil.rmtree(dataset_dir(ws, ds["id"]))
        client.post(f"/workflows/{wid}/run")
        again = client.post(f"/workflows/{wid}/publish")
        rows = client.get(f"/datasets/{ds['id']}/rows").json()

    assert again.status_code == 200 and again.json()["dataVersion"] == 2
    assert rows["total"] == ds["rowCount"]
