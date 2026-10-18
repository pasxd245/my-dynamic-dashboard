"""R175: the steps a real weekly report needed — `case` (the formula-free IF/IFS
conditional column), `date_part`, `date_diff` — plus the literal LIKE operand and
the 24-step ceiling.

Pulled by the weekly-report dogfood: the CRM lead funnel (Excel helper columns +
pivot filter + KPI ratios) rebuilt as ONE saved query, matched number-for-number
against the hand-made `phân tích` sheet. The fixtures below are that funnel in
miniature."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app

# A miniature CRM export: created timestamp, call status, success detail,
# vehicle value, service code. Two months, one row in the previous year.
_LEADS_CSV = (
    "created,status,detail,value,service\n"
    "2026-08-03 09:00:00,Thành công,Acme,450000000,voluntary_car_a\n"
    "2026-08-20 10:00:00,Thất bại,,650000000,web_lp\n"
    "2026-08-31 23:00:00,Mới,,1200000000,webXtra\n"
    "2026-09-01 08:00:00,Thành công,Organic,900000000,voluntary_car_b\n"
    "2026-09-15 08:00:00,Chưa kết nối được,,,compulsory_car\n"
    "2025-12-30 08:00:00,Thành công,Acme,500000000,web_old\n"
).encode()


def _commit(client: TestClient, csv: bytes = _LEADS_CSV) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "R175"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("leads.csv", csv, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={
            "temp_id": up["temp_id"],
            "items": [
                {
                    "name": "leads",
                    "column_overrides": {"created": {"dtype": "datetime", "format": "yyyy-MM-dd HH:mm:ss"}},
                }
            ],
        },
    )
    assert ds.status_code == 201, ds.text
    return ws, ds.json()[0]["id"]


def _defn(steps: list[dict]) -> dict:
    return {"q": None, "filters": [], "advanced": [], "steps": steps}


def _save(client: TestClient, ws: str, ds: str, steps: list[dict], name: str = "q"):
    return client.post(f"/workspaces/{ws}/queries", json={"name": name, "sourceId": ds, "definition": _defn(steps)})


def _run(client: TestClient, ws: str, ds: str, steps: list[dict], name: str = "q") -> tuple[list[dict], list[list]]:
    created = _save(client, ws, ds, steps, name)
    assert created.status_code == 201, created.text
    qid = created.json()["id"]
    cols = client.get(f"/queries/{qid}").json()["resolvedColumns"]
    rows = client.get(f"/queries/{qid}/rows?unpaged=true").json()["rows"]
    return cols, rows


def _col(cols: list[dict], rows: list[list], name: str) -> list:
    """One output column's cells, by NAME (the dataset carries a provenance column)."""
    i = [c["name"] for c in cols].index(name)
    return [r[i] for r in rows]


_BY_CREATED = {"kind": "sort", "keys": [{"col": "created"}]}  # rows in time order (deterministic)


def _c(v):
    return {"kind": "const", "value": v}


# ── case ──────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_case_buckets_a_number_first_match_wins_and_otherwise() -> None:
    step = {
        "kind": "case",
        "name": "size",
        "branches": [
            {"when": [{"col": "value", "op": "lt", "val": 500000000}], "then": _c("small")},
            {"when": [{"col": "value", "op": "lt", "val": 1000000000}], "then": _c("mid")},
            {"when": [{"col": "value", "op": "gte", "val": 1000000000}], "then": _c("large")},
        ],
        "otherwise": _c("unknown"),
    }
    with TestClient(app) as client:
        ws, ds = _commit(client)
        cols, rows = _run(client, ws, ds, [step, _BY_CREATED])
    assert cols[-1] == {"name": "size", "dtype": "string"}
    # by time: 500tr mid (lt is strict) · 450tr small · 650tr mid · 1.2 tỷ large · 900tr mid · NULL → otherwise
    assert _col(cols, rows, "size") == ["mid", "small", "mid", "large", "mid", "unknown"]


