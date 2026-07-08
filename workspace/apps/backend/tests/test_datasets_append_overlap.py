"""R155 § Refresh append — the pre-commit double-count advisory.

`POST /datasets/{id}/append-overlap` compares the staged upload's date range on
a chosen field against the target's committed range (both server-side). Covers
the overlap / disjoint outcomes + ranges, and the 404 (dataset/temp) and 422
(field not committed-date, absent from incoming) guards. Advisory — never
mutates, never blocks.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response

_CONTRACT = "datasets/append-overlap-post.contract.yaml"

# Committed day range [2025-01-10 .. 2025-04-20].
_COMMITTED = b"region,day\nNorth,2025-01-10\nSouth,2025-04-20\n"
# Incoming that OVERLAPS April (mid-April within the committed span).
_INCOMING_OVERLAP = b"region,day\nEast,2025-04-16\nWest,2025-04-29\n"
# Incoming that is DISJOINT (all May, after the committed max).
_INCOMING_DISJOINT = b"region,day\nEast,2025-05-02\nWest,2025-05-30\n"


def _make_workspace(client: TestClient) -> str:
    return client.post("/workspaces", json={"name": "CRM"}).json()["id"]


def _csv_upload(client: TestClient, content: bytes) -> str:
    resp = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("export.csv", content, "text/csv")})
    return resp.json()["temp_id"]


def _create_with_date(client: TestClient, ws: str, content: bytes = _COMMITTED) -> dict:
    temp = _csv_upload(client, content)
    item = {"name": "calls", "column_overrides": {"day": {"dtype": "date", "format": "yyyy-MM-dd"}}}
    resp = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": temp, "items": [item]})
    assert resp.status_code == 201, resp.text
    ds = resp.json()[0]
    assert next(c["dtype"] for c in ds["columns"] if c["name"] == "day") == "date"
    return ds


def _overlap(client: TestClient, ds_id: str, content: bytes, field: str = "day"):
    temp = _csv_upload(client, content)
    return client.post(f"/datasets/{ds_id}/append-overlap", json={"temp_id": temp, "field": field})


@pytest.mark.unit
def test_overlap_detected_with_ranges() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_with_date(client, ws)
        resp = _overlap(client, ds["id"], _INCOMING_OVERLAP)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        validate_response(_CONTRACT, 200, body)
        assert body["overlaps"] is True
        assert body["committedRange"] == {"min": "2025-01-10", "max": "2025-04-20"}
        assert body["incomingRange"] == {"min": "2025-04-16", "max": "2025-04-29"}
        # Intersection = max(mins) .. min(maxes).
        assert body["overlappingRange"] == {"min": "2025-04-16", "max": "2025-04-20"}


@pytest.mark.unit
def test_disjoint_ranges_report_no_overlap() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_with_date(client, ws)
        resp = _overlap(client, ds["id"], _INCOMING_DISJOINT)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        validate_response(_CONTRACT, 200, body)
        assert body["overlaps"] is False
        assert body["incomingRange"] == {"min": "2025-05-02", "max": "2025-05-30"}
        assert "overlappingRange" not in body  # present only when overlaps


@pytest.mark.unit
def test_non_date_field_is_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_with_date(client, ws)
        resp = _overlap(client, ds["id"], _INCOMING_OVERLAP, field="region")
        assert resp.status_code == 422, resp.text
        assert "date/datetime" in str(resp.json()["detail"])


@pytest.mark.unit
def test_field_absent_from_incoming_is_422() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_with_date(client, ws)
        resp = _overlap(client, ds["id"], b"region,other\nEast,x\n", field="day")
        assert resp.status_code == 422, resp.text
        # A committed date column absent from the incoming file cannot be
        # checked — a 422 naming the field (advisory; the caller may append anyway).
        assert "day" in str(resp.json()["detail"])


@pytest.mark.unit
def test_unknown_dataset_and_temp_are_404() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_with_date(client, ws)
        temp = _csv_upload(client, _INCOMING_OVERLAP)
        assert (
            client.post("/datasets/ds_00000000/append-overlap", json={"temp_id": temp, "field": "day"}).status_code
            == 404
        )
        assert (
            client.post(
                f"/datasets/{ds['id']}/append-overlap", json={"temp_id": f"tmp_{'0' * 16}", "field": "day"}
            ).status_code
            == 404
        )
