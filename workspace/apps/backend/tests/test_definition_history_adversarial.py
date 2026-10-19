"""R200 QA — adversarial tests for the definition history (item 4.4), adopted from
the QA pass (fix commit, CR-7 / QA-1).

Every create / update writes exactly one row; a rename, an unchanged re-save
(key order, spelled-out nulls) and a refused save write none; restore is a new
version; `?seq=` mismatches 404; `sourceChangedSince` around a real refresh; the
delete sweeps; concurrent PUTs take unique contiguous seqs; the writer token
labels and never refuses; old shapes come back as saved; R197 notes read
`current` again after a restore; R199 control ids come back with a dashboard
restore and a stale `f.` key is ignored.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient

from app import db
from app._config import CONFIG
from app._config.settings import MetadataToken
from app.main import app
from app.metadata import definition_version
from app.models.common import UpdateQueryBody
from app.routers.queries import update_query
from tests.test_definition_history import _W1, _W2, _filter, _three
from tests.test_metadata_anchor import _refresh
from tests.test_params import _EMPTY

_TOKEN = "qa-writer-token-0123456789abcdef"
_H = {"Authorization": f"Bearer {_TOKEN}"}


@pytest.fixture(autouse=True)
def tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        CONFIG.settings.backend,
        "metadata_tokens",
        [MetadataToken(token=_TOKEN, author="qa-agent", source="ai", namespaces=["notes"])],
    )


def _count(noun: str | None = None) -> int:
    con = sqlite3.connect(db.get_db_path())
    try:
        if noun is None:
            return con.execute("SELECT COUNT(*) FROM definition_history").fetchone()[0]
        return con.execute("SELECT COUNT(*) FROM definition_history WHERE noun_id = ?", (noun,)).fetchone()[0]
    finally:
        con.close()


def _hist(client: TestClient, route: str, noun: str) -> dict:
    r = client.get(f"/{route}/{noun}/history")
    assert r.status_code == 200, r.text
    return r.json()


def _reordered(d: object) -> object:
    """The same definition with every object's keys in reverse order."""
    if isinstance(d, dict):
        return {k: _reordered(d[k]) for k in reversed(list(d))}
    if isinstance(d, list):
        return [_reordered(x) for x in d]
    return d


# --- exactly one row per change; none for the rest ----------------------------------------


@pytest.mark.unit
def test_each_create_and_each_definition_change_writes_exactly_one_row() -> None:
    with TestClient(app) as client:
        assert _count() == 0
        _ws, _ds, cols, qid, dsh, wf = _three(client)
        assert _count() == 3 and _count(qid) == _count(dsh) == _count(wf) == 1
        for i, team in enumerate(("South", "West", "East", "Nörth ✓", "=SUM(A1)"), start=2):
            assert client.put(f"/queries/{qid}", json={"definition": _filter(cols, team)}).status_code == 200
            assert _count(qid) == i
        for i, n in enumerate((2, 3, 1), start=2):
            widgets = [{"id": f"wdg_0000000{k}", "queryId": qid, "title": "t", "chartType": "table", "agg": "count", "span": 1}
                       for k in range(1, n + 1)]
            assert client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": {"widgets": widgets}}).status_code == 200
            assert _count(dsh) == i
        assert _count() == 3 + 5 + 3


@pytest.mark.unit
def test_rename_key_order_and_spelled_nulls_write_no_row() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, dsh, wf = _three(client)
        q = client.get(f"/queries/{qid}").json()["definition"]
        d = client.get(f"/dashboards/{dsh}").json()["definition"]
        w = client.get(f"/workflows/{wf}").json()["definition"]
        before = _count()
        # key order reversed everywhere
        assert client.put(f"/queries/{qid}", json={"definition": _reordered(q)}).status_code == 200
        assert client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": _reordered(d)}).status_code == 200
        assert client.put(f"/workflows/{wf}", json={"name": "wf", "definition": _reordered(w)}).status_code == 200
        # nulls spelled out (q, controls) vs omitted
        assert client.put(f"/queries/{qid}", json={"definition": {**q, "q": None}}).status_code == 200
        assert client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": {**d, "controls": None}}).status_code == 200
        # renames
        assert client.put(f"/dashboards/{dsh}", json={"name": "Renamed ✓", "slug": "renamed", "definition": d}).status_code == 200
        assert client.put(f"/workflows/{wf}", json={"name": "renamed wf", "definition": w}).status_code == 200
        assert _count() == before
        assert _hist(client, "dashboards", dsh)["entries"][0]["change"] == "create"
        assert cols