@pytest.mark.unit
def test_case_flags_sum_into_conditional_counts() -> None:
    """The weekly-report shape: 0/1 flags summed by an aggregate = COUNTIFS per
    month, then a derive for the conversion rate — one query, no pivot."""
    steps = [
        {"kind": "date_bucket", "col": "created", "granularity": "month", "name": "month"},
        {
            "kind": "case",
            "name": "success",
            "branches": [{"when": [{"col": "status", "op": "equals", "val": "Thành công"}], "then": _c(1)}],
            "otherwise": _c(0),
        },
        {
            "kind": "case",
            "name": "acme",
            "branches": [
                {
                    "when": [
                        {"col": "status", "op": "equals", "val": "Thành công"},
                        {"col": "detail", "op": "equals", "val": "Acme"},
                    ],
                    "then": _c(1),
                }
            ],
            "otherwise": _c(0),
        },
        {
            "kind": "aggregate",
            "dimensions": ["month"],
            "measures": [{"agg": "count"}, {"agg": "sum", "col": "success"}, {"agg": "sum", "col": "acme"}],
        },
        {"kind": "derive", "name": "cr", "left": "success", "op": "/", "right": {"kind": "col", "col": "count"}},
        {"kind": "sort", "keys": [{"col": "month"}]},
    ]
    with TestClient(app) as client:
        ws, ds = _commit(client)
        cols, rows = _run(client, ws, ds, steps)
    assert [c["dtype"] for c in cols] == ["date", "integer", "integer", "integer", "float"]
    assert [r[:4] for r in rows] == [
        ["2025-12-01", "1", "1", "1"],
        ["2026-08-01", "3", "1", "1"],
        ["2026-09-01", "2", "1", "0"],
    ]
    assert float(rows[1][4]) == pytest.approx(1 / 3)


@pytest.mark.unit
def test_case_column_value_fallback_and_null_otherwise() -> None:
    step = {
        "kind": "case",
        "name": "who",
        "branches": [{"when": [{"col": "detail", "op": "is_not_null"}], "then": {"kind": "col", "col": "detail"}}],
    }
    with TestClient(app) as client:
        ws, ds = _commit(client)
        cols, rows = _run(client, ws, ds, [step, _BY_CREATED])
    assert cols[-1]["dtype"] == "string"
    assert _col(cols, rows, "who") == ["Acme", "Acme", None, None, "Organic", None]


@pytest.mark.unit
@pytest.mark.parametrize(
    ("step", "detail"),
    [
        (
            {
                "kind": "case",
                "name": "x",
                "branches": [{"when": [{"col": "status", "op": "equals", "val": "a"}], "then": _c("t")}],
                "otherwise": _c(0),
            },
            "case_type_mismatch",
        ),
        (
            {
                "kind": "case",
                "name": "status",
                "branches": [{"when": [{"col": "status", "op": "equals", "val": "a"}], "then": _c(1)}],
            },
            "column_exists",
        ),
        (
            {
                "kind": "case",
                "name": "x",
                "branches": [{"when": [{"col": "ghost", "op": "equals", "val": "a"}], "then": _c(1)}],
            },
            "unknown_column",
        ),
        (
            {
                "kind": "case",
                "name": "x",
                "branches": [{"when": [{"col": "value", "op": "starts_with", "val": "1"}], "then": _c(1)}],
            },
            "op",
        ),
        (
            {
                "kind": "case",
                "name": "x",
                "branches": [
                    {"when": [{"col": "status", "op": "equals", "val": "a"}], "then": {"kind": "col", "col": "ghost"}}
                ],
            },
            "unknown_column",
        ),
    ],
)
def test_case_save_guards_422(step: dict, detail: str) -> None:
    with TestClient(app) as client:
        ws, ds = _commit(client)
        resp = _save(client, ws, ds, [step])
    assert resp.status_code == 422, resp.text
    assert detail in json.dumps(resp.json(), ensure_ascii=False)


@pytest.mark.unit
def test_case_branch_cap() -> None:
    branch = {"when": [{"col": "status", "op": "equals", "val": "a"}], "then": _c(1)}
    with TestClient(app) as client:
        ws, ds = _commit(client)
        resp = _save(client, ws, ds, [{"kind": "case", "name": "x", "branches": [branch] * 21}])
    assert resp.status_code == 422


# ── date_part / date_diff ───────────────────────────────────────────


@pytest.mark.unit
def test_date_part_extracts_integers() -> None:
    parts = ("year", "quarter", "month", "day", "dow", "week")
    steps = [{"kind": "date_part", "col": "created", "part": p, "name": p} for p in parts] + [_BY_CREATED]
    with TestClient(app) as client:
        ws, ds = _commit(client)
        cols, rows = _run(client, ws, ds, steps)
    assert all(c["dtype"] == "integer" for c in cols[-6:])
    # 2025-12-30 is a Tuesday in ISO week 1 of 2026; 2026-08-03 a Monday, ISO week 32.
    assert [_col(cols, rows, p)[0] for p in parts] == ["2025", "4", "12", "30", "2", "1"]
    assert [_col(cols, rows, p)[1] for p in parts] == ["2026", "3", "8", "3", "1", "32"]


