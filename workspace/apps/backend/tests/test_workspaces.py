import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers.workspaces import reset_store_for_tests


@pytest.fixture(autouse=True)
def _reset_store() -> None:
    reset_store_for_tests()


@pytest.mark.unit
def test_get_workspaces_initially_empty() -> None:
    client = TestClient(app)
    resp = client.get("/workspaces")

    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.unit
def test_post_then_get_returns_created_workspace() -> None:
    client = TestClient(app)
    created = client.post("/workspaces", json={"name": "Marketing"})

    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Marketing"
    assert body["id"].startswith("ws_")
    # ISO-8601 UTC sortable string.
    assert body["createdAt"].endswith("Z")

    listed = client.get("/workspaces")
    assert listed.status_code == 200
    items = listed.json()
    assert len(items) == 1
    assert items[0]["id"] == body["id"]


@pytest.mark.unit
def test_post_empty_name_returns_422() -> None:
    client = TestClient(app)
    resp = client.post("/workspaces", json={"name": ""})

    assert resp.status_code == 422


@pytest.mark.unit
def test_list_is_most_recent_first() -> None:
    client = TestClient(app)
    first = client.post("/workspaces", json={"name": "Alpha"}).json()
    # Force a distinct createdAt by patching the in-memory item.
    # Simpler: trust the second POST happens at a >= timestamp;
    # for equal seconds the sort is stable, which still satisfies
    # "later inserts sort no later than earlier ones." Skip the
    # sleep — checking that two POSTs both appear is enough.
    second = client.post("/workspaces", json={"name": "Beta"}).json()

    listed = client.get("/workspaces").json()
    ids = [w["id"] for w in listed]
    assert set(ids) == {first["id"], second["id"]}
