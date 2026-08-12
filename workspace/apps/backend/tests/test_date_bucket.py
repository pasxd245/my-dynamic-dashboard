"""R144: the `date_bucket` transform step — a report's time axis.

Covers: week/month bucketing (period-START dates; week = ISO-8601 Monday-start,
DuckDB native), the bucket feeding an `aggregate` (THE "Weekly - Report Call"
shape: calls per agent per week), resolvedColumns carrying the appended `date`
column, the 422 save guards (non-date col · unknown col · name collision · bad
granularity), and the FLAGSHIP end-to-end: an FM1-shaped Excel commit with a
datetime override (R144 ingest) → date_bucket(week) → aggregate — the month-1
loop's missing piece, on one seam.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._excel import fm1_shaped_workbook


# ISO timestamps → DuckDB read_csv_auto infers TIMESTAMP → committed dtype
# `datetime` with NO override (the parser-inferred temporal path).
_CSV = (
    b"agent,called_at\n"
    b"An,2026-06-29 09:15:00\n"  # Mon — ISO week starting 2026-06-29
    b"An,2026-07-01 10:30:00\n"  # Wed, same week
    b"Binh,2026-07-03 17:45:00\n"  # Fri, same week
    b"An,2026-07-06 08:00:00\n"  # Mon — the NEXT ISO week
)

_WEEK_BUCKET = {"kind": "date_bucket", "col": "called_at", "granularity": "week", "name": "week"}
_COUNT_PER_AGENT_WEEK = {
    "kind": "aggregate",
    "dimensions": ["agent", "week"],
    "measures": [{"agg": "count"}],
}


def _commit_csv(client: TestClient) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "R144"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("calls.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "calls"}]}
    ).json()[0]
    assert {"name": "called_at", "dtype": "datetime"} in ds["columns"]  # inferred, no override
    return ws, ds["id"]


def _create(client: TestClient, ws: str, ds_id: str, steps: list[dict], name: str = "axis"):
    definition = {"q": None, "filters": [], "advanced": [], "steps": steps}
    return client.post(f"/workspaces/{ws}/queries", json={"name": name, "sourceId": ds_id, "definition": definition})


@pytest.mark.unit
def test_week_bucket_appends_iso_monday_start_date() -> None:
    steps = [_WEEK_BUCKET]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        created = _create(client, ws, ds_id, steps)
        assert created.status_code == 201, created.text
        qid = created.json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()
        resolved = client.get(f"/queries/{qid}").json()["resolvedColumns"]

    # base ++ the new `date` column; source column stays available
    # (`Source.Name` provenance rides through between the base and the bucket)
    assert resolved == [
        {"name": "agent", "dtype": "string"},
        {"name": "called_at", "dtype": "datetime"},
        {"name": "Source.Name", "dtype": "string"},
        {"name": "week", "dtype": "date"},
    ]
    # Mon/Wed/Fri all truncate to their week's MONDAY (ISO-8601, DuckDB native).
    # Asserted as a MAPPING from the source timestamp: the claim is which week each
    # call falls in, never which order the rows arrive in. (R165 W-7 gave the pager
    # a deterministic total order, which changed the incidental order this line
    # used to depend on — a claim about truncation should not have noticed.)
    assert {r[1]: r[3] for r in body["rows"]} == {
        "2026-06-29 09:15:00": "2026-06-29",  # Mon
        "2026-07-01 10:30:00": "2026-06-29",  # Wed, same week
        "2026-07-03 17:45:00": "2026-06-29",  # Fri, same week
        "2026-07-06 08:00:00": "2026-07-06",  # Mon — the NEXT ISO week
    }


@pytest.mark.unit
def test_month_bucket_truncates_to_month_start() -> None:
    steps = [{"kind": "date_bucket", "col": "called_at", "granularity": "month", "name": "month"}]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, steps).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()

    assert [r[3] for r in body["rows"]] == ["2026-06-01", "2026-07-01", "2026-07-01", "2026-07-01"]


@pytest.mark.unit
def test_week_bucket_then_aggregate_is_the_weekly_report_shape() -> None:
    """THE report (R142-F11): calls per agent per WEEK — the grouping the
    5,015-timestamp-group aggregate could not express."""
    steps = [
        _WEEK_BUCKET,
        _COUNT_PER_AGENT_WEEK,
        {"kind": "sort", "keys": [{"col": "agent"}, {"col": "week"}]},
    ]
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        qid = _create(client, ws, ds_id, steps).json()["id"]
        body = client.get(f"/queries/{qid}/rows").json()
        resolved = client.get(f"/queries/{qid}").json()["resolvedColumns"]

    assert resolved == [
        {"name": "agent", "dtype": "string"},
        {"name": "week", "dtype": "date"},
        {"name": "count", "dtype": "integer"},
    ]
    assert body["rows"] == [
        ["An", "2026-06-29", "2"],
        ["An", "2026-07-06", "1"],
        ["Binh", "2026-06-29", "1"],
    ]


@pytest.mark.unit
@pytest.mark.parametrize(
    "steps",
    [
        # bucket on a non-date column
        [{"kind": "date_bucket", "col": "agent", "granularity": "week", "name": "w"}],
        # unknown column
        [{"kind": "date_bucket", "col": "ghost", "granularity": "week", "name": "w"}],
        # output name collides with an existing column
        [{"kind": "date_bucket", "col": "called_at", "granularity": "week", "name": "agent"}],
        # granularity outside the vocabulary (pydantic enum on the wire)
        [{"kind": "date_bucket", "col": "called_at", "granularity": "fortnight", "name": "w"}],
    ],
)
def test_bad_bucket_rejected_on_save_422(steps: list[dict]) -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_csv(client)
        resp = _create(client, ws, ds_id, steps)

    assert resp.status_code == 422, resp.text


def _commit_many_csv(client: TestClient) -> tuple[str, str]:
    """12 rows — enough to cross a 10-row page with a row-preserving step."""
    lines = ["agent,called_at"] + [f"a{i},2026-07-{(i % 28) + 1:02d} 08:00:00" for i in range(12)]
    csv = ("\n".join(lines) + "\n").encode()
    ws = client.post("/workspaces", json={"name": "PG"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("m.csv", csv, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "m"}]}
    ).json()[0]
    return ws, ds["id"]


@pytest.mark.unit
def test_stepped_rows_are_paged_and_unpaged_is_one_capped_response() -> None:
    """R144 Review finding #2: a ROW-PRESERVING step (date_bucket) keeps the
    source cardinality — the shaped result pages like every other path (the
    R120 'small by construction' assumption held only for `aggregate`)."""
    with TestClient(app) as client:
        ws, ds_id = _commit_many_csv(client)
        qid = _create(client, ws, ds_id, [_WEEK_BUCKET]).json()["id"]
        p1 = client.get(f"/queries/{qid}/rows?page=1&page_size=10").json()
        p2 = client.get(f"/queries/{qid}/rows?page=2&page_size=10").json()
        up_resp = client.get(f"/queries/{qid}/rows?unpaged=true").json()

    assert (len(p1["rows"]), p1["total"], p1["pageSize"], p1["page"]) == (10, 12, 10, 1)
    assert (len(p2["rows"]), p2["total"], p2["page"]) == (2, 12, 2)
    # unpaged (the widget path): one response, full total, pageSize echoes the count
    assert (len(up_resp["rows"]), up_resp["total"], up_resp["pageSize"]) == (12, 12, 12)


@pytest.mark.unit
def test_stepped_preview_pages_and_keeps_resolved_and_base_columns() -> None:
    with TestClient(app) as client:
        ws, ds_id = _commit_many_csv(client)
        definition = {"q": None, "filters": [], "advanced": [], "steps": [_WEEK_BUCKET]}
        body = client.post(
            f"/workspaces/{ws}/queries/preview?page=1&page_size=10",
            json={"sourceId": ds_id, "definition": definition},
        ).json()

    assert (len(body["rows"]), body["total"], body["pageSize"], body["page"]) == (10, 12, 10, 1)
    assert body["resolvedColumns"][-1] == {"name": "week", "dtype": "date"}
    assert [c["name"] for c in body["baseColumns"]] == ["agent", "called_at", "Source.Name"]


@pytest.mark.unit
def test_fm1_end_to_end_override_ingest_then_weekly_grouping() -> None:
    """The round's Check headline: the FM1 shape (`Ngày gọi`-style TEXT
    dd-MM-yyyy HH:mm:ss) commits as a real datetime via the R144 override,
    and a saved query buckets + aggregates it into THE weekly report's
    grouping — the month-1 loop closes on one seam."""
    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "FM1"}).json()["id"]
        up = client.post(
            "/uploads",
            data={"sourceFormat": "excel"},
            files={"file": ("fm1.xlsx", fm1_shaped_workbook(), "application/octet-stream")},
        ).json()
        ds = client.post(
            f"/workspaces/{ws}/datasets/batch",
            json={
                "temp_id": up["temp_id"],
                "items": [
                    {
                        "sheet": "Calls",
                        "name": "calls",
                        "column_overrides": {"called_at": {"dtype": "datetime", "format": "dd-MM-yyyy HH:mm:ss"}},
                    }
                ],
            },
        ).json()[0]
        assert {"name": "called_at", "dtype": "datetime"} in ds["columns"]

        steps = [
            _WEEK_BUCKET,
            _COUNT_PER_AGENT_WEEK,
            {"kind": "sort", "keys": [{"col": "agent"}, {"col": "week"}]},
        ]
        created = _create(client, ws, ds["id"], steps, name="weekly report call")
        assert created.status_code == 201, created.text
        body = client.get(f"/queries/{created.json()['id']}/rows").json()

    # the NULL called_at row contributes a NULL bucket group (honest count)
    assert body["rows"] == [
        ["An", "2026-06-29", "2"],
        ["An", "2026-07-06", "1"],
        ["Binh", "2026-06-29", "1"],
        ["Binh", None, "1"],
    ]
