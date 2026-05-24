from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _setup_one_dataset(client: TestClient, ws_name: str = "Marketing") -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": ws_name}).json()["id"]
    csv_path = _FIXTURES / "sample.csv"
    upload = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", csv_path.read_bytes(), "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": upload["temp_id"], "items": [{"name": ws_name + "_leads"}]},
    ).json()[0]
    return ws, ds["id"]


@pytest.mark.unit
def test_datasets_initially_empty() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets")
    assert resp.status_code == 200
    assert resp.json() == []
    validate_response("datasets/get.contract.yaml", 200, resp.json())


@pytest.mark.unit
def test_datasets_lists_after_commit() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _setup_one_dataset(client)
        listed = client.get("/datasets").json()
    ids = [d["id"] for d in listed]
    assert ds_id in ids
    validate_response("datasets/get.contract.yaml", 200, listed)


@pytest.mark.unit
def test_datasets_workspace_id_filter_positive_and_negative() -> None:
    with TestClient(app) as client:
        ws_a, ds_a = _setup_one_dataset(client, "Alpha")
        ws_b, ds_b = _setup_one_dataset(client, "Beta")

        in_a = client.get(f"/datasets?workspace_id={ws_a}").json()
        in_b = client.get(f"/datasets?workspace_id={ws_b}").json()

    assert [d["id"] for d in in_a] == [ds_a]
    assert [d["id"] for d in in_b] == [ds_b]
    assert ws_a != ws_b


@pytest.mark.unit
def test_datasets_filter_no_match_returns_empty() -> None:
    with TestClient(app) as client:
        _setup_one_dataset(client)
        resp = client.get("/datasets?workspace_id=ws_00000000")
    assert resp.status_code == 200
    assert resp.json() == []
