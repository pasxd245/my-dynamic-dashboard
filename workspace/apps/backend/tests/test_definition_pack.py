"""R201 (item 4.8) — the definition pack: export a workspace's definitions by
name, import them into another workspace (same or another install).

Design: .agents/design/data-management/_shared/definition-pack.md, criteria
1–14 (15–16 are the builder's). Fake data only.
"""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import db, storage
from app._config import CONFIG
from app._config.settings import MetadataToken
from app.main import app
from tests._conformance import validate_response

_TOKEN = "writer-token-0123456789abcdef"
_H = {"Authorization": f"Bearer {_TOKEN}"}

_CALLS = (
    b"id,team,amount,day\n"
    b"1,North,10,2026-10-10\n"
    b"2,North,20,2026-10-11\n"
    b"3,South,5,2026-10-12\n"
    b"4,South,7,2026-10-20\n"
    b"5,East,3,2026-10-21\n"
)
_TEAMS = b"team,region\nNorth,N-1\nSouth,S-1\nEast,E-1\n"
_W = ["wdg_0000000a", "wdg_0000000b", "wdg_0000000c", "wdg_0000000d", "wdg_0000000e"]
_EXPORT = "workspaces/definitions-get.contract.yaml"
_IMPORT = "workspaces/definitions-import.contract.yaml"
_INSTALL_ID = re.compile(r"^(ds|qr|wf|dsh|rel|ws)_[0-9a-f]{8}$")


@pytest.fixture(autouse=True)
def tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        CONFIG.settings.backend,
        "metadata_tokens",
        [MetadataToken(token=_TOKEN, author="report-agent", source="ai", namespaces=["notes"])],
    )


# --- helpers ---------------------------------------------------------------------


def _upload(client: TestClient, ws: str, name: str, csv: bytes) -> dict:
    up = client.post("/uploads", data={"sourceFormat": "csv"}, files={"file": (f"{name}.csv", csv, "text/csv")}).json()
    r = client.post(f"/workspaces/{ws}/datasets/batch", json={"temp_id": up["temp_id"], "items": [{"name": name}]})
    assert r.status_code in (200, 201), r.text
    return r.json()[0]


def _col(ds: dict, name: str) -> int:
    return next(i for i, c in enumerate(ds["columns"]) if c["name"] == name)


def _ok(r, code: int = 201) -> dict:
    assert r.status_code == code, r.text
    return r.json() if r.content else {}


def _workspace(client: TestClient, name: str, *, data: bool = True) -> dict:
    ws = _ok(client.post("/workspaces", json={"name": name}))["id"]
    out: dict = {"ws": ws}
    if data:
        out["calls"] = _upload(client, ws, "calls_demo", _CALLS)
        out["teams"] = _upload(client, ws, "teams_demo", _TEAMS)
    return out


