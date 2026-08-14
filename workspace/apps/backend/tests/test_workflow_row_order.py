"""R171 item 8: a workflow's rows come back in its source query's order.

R168 found it and never judged it: a workflow's rows arrived in parquet file
order while the same shaping, read through the source query, arrived in R165
W-7's deterministic total order. Same rows, same values, a different sequence —
so the workflow and the query it was built from disagreed about what "the first
row" is, which is the kind of difference a reader notices and cannot explain.

The cause was that ``materialize_steps`` wrote the parquet with no ``ORDER BY``
at all, leaving the sequence to whatever DuckDB's plan emitted. The write is now
ordered by the same ``_page_order_sql`` keys, at the one point where the sequence
is decided once instead of on every read.

**Scope, stated because it is easy to over-read**: this makes the workflow agree
with its query. It does NOT make the workflow's rows path contractually ordered —
``query_dataset_rows`` still has no ``ORDER BY``, so ``LIMIT/OFFSET`` over a
materialized output (or over any dataset) is not a partition. That is the same
class W-7 measured and it is an engine round of its own.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_workflows import _create, _query_source

# NOTE on what makes these tests bite. An explicit `sort` step is the WRONG
# probe: `build_steps_relation` emits its ORDER BY inside the relation, so the
# materialized write already carried it and a sorted test passed with the fix
# disabled — proving nothing. The two orders diverge exactly where the query's
# `_page_order_sql` supplies keys the steps relation does not: with NO ordering
# step (the query orders by every column ascending; the write had nothing), and
# on ties. Measured on the aggregate below with the fix off:
#   workflow → Alice, Carol, Bob      (DuckDB's hash-group order)
#   query    → Alice, Bob, Carol      (every column ascending)
_AGG = {"kind": "aggregate", "dimensions": ["name"], "measures": [{"col": "amount", "agg": "sum"}]}
# A sort the user asked for — kept as a separate case, to pin that ordering the
# write does not quietly override what the reader chose.
_SORT = {"kind": "sort", "keys": [{"col": "amount", "descending": True}]}


def _query_rows(client: TestClient, ws: str, qid: str, steps: list[dict]) -> list[list]:
    """The same shaping read through the SOURCE QUERY — the sequence a user sees
    in the builder's preview, and the one the workflow must not contradict."""
    resp = client.put(
        f"/queries/{qid}",
        json={"definition": {"q": None, "filters": [], "advanced": [], "steps": steps}},
    )
    assert resp.status_code == 200, resp.text
    rows = client.get(f"/queries/{qid}/rows?unpaged=true")
    assert rows.status_code == 200, rows.text
    return rows.json()["rows"]


@pytest.mark.unit
def test_workflow_rows_match_the_source_querys_order() -> None:
    """R168's finding, at the two endpoints a user compares: an unsorted
    aggregate read through the workflow and through its source query must come
    back in the SAME sequence. Fails without the ordered write (Alice, Carol,
    Bob vs Alice, Bob, Carol)."""
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[_AGG]).json()["id"]
        assert client.post(f"/workflows/{wid}/run").status_code == 200
        wf_rows = client.get(f"/workflows/{wid}/rows?unpaged=true").json()["rows"]
        # Apply the SAME step to the source query and read it back.
        q_rows = _query_rows(client, ws, qid, [_AGG])

    assert len(wf_rows) > 1, "a one-row result cannot disagree about order; the fixture must produce several"
    assert wf_rows == q_rows, "the workflow's sequence must not contradict the query it was built from"


@pytest.mark.unit
def test_the_users_sort_still_wins_over_the_tiebreak_order() -> None:
    """The write is ordered, but not ordered *arbitrarily*: where the reader
    asked for a sort, that is what they get, with the total order only breaking
    ties. A fix that imposed every-column-ascending on the write would pass the
    test above — both sides would agree — and silently discard the sort."""
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[_AGG, _SORT]).json()["id"]
        client.post(f"/workflows/{wid}/run")
        body = client.get(f"/workflows/{wid}/rows?unpaged=true").json()

    amounts = [float(r[1]) for r in body["rows"]]
    assert amounts == sorted(amounts, reverse=True), body["rows"]


@pytest.mark.unit
def test_a_rerun_reproduces_the_same_sequence() -> None:
    """Two runs of an unchanged workflow are two independent executions. Without
    an ordered write they may write the rows in different sequences, so a user who
    re-runs to refresh sees the table reshuffle for no reason they can name."""
    with TestClient(app) as client:
        ws, qid = _query_source(client)
        wid = _create(client, ws, qid, steps=[_AGG]).json()["id"]
        client.post(f"/workflows/{wid}/run")
        first = client.get(f"/workflows/{wid}/rows?unpaged=true").json()["rows"]
        client.post(f"/workflows/{wid}/run")
        second = client.get(f"/workflows/{wid}/rows?unpaged=true").json()["rows"]

    assert first == second
