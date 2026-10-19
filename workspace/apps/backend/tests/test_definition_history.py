"""R200 (item 4.4) — the definition history of queries, dashboards and workflows.

rc4.md § 4.4: every definition change writes one row; a rename writes none;
restore (an ordinary PUT of an old definition) creates a new version. Plus the
design's criteria (`design/data-management/_shared/definition-history.md`
C1–C13): one transaction with the change, one hash with the metadata anchor, the
writer token's author / source, the delete sweep, `sourceChangedSince`, and
migration 0011 both ways on a populated database.
"""

from __future__ import annotations

import importlib.util
import json
import sqlite3
from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient

from app import db, history
from app._config import CONFIG
from app._config.settings import MetadataToken
from app.main import app
from app.metadata import definition_version
from tests._conformance import validate_response
from tests.test_dashboard_controls import _dashboard, _widget
from tests.test_metadata_anchor import _refresh
from tests.test_params import _CSV, _EMPTY, _col, _query

_TOKEN = "writer-token-0123456789abcdef"
_H = {"Authorization": f"Bearer {_TOKEN}"}
_W1, _W2 = "wdg_0000000a", "wdg_0000000b"
_STEP = {"kind": "aggregate", "dimensions": ["team"], "measures": [{"col": "amount", "agg": "sum"}]}
_STEP2 = {"kind": "aggregate", "dimensions": ["team"], "measures": [{"col": "amount", "agg": "max"}]}


@pytest.fixture(autouse=True)
def tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        CONFIG.settings.backend,
        "metadata_tokens",
        [MetadataToken(token=_TOKEN, author="report-agent", source="ai", namespaces=["notes"])],
    )


# --- helpers ---------------------------------------------------------------------


def _filter(cols: list[dict], team: str) -> dict:
    return {**_EMPTY, "filters": [{"col": _col(cols, "team"), "dtype": "string", "op": "equals", "val": team}]}


def _history(client: TestClient, route: str, noun: str) -> dict:
    r = client.get(f"/{route}/{noun}/history")
    assert r.status_code == 200, r.text
    validate_response(f"{route}/history-get.contract.yaml", 200, r.json(), route=f"/{route}/{{id}}/history")
    return r.json()


def _version(client: TestClient, route: str, noun: str, version: str):
    r = client.get(f"/{route}/{noun}/history/{version}")
    if r.status_code == 200:
        validate_response(
            f"{route}/history-get.contract.yaml", 200, r.json(), route=f"/{route}/{{id}}/history/{{version}}"
        )
    return r


def _seqs(body: dict) -> list[int]:
    return [e["seq"] for e in body["entries"]]


def _rows(kind: str | None = None) -> list[tuple]:
    con = sqlite3.connect(db.get_db_path())
    try:
        sql = "SELECT kind, noun_id, seq, change FROM definition_history"
        args: tuple = ()
        if kind:
            sql += " WHERE kind = ?"
            args = (kind,)
        return con.execute(sql + " ORDER BY kind, noun_id, seq", args).fetchall()
    finally:
        con.close()


def _dataset(client: TestClient, ws_name: str = "Acme") -> tuple[str, str, list[dict]]:
    ws = client.post("/workspaces", json={"name": ws_name}).json()["id"]
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("p.csv", _CSV, "text/csv")}).json()
    ds = client.post(
        f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "calls"}]}
    ).json()[0]
    return ws, ds["id"], ds["columns"]


def _three(client: TestClient, headers: dict | None = None, ws_name: str = "Acme"):
    """A dataset, a query on it, a dashboard over the query and a workflow over it."""
    ws, ds, cols = _dataset(client, ws_name)
    q = client.post(
        f"/workspaces/{ws}/queries",
        json={"name": "q", "sourceId": ds, "definition": _filter(cols, "North")},
        headers=headers or {},
    )
    assert q.status_code == 201, q.text
    qid = q.json()["id"]
    d = client.post(
        f"/workspaces/{ws}/dashboards",
        json={"name": "D", "slug": "d", "definition": {"widgets": [_widget(_W1, qid)]}},
        headers=headers or {},
    )
    assert d.status_code == 201, d.text
    w = client.post(
        f"/workspaces/{ws}/workflows",
        json={"name": "wf", "definition": {"sources": [qid], "steps": [_STEP]}},
        headers=headers or {},
    )
    assert w.status_code == 201, w.text
    return ws, ds, cols, qid, d.json()["id"], w.json()["id"]


