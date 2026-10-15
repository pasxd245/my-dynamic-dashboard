"""R178: date coverage — for every `date` / `datetime` column the server profiles
min, max and the blank share over the committed parquet, at commit and at every
refresh (replace / merge / append). Non-temporal columns carry nothing."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response

_V1 = (
    b"id,name,amount,signed_up,seen_at\n"
    b"1,Alice,42.5,2024-01-15,2024-01-15 09:30:00\n"
    b"2,Bob,17.0,,2024-02-03 18:05:00\n"
    b"3,Cara,99.0,2024-03-22,2024-03-22 07:00:00\n"
    b"4,Dan,5.0,2024-02-01,\n"
)
_V2 = _V1 + b"5,Eve,1.0,2025-06-30,2025-06-30 23:59:59\n"
_ALL_BLANK = b"id,when\n1,\n2,\n"


def _upload(client: TestClient, content: bytes, name: str = "export.csv") -> str:
    return client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": (name, content, "text/csv")}).json()[
        "temp_id"
    ]


def _commit(client: TestClient, ws: str, content: bytes) -> dict:
    resp = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": _upload(client, content), "items": [{"name": "leads"}]},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()[0]


def _refresh(client: TestClient, ws: str, ds_id: str, content: bytes, **item) -> dict:
    resp = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={
            "temp_id": _upload(client, content, "export2.csv"),
            "items": [{"name": "IGNORED", "target_dataset_id": ds_id, **item}],
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    return (body["datasets"] if isinstance(body, dict) else body)[0]


def _cov(ds: dict) -> dict[str, dict | None]:
    return {c["name"]: c.get("coverage") for c in ds["columns"]}


@pytest.mark.unit
def test_commit_profiles_temporal_columns_only() -> None:
    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "W"}).json()["id"]
        ds = _commit(client, ws, _V1)
        detail = client.get(f"/datasets/{ds['id']}").json()

    cov = _cov(ds)
    assert cov["signed_up"] == {"min": "2024-01-15", "max": "2024-03-22", "blankShare": 0.25}
    assert cov["seen_at"] == {"min": "2024-01-15T09:30:00", "max": "2024-03-22T07:00:00", "blankShare": 0.25}
    assert cov["id"] is None and cov["name"] is None and cov["amount"] is None
    assert "coverage" not in next(c for c in ds["columns"] if c["name"] == "amount")
    assert _cov(detail) == cov  # persisted, not computed on read
    validate_response("datasets/detail-get.contract.yaml", 200, detail)
    validate_response("datasets/batch-post.contract.yaml", 201, [ds])


@pytest.mark.unit
def test_refresh_recomputes_coverage() -> None:
    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "W"}).json()["id"]
        ds = _commit(client, ws, _V1)
        replaced = _refresh(client, ws, ds["id"], _V2)
        appended = _refresh(client, ws, ds["id"], _V2, refresh_mode="append")

    assert _cov(replaced)["signed_up"] == {"min": "2024-01-15", "max": "2025-06-30", "blankShare": 0.2}
    # append: 5 + 5 rows, 2 blank → 0.2; the range is unchanged.
    assert _cov(appended)["signed_up"] == {"min": "2024-01-15", "max": "2025-06-30", "blankShare": 0.2}
    assert _cov(appended)["seen_at"]["max"] == "2025-06-30T23:59:59"


@pytest.mark.unit
def test_merge_refresh_profiles_the_merged_table() -> None:
    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "W"}).json()["id"]
        ds = _commit(client, ws, _V1)
        merged = _refresh(client, ws, ds["id"], _V2, merge_key=["id"])

    assert _cov(merged)["signed_up"] == {"min": "2024-01-15", "max": "2025-06-30", "blankShare": 0.2}


@pytest.mark.unit
def test_all_blank_column_has_share_one_and_no_range() -> None:
    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "W"}).json()["id"]
        ds = _commit(client, ws, _ALL_BLANK)

    when = next(c for c in ds["columns"] if c["name"] == "when")
    # An all-blank column cannot be typed from its values; whatever dtype the
    # parser picked, a temporal one gets a range-less coverage, a string none.
    if when["dtype"] in ("date", "datetime"):
        assert when["coverage"] == {"blankShare": 1.0}
    else:
        assert "coverage" not in when
