"""R154 — GET /datasets/{id}/profile: on-demand DuckDB column profile.

Covers: exact per-column stats on a full scan (null/distinct/min-max/sample,
per-dtype), the `format` fold-in from commitSettings, the cost-guard sampling
branch (approx + sampledRows), 404, and the read-only doctrine (a profile
never rewrites the parquet).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.storage import dataset_dir
from tests._conformance import validate_response

_CONTRACT = "datasets/profile-get.contract.yaml"

# 4 rows with known nulls/distincts across dtypes:
#   id       integer  no nulls, distinct 4, min 1 max 4
#   name     string   no nulls, distinct 3 (Alice x2), sample present
#   amount   float    1 null,  distinct 2, min 10.0 max 42.5
#   signed_up date    1 null,  distinct 3
_CSV = (
    b"id,name,amount,signed_up\n"
    b"1,Alice,42.5,2024-01-15\n"
    b"2,Bob,,2024-02-03\n"
    b"3,Alice,42.5,\n"
    b"4,Cara,10.0,2024-03-01\n"
)


def _make_workspace(client: TestClient, name: str = "Ops") -> str:
    return client.post("/workspaces", json={"name": name}).json()["id"]


def _csv_upload(client: TestClient, content: bytes) -> str:
    resp = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("export.csv", content, "text/csv")},
    )
    return resp.json()["temp_id"]


def _create_dataset(client: TestClient, ws: str, content: bytes = _CSV, item: dict | None = None) -> dict:
    temp = _csv_upload(client, content)
    resp = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": temp, "items": [item or {"name": "deals"}]},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()[0]


def _by_name(body: dict) -> dict[str, dict]:
    return {c["name"]: c for c in body["columns"]}


@pytest.mark.unit
def test_profile_full_scan_exact_stats() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)

        resp = client.get(f"/datasets/{ds['id']}/profile")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        validate_response(_CONTRACT, 200, body)

        assert body["datasetId"] == ds["id"]
        assert body["rowCount"] == 4
        assert body["approx"] is False
        assert body["sampledRows"] is None

        cols = _by_name(body)
        # every column carries the base stats
        assert cols["id"]["nullCount"] == 0
        assert cols["id"]["distinctCount"] == 4
        # amount: 1 of 4 null → 25%, distinct 2, numeric min/max present
        assert cols["amount"]["nullCount"] == 1
        assert cols["amount"]["nullPct"] == 25.0
        assert cols["amount"]["distinctCount"] == 2
        assert cols["amount"]["min"] == "10.0"
        assert cols["amount"]["max"] == "42.5"
        assert cols["amount"]["sample"] is None  # numeric → no top-k
        # signed_up: date, 1 null, min/max as ISO strings
        assert cols["signed_up"]["nullCount"] == 1
        assert cols["signed_up"]["min"] == "2024-01-15"
        assert cols["signed_up"]["max"] == "2024-03-01"


@pytest.mark.unit
def test_profile_string_column_gets_sample_not_minmax() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)

        cols = _by_name(client.get(f"/datasets/{ds['id']}/profile").json())
        name = cols["name"]
        assert name["min"] is None and name["max"] is None  # strings have no min/max
        assert name["distinctCount"] == 3
        assert name["sample"] is not None
        # top-k is most-frequent-first; Alice appears twice → leads
        assert name["sample"][0] == "Alice"
        assert set(name["sample"]) <= {"Alice", "Bob", "Cara"}


@pytest.mark.unit
def test_profile_folds_in_format_from_commit_settings() -> None:
    """The date/datetime `format` lives in commitSettings, not the Column — the
    profile folds it onto the matching column; other columns report null."""
    csv = b"when\n15/01/2024\n03/02/2024\n"
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(
            client,
            ws,
            content=csv,
            item={"name": "events", "column_overrides": {"when": {"dtype": "date", "format": "dd/MM/yyyy"}}},
        )

        body = client.get(f"/datasets/{ds['id']}/profile").json()
        validate_response(_CONTRACT, 200, body)
        assert _by_name(body)["when"]["format"] == "dd/MM/yyyy"


@pytest.mark.unit
def test_profile_no_format_override_reports_null() -> None:
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        cols = _by_name(client.get(f"/datasets/{ds['id']}/profile").json())
        # no overrides committed → every format null
        assert all(c["format"] is None for c in cols.values())


@pytest.mark.unit
def test_profile_cost_guard_samples_above_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    """Above PROFILE_FULL_SCAN_MAX_ROWS the profile is sampled + flagged approx.
    Force the threshold below the row count to exercise the USING SAMPLE branch
    without a 200k-row fixture."""
    import app.routers.datasets as datasets_router

    monkeypatch.setattr(datasets_router, "PROFILE_FULL_SCAN_MAX_ROWS", 1)
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)  # 4 rows > threshold 1

        body = client.get(f"/datasets/{ds['id']}/profile").json()
        validate_response(_CONTRACT, 200, body)
        assert body["approx"] is True
        assert body["sampledRows"] == 1  # sampled down to the threshold
        assert body["rowCount"] == 4  # rowCount stays the full committed count


@pytest.mark.unit
def test_profile_unknown_dataset_returns_404() -> None:
    with TestClient(app) as client:
        resp = client.get("/datasets/ds_deadbeef/profile")
    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}
    validate_response(_CONTRACT, 404, resp.json())


@pytest.mark.unit
def test_profile_never_touches_the_parquet() -> None:
    """Read-only doctrine: profiling computes over the parquet, never rewrites
    it (the R152/R153 presentation-vs-compute boundary)."""
    with TestClient(app) as client:
        ws = _make_workspace(client)
        ds = _create_dataset(client, ws)
        parquet = dataset_dir(ws, ds["id"]) / "parsed.parquet"
        before = parquet.read_bytes()

        client.get(f"/datasets/{ds['id']}/profile")

        assert parquet.read_bytes() == before  # byte-identical — not rewritten