# --- C1 · create writes #1 -------------------------------------------------------------


@pytest.mark.unit
def test_create_writes_one_create_row_per_kind() -> None:
    with TestClient(app) as client:
        _ws, _ds, _cols, qid, dsh, wf = _three(client)
        bodies = {r: _history(client, r, n) for r, n in (("queries", qid), ("dashboards", dsh), ("workflows", wf))}
        defs = {
            "queries": client.get(f"/queries/{qid}").json()["definition"],
            "dashboards": client.get(f"/dashboards/{dsh}").json()["definition"],
            "workflows": client.get(f"/workflows/{wf}").json()["definition"],
        }

    for route, body in bodies.items():
        assert body["kind"] == {"queries": "query", "dashboards": "dashboard", "workflows": "workflow"}[route]
        assert [(e["seq"], e["change"], e["changedBy"], e["changedSource"]) for e in body["entries"]] == [
            (1, "create", None, None)
        ]
        assert body["entries"][0]["version"] == body["current"]
        assert body["current"] == definition_version(defs[route])  # the stored definition's hash


# --- C2, C3 · a change writes one row; a rename / re-save none ------------------------------


@pytest.mark.unit
def test_every_definition_change_writes_one_row_rename_and_resave_write_none() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, dsh, wf = _three(client)
        # a definition change of each kind
        assert client.put(f"/queries/{qid}", json={"definition": _filter(cols, "South")}).status_code == 200
        dash_def = {"widgets": [_widget(_W1, qid), _widget(_W2, qid)]}
        assert client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": dash_def}).status_code == 200
        wf_def = {"sources": [qid], "steps": [_STEP2]}
        assert client.put(f"/workflows/{wf}", json={"name": "wf", "definition": wf_def}).status_code == 200
        after_change = {r: _history(client, r, n) for r, n in (("queries", qid), ("dashboards", dsh), ("workflows", wf))}
        # rename (same definition) and an unchanged re-save
        assert client.put(f"/dashboards/{dsh}", json={"name": "D2", "slug": "d2", "definition": dash_def}).status_code == 200
        assert client.put(f"/workflows/{wf}", json={"name": "wf2", "definition": wf_def}).status_code == 200
        assert client.put(f"/queries/{qid}", json={"definition": _filter(cols, "South")}).status_code == 200
        assert client.put(f"/dashboards/{dsh}", json={"name": "D2", "slug": "d2", "definition": dash_def}).status_code == 200
        after_rename = {r: _history(client, r, n) for r, n in (("queries", qid), ("dashboards", dsh), ("workflows", wf))}
        stored = {
            "queries": client.get(f"/queries/{qid}/history/{after_change['queries']['current']}").json(),
        }

    for route, body in after_change.items():
        assert _seqs(body) == [2, 1], route
        assert body["entries"][0]["change"] == "update"
        assert body["entries"][0]["version"] == body["current"] != body["entries"][1]["version"]
    assert after_rename == after_change  # nothing written by the rename or the re-saves
    assert stored["queries"]["definition"]["filters"][0]["val"] == "South"


# --- C4 · a refused save writes none ------------------------------------------------------


@pytest.mark.unit
def test_a_refused_save_writes_no_row() -> None:
    with TestClient(app) as client:
        ws, _ds, cols, qid, dsh, wf = _three(client)
        _dashboard(client, ws, [_widget(_W1, qid)], name="Taken")
        client.post(f"/workspaces/{ws}/workflows", json={"name": "taken", "definition": {"sources": [qid], "steps": []}})
        bad_q = client.put(f"/queries/{qid}", json={"definition": {**_EMPTY, "filters": [
            {"col": 99, "dtype": "string", "op": "equals", "val": "x"}]}})
        taken_d = client.put(
            f"/dashboards/{dsh}",
            json={"name": "Taken", "slug": "other", "definition": {"widgets": [_widget(_W2, qid)]}},
        )
        taken_w = client.put(f"/workflows/{wf}", json={"name": "taken", "definition": {"sources": [qid], "steps": [_STEP2]}})
        missing = client.put("/dashboards/dsh_0000dead", json={"name": "X", "slug": "x", "definition": {"widgets": []}})
        bodies = {r: _history(client, r, n) for r, n in (("queries", qid), ("dashboards", dsh), ("workflows", wf))}
        defs = (client.get(f"/dashboards/{dsh}").json()["definition"], client.get(f"/workflows/{wf}").json()["name"])

    assert bad_q.status_code == 422, bad_q.text
    assert taken_d.status_code == 409 and taken_w.status_code == 409
    assert missing.status_code == 404
    for route, body in bodies.items():
        assert _seqs(body) == [1], route
    assert [w["id"] for w in defs[0]["widgets"]] == [_W1] and defs[1] == "wf"  # nothing changed either
    assert all(r[1] != "dsh_0000dead" for r in _rows())