def _build_a(client: TestClient, name: str = "Acme demo") -> dict:
    """Workspace A: a filtered query, a parameterised stepped query, a joined
    query (copy-on-pick relationship), two workflows (one over the other), a
    dataset published by a workflow with a query over it, and a dashboard with
    param / date_range / values controls and a note widget."""
    a = _workspace(client, name)
    ws, calls, teams = a["ws"], a["calls"], a["teams"]
    rel = _ok(
        client.post(
            f"/workspaces/{ws}/relationships",
            json={
                "leftDatasetId": calls["id"],
                "leftColumn": "team",
                "rightDatasetId": teams["id"],
                "rightColumn": "team",
                "cardinality": "many_to_one",
            },
        )
    )
    q = {}
    q["north"] = _ok(
        client.post(
            f"/workspaces/{ws}/queries",
            json={
                "name": "North calls",
                "sourceId": calls["id"],
                "definition": {
                    "q": None,
                    "filters": [{"col": _col(calls, "team"), "dtype": "string", "op": "equals", "val": "North"}],
                    "advanced": [],
                },
            },
        )
    )["id"]
    q["south"] = _ok(
        client.post(
            f"/workspaces/{ws}/queries",
            json={
                "name": "South calls",
                "sourceId": calls["id"],
                "definition": {
                    "q": None,
                    "filters": [{"col": _col(calls, "team"), "dtype": "string", "op": "equals", "val": "South"}],
                    "advanced": [],
                },
            },
        )
    )["id"]
    q["period"] = _ok(
        client.post(
            f"/workspaces/{ws}/queries",
            json={
                "name": "Calls in period",
                "sourceId": calls["id"],
                "definition": {
                    "q": None,
                    "params": [
                        {"name": "from", "type": "date", "label": "From", "default": "2026-10-01"},
                        {"name": "to", "type": "date", "label": "To", "default": "2026-10-31"},
                    ],
                    "filters": [
                        {
                            "col": _col(calls, "day"),
                            "dtype": "date",
                            "op": "between",
                            "min": {"param": "from"},
                            "max": {"param": "to"},
                        }
                    ],
                    "advanced": [],
                    "steps": [
                        {"kind": "aggregate", "dimensions": ["team"], "measures": [{"col": "amount", "agg": "sum"}]}
                    ],
                },
            },
        )
    )["id"]
    qrel = {
        "id": "qrel_" + rel["id"].split("_", 1)[1],
        "leftSourceId": calls["id"],
        "leftColumn": "team",
        "rightSourceId": teams["id"],
        "rightColumn": "team",
        "cardinality": "many_to_one",
        "originRelationshipId": rel["id"],
    }
    q["region"] = _ok(
        client.post(
            f"/workspaces/{ws}/queries",
            json={
                "name": "Calls by region",
                "sourceId": calls["id"],
                "definition": {
                    "q": None,
                    "filters": [],
                    "advanced": [],
                    "relationships": [qrel],
                    "joins": [{"queryRelId": qrel["id"], "type": "inner"}],
                },
            },
        )
    )["id"]
    wf = {}
    wf["all"] = _ok(
        client.post(
            f"/workspaces/{ws}/workflows",
            json={"name": "All calls", "definition": {"sources": [q["north"], q["south"]], "steps": []}},
        )
    )["id"]
    _ok(client.post(f"/workflows/{wf['all']}/run"), 200)
    wf["team"] = _ok(
        client.post(
            f"/workspaces/{ws}/workflows",
            json={
                "name": "Calls by team",
                "definition": {
                    "sources": [wf["all"]],
                    "steps": [
                        {"kind": "aggregate", "dimensions": ["team"], "measures": [{"col": "amount", "agg": "sum"}]}
                    ],
                },
            },
        )
    )["id"]
    _ok(client.post(f"/workflows/{wf['team']}/run"), 200)
    published = _ok(client.post(f"/workflows/{wf['team']}/publish", json={"name": "team_totals"}))
    q["totals"] = _ok(
        client.post(
            f"/workspaces/{ws}/queries",
            json={
                "name": "Team totals view",
                "sourceId": published["id"],
                "definition": {"q": None, "filters": [], "advanced": []},
            },
        )
    )["id"]
    widgets = [
        {"id": _W[0], "queryId": q["north"], "title": "North table", "chartType": "table", "agg": "count", "span": 1},
        {
            "id": _W[1],
            "queryId": q["period"],
            "title": "By team",
            "chartType": "bar",
            "dimensionCol": "team",
            "measureCol": "amount",
            "agg": "sum",
            "span": 2,
        },
        {"id": _W[2], "title": "Read me", "chartType": "note", "md": "Weekly numbers.", "span": 1},
        {
            "id": _W[3],
            "queryId": q["region"],
            "title": "By region",
            "chartType": "bar",
            "dimensionCol": "region",
            "agg": "count",
            "span": 1,
        },
        {"id": _W[4], "queryId": q["totals"], "title": "Totals", "chartType": "table", "agg": "count", "span": 1},
    ]
    controls = [
        {
            "id": "ctl_0000000a",
            "kind": "date_range",
            "label": "Period",
            "from": "from",
            "to": "to",
            "targets": [_W[1]],
            "saved": {"from": "2026-10-10", "to": "2026-10-15"},
        },
        {"id": "ctl_0000000b", "kind": "values", "label": "Team", "column": "team", "targets": [_W[0]], "saved": ["North"]},
    ]
    dsh = _ok(
        client.post(
            f"/workspaces/{ws}/dashboards",
            json={"name": "Weekly", "slug": "weekly", "definition": {"widgets": widgets, "controls": controls}},
        )
    )
    return {**a, "q": q, "wf": wf, "dsh": dsh["id"], "widgets": widgets}


def _export(client: TestClient, ws: str) -> dict:
    r = client.get(f"/workspaces/{ws}/definitions")
    assert r.status_code == 200, r.text
    validate_response(_EXPORT, 200, r.json())
    return r.json()


