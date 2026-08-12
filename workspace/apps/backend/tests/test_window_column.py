"""R165: the `window_column` transform step — the ORDERED-WINDOW family.

The same append-a-column shape as R163's `group_column`, plus the thing that step
deliberately withheld: an in-window `ORDER BY` and a frame. One kind, four
business operations — share of total, running total, rank in group, previous
period's value.

Covers: the definitional invariant per op (a share sums to 1.0 across a
partition; a running total's last row equals the collapsing `sum`; ties SHARE a
rank and the next rank SKIPS), the empty partition ("across everything") that
`group_column` refuses, the per-op REJECTED-field guards in the sibling steps'
detail vocabulary, output dtypes, drift → 409 `step_invalid` (R165 W-8), the widened Workflow
union, and the FLAGSHIP: the gap trap — on a Jan/Feb/APR axis, "previous month"
for April must read BLANK, never February's number. A positional `LAG` reports
February there; this engine uses a calendar `RANGE … INTERVAL` frame, and that
difference is the whole reason the op exists in this shape.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_workflows import _create as _create_workflow
from tests.test_workflows import _query_source

# A deliberately GAPPED monthly axis: agent a has Jan, Feb and APRIL — no March.
# Rows are already one-per-(agent, month), which is the grain `prior_period` is
# well-defined at (see the model docstring).
_GAP_CSV = (
    b"agent,month,calls\n"
    b"a,2025-01-01,10\n"
    b"a,2025-02-01,20\n"
    b"a,2025-04-01,40\n"
    b"b,2025-01-01,5\n"
    b"b,2025-02-01,7\n"
)

_PREV = {
    "kind": "window_column",
    "op": "prior_period",
    "name": "prev_calls",
    "col": "calls",
    "by": ["agent"],
    "orderBy": [{"col": "month"}],
    "unit": "month",
}


# The union-widening proof uses a share, not `prior_period`: it must prove that
# Workflow folds the same step engine, not re-prove calendar semantics.
_WF_STEP = {"kind": "window_column", "op": "pct_of_total", "name": "share", "col": "amount", "by": []}


def _commit(client: TestClient, csv: bytes, name: str = "monthly") -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "R165"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": (f"{name}.csv", csv, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": name}]}
    ).json()[0]
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, steps: list[dict], name: str = "wc"):
    definition = {"q": None, "filters": [], "advanced": [], "steps": steps}
    return client.post(f"/workspaces/{ws}/queries", json={"name": name, "sourceId": ds_id, "definition": definition})


def _rows(client: TestClient, ws: str, ds_id: str, steps: list[dict], name: str) -> list[list[str | None]]:
    created = _create(client, ws, ds_id, steps, name=name)
    assert created.status_code == 201, created.text
    return client.get(f"/queries/{created.json()['id']}/rows?unpaged=true").json()["rows"]


# ── The flagship: the gap trap ────────────────────────────────────────


@pytest.mark.unit
def test_prior_period_reads_blank_on_a_gap_never_the_wrong_period() -> None:
    """THE test of this round. On Jan / Feb / APRIL, April's "previous month" must
    be NULL — there was no March. A positional `LAG` would hand back February's
    20, silently, and it would look entirely plausible on a dashboard.

    Asserted as a full mapping rather than one cell, so a change that fixes April
    by breaking February cannot pass."""
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        rows = _rows(client, ws, ds_id, [_PREV], "gap")

    # [agent, month, calls, Source.Name, prev_calls]
    got = {(r[0], r[1]): r[4] for r in rows}
    assert got == {
        ("a", "2025-01-01"): None,  # nothing before the first period
        ("a", "2025-02-01"): "10",  # January
        ("a", "2025-04-01"): None,  # ← the trap: NOT February's 20
        ("b", "2025-01-01"): None,
        ("b", "2025-02-01"): "5",
    }
    assert len(rows) == 5  # appending never collapses


@pytest.mark.unit
def test_prior_period_walks_the_calendar_so_the_unit_changes_which_row_matches() -> None:
    """Proof that the frame is calendar arithmetic, not row arithmetic: with
    `unit=quarter`, April's previous period is JANUARY (one quarter back) — a row
    two positions away — while February's is nothing."""
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        rows = _rows(client, ws, ds_id, [{**_PREV, "unit": "quarter"}], "quarterly")

    got = {(r[0], r[1]): r[4] for r in rows}
    assert got[("a", "2025-04-01")] == "10"  # January, one QUARTER back
    assert got[("a", "2025-02-01")] is None  # nothing a quarter before February