# --- C5, C6 · restore = PUT of an old definition; one hash -------------------------------------


@pytest.mark.unit
def test_restore_creates_a_new_version_with_the_old_hash_and_notes_read_current_again() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, _dsh, _wf = _three(client)
        v1 = _history(client, "queries", qid)["current"]
        note = client.put(f"/metadata/query/{qid}/notes", json={"md": "North only"}, headers=_H)
        assert client.put(f"/queries/{qid}", json={"definition": _filter(cols, "South")}).status_code == 200
        state_mid = client.get(f"/metadata/query/{qid}").json()["entries"]["notes"]["state"]
        old = _version(client, "queries", qid, v1).json()["definition"]
        restored = client.put(f"/queries/{qid}", json={"definition": old})
        body = _history(client, "queries", qid)
        read = _version(client, "queries", qid, v1).json()
        state_after = client.get(f"/metadata/query/{qid}").json()["entries"]["notes"]["state"]
        got = client.get(f"/queries/{qid}").json()["definition"]

    assert note.status_code == 201, note.text
    assert note.json()["definitionVersion"] == v1  # one hash: the note's anchor is the row's version
    assert restored.status_code == 200
    assert _seqs(body) == [3, 2, 1]
    assert [e["change"] for e in body["entries"]] == ["update", "update", "create"]
    assert body["entries"][0]["version"] == body["entries"][2]["version"] == v1 == body["current"]
    assert read["seq"] == 3  # the newest row with that version
    assert got["filters"][0]["val"] == "North"
    assert state_mid == "other_definition" and state_after == "current"


@pytest.mark.unit
def test_every_row_version_is_the_hash_of_its_definition() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, dsh, wf = _three(client)
        client.put(f"/queries/{qid}", json={"definition": _filter(cols, "South")})
    con = sqlite3.connect(db.get_db_path())
    try:
        rows = con.execute("SELECT version, definition_json FROM definition_history").fetchall()
    finally:
        con.close()
    assert len(rows) == 4
    assert all(v == definition_version(json.loads(d)) for v, d in rows)
    assert dsh and wf


# --- C7 · reads ----------------------------------------------------------------------------


@pytest.mark.unit
def test_reads_order_404s_and_malformed() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, dsh, wf = _three(client)
        for team in ("South", "West", "East"):
            client.put(f"/queries/{qid}", json={"definition": _filter(cols, team)})
        body = _history(client, "queries", qid)
        dash_v = _history(client, "dashboards", dsh)["current"]
        unknown_noun = client.get("/queries/qr_0000dead/history")
        unknown_noun_v = client.get(f"/queries/qr_0000dead/history/{body['current']}")
        not_in_history = client.get(f"/queries/{qid}/history/000000000000")
        other_nouns = client.get(f"/queries/{qid}/history/{dash_v}")
        wrong_prefix = client.get(f"/queries/{dsh}/history")
        malformed = client.get(f"/queries/{qid}/history/XYZ")
        wf_list = _history(client, "workflows", wf)

    assert _seqs(body) == [4, 3, 2, 1]
    assert body["current"] == body["entries"][0]["version"]
    for r in (unknown_noun, unknown_noun_v, not_in_history, other_nouns):
        assert r.status_code == 404, r.text
        assert r.json() == {"code": "not_found"}
    assert wrong_prefix.status_code == 422  # a dsh_ id is a malformed query id
    assert malformed.status_code == 422
    assert wf_list["kind"] == "workflow"


# --- C8 · who --------------------------------------------------------------------------------


