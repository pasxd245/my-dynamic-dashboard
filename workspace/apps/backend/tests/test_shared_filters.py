"""R199 (item 4.3) — shared filters: a `values` control on a dashboard.

Design `dashboards/dashboard-filters.md` criterion 6 (a `values` control reaches
exactly its targets; a target lacking the column is skipped; `(blank)` survives
the URL as `~blank`) and criterion 7's filters part (the XLSX Filters sheet tells
a dashboard filter from a widget filter); scope respected; the URL spelling's
parsing edges (BA-C2/C5); a stale control ignored (BA-C1); the `/values`
endpoint (blank first, typed order — BA-C3, the 1 000 cap, a post-step column);
the save checks; D3 level 2 applied by the server.
"""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.main import app
from app.shared_filters import parse_f_keys
from tests._conformance import validate_response
from tests.test_params import _EMPTY, _col, _query

_CSV = (
    b"id,team,amount,day\n"
    b"1,North,10,2026-10-10\n"
    b"2,North,20,2026-10-11\n"
    b"3,South,5,2026-10-12\n"
    b"4,,7,2026-10-13\n"
    b"5,West,3,2026-10-14\n"
)
_W1, _W2, _W3 = "wdg_0000000a", "wdg_0000000b", "wdg_0000000c"
_CTL = "ctl_000000aa"


_N = iter(range(1, 1000))


def _dataset(client: TestClient, csv: bytes = _CSV) -> tuple[str, str, list[dict]]:
    ws = client.post("/workspaces", json={"name": f"P{next(_N)}"}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("p.csv", csv, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "calls"}]}
    ).json()[0]
    return ws, ds["id"], ds["columns"]


def _widget(wid: str, qid: str) -> dict:
    return {"id": wid, "queryId": qid, "title": wid, "chartType": "table", "agg": "count", "span": 1}


def _values(**over) -> dict:
    return {"id": _CTL, "kind": "values", "label": "Team", "column": "team", "targets": "all", **over}


def _dashboard(client: TestClient, ws: str, widgets: list[dict], controls: list[dict], name: str = "D"):
    return client.post(
        f"/workspaces/{ws}/dashboards",
        json={"name": name, "slug": name.lower(), "definition": {"widgets": widgets, "controls": controls}},
    )


def _setup(client: TestClient):
    """Two queries over `calls`: `with_team` (plain) and `no_team` (a `select`
    step dropping `team`); a dashboard with a Team control saved ["North"]
    targeting W1 (with_team) and W2 (no_team); W3 (with_team) untargeted."""
    ws, ds, cols = _dataset(client)
    q1 = _query(client, ws, ds, {**_EMPTY}, "with_team").json()["id"]
    q2 = _query(
        client,
        ws,
        ds,
        {**_EMPTY, "steps": [{"kind": "select", "cols": [{"col": "id"}, {"col": "amount"}, {"col": "day"}]}]},
        "no_team",
    ).json()["id"]
    r = _dashboard(
        client,
        ws,
        [_widget(_W1, q1), _widget(_W2, q2), _widget(_W3, q1)],
        [_values(targets=[_W1, _W2], saved=["North"])],
    )
    assert r.status_code == 201, r.json()
    return ws, ds, cols, q1, q2, r.json()["id"]


def _rows(client: TestClient, qid: str, dsh: str, wid: str, raw: str = "") -> dict:
    r = client.get(f"/queries/{qid}/rows?unpaged=true&dashboard={dsh}&widget={wid}{raw}")
    assert r.status_code == 200, r.json()
    validate_response("queries/rows-get.contract.yaml", 200, r.json())
    return r.json()


def _ids(page: dict) -> list[str]:
    return [r[0] for r in page["rows"]]


# --- save checks ------------------------------------------------------------------------