@pytest.mark.unit
def test_prior_period_needs_a_period_ALIGNED_axis_which_is_what_date_bucket_emits() -> None:
    """A consequence of the frame worth pinning, because it is the difference
    between the op working and reading blank everywhere.

    `RANGE BETWEEN INTERVAL 1 <unit> PRECEDING AND INTERVAL 1 <unit> PRECEDING` is
    a POINT frame: it matches the row exactly one unit back. On period-aligned
    values (month starts — what `date_bucket` produces) that is precisely
    "last month". On RAW dates (the 15th, then the 3rd) nothing is exactly one
    month back, so every cell reads NULL. Correct, and useless — which is why
    `date_bucket` is the producer of this axis, and why the pair is coupled more
    tightly than any earlier step pair."""
    raw = b"agent,day,calls\na,2025-01-15,10\na,2025-02-03,20\na,2025-03-15,30\n"
    step = {**_PREV, "orderBy": [{"col": "day"}]}
    with TestClient(app) as client:
        ws, ds_id = _commit(client, raw, name="raw")
        unaligned = _rows(client, ws, ds_id, [step], "unaligned")
        # the same data, bucketed to month starts first — now it lines up
        aligned = _rows(
            client,
            ws,
            ds_id,
            [{"kind": "date_bucket", "col": "day", "granularity": "month", "name": "month"}, _PREV],
            "aligned",
        )

    assert [r[-1] for r in unaligned] == [None, None, None]  # Jan 15 → Dec 15 exists nowhere
    assert [r[-1] for r in sorted(aligned, key=lambda r: r[1])] == [None, "10", "20"]


# ── The other three ops, each against its own invariant ───────────────


@pytest.mark.unit
def test_share_of_total_sums_to_one_across_each_partition() -> None:
    """A share is defined by summing to 1.0 over its partition — computed, not a
    typed-in number. Also pins that the output is a RATIO in 0..1: percent
    FORMATTING is presentation and belongs to the widget."""
    step = {"kind": "window_column", "op": "pct_of_total", "name": "share", "col": "calls", "by": ["agent"]}
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        rows = _rows(client, ws, ds_id, [step], "share")

    by_agent: dict[str, float] = {}
    for r in rows:
        by_agent[r[0]] = by_agent.get(r[0], 0.0) + float(r[4])
    assert {k: round(v, 9) for k, v in by_agent.items()} == {"a": 1.0, "b": 1.0}
    # a's January is 10 of (10+20+40)
    assert round(float(next(r[4] for r in rows if r[:2] == ["a", "2025-01-01"])), 6) == round(10 / 70, 6)


@pytest.mark.unit
def test_share_of_total_across_everything_is_the_empty_partition() -> None:
    """`by: []` is legal HERE — `group_column` refuses it, because there an empty
    partition would be a SILENT whole-table window; on this card the surface names
    the case ("Across everything"). Every row's share is over all 82 calls."""
    step = {"kind": "window_column", "op": "pct_of_total", "name": "share", "col": "calls", "by": []}
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        rows = _rows(client, ws, ds_id, [step], "global_share")

    assert round(sum(float(r[4]) for r in rows), 9) == 1.0
    assert round(float(next(r[4] for r in rows if r[:2] == ["a", "2025-04-01"])), 6) == round(40 / 82, 6)