@pytest.mark.unit
def test_a_writer_token_labels_the_change_and_never_refuses_it() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, dsh, wf = _three(client, headers=_H)
        unknown = client.put(
            f"/queries/{qid}", json={"definition": _filter(cols, "South")}, headers={"Authorization": "Bearer nope-nope-nope-nope"}
        )
        malformed = client.put(f"/queries/{qid}", json={"definition": _filter(cols, "West")}, headers={"Authorization": "x"})
        body_field = client.put(f"/queries/{qid}", json={"definition": _filter(cols, "East"), "changedBy": "me"})
        q = _history(client, "queries", qid)
        d = _history(client, "dashboards", dsh)
        w = _history(client, "workflows", wf)

    assert unknown.status_code == 200 and malformed.status_code == 200
    assert body_field.status_code == 422  # the body has no such field (extra="forbid")
    assert [(e["changedBy"], e["changedSource"]) for e in q["entries"]] == [
        (None, None),
        (None, None),
        ("report-agent", "ai"),
    ]
    assert d["entries"][0]["changedBy"] == w["entries"][0]["changedBy"] == "report-agent"
    assert d["entries"][0]["changedSource"] == "ai"


# --- C9 · source changed since (BA-C2) ----------------------------------------------------------


def _backdate(kind: str, noun: str) -> None:
    con = sqlite3.connect(db.get_db_path())
    con.execute(
        "UPDATE definition_history SET changed_at = '2000-01-01T00:00:00Z' WHERE kind = ? AND noun_id = ?", (kind, noun)
    )
    con.commit()
    con.close()


@pytest.mark.unit
def test_source_changed_since_flags_a_query_version_whose_dataset_was_refreshed_after_it() -> None:
    with TestClient(app) as client:
        ws, ds, cols, qid, dsh, wf = _three(client)
        v = _history(client, "queries", qid)["current"]
        fresh = _version(client, "queries", qid, v).json()
        _backdate("query", qid)  # the row was saved long before …
        _refresh(client, ws, ds)  # … and the source is refreshed now
        stale = _version(client, "queries", qid, v).json()
        dash = _version(client, "dashboards", dsh, _history(client, "dashboards", dsh)["current"]).json()
        wfv = _version(client, "workflows", wf, _history(client, "workflows", wf)["current"]).json()

    assert fresh["sourceChangedSince"] is False
    assert stale["sourceChangedSince"] is True
    assert "sourceChangedSince" not in dash and "sourceChangedSince" not in wfv
    assert cols


@pytest.mark.unit
def test_seq_names_the_clicked_row_of_a_repeated_version() -> None:
    """A version saved before a refresh and saved again after it: the flag is the
    CLICKED row's (`?seq=`), not the newest row's; a seq without that version 404s."""
    with TestClient(app) as client:
        ws, ds, cols, qid, _dsh, _wf = _three(client)
        v1 = _history(client, "queries", qid)["current"]
        client.put(f"/queries/{qid}", json={"definition": _filter(cols, "South")})
        _backdate("query", qid)  # #1 and #2 saved long ago …
        _refresh(client, ws, ds)  # … the source refreshed now …
        client.put(f"/queries/{qid}", json={"definition": _filter(cols, "North")})  # … #3 = #1's definition, now
        newest = _version(client, "queries", qid, v1).json()
        clicked = client.get(f"/queries/{qid}/history/{v1}?seq=1")
        wrong = client.get(f"/queries/{qid}/history/{v1}?seq=2")
        bad = client.get(f"/queries/{qid}/history/{v1}?seq=0")

    assert newest["seq"] == 3 and newest["sourceChangedSince"] is False
    assert clicked.status_code == 200
    validate_response(
        "queries/history-get.contract.yaml", 200, clicked.json(), route="/queries/{id}/history/{version}"
    )
    assert clicked.json()["seq"] == 1 and clicked.json()["sourceChangedSince"] is True
    assert wrong.status_code == 404
    assert bad.status_code == 422


@pytest.mark.unit
def test_a_baseline_row_counts_any_refresh_and_a_missing_source_counts() -> None:
    with TestClient(app) as client:
        ws, ds, _cols, qid, _dsh, _wf = _three(client)
        con = sqlite3.connect(db.get_db_path())
        con.execute("UPDATE definition_history SET change = 'baseline', changed_at = '2099-01-01T00:00:00Z'")
        con.commit()
        con.close()
        v = _history(client, "queries", qid)["current"]
        never = _version(client, "queries", qid, v).json()["sourceChangedSince"]
        _refresh(client, ws, ds)  # data_version 2, refreshed "before" the (future) baseline time
        ever = _version(client, "queries", qid, v).json()["sourceChangedSince"]

    assert never is False and ever is True
    con = sqlite3.connect(db.get_db_path())
    con.row_factory = sqlite3.Row
    try:
        entry = {"change": "update", "changedAt": "2099-01-01T00:00:00Z"}
        assert history.source_changed_since(con, qid, {"relationships": [], "joins": []}, entry) is False
        con.execute("PRAGMA foreign_keys = OFF")
        con.execute("DELETE FROM datasets WHERE id = ?", (ds,))
        assert history.source_changed_since(con, qid, {}, entry) is True
    finally:
        con.close()