@pytest.mark.unit
def test_values_control_saves_reads_back_and_is_checked() -> None:
    client = TestClient(app)
    ws, ds, _cols = _dataset(client)
    q = _query(client, ws, ds, {**_EMPTY}).json()["id"]
    ctl = _values(saved=["North", None])
    r = _dashboard(client, ws, [_widget(_W1, q)], [ctl])
    assert r.status_code == 201, r.json()
    validate_response("dashboards/post.contract.yaml", 201, r.json())
    got = client.get(f"/dashboards/{r.json()['id']}").json()
    assert got["definition"]["controls"] == [ctl]  # byte-identical, `null` kept

    def refused(controls: list[dict], field: str, reason: str, name: str) -> None:
        bad = _dashboard(client, ws, [_widget(_W1, q)], controls, name=name)
        assert bad.status_code == 422, bad.json()
        detail = bad.json()["detail"][0]
        assert detail["loc"][-1] == field and detail["msg"].startswith(reason), detail

    # One values control per column (duplicate_column), like one control per parameter.
    refused([_values(), _values(id="ctl_000000ab", label="Team 2")], "column", "duplicate_column", "D2")
    # Targets must be widgets of this dashboard; a value listed twice is refused.
    refused([_values(targets=["wdg_0000ffff"])], "targets", "unknown_widget", "D3")
    assert _dashboard(client, ws, [_widget(_W1, q)], [_values(saved=["North", "North"])], "D4").status_code == 422
    assert _dashboard(client, ws, [_widget(_W1, q)], [_values(saved=[])], "D5").status_code == 422
    # The column is NOT checked against the queries (D5 skips at read).
    assert _dashboard(client, ws, [_widget(_W1, q)], [_values(column="nope")], "D6").status_code == 201
    # A param control beside it still saves (one of each kind on one dashboard).
    both = [_values(), {"id": "ctl_000000ac", "kind": "param", "label": "As of", "param": "as_of", "targets": "all"}]
    assert _dashboard(client, ws, [_widget(_W1, q)], both, "D7").status_code == 201


# --- criterion 6 · reach, skip, (blank), URL ----------------------------------------------


@pytest.mark.unit
def test_saved_selection_applies_to_targets_only_and_skips_a_missing_column() -> None:
    client = TestClient(app)
    _ws, _ds, _cols, q1, q2, dsh = _setup(client)
    # W1 is targeted and has `team`: the saved ["North"] applies (D3 level 2, by the server).
    assert _ids(_rows(client, q1, dsh, _W1)) == ["1", "2"]
    # W2 is targeted but its result lacks `team`: skipped, every row (D5, never an error).
    assert _ids(_rows(client, q2, dsh, _W2)) == ["1", "2", "3", "4", "5"]
    # W3 shows the same query as W1 but is not targeted: untouched (scope).
    assert _ids(_rows(client, q1, dsh, _W3)) == ["1", "2", "3", "4", "5"]
    # Without a dashboard ref nothing applies (an API caller reads the query as is).
    r = client.get(f"/queries/{q1}/rows?unpaged=true")
    assert _ids(r.json()) == ["1", "2", "3", "4", "5"]


@pytest.mark.unit
def test_viewer_selection_in_the_url_overrides_clears_and_carries_blank() -> None:
    client = TestClient(app)
    _ws, _ds, _cols, q1, _q2, dsh = _setup(client)
    # A viewer value overrides the saved one.
    assert _ids(_rows(client, q1, dsh, _W1, f"&f.{_CTL}=South")) == ["3"]
    assert _ids(_rows(client, q1, dsh, _W1, f"&f.{_CTL}=South,West")) == ["3", "5"]
    # `~blank` is the (blank) option — a NULL / empty cell.
    assert _ids(_rows(client, q1, dsh, _W1, f"&f.{_CTL}=~blank")) == ["4"]
    # (sorted: under an OR predicate the parquet scan does not keep file order — logged)
    assert sorted(_ids(_rows(client, q1, dsh, _W1, f"&f.{_CTL}=North,~blank"))) == ["1", "2", "4"]
    # An empty value = cleared: no filter, the saved selection NOT applied.
    page = _rows(client, q1, dsh, _W1, f"&f.{_CTL}=")
    assert _ids(page) == ["1", "2", "3", "4", "5"] and page["total"] == 5
    # The filter applies BEFORE the cap / paging: `total` is the filtered count.
    r = client.get(f"/queries/{q1}/rows?page=1&page_size=10&dashboard={dsh}&widget={_W1}&f.{_CTL}=North")
    assert r.json()["total"] == 2 and _ids(r.json()) == ["1", "2"]