@pytest.mark.unit
def test_refused_saves_write_no_row() -> None:
    with TestClient(app) as client:
        ws, _ds, cols, qid, dsh, wf = _three(client)
        client.post(f"/workspaces/{ws}/dashboards", json={"name": "Taken", "slug": "taken", "definition": {"widgets": []}})
        before = _count()
        refused = [
            client.put(f"/queries/{qid}", json={"definition": {**_EMPTY, "filters": [{"col": 99, "dtype": "string", "op": "equals", "val": "x"}]}}),
            client.put(f"/queries/{qid}", json={"definition": {**_EMPTY, "bogus": 1}}),
            client.put(f"/queries/{qid}", json={"definition": _filter(cols, "South"), "name": "x"}),
            client.put("/queries/qr_0000dead", json={"definition": _filter(cols, "South")}),
            client.put(f"/dashboards/{dsh}", json={"name": "Taken", "slug": "taken", "definition": {"widgets": []}}),
            client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": {"widgets": [
                {"id": _W1, "queryId": "qr_0000dead", "title": "t", "chartType": "table", "agg": "count", "span": 1}]}}),
            client.put("/dashboards/dsh_0000dead", json={"name": "X", "slug": "x", "definition": {"widgets": []}}),
            client.put(f"/workflows/{wf}", json={"name": "wf", "definition": {"sources": ["qr_0000dead"], "steps": []}}),
            client.put("/workflows/wf_0000dead", json={"name": "wf", "definition": {"sources": [qid], "steps": []}}),
            client.post(f"/workspaces/{ws}/queries", json={"name": "q", "sourceId": _ds, "definition": _EMPTY}),  # 409 name
            client.post(f"/workspaces/{ws}/dashboards", json={"name": "Taken", "slug": "t2", "definition": {"widgets": []}}),
            client.post("/workspaces/ws_0000dead/workflows", json={"name": "x", "definition": {"sources": [qid], "steps": []}}),
        ]
        assert [r.status_code for r in refused] == [422, 422, 422, 404, 409, 422, 404, 422, 404, 409, 409, 422], [
            (r.status_code, r.text[:120]) for r in refused
        ]
        assert _count() == before


# --- restore ---------------------------------------------------------------------------------


@pytest.mark.unit
def test_restore_of_each_kind_is_a_new_row_with_the_old_version() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, dsh, wf = _three(client)
        d1 = client.get(f"/dashboards/{dsh}").json()["definition"]
        w1 = client.get(f"/workflows/{wf}").json()["definition"]
        client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": {"widgets": []}})
        client.put(f"/workflows/{wf}", json={"name": "wf", "definition": {**w1, "steps": []}})
        v1d = _hist(client, "dashboards", dsh)["entries"][-1]["version"]
        v1w = _hist(client, "workflows", wf)["entries"][-1]["version"]
        old_d = client.get(f"/dashboards/{dsh}/history/{v1d}?seq=1").json()["definition"]
        old_w = client.get(f"/workflows/{wf}/history/{v1w}?seq=1").json()["definition"]
        assert client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": old_d}).status_code == 200
        assert client.put(f"/workflows/{wf}", json={"name": "wf", "definition": old_w}).status_code == 200
        hd, hw = _hist(client, "dashboards", dsh), _hist(client, "workflows", wf)
        # a second restore of the same (now current) version writes nothing
        client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": old_d})
        assert _hist(client, "dashboards", dsh) == hd
    for h, v in ((hd, v1d), (hw, v1w)):
        assert [e["seq"] for e in h["entries"]] == [3, 2, 1]
        assert h["entries"][0]["version"] == h["entries"][2]["version"] == v == h["current"]
        assert h["entries"][0]["change"] == "update"
    assert definition_version(d1) == v1d and cols