@pytest.mark.unit
def test_source_ids_follow_join_ends_and_composed_queries() -> None:
    definition = {
        "relationships": [
            {"id": "qrel_0000000a", "leftSourceId": "ds_0000000a", "rightSourceId": "ds_0000000b"},
            {"id": "qrel_0000000b", "leftSourceId": "ds_0000000a", "rightSourceId": "ds_0000000c"},
        ],
        "joins": [{"queryRelId": "qrel_0000000a"}],
    }
    assert history._source_ids("ds_0000000a", definition) == {"ds_0000000a", "ds_0000000b"}  # unused rel ignored
    assert history._source_ids("ds_0000000a", {"join": {"queryRelId": "qrel_0000000b"}, **definition}) == {
        "ds_0000000a",
        "ds_0000000b",
    }


# --- C10 · delete takes the history -----------------------------------------------------------


@pytest.mark.unit
def test_deleting_a_noun_deletes_its_history_and_nothing_else() -> None:
    with TestClient(app) as client:
        ws, ds, _cols, qid, dsh, wf = _three(client)
        ws2, ds2, cols2, q2, d2, w2 = _three(client, ws_name="Acme 2")
        assert client.delete(f"/workflows/{wf}").status_code == 204
        after_wf = _rows()
        assert client.delete(f"/dashboards/{dsh}").status_code == 204
        after_dsh = _rows()
        assert client.delete(f"/queries/{qid}").status_code == 204
        after_q = _rows()
        # a dataset delete removes its queries (app cascade) → their history too
        q3 = _query(client, ws, ds, _EMPTY, "again").json()["id"]
        assert client.delete(f"/datasets/{ds}").status_code == 204
        after_ds = _rows()
        # a workspace delete (its datasets first — non-empty workspaces are refused)
        client.delete(f"/workflows/{w2}")
        assert client.delete(f"/datasets/{ds2}").status_code == 204
        assert client.delete(f"/dashboards/{d2}").status_code == 204
        assert client.delete(f"/workspaces/{ws2}").status_code == 204

    nouns = lambda rows: {r[1] for r in rows}  # noqa: E731
    assert wf not in nouns(after_wf) and {qid, dsh, q2, d2, w2} <= nouns(after_wf)
    assert dsh not in nouns(after_dsh) and {qid, q2, d2, w2} <= nouns(after_dsh)
    assert qid not in nouns(after_q) and {q2, d2, w2} <= nouns(after_q)
    assert q3 not in nouns(after_ds) and {q2, d2, w2} <= nouns(after_ds)
    assert _rows() == []
    assert cols2


@pytest.mark.unit
def test_a_workspace_delete_sweeps_its_nouns_history() -> None:
    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "Empty"}).json()["id"]
        other_ws, _ds, _cols, q_keep, _d, _w = _three(client, ws_name="Acme 2")
        # a dashboard with no widgets lives in a workspace with no datasets
        dsh = client.post(
            f"/workspaces/{ws}/dashboards", json={"name": "E", "slug": "e", "definition": {"widgets": []}}
        ).json()["id"]
        before = {r[1] for r in _rows()}
        assert client.delete(f"/workspaces/{ws}").status_code == 204
        after = {r[1] for r in _rows()}

    assert dsh in before and dsh not in after
    assert q_keep in after and other_ws


# --- C11 · migration 0011 both ways on a populated database ----------------------------------------


@pytest.fixture
def _restore_db_path():
    original = db.get_db_path()
    yield
    db.set_db_path(original)


_Q_DEF = json.dumps({"q": None, "filters": [{"col": 1, "dtype": "string", "op": "equals", "val": "North"}], "advanced": [], "x": None})
_D_DEF = json.dumps({"widgets": [{"id": "wdg_0000000a", "title": "T", "chartType": "note", "span": 1, "md": "hi"}]})
_W_DEF = json.dumps({"sources": ["qr_0000000a"], "steps": []})


