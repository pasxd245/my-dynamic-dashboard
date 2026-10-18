"""R197 (item 3.8) — the metadata triple anchor and the cascade.

An entry is stamped by the server with the noun's definition, its data
(`dataVersions` / `runId`), the queries behind a widget or dashboard
(`queryVersions`) and the parameter values it was written under (`params`,
`assumedParams`). A read under the reader's `p.<name>` values answers `state`
per entry: other_definition → other_period → refreshed → current. A deleted
noun's entries move to `metadata_entries_swept`.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient

from app import db, params
from app._config import CONFIG
from app._config.settings import MetadataToken
from app.main import app
from app.metadata import state_of
from tests._conformance import validate_response
from tests.test_dashboard_controls import _control, _dashboard, _widget
from tests.test_params import _CSV, _as_of_query, _dataset, _query

_AI = "ai-token-0123456789abcdef"
_W1, _W2 = "wdg_0000000a", "wdg_0000000b"
_FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        CONFIG.settings.backend,
        "metadata_tokens",
        [MetadataToken(token=_AI, author="agent", source="ai", namespaces=["aicowork"])],
    )


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch):
    """Pin "today" (relative defaults) and move it on demand."""
    now = {"t": datetime(2026, 10, 12, 9, 0, tzinfo=timezone.utc)}
    monkeypatch.setattr(params, "_clock", lambda: now["t"])
    return now


_H = {"Authorization": f"Bearer {_AI}"}


def _put(client: TestClient, kind: str, noun: str, md: str = "note", **body):
    return client.put(f"/metadata/{kind}/{noun}/aicowork", json={"md": md, **body}, headers=_H)


def _state(client: TestClient, kind: str, noun: str, query: str = "") -> str:
    r = client.get(f"/metadata/{kind}/{noun}{query}")
    assert r.status_code == 200, r.text
    validate_response("metadata/get.contract.yaml", 200, r.json())
    return r.json()["entries"]["aicowork"]["state"]


def _refresh(client: TestClient, ws: str, ds: str, csv: bytes = _CSV) -> None:
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("p.csv", csv, "text/csv")}).json()
    r = client.post(
        f"/workspaces/{ws}/datasets/batch",
        json={"temp_id": up["temp_id"], "items": [{"name": "x", "target_dataset_id": ds}]},
    )
    assert r.status_code == 201, r.text


# --- the four states ------------------------------------------------------------


@pytest.mark.unit
def test_a_dataset_note_reads_current_then_refreshed() -> None:
    with TestClient(app) as client:
        ws, ds, _cols = _dataset(client)
        w = _put(client, "dataset", ds)
        before = _state(client, "dataset", ds)
        _refresh(client, ws, ds)
        after = client.get(f"/metadata/dataset/{ds}").json()

    assert w.status_code == 201, w.text
    validate_response("metadata/put.contract.yaml", 201, w.json())
    assert w.json()["anchor"] == {"definitionVersion": w.json()["definitionVersion"], "dataVersions": {ds: 1}}
    assert before == "current"
    assert after["entries"]["aicowork"]["state"] == "refreshed"
    assert after["current"]["dataVersions"] == {ds: 2}
    assert after["entries"]["aicowork"]["stale"] is False  # rc.2 meaning unchanged


@pytest.mark.unit
def test_a_query_note_is_about_its_period(clock) -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _as_of_query(cols)).json()["id"]
        unbound = _put(client, "query", q)
        bad = _put(client, "query", q, params={"as_of": "11/10/2026"})
        w = _put(client, "query", q, params={"as_of": "2026-10-11"})
        same = _state(client, "query", q, "?p.as_of=2026-10-11")
        other = client.get(f"/metadata/query/{q}?p.as_of=2026-10-12").json()
        no_value = _state(client, "query", q)
        junk = _state(client, "query", q, "?p.as_of=junk")

    assert unbound.status_code == 422 and unbound.json()["code"] == "param_unbound"
    validate_response("metadata/put.contract.yaml", 422, unbound.json())
    assert bad.status_code == 422 and bad.json()["code"] == "param_invalid"
    assert w.status_code == 201, w.text
    assert w.json()["anchor"]["params"] == {"as_of": "2026-10-11"}
    assert "assumedParams" not in w.json()["anchor"]
    assert same == "current"
    assert other["entries"]["aicowork"]["state"] == "other_period"
    assert other["current"]["params"] == {"as_of": "2026-10-12"}
    # The reader has no (valid) value: the period is not compared — the view asks for one.
    assert no_value == "current" and junk == "current"


@pytest.mark.unit
def test_a_note_under_the_default_says_so_and_ages_with_the_day(clock) -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _as_of_query(cols, default={"kind": "today", "offsetDays": -1})).json()["id"]
        w = _put(client, "query", q)
        today = _state(client, "query", q)
        clock["t"] = datetime(2026, 10, 13, 9, 0, tzinfo=timezone.utc)
        tomorrow = _state(client, "query", q)

    assert w.json()["anchor"]["params"] == {"as_of": "2026-10-11"}  # stamped as the date it meant
    assert w.json()["anchor"]["assumedParams"] == ["as_of"]
    assert today == "current" and tomorrow == "other_period"


@pytest.mark.unit
def test_an_edited_query_reads_other_definition_also_on_its_widget_and_dashboard() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, {"q": None, "filters": [], "advanced": []}).json()["id"]
        dsh = _dashboard(client, ws, [_widget(_W1, q)]).json()["id"]
        for kind, noun in (("query", q), ("widget", f"{dsh}:{_W1}"), ("dashboard", dsh)):
            assert _put(client, kind, noun).status_code == 201
        edit = client.put(f"/queries/{q}", json={"definition": {"q": "North", "filters": [], "advanced": []}})
        assert edit.status_code == 200, edit.text
        states = {
            "query": _state(client, "query", q),
            "widget": client.get(f"/metadata/dashboard/{dsh}").json()["children"][_W1]["aicowork"]["state"],
            "dashboard": _state(client, "dashboard", dsh),
        }

    assert states == {"query": "other_definition", "widget": "other_definition", "dashboard": "other_definition"}


@pytest.mark.unit
def test_dashboard_period_follows_its_controls_and_targets() -> None:
    """BA contract-exit P0-2: the dashboard's period is its control as the bar
    shows it, and a viewer value reaches only the widgets its control targets
    (W1); W2, untargeted, keeps its query's default and its note stays current."""
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _as_of_query(cols, default="2026-10-10")).json()["id"]
        created = _dashboard(
            client, ws, [_widget(_W1, q), _widget(_W2, q)], [_control(saved="2026-10-04", targets=[_W1])]
        )
        assert created.status_code == 201, created.text
        dsh = created.json()["id"]
        w = _put(client, "dashboard", dsh, params={"as_of": "2026-10-11"})
        saved = _put(client, "dashboard", dsh, md="under the saved value").json()
        w1 = _put(client, "widget", f"{dsh}:{_W1}", params={"as_of": "2026-10-11"})
        w2 = _put(client, "widget", f"{dsh}:{_W2}", params={"as_of": "2026-10-11"})
        read = client.get(f"/metadata/dashboard/{dsh}?p.as_of=2026-10-12").json()
        plain = client.get(f"/metadata/dashboard/{dsh}").json()

    assert w.status_code == 201, w.text
    assert w.json()["anchor"]["params"] == {"as_of": "2026-10-11"}
    assert saved["anchor"]["params"] == {"as_of": "2026-10-04"} and saved["anchor"]["assumedParams"] == ["as_of"]
    assert w1.json()["anchor"]["params"] == {"as_of": "2026-10-11"}
    assert w2.json()["anchor"]["params"] == {"as_of": "2026-10-10"}  # no control targets W2
    assert w2.json()["anchor"]["assumedParams"] == ["as_of"]
    assert read["current"]["params"] == {"as_of": "2026-10-12"}
    assert read["children"][_W1]["aicowork"]["state"] == "other_period"
    assert read["children"][_W2]["aicowork"]["state"] == "current"
    assert read["childrenCurrent"][_W2]["params"] == {"as_of": "2026-10-10"}
    assert plain["entries"]["aicowork"]["state"] == "current"  # the last write: the saved value
    validate_response("metadata/get.contract.yaml", 200, read)


