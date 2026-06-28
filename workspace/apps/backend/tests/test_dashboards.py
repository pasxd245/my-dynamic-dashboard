"""R101: Dashboard persisted noun — create / list / get / update / delete.

Seeds a workspace + CSV dataset + a saved Query (the widget's `queryId` target)
via the real upload→commit→save path, then exercises the five dashboard routes
against the contracts. Covers the headline value (a dashboard persists + survives
a re-fetch), both per-workspace uniqueness collisions (name + slug), the
cross-workspace-widget 422, and the formula-free widget shape.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"

# amount (col 2, float) > 40 → 2 of 3 rows. The widget's source query.
_QUERY_DEF = {"q": None, "filters": [{"col": 2, "dtype": "float", "op": "gt", "val": 40}], "advanced": []}


def _widget(query_id: str, **over) -> dict:
    """A formula-free bar/sum widget over `query_id` (sample.csv: name/amount)."""
    w = {
        "id": "wdg_00000001",
        "queryId": query_id,
        "title": "Deals by name",
        "chartType": "bar",
        "dimensionCol": "name",
        "measureCol": "amount",
        "agg": "sum",
        "span": 1,
    }
    w.update(over)
    return w


def _seed_query(client: TestClient, ws_name: str = "Marketing") -> tuple[str, str]:
    """Create a workspace + CSV dataset + a saved query; return (ws_id, query_id)."""
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
    qid = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": "Big deals", "sourceId": ds["id"], "definition": _QUERY_DEF},
    ).json()["id"]
    return ws, qid


def _create(client: TestClient, ws: str, *, name="Weekly report", slug="weekly-report", widgets=None):
    return client.post(
        f"/workspaces/{ws}/dashboards",
        json={"name": name, "slug": slug, "definition": {"widgets": widgets or []}},
    )


@pytest.mark.unit
def test_create_persists_and_returns_dashboard() -> None:
    with TestClient(app) as client:
        ws, qid = _seed_query(client)
        resp = _create(client, ws, widgets=[_widget(qid)])

    assert resp.status_code == 201
    body = resp.json()
    assert body["id"].startswith("dsh_")
    assert body["workspaceId"] == ws
    assert body["name"] == "Weekly report"
    assert body["slug"] == "weekly-report"
    assert body["definition"]["widgets"][0]["queryId"] == qid
    assert body["definition"]["widgets"][0]["agg"] == "sum"
    validate_response("dashboards/post.contract.yaml", 201, body)


@pytest.mark.unit
def test_create_empty_definition_is_valid() -> None:
    with TestClient(app) as client:
        ws, _ = _seed_query(client)
        resp = _create(client, ws, widgets=[])

    assert resp.status_code == 201
    assert resp.json()["definition"]["widgets"] == []
    validate_response("dashboards/post.contract.yaml", 201, resp.json())


@pytest.mark.unit
def test_create_persists_across_refetch() -> None:
    """The headline value: a dashboard defined once survives a reload (it's in
    the DB, not FE state) and re-fetches identically."""
    with TestClient(app) as client:
        ws, qid = _seed_query(client)
        created = _create(client, ws, widgets=[_widget(qid)]).json()
        refetched = client.get(f"/dashboards/{created['id']}")

    assert refetched.status_code == 200
    assert refetched.json() == created
    validate_response("dashboards/detail-get.contract.yaml", 200, refetched.json())


@pytest.mark.unit
def test_create_name_collision_is_409_name_taken() -> None:
    with TestClient(app) as client:
        ws, _ = _seed_query(client)
        _create(client, ws, name="Weekly report", slug="weekly-report")
        resp = _create(client, ws, name="Weekly report", slug="different-slug")

    assert resp.status_code == 409
    assert resp.json() == {"code": "name_taken"}


@pytest.mark.unit
def test_create_slug_collision_is_409_slug_taken() -> None:
    with TestClient(app) as client:
        ws, _ = _seed_query(client)
        _create(client, ws, name="Weekly report", slug="weekly-report")
        resp = _create(client, ws, name="Different name", slug="weekly-report")

    assert resp.status_code == 409
    assert resp.json() == {"code": "slug_taken"}


@pytest.mark.unit
def test_two_workspaces_may_share_a_slug() -> None:
    """Slug is unique PER WORKSPACE, so two projects can each have `weekly-report`."""
    with TestClient(app) as client:
        ws_a, _ = _seed_query(client, ws_name="Project A")
        ws_b, _ = _seed_query(client, ws_name="Project B")
        a = _create(client, ws_a, name="Weekly report", slug="weekly-report")
        b = _create(client, ws_b, name="Weekly report", slug="weekly-report")

    assert a.status_code == 201
    assert b.status_code == 201


@pytest.mark.unit
def test_create_widget_with_cross_workspace_query_is_422() -> None:
    """A widget's queryId must be a query in the dashboard's OWN workspace."""
    with TestClient(app) as client:
        ws_a, _ = _seed_query(client, ws_name="Project A")
        _, qid_b = _seed_query(client, ws_name="Project B")
        resp = _create(client, ws_a, widgets=[_widget(qid_b)])

    assert resp.status_code == 422


@pytest.mark.unit
def test_create_sum_widget_without_measure_is_422() -> None:
    with TestClient(app) as client:
        ws, qid = _seed_query(client)
        bad = _widget(qid, agg="sum")
        bad.pop("measureCol")
        resp = _create(client, ws, widgets=[bad])

    assert resp.status_code == 422


@pytest.mark.unit
def test_count_widget_omits_measure() -> None:
    with TestClient(app) as client:
        ws, qid = _seed_query(client)
        w = _widget(qid, agg="count")
        w.pop("measureCol")
        resp = _create(client, ws, widgets=[w])

    assert resp.status_code == 201
    assert "measureCol" not in resp.json()["definition"]["widgets"][0]
    validate_response("dashboards/post.contract.yaml", 201, resp.json())


@pytest.mark.unit
def test_list_returns_workspace_dashboards() -> None:
    with TestClient(app) as client:
        ws, _ = _seed_query(client)
        _create(client, ws, name="first", slug="first")
        _create(client, ws, name="second", slug="second")
        resp = client.get(f"/workspaces/{ws}/dashboards")

    assert resp.status_code == 200
    body = resp.json()
    assert {d["name"] for d in body} == {"first", "second"}
    assert all(d["workspaceId"] == ws for d in body)
    validate_response("dashboards/get.contract.yaml", 200, body)


@pytest.mark.unit
def test_get_unknown_is_404() -> None:
    with TestClient(app) as client:
        resp = client.get("/dashboards/dsh_deadbeef")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_update_full_representation() -> None:
    with TestClient(app) as client:
        ws, qid = _seed_query(client)
        created = _create(client, ws, widgets=[]).json()
        resp = client.put(
            f"/dashboards/{created['id']}",
            json={
                "name": "Weekly report v2",
                "slug": "weekly-report-v2",
                "definition": {"widgets": [_widget(qid)]},
            },
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == created["id"]
    assert body["name"] == "Weekly report v2"
    assert body["slug"] == "weekly-report-v2"
    assert len(body["definition"]["widgets"]) == 1
    validate_response("dashboards/put.contract.yaml", 200, body)


@pytest.mark.unit
def test_update_unknown_is_404() -> None:
    with TestClient(app) as client:
        resp = client.put(
            "/dashboards/dsh_deadbeef",
            json={"name": "x", "slug": "x", "definition": {"widgets": []}},
        )
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_update_slug_collision_is_409() -> None:
    with TestClient(app) as client:
        ws, _ = _seed_query(client)
        _create(client, ws, name="A", slug="taken-slug")
        b = _create(client, ws, name="B", slug="free-slug").json()
        resp = client.put(
            f"/dashboards/{b['id']}",
            json={"name": "B", "slug": "taken-slug", "definition": {"widgets": []}},
        )

    assert resp.status_code == 409
    assert resp.json() == {"code": "slug_taken"}


@pytest.mark.unit
def test_delete_then_404() -> None:
    with TestClient(app) as client:
        ws, _ = _seed_query(client)
        created = _create(client, ws).json()
        first = client.delete(f"/dashboards/{created['id']}")
        again = client.delete(f"/dashboards/{created['id']}")

    assert first.status_code == 204
    assert again.status_code == 404
    assert again.json() == {"code": "not_found"}