@pytest.mark.unit
def test_date_diff_counts_calendar_boundaries_to_the_cutoff() -> None:
    """ "This month" vs "last month" relative to the DATA's cut-off: the newest
    timestamp (a whole-table group_column) and a month datediff — 31 Aug → 15 Sep
    is one month, 1 Sep → 15 Sep is zero, and nothing is hard-coded."""
    steps = [
        {"kind": "group_column", "name": "cutoff", "agg": "max", "col": "created", "by": []},
        {"kind": "date_diff", "start": "created", "end": "cutoff", "unit": "month", "name": "months_ago"},
        {"kind": "date_diff", "start": "created", "end": "cutoff", "unit": "year", "name": "years_ago"},
        {"kind": "date_diff", "start": "cutoff", "end": "created", "unit": "day", "name": "neg_days"},
        _BY_CREATED,
    ]
    with TestClient(app) as client:
        ws, ds = _commit(client)
        cols, rows = _run(client, ws, ds, steps)
    assert [c["dtype"] for c in cols[-3:]] == ["integer"] * 3  # sort keeps the column space
    assert _col(cols, rows, "months_ago") == ["9", "1", "1", "1", "0", "0"]
    assert _col(cols, rows, "years_ago") == ["1", "0", "0", "0", "0", "0"]
    assert _col(cols, rows, "neg_days")[4] == "-14"


@pytest.mark.unit
@pytest.mark.parametrize(
    ("step", "detail"),
    [
        ({"kind": "date_part", "col": "value", "part": "year", "name": "y"}, "part_col_not_date"),
        ({"kind": "date_part", "col": "created", "part": "century", "name": "y"}, "part"),
        ({"kind": "date_diff", "start": "created", "end": "status", "unit": "day", "name": "d"}, "diff_col_not_date"),
        ({"kind": "date_diff", "start": "created", "end": "created", "unit": "day", "name": "status"}, "column_exists"),
    ],
)
def test_date_step_guards_422(step: dict, detail: str) -> None:
    with TestClient(app) as client:
        ws, ds = _commit(client)
        resp = _save(client, ws, ds, [step])
    assert resp.status_code == 422, resp.text
    assert detail in json.dumps(resp.json())


# ── LIKE operands are literal ───────────────────────────────────────


@pytest.mark.unit
def test_starts_with_underscore_is_literal_not_a_wildcard() -> None:
    """`web_` is a CRM service-code PREFIX; before R175 the `_` was LIKE's
    one-character wildcard, so `webXtra` matched too."""
    step = {"kind": "filter", "predicates": [{"col": "service", "op": "starts_with", "val": "web_"}]}
    with TestClient(app) as client:
        ws, ds = _commit(client)
        cols, rows = _run(client, ws, ds, [step])
    assert sorted(_col(cols, rows, "service")) == ["web_lp", "web_old"]


# ── the ceiling ─────────────────────────────────────────────────────


@pytest.mark.unit
def test_twenty_four_steps_save_and_twenty_five_do_not() -> None:
    sort = {"kind": "sort", "keys": [{"col": "created"}]}
    with TestClient(app) as client:
        ws, ds = _commit(client)
        ok = _save(client, ws, ds, [sort] * 24, name="24")
        too_many = _save(client, ws, ds, [sort] * 25, name="25")
    assert ok.status_code == 201, ok.text
    assert too_many.status_code == 422
    assert "too_many_steps" in too_many.text


@pytest.mark.unit
def test_new_steps_widen_the_workflow_union() -> None:
    """Steps are shared by queries and workflows (`Step` union); the new kinds must
    be accepted on a workflow definition too."""
    with TestClient(app) as client:
        ws, ds = _commit(client)
        q = _save(client, ws, ds, [], name="base").json()["id"]
        wf = client.post(
            f"/workspaces/{ws}/workflows",
            json={
                "name": "wf",
                "definition": {
                    "sources": [q],
                    "steps": [
                        {"kind": "date_part", "col": "created", "part": "month", "name": "m"},
                        {"kind": "date_diff", "start": "created", "end": "created", "unit": "day", "name": "d"},
                        {
                            "kind": "case",
                            "name": "f",
                            "branches": [{"when": [{"col": "m", "op": "equals", "val": 8}], "then": _c(1)}],
                            "otherwise": _c(0),
                        },
                    ],
                },
            },
        )
        assert wf.status_code == 201, wf.text
        run = client.post(f"/workflows/{wf.json()['id']}/run")
    assert run.status_code == 200, run.text
