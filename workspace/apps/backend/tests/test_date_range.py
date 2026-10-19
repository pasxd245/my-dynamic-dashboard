"""R198 (item 4.2) — the view-time date range: a `date_range` control binds two
date parameters; its saved period (a preset or a pair) is resolved by the server
in `backend.time_zone` on every read (design criterion 9); a targeted widget
whose query uses neither parameter is skipped (D5); a `to` past the filtered
column's coverage `max` is echoed as `dataThrough` (D7); save checks."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import params
from app._config import CONFIG
from app.main import app
from tests._conformance import validate_response
from tests.test_params import _EMPTY, _as_of_query, _col, _dataset, _query

_W1, _W2 = "wdg_0000000a", "wdg_0000000b"


def _period_query(cols: list[dict], column: str = "day", op: str = "between") -> dict:
    """`from` / `to` date parameters on `column` — `between` by default."""
    base = {
        **_EMPTY,
        "params": [{"name": "from", "type": "date", "label": "From"}, {"name": "to", "type": "date", "label": "To"}],
    }
    if op == "between":
        base["filters"] = [
            {
                "col": _col(cols, column),
                "dtype": "date",
                "op": "between",
                "min": {"param": "from"},
                "max": {"param": "to"},
            }
        ]
    else:  # two atoms: gte from, lte to
        base["filters"] = [
            {"col": _col(cols, column), "dtype": "date", "op": "gte", "val": {"param": "from"}},
            {"col": _col(cols, column), "dtype": "date", "op": "lte", "val": {"param": "to"}},
        ]
    return base


def _widget(wid: str, qid: str) -> dict:
    return {"id": wid, "queryId": qid, "title": wid, "chartType": "table", "agg": "count", "span": 1}


def _range(**over) -> dict:
    """A date_range control; `from_=` sets `from` (a keyword)."""
    if "from_" in over:
        over["from"] = over.pop("from_")
    return {
        "id": "ctl_0000000a",
        "kind": "date_range",
        "label": "Period",
        "from": "from",
        "to": "to",
        "targets": "all",
        **over,
    }


def _dashboard(client: TestClient, ws: str, widgets: list[dict], controls: list[dict], name: str = "D"):
    return client.post(
        f"/workspaces/{ws}/dashboards",
        json={"name": name, "slug": name.lower(), "definition": {"widgets": widgets, "controls": controls}},
    )


# --- presets in the zone --------------------------------------------------------------


@pytest.mark.unit
def test_presets_resolve_in_the_configured_zone(monkeypatch: pytest.MonkeyPatch) -> None:
    # Sunday 2026-11-01 23:30 UTC is already Monday 2026-11-02 in Ho Chi Minh City.
    monkeypatch.setattr(params, "_clock", lambda: datetime(2026, 11, 1, 23, 30, tzinfo=timezone.utc))
    monkeypatch.setattr(CONFIG.settings.backend, "time_zone", "UTC")
    utc = {p: params.resolve_range({"preset": p}) for p in params.PRESETS}
    monkeypatch.setattr(CONFIG.settings.backend, "time_zone", "Asia/Ho_Chi_Minh")
    hcm = {p: params.resolve_range({"preset": p}) for p in params.PRESETS}

    # Sunday 1 Nov (UTC): the week is Mon 26 Oct – Sun 1 Nov; the month is November.
    assert utc == {
        "this_week": ("2026-10-26", "2026-11-01"),
        "last_week": ("2026-10-19", "2026-10-25"),
        "last_7_days": ("2026-10-26", "2026-11-01"),
        "this_month": ("2026-11-01", "2026-11-30"),
        "last_month": ("2026-10-01", "2026-10-31"),
    }
    # Monday 2 Nov (UTC+7): a new week; October is last month, November this one.
    assert hcm == {
        "this_week": ("2026-11-02", "2026-11-08"),
        "last_week": ("2026-10-26", "2026-11-01"),
        "last_7_days": ("2026-10-27", "2026-11-02"),
        "this_month": ("2026-11-01", "2026-11-30"),
        "last_month": ("2026-10-01", "2026-10-31"),
    }


@pytest.mark.unit
def test_pairs_and_month_ends(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(params, "_clock", lambda: datetime(2028, 3, 1, 12, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(CONFIG.settings.backend, "time_zone", "UTC")
    assert params.resolve_range({"preset": "last_month"}) == ("2028-02-01", "2028-02-29")  # leap year
    assert params.resolve_range({"preset": "this_month"}) == ("2028-03-01", "2028-03-31")
    assert params.resolve_range({"from": "2026-01-01", "to": {"kind": "today", "offsetDays": -1}}) == (
        "2026-01-01",
        "2028-02-29",
    )
    assert params.resolve_range(None) is None
    with pytest.raises(ValueError):
        params.resolve_range({"preset": "fortnight"})
    with pytest.raises(ValueError):
        params.resolve_range({"from": "2026-13-01", "to": "2026-01-02"})


# --- criterion 9 · a saved preset resolves server-side; viewer values are absolute ------


@pytest.mark.unit
def test_saved_preset_resolves_server_side_and_viewer_dates_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(params, "_clock", lambda: datetime(2026, 10, 12, 12, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(CONFIG.settings.backend, "time_zone", "UTC")
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _period_query(cols)).json()["id"]
        created = _dashboard(client, ws, [_widget(_W1, q)], [_range(saved={"preset": "last_7_days"})])
        dsh = created.json()["id"]
        got = client.get(f"/dashboards/{dsh}").json()
        dash = f"dashboard={dsh}&widget={_W1}"
        saved = client.get(f"/queries/{q}/rows?{dash}").json()
        monkeypatch.setattr(params, "_clock", lambda: datetime(2026, 10, 13, 12, 0, tzinfo=timezone.utc))
        next_day = client.get(f"/queries/{q}/rows?{dash}").json()
        viewer = client.get(f"/queries/{q}/rows?p.from=2026-10-11&p.to=2026-10-11&{dash}").json()
        agg = client.post(
            f"/queries/{q}/aggregate",
            json={"dimensions": [], "measures": [{"agg": "count"}], "dashboard": {"id": dsh, "widgetId": _W1}},
        ).json()

    assert created.status_code == 201, created.text
    validate_response("dashboards/post.contract.yaml", 201, created.json())
    # Stored as the preset, not as dates: tomorrow it still reads "last 7 days".
    assert got["definition"]["controls"][0]["saved"] == {"preset": "last_7_days"}
    assert saved["resolvedParams"] == {
        "from": {"value": "2026-10-06", "source": "dashboard"},
        "to": {"value": "2026-10-12", "source": "dashboard"},
    }
    assert saved["total"] == 3
    assert next_day["resolvedParams"]["to"] == {
        "value": "2026-10-13",
        "source": "dashboard",
        "dataThrough": "2026-10-12",
    }
    assert viewer["resolvedParams"] == {
        "from": {"value": "2026-10-11", "source": "viewer"},
        "to": {"value": "2026-10-11", "source": "viewer"},
    }
    assert viewer["total"] == 1
    assert agg["resolvedParams"]["from"]["source"] == "dashboard"


# --- D5 · a targeted widget whose query lacks the parameters is skipped -----------------


@pytest.mark.unit
def test_a_query_without_the_parameters_is_not_touched() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q_period = _query(client, ws, ds, _period_query(cols), "period").json()["id"]
        q_as_of = _query(client, ws, ds, _as_of_query(cols, default="2026-10-10"), "as of").json()["id"]
        q_plain = _query(client, ws, ds, _EMPTY, "plain").json()["id"]
        dsh = _dashboard(
            client,
            ws,
            [_widget(_W1, q_as_of), _widget(_W2, q_plain), _widget("wdg_0000000c", q_period)],
            [_range(saved={"from": "2026-10-10", "to": "2026-10-11"})],
        ).json()["id"]
        as_of = client.get(f"/queries/{q_as_of}/rows?dashboard={dsh}&widget={_W1}").json()
        plain = client.get(f"/queries/{q_plain}/rows?dashboard={dsh}&widget={_W2}").json()
        period = client.get(f"/queries/{q_period}/rows?dashboard={dsh}&widget=wdg_0000000c").json()

    # The control targets every widget; only the query that USES from / to is moved.
    assert as_of["resolvedParams"] == {"as_of": {"value": "2026-10-10", "source": "default"}}
    assert "resolvedParams" not in plain and plain["total"] == 3
    assert period["total"] == 2 and period["resolvedParams"]["from"]["source"] == "dashboard"


# --- D7 · data only through <max> ------------------------------------------------------


@pytest.mark.unit
def test_data_through_when_the_period_runs_past_the_data() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        assert cols[_col(cols, "day")]["coverage"]["max"] == "2026-10-12"
        q = _query(client, ws, ds, _period_query(cols, op="atoms")).json()["id"]
        q_at = _query(client, ws, ds, _period_query(cols, column="at"), "at").json()["id"]
        q_rev = _query(
            client,
            ws,
            ds,
            {
                **_EMPTY,
                "params": [{"name": "to", "type": "date"}],
                "filters": [{"col": _col(cols, "day"), "dtype": "date", "op": "gte", "val": {"param": "to"}}],
            },
            "lower",
        ).json()["id"]
        past = client.get(f"/queries/{q}/rows?p.from=2026-10-01&p.to=2026-10-31").json()
        within = client.get(f"/queries/{q}/rows?p.from=2026-10-01&p.to=2026-10-12").json()
        both_past = client.get(f"/queries/{q}/rows?p.from=2026-10-20&p.to=2026-10-31").json()
        at_past = client.get(f"/queries/{q_at}/rows?p.from=2026-10-01&p.to=2026-10-31").json()
        lower = client.get(f"/queries/{q_rev}/rows?p.to=2026-10-31").json()
        totals = client.post(
            f"/queries/{q}/totals", json={"columns": ["amount"], "params": {"from": "2026-10-01", "to": "2026-10-31"}}
        ).json()

    assert past["resolvedParams"]["to"] == {"value": "2026-10-31", "source": "viewer", "dataThrough": "2026-10-12"}
    assert "dataThrough" not in past["resolvedParams"]["from"]  # a lower bound never notes
    assert past["total"] == 3
    assert "dataThrough" not in within["resolvedParams"]["to"]
    assert both_past["total"] == 0 and both_past["resolvedParams"]["to"]["dataThrough"] == "2026-10-12"
    # A datetime column: the coverage max is a timestamp; the note is its day.
    assert at_past["resolvedParams"]["to"]["dataThrough"] == "2026-10-12"
    assert "dataThrough" not in lower["resolvedParams"]["to"]  # `gte` is a lower bound
    assert totals["resolvedParams"]["to"]["dataThrough"] == "2026-10-12"


# --- save checks -------------------------------------------------------------------------


@pytest.mark.unit
def test_range_control_save_checks() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _period_query(cols)).json()["id"]
        n_query = _query(
            client,
            ws,
            ds,
            {
                **_EMPTY,
                "params": [{"name": "from", "type": "number"}, {"name": "to", "type": "date"}],
                "filters": [{"col": _col(cols, "amount"), "dtype": "integer", "op": "gte", "val": {"param": "from"}}],
            },
            "n",
        ).json()["id"]
        widgets = [_widget(_W1, q)]
        same = _dashboard(client, ws, widgets, [_range(to="from")])
        dup_with_param = _dashboard(
            client,
            ws,
            widgets,
            [_range(), {"id": "ctl_0000000b", "kind": "param", "label": "To", "param": "to", "targets": "all"}],
        )
        dup_ranges = _dashboard(client, ws, widgets, [_range(), _range(id="ctl_0000000b", from_="x", to="to")])
        not_a_date = _dashboard(client, ws, [_widget(_W2, n_query)], [_range()])
        reversed_pair = _dashboard(client, ws, widgets, [_range(saved={"from": "2026-10-12", "to": "2026-10-01"})])
        bad_preset = _dashboard(client, ws, widgets, [_range(saved={"preset": "fortnight"})])
        half_pair = _dashboard(client, ws, widgets, [_range(saved={"from": "2026-10-01"})])
        bad_date = _dashboard(client, ws, widgets, [_range(saved={"from": "2026-13-01", "to": "2026-10-01"})])
        unknown_target = _dashboard(client, ws, widgets, [_range(targets=[_W2])])
        ok_relative = _dashboard(
            client,
            ws,
            widgets,
            [_range(saved={"from": {"kind": "today", "offsetDays": -7}, "to": {"kind": "today", "offsetDays": 0}})],
            name="Rel",
        )
        ok_unused = _dashboard(
            client, ws, widgets, [_range(from_="a", to="b", saved={"preset": "this_week"})], name="Unused"
        )

    for r, needle in (
        (same, "range_same_param"),
        (dup_with_param, "duplicate_param"),
        (dup_ranges, "duplicate_param"),
        (not_a_date, "param_type"),
        (reversed_pair, "range_reversed"),
        (bad_preset, ""),
        (half_pair, ""),
        (bad_date, ""),
        (unknown_target, "unknown_widget"),
    ):
        assert r.status_code == 422, r.text
        assert needle in r.text, r.text
    assert ok_relative.status_code == 201, ok_relative.text
    assert ok_unused.status_code == 201, ok_unused.text


# --- R197 interplay · a note anchors to the period the range control sets ---------------


@pytest.mark.unit
def test_a_note_anchors_to_the_saved_period(monkeypatch: pytest.MonkeyPatch) -> None:
    from app._config.settings import MetadataToken

    token = "ai-token-0123456789abcdef"
    monkeypatch.setattr(
        CONFIG.settings.backend,
        "metadata_tokens",
        [MetadataToken(token=token, author="agent", source="ai", namespaces=["aicowork"])],
    )
    monkeypatch.setattr(params, "_clock", lambda: datetime(2026, 10, 12, 9, 0, tzinfo=timezone.utc))
    monkeypatch.setattr(CONFIG.settings.backend, "time_zone", "UTC")
    headers = {"Authorization": f"Bearer {token}"}
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _period_query(cols)).json()["id"]
        dsh = _dashboard(client, ws, [_widget(_W1, q)], [_range(saved={"preset": "last_week"})]).json()["id"]
        note = client.put(f"/metadata/dashboard/{dsh}/aicowork", json={"md": "n"}, headers=headers)
        widget_note = client.put(f"/metadata/widget/{dsh}:{_W1}/aicowork", json={"md": "n"}, headers=headers)
        same = client.get(f"/metadata/dashboard/{dsh}").json()
        other = client.get(f"/metadata/dashboard/{dsh}?p.from=2026-10-01&p.to=2026-10-02").json()

    assert note.status_code == 201, note.text
    # Last week from Monday 12 Oct: Mon 5 – Sun 11 Oct, stamped as the dates (not the preset).
    assert note.json()["anchor"]["params"] == {"from": "2026-10-05", "to": "2026-10-11"}
    assert note.json()["anchor"]["assumedParams"] == ["from", "to"]
    assert widget_note.json()["anchor"]["params"] == {"from": "2026-10-05", "to": "2026-10-11"}
    assert same["entries"]["aicowork"]["state"] == "current"
    assert other["entries"]["aicowork"]["state"] == "other_period"
    assert other["children"][_W1]["aicowork"]["state"] == "other_period"