@pytest.mark.unit
def test_the_anchor_takes_nothing_from_the_client() -> None:
    with TestClient(app) as client:
        _ws, ds, _cols = _dataset(client)
        forged = _put(client, "dataset", ds, anchor={"definitionVersion": "x", "dataVersions": {ds: 99}})
        sneaky = _put(client, "dataset", ds, params={"dataVersions": "99"})
        huge = _put(client, "dataset", ds, params={"who": "x" * 257})

    assert forged.status_code == 422 and huge.status_code == 422
    assert sneaky.status_code == 201 and sneaky.json()["anchor"]["dataVersions"] == {ds: 1}
    assert "params" not in sneaky.json()["anchor"]  # a dataset has no parameters


@pytest.mark.unit
def test_an_rc2_entry_compares_its_definition_only() -> None:
    with TestClient(app) as client:
        ws, ds, _cols = _dataset(client)
        w = _put(client, "dataset", ds).json()
        with db.get_conn() as con:
            con.execute("UPDATE metadata_entries SET anchor_json = NULL")
            con.commit()
        _refresh(client, ws, ds)
        read = client.get(f"/metadata/dataset/{ds}").json()

    entry = read["entries"]["aicowork"]
    assert entry["anchor"] == {"definitionVersion": w["definitionVersion"]}
    assert entry["state"] == "current" and entry["stale"] is False