# --- ?seq= -------------------------------------------------------------------------------------


@pytest.mark.unit
def test_seq_mismatches_404_and_bad_seq_422() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, dsh, _wf = _three(client)
        _ws2, _ds2, _c2, q2, _d2, _w2 = _three(client, ws_name="Other")
        client.put(f"/queries/{qid}", json={"definition": _filter(cols, "South")})
        h = _hist(client, "queries", qid)
        v2, v1 = h["entries"][0]["version"], h["entries"][1]["version"]
        client.put(f"/queries/{q2}", json={"definition": _filter(_c2, "Zed")})  # its own hash (same text = same hash)
        v_other = _hist(client, "queries", q2)["current"]
        assert v_other not in (v1, v2)
        cases = {
            "own seq": client.get(f"/queries/{qid}/history/{v1}?seq=1").status_code,
            "seq of other version": client.get(f"/queries/{qid}/history/{v1}?seq=2").status_code,
            "seq past the end": client.get(f"/queries/{qid}/history/{v2}?seq=99").status_code,
            "huge seq": client.get(f"/queries/{qid}/history/{v2}?seq=999999999999999999").status_code,
            "another noun's version+seq": client.get(f"/queries/{qid}/history/{v_other}?seq=1").status_code,
            "dashboard's version on query": client.get(f"/queries/{qid}/history/{_hist(client, 'dashboards', dsh)['current']}?seq=1").status_code,
            "seq=0": client.get(f"/queries/{qid}/history/{v1}?seq=0").status_code,
            "seq=-1": client.get(f"/queries/{qid}/history/{v1}?seq=-1").status_code,
            "seq=abc": client.get(f"/queries/{qid}/history/{v1}?seq=abc").status_code,
            "uppercase version": client.get(f"/queries/{qid}/history/{v1.upper()}").status_code if v1 != v1.upper() else 422,
        }
    assert cases == {
        "own seq": 200,
        "seq of other version": 404,
        "seq past the end": 404,
        "huge seq": 404,
        "another noun's version+seq": 404,
        "dashboard's version on query": 404,
        "seq=0": 422,
        "seq=-1": 422,
        "seq=abc": 422,
        "uppercase version": 422,
    }


# --- sourceChangedSince with real clocks ---------------------------------------------------------


@pytest.mark.unit
def test_source_changed_since_flips_on_a_real_refresh_after_the_save() -> None:
    with TestClient(app) as client:
        ws, ds, _cols, qid, _dsh, _wf = _three(client)
        # CR-2 warns on a same-second tie; the upload and the save share a second here,
        # so date the upload before the save to read the "unchanged" side first.
        con = sqlite3.connect(db.get_db_path())
        con.execute("UPDATE datasets SET refreshed_at = '2000-01-01T00:00:00Z' WHERE id = ?", (ds,))
        con.commit()
        con.close()
        v = _hist(client, "queries", qid)["current"]
        before = client.get(f"/queries/{qid}/history/{v}?seq=1").json()["sourceChangedSince"]
        time.sleep(1.1)  # the stored times have one-second resolution
        _refresh(client, ws, ds)
        after = client.get(f"/queries/{qid}/history/{v}?seq=1").json()["sourceChangedSince"]
    assert before is False and after is True


@pytest.mark.unit
def test_a_save_after_the_refresh_reads_unchanged() -> None:
    with TestClient(app) as client:
        ws, ds, cols, qid, _dsh, _wf = _three(client)
        _refresh(client, ws, ds)
        time.sleep(1.1)
        client.put(f"/queries/{qid}", json={"definition": _filter(cols, "South")})
        v = _hist(client, "queries", qid)["current"]
        body = client.get(f"/queries/{qid}/history/{v}").json()
    assert body["seq"] == 2 and body["sourceChangedSince"] is False


