"""R165 walk W-7: paging must PARTITION the result, not sample it.

``LIMIT ? OFFSET ?`` over a relation with no total order does not partition it.
Each page is an independent execution, free to return rows in a different order,
so ``OFFSET`` slices a re-shuffled relation. Measured on the walk's own chain —
a 96-row `date_bucket → aggregate → prior_period` over the seed telesale data,
paged 25 at a time — pages 1-4 returned 96 rows of which only **63 were
distinct**: 33 rows came back twice and 33 were never returned at all.

Latent since stepped queries shipped (R125): it is a property of the pager, not
of any one step, and it is also the root cause of two symptoms the same walk
reported separately — a jumbled month-over-month tile, and a blank-count that
moved (3 ↔ 4) when an unrelated step was deleted.

The fix is a deterministic TOTAL order in the paged read. The user's explicit
`sort`/`top_n` still leads; every remaining column is appended as a tiebreak.
The SQL-shape tests below pin that contract exactly (no reliance on whether a
given DuckDB build happens to reshuffle), and the end-to-end test asserts the
property a reader actually depends on: every row exactly once, pages agreeing
with the unpaged read.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.ingest.rows_reader import _page_order_sql
from app.main import app

# 24 rows: 4 agents × 6 months. Big enough to page 10 at a time, and shaped so a
# `date_bucket → aggregate` chain produces a multi-page result.
_CSV = b"agent,called_at,duration\n" + b"".join(
    f"{agent},2025-{month:02d}-15,{month * 10}\n".encode() for agent in ("a", "b", "c", "d") for month in range(1, 7)
)

_BUCKET = {"kind": "date_bucket", "col": "called_at", "granularity": "month", "name": "month"}
_AGG = {"kind": "aggregate", "dimensions": ["agent", "month"], "measures": [{"agg": "count"}]}


def _commit(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "W7"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("calls.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "calls"}]}
    ).json()[0]
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, steps: list[dict]) -> str:
    created = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": "paged", "sourceId": ds_id, "definition": {"q": None, "filters": [], "advanced": [], "steps": steps}},
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


# ── the order contract, asserted on the SQL itself ────────────────────


@pytest.mark.unit
def test_every_column_orders_when_the_user_asked_for_no_sort() -> None:
    """No ordering step → the order is arbitrary as a PRESENTATION but must be
    reproducible, so every column participates."""
    assert _page_order_sql([], ["agent", "month", "count"]) == (
        '"agent" ASC NULLS LAST, "month" ASC NULLS LAST, "count" ASC NULLS LAST'
    )


@pytest.mark.unit
def test_the_users_sort_leads_and_the_rest_only_breaks_ties() -> None:
    """The reader asked for `count` descending; that must still be what they get.
    The remaining columns are appended so equal counts land in a fixed order
    instead of an arbitrary one — the difference between a stable page 2 and a
    row appearing twice."""
    steps = [{"kind": "sort", "keys": [{"col": "count", "descending": True}]}]
    assert _page_order_sql(steps, ["agent", "month", "count"]) == (
        '"count" DESC NULLS LAST, "agent" ASC NULLS LAST, "month" ASC NULLS LAST'
    )


@pytest.mark.unit
def test_top_n_supplies_the_leading_key_too_and_the_last_ordering_step_wins() -> None:
    """`top_n` orders as well as caps. And when both appear, the LAST one is what
    the reader sees — anything earlier was re-ordered by it."""
    top = {"kind": "top_n", "col": "count", "n": 5, "descending": True}
    assert _page_order_sql([top], ["agent", "count"]).startswith('"count" DESC NULLS LAST')
    both = [top, {"kind": "sort", "keys": [{"col": "agent", "descending": False}]}]
    assert _page_order_sql(both, ["agent", "count"]) == '"agent" ASC NULLS LAST, "count" ASC NULLS LAST'


@pytest.mark.unit
def test_an_empty_column_space_yields_no_order_clause_rather_than_broken_sql() -> None:
    assert _page_order_sql([], []) == ""


# ── the property a reader depends on ──────────────────────────────────


@pytest.mark.unit
def test_paging_a_stepped_query_returns_each_row_exactly_once() -> None:
    """The W-7 regression, at the endpoint the builder actually calls: walking the
    pages must visit every row once — no duplicate, no omission — and agree with
    the unpaged read."""
    with TestClient(app) as client:
        ws, ds_id = _commit(client)
        qid = _create(client, ws, ds_id, [_BUCKET, _AGG])

        first = client.get(f"/queries/{qid}/rows?page=1&page_size=10").json()
        total = first["total"]
        assert total == 24, first  # 4 agents × 6 months

        paged: list[tuple] = []
        for page in range(1, 4):
            body = client.get(f"/queries/{qid}/rows?page={page}&page_size=10").json()
            paged += [tuple(r) for r in body["rows"]]

        unpaged = [tuple(r) for r in client.get(f"/queries/{qid}/rows?unpaged=true").json()["rows"]]

    assert len(paged) == total
    assert len(set(paged)) == total, "a row was returned on two pages while another was never returned"
    assert paged == unpaged, "the paged walk must agree with the unpaged read, row for row"


@pytest.mark.unit
def test_paging_is_stable_across_identical_requests() -> None:
    """Two identical page requests are two independent executions of the same SQL.
    Without a total order they may disagree; that is what made a reported count
    move when an unrelated step was deleted."""
    with TestClient(app) as client:
        ws, ds_id = _commit(client)
        qid = _create(client, ws, ds_id, [_BUCKET, _AGG])
        again = [client.get(f"/queries/{qid}/rows?page=2&page_size=10").json()["rows"] for _ in range(3)]

    assert again[0] == again[1] == again[2]


@pytest.mark.unit
def test_an_explicit_sort_survives_paging_across_page_boundaries() -> None:
    """The tiebreak must not override the reader's intent: `count` descending stays
    descending when read page by page."""
    steps = [_BUCKET, _AGG, {"kind": "sort", "keys": [{"col": "count", "descending": True}]}]
    with TestClient(app) as client:
        ws, ds_id = _commit(client)
        qid = _create(client, ws, ds_id, steps)
        rows = [r for page in (1, 2, 3) for r in client.get(f"/queries/{qid}/rows?page={page}&page_size=10").json()["rows"]]

    counts = [int(r[2]) for r in rows]
    assert counts == sorted(counts, reverse=True), counts


# ── R165 W-8: two causes, two codes ───────────────────────────────────


@pytest.mark.unit
def test_an_unrunnable_step_and_a_drifted_predicate_carry_DIFFERENT_codes() -> None:
    """The W-8 regression, pinned as the contrast that makes it meaningful.

    Both are 409 on a well-formed request, and before R165 both were `query_stale`
    — so the builder rendered its one filter-shaped sentence for either, and a
    reordered step card was announced as "1 filter references a column that isn't in
    these results" on a query with no filters at all.
    """
    from app import db

    step_def = {
        "q": None,
        "filters": [],
        "advanced": [],
        # `count` is produced BY the aggregate, so a window over it cannot run first.
        "steps": [
            {"kind": "window_column", "op": "running_total", "name": "rt", "col": "count", "by": [], "orderBy": [{"col": "agent"}]},
            {"kind": "aggregate", "dimensions": ["agent"], "measures": [{"agg": "count"}]},
        ],
    }
    pred_def = {"q": None, "filters": [{"col": 99, "op": "equals", "val": "x"}], "advanced": [], "steps": []}

    with TestClient(app) as client:
        ws, ds_id = _commit(client)
        with db.get_conn() as con:
            for qid, defn in (("qr_57e90000", step_def), ("qr_57e90001", pred_def)):
                con.execute(
                    "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (qid, ws, ds_id, qid, json.dumps(defn), "2026-08-13T00:00:00Z"),
                )
            con.commit()
        step_resp = client.get("/queries/qr_57e90000/rows")
        pred_resp = client.get("/queries/qr_57e90001/rows")

        # the same split holds on the PREVIEW path the builder actually calls
        preview = client.post(
            f"/workspaces/{ws}/queries/preview?page=1&page_size=10",
            json={"sourceId": ds_id, "definition": step_def},
        )

    assert step_resp.status_code == 409
    assert step_resp.json() == {"code": "step_invalid"}
    assert pred_resp.status_code == 409
    assert pred_resp.json() == {"code": "query_stale"}
    assert preview.status_code == 409
    assert preview.json() == {"code": "step_invalid"}
