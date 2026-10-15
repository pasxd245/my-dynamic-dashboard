"""R181: POST /queries/{id}/totals — sums over the WHOLE (post-step, filtered)
result, for a table widget's footer; plus the `Widget.totals` save rules."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests._conformance import validate_response

# region (string), calls (integer), quotes (integer), rate (float = quotes/calls per row)
_CSV = b"region,calls,quotes,rate\nEMEA,100,10,0.1\nEMEA,300,60,0.2\nAPAC,200,100,0.5\nAPAC,,5,\n"
_EMPTY_DEF = {"q": None, "filters": [], "advanced": []}


def _seed(client: TestClient, definition: dict | None = None) -> tuple[str, str]:
    ws = client.post("/workspaces", json={"name": "T"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("d.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "rows"}]}
    ).json()[0]
    q = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": "All", "sourceId": ds["id"], "definition": definition or _EMPTY_DEF},
    )
    assert q.status_code == 201, q.text
    return ws, q.json()["id"]


@pytest.mark.unit
def test_sums_over_the_whole_result_and_ratio_is_derivable() -> None:
    with TestClient(app) as client:
        _, qid = _seed(client)
        resp = client.post(f"/queries/{qid}/totals", json={"columns": ["calls", "quotes", "rate"]})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    validate_response("queries/totals.contract.yaml", 200, body)
    assert body["rowCount"] == 4
    assert body["sums"]["calls"] == "600" and body["sums"]["quotes"] == "175"
    # Σquotes / Σcalls = 175 / 600 ≈ 0.2917 — NOT the mean of the per-row rates (0.267).
    assert abs(float(body["sums"]["quotes"]) / float(body["sums"]["calls"]) - 175 / 600) < 1e-9
    assert float(body["sums"]["rate"]) == pytest.approx(0.8)


@pytest.mark.unit
def test_filters_change_the_totals() -> None:
    with TestClient(app) as client:
        _, qid = _seed(client)
        emea = client.post(
            f"/queries/{qid}/totals",
            json={"columns": ["calls"], "filters": [{"column": "region", "values": ["EMEA"]}]},
        ).json()
        blank = client.post(
            f"/queries/{qid}/totals",
            json={"columns": ["calls"], "filters": [{"column": "calls", "values": [None]}]},
        ).json()
        unknown_col_filter = client.post(
            f"/queries/{qid}/totals",
            json={"columns": ["calls"], "filters": [{"column": "nope", "values": ["x"]}]},
        ).json()

    assert emea == {"sums": {"calls": "400"}, "rowCount": 2}
    assert blank == {"sums": {"calls": "0"}, "rowCount": 1}  # the all-NULL group reads 0 (aggregate parity)
    assert unknown_col_filter["rowCount"] == 4  # a filter on a column the result lacks is skipped


@pytest.mark.unit
def test_stepped_query_totals_the_post_step_result() -> None:
    """The table shows the SHAPED rows (one per region after an aggregate step);
    the footer must sum those, not the base rows."""
    definition = {
        **_EMPTY_DEF,
        "steps": [{"kind": "aggregate", "dimensions": ["region"], "measures": [{"col": "quotes", "agg": "sum"}]}],
    }
    with TestClient(app) as client:
        _, qid = _seed(client, definition)
        resp = client.post(f"/queries/{qid}/totals", json={"columns": ["quotes"]})
        base_col = client.post(f"/queries/{qid}/totals", json={"columns": ["calls"]})

    assert resp.status_code == 200, resp.text
    assert resp.json() == {"sums": {"quotes": "175"}, "rowCount": 2}
    assert base_col.status_code == 422  # `calls` is not a post-step column


@pytest.mark.unit
def test_non_numeric_or_unknown_column_is_422_and_missing_query_404() -> None:
    with TestClient(app) as client:
        _, qid = _seed(client)
        text = client.post(f"/queries/{qid}/totals", json={"columns": ["region"]})
        unknown = client.post(f"/queries/{qid}/totals", json={"columns": ["nope"]})
        missing = client.post("/queries/qr_ffffffff/totals", json={"columns": ["calls"]})

    assert text.status_code == 422 and unknown.status_code == 422 and missing.status_code == 404


# ─── Widget.totals save rules ───────────────────────────────────────────────


def _dashboard(client: TestClient, ws: str, widget: dict):
    return client.post(
        f"/workspaces/{ws}/dashboards",
        json={"name": "D", "slug": "d", "definition": {"widgets": [widget]}},
    )


@pytest.mark.unit
def test_widget_totals_round_trip_and_rules() -> None:
    with TestClient(app) as client:
        ws, qid = _seed(client)
        table = {"id": "wdg_00000181", "queryId": qid, "title": "T", "chartType": "table", "agg": "count", "span": 3}
        ok = _dashboard(
            client,
            ws,
            {**table, "totals": {"calls": {"agg": "sum"}, "cr": {"agg": "ratio", "num": "quotes", "den": "calls"}}},
        )
        ratio_no_den = _dashboard(
            client, ws, {**table, "id": "wdg_00000182", "totals": {"cr": {"agg": "ratio", "num": "quotes"}}}
        )
        sum_with_num = _dashboard(
            client, ws, {**table, "id": "wdg_00000183", "totals": {"calls": {"agg": "sum", "num": "x"}}}
        )
        on_bar = _dashboard(
            client,
            ws,
            {
                **table,
                "id": "wdg_00000184",
                "chartType": "bar",
                "dimensionCol": "region",
                "totals": {"calls": {"agg": "sum"}},
            },
        )

    assert ok.status_code == 201, ok.text
    w = ok.json()["definition"]["widgets"][0]
    assert w["totals"] == {"calls": {"agg": "sum"}, "cr": {"agg": "ratio", "num": "quotes", "den": "calls"}}
    validate_response("dashboards/post.contract.yaml", 201, ok.json())
    assert ratio_no_den.status_code == 422
    assert sum_with_num.status_code == 422
    assert on_bar.status_code == 422