@pytest.mark.unit
def test_a_refresh_in_the_same_second_as_the_save_is_flagged() -> None:
    """A version saved, then its source refreshed within the same second: the
    version predates the refresh, so restoring it must warn."""
    with TestClient(app) as client:
        ws, ds, _cols, qid, _dsh, _wf = _three(client)
        con = sqlite3.connect(db.get_db_path())
        con.execute("UPDATE definition_history SET changed_at = '2030-01-01T00:00:00Z' WHERE noun_id = ?", (qid,))
        con.commit()
        _refresh(client, ws, ds)
        con.execute("UPDATE datasets SET refreshed_at = '2030-01-01T00:00:00Z' WHERE id = ?", (ds,))
        con.commit()
        con.close()
        v = _hist(client, "queries", qid)["current"]
        flag = client.get(f"/queries/{qid}/history/{v}?seq=1").json()["sourceChangedSince"]
    assert flag is True


# --- delete sweeps -------------------------------------------------------------------------------


@pytest.mark.unit
def test_every_delete_path_leaves_no_orphan_rows() -> None:
    with TestClient(app) as client:
        ws, ds, cols, qid, dsh, wf = _three(client)
        for team in ("South", "West"):
            client.put(f"/queries/{qid}", json={"definition": _filter(cols, team)})
        # a saved copy (R193) next to the main workspace
        assert client.post(f"/workspaces/{ws}/saved-copies", json={"label": "snap", "datasetIds": [ds]}).status_code == 201
        assert client.delete(f"/workflows/{wf}").status_code == 204
        assert client.delete(f"/dashboards/{dsh}").status_code == 204
        assert _count(wf) == _count(dsh) == 0 and _count(qid) == 3
        assert client.delete(f"/datasets/{ds}").status_code == 204  # takes qid
        assert _count(qid) == 0 and _count() == 0
        ws2 = client.post("/workspaces", json={"name": "Empty"}).json()["id"]
        d2 = client.post(f"/workspaces/{ws2}/dashboards", json={"name": "E", "slug": "e", "definition": {"widgets": []}}).json()["id"]
        client.put(f"/dashboards/{d2}", json={"name": "E", "slug": "e", "definition": {"widgets": [], "controls": []}})
        assert client.delete(f"/workspaces/{ws2}").status_code == 204
        con = sqlite3.connect(db.get_db_path())
        orphans = con.execute(
            "SELECT COUNT(*) FROM definition_history WHERE "
            "(kind='query' AND noun_id NOT IN (SELECT id FROM queries)) OR "
            "(kind='dashboard' AND noun_id NOT IN (SELECT id FROM dashboards)) OR "
            "(kind='workflow' AND noun_id NOT IN (SELECT id FROM workflows))"
        ).fetchone()[0]
        con.close()
        gone = client.get(f"/queries/{qid}/history")
    assert orphans == 0 and _count() == 0
    assert gone.status_code == 404


# --- concurrency ----------------------------------------------------------------------------------


