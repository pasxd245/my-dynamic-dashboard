"""R35: GET /datasets/{id}/rows — paged + ?q= substring filter."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response


_FIXTURES = Path(__file__).parent / "fixtures"


def _commit_csv(client: TestClient, ws_name: str = "Marketing") -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": ws_name}).json()["id"]
    csv_path = _FIXTURES / "sample.csv"
    upload = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("sample.csv", csv_path.read_bytes(), "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": upload["temp_id"], "items": [{"name": "leads"}]},
    ).json()[0]
    return ws, ds["id"]


@pytest.mark.unit
def test_rows_default_page_returns_full_sample() -> None:
    """sample.csv has 3 rows. Default page=1, page_size=50 returns all."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows")

    assert resp.status_code == 200
    body = resp.json()
    assert body["page"] == 1
    assert body["pageSize"] == 50
    assert body["total"] == 3
    assert len(body["rows"]) == 3
    # Row 0: id=1, name=Alice, amount=42.5, signed_up=2024-01-15.
    assert body["rows"][0][0] == "1"  # int cast to VARCHAR
    assert body["rows"][0][1] == "Alice"
    assert body["rows"][0][2] == "42.5"
    assert body["rows"][0][3] == "2024-01-15"  # date cast
    validate_response("datasets/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_rows_explicit_page_size_25_returns_same_payload_shape() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?page_size=25")

    assert resp.status_code == 200
    body = resp.json()
    assert body["pageSize"] == 25
    assert len(body["rows"]) == 3  # only 3 rows total; all fit


@pytest.mark.unit
def test_rows_out_of_range_page_returns_200_with_empty_rows() -> None:
    """Per rows-get.contract.md: page > ceil(total/page_size) is 200-empty,
    not 422 — matches the list-GET "well-formed but matches nothing" rule."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?page=99")

    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["page"] == 99
    assert body["total"] == 3


@pytest.mark.unit
def test_rows_unknown_dataset_id_returns_404_not_found() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets/ds_00000000/rows")

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response("datasets/rows-get.contract.yaml", 404, resp.json())


@pytest.mark.unit
def test_rows_invalid_page_size_returns_422() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?page_size=37")

    assert resp.status_code == 422


@pytest.mark.unit
def test_rows_malformed_id_returns_422() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets/garbage/rows")
    assert resp.status_code == 422


@pytest.mark.unit
def test_rows_q_too_long_returns_422() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        long_q = "x" * 201
        resp = client.get(f"/datasets/{ds_id}/rows?q={long_q}")

    assert resp.status_code == 422


@pytest.mark.unit
def test_rows_q_substring_matches_string_cell() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=Alice")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert len(body["rows"]) == 1
    assert body["rows"][0][1] == "Alice"


@pytest.mark.unit
def test_rows_q_is_case_insensitive() -> None:
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=alice")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][1] == "Alice"


@pytest.mark.unit
def test_rows_q_matches_numeric_cell() -> None:
    """?q=42.5 should match Alice's amount via CAST(amount AS VARCHAR)."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=42.5")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][2] == "42.5"


@pytest.mark.unit
def test_rows_q_matches_date_cell() -> None:
    """?q=2024-01-15 should match Alice's signed_up via CAST(date AS VARCHAR)."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=2024-01-15")

    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["rows"][0][3] == "2024-01-15"


@pytest.mark.unit
def test_rows_q_zero_match_returns_empty_with_total_0() -> None:
    """Zero-match returns 200 with rows=[] and total=0 — not 422."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=ZZZZZ")

    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == []
    assert body["total"] == 0
    assert body["page"] == 1
    assert body["pageSize"] == 50
    validate_response("datasets/rows-get.contract.yaml", 200, body)


@pytest.mark.unit
def test_rows_q_empty_string_treated_as_absent() -> None:
    """An empty ?q= (FE would strip this) — FastAPI's min_length=1 makes
    it 422. The FE contract is: strip empty input before sending."""
    with TestClient(app) as client:
        _ws, ds_id = _commit_csv(client)
        resp = client.get(f"/datasets/{ds_id}/rows?q=")
    assert resp.status_code == 422