@pytest.mark.unit
def test_running_total_ends_at_the_collapsing_sum_of_the_same_group() -> None:
    """The cumulative invariant, stated against the OTHER family: the LAST row of
    each partition must equal the collapsing `sum` over the same `by`. Both sides
    computed."""
    step = {
        "kind": "window_column",
        "op": "running_total",
        "name": "cum",
        "col": "calls",
        "by": ["agent"],
        "orderBy": [{"col": "month"}],
    }
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        rows = _rows(client, ws, ds_id, [step], "cum")
        collapsed = _rows(
            client,
            ws,
            ds_id,
            [{"kind": "aggregate", "dimensions": ["agent"], "measures": [{"col": "calls", "agg": "sum"}]}],
            "totals",
        )

    last = {r[0]: r[4] for r in sorted(rows, key=lambda r: (r[0], r[1]))}  # last write per agent wins
    assert {r[0]: r[1] for r in collapsed} == last == {"a": "70", "b": "12"}
    # and it ACCUMULATES in order rather than repeating the total
    assert [r[4] for r in sorted(rows, key=lambda r: r[1]) if r[0] == "a"] == ["10", "30", "70"]


@pytest.mark.unit
def test_rank_ties_share_a_rank_and_the_next_rank_skips() -> None:
    """RANK, not ROW_NUMBER. Row numbering would invent an order between equal
    rows, so the same query could reshuffle a tie between runs — a confident wrong
    number by construction (R164 D-7)."""
    csv = b"agent,month,calls\na,2025-01-01,10\nb,2025-01-01,10\nc,2025-01-01,7\nd,2025-01-01,5\n"
    step = {
        "kind": "window_column",
        "op": "rank",
        "name": "rank",
        "by": [],
        "orderBy": [{"col": "calls", "descending": True}],
    }
    with TestClient(app) as client:
        ws, ds_id = _commit(client, csv)
        rows = _rows(client, ws, ds_id, [step], "ranked")

    assert {r[0]: r[4] for r in rows} == {"a": "1", "b": "1", "c": "3", "d": "4"}


# ── Shape: dtypes + the column space ──────────────────────────────────


