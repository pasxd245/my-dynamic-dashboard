import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response
from tests._excel import two_sheet_workbook


def _post_excel_upload(client: TestClient) -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "excel"},
        files={"file": ("book.xlsx", two_sheet_workbook(), "application/octet-stream")},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["temp_id"]


@pytest.mark.unit
def test_parse_two_sheets_returns_per_sheet_results() -> None:
    with TestClient(app) as client:
        temp_id = _post_excel_upload(client)
        resp = client.post(
            f"/uploads/{temp_id}/parse",
            json={"items": [{"sheet": "Deals"}, {"sheet": "Contacts"}]},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["results"]) == 2
    for item in body["results"]:
        assert item["status"] == "ok"
        assert item["columns"]
        assert item["rowCount"] >= 1
    validate_response("uploads/parse.contract.yaml", 200, body)


@pytest.mark.unit
def test_parse_with_invalid_range_carries_failure_in_body() -> None:
    with TestClient(app) as client:
        temp_id = _post_excel_upload(client)
        resp = client.post(
            f"/uploads/{temp_id}/parse",
            json={
                "items": [
                    {"sheet": "Deals", "parse_options": {"range": "bogus"}},
                    {"sheet": "Contacts"},
                ]
            },
        )
    # range pattern is invalid → 422 at request validation (pattern fails).
    assert resp.status_code == 422


@pytest.mark.unit
def test_parse_unknown_temp_id_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.post(
            "/uploads/tmp_0000000000000000/parse",
            json={"items": [{"sheet": "Deals"}]},
        )
    assert resp.status_code == 404


@pytest.mark.unit
def test_parse_with_unknown_sheet_returns_422() -> None:
    with TestClient(app) as client:
        temp_id = _post_excel_upload(client)
        resp = client.post(
            f"/uploads/{temp_id}/parse",
            json={"items": [{"sheet": "NotASheet"}]},
        )
    assert resp.status_code == 422


@pytest.mark.unit
def test_parse_empty_items_returns_422() -> None:
    with TestClient(app) as client:
        temp_id = _post_excel_upload(client)
        resp = client.post(f"/uploads/{temp_id}/parse", json={"items": []})
    assert resp.status_code == 422