@pytest.mark.unit
def test_concurrent_puts_take_unique_contiguous_seqs() -> None:
    with TestClient(app) as client:
        _ws, _ds, cols, qid, _dsh, _wf = _three(client)
    n = 12
    errors: list[BaseException] = []
    statuses: list[int] = []
    barrier = threading.Barrier(n)

    def put(i: int) -> None:
        try:
            body = UpdateQueryBody.model_validate({"definition": _filter(cols, f"T{i:02d}")})
            barrier.wait()
            statuses.append(update_query(qid, body, None).status_code)
        except BaseException as e:  # noqa: BLE001
            errors.append(e)

    threads = [threading.Thread(target=put, args=(i,)) for i in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors, errors
    assert statuses == [200] * n
    con = sqlite3.connect(db.get_db_path())
    seqs = [r[0] for r in con.execute("SELECT seq FROM definition_history WHERE noun_id = ? ORDER BY seq", (qid,))]
    newest = con.execute("SELECT version FROM definition_history WHERE noun_id = ? ORDER BY seq DESC LIMIT 1", (qid,)).fetchone()[0]
    stored = con.execute("SELECT definition_json FROM queries WHERE id = ?", (qid,)).fetchone()[0]
    con.close()
    assert seqs == list(range(1, n + 2))
    assert newest == definition_version(json.loads(stored))  # the last row IS the stored definition


# --- writer token -----------------------------------------------------------------------------------


@pytest.mark.unit
def test_writer_token_stamps_and_malformed_tokens_never_refuse() -> None:
    headers = [
        {"Authorization": f"Bearer {_TOKEN}"},
        {"Authorization": f"bearer   {_TOKEN}  "},
        {"Authorization": "Bearer"},
        {"Authorization": "Bearer "},
        {"Authorization": "Basic dXNlcjpwYXNz"},
        {"Authorization": f"Bearer {_TOKEN}x"},
        {"Authorization": "Bearer " + "a" * 10_000},
        {"Authorization": "=cmd|' /C calc'!A0"},
        {"Authorization": ""},
    ]
    with TestClient(app) as client:
        _ws, _ds, cols, qid, _dsh, _wf = _three(client)
        codes = [
            client.put(f"/queries/{qid}", json={"definition": _filter(cols, f"T{i}")}, headers=h).status_code
            for i, h in enumerate(headers)
        ]
        h = _hist(client, "queries", qid)
    assert codes == [200] * len(headers)
    by_seq = {e["seq"]: (e["changedBy"], e["changedSource"]) for e in h["entries"]}
    assert by_seq[2] == ("qa-agent", "ai") and by_seq[3] == ("qa-agent", "ai")
    assert all(by_seq[s] == (None, None) for s in range(4, 2 + len(headers)))
    assert by_seq[1] == (None, None)


# --- old definition shapes, as saved ------------------------------------------------------------------


@pytest.fixture
def _restore_db_path():
    original = db.get_db_path()
    yield
    db.set_db_path(original)


@pytest.mark.unit
def test_an_old_definition_shape_is_returned_as_saved(tmp_path: Path, _restore_db_path) -> None:
    path = tmp_path / "old.sqlite"
    db.set_db_path(path)
    command.upgrade(db._alembic_config(), "0010_metadata_anchor")
    old_q = {"q": None, "filters": [], "advanced": [], "legacyKey": {"a": None, "b": [1, None]}, "join": None}
    old_d = {"widgets": [], "layoutV0": "grid", "controls": None}
    con = sqlite3.connect(path)
    con.execute("INSERT INTO workspaces (id, name, created_at) VALUES ('ws_0000000a', 'Old', '2026-01-01T00:00:00Z')")
    con.execute(
        "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, source_format, "
        "created_at, refreshed_at, data_version) VALUES ('ds_0000000a', 'ws_0000000a', 'd', 1, 1, 1, "
        "'[{\"name\":\"team\",\"dtype\":\"string\"}]', 'csv', '2026-01-01T00:00:00Z', NULL, 1)"
    )
    con.execute(
        "INSERT INTO queries (id, workspace_id, source_id, name, definition_json, created_at) "
        "VALUES ('qr_0000000a', 'ws_0000000a', 'ds_0000000a', 'q', ?, '2026-01-01T00:00:00Z')",
        (json.dumps(old_q),),
    )
    con.execute(
        "INSERT INTO dashboards (id, workspace_id, name, slug, definition_json, created_at) "
        "VALUES ('dsh_0000000a', 'ws_0000000a', 'D', 'd', ?, '2026-01-01T00:00:00Z')",
        (json.dumps(old_d),),
    )
    con.commit()
    con.close()
    command.upgrade(db._alembic_config(), "head")
    with TestClient(app) as client:
        hq = _hist(client, "queries", "qr_0000000a")
        rq = client.get(f"/queries/qr_0000000a/history/{hq['current']}")
        hd = _hist(client, "dashboards", "dsh_0000000a")
        rd = client.get(f"/dashboards/dsh_0000000a/history/{hd['current']}?seq=1")
    assert rq.status_code == 200 and rq.json()["definition"] == old_q  # nulls and unknown keys as saved
    assert rq.json()["change"] == "baseline" and rq.json()["sourceChangedSince"] is False
    assert rd.status_code == 200 and rd.json()["definition"] == old_d


# --- R197 notes after a restore -------------------------------------------------------------------------


@pytest.mark.unit
def test_dashboard_and_workflow_notes_read_current_again_after_a_restore() -> None:
    with TestClient(app) as client:
        _ws, _ds, _cols, qid, dsh, wf = _three(client)
        for kind, noun in (("dashboard", dsh), ("workflow", wf)):
            assert client.put(f"/metadata/{kind}/{noun}/notes", json={"md": "note"}, headers=_H).status_code == 201
        d1 = client.get(f"/dashboards/{dsh}").json()["definition"]
        w1 = client.get(f"/workflows/{wf}").json()["definition"]
        client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": {
            "widgets": [*d1["widgets"], {"id": _W2, "queryId": qid, "title": "t", "chartType": "table", "agg": "count", "span": 1}]}})
        client.put(f"/workflows/{wf}", json={"name": "wf", "definition": {**w1, "steps": []}})
        mid = [client.get(f"/metadata/{k}/{n}").json()["entries"]["notes"]["state"] for k, n in (("dashboard", dsh), ("workflow", wf))]
        old_d = client.get(f"/dashboards/{dsh}/history/{definition_version(d1)}").json()["definition"]
        old_w = client.get(f"/workflows/{wf}/history/{definition_version(w1)}").json()["definition"]
        client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": old_d})
        client.put(f"/workflows/{wf}", json={"name": "wf", "definition": old_w})
        end = [client.get(f"/metadata/{k}/{n}").json()["entries"]["notes"]["state"] for k, n in (("dashboard", dsh), ("workflow", wf))]
    assert mid == ["other_definition", "other_definition"]
    assert end == ["current", "current"]


