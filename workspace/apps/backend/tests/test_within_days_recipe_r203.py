"""R203 (item 5.3, pulls 4.5) — the "within N days of a start date" RECIPE.

No engine change: five existing steps (R175 `group_column` across everything,
two `date_diff`, two `case`) read a conversion within N days only where it can
be read yet. The builder inserts them as one recipe (`steps.ts` ›
`withinDaysRecipe`); this file pins the recipe's numbers so an engine change
cannot silently break a rate built on it. Design: `queries.md` § the recipe.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

# start (datetime) · end (date, may be blank). The latest start is 2026-09-30 15:00
# → as-of 2026-09-30 for every row unless a filter narrows the rows first.
_CSV = (
    "start,end,team\n"
    "2026-09-01 09:00:00,2026-09-05,A\n"  # age 29 → observed; 4 days → within
    "2026-09-02 10:00:00,2026-09-30,A\n"  # observed; 28 days → outside the window
    "2026-09-03 10:00:00,,B\n"  # observed; no event
    "2026-09-16 23:00:00,2026-09-30,B\n"  # age exactly 14 (calendar) → observed; 14 days → within (boundary)
    "2026-09-10 08:00:00,2026-09-09,A\n"  # observed; end BEFORE start → not within
    "2026-09-20 10:00:00,2026-09-22,B\n"  # age 10 → NOT observed, so not within either
    "2026-09-30 15:00:00,2099-01-01,A\n"  # the latest start; a far-future end must not move the as-of
    ",2026-09-10,A\n"  # no start → observed 0, within 0
).encode()

_N = 14


def _dataset(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "R203"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("w.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={
            "temp_id": up["temp_id"],
            "items": [
                {
                    "name": "w",
                    "column_overrides": {
                        "start": {"dtype": "datetime", "format": "yyyy-MM-dd HH:mm:ss"},
                        "end": {"dtype": "date", "format": "yyyy-MM-dd"},
                    },
                }
            ],
        },
    )
    assert ds.status_code == 201, ds.text
    return ws, ds.json()[0]["id"]


def _k(v):
    return {"kind": "const", "value": v}


def recipe(start: str = "start", end: str = "end", n: int = _N) -> list[dict]:
    """The five steps exactly as the builder inserts them (`withinDaysRecipe`)."""
    as_of, age, lag = f"{start}_as_of", f"{start}_age_days", f"{start}_to_{end}_days"
    obs, within = f"observed_{n}d", f"within_{n}d"
    return [
        {"kind": "group_column", "name": as_of, "agg": "max", "col": start, "by": []},
        {"kind": "date_diff", "start": start, "end": as_of, "unit": "day", "name": age},
        {"kind": "date_diff", "start": start, "end": end, "unit": "day", "name": lag},
        {
            "kind": "case",
            "name": obs,
            "branches": [{"when": [{"col": age, "op": "gte", "val": n}], "then": _k(1)}],
            "otherwise": _k(0),
        },
        {
            "kind": "case",
            "name": within,
            "branches": [
                {
                    "when": [
                        {"col": obs, "op": "equals", "val": 1},
                        {"col": lag, "op": "gte", "val": 0},
                        {"col": lag, "op": "lte", "val": n},
                    ],
                    "then": _k(1),
                }
            ],
            "otherwise": _k(0),
        },
    ]


def _run(client: TestClient, ws: str, ds: str, steps: list[dict], name: str = "q") -> list[dict]:
    created = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": name, "sourceId": ds, "definition": {"q": None, "filters": [], "advanced": [], "steps": steps}},
    )
    assert created.status_code == 201, created.text
    qid = created.json()["id"]
    cols = [c["name"] for c in client.get(f"/queries/{qid}").json()["resolvedColumns"]]
    rows = client.get(f"/queries/{qid}/rows?unpaged=true").json()["rows"]
    return [dict(zip(cols, r)) for r in rows]


def _by_start(rows: list[dict]) -> dict:
    return {(r["start"] or "")[:10]: r for r in rows}


def test_recipe_reads_only_rows_that_can_be_read() -> None:
    with TestClient(app) as client:
        ws, ds = _dataset(client)
        rows = _by_start(_run(client, ws, ds, recipe()))
        obs = {k: r["observed_14d"] for k, r in rows.items()}
        within = {k: r["within_14d"] for k, r in rows.items()}
        assert obs == {
            "2026-09-01": "1",
            "2026-09-02": "1",
            "2026-09-03": "1",
            "2026-09-16": "1",  # calendar day 14 exactly → observed
            "2026-09-10": "1",
            "2026-09-20": "0",  # 10 days old → not yet observable
            "2026-09-30": "0",
            "": "0",  # no start
        }
        assert within == {
            "2026-09-01": "1",
            "2026-09-02": "0",  # 28 days → outside
            "2026-09-03": "0",  # no event
            "2026-09-16": "1",  # day 14 → inside (boundary)
            "2026-09-10": "0",  # end before start
            "2026-09-20": "0",  # event inside the window, but the row is not observable yet
            "2026-09-30": "0",
            "": "0",
        }
        # within ⊂ observed, row by row
        assert all(not (r["within_14d"] == "1" and r["observed_14d"] == "0") for r in rows.values())
        # the as-of is the latest START — the 2099 end does not move it
        assert {r["start_as_of"][:10] for r in rows.values()} == {"2026-09-30"}


def test_recipe_rate_per_period_through_aggregate_and_derive() -> None:
    with TestClient(app) as client:
        ws, ds = _dataset(client)
        steps = [
            *recipe(),
            {"kind": "date_bucket", "col": "start", "granularity": "month", "name": "month"},
            {
                "kind": "aggregate",
                "dimensions": ["month"],
                "measures": [
                    {"agg": "count"},
                    {"agg": "sum", "col": "observed_14d"},
                    {"agg": "sum", "col": "within_14d"},
                ],
            },
            {
                "kind": "derive",
                "name": "rate",
                "left": "within_14d",
                "op": "/",
                "right": {"kind": "col", "col": "observed_14d"},
            },
            {"kind": "sort", "keys": [{"col": "month"}]},
        ]
        rows = _run(client, ws, ds, steps)
        sept = next(r for r in rows if r["month"] == "2026-09-01")
        # 7 rows started in September; 5 observable; 2 within → 40 %, and observed < count flags the
        # month as not yet observable for the full window (item 4.5's flag, as data)
        assert (sept["count"], sept["observed_14d"], sept["within_14d"]) == ("7", "5", "2")
        assert float(sept["rate"]) == 0.4
        blank = next(r for r in rows if r["month"] in (None, ""))
        assert blank["observed_14d"] == "0" and blank["rate"] in (None, "")  # ÷0 → NULL, never a 0 % "drop"


def test_a_filter_before_the_recipe_can_only_make_rows_younger() -> None:
    with TestClient(app) as client:
        ws, ds = _dataset(client)
        only_b = {"kind": "filter", "predicates": [{"col": "team", "op": "equals", "val": "B"}]}
        rows = _by_start(_run(client, ws, ds, [only_b, *recipe()]))
        # team B's latest start is 2026-09-20 → as-of moves back; nothing reads observed that the
        # whole-table as-of would not also read observed
        assert {r["start_as_of"][:10] for r in rows.values()} == {"2026-09-20"}
        assert {k: r["observed_14d"] for k, r in rows.items()} == {
            "2026-09-03": "1",
            "2026-09-16": "0",
            "2026-09-20": "0",
        }


def test_recipe_leaves_every_existing_column_and_the_row_count_alone() -> None:
    with TestClient(app) as client:
        ws, ds = _dataset(client)
        by_start = {"kind": "sort", "keys": [{"col": "start"}]}  # a no-op on columns, so the query lists them
        plain = _run(client, ws, ds, [by_start], "plain")
        with_recipe = _run(client, ws, ds, [*recipe(), by_start])
        assert len(plain) == len(with_recipe) == 8
        keys = ("start", "end", "team")

        def cells(rows):
            return sorted(tuple(r[k] or "" for k in keys) for r in rows)

        assert cells(plain) == cells(with_recipe)
