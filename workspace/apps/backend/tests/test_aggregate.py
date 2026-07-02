"""R119: server-side aggregate — POST /queries/{id}/aggregate.

A stateless GROUP BY (dimensions) → measures over a saved query's resolved
rows, computed in DuckDB over the WHOLE result (no row cap). Seeds a small CSV
with a REPEATED categorical (`region`) so grouped summation is exercised, then
covers: grouped sum / count, scalar sum / count, dtype reporting, the
correct-totals-beyond-a-page property, dashboard-filter push-down, the 422 spec
guards, and the inherited 404 / 409 drift semantics.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from tests._conformance import validate_response


# region (string, REPEATED), product (string), amount (integer):
#   EMEA/A/100, EMEA/B/50, APAC/A/200  → SUM(amount) by region = EMEA 150, APAC 200.
_CSV = b"region,product,amount\nEMEA,A,100\nEMEA,B,50\nAPAC,A,200\n"
_EMPTY_DEF = {"q": None, "filters": [], "advanced": []}


def _commit_csv_text(client: TestClient, csv: bytes, ws_name: str = "Agg") -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": ws_name}).json()["id"]
    upload = client.post(
        "/uploads",
        data={"sourceFormat": "csv"},
        files={"file": ("data.csv", csv, "text/csv")},
    ).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": upload["temp_id"], "items": [{"name": "rows"}]},
    ).json()[0]
    return ws, ds["id"]


def _query(client: TestClient, ws: str, ds_id: str, name: str = "All", definition=None) -> str:
    return client.post(
        f"/workspaces/{ws}/queries",
        json={"name": name, "sourceId": ds_id, "definition": definition or _EMPTY_DEF},
    ).json()["id"]


def _agg(client: TestClient, qid: str, body: dict):
    return client.post(f"/queries/{qid}/aggregate", json=body)


def _as_map(body: dict) -> dict[str, str]:
    """Two-column grouped result → {dimension: measure} (cells are strings)."""
    return {row[0]: row[1] for row in body["rows"]}


@pytest.mark.unit
def test_aggregate_grouped_sum() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(client, qid, {"dimensions": ["region"], "measures": [{"col": "amount", "agg": "sum"}]})

    assert resp.status_code == 200
    body = resp.json()
    assert _as_map(body) == {"EMEA": "150", "APAC": "200"}
    assert body["total"] == 2
    assert body["columns"] == [{"name": "region", "dtype": "string"}, {"name": "amount", "dtype": "integer"}]
    validate_response("queries/aggregate.contract.yaml", 200, body)


@pytest.mark.unit
def test_aggregate_count_by_group() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(client, qid, {"dimensions": ["region"], "measures": [{"agg": "count"}]})

    assert resp.status_code == 200
    body = resp.json()
    assert _as_map(body) == {"EMEA": "2", "APAC": "1"}
    assert body["columns"] == [{"name": "region", "dtype": "string"}, {"name": "count", "dtype": "integer"}]
    validate_response("queries/aggregate.contract.yaml", 200, body)


@pytest.mark.unit
def test_aggregate_scalar_sum_over_whole_result() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(client, qid, {"dimensions": [], "measures": [{"col": "amount", "agg": "sum"}]})

    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == [["350"]]  # 100 + 50 + 200
    assert body["total"] == 1
    assert body["columns"] == [{"name": "amount", "dtype": "integer"}]
    validate_response("queries/aggregate.contract.yaml", 200, body)


@pytest.mark.unit
def test_aggregate_scalar_count() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(client, qid, {"dimensions": [], "measures": [{"agg": "count"}]})

    assert resp.status_code == 200
    assert resp.json()["rows"] == [["3"]]


@pytest.mark.unit
def test_aggregate_scalar_sum_is_not_page_capped() -> None:
    """The aggregate has NO LIMIT — a scalar SUM is computed over the whole
    result, not a page slice. 120 rows (> the 100 max page size) of amount=1 →
    SUM = 120, proving the total isn't truncated to a page (the R110 fix)."""
    big = b"region,amount\n" + b"".join(b"X,1\n" for _ in range(120))
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, big)
        qid = _query(client, ws, ds_id)
        resp = _agg(client, qid, {"dimensions": [], "measures": [{"col": "amount", "agg": "sum"}]})

    assert resp.status_code == 200
    assert resp.json()["rows"] == [["120"]]


@pytest.mark.unit
def test_aggregate_dashboard_filter_pushdown() -> None:
    """An R103 dashboard filter (categorical one-of by name) is pushed
    server-side: filtered to region=EMEA, SUM(amount) by product = A 100, B 50
    (the APAC row is excluded before the group-by)."""
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(
            client,
            qid,
            {
                "dimensions": ["product"],
                "measures": [{"col": "amount", "agg": "sum"}],
                "filters": [{"column": "region", "values": ["EMEA"]}],
            },
        )

    assert resp.status_code == 200
    assert _as_map(resp.json()) == {"A": "100", "B": "50"}


