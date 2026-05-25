"""R35: GET /datasets/{id} — single dataset by id."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _commit_dataset(client: TestClient, ws_name: str = "Marketing") -> tuple[str, str]:
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
def test_get_dataset_returns_200_with_committed_shape() -> None:
    with TestClient(app) as client:
        ws_id, ds_id = _commit_dataset(client)
        resp = client.get(f"/datasets/{ds_id}")

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == ds_id
    assert body["workspaceId"] == ws_id
    assert body["name"] == "Marketing_leads"
    assert body["sourceFormat"] == "csv"
    assert "sheetName" not in body  # CSV has no sheet
    assert body["rowCount"] == 3  # sample.csv has 3 data rows
    assert body["columnCount"] == 4
    column_names = [c["name"] for c in body["columns"]]
    assert column_names == ["id", "name", "amount", "signed_up"]

    validate_response("datasets/detail-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_get_dataset_unknown_id_returns_404_not_found_envelope() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets/ds_00000000")

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("datasets/detail-get.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_get_dataset_malformed_id_returns_422() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets/not-a-real-id")

    # FastAPI request-validation envelope (path-param regex miss).
    assert resp.status_code == 422