# --- R199 control ids after a dashboard restore -----------------------------------------------------------


_CSV = b"id,team,amount,day\n1,North,10,2026-10-10\n2,North,20,2026-10-11\n3,South,5,2026-10-12\n4,,7,2026-10-13\n"


@pytest.mark.unit
def test_a_dashboard_restore_brings_old_control_ids_back_and_a_stale_f_key_is_ignored() -> None:
    with TestClient(app) as client:
        ws = client.post("/workspaces", json={"name": "Ctl"}).json()["id"]
        up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("c.csv", _CSV, "text/csv")}).json()
        ds = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": "c"}]}).json()[0]["id"]
        qid = client.post(f"/workspaces/{ws}/queries", json={"name": "q", "sourceId": ds, "definition": _EMPTY}).json()["id"]
        w = {"id": _W1, "queryId": qid, "title": "t", "chartType": "table", "agg": "count", "span": 1}
        old_ctl = {"id": "ctl_000000a1", "kind": "values", "label": "Team", "column": "team", "targets": "all"}
        new_ctl = {**old_ctl, "id": "ctl_000000a2"}  # re-bound control → new id
        dsh = client.post(f"/workspaces/{ws}/dashboards", json={"name": "D", "slug": "d", "definition": {"widgets": [w], "controls": [old_ctl]}}).json()["id"]
        v1 = _hist(client, "dashboards", dsh)["current"]
        assert client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": {"widgets": [w], "controls": [new_ctl]}}).status_code == 200

        def rows(raw: str) -> int:
            r = client.get(f"/queries/{qid}/rows?unpaged=true&dashboard={dsh}&widget={_W1}{raw}")
            assert r.status_code == 200, r.text
            return len(r.json()["rows"])

        new_applies = rows("&f.ctl_000000a2=North")
        old = client.get(f"/dashboards/{dsh}/history/{v1}?seq=1").json()["definition"]
        assert client.put(f"/dashboards/{dsh}", json={"name": "D", "slug": "d", "definition": old}).status_code == 200
        restored_ids = [c["id"] for c in client.get(f"/dashboards/{dsh}").json()["definition"]["controls"]]
        stale_ignored = rows("&f.ctl_000000a2=North")
        old_applies = rows("&f.ctl_000000a1=North")
        unfiltered = rows("")
        h = _hist(client, "dashboards", dsh)
    assert new_applies == 2
    assert restored_ids == ["ctl_000000a1"]
    assert stale_ignored == unfiltered == 4  # a link made since names a control that no longer exists
    assert old_applies == 2
    assert [e["seq"] for e in h["entries"]] == [3, 2, 1] and h["current"] == v1