@pytest.mark.unit
def test_url_parsing_edges() -> None:
    # BA-C2 / BA-C5 — split BEFORE decoding; percent-decoding only; `+` literal;
    # the raw `~blank` token is blank, `%7Eblank` the literal string; empty
    # tokens ignored; a repeated key → last wins; an empty value → cleared.
    assert parse_f_keys("f.ctl_1=North,South") == {"ctl_1": ["North", "South"]}
    assert parse_f_keys("f.ctl_1=A%2CB,C") == {"ctl_1": ["A,B", "C"]}
    assert parse_f_keys("f.ctl_1=~blank,%7Eblank") == {"ctl_1": [None, "~blank"]}
    assert parse_f_keys("f.ctl_1=a+b,%20x") == {"ctl_1": ["a+b", " x"]}
    assert parse_f_keys("f.ctl_1=North,,South,") == {"ctl_1": ["North", "South"]}
    assert parse_f_keys("f.ctl_1=North&f.ctl_1=South") == {"ctl_1": ["South"]}
    assert parse_f_keys("f.ctl_1=") == {"ctl_1": []}
    assert parse_f_keys("f.ctl_1") == {"ctl_1": []}
    assert parse_f_keys("p.as_of=2026-01-01&unpaged=true&f.=x") == {}
    assert parse_f_keys("") == {}


@pytest.mark.unit
def test_a_comma_inside_a_value_travels_encoded() -> None:
    client = TestClient(app)
    csv = b'id,team\n1,"Ops, East"\n2,Ops\n3,East\n'
    ws, ds, _cols = _dataset(client, csv)
    q = _query(client, ws, ds, {**_EMPTY}).json()["id"]
    dsh = _dashboard(client, ws, [_widget(_W1, q)], [_values()]).json()["id"]
    assert _ids(_rows(client, q, dsh, _W1, f"&f.{_CTL}=Ops%2C%20East")) == ["1"]
    # Unencoded, the same text is two values — neither matches.
    assert _ids(_rows(client, q, dsh, _W1, f"&f.{_CTL}=Ops,%20East")) == ["2"]


@pytest.mark.unit
def test_a_stale_control_is_ignored_like_an_unused_param() -> None:
    # BA-C1 — a link copied before the control was removed keeps opening: the
    # key is ignored, the read answers unfiltered (200).
    client = TestClient(app)
    _ws, _ds, _cols, q1, _q2, dsh = _setup(client)
    page = _rows(client, q1, dsh, _W1, "&f.ctl_0000dead=South")
    assert _ids(page) == ["1", "2"]  # the saved selection of the live control still applies
    # On a POST read a `control` item naming no values control is ignored too.
    r = client.post(
        f"/queries/{q1}/aggregate",
        json={
            "dimensions": [],
            "measures": [{"agg": "count"}],
            "filters": [{"column": "team", "values": ["South"], "control": "ctl_0000dead"}],
            "dashboard": {"id": dsh, "widgetId": _W1},
        },
    )
    assert r.status_code == 200 and r.json()["rows"] == [["2"]], r.json()
    # A control that does not target the widget is ignored as well (W3).
    r = client.post(
        f"/queries/{q1}/aggregate",
        json={
            "dimensions": [],
            "measures": [{"agg": "count"}],
            "filters": [{"column": "team", "values": ["South"], "control": _CTL}],
            "dashboard": {"id": dsh, "widgetId": _W3},
        },
    )
    assert r.status_code == 200 and r.json()["rows"] == [["5"]], r.json()


