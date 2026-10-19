"""R198 (item 4.2) — QA's adversarial probes (adopted at close-out) of the view-time date range (item 4.2): presets
at zone boundaries (one instant, three calendars), DST-free zones across a DST
switch elsewhere, Dec 31 / Jan 1 / Feb 29 rolls, viewer dates overriding a saved
preset (whole and half), D5 (a query using neither / only one name), D7
`dataThrough` on `lt` / `before` / datetime / totals / aggregate / a lower bound
and when the bound equals the coverage max, reversed / half / malformed saved
pairs at save, and the byte-identical read of a pre-round `param` control."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import params
from app._config import CONFIG
from app.main import app
from tests.test_date_range import _W1, _W2, _dashboard, _period_query, _range, _widget
from tests.test_params import _EMPTY, _col, _dataset, _query


def _clock(monkeypatch: pytest.MonkeyPatch, when: datetime, zone: str) -> None:
    monkeypatch.setattr(params, "_clock", lambda: when)
    monkeypatch.setattr(CONFIG.settings.backend, "time_zone", zone)


# --- presets: one instant, three calendars -------------------------------------------


@pytest.mark.unit
def test_one_instant_is_saturday_sunday_and_monday_in_three_zones(monkeypatch: pytest.MonkeyPatch) -> None:
    when = datetime(2026, 11, 1, 10, 30, tzinfo=timezone.utc)  # Sunday 1 Nov 10:30 UTC
    _clock(monkeypatch, when, "Pacific/Pago_Pago")  # UTC−11 → Sat 31 Oct 23:30
    assert params.resolve_range({"preset": "this_week"}) == ("2026-10-26", "2026-11-01")
    assert params.resolve_range({"preset": "last_7_days"}) == ("2026-10-25", "2026-10-31")
    assert params.resolve_range({"preset": "this_month"}) == ("2026-10-01", "2026-10-31")
    assert params.resolve_range({"preset": "last_month"}) == ("2026-09-01", "2026-09-30")
    _clock(monkeypatch, when, "UTC")  # Sun 1 Nov
    assert params.resolve_range({"preset": "this_week"}) == ("2026-10-26", "2026-11-01")
    assert params.resolve_range({"preset": "this_month"}) == ("2026-11-01", "2026-11-30")
    _clock(monkeypatch, when, "Pacific/Kiritimati")  # UTC+14 → Mon 2 Nov 00:30
    assert params.resolve_range({"preset": "this_week"}) == ("2026-11-02", "2026-11-08")
    assert params.resolve_range({"preset": "last_week"}) == ("2026-10-26", "2026-11-01")
    assert params.resolve_range({"preset": "last_7_days"}) == ("2026-10-27", "2026-11-02")


@pytest.mark.unit
def test_dst_free_zones_across_a_dst_switch_elsewhere(monkeypatch: pytest.MonkeyPatch) -> None:
    # 8 Mar 2026 (US spring-forward Sunday) 09:30 UTC — 02:30 in Phoenix (no DST), 16:30 in Ho Chi Minh City.
    when = datetime(2026, 3, 8, 9, 30, tzinfo=timezone.utc)
    for zone in ("America/Phoenix", "Asia/Ho_Chi_Minh", "Asia/Tokyo", "America/New_York", "Europe/London"):
        _clock(monkeypatch, when, zone)
        assert params.resolve_range({"preset": "this_week"}) == ("2026-03-02", "2026-03-08"), zone
        assert params.resolve_range({"preset": "last_week"}) == ("2026-02-23", "2026-03-01"), zone
        assert params.resolve_range({"preset": "last_7_days"}) == ("2026-03-02", "2026-03-08"), zone
        assert params.resolve_range({"preset": "last_month"}) == ("2026-02-01", "2026-02-28"), zone
    # 25 Oct 2026 (EU fall-back Sunday) 00:30 UTC — still Saturday 24 Oct in New York (20:30 EDT).
    _clock(monkeypatch, datetime(2026, 10, 25, 0, 30, tzinfo=timezone.utc), "America/New_York")
    assert params.resolve_range({"preset": "this_week"}) == ("2026-10-19", "2026-10-25")
    assert params.resolve_range({"preset": "last_7_days"}) == ("2026-10-18", "2026-10-24")


@pytest.mark.unit
def test_year_rolls_and_leap_day(monkeypatch: pytest.MonkeyPatch) -> None:
    _clock(monkeypatch, datetime(2026, 12, 31, 12, 0, tzinfo=timezone.utc), "UTC")  # Thursday
    assert params.resolve_range({"preset": "this_week"}) == ("2026-12-28", "2027-01-03")
    assert params.resolve_range({"preset": "this_month"}) == ("2026-12-01", "2026-12-31")
    assert params.resolve_range({"preset": "last_month"}) == ("2026-11-01", "2026-11-30")
    assert params.resolve_range({"preset": "last_7_days"}) == ("2026-12-25", "2026-12-31")
    _clock(monkeypatch, datetime(2027, 1, 1, 12, 0, tzinfo=timezone.utc), "UTC")  # Friday
    assert params.resolve_range({"preset": "this_week"}) == ("2026-12-28", "2027-01-03")
    assert params.resolve_range({"preset": "last_week"}) == ("2026-12-21", "2026-12-27")
    assert params.resolve_range({"preset": "last_month"}) == ("2026-12-01", "2026-12-31")
    assert params.resolve_range({"preset": "this_month"}) == ("2027-01-01", "2027-01-31")
    _clock(monkeypatch, datetime(2028, 2, 29, 12, 0, tzinfo=timezone.utc), "UTC")  # Tuesday, leap day
    assert params.resolve_range({"preset": "this_month"}) == ("2028-02-01", "2028-02-29")
    assert params.resolve_range({"preset": "this_week"}) == ("2028-02-28", "2028-03-05")
    assert params.resolve_range({"preset": "last_7_days"}) == ("2028-02-23", "2028-02-29")
    _clock(monkeypatch, datetime(2027, 3, 1, 12, 0, tzinfo=timezone.utc), "UTC")
    assert params.resolve_range({"preset": "last_month"}) == ("2027-02-01", "2027-02-28")  # not a leap year
    # 31 Jan: last_month must not land on "31 Dec → 31 Dec" or roll into a 31-day arithmetic trap.
    _clock(monkeypatch, datetime(2027, 1, 31, 12, 0, tzinfo=timezone.utc), "UTC")
    assert params.resolve_range({"preset": "last_month"}) == ("2026-12-01", "2026-12-31")
    _clock(monkeypatch, datetime(2027, 3, 31, 12, 0, tzinfo=timezone.utc), "UTC")
    assert params.resolve_range({"preset": "last_month"}) == ("2027-02-01", "2027-02-28")


# --- viewer dates override a saved preset, whole and half; mixed sources ------------------


@pytest.mark.unit
def test_half_viewer_override_keeps_the_other_bound_from_the_saved_preset(monkeypatch: pytest.MonkeyPatch) -> None:
    _clock(monkeypatch, datetime(2026, 10, 12, 12, 0, tzinfo=timezone.utc), "UTC")
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _period_query(cols)).json()["id"]
        dsh = _dashboard(client, ws, [_widget(_W1, q)], [_range(saved={"preset": "last_7_days"})]).json()["id"]
        dash = f"dashboard={dsh}&widget={_W1}"
        only_to = client.get(f"/queries/{q}/rows?p.to=2026-10-10&{dash}").json()
        only_from = client.get(f"/queries/{q}/rows?p.from=2026-10-11&{dash}").json()
        empty_from = client.get(f"/queries/{q}/rows?p.from=&{dash}").json()
        reversed_viewer = client.get(f"/queries/{q}/rows?p.from=2026-10-12&p.to=2026-10-01&{dash}")
        bad_viewer = client.get(f"/queries/{q}/rows?p.from=2026-13-01&{dash}")
        off_dashboard = client.get(f"/queries/{q}/rows?p.to=2026-10-10")

    assert only_to["resolvedParams"] == {
        "from": {"value": "2026-10-06", "source": "dashboard"},
        "to": {"value": "2026-10-10", "source": "viewer"},
    }
    assert only_to["total"] == 1
    assert only_from["resolvedParams"]["from"] == {"value": "2026-10-11", "source": "viewer"}
    assert only_from["resolvedParams"]["to"] == {"value": "2026-10-12", "source": "dashboard"}
    assert only_from["total"] == 2
    # An empty viewer value is no value: the saved preset's bound stands.
    assert empty_from["resolvedParams"]["from"]["source"] == "dashboard"
    # A reversed VIEWER pair is refused as in R194 (`range_reversed`, source viewer) — the bar
    # already warns before the read; D7's "note, not block" is about the coverage max only.
    assert reversed_viewer.status_code == 422, reversed_viewer.text
    body = reversed_viewer.json()
    assert (body["code"], body["source"], body.get("reason")) == ("param_invalid", "viewer", "range_reversed")
    assert bad_viewer.status_code == 422 and "param_invalid" in bad_viewer.text
    # Off the dashboard the saved preset does not apply: `from` is unbound.
    assert off_dashboard.status_code == 422 and "param_unbound" in off_dashboard.text


@pytest.mark.unit
def test_saved_fixed_pair_with_relative_bounds_resolves_in_the_zone(monkeypatch: pytest.MonkeyPatch) -> None:
    _clock(monkeypatch, datetime(2026, 10, 12, 23, 30, tzinfo=timezone.utc), "Asia/Ho_Chi_Minh")  # 13 Oct 06:30
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _period_query(cols)).json()["id"]
        saved = {"from": {"kind": "today", "offsetDays": -2}, "to": {"kind": "today", "offsetDays": 0}}
        dsh = _dashboard(client, ws, [_widget(_W1, q)], [_range(saved=saved)]).json()["id"]
        got = client.get(f"/dashboards/{dsh}").json()
        rows = client.get(f"/queries/{q}/rows?dashboard={dsh}&widget={_W1}").json()

    assert got["definition"]["controls"][0]["saved"] == saved  # stored relative, not resolved
    assert rows["resolvedParams"] == {
        "from": {"value": "2026-10-11", "source": "dashboard"},
        "to": {"value": "2026-10-13", "source": "dashboard", "dataThrough": "2026-10-12"},
    }
    assert rows["total"] == 2


# --- D5: a query that uses only one of the two names; an untargeted widget --------------


@pytest.mark.unit
def test_a_query_using_only_to_gets_to_only_and_an_untargeted_widget_nothing() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q_to = _query(
            client,
            ws,
            ds,
            {
                **_EMPTY,
                "params": [{"name": "to", "type": "date"}],
                "filters": [{"col": _col(cols, "day"), "dtype": "date", "op": "lte", "val": {"param": "to"}}],
            },
            "to only",
        ).json()["id"]
        q_period = _query(client, ws, ds, _period_query(cols), "period").json()["id"]
        dsh = _dashboard(
            client,
            ws,
            [_widget(_W1, q_to), _widget(_W2, q_period)],
            [_range(targets=[_W1], saved={"from": "2026-10-01", "to": "2026-10-11"})],
        ).json()["id"]
        to_only = client.get(f"/queries/{q_to}/rows?dashboard={dsh}&widget={_W1}").json()
        untargeted = client.get(f"/queries/{q_period}/rows?dashboard={dsh}&widget={_W2}")

    assert to_only["resolvedParams"] == {"to": {"value": "2026-10-11", "source": "dashboard"}}
    assert to_only["total"] == 2
    # The control does not target W2: its period query has no value → unbound, not silently bound.
    assert untargeted.status_code == 422 and "param_unbound" in untargeted.text


# --- D7: every upper-bound op, equality with the max, several sites, aggregate ----------


@pytest.mark.unit
def test_data_through_on_before_equal_max_and_aggregate() -> None:
    def one(cols: list[dict], op: str, column: str = "day") -> dict:
        return {
            **_EMPTY,
            "params": [{"name": "to", "type": "date"}],
            "filters": [{"col": _col(cols, column), "dtype": "date", "op": op, "val": {"param": "to"}}],
        }

    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        # `lt` is not a date op at save (filter_op_dtype_mismatch); `before` is the exclusive one.
        assert _query(client, ws, ds, one(cols, "lt"), "lt").status_code == 422
        q_before = _query(client, ws, ds, one(cols, "before"), "before").json()["id"]
        q_lte = _query(client, ws, ds, one(cols, "lte"), "lte").json()["id"]
        q_period = _query(client, ws, ds, _period_query(cols), "period").json()["id"]
        before_past = client.get(f"/queries/{q_before}/rows?p.to=2026-10-20").json()
        at_max = client.get(f"/queries/{q_lte}/rows?p.to=2026-10-12").json()
        day_after_max = client.get(f"/queries/{q_before}/rows?p.to=2026-10-13").json()
        agg = client.post(
            f"/queries/{q_period}/aggregate",
            json={
                "dimensions": [],
                "measures": [{"agg": "count"}],
                "params": {"from": "2026-10-01", "to": "2026-10-31"},
            },
        ).json()

    assert before_past["resolvedParams"]["to"]["dataThrough"] == "2026-10-12"
    assert "dataThrough" not in at_max["resolvedParams"]["to"]  # the bound IS the max: nothing to note
    assert at_max["total"] == 3
    # `before 2026-10-13` covers every row through 12 Oct — the data is complete, yet
    # the note fires (BA-C2, exclusive-bound off-by-one; cited, not re-raised here).
    assert day_after_max["total"] == 3
    assert day_after_max["resolvedParams"]["to"].get("dataThrough") == "2026-10-12"  # documents BA-C2
    assert agg["resolvedParams"]["to"]["dataThrough"] == "2026-10-12"
    assert "dataThrough" not in agg["resolvedParams"]["from"]


# --- save checks: reversed relative pair, same-day pair, malformed shapes, PUT ------------


@pytest.mark.unit
def test_save_refuses_reversed_relative_pair_and_malformed_saved_shapes(monkeypatch: pytest.MonkeyPatch) -> None:
    _clock(monkeypatch, datetime(2026, 10, 12, 12, 0, tzinfo=timezone.utc), "UTC")
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _period_query(cols)).json()["id"]
        widgets = [_widget(_W1, q)]
        rel_reversed = _dashboard(
            client,
            ws,
            widgets,
            [_range(saved={"from": {"kind": "today", "offsetDays": 1}, "to": {"kind": "today", "offsetDays": 0}})],
        )
        mixed_reversed = _dashboard(
            client, ws, widgets, [_range(saved={"from": "2026-10-13", "to": {"kind": "today", "offsetDays": 0}})]
        )
        same_day = _dashboard(client, ws, widgets, [_range(saved={"from": "2026-10-11", "to": "2026-10-11"})], "Same")
        preset_plus = _dashboard(client, ws, widgets, [_range(saved={"preset": "this_week", "from": "2026-10-01"})])
        empty_saved = _dashboard(client, ws, widgets, [_range(saved={})])
        string_saved = _dashboard(client, ws, widgets, [_range(saved="this_week")])
        null_saved = _dashboard(client, ws, widgets, [_range(saved=None)], "Null")
        bad_id = _dashboard(client, ws, widgets, [_range(id="ctl_zz")])
        long_label = _dashboard(client, ws, widgets, [_range(label="x" * 61)])
        extra_key = _dashboard(client, ws, widgets, [_range(param="from")])
        empty_targets = _dashboard(client, ws, widgets, [_range(targets=[])])
        dup_target = _dashboard(client, ws, widgets, [_range(targets=[_W1, _W1])])
        unicode_label = _dashboard(client, ws, widgets, [_range(label="Kỳ báo cáo — tuần")], "Uni")
        ok = _dashboard(client, ws, widgets, [_range(saved={"preset": "this_week"})], "Ok")
        dsh = ok.json()["id"]
        put_reversed = client.put(
            f"/dashboards/{dsh}",
            json={
                "name": "Ok",
                "slug": "ok",
                "definition": {
                    "widgets": widgets,
                    "controls": [_range(saved={"from": "2026-10-12", "to": "2026-10-01"})],
                },
            },
        )
        put_ok = client.put(
            f"/dashboards/{dsh}",
            json={
                "name": "Ok",
                "slug": "ok",
                "definition": {
                    "widgets": widgets,
                    "controls": [_range(saved={"from": "2026-10-01", "to": "2026-10-12"})],
                },
            },
        )
        after = client.get(f"/dashboards/{dsh}").json()

    for r, needle in (
        (rel_reversed, "range_reversed"),
        (mixed_reversed, "range_reversed"),
        (preset_plus, ""),
        (empty_saved, ""),
        (string_saved, ""),
        (bad_id, ""),
        (long_label, ""),
        (extra_key, ""),
        (empty_targets, ""),
        (dup_target, "duplicate_target"),
        (put_reversed, "range_reversed"),
    ):
        assert r.status_code == 422, r.text
        assert needle in r.text, r.text
    assert same_day.status_code == 201, same_day.text
    assert null_saved.status_code == 201 and "saved" not in null_saved.json()["definition"]["controls"][0]
    assert unicode_label.status_code == 201 and unicode_label.json()["definition"]["controls"][0]["label"] == (
        "Kỳ báo cáo — tuần"
    )
    assert put_ok.status_code == 200, put_ok.text
    assert after["definition"]["controls"][0]["saved"] == {"from": "2026-10-01", "to": "2026-10-12"}
    assert list(after["definition"]["controls"][0]) == ["id", "kind", "label", "from", "to", "targets", "saved"]


@pytest.mark.unit
def test_a_range_may_target_a_note_or_a_widget_without_a_query_only_if_param_controls_may() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _period_query(cols)).json()["id"]
        note = {"id": _W2, "chartType": "note", "title": "n", "span": 1, "md": "hello"}
        widgets = [_widget(_W1, q), note]
        as_param = _dashboard(
            client,
            ws,
            widgets,
            [{"id": "ctl_0000000b", "kind": "param", "label": "To", "param": "to", "targets": [_W2]}],
            "P",
        )
        as_range = _dashboard(client, ws, widgets, [_range(targets=[_W2])], "R")
    # Whatever the rule for a `param` control targeting a note, a range follows it.
    assert (as_param.status_code == 201) == (as_range.status_code == 201), (as_param.text, as_range.text)


# --- regression: a pre-round `param` control reads byte-identically ------------------------


@pytest.mark.unit
def test_param_control_dashboard_get_is_unchanged_shape() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(
            client,
            ws,
            ds,
            {
                **_EMPTY,
                "params": [{"name": "as_of", "type": "date", "label": "As of"}],
                "filters": [{"col": _col(cols, "day"), "dtype": "date", "op": "lte", "val": {"param": "as_of"}}],
            },
        ).json()["id"]
        ctl = {
            "id": "ctl_0000000a",
            "kind": "param",
            "label": "As of",
            "param": "as_of",
            "targets": "all",
            "saved": {"kind": "today", "offsetDays": -1},
        }
        dsh = _dashboard(client, ws, [_widget(_W1, q)], [ctl]).json()["id"]
        got = client.get(f"/dashboards/{dsh}").json()
    assert got["definition"]["controls"] == [ctl]
    assert list(got["definition"]["controls"][0]) == ["id", "kind", "label", "param", "targets", "saved"]