@pytest.mark.unit
def test_aggregate_filter_on_absent_column_is_skipped() -> None:
    """Mirrors the client applyFilters: a filter on a column this query lacks is
    ignored (not a 422), so it doesn't blank the widget."""
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(
            client,
            qid,
            {
                "dimensions": ["region"],
                "measures": [{"agg": "count"}],
                "filters": [{"column": "nonexistent", "values": ["whatever"]}],
            },
        )

    assert resp.status_code == 200
    assert _as_map(resp.json()) == {"EMEA": "2", "APAC": "1"}


# ─── R140: avg / min / max / count_distinct ──────────────────────────


@pytest.mark.unit
def test_aggregate_avg_by_group() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(client, qid, {"dimensions": ["region"], "measures": [{"col": "amount", "agg": "avg"}]})

    assert resp.status_code == 200
    body = resp.json()
    assert _as_map(body) == {"EMEA": "75.0", "APAC": "200.0"}
    # avg reports FLOAT regardless of the source column's integer dtype.
    assert body["columns"] == [{"name": "region", "dtype": "string"}, {"name": "amount", "dtype": "float"}]


@pytest.mark.unit
def test_aggregate_min_max_by_group() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        lo = _agg(client, qid, {"dimensions": ["region"], "measures": [{"col": "amount", "agg": "min"}]})
        hi = _agg(client, qid, {"dimensions": ["region"], "measures": [{"col": "amount", "agg": "max"}]})

    assert _as_map(lo.json()) == {"EMEA": "50", "APAC": "200"}
    assert _as_map(hi.json()) == {"EMEA": "100", "APAC": "200"}
    # min/max keep the measure column's dtype (integer here).
    assert lo.json()["columns"][1] == {"name": "amount", "dtype": "integer"}


@pytest.mark.unit
def test_aggregate_count_distinct_by_group() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(
            client, qid, {"dimensions": ["region"], "measures": [{"col": "product", "agg": "count_distinct"}]}
        )

    assert resp.status_code == 200
    body = resp.json()
    # EMEA has products A+B (2 distinct); APAC only A (1).
    assert _as_map(body) == {"EMEA": "2", "APAC": "1"}
    # count_distinct reports INTEGER under the measure column's name.
    assert body["columns"][1] == {"name": "product", "dtype": "integer"}


@pytest.mark.unit
def test_aggregate_min_on_date_column() -> None:
    """min/max accept date/datetime (orderable) columns — the 'earliest sign-up' shape."""
    csv = b"region,signed\nEMEA,2024-03-01\nEMEA,2024-01-15\nAPAC,2024-02-10\n"
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, csv)
        qid = _query(client, ws, ds_id)
        resp = _agg(client, qid, {"dimensions": [], "measures": [{"col": "signed", "agg": "min"}]})

    assert resp.status_code == 200
    body = resp.json()
    assert body["rows"] == [["2024-01-15"]]
    assert body["columns"] == [{"name": "signed", "dtype": "date"}]


@pytest.mark.unit
@pytest.mark.parametrize(
    "body",
    [
        {"dimensions": ["nope"], "measures": [{"agg": "count"}]},  # unknown dimension
        {"dimensions": [], "measures": [{"agg": "sum"}]},  # sum without col
        {"dimensions": [], "measures": [{"col": "amount", "agg": "count"}]},  # count with col
        {"dimensions": [], "measures": [{"col": "nope", "agg": "sum"}]},  # unknown measure col
        {"dimensions": [], "measures": [{"col": "region", "agg": "sum"}]},  # sum on non-numeric
        {"dimensions": [], "measures": [{"col": "region", "agg": "avg"}]},  # R140: avg on non-numeric
        {"dimensions": [], "measures": [{"col": "product", "agg": "min"}]},  # R140: min on non-orderable
        {"dimensions": [], "measures": [{"agg": "count_distinct"}]},  # R140: count_distinct without col
    ],
)
def test_aggregate_bad_spec_returns_422(body: dict) -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        qid = _query(client, ws, ds_id)
        resp = _agg(client, qid, body)

    assert resp.status_code == 422


@pytest.mark.unit
def test_aggregate_unknown_query_returns_404() -> None:
    with TestClient(app) as client:
        resp = _agg(client, "qr_00000000", {"dimensions": [], "measures": [{"agg": "count"}]})

    assert resp.status_code == 404
    assert resp.json() == {"code": "not_found"}


@pytest.mark.unit
def test_aggregate_stale_definition_returns_409_query_stale() -> None:
    """A saved definition that drifted (a predicate atom now references a column
    that no longer exists) → 409 query_stale, inherited from the run path."""
    with TestClient(app) as client:
        ws, ds_id = _commit_csv_text(client, _CSV)
        drifted = {"q": None, "filters": [{"col": 99, "dtype": "string", "op": "equals", "val": "x"}], "advanced": []}
        with db.get_conn() as con:
            con.execute(
                "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("qr_deadbeef", ws, ds_id, "Stale", json.dumps(drifted), "2026-06-13T00:00:00Z"),
            )
            con.commit()
        resp = _agg(client, "qr_deadbeef", {"dimensions": [], "measures": [{"agg": "count"}]})

    assert resp.status_code == 409
    assert resp.json() == {"code": "query_stale"}