@pytest.mark.unit
def test_state_rules_cover_the_run() -> None:
    base = {"definitionVersion": "a"}
    assert state_of({**base, "runId": "run_00000001"}, {**base, "runId": "run_00000002"}) == "refreshed"
    assert state_of({**base, "runId": "run_00000001"}, {**base, "runId": "run_00000001"}) == "current"
    assert state_of(base, {**base, "runId": "run_00000002"}, legacy=True) == "current"  # rc.2 entry
    assert state_of(base, {**base, "runId": "run_00000002"}) == "refreshed"  # written before the first run
    # A query the entry was about is no longer behind the widget (CR P2-2).
    assert state_of({**base, "queryVersions": {"q": "h"}}, base) == "other_definition"
    assert (
        state_of(
            {**base, "params": {"x": 1}, "dataVersions": {"d": 1}},
            {**base, "params": {"x": 2}, "dataVersions": {"d": 2}},
        )
        == "other_period"
    )


@pytest.mark.unit
def test_a_note_on_a_query_without_defaults_sees_a_refresh() -> None:
    """QA P1-1: the anchor's data must not depend on a parameter having a default."""
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _as_of_query(cols)).json()["id"]
        w = _put(client, "query", q, params={"as_of": "2026-10-11"})
        _refresh(client, ws, ds)
        after = _state(client, "query", q, "?p.as_of=2026-10-11")

    assert w.json()["anchor"]["dataVersions"] == {ds: 1}
    assert after == "refreshed"


@pytest.mark.unit
def test_a_bad_reader_value_is_not_replaced_by_the_default() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, _as_of_query(cols, default="2026-10-10")).json()["id"]
        _put(client, "query", q, params={"as_of": "2026-10-11"})
        read = client.get(f"/metadata/query/{q}?p.as_of=junk").json()

    assert "params" not in read["current"]
    assert read["entries"]["aicowork"]["state"] == "current"


# --- saved copies ---------------------------------------------------------------


@pytest.mark.unit
def test_a_copy_keeps_its_notes_anchored_to_the_frozen_data() -> None:
    with TestClient(app) as client:
        ws, ds, _cols = _dataset(client)
        _put(client, "dataset", ds)
        _refresh(client, ws, ds)  # the original is at v2, its note at v1
        copy = client.post(f"/workspaces/{ws}/saved-copies", json={"label": "wk", "datasetIds": [ds]}).json()[
            "datasets"
        ][0]["id"]
        on_copy = client.get(f"/metadata/dataset/{copy}").json()["entries"]["aicowork"]

    assert on_copy["anchor"]["dataVersions"] == {copy: 1}
    assert on_copy["state"] == "refreshed"  # written for v1; the copy froze v2 — no forced "current"


# --- the cascade ----------------------------------------------------------------


def _swept(kind: str) -> list[str]:
    with db.get_conn() as con:
        return [r["noun_id"] for r in con.execute("SELECT noun_id FROM metadata_entries_swept WHERE kind = ?", (kind,))]


def _live(kind: str) -> list[str]:
    with db.get_conn() as con:
        return [r["noun_id"] for r in con.execute("SELECT noun_id FROM metadata_entries WHERE kind = ?", (kind,))]