@pytest.mark.unit
def test_shared_filter_refusals() -> None:
    client = TestClient(app)
    _ws, _ds, _cols, q1, _q2, dsh = _setup(client)
    # A shared filter needs the dashboard ref — on GET and on POST.
    r = client.get(f"/queries/{q1}/rows?unpaged=true&f.{_CTL}=South")
    assert r.status_code == 422 and r.json()["detail"][0]["msg"].startswith("control_without_dashboard")
    assert r.json()["detail"][0]["loc"] == ["query", f"f.{_CTL}"]
    body = {"dimensions": [], "measures": [{"agg": "count"}]}
    r = client.post(
        f"/queries/{q1}/aggregate",
        json={**body, "filters": [{"column": "team", "values": ["South"], "control": _CTL}]},
    )
    assert r.status_code == 422 and r.json()["detail"][0]["msg"].startswith("control_without_dashboard")
    assert r.json()["detail"][0]["loc"] == ["body", "filters", 0, "control"]
    # The item's column must be the control's.
    r = client.post(
        f"/queries/{q1}/aggregate",
        json={
            **body,
            "filters": [{"column": "amount", "values": ["5"], "control": _CTL}],
            "dashboard": {"id": dsh, "widgetId": _W1},
        },
    )
    assert r.status_code == 422 and r.json()["detail"][0]["msg"].startswith("control_column")
    assert r.json()["detail"][0]["loc"] == ["body", "filters", 0, "column"]


# --- the POST reads: aggregate · totals · export (criterion 7) ------------------------


@pytest.mark.unit
def test_aggregate_and_totals_and_the_drawer_and_together() -> None:
    client = TestClient(app)
    _ws, _ds, _cols, q1, q2, dsh = _setup(client)
    ref = {"id": dsh, "widgetId": _W1}
    agg = {"dimensions": [], "measures": [{"col": "amount", "agg": "sum"}]}
    # Saved selection by the server: North = 10 + 20.
    r = client.post(f"/queries/{q1}/aggregate", json={**agg, "dashboard": ref})
    assert r.status_code == 200 and r.json()["rows"] == [["30"]], r.json()
    validate_response("queries/aggregate.contract.yaml", 200, r.json())
    # The viewer's item overrides it; a cleared item restricts nothing.
    r = client.post(
        f"/queries/{q1}/aggregate",
        json={**agg, "filters": [{"column": "team", "values": ["South"], "control": _CTL}], "dashboard": ref},
    )
    assert r.json()["rows"] == [["5"]]
    r = client.post(
        f"/queries/{q1}/aggregate",
        json={**agg, "filters": [{"column": "team", "values": [], "control": _CTL}], "dashboard": ref},
    )
    assert r.json()["rows"] == [["45"]]
    # The widget's own drawer filter ANDs with the shared one: North ∧ amount 20.
    r = client.post(
        f"/queries/{q1}/aggregate",
        json={**agg, "filters": [{"column": "amount", "values": ["20"]}], "dashboard": ref},
    )
    assert r.json()["rows"] == [["20"]]
    # Totals: the same filters over the final relation.
    r = client.post(f"/queries/{q1}/totals", json={"columns": ["amount"], "dashboard": ref})
    assert r.status_code == 200 and r.json() == {
        **r.json(),
        "sums": {"amount": "30"},
        "rowCount": 2,
    }, r.json()
    validate_response("queries/totals.contract.yaml", 200, r.json())
    # W2's result lacks the column: the saved selection is skipped on totals too.
    r = client.post(f"/queries/{q2}/totals", json={"columns": ["amount"], "dashboard": {"id": dsh, "widgetId": _W2}})
    assert r.json()["rowCount"] == 5
    # A dashboard with no values control reads exactly as before (the R195 shape).
    r = client.post(f"/queries/{q1}/aggregate", json={**agg, "filters": [{"column": "team", "values": ["West"]}]})
    assert r.json()["rows"] == [["3"]]


