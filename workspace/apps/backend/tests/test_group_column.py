"""R163: the `group_column` transform step — the WITHIN-GROUP column.

Appends a column whose value is an aggregate over the group of rows THIS row
belongs to, WITHOUT collapsing the rows — the non-collapsing half of the
aggregate family, and the primitive that makes "compare a value to its group"
expressible inside ONE query over datasets (no `query⋈query`).

Covers: the definitional invariant (row count unchanged; the value EQUALS the
collapsing aggregate of the same `(agg, col)` over the same `by`, joined back),
the shared NULL policy (`sum`/`avg` coalesce an all-NULL group to 0; `min`/`max`
stay honest NULL), output dtypes mirroring a collapsing measure, the 422 save
guards in the sibling steps' detail vocabulary, drift → 409 `step_invalid` (R165 W-8), the
widened Workflow union, and the FLAGSHIP: the T3 trap — an agent's connect rate
vs their TEAM's, where the two legitimate readings (pooled 71.4% vs
average-of-agents 70.8%) are reachable from the SAME base and differ only by
WHERE the card sits relative to the collapsing aggregate.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app
from tests.test_workflows import _create as _create_workflow
from tests.test_workflows import _query_source


# The grain-alignment brainstorm's T3 fixture (2026-08-07), denormalized to one
# table (the agent→team join is covered elsewhere; this file is about the step).
# Jan+Feb stacked = 10 calls. A1 3/4 = 75.0% · A2 2/3 = 66.7% · A3 2/3 = 66.7%.
# North (A1+A2) pooled = 5/7 = 71.4%; average of its agents' rates = 70.8%.
_T3_CSV = (
    b"agent,team,outcome,sec\n"
    b"A1,North,connected,300\n"
    b"A1,North,no_answer,0\n"
    b"A2,North,connected,120\n"
    b"A3,South,connected,600\n"
    b"A3,South,no_answer,0\n"
    b"A1,North,connected,200\n"
    b"A2,North,connected,90\n"
    b"A2,North,no_answer,0\n"
    b"A3,South,connected,450\n"
    b"A1,North,connected,150\n"
)

# One group whose measure column is entirely NULL (`y`), for the NULL policy.
_NULL_CSV = b"grp,val\nx,1\nx,2\ny,\ny,\n"

_TEAM_SEC = {"kind": "group_column", "name": "team_sec", "agg": "sum", "col": "sec", "by": ["team"]}


def _commit(client: TestClient, csv: bytes, name: str = "calls") -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "R163"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": (f"{name}.csv", csv, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": name}]}
    ).json()[0]
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, steps: list[dict], name: str = "gc"):
    definition = {"q": None, "filters": [], "advanced": [], "steps": steps}
    return client.post(f"/workspaces/{ws}/queries", json={"name": name, "sourceId": ds_id, "definition": definition})


def _rows(client: TestClient, ws: str, ds_id: str, steps: list[dict], name: str) -> list[list[str | None]]:
    """Save a query with `steps` and read its full shaped result."""
    created = _create(client, ws, ds_id, steps, name=name)
    assert created.status_code == 201, created.text
    return client.get(f"/queries/{created.json()['id']}/rows?unpaged=true").json()["rows"]


# ── The definitional invariant ────────────────────────────────────────


@pytest.mark.unit
def test_row_count_unchanged_and_value_equals_the_collapsing_aggregate() -> None:
    """The whole point of the step, stated as an equality against the OTHER
    family: `group_column` must be the collapsing `aggregate` of the same
    `(agg, col)` over the same `by`, joined back to every row — with the row
    count untouched. Both sides are COMPUTED here, so this pins the semantics
    rather than a hand-typed number."""
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        windowed = _rows(client, ws, ds_id, [_TEAM_SEC], "windowed")
        collapsed = _rows(
            client,
            ws,
            ds_id,
            [{"kind": "aggregate", "dimensions": ["team"], "measures": [{"col": "sec", "agg": "sum"}]}],
            "collapsed",
        )

    # rows: [agent, team, outcome, sec, Source.Name, team_sec] — nothing collapsed
    assert len(windowed) == 10
    per_team = {r[1]: r[5] for r in windowed}
    assert {r[0]: r[1] for r in collapsed} == per_team
    assert per_team == {"North": "860", "South": "1050"}  # A1 650 + A2 210 · A3 1050


@pytest.mark.unit
def test_appended_column_dtypes_mirror_a_collapsing_measure() -> None:
    """`avg` → float, `count`/`count_distinct` → integer, `sum`/`min`/`max` keep
    the source dtype — the SAME `_measure_dtype` rule the aggregate step uses."""
    steps = [
        {"kind": "group_column", "name": "team_avg", "agg": "avg", "col": "sec", "by": ["team"]},
        {"kind": "group_column", "name": "team_calls", "agg": "count", "by": ["team"]},
        {"kind": "group_column", "name": "team_agents", "agg": "count_distinct", "col": "agent", "by": ["team"]},
        {"kind": "group_column", "name": "team_max", "agg": "max", "col": "sec", "by": ["team"]},
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        qid = _create(client, ws, ds_id, steps).json()["id"]
        resolved = client.get(f"/queries/{qid}").json()["resolvedColumns"]
        rows = client.get(f"/queries/{qid}/rows?unpaged=true").json()["rows"]

    assert resolved[-4:] == [
        {"name": "team_avg", "dtype": "float"},
        {"name": "team_calls", "dtype": "integer"},
        {"name": "team_agents", "dtype": "integer"},
        {"name": "team_max", "dtype": "integer"},
    ]
    assert len(rows) == 10  # four appended columns, still no collapse
    north = next(r for r in rows if r[1] == "North")
    # base [agent, team, outcome, sec, Source.Name] ++ the four appended columns.
    # North: 7 calls, 2 distinct agents, max 300s, mean 860/7
    assert (north[6], north[7], north[8]) == ("7", "2", "300")
    assert round(float(north[5]), 4) == round(860 / 7, 4)


@pytest.mark.unit
def test_count_in_a_window_counts_the_groups_rows() -> None:
    """The named foot-gun (R163 Risks): `count` in a window is the GROUP'S ROW
    count, not an underlying tally. After an aggregate it counts the aggregated
    rows — which is why rolling a tally up needs `sum`, not `count`."""
    steps = [
        {"kind": "aggregate", "dimensions": ["agent", "team", "outcome"], "measures": [{"agg": "count"}]},
        {"kind": "group_column", "name": "rows_in_team", "agg": "count", "by": ["team"]},
        {"kind": "group_column", "name": "calls_in_team", "agg": "sum", "col": "count", "by": ["team"]},
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        rows = _rows(client, ws, ds_id, steps, "footgun")

    north = next(r for r in rows if r[1] == "North")
    # 4 aggregated rows for North (A1/A2 × connected/no_answer) vs 7 real calls.
    assert (north[4], north[5]) == ("4", "7")


@pytest.mark.unit
def test_null_group_coalesces_for_sum_avg_and_stays_null_for_min_max() -> None:
    """The NULL policy is SHARED with the collapsing aggregate, not re-decided:
    `sum`/`avg` read 0 for an all-NULL group (client `toNum` parity); `min`/`max`
    stay honest NULL. The COALESCE must wrap the WINDOWED call, since `OVER`
    binds to the aggregate itself."""
    steps = [
        {"kind": "group_column", "name": "g_sum", "agg": "sum", "col": "val", "by": ["grp"]},
        {"kind": "group_column", "name": "g_avg", "agg": "avg", "col": "val", "by": ["grp"]},
        {"kind": "group_column", "name": "g_min", "agg": "min", "col": "val", "by": ["grp"]},
        {"kind": "group_column", "name": "g_max", "agg": "max", "col": "val", "by": ["grp"]},
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _NULL_CSV, name="nulls")
        rows = _rows(client, ws, ds_id, steps, "nulls")

    # rows: [grp, val, Source.Name, g_sum, g_avg, g_min, g_max]
    y = next(r for r in rows if r[0] == "y")
    x = next(r for r in rows if r[0] == "x")
    assert (y[3], y[4]) == ("0", "0.0")
    assert (y[5], y[6]) == (None, None)
    assert (x[3], x[5], x[6]) == ("3", "1", "2")


# ── Guards ────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.parametrize(
    ("step", "expected_detail"),
    [
        # a `by` column that does not exist at this step
        ({"kind": "group_column", "name": "g", "agg": "count", "by": ["ghost"]}, "unknown_column"),
        # the same group column twice
        ({"kind": "group_column", "name": "g", "agg": "count", "by": ["team", "team"]}, "duplicate_group_column"),
        # the output name collides with an existing column
        ({"kind": "group_column", "name": "team", "agg": "count", "by": ["team"]}, "column_exists"),
        # `sum` over a string column
        ({"kind": "group_column", "name": "g", "agg": "sum", "col": "agent", "by": ["team"]}, "measure_not_numeric"),
        # a measure that needs a col and has none
        ({"kind": "group_column", "name": "g", "agg": "avg", "by": ["team"]}, "measure_col_required"),
        # `count` must omit col
        ({"kind": "group_column", "name": "g", "agg": "count", "col": "sec", "by": ["team"]}, "measure_col_forbidden"),
        # an unknown measure column
        ({"kind": "group_column", "name": "g", "agg": "sum", "col": "ghost", "by": ["team"]}, "unknown_column"),
    ],
)
def test_bad_group_column_rejected_on_save_422(step: dict, expected_detail: str) -> None:
    """Every guard speaks the SIBLING STEPS' detail vocabulary — the point of
    routing through `_validate_measure` rather than a lookalike."""
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        resp = _create(client, ws, ds_id, [step])

    assert resp.status_code == 422, resp.text
    assert expected_detail in json.dumps(resp.json())


@pytest.mark.unit
@pytest.mark.parametrize(
    "step",
    [
        # `by: []` — the whole table ("% of total") is deliberately out of scope
        {"kind": "group_column", "name": "g", "agg": "count", "by": []},
        # `by` missing entirely
        {"kind": "group_column", "name": "g", "agg": "count"},
        # a blank output name
        {"kind": "group_column", "name": "", "agg": "count", "by": ["team"]},
    ],
)
def test_malformed_group_column_body_rejected_422(step: dict) -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        resp = _create(client, ws, ds_id, [step])

    assert resp.status_code == 422, resp.text


@pytest.mark.unit
def test_empty_by_in_a_saved_definition_is_re_rejected_at_run() -> None:
    """A saved definition is RE-PLANNED on every run and its column names are
    INLINED into the window SQL, so the planner re-checks `by` rather than
    trusting the model — an empty `by` inserted behind the API must never
    silently become a whole-table window."""
    drifted = {
        "q": None,
        "filters": [],
        "advanced": [],
        "steps": [{"kind": "group_column", "name": "g", "agg": "count", "by": []}],
    }
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        with db.get_conn() as con:
            con.execute(
                "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("qr_beefbeef", ws, ds_id, "Empty by", json.dumps(drifted), "2026-08-11T00:00:00Z"),
            )
            con.commit()
        resp = client.get("/queries/qr_beefbeef/rows")

    assert resp.status_code == 409
    # R165 W-8 — a STEP the planner refuses is `step_invalid`; `query_stale` stayed
    # with the drifted PREDICATE it was named for.
    assert resp.json() == {"code": "step_invalid"}


@pytest.mark.unit
def test_drifted_group_column_returns_409_step_invalid() -> None:
    """Post-save schema drift (the `by` column no longer exists) → the run path's
    409, the same as every sibling step."""
    drifted = {
        "q": None,
        "filters": [],
        "advanced": [],
        "steps": [{"kind": "group_column", "name": "g", "agg": "count", "by": ["gone"]}],
    }
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        with db.get_conn() as con:
            con.execute(
                "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("qr_deadfeed", ws, ds_id, "Drifted", json.dumps(drifted), "2026-08-11T00:00:00Z"),
            )
            con.commit()
        detail = client.get("/queries/qr_deadfeed")
        rows = client.get("/queries/qr_deadfeed/rows")

    assert rows.status_code == 409
    assert rows.json() == {"code": "step_invalid"}  # R165 W-8 — a step, not a predicate
    # read paths never error — they just omit the post-step columns
    assert detail.status_code == 200
    assert "resolvedColumns" not in detail.json() or detail.json().get("resolvedColumns") is None


# ── The shared Step union ─────────────────────────────────────────────


@pytest.mark.unit
def test_workflow_accepts_a_group_column_step() -> None:
    """`WorkflowDefinition.steps` shares the Python `Step` union and folds the
    SAME `_apply_step`, so the C gate widened `workflow.yaml` to match rather
    than letting Python accept what the contract forbids."""
    step = {"kind": "group_column", "name": "name_total", "agg": "sum", "col": "amount", "by": ["name"]}
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        created = _create_workflow(client, ws, qid, steps=[step])
        assert created.status_code == 201, created.text
        wid = created.json()["id"]
        run = client.post(f"/workflows/{wid}/run")
        rows = client.get(f"/workflows/{wid}/rows?unpaged=true").json()

    assert run.status_code == 200, run.text
    # `sum` keeps the source column's dtype — `amount` is a float in the fixture
    assert run.json()["resolvedColumns"][-1] == {"name": "name_total", "dtype": "float"}
    # row-preserving: the materialized output keeps the source query's cardinality
    assert rows["total"] == len(rows["rows"]) >= 1


# ── The flagship: the T3 trap, both readings ──────────────────────────


# Steps 1-3 are shared by both readings: tally each agent's outcomes, roll the
# tally up to the agent's own total, then keep only the connected tallies.
_T3_BASE = [
    {"kind": "aggregate", "dimensions": ["agent", "team", "outcome"], "measures": [{"agg": "count"}]},
    {"kind": "group_column", "name": "agent_calls", "agg": "sum", "col": "count", "by": ["agent"]},
    {"kind": "filter", "predicates": [{"col": "outcome", "op": "equals", "val": "connected"}]},
    {"kind": "derive", "name": "agent_rate", "left": "count", "op": "/", "right": {"kind": "col", "col": "agent_calls"}},
]


@pytest.mark.unit
def test_t3_average_of_agents_reading_is_reachable_after_the_aggregate() -> None:
    """The within-group card placed AFTER the collapsing aggregate averages the
    ALREADY-GROUPED values → North = (75.0 + 66.7)/2 = **70.8%**. 6 steps."""
    steps = [
        *_T3_BASE,
        {"kind": "group_column", "name": "team_rate", "agg": "avg", "col": "agent_rate", "by": ["team"]},
        {"kind": "derive", "name": "vs_team", "left": "agent_rate", "op": "-", "right": {"kind": "col", "col": "team_rate"}},
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        rows = _rows(client, ws, ds_id, steps, "avg-of-agents")

    # [agent, team, outcome, count, agent_calls, agent_rate, team_rate, vs_team]
    by_agent = {r[0]: r for r in rows}
    assert round(float(by_agent["A1"][5]) * 100, 1) == 75.0
    assert round(float(by_agent["A2"][5]) * 100, 1) == 66.7
    assert round(float(by_agent["A1"][6]) * 100, 1) == 70.8  # ← the average-of-agents reading
    assert round(float(by_agent["A2"][6]) * 100, 1) == 70.8
    # The deltas a leader reads off the tile. The brainstorm's table says
    # −4.1pt for A2; that was computed from the ROUNDED rates (66.7 − 70.8).
    # Full precision is 66.667 − 70.833 = −4.167 → −4.2. The engine is right and
    # the hand-computed table has a rounding artifact; A1's +4.2 agrees exactly.
    assert round(float(by_agent["A1"][7]) * 100, 1) == 4.2
    assert round(float(by_agent["A2"][7]) * 100, 1) == -4.2


@pytest.mark.unit
def test_t3_pooled_reading_is_reachable_by_rolling_the_underlying_rows_up() -> None:
    """The other legitimate reading — all of North's ROWS pooled: 5/7 =
    **71.4%** — reached by rolling the underlying tallies up within the team
    instead of averaging the per-agent rates. Costs exactly 8 steps, which is
    `_MAX_STEPS` with zero headroom (R162's D-gate arithmetic, now executed)."""
    steps = [
        *_T3_BASE,
        # each agent's row carries its own tally + its own total, so summing them
        # within the team pools the underlying ROWS rather than the rates
        {"kind": "group_column", "name": "team_connected", "agg": "sum", "col": "count", "by": ["team"]},
        {"kind": "group_column", "name": "team_calls", "agg": "sum", "col": "agent_calls", "by": ["team"]},
        {"kind": "derive", "name": "team_rate", "left": "team_connected", "op": "/", "right": {"kind": "col", "col": "team_calls"}},
        {"kind": "derive", "name": "vs_team", "left": "agent_rate", "op": "-", "right": {"kind": "col", "col": "team_rate"}},
    ]
    assert len(steps) == 8  # the ceiling, exactly
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        rows = _rows(client, ws, ds_id, steps, "pooled")

    # [agent, team, outcome, count, agent_calls, agent_rate,
    #  team_connected, team_calls, team_rate, vs_team]
    by_agent = {r[0]: r for r in rows}
    assert (by_agent["A1"][6], by_agent["A1"][7]) == ("5", "7")  # North: 5 connected of 7
    assert round(float(by_agent["A1"][8]) * 100, 1) == 71.4  # ← the pooled reading
    assert round(float(by_agent["A2"][8]) * 100, 1) == 71.4
    # the deltas a leader reads off the tile — and they DISAGREE with the
    # average-of-agents reading above (+3.6/−4.8 vs +4.2/−4.1). That disagreement
    # is the round's whole point: both are right, so which one you get must be
    # legible from the step order alone.
    assert round(float(by_agent["A1"][9]) * 100, 1) == 3.6
    assert round(float(by_agent["A2"][9]) * 100, 1) == -4.8


@pytest.mark.unit
def test_t3_both_readings_come_from_the_same_base_and_differ() -> None:
    """The discrimination itself, in one assertion: the SAME first four steps,
    then a within-group card placed after the aggregate (average-of-agents) vs
    the underlying tallies rolled up (pooled), produce DIFFERENT team numbers.
    A product that silently picked one would be confidently wrong on one of
    them."""
    after = [
        *_T3_BASE,
        {"kind": "group_column", "name": "team_rate", "agg": "avg", "col": "agent_rate", "by": ["team"]},
    ]
    pooled = [
        *_T3_BASE,
        {"kind": "group_column", "name": "team_connected", "agg": "sum", "col": "count", "by": ["team"]},
        {"kind": "group_column", "name": "team_calls", "agg": "sum", "col": "agent_calls", "by": ["team"]},
        {"kind": "derive", "name": "team_rate", "left": "team_connected", "op": "/", "right": {"kind": "col", "col": "team_calls"}},
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit(client, _T3_CSV)
        a = _rows(client, ws, ds_id, after, "after")
        p = _rows(client, ws, ds_id, pooled, "rolled-up")

    north_avg = round(float(next(r for r in a if r[1] == "North")[6]) * 100, 1)
    north_pooled = round(float(next(r for r in p if r[1] == "North")[8]) * 100, 1)
    assert (north_avg, north_pooled) == (70.8, 71.4)
    assert north_avg != north_pooled