@pytest.mark.unit
def test_deleting_a_noun_takes_its_entries_to_the_archive() -> None:
    with TestClient(app) as client:
        ws, ds, cols = _dataset(client)
        q = _query(client, ws, ds, {"q": None, "filters": [], "advanced": []}).json()["id"]
        dsh = _dashboard(client, ws, [_widget(_W1, q), _widget(_W2, q)]).json()["id"]
        for kind, noun in (
            ("dataset", ds),
            ("column", f"{ds}:team"),
            ("query", q),
            ("dashboard", dsh),
            ("widget", f"{dsh}:{_W1}"),
            ("widget", f"{dsh}:{_W2}"),
        ):
            assert _put(client, kind, noun).status_code == 201, (kind, noun)

        # A widget removed from its dashboard: its entries go, the other's stay.
        client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": {"widgets": [_widget(_W2, q)]}})
        assert _swept("widget") == [f"{dsh}:{_W1}"] and _live("widget") == [f"{dsh}:{_W2}"]

        # A column that leaves in a refresh is kept (it may come back) — BA P1-1.
        _refresh(client, ws, ds, b"id,amount,day,at\n1,10,2026-10-10,2026-10-10 09:00:00\n")
        assert _live("column") == [f"{ds}:team"]

        client.delete(f"/dashboards/{dsh}")
        assert _live("dashboard") == [] and _live("widget") == []
        client.delete(f"/datasets/{ds}")  # its rooted query goes with it (R79)

    assert _live("dataset") == [] and _live("column") == [] and _live("query") == []
    assert sorted(_swept("dataset") + _swept("column") + _swept("query")) == sorted([ds, f"{ds}:team", q])


@pytest.mark.unit
def test_deleting_a_workspace_sweeps_everything_in_it() -> None:
    with TestClient(app) as client:
        ws, ds, _cols = _dataset(client)
        _put(client, "dataset", ds)
        r = client.delete(f"/workspaces/{ws}")
        if r.status_code == 409:  # non-empty workspaces refuse; empty it first
            client.delete(f"/datasets/{ds}")
            r = client.delete(f"/workspaces/{ws}")
    assert r.status_code == 204, r.text
    assert _live("dataset") == [] and ds in _swept("dataset")


# --- migration 0010 -------------------------------------------------------------


@pytest.fixture
def _restore_db_path():
    original = db.get_db_path()
    yield
    db.set_db_path(original)


def test_0010_archives_orphans_and_gives_them_back(tmp_path: Path, _restore_db_path) -> None:
    path = tmp_path / "m.sqlite"
    db.set_db_path(path)
    cfg = db._alembic_config()
    command.upgrade(cfg, "0009_saved_copies")
    con = sqlite3.connect(path)
    con.execute("INSERT INTO workspaces (id, name, created_at) VALUES ('ws_00000001', 'W', '2026-01-01T00:00:00Z')")
    con.execute(
        "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
        "source_format, created_at, refreshed_at, data_version) VALUES ('ds_0000000a', 'ws_00000001', 'd', 1, 1, "
        "1, '[{\"name\":\"a\",\"dtype\":\"string\"}]', 'csv', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 1)"
    )
    con.execute(
        "INSERT INTO dashboards (id, workspace_id, name, slug, definition_json, created_at) VALUES "
        "('dsh_0000000a', 'ws_00000001', 'D', 'd', '{\"widgets\":[{\"id\":\"wdg_0000000a\"}]}', '2026-01-01T00:00:00Z')"
    )
    rows = [
        ("dataset", "ds_0000000a"),  # live
        ("column", "ds_0000000a:gone"),  # its column left: kept (P1-1)
        ("dataset", "ds_0000000b"),  # orphan
        ("column", "ds_0000000b:a"),  # orphan (dataset gone)
        ("widget", "dsh_0000000a:wdg_0000000a"),  # live
        ("widget", "dsh_0000000a:wdg_0000000b"),  # orphan (widget removed)
        ("query", "qr_0000000a"),  # orphan
    ]
    for kind, noun in rows:
        con.execute(
            "INSERT INTO metadata_entries (kind, noun_id, namespace, md, source, author, written_at, "
            "definition_version) VALUES (?, ?, 'n', 'x', 'ai', 'a', '2026-01-01T00:00:00Z', 'v')",
            (kind, noun),
        )
    con.commit()
    con.close()

    command.upgrade(cfg, "0010_metadata_anchor")
    con = sqlite3.connect(path)
    live = sorted(r[0] for r in con.execute("SELECT noun_id FROM metadata_entries"))
    swept = sorted(r[0] for r in con.execute("SELECT noun_id FROM metadata_entries_swept"))
    con.close()
    assert live == ["ds_0000000a", "ds_0000000a:gone", "dsh_0000000a:wdg_0000000a"]
    assert swept == ["ds_0000000b", "ds_0000000b:a", "dsh_0000000a:wdg_0000000b", "qr_0000000a"]

    command.downgrade(cfg, "0009_saved_copies")
    con = sqlite3.connect(path)
    back = sorted(r[0] for r in con.execute("SELECT noun_id FROM metadata_entries"))
    tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]
    con.close()
    assert back == sorted(n for _k, n in rows)
    assert "metadata_entries_swept" not in tables
    command.upgrade(cfg, "head")