def _filters_sheet(data: bytes) -> list[list]:
    ws = load_workbook(io.BytesIO(data))["Filters"]
    rows = [[c.value for c in r] for r in ws.iter_rows()]
    start = next(i for i, r in enumerate(rows) if r and r[0] == "column")
    out = []
    for r in rows[start + 1 :]:
        if not r or r[0] is None:
            break
        out.append(r)
    return out


@pytest.mark.unit
def test_export_filters_sheet_splits_dashboard_from_widget_rows() -> None:
    client = TestClient(app)
    _ws, _ds, _cols, q1, _q2, dsh = _setup(client)
    ref = {"id": dsh, "widgetId": _W1}
    # Saved selection (source dashboard) + the widget's own drawer filter.
    r = client.post(
        f"/queries/{q1}/export",
        json={"format": "xlsx", "filters": [{"column": "amount", "values": ["20"]}], "dashboard": ref},
    )
    assert r.status_code == 200, r.content[:200]
    assert _filters_sheet(r.content) == [
        ["amount", "20", "widget filter", None],
        ["team", "North", "dashboard filter Team", "dashboard"],
    ]
    data = load_workbook(io.BytesIO(r.content))["with_team"]
    assert [row[0].value for row in data.iter_rows(min_row=2)] == [2]  # typed cells
    # The viewer's selection (source viewer), with (blank).
    r = client.post(
        f"/queries/{q1}/export",
        json={
            "format": "xlsx",
            "filters": [{"column": "team", "values": ["South", None], "control": _CTL}],
            "dashboard": ref,
        },
    )
    assert _filters_sheet(r.content) == [["team", "South, (blank)", "dashboard filter Team", "viewer"]]
    # A cleared shared item writes no row; with nothing else the sheet says "no filter" (BA-C4).
    r = client.post(
        f"/queries/{q1}/export",
        json={"format": "xlsx", "filters": [{"column": "team", "values": [], "control": _CTL}], "dashboard": ref},
    )
    assert _filters_sheet(r.content) == [["—", "no filter", None, None]]
    # A skipped shared filter (W2 lacks the column) is not listed either.
    r = client.post(
        f"/queries/{_setup_q2(client, dsh)}/export", json={"format": "xlsx", "dashboard": {"id": dsh, "widgetId": _W2}}
    )
    assert _filters_sheet(r.content) == [["—", "no filter", None, None]]
    # No dashboard at all: the pre-R199 shape, a widget filter row.
    r = client.post(
        f"/queries/{q1}/export", json={"format": "xlsx", "filters": [{"column": "team", "values": ["West"]}]}
    )
    assert _filters_sheet(r.content) == [["team", "West", "widget filter", None]]


def _setup_q2(client: TestClient, dsh: str) -> str:
    return next(
        w["queryId"] for w in client.get(f"/dashboards/{dsh}").json()["definition"]["widgets"] if w["id"] == _W2
    )


# --- the /values endpoint ----------------------------------------------------------------


@pytest.mark.unit
def test_values_endpoint_lists_distinct_blank_first_in_the_columns_order() -> None:
    client = TestClient(app)
    ws, ds, _cols = _dataset(client)
    q = _query(client, ws, ds, {**_EMPTY}).json()["id"]
    r = client.get(f"/queries/{q}/values?column=team")
    assert r.status_code == 200, r.json()
    validate_response("queries/values-get.contract.yaml", 200, r.json())
    assert r.json() == {**r.json(), "column": "team", "values": [None, "North", "South", "West"], "partial": False}
    # BA-C3 — a numeric column lists in numeric order (3 before 10), stringified.
    assert client.get(f"/queries/{q}/values?column=amount").json()["values"] == ["3", "5", "7", "10", "20"]
    assert client.get(f"/queries/{q}/values?column=day").json()["values"][0] == "2026-10-10"
    # An unknown column → 422 unknown_column naming it.
    r = client.get(f"/queries/{q}/values?column=region")
    assert r.status_code == 422 and r.json() == {"code": "unknown_column", "column": "region"}
    validate_response("queries/values-get.contract.yaml", 422, r.json())
    assert client.get("/queries/qr_00000000/values?column=team").status_code == 404


