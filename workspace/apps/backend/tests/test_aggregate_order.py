"""R201 (QA-4 / BA-F1) — a grouped result has an explicit, stable order.

`POST /queries/{id}/aggregate` (and every aggregate step, which shares
`build_aggregate_select`) grouped without an ORDER BY, so a widget's rows could
come back in another order on every read. Now: the group keys, typed, blanks
last — and a sort the query asks for (a later step) still wins. The 4th
occurrence of the explicit-order class (review-cr item 13).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_definition_pack import _ok, _upload

_ROWS = b"id,team,amount\n" + b"".join(
    f"{i},{['North', 'South', 'East', 'West', ''][i % 5]},{i * 3 % 17}\n".encode() for i in range(1, 41)
)


def _setup(client: TestClient, steps: list | None = None) -> str:
    ws = _ok(client.post("/workspaces", json={"name": "Order"}))["id"]
    ds = _upload(client, ws, "calls", _ROWS)
    body = {
        "name": "All",
        "sourceId": ds["id"],
        "definition": {"q": None, "filters": [], "advanced": [], "steps": steps or []},
    }
    return _ok(client.post(f"/workspaces/{ws}/queries", json=body))["id"]


@pytest.mark.unit
def test_the_same_aggregate_read_twenty_times_is_byte_identical_and_in_key_order() -> None:
    with TestClient(app) as client:
        qid = _setup(client)
        agg = {"dimensions": ["team"], "measures": [{"col": "amount", "agg": "sum"}]}
        bodies = {client.post(f"/queries/{qid}/aggregate", json=agg).content for _ in range(20)}
        assert len(bodies) == 1
        rows = client.post(f"/queries/{qid}/aggregate", json=agg).json()["rows"]
        assert [r[0] for r in rows] == ["East", "North", "South", "West", None]  # blanks last


@pytest.mark.unit
def test_a_numeric_key_orders_as_a_number_not_as_text() -> None:
    with TestClient(app) as client:
        qid = _setup(client)
        rows = client.post(
            f"/queries/{qid}/aggregate", json={"dimensions": ["id"], "measures": [{"agg": "count"}]}
        ).json()["rows"]
        assert [r[0] for r in rows][:12] == [str(i) for i in range(1, 13)]


@pytest.mark.unit
def test_a_requested_sort_still_wins() -> None:
    steps = [
        {"kind": "aggregate", "dimensions": ["team"], "measures": [{"col": "amount", "agg": "sum"}]},
        {"kind": "sort", "keys": [{"col": "amount", "descending": True}]},
    ]
    with TestClient(app) as client:
        qid = _setup(client, steps)
        rows = client.get(f"/queries/{qid}/rows?unpaged=true").json()["rows"]
        amounts = [float(r[1]) for r in rows]
        assert amounts == sorted(amounts, reverse=True)
        agg_rows = client.post(
            f"/queries/{qid}/aggregate", json={"dimensions": ["team"], "measures": [{"col": "amount", "agg": "sum"}]}
        ).json()["rows"]
        assert [r[0] for r in agg_rows] == sorted(r[0] for r in agg_rows if r[0] is not None) + (
            [None] if any(r[0] is None for r in agg_rows) else []
        )