@pytest.mark.unit
def test_output_dtypes_a_share_is_float_a_rank_is_integer_others_carry_the_source() -> None:
    steps = [
        {"kind": "window_column", "op": "pct_of_total", "name": "share", "col": "calls", "by": ["agent"]},
        {"kind": "window_column", "op": "rank", "name": "rk", "by": [], "orderBy": [{"col": "calls"}]},
        {
            "kind": "window_column",
            "op": "running_total",
            "name": "cum",
            "col": "calls",
            "by": ["agent"],
            "orderBy": [{"col": "month"}],
        },
        _PREV,
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        resolved = client.get(f"/queries/{_create(client, ws, ds_id, steps).json()['id']}").json()["resolvedColumns"]

    assert resolved[-4:] == [
        {"name": "share", "dtype": "float"},
        {"name": "rk", "dtype": "integer"},
        {"name": "cum", "dtype": "integer"},  # carries `calls`
        {"name": "prev_calls", "dtype": "integer"},
    ]


# ── The 422 guards: a rejected field is REFUSED, never ignored ────────


@pytest.mark.unit
@pytest.mark.parametrize(
    ("step", "loc_tail", "msg"),
    [
        # a field the op does not take is refused — a silently-dropped control is
        # how a user gets a column that disregards a setting they made
        (
            {"kind": "window_column", "op": "rank", "name": "r", "col": "calls", "by": [], "orderBy": [{"col": "month"}]},
            "col",
            "window_col_forbidden",
        ),
        (
            {"kind": "window_column", "op": "pct_of_total", "name": "s", "col": "calls", "by": [], "orderBy": [{"col": "month"}]},
            "orderBy",
            "window_order_forbidden",
        ),
        (
            {"kind": "window_column", "op": "pct_of_total", "name": "s", "col": "calls", "by": [], "unit": "month"},
            "unit",
            "window_unit_forbidden",
        ),
        # required-but-missing
        ({"kind": "window_column", "op": "pct_of_total", "name": "s", "by": []}, "col", "window_col_required"),
        ({"kind": "window_column", "op": "rank", "name": "r", "by": []}, "orderBy", "window_order_required"),
        # dtype + shape rules
        ({**_PREV, "orderBy": [{"col": "agent"}]}, "col", "window_order_not_date"),
        ({**_PREV, "orderBy": [{"col": "month", "descending": True}]}, "descending", "window_order_desc"),
        ({**_PREV, "orderBy": [{"col": "month"}, {"col": "month"}]}, "orderBy", "window_order_single"),
        # the sibling steps' vocabulary, unchanged
        ({**_PREV, "col": "nope"}, "col", "unknown_column"),
        ({**_PREV, "by": ["nope"]}, "by", "unknown_column"),
        ({**_PREV, "by": ["agent", "agent"]}, "by", "duplicate_group_column"),
        ({**_PREV, "name": "calls"}, "name", "column_exists"),
        (
            {"kind": "window_column", "op": "pct_of_total", "name": "s", "col": "agent", "by": []},
            "col",
            "measure_not_numeric",
        ),
    ],
)
def test_bad_window_step_is_a_422_in_the_sibling_vocabulary(step: dict, loc_tail: str, msg: str) -> None:
    """Every guard reports at the offending FIELD, with the same detail shape the
    other steps use — so the builder can name the offender at the card."""
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        r = _create(client, ws, ds_id, [step])

    assert r.status_code == 422, r.text
    detail = r.json()["detail"][0]
    assert msg in detail["msg"], detail
    assert str(detail["loc"][-1]) == loc_tail or loc_tail in [str(x) for x in detail["loc"]], detail


@pytest.mark.unit
@pytest.mark.parametrize(("field", "bad"), [("op", "nope"), ("unit", "fortnight")])
def test_the_enums_are_refused_at_the_model_edge_before_the_planner_sees_them(field: str, bad: str) -> None:
    """`op` and `unit` are `Literal`s, so pydantic rejects a bad value at the wire
    before `_plan_window_column` runs — its own guards for these are therefore
    UNREACHABLE through the API, exactly like `duplicate_group_column` is
    unreachable from the multi-select. They are kept as the re-plan backstop and
    proven by the smuggle-in test below."""
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        r = _create(client, ws, ds_id, [{**_PREV, field: bad}])

    assert r.status_code == 422, r.text
    detail = r.json()["detail"][0]
    assert detail["loc"][-1] == field, detail
    assert detail["input"] == bad, detail


@pytest.mark.unit
def test_a_saved_definition_is_re_planned_so_a_bad_op_cannot_be_smuggled_in() -> None:
    """The planner re-validates on every run, not only at the pydantic edge: a
    definition written straight to SQLite behind the API must not become a silent
    wrong window. Same discipline as `date_bucket`'s granularity and
    `group_column`'s `by`."""
    import json

    from app import db

    with TestClient(app) as client:
        ws, ds_id = _commit(client, _GAP_CSV)
        qid = _create(client, ws, ds_id, [_PREV]).json()["id"]
        bad = {"q": None, "filters": [], "advanced": [], "steps": [{**_PREV, "unit": "fortnight"}]}
        with db.get_conn() as con:
            con.execute("UPDATE queries SET definition_json = ? WHERE id = ?", (json.dumps(bad), qid))
            con.commit()
        r = client.get(f"/queries/{qid}/rows?unpaged=true")

    assert r.status_code == 409, r.text
    assert r.json() == {"code": "step_invalid"}  # R165 W-8 — a step, not a predicate


# ── The widened union: one kind serves BOTH nouns ─────────────────────


@pytest.mark.unit
def test_the_step_widens_workflow_too_end_to_end() -> None:
    """`WorkflowDefinition.steps` shares the SAME Python union and folds the SAME
    `_apply_step`, so the contract was widened in both places at the C gate rather
    than discovered here. Proven by running a workflow, not by reading the union."""
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        created = _create_workflow(client, ws, qid, steps=[_WF_STEP])
        assert created.status_code == 201, created.text
        wf = created.json()["id"]
        run = client.post(f"/workflows/{wf}/run")
        assert run.status_code == 200, run.text
        rows = client.get(f"/workflows/{wf}/rows?unpaged=true").json()["rows"]

    assert len(rows) == 3  # sample.csv — appending never collapses
    assert round(sum(float(r[-1]) for r in rows), 9) == 1.0