def _seed_at_0010(path: Path) -> None:
    con = sqlite3.connect(path)
    con.execute("INSERT INTO workspaces (id, name, created_at) VALUES ('ws_0000000a', 'Acme', '2026-01-01T00:00:00Z')")
    con.execute(
        "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
        "source_format, created_at, refreshed_at, data_version) VALUES ('ds_0000000a', 'ws_0000000a', 'calls', 1, 1, "
        "1, '[{\"name\":\"team\",\"dtype\":\"string\"}]', 'csv', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 1)"
    )
    con.execute(
        "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
        "VALUES ('qr_0000000a', 'ws_0000000a', 'ds_0000000a', 'q', ?, '2026-01-02T00:00:00Z')",
        (_Q_DEF,),
    )
    con.execute(
        "INSERT INTO dashboards (id, workspace_id, name, slug, definition_json, created_at) "
        "VALUES ('dsh_0000000a', 'ws_0000000a', 'D', 'd', ?, '2026-01-03T00:00:00Z')",
        (_D_DEF,),
    )
    con.execute(
        "INSERT INTO workflows (id, workspace_id, name, definition_json, created_at) "
        "VALUES ('wf_0000000a', 'ws_0000000a', 'wf', ?, '2026-01-04T00:00:00Z')",
        (_W_DEF,),
    )
    con.commit()
    con.close()


def _nouns(path: Path) -> list:
    con = sqlite3.connect(path)
    try:
        return [
            con.execute(f"SELECT * FROM {t} ORDER BY id").fetchall()  # noqa: S608 — constants
            for t in ("workspaces", "datasets", "queries", "dashboards", "workflows")
        ]
    finally:
        con.close()


def _tables(path: Path) -> set[str]:
    con = sqlite3.connect(path)
    try:
        return {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    finally:
        con.close()


@pytest.mark.unit
def test_0011_upgrade_seeds_baselines_downgrade_keeps_every_noun_upgrade_again(tmp_path: Path, _restore_db_path) -> None:
    path = tmp_path / "m.sqlite"
    db.set_db_path(path)
    cfg = db._alembic_config()
    command.upgrade(cfg, "0010_metadata_anchor")
    _seed_at_0010(path)
    nouns_before = _nouns(path)

    command.upgrade(cfg, "head")
    con = sqlite3.connect(path)
    seeded = con.execute(
        "SELECT kind, noun_id, seq, version, definition_json, change, changed_by, changed_source "
        "FROM definition_history ORDER BY kind, noun_id"
    ).fetchall()
    con.close()
    assert [(k, n, s, c, b, src) for k, n, s, _v, _d, c, b, src in seeded] == [
        ("dashboard", "dsh_0000000a", 1, "baseline", None, None),
        ("query", "qr_0000000a", 1, "baseline", None, None),
        ("workflow", "wf_0000000a", 1, "baseline", None, None),
    ]
    for _k, _n, _s, version, definition_json, *_rest in seeded:
        assert version == definition_version(json.loads(definition_json))  # the app's hash
    assert {r[4] for r in seeded} == {_Q_DEF, _D_DEF, _W_DEF}  # stored as the noun held it
    assert _nouns(path) == nouns_before

    # the app reads the seeded history (a baseline, the noun's current version)
    with TestClient(app) as client:
        body = _history(client, "queries", "qr_0000000a")
    assert body["entries"][0]["change"] == "baseline" and body["entries"][0]["version"] == body["current"]

    command.downgrade(cfg, "-1")
    assert "definition_history" not in _tables(path)
    assert _nouns(path) == nouns_before

    command.upgrade(cfg, "head")
    con = sqlite3.connect(path)
    again = con.execute("SELECT kind, noun_id, seq, change FROM definition_history ORDER BY kind").fetchall()
    con.close()
    assert [r[3] for r in again] == ["baseline"] * 3
    assert _nouns(path) == nouns_before


@pytest.mark.unit
def test_the_migrations_hash_copy_matches_the_app() -> None:
    mig = Path(__file__).parents[1] / "alembic" / "versions" / "0011_definition_history.py"
    spec = importlib.util.spec_from_file_location("_mig_0011", mig)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    samples = [json.loads(_Q_DEF), json.loads(_D_DEF), json.loads(_W_DEF), {"a": [None, {"b": None, "c": "é"}]}, {}]
    assert [module._version(s) for s in samples] == [definition_version(s) for s in samples]
