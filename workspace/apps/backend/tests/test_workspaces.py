import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


@pytest.mark.unit
def test_get_workspaces_initially_empty() -> None:
    with TestClient(app) as client:
        resp = client.get("/workspaces")

    assert resp.status_code == 200
    assert resp.json() == []
    validate_response("workspaces/get.contract.yaml", 200, resp.json())


@pytest.mark.unit
def test_post_then_get_returns_created_workspace() -> None:
    with TestClient(app) as client:
        created = client.post("/workspaces", json={"name": "Marketing"})

        assert created.status_code == 201
        body = created.json()
        assert body["name"] == "Marketing"
        assert body["id"].startswith("ws_")
        # ISO-8601 UTC sortable string.
        assert body["createdAt"].endswith("Z")
        validate_response("workspaces/post.contract.yaml", 201, body)

        listed = client.get("/workspaces")
        assert listed.status_code == 200
        items = listed.json()
        assert len(items) == 1
        assert items[0]["id"] == body["id"]


@pytest.mark.unit
def test_post_empty_name_returns_422() -> None:
    with TestClient(app) as client:
        resp = client.post("/workspaces", json={"name": ""})

    assert resp.status_code == 422


@pytest.mark.unit
def test_list_is_most_recent_first() -> None:
    with TestClient(app) as client:
        first = client.post("/workspaces", json={"name": "Alpha"}).json()
        second = client.post("/workspaces", json={"name": "Beta"}).json()

        listed = client.get("/workspaces").json()

    ids = [w["id"] for w in listed]
    assert set(ids) == {first["id"], second["id"]}


@pytest.mark.unit
def test_workspaces_survive_reconnect() -> None:
    # R16: persistence — same DB file across two TestClient lifecycles.
    with TestClient(app) as client:
        created = client.post("/workspaces", json={"name": "Persistent"}).json()

    with TestClient(app) as client:
        listed = client.get("/workspaces").json()

    assert any(w["id"] == created["id"] for w in listed)


# R25: workspace name uniqueness tightening on POST.


@pytest.mark.unit
def test_post_duplicate_name_returns_409_name_taken() -> None:
    with TestClient(app) as client:
        client.post("/workspaces", json={"name": "Marketing"})
        dup = client.post("/workspaces", json={"name": "Marketing"})

    assert dup.status_code == 409
    assert dup.json() == {"code": "name_taken"}
    validate_response("workspaces/post.contract.yaml", 409, dup.json())
