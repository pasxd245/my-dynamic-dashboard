"""R193 (item 3.6b) — saved (frozen) copies and the read-only saved workspace.

Acceptance (`.agents/design/data-management/workspaces/saved-copies.md`):
1 the saved workspace (once per main, `kind: saved`, found by parent, name
collision `-saved-2`); 2 copies (`@label`, `v2`; rows, columns, hidden, format,
lineage, version and `refreshedAt` equal the original's; `savedFrom`; a
published dataset saved twice); 3 a later refresh leaves the copy alone; 4 every
write route answers `409 read_only_workspace` inside a saved workspace and
changes nothing, the delete rules; 5 metadata goes with the copy, state frozen;
6 refusals write nothing; plus the one-snapshot re-check and migration 0009.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from alembic import command
from fastapi.testclient import TestClient

from app import db, saved_copies
from app.main import app
from app.storage import datasets_dir
from tests._conformance import validate_response
from tests.test_metadata import _auth, _HUMAN, _seed, tokens  # noqa: F401 — `tokens` is a fixture
from tests.test_workflow_publish import _ran

_FIXTURES = Path(__file__).parent / "fixtures"
_CONTRACT = "workspaces/saved-copies-post.contract.yaml"


def _save(client: TestClient, ws: str, ids: list[str], label: str = "2026-10-18"):
    return client.post(f"/workspaces/{ws}/saved-copies", json={"label": label, "datasetIds": ids})


def _csv_upload(client: TestClient, content: bytes) -> str:
    return client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": ("x.csv", content, "text/csv")}).json()[
        "temp_id"
    ]


def _table_dump(con: sqlite3.Connection) -> dict[str, list[tuple]]:
    out = {}
    for t in ("workspaces", "datasets", "queries", "workflows", "dashboards", "relationships", "metadata_entries"):
        out[t] = sorted(tuple(r) for r in con.execute(f"SELECT * FROM {t}").fetchall())  # noqa: S608
    return out


def _dump() -> dict[str, list[tuple]]:
    with db.get_conn() as con:
        return _table_dump(con)


# --- 1 · the saved workspace -------------------------------------------------


@pytest.mark.unit
def test_first_save_creates_the_saved_workspace_once_and_a_second_reuses_it() -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        first = _save(client, ids["ws"], [ids["ds"]])
        second = _save(client, ids["ws"], [ids["ds2"]], label="later")
        listed = client.get("/workspaces").json()

    assert first.status_code == 201, first.text
    validate_response(_CONTRACT, 201, first.json())
    saved = first.json()["workspace"]
    assert saved["kind"] == "saved" and saved["parentWorkspaceId"] == ids["ws"]
    assert saved["name"] == "W-saved"
    assert second.json()["workspace"]["id"] == saved["id"]
    kinds = {w["id"]: w for w in listed}
    assert kinds[ids["ws"]]["kind"] == "main" and "parentWorkspaceId" not in kinds[ids["ws"]]
    assert kinds[saved["id"]]["kind"] == "saved"
    validate_response("workspaces/get.contract.yaml", 200, listed)


@pytest.mark.unit
def test_saved_workspace_name_collision_and_rename_independence() -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        client.post("/workspaces", json={"name": "W-saved"})
        first = _save(client, ids["ws"], [ids["ds"]]).json()["workspace"]
        client.patch(f"/workspaces/{ids['ws']}", json={"name": "Renamed"})
        again = _save(client, ids["ws"], [ids["ds"]]).json()["workspace"]

    assert first["name"] == "W-saved-2"
    assert again["id"] == first["id"]  # found by parent, not by name


# --- 2 · copies --------------------------------------------------------------


@pytest.mark.unit
def test_copies_carry_the_originals_rows_columns_and_version() -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        client.patch(f"/datasets/{ids['ds']}/columns", json={"hidden": ["amount"]})
        temp = _csv_upload(client, (_FIXTURES / "sample.csv").read_bytes())
        client.post(
            f"/workspaces/{ids['ws']}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ids["ds"]}]},
        )  # version 2
        original = client.get(f"/datasets/{ids['ds']}").json()
        r1 = _save(client, ids["ws"], [ids["ds"], ids["ds2"]], label="  wk42 ")
        r2 = _save(client, ids["ws"], [ids["ds"]], label="wk42")
        copy = r1.json()["datasets"][0]
        rows_orig = client.get(f"/datasets/{ids['ds']}/rows?page_size=100").json()
        rows_copy = client.get(f"/datasets/{copy['id']}/rows?page_size=100").json()
        detail = client.get(f"/datasets/{copy['id']}")

    assert [d["name"] for d in r1.json()["datasets"]] == ["leads @wk42", "owners @wk42"]  # request order
    assert r2.json()["datasets"][0]["name"] == "leads @wk42 v2"
    assert original["dataVersion"] == 2
    for key in ("columns", "rowCount", "columnCount", "sizeBytes", "sourceFormat", "dataVersion", "refreshedAt"):
        assert copy[key] == original[key], key
    assert copy["savedFrom"] == {
        "datasetId": ids["ds"],
        "datasetName": "leads",
        "workspaceId": ids["ws"],
        "dataVersion": 2,
        "refreshedAt": original["refreshedAt"],
        "label": "wk42",
        "savedAt": copy["savedFrom"]["savedAt"],
    }
    assert rows_copy == rows_orig
    assert detail.status_code == 200 and detail.json() == copy


@pytest.mark.unit
def test_a_published_dataset_can_be_saved_twice_without_a_publisher_link() -> None:
    with TestClient(app) as client:
        ws, _qid, wid = _ran(client)
        pub = client.post(f"/workflows/{wid}/publish").json()
        a = _save(client, ws, [pub["id"]]).json()["datasets"][0]
        b = _save(client, ws, [pub["id"]]).json()["datasets"][0]
        client.post(f"/workflows/{wid}/run")
        republish = client.post(f"/workflows/{wid}/publish")

    assert a["lineage"] == pub["lineage"] and a["sourceFormat"] == "workflow"
    assert b["name"].endswith(" v2")
    assert republish.status_code == 200 and republish.json()["id"] == pub["id"]  # the original, not a copy
    with db.get_conn() as con:
        links = con.execute(
            "SELECT published_workflow_id FROM datasets WHERE id IN (?, ?)", (a["id"], b["id"])
        ).fetchall()
    assert [r[0] for r in links] == [None, None]


# --- 3 · frozen ----------------------------------------------------------------


@pytest.mark.unit
def test_a_later_refresh_of_the_original_leaves_the_copy_alone() -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        copy = _save(client, ids["ws"], [ids["ds"]]).json()["datasets"][0]
        before = client.get(f"/datasets/{copy['id']}/rows?page_size=100").json()
        temp = _csv_upload(client, b"id,name,amount\n9,Z,1\n")
        client.post(
            f"/workspaces/{ids['ws']}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ids["ds"]}]},
        )
        after = client.get(f"/datasets/{copy['id']}/rows?page_size=100").json()
        copy_after = client.get(f"/datasets/{copy['id']}").json()
        original = client.get(f"/datasets/{ids['ds']}").json()

    assert original["rowCount"] == 1 and original["dataVersion"] == 2
    assert after == before
    assert copy_after == copy


@pytest.mark.unit
def test_the_snapshot_copies_again_when_a_refresh_slips_in(monkeypatch: pytest.MonkeyPatch) -> None:
    real = saved_copies._copy_files
    calls = {"n": 0}

    def racing(src, dst):  # a refresh lands during the first copy
        real(src, dst)
        calls["n"] += 1
        if calls["n"] == 1:
            with db.get_conn() as con:
                con.execute("UPDATE datasets SET data_version = data_version + 1 WHERE id = ?", (src.name,))
                con.commit()

    monkeypatch.setattr(saved_copies, "_copy_files", racing)
    with TestClient(app) as client:
        ids = _seed(client)
        copy = _save(client, ids["ws"], [ids["ds"]]).json()["datasets"][0]

    assert calls["n"] == 2
    assert copy["savedFrom"]["dataVersion"] == copy["dataVersion"] == 2


# --- 4 · read-only -----------------------------------------------------------


def _frozen_world(client: TestClient) -> dict[str, str]:
    """A seeded workspace (datasets, query, dashboard, relationship, workflow)
    turned into a saved workspace of a fresh main one — so every write route has
    a real target inside a saved workspace."""
    ids = _seed(client)
    wf = client.post(
        f"/workspaces/{ids['ws']}/workflows",
        json={"name": "wf", "definition": {"sources": [ids["q"]], "steps": []}},
    ).json()["id"]
    client.post(f"/workflows/{wf}/run")
    main = client.post("/workspaces", json={"name": "Main"}).json()["id"]
    with db.get_conn() as con:
        con.execute("UPDATE workspaces SET kind = 'saved', parent_workspace_id = ? WHERE id = ?", (main, ids["ws"]))
        con.commit()
    return {**ids, "wf": wf, "main": main}


@pytest.mark.unit
def test_every_write_inside_a_saved_workspace_is_refused_and_changes_nothing(tokens: None) -> None:  # noqa: F811
    with TestClient(app) as client:
        w = _frozen_world(client)
        temp = _csv_upload(client, (_FIXTURES / "sample.csv").read_bytes())
        empty_def = {"q": None, "filters": [], "advanced": []}
        before = _dump()
        responses = {
            "upload create": client.post(
                f"/workspaces/{w['ws']}/datasets/batch", json={"temp_id": temp, "items": [{"name": "n"}]}
            ),
            "refresh": client.post(
                f"/workspaces/{w['ws']}/datasets/batch",
                json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": w["ds"]}]},
            ),
            "refresh via main path": client.post(
                f"/workspaces/{w['main']}/datasets/batch",
                json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": w["ds"]}]},
            ),
            "rename dataset": client.patch(f"/datasets/{w['ds']}", json={"name": "nn"}),
            "columns": client.patch(f"/datasets/{w['ds']}/columns", json={"hidden": ["amount"]}),
            "rename workspace": client.patch(f"/workspaces/{w['ws']}", json={"name": "nn"}),
            "create query": client.post(
                f"/workspaces/{w['ws']}/queries", json={"name": "q2", "sourceId": w["ds"], "definition": empty_def}
            ),
            "update query": client.put(f"/queries/{w['q']}", json={"definition": empty_def}),
            "delete query": client.delete(f"/queries/{w['q']}"),
            "create workflow": client.post(
                f"/workspaces/{w['ws']}/workflows",
                json={"name": "wf2", "definition": {"sources": [w["q"]], "steps": []}},
            ),
            "update workflow": client.put(
                f"/workflows/{w['wf']}", json={"name": "wf3", "definition": {"sources": [w["q"]], "steps": []}}
            ),
            "run workflow": client.post(f"/workflows/{w['wf']}/run"),
            "publish workflow": client.post(f"/workflows/{w['wf']}/publish"),
            "delete workflow": client.delete(f"/workflows/{w['wf']}"),
            "create dashboard": client.post(
                f"/workspaces/{w['ws']}/dashboards", json={"name": "D2", "slug": "d2", "definition": {"widgets": []}}
            ),
            "update dashboard": client.put(
                f"/dashboards/{w['dsh']}", json={"name": "D", "slug": "d", "definition": {"widgets": []}}
            ),
            "delete dashboard": client.delete(f"/dashboards/{w['dsh']}"),
            "create relationship": client.post(
                f"/workspaces/{w['ws']}/relationships",
                json={
                    "leftDatasetId": w["ds2"],
                    "leftColumn": "id",
                    "rightDatasetId": w["ds"],
                    "rightColumn": "id",
                    "cardinality": "one_to_one",
                },
            ),
            "delete relationship": client.delete(f"/relationships/{w['rel']}"),
            "write metadata": client.put(f"/metadata/dataset/{w['ds']}/notes", json={"md": "x"}, headers=_auth(_HUMAN)),
            "write column metadata": client.put(
                f"/metadata/column/{w['ds']}:amount/notes", json={"md": "x"}, headers=_auth(_HUMAN)
            ),
            "delete metadata": client.delete(f"/metadata/dataset/{w['ds']}/notes", headers=_auth(_HUMAN)),
            "save from saved": _save(client, w["ws"], [w["ds"]]),
        }
        after = _dump()

    for what, r in responses.items():
        assert r.status_code == 409, f"{what}: {r.status_code} {r.text}"
        assert r.json() == {"code": "read_only_workspace"}, what
    assert after == before


@pytest.mark.unit
def test_contracts_carry_the_refusal() -> None:
    body = {"code": "read_only_workspace"}
    for c in ("datasets/patch.contract.yaml", "datasets/batch-post.contract.yaml", "workflows/run-post.contract.yaml"):
        validate_response(c, 409, body)
    validate_response(_CONTRACT, 409, body)


@pytest.mark.unit
def test_delete_rules() -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        copies = _save(client, ids["ws"], [ids["ds"], ids["ds2"]]).json()
        saved = copies["workspace"]["id"]
        main_blocked = client.delete(f"/workspaces/{ids['ws']}")
        saved_blocked = client.delete(f"/workspaces/{saved}")
        del_copy = client.delete(f"/datasets/{copies['datasets'][0]['id']}")
        client.delete(f"/datasets/{copies['datasets'][1]['id']}")
        saved_empty = client.delete(f"/workspaces/{saved}")

        # An EMPTY saved workspace goes with its main one.
        other = _seed_named(client, "Other")
        c = _save(client, other["ws"], [other["ds"]]).json()
        client.delete(f"/datasets/{c['datasets'][0]['id']}")
        client.delete(f"/datasets/{other['ds']}")
        main_with_empty_saved = client.delete(f"/workspaces/{other['ws']}")
        listed = {w["id"] for w in client.get("/workspaces").json()}

    assert main_blocked.status_code == 409 and main_blocked.json()["code"] == "non_empty"
    assert main_blocked.json()["datasetCount"] == 4  # 2 own + 2 copies
    assert saved_blocked.status_code == 409 and saved_blocked.json() == {"code": "non_empty", "datasetCount": 2}
    assert del_copy.status_code == 204
    assert saved_empty.status_code == 204
    assert main_with_empty_saved.status_code == 204
    assert other["ws"] not in listed and c["workspace"]["id"] not in listed


def _seed_named(client: TestClient, name: str) -> dict[str, str]:
    ws = client.post("/workspaces", json={"name": name}).json()["id"]
    up = _csv_upload(client, (_FIXTURES / "sample.csv").read_bytes())
    ds = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": up, "items": [{"name": "d"}]}).json()[0]
    return {"ws": ws, "ds": ds["id"]}


# --- 5 · metadata ------------------------------------------------------------


@pytest.mark.unit
def test_metadata_goes_with_the_copy_frozen_in_its_state(tokens: None) -> None:  # noqa: F811
    with TestClient(app) as client:
        ids = _seed(client)
        client.put(f"/metadata/dataset/{ids['ds']}/notes", json={"md": "dataset note"}, headers=_auth(_HUMAN))
        client.put(f"/metadata/column/{ids['ds']}:amount/notes", json={"md": "amount note"}, headers=_auth(_HUMAN))
        # The dataset note goes out of date on the original (its schema moves).
        temp = _csv_upload(client, b"id,name,amount,extra\n1,A,1,x\n")
        client.post(
            f"/workspaces/{ids['ws']}/datasets/batch",
            json={"temp_id": temp, "items": [{"name": "x", "target_dataset_id": ids["ds"]}]},
        )
        orig_md = client.get(f"/metadata/dataset/{ids['ds']}").json()
        copy = _save(client, ids["ws"], [ids["ds"]]).json()["datasets"][0]
        copy_md = client.get(f"/metadata/dataset/{copy['id']}").json()
        # Later moves on the original never reach the copy.
        temp2 = _csv_upload(client, b"id,name\n1,A\n")
        client.post(
            f"/workspaces/{ids['ws']}/datasets/batch",
            json={"temp_id": temp2, "items": [{"name": "x", "target_dataset_id": ids["ds"]}]},
        )
        copy_md_later = client.get(f"/metadata/dataset/{copy['id']}").json()

    assert copy_md["entries"]["notes"]["md"] == "dataset note"
    assert copy_md["entries"]["notes"]["stale"] == orig_md["entries"]["notes"]["stale"]
    assert copy_md["entries"]["notes"]["writtenAt"] == orig_md["entries"]["notes"]["writtenAt"]
    assert copy_md["children"]["amount"]["notes"]["md"] == "amount note"
    assert copy_md["children"]["amount"]["notes"]["stale"] == orig_md["children"]["amount"]["notes"]["stale"]
    assert copy_md_later == copy_md


# --- 6 · refusals write nothing --------------------------------------------------


@pytest.mark.unit
def test_refusals_write_nothing() -> None:
    with TestClient(app) as client:
        ids = _seed(client)
        other = _seed_named(client, "Other")
        before = _dump()
        foreign = _save(client, ids["ws"], [ids["ds"], other["ds"]])
        blank = _save(client, ids["ws"], [ids["ds"]], label="   ")
        too_long = _save(client, ids["ws"], [ids["ds"]], label="x" * 41)
        dup = _save(client, ids["ws"], [ids["ds"], ids["ds"]])
        missing = _save(client, "ws_00000000", [ids["ds"]])
        after = _dump()
        trees = sorted(p.name for p in datasets_dir().glob("*"))

    assert foreign.status_code == 422
    assert foreign.json()["detail"][0]["type"] == "unknown_dataset"
    assert foreign.json()["detail"][0]["loc"] == ["body", "datasetIds", 1]
    assert blank.status_code == 422 and too_long.status_code == 422 and dup.status_code == 422
    assert missing.status_code == 404 and missing.json() == {"code": "not_found"}
    validate_response(_CONTRACT, 404, missing.json())
    assert after == before
    assert all(t in (ids["ws"], other["ws"]) for t in trees)  # no saved-workspace tree staged


# --- migration 0009 ------------------------------------------------------------


@pytest.fixture
def _restore_db_path():
    original = db.get_db_path()
    yield
    db.set_db_path(original)


def test_0009_keeps_every_row_both_ways(tmp_path: Path, _restore_db_path) -> None:
    path = tmp_path / "m.sqlite"
    db.set_db_path(path)
    cfg = db._alembic_config()
    command.upgrade(cfg, "0008_dataset_lineage")
    con = sqlite3.connect(path)
    con.execute("INSERT INTO workspaces (id, name, created_at) VALUES ('ws_00000001', 'W', '2026-01-01T00:00:00Z')")
    con.execute(
        "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, columns_json, "
        "source_format, created_at, refreshed_at, data_version) VALUES ('ds_0000000a', 'ws_00000001', 'd', 1, 1, "
        "1, '[]', 'csv', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 2)"
    )
    con.commit()
    con.close()

    command.upgrade(cfg, "0009_saved_copies")
    con = sqlite3.connect(path)
    assert con.execute("SELECT kind, parent_workspace_id FROM workspaces").fetchall() == [("main", None)]
    assert con.execute("SELECT saved_from_json FROM datasets").fetchall() == [(None,)]
    con.execute(
        "INSERT INTO workspaces (id, name, created_at, kind, parent_workspace_id) "
        "VALUES ('ws_00000002', 'W-saved', '2026-01-02T00:00:00Z', 'saved', 'ws_00000001')"
    )
    con.commit()
    with pytest.raises(sqlite3.IntegrityError):  # one saved workspace per main
        con.execute(
            "INSERT INTO workspaces (id, name, created_at, kind, parent_workspace_id) "
            "VALUES ('ws_00000003', 'W-saved-2', '2026-01-02T00:00:00Z', 'saved', 'ws_00000001')"
        )
    with pytest.raises(sqlite3.IntegrityError):  # kind is closed
        con.execute(
            "INSERT INTO workspaces (id, name, created_at, kind) VALUES ('ws_00000004', 'X', '2026-01-02T00:00:00Z', 'x')"
        )
    con.close()

    command.downgrade(cfg, "0008_dataset_lineage")
    con = sqlite3.connect(path)
    assert con.execute("SELECT id FROM workspaces ORDER BY id").fetchall() == [("ws_00000001",), ("ws_00000002",)]
    assert con.execute("SELECT id, data_version FROM datasets").fetchall() == [("ds_0000000a", 2)]
    cols = [r[1] for r in con.execute("PRAGMA table_info(workspaces)").fetchall()]
    assert "kind" not in cols and "parent_workspace_id" not in cols
    con.close()
    command.upgrade(cfg, "head")