@pytest.mark.unit
def test_values_endpoint_reads_the_final_relation_and_applies_no_filter() -> None:
    client = TestClient(app)
    ws, ds, cols = _dataset(client)
    # A derived (post-step) column: `big` = amount >= 10 → "yes" / "no".
    steps = [
        {
            "kind": "case",
            "name": "big",
            "branches": [
                {"when": [{"col": "amount", "op": "gte", "val": 10}], "then": {"kind": "const", "value": "yes"}}
            ],
            "otherwise": {"kind": "const", "value": "no"},
        }
    ]
    r = _query(client, ws, ds, {**_EMPTY, "steps": steps})
    assert r.status_code == 201, r.json()
    q = r.json()["id"]
    assert client.get(f"/queries/{q}/values?column=big").json()["values"] == ["no", "yes"]
    # The same post-step column filters identically on /rows and /export (BA, design call 4).
    dsh = _dashboard(client, ws, [_widget(_W1, q)], [_values(column="big", saved=["yes"])]).json()["id"]
    assert _ids(_rows(client, q, dsh, _W1)) == ["1", "2"]
    r = client.post(f"/queries/{q}/export", json={"format": "csv", "dashboard": {"id": dsh, "widgetId": _W1}})
    assert r.status_code == 200 and [ln.split(",")[0] for ln in r.text.splitlines()[1:]] == ["1", "2"]
    # The options list ignores the control's own saved selection (and any filter).
    r = client.get(f"/queries/{q}/values?column=big&dashboard={dsh}&widget={_W1}")
    assert r.json()["values"] == ["no", "yes"]


@pytest.mark.unit
def test_values_endpoint_caps_at_one_thousand_and_flags_partial() -> None:
    client = TestClient(app)
    csv = b"id,code\n" + b"".join(f"{i},c{i:05d}\n".encode() for i in range(1, 1002)) + b"1002,\n"
    ws, ds, _cols = _dataset(client, csv)
    q = _query(client, ws, ds, {**_EMPTY}).json()["id"]
    r = client.get(f"/queries/{q}/values?column=code")
    assert r.status_code == 200
    body = r.json()
    assert body["partial"] is True and body["values"][0] is None and len(body["values"]) == 1001
    assert body["values"][1] == "c00001" and body["values"][-1] == "c01000"
    # Exactly 1 000 distinct non-blank values is not partial.
    r = client.get(f"/queries/{q}/values?column=id")
    assert r.json()["partial"] is True  # 1 002 ids
    csv = b"id\n" + b"".join(f"{i}\n".encode() for i in range(1, 1001))
    ws, ds, _cols = _dataset(client, csv)
    q = _query(client, ws, ds, {**_EMPTY}).json()["id"]
    body = client.get(f"/queries/{q}/values?column=id").json()
    assert body["partial"] is False and len(body["values"]) == 1000 and body["values"][:3] == ["1", "2", "3"]


@pytest.mark.unit
def test_values_endpoint_resolves_parameters_like_rows() -> None:
    client = TestClient(app)
    ws, ds, cols = _dataset(client)
    definition = {
        **_EMPTY,
        "params": [{"name": "as_of", "type": "date"}],
        "filters": [{"col": _col(cols, "day"), "dtype": "date", "op": "lte", "val": {"param": "as_of"}}],
    }
    q = _query(client, ws, ds, definition).json()["id"]
    r = client.get(f"/queries/{q}/values?column=team")
    assert r.status_code == 422 and r.json()["code"] == "param_unbound"
    r = client.get(f"/queries/{q}/values?column=team&p.as_of=2026-10-11")
    assert r.status_code == 200 and r.json()["values"] == ["North"]
    assert r.json()["resolvedParams"] == {"as_of": {"value": "2026-10-11", "source": "viewer"}}
    assert client.get(f"/queries/{q}/values?column=team&dashboard=dsh_00000000").status_code == 422