def _import(
    client: TestClient,
    ws: str,
    pack: object,
    *,
    dry_run: bool = False,
    on_conflict: str = "refuse",
    expected: str | None = None,
    headers: dict | None = None,
):
    params = {"dryRun": str(dry_run).lower(), "onConflict": on_conflict}
    if expected is not None:
        params["expectedPlan"] = expected
    body = pack if isinstance(pack, bytes) else json.dumps(pack).encode()
    r = client.post(
        f"/workspaces/{ws}/definitions/import",
        params=params,
        content=body,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    if r.status_code in (200, 409, 422) and r.headers.get("content-type", "").startswith("application/json"):
        body_json = r.json()
        if r.status_code == 200 or body_json.get("code") in ("pack_refused", "pack_invalid", "read_only_workspace"):
            validate_response(_IMPORT, r.status_code, body_json)
    return r


def _items(plan: dict) -> dict[tuple[str, str], dict]:
    return {(i["kind"], i["name"]): i for i in plan["items"]}


def _dump() -> dict[str, list]:
    """Every row of every table — a dry run / refusal must leave it byte-identical."""
    con = sqlite3.connect(db.get_db_path())
    try:
        tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        return {t: sorted(map(repr, con.execute(f"SELECT * FROM {t}").fetchall())) for t in tables}  # noqa: S608
    finally:
        con.close()


def _ids_by_name(client: TestClient, ws: str) -> dict[str, dict[str, str]]:
    return {
        "query": {q["name"]: q["id"] for q in client.get(f"/workspaces/{ws}/queries").json()},
        "workflow": {w["name"]: w["id"] for w in client.get(f"/workspaces/{ws}/workflows").json()},
        "dashboard": {d["name"]: d["id"] for d in client.get(f"/workspaces/{ws}/dashboards").json()},
    }


def _reads(client: TestClient, ws: str) -> dict:
    """What every query, widget and workflow of a workspace reads, by name — the
    envelopes' dataset-id keys (`dataVersions`) left out."""
    ids = _ids_by_name(client, ws)
    out: dict = {}
    for name, qid in sorted(ids["query"].items()):
        body = _ok(client.get(f"/queries/{qid}/rows?unpaged=true"), 200)
        out[f"query:{name}"] = (body["rows"], body.get("total"))
    for name, wid in sorted(ids["workflow"].items()):
        body = _ok(client.get(f"/workflows/{wid}/rows?page=1&page_size=100"), 200)
        out[f"workflow:{name}"] = (body["rows"], body.get("total"))
    q_name = {v: k for k, v in ids["query"].items()}
    for name, did in sorted(ids["dashboard"].items()):
        d = _ok(client.get(f"/dashboards/{did}"), 200)
        for w in d["definition"]["widgets"]:
            if not w.get("queryId"):
                continue
            agg = {
                "dimensions": [w["dimensionCol"]] if w.get("dimensionCol") else [],
                "measures": [{"col": w["measureCol"], "agg": w["agg"]} if w.get("measureCol") else {"agg": w["agg"]}],
                "dashboard": {"id": did, "widgetId": w["id"]},
            }
            body = _ok(client.post(f"/queries/{w['queryId']}/aggregate", json=agg), 200)
            body.pop("dataVersions", None)
            out[f"widget:{name}:{w['id']}:{q_name[w['queryId']]}"] = body
    return out


def _run_and_publish(client: TestClient, ws: str) -> None:
    ids = _ids_by_name(client, ws)
    _ok(client.post(f"/workflows/{ids['workflow']['All calls']}/run"), 200)
    _ok(client.post(f"/workflows/{ids['workflow']['Calls by team']}/run"), 200)
    _ok(client.post(f"/workflows/{ids['workflow']['Calls by team']}/publish", json={"name": "team_totals"}))


def _walk(node: object):
    if isinstance(node, dict):
        for v in node.values():
            yield from _walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from _walk(v)
    else:
        yield node


# --- 1 · export shape ------------------------------------------------------------


@pytest.mark.unit
def test_export_writes_every_reference_by_name_with_no_install_id() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        assert pack["packVersion"] == 1 and pack["workspace"] == "Acme demo"
        assert [q["name"] for q in pack["queries"]] == sorted(q["name"] for q in pack["queries"])
        assert [q["name"] for q in pack["queries"]] == [
            "Calls by region",
            "Calls in period",
            "North calls",
            "South calls",
            "Team totals view",
        ]
        assert [w["name"] for w in pack["workflows"]] == ["All calls", "Calls by team"]
        assert [d["name"] for d in pack["datasets"]] == ["calls_demo", "team_totals", "teams_demo"]
        totals = next(d for d in pack["datasets"] if d["name"] == "team_totals")
        assert totals["publishedBy"] == "Calls by team"
        assert next(d for d in pack["datasets"] if d["name"] == "calls_demo")["columns"] == [
            {"name": c["name"], "dtype": c["dtype"]} for c in a["calls"]["columns"]
        ]
        region = next(q for q in pack["queries"] if q["name"] == "Calls by region")
        rel = region["definition"]["relationships"][0]
        assert (rel["leftDataset"], rel["rightDataset"]) == ("calls_demo", "teams_demo")
        assert "originRelationshipId" not in rel and "leftSourceId" not in rel
        assert rel["id"].startswith("qrel_")  # an id inside one definition travels
        team = next(w for w in pack["workflows"] if w["name"] == "Calls by team")
        assert team["definition"]["sources"] == [{"workflow": "All calls"}]
        widgets = pack["dashboards"][0]["definition"]["widgets"]
        assert [w["id"] for w in widgets] == _W
        assert widgets[0]["query"] == "North calls" and "queryId" not in widgets[0]
        assert "query" not in widgets[2]  # the note binds no query
        assert not [v for v in _walk(pack) if isinstance(v, str) and _INSTALL_ID.match(v)]
        again = _export(client, a["ws"])
        assert {**again, "exportedAt": None} == {**pack, "exportedAt": None}


# --- 2 · export refuses a dangling reference ------------------------------------


@pytest.mark.unit
def test_export_refuses_a_reference_to_a_deleted_noun() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        _ok(client.delete(f"/queries/{a['q']['north']}"), 204)
        r = client.get(f"/workspaces/{a['ws']}/definitions")
        assert r.status_code == 409, r.text
        validate_response(_EXPORT, 409, r.json())
        problems = r.json()["problems"]
        assert {"kind": "dashboard", "name": "Weekly", "reason": "query_missing", "ref": "North table"} in problems
        assert {"kind": "workflow", "name": "All calls", "reason": "source_missing"} in problems
        assert client.get(f"/workspaces/{a['ws']}/dashboards").json()[0]["id"] == a["dsh"]  # nothing changed


# --- 3 · parity (two workspaces, and across two data roots) ------------------------


def _parity(client_a_reads: dict, client: TestClient, ws_b: str, pack: dict) -> None:
    first = _import(client, ws_b, pack)
    assert first.status_code == 200, first.text
    plan = first.json()
    assert plan["applied"] is True and plan["ok"] is True
    items = _items(plan)
    assert items[("query", "Team totals view")]["action"] == "deferred"
    assert items[("query", "Team totals view")]["reason"] == "awaits_publish"
    assert items[("query", "Team totals view")]["via"] == "Calls by team"
    assert items[("dashboard", "Weekly")] == {
        "kind": "dashboard",
        "name": "Weekly",
        "action": "deferred",
        "reason": "needs",
        "detail": "Team totals view",
    }
    assert plan["counts"]["deferred"] == 2 and plan["counts"]["create"] == 6
    _run_and_publish(client, ws_b)
    second = _import(client, ws_b, pack)
    assert second.status_code == 200, second.text
    two = _items(second.json())
    assert two[("query", "Team totals view")]["action"] == "create"
    assert two[("dashboard", "Weekly")]["action"] == "create"
    assert second.json()["counts"]["unchanged"] == 6
    assert _reads(client, ws_b) == client_a_reads


@pytest.mark.unit
def test_parity_into_a_clean_workspace_of_the_same_install() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        reads_a = _reads(client, a["ws"])
        b = _workspace(client, "Acme copy")
        _parity(reads_a, client, b["ws"], pack)


@pytest.mark.unit
def test_parity_into_another_install(tmp_path: Path) -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        reads_a = _reads(client, a["ws"])
    # A second install: its own database and data root.
    db.set_db_path(tmp_path / "second" / "app.sqlite")
    storage.set_data_root(tmp_path / "second" / "data")
    (tmp_path / "second").mkdir(exist_ok=True)
    db.create_all_for_tests()
    with TestClient(app) as client:
        b = _workspace(client, "Acme demo")
        _parity(reads_a, client, b["ws"], pack)


# --- 4 · re-import is idempotent -------------------------------------------------


@pytest.mark.unit
def test_reimport_writes_nothing() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        before = _dump()
        r = _import(client, a["ws"], pack)  # into the workspace it came from
        assert r.status_code == 200, r.text
        assert {i["action"] for i in r.json()["items"]} == {"unchanged"}
        assert _dump() == before


# --- 5 · datasets by name and columns --------------------------------------------


@pytest.mark.unit
def test_missing_and_differing_datasets_refuse_with_the_lists() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        b = _ok(client.post("/workspaces", json={"name": "B"}))["id"]
        _upload(client, b, "calls_demo", b"team,id,amount,day\nNorth,1,10,2026-10-10\n")  # columns in another order
        pack["datasets"].append({"name": "spare", "columns": [{"name": "x", "dtype": "string"}]})
        before = _dump()
        dry = _import(client, b, pack, dry_run=True).json()
        status = {d["name"]: d for d in dry["datasets"]}
        assert status["teams_demo"]["status"] == "missing"
        assert status["calls_demo"]["status"] == "columns_differ"
        assert status["calls_demo"]["columns"]["found"][0] == {"name": "team", "dtype": "string"}
        assert status["calls_demo"]["columns"]["expected"][0] == {"name": "id", "dtype": "integer"}
        assert status["spare"]["status"] == "unused"
        assert status["team_totals"]["status"] == "awaits_publish"
        items = _items(dry)
        assert items[("query", "North calls")] | {} == {
            "kind": "query",
            "name": "North calls",
            "action": "invalid",
            "reason": "columns_differ",
            "detail": "calls_demo",
        }
        assert items[("query", "Calls by region")]["reason"] == "columns_differ"
        assert items[("workflow", "All calls")] == {
            "kind": "workflow",
            "name": "All calls",
            "action": "invalid",
            "reason": "needs",
            "detail": "North calls",
        }
        assert dry["ok"] is False
        applied = _import(client, b, pack)
        assert applied.status_code == 409
        assert applied.json()["code"] == "pack_refused" and applied.json()["reason"] == "not_ok"
        assert _dump() == before


# --- 6 · dry run writes nothing; plan hash ----------------------------------------


@pytest.mark.unit
def test_dry_run_writes_nothing_and_equals_the_apply() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        b = _workspace(client, "B")
        before = _dump()
        dry = _import(client, b["ws"], pack, dry_run=True)
        assert dry.status_code == 200 and dry.json()["dryRun"] is True and dry.json()["applied"] is False
        assert _dump() == before
        assert all("id" not in i for i in dry.json()["items"] if i["action"] == "create")
        stale = _import(client, b["ws"], pack, expected="000000000000")
        assert stale.status_code == 409 and stale.json()["reason"] == "plan_changed"
        assert _dump() == before
        applied = _import(client, b["ws"], pack, expected=dry.json()["planHash"])
        assert applied.status_code == 200, applied.text
        strip = lambda p: [{k: v for k, v in i.items() if k != "id"} for i in p["items"]]  # noqa: E731
        assert strip(applied.json()) == strip(dry.json())
        assert applied.json()["planHash"] == dry.json()["planHash"]
        assert all(_ID_OK.match(i["id"]) for i in applied.json()["items"] if i["action"] == "create")


_ID_OK = re.compile(r"^(qr|wf|dsh)_[0-9a-f]{8}$")


# --- 7 · conflict rules ------------------------------------------------------------


def _changed(pack: dict, name: str, val: str) -> dict:
    out = json.loads(json.dumps(pack))
    q = next(q for q in out["queries"] if q["name"] == name)
    q["definition"]["filters"][0]["val"] = val
    return out


@pytest.mark.unit
def test_refuse_replace_and_keep_mine() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _changed(_export(client, a["ws"]), "North calls", "East")
        ws = a["ws"]
        # refuse
        r = _import(client, ws, pack)
        assert r.status_code == 409
        assert _items(r.json()["plan"])[("query", "North calls")]["action"] == "conflict"
        # Keep mine: the readers bind to the kept query, with the warning
        kept = _import(client, ws, pack, on_conflict="skip", dry_run=True).json()
        items = _items(kept)
        assert items[("query", "North calls")]["action"] == "skip"
        assert items[("workflow", "All calls")]["binds"] == [{"kind": "query", "name": "North calls"}]
        assert items[("dashboard", "Weekly")]["binds"] == [{"kind": "query", "name": "North calls"}]
        assert kept["warnings"] == 2 and kept["ok"] is True
        # replace: the id kept, one history row, the workflow output kept (its own definition did not move)
        hist = client.get(f"/queries/{a['q']['north']}/history").json()["entries"]
        rep = _import(client, ws, pack, on_conflict="replace")
        assert rep.status_code == 200, rep.text
        assert _items(rep.json())[("query", "North calls")] == {
            "kind": "query",
            "name": "North calls",
            "action": "replace",
            "id": a["q"]["north"],
        }
        after = client.get(f"/queries/{a['q']['north']}/history").json()["entries"]
        assert len(after) == len(hist) + 1 and after[0]["change"] == "update"
        rows = client.get(f"/queries/{a['q']['north']}/rows?unpaged=true").json()["rows"]
        assert {r[_col(a["calls"], "team")] for r in rows} == {"East"}


@pytest.mark.unit
def test_replace_clears_a_changed_workflow_output_keeps_widget_notes_and_takes_the_slug() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        wf = next(w for w in pack["workflows"] if w["name"] == "All calls")
        wf["definition"]["steps"] = [{"kind": "filter", "predicates": [{"col": "amount", "op": "gt", "val": 5}]}]
        dash = pack["dashboards"][0]
        dash["slug"] = "weekly-2"
        dash["definition"]["widgets"][2]["md"] = "Weekly numbers, revised."
        note = client.put(f"/metadata/widget/{a['dsh']}:{_W[0]}/notes", json={"md": "about North"}, headers=_H)
        assert note.status_code in (200, 201), note.text
        r = _import(client, a["ws"], pack, on_conflict="replace")
        assert r.status_code == 200, r.text
        items = _items(r.json())
        assert items[("workflow", "All calls")]["action"] == "replace"
        assert items[("dashboard", "Weekly")]["action"] == "replace"
        assert client.get(f"/workflows/{a['wf']['all']}").json().get("materializedAt") is None
        d = client.get(f"/dashboards/{a['dsh']}").json()
        assert d["slug"] == "weekly-2" and d["id"] == a["dsh"]
        kept = client.get(f"/metadata/widget/{a['dsh']}:{_W[0]}").json()["entries"]["notes"]
        assert kept["md"] == "about North"


@pytest.mark.unit
def test_source_differs_blocks_under_every_choice_and_slug_taken_skips_under_keep_mine() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        b = _workspace(client, "B")
        # a same-named query here reading another dataset
        _ok(
            client.post(
                f"/workspaces/{b['ws']}/queries",
                json={"name": "North calls", "sourceId": b["teams"]["id"], "definition": {"q": None, "filters": [], "advanced": []}},
            )
        )
        # another dashboard here holding the pack's slug
        _ok(client.post(f"/workspaces/{b['ws']}/dashboards", json={"name": "Other", "slug": "weekly", "definition": {"widgets": []}}))
        for choice in ("refuse", "replace", "skip"):
            plan = _import(client, b["ws"], pack, dry_run=True, on_conflict=choice).json()
            north = _items(plan)[("query", "North calls")]
            assert (north["action"], north["reason"]) == ("conflict", "source_differs"), choice
            assert plan["ok"] is False
        pack["queries"] = [q for q in pack["queries"] if q["name"] not in ("North calls", "Team totals view")]
        pack["workflows"] = []
        pack["dashboards"][0]["definition"]["widgets"] = [
            w for w in pack["dashboards"][0]["definition"]["widgets"] if w.get("query") in (None, "South calls")
        ]
        pack["dashboards"][0]["definition"]["controls"] = []
        pack["datasets"] = [d for d in pack["datasets"] if d["name"] != "team_totals"]
        for choice, action in (("refuse", "conflict"), ("replace", "conflict"), ("skip", "skip")):
            weekly = _items(_import(client, b["ws"], pack, dry_run=True, on_conflict=choice).json())[("dashboard", "Weekly")]
            assert (weekly["action"], weekly["reason"], weekly["detail"]) == (action, "slug_taken", "weekly"), choice


# --- 8 · whole pack or nothing; errors -------------------------------------------


@pytest.mark.unit
def test_a_failing_last_dashboard_writes_nothing_and_is_named() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        pack["datasets"] = [d for d in pack["datasets"] if d["name"] != "team_totals"]
        pack["queries"] = [q for q in pack["queries"] if q["name"] != "Team totals view"]
        widgets = pack["dashboards"][0]["definition"]["widgets"]
        pack["dashboards"][0]["definition"]["widgets"] = [w for w in widgets if w.get("query") != "Team totals view"]
        pack["dashboards"][0]["definition"]["controls"][1]["targets"] = ["wdg_0000ffff"]
        b = _workspace(client, "B")
        before = _dump()
        r = _import(client, b["ws"], pack)
        assert r.status_code == 409
        weekly = _items(r.json()["plan"])[("dashboard", "Weekly")]
        assert weekly["action"] == "invalid" and weekly["reason"] == "check_failed"
        assert "unknown_widget" in weekly["detail"]
        assert _items(r.json()["plan"])[("query", "North calls")]["action"] == "create"  # planned, then rolled back
        assert _dump() == before
        assert client.get(f"/workspaces/{b['ws']}/queries").json() == []


@pytest.mark.unit
def test_an_exception_half_way_answers_500_and_writes_nothing(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import definition_pack

    def boom(*_a, **_k):  # noqa: ANN002, ANN003
        raise RuntimeError("disk on fire")

    with TestClient(app, raise_server_exceptions=False) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        b = _workspace(client, "B")
        monkeypatch.setattr(definition_pack, "write_workflow_create", boom)
        before = _dump()
        r = _import(client, b["ws"], pack)
        assert r.status_code == 500 and r.json() == {"detail": "internal_error"}
        assert _dump() == before


@pytest.mark.unit
def test_a_writer_holding_the_lock_past_the_busy_timeout_answers_500_and_nothing_is_written() -> None:
    with TestClient(app, raise_server_exceptions=False) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        b = _workspace(client, "B")
        before = _dump()
        holder = sqlite3.connect(db.get_db_path(), check_same_thread=False)
        holder.execute("BEGIN IMMEDIATE")
        try:
            r = _import(client, b["ws"], pack)
        finally:
            holder.rollback()
            holder.close()
        assert r.status_code == 500 and r.json() == {"detail": "internal_error"}
        assert _dump() == before
        assert _import(client, b["ws"], pack).status_code == 200  # the retry


# --- 9 · the pack is read first, in order ------------------------------------------


@pytest.mark.unit
def test_read_order_and_pack_invalid_reasons() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        ws = a["ws"]

        def reason(body: object) -> dict:
            r = _import(client, ws, body, dry_run=True)
            assert r.status_code == 422, r.text
            assert r.json()["code"] == "pack_invalid"
            return r.json()

        assert reason(b"x" * (10 * 1024 * 1024 + 1))["reason"] == "too_large"
        assert reason(b"not json")["reason"] == "shape"
        newer = reason({"packVersion": 2, "whatever": [1, 2], "queries": "no"})
        assert newer["reason"] == "version" and newer["packVersion"] == 2 and newer["supported"] == [1]
        many = {**pack, "queries": [pack["queries"][0]] * 1001}
        assert reason(many)["reason"] == "too_large"
        extra = reason({**pack, "notes": []})
        assert extra["reason"] == "shape" and extra["problems"][0]["path"] == "notes"
        bad_entry = json.loads(json.dumps(pack))
        del bad_entry["queries"][0]["dataset"]
        shape = reason(bad_entry)
        assert shape["reason"] == "shape" and shape["problems"][0]["path"] == "queries/0/dataset"
        ids = json.loads(json.dumps(pack))
        ids["dashboards"][0]["definition"]["widgets"][0]["queryId"] = "qr_00000000"
        assert reason(ids)["problems"][0]["path"].endswith("widgets/0/queryId")
        dup = {**pack, "queries": pack["queries"] + [pack["queries"][0]]}
        assert reason(dup)["reason"] == "duplicate"
        dup_ds = {**pack, "datasets": pack["datasets"] + [pack["datasets"][0]]}
        assert reason(dup_ds)["problems"] == [{"kind": "dataset", "name": "calls_demo"}]
        no_ds = {**pack, "datasets": [d for d in pack["datasets"] if d["name"] != "teams_demo"]}
        ref = reason(no_ds)
        assert ref["reason"] == "reference"
        assert {"kind": "query", "name": "Calls by region", "ref": "teams_demo", "refKind": "dataset"} in ref["problems"]
        no_q = {**pack, "queries": [q for q in pack["queries"] if q["name"] != "North calls"]}
        assert {"kind": "dashboard", "name": "Weekly", "ref": "North calls", "refKind": "query"} in reason(no_q)["problems"]
        loop = json.loads(json.dumps(pack))
        loop["workflows"][0]["definition"]["sources"] = [{"workflow": "Calls by team"}]
        cyc = reason(loop)
        assert cyc["reason"] == "cycle"
        assert {p["name"] for p in cyc["problems"]} == {"All calls", "Calls by team"}


# --- 10 · history and who --------------------------------------------------------


@pytest.mark.unit
def test_history_rows_and_the_writer_token() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        b = _workspace(client, "B")
        _ok(_import(client, b["ws"], pack, headers=_H), 200)
        ids = _ids_by_name(client, b["ws"])
        h = client.get(f"/queries/{ids['query']['North calls']}/history").json()
        assert [(e["seq"], e["change"], e["changedBy"], e["changedSource"]) for e in h["entries"]] == [
            (1, "create", "report-agent", "ai")
        ]
        changed = _changed(pack, "North calls", "East")
        _ok(_import(client, b["ws"], changed, on_conflict="replace"), 200)
        h2 = client.get(f"/queries/{ids['query']['North calls']}/history").json()
        assert [(e["change"], e["changedBy"]) for e in h2["entries"]] == [("update", None), ("create", "report-agent")]
        assert h2["entries"][0]["version"] == h2["current"]


# --- 11 · where import is allowed ---------------------------------------------------


@pytest.mark.unit
def test_saved_workspace_and_unknown_workspace() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        saved = _ok(client.post(f"/workspaces/{a['ws']}/saved-copies", json={"label": "freeze", "datasetIds": [a["calls"]["id"]]}))
        sid = saved["workspace"]["id"]
        before = _dump()
        r = _import(client, sid, pack)
        assert r.status_code == 409 and r.json() == {"code": "read_only_workspace"}
        assert _dump() == before
        assert client.get(f"/workspaces/{sid}/definitions").status_code == 200
        assert client.get("/workspaces/ws_00000000/definitions").status_code == 404
        assert _import(client, "ws_00000000", pack).status_code == 404


# --- 12 · same install, two workspaces ----------------------------------------------


@pytest.mark.unit
def test_same_install_widget_ids_repeat_but_notes_and_deletes_stay_apart() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        b = _workspace(client, "B")
        _ok(_import(client, b["ws"], pack), 200)
        _run_and_publish(client, b["ws"])
        _ok(_import(client, b["ws"], pack), 200)
        ids_b = _ids_by_name(client, b["ws"])
        dsh_b = ids_b["dashboard"]["Weekly"]
        assert dsh_b != a["dsh"]
        assert set(ids_b["query"].values()).isdisjoint(a["q"].values())
        widgets_b = [w["id"] for w in client.get(f"/dashboards/{dsh_b}").json()["definition"]["widgets"]]
        assert widgets_b == _W
        note = client.put(f"/metadata/widget/{a['dsh']}:{_W[0]}/notes", json={"md": "only A"}, headers=_H)
        assert note.status_code in (200, 201), note.text
        assert "notes" not in client.get(f"/metadata/widget/{dsh_b}:{_W[0]}").json().get("entries", {})
        _ok(client.delete(f"/dashboards/{a['dsh']}"), 204)
        assert [w["id"] for w in client.get(f"/dashboards/{dsh_b}").json()["definition"]["widgets"]] == _W


# --- 14 · workflow on workflow ------------------------------------------------------


@pytest.mark.unit
def test_a_workflow_over_unrun_workflows_imports_and_its_run_refuses_diverging_shapes() -> None:
    with TestClient(app) as client:
        a = _workspace(client, "A")
        b = _workspace(client, "B")
        pack = {
            "packVersion": 1,
            "exportedAt": "2026-10-19T09:00:00Z",
            "exportedBy": "test",
            "workspace": "A",
            "datasets": [
                {"name": "calls_demo", "columns": [{"name": c["name"], "dtype": c["dtype"]} for c in a["calls"]["columns"]]},
                {"name": "teams_demo", "columns": [{"name": c["name"], "dtype": c["dtype"]} for c in a["teams"]["columns"]]},
            ],
            "queries": [
                {"name": "Calls", "dataset": "calls_demo", "definition": {"filters": [], "advanced": []}},
                {"name": "Teams", "dataset": "teams_demo", "definition": {"filters": [], "advanced": []}},
            ],
            "workflows": [
                {"name": "Both", "definition": {"sources": [{"workflow": "W calls"}, {"workflow": "W teams"}], "steps": []}},
                {"name": "W calls", "definition": {"sources": [{"query": "Calls"}], "steps": []}},
                {"name": "W teams", "definition": {"sources": [{"query": "Teams"}], "steps": []}},
            ],
            "dashboards": [],
        }
        r = _import(client, b["ws"], pack)
        assert r.status_code == 200, r.text
        assert [i["name"] for i in r.json()["items"] if i["kind"] == "workflow"] == ["W calls", "W teams", "Both"]
        ids = _ids_by_name(client, b["ws"])
        _ok(client.post(f"/workflows/{ids['workflow']['W calls']}/run"), 200)
        _ok(client.post(f"/workflows/{ids['workflow']['W teams']}/run"), 200)
        run = client.post(f"/workflows/{ids['workflow']['Both']}/run")
        assert run.status_code == 409 and run.json() == {"code": "query_stale"}


# --- 13 · the routes keep their answers (the extraction) ----------------------------


@pytest.mark.unit
def test_routes_answer_as_before_after_the_extraction() -> None:
    """The six create / update routes run the extracted bodies: their 201 / 200,
    404, 409 and 422 answers are unchanged (the routes' own suites cover the
    rest)."""
    with TestClient(app) as client:
        a = _workspace(client, "A")
        ws, calls = a["ws"], a["calls"]
        body = {"name": "Q", "sourceId": calls["id"], "definition": {"q": None, "filters": [], "advanced": []}}
        qid = _ok(client.post(f"/workspaces/{ws}/queries", json=body))["id"]
        assert client.post(f"/workspaces/{ws}/queries", json=body).json() == {"code": "name_taken"}
        bad = {**body, "name": "Q2", "definition": {"filters": [{"col": 99, "dtype": "string", "op": "equals", "val": "x"}], "advanced": []}}
        assert client.post(f"/workspaces/{ws}/queries", json=bad).status_code == 422
        assert client.put("/queries/qr_00000000", json={"definition": body["definition"]}).json() == {"code": "not_found"}
        assert client.put(f"/queries/{qid}", json={"definition": body["definition"]}).status_code == 200
        d = {"name": "D", "slug": "d", "definition": {"widgets": []}}
        did = _ok(client.post(f"/workspaces/{ws}/dashboards", json=d))["id"]
        assert client.post(f"/workspaces/{ws}/dashboards", json={**d, "name": "E"}).json() == {"code": "slug_taken"}
        assert client.put("/dashboards/dsh_00000000", json=d).json() == {"code": "not_found"}
        assert client.put(f"/dashboards/{did}", json={**d, "name": "D2"}).status_code == 200
        w = {"name": "W", "definition": {"sources": [qid], "steps": []}}
        wid = _ok(client.post(f"/workspaces/{ws}/workflows", json=w))["id"]
        assert client.post(f"/workspaces/{ws}/workflows", json=w).json() == {"code": "name_taken"}
        assert client.put("/workflows/wf_00000000", json=w).json() == {"code": "not_found"}
        assert client.put(f"/workflows/{wid}", json={**w, "name": "W2"}).status_code == 200
        unrun = {"name": "W3", "definition": {"sources": [wid], "steps": []}}
        assert client.post(f"/workspaces/{ws}/workflows", json=unrun).status_code == 422  # R186 kept on the route
