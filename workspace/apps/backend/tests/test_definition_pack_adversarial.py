"""R201 QA — adversarial tests for the definition pack (fake data only), adopted from
QA's review of `2f8b34c..78e0474`.

Runs inside workspace/apps/backend/tests/ next to test_definition_pack.py (it reuses
that module's helpers and the autouse isolated-data-root fixture of conftest.py).
"""

from __future__ import annotations

import copy
import json
import re

import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_definition_pack import (
    _build_a,
    _dump,
    _export,
    _import,
    _items,
    _ok,
    _upload,
    _workspace,
)

_ID = re.compile(r"(?<![a-z])(ds|qr|wf|dsh|rel|ws)_[0-9a-f]{8}")


def _walk(n):
    if isinstance(n, dict):
        for k, v in n.items():
            yield k
            yield from _walk(v)
    elif isinstance(n, list):
        for v in n:
            yield from _walk(v)
    else:
        yield n


@pytest.mark.unit
def test_qa_no_install_id_in_keys_or_values_word_bounded() -> None:
    with TestClient(app) as client:
        pack = _export(client, _build_a(client)["ws"])
        assert not [v for v in _walk(pack) if isinstance(v, str) and _ID.search(v)]


@pytest.mark.unit
def test_qa_chunked_body_over_the_cap_is_refused_without_content_length() -> None:
    def gen():
        yield b'{"packVersion": 1, "pad": "'
        for _ in range(11):
            yield b"x" * (1 << 20)
        yield b'"}'

    with TestClient(app) as client:
        ws = _workspace(client, "QA chunked", data=False)["ws"]
        before = _dump()
        r = client.post(
            f"/workspaces/{ws}/definitions/import", content=gen(), headers={"Content-Type": "application/json"}
        )
        assert r.status_code == 422 and r.json()["reason"] == "too_large"
        assert _dump() == before


@pytest.mark.unit
@pytest.mark.parametrize(
    "label,csv",
    [
        ("dtype", b"id,team,amount,day\n1,North,ten,2026-10-10\n"),
        ("extra", b"id,team,amount,day,extra\n1,North,10,2026-10-10,x\n"),
        ("missing", b"id,team,amount\n1,North,10\n"),
    ],
)
def test_qa_columns_differ_dtype_extra_missing(label: str, csv: bytes) -> None:
    with TestClient(app) as client:
        pack = _export(client, _build_a(client)["ws"])
        ws = _ok(client.post("/workspaces", json={"name": f"QA {label}"}))["id"]
        _upload(client, ws, "calls_demo", csv)
        _upload(client, ws, "teams_demo", b"team,region\nNorth,N-1\n")
        before = _dump()
        plan = _import(client, ws, pack, dry_run=True).json()
        calls = next(d for d in plan["datasets"] if d["name"] == "calls_demo")
        assert calls["status"] == "columns_differ" and plan["ok"] is False
        r = _import(client, ws, pack)
        assert r.status_code == 409 and r.json()["reason"] == "not_ok"
        assert _dump() == before


@pytest.mark.unit
@pytest.mark.parametrize(
    "mutate,reason",
    [
        (lambda p: p.update(packVersion=True), "shape"),
        (lambda p: p.update(packVersion=2, newField=1), "version"),
        (lambda p: p["dashboards"][0]["definition"]["widgets"][0].update(queryId="qr_deadbeef"), "shape"),
        (lambda p: p["queries"].append(copy.deepcopy(p["queries"][0])), "duplicate"),
        (lambda p: p["datasets"].append(copy.deepcopy(p["datasets"][0])), "duplicate"),
    ],
)
def test_qa_pack_defects(mutate, reason: str) -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        mutate(pack)
        before = _dump()
        r = _import(client, a["ws"], pack)
        assert r.status_code == 422 and r.json()["reason"] == reason, r.text
        assert _dump() == before


@pytest.mark.unit
def test_qa_slug_taken_after_the_dry_run_writes_nothing_of_the_earlier_nouns() -> None:
    with TestClient(app) as client:
        pack = _export(client, _build_a(client)["ws"])
        weekly = next(d for d in pack["dashboards"] if d["name"] == "Weekly")
        # the fixture's Weekly reads the deferred "Team totals view"; without that widget it is written now
        weekly["definition"]["widgets"] = [
            w for w in weekly["definition"]["widgets"] if w.get("query") != "Team totals view"
        ]
        b = _workspace(client, "QA slug")
        dry = _import(client, b["ws"], pack, dry_run=True).json()
        assert dry["ok"] is True and dry["counts"]["create"] > 0
        _ok(
            client.post(
                f"/workspaces/{b['ws']}/dashboards",
                json={"name": "Other", "slug": "weekly", "definition": {"widgets": []}},
            )
        )
        before = _dump()
        r = _import(client, b["ws"], pack)
        assert r.status_code == 409 and r.json()["reason"] == "not_ok"
        assert _items(r.json()["plan"])[("dashboard", "Weekly")]["reason"] == "slug_taken"
        assert _dump() == before
        r = _import(client, b["ws"], pack, expected=dry["planHash"])
        assert r.status_code == 409 and r.json()["reason"] == "plan_changed"
        assert _dump() == before


@pytest.mark.unit
def test_qa_keep_mine_with_nothing_to_write_writes_nothing() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        next(q for q in pack["queries"] if q["name"] == "North calls")["definition"]["filters"][0]["val"] = "East"
        before = _dump()
        r = _import(client, a["ws"], pack, on_conflict="skip")
        assert r.status_code == 200 and r.json()["applied"] is True and r.json()["warnings"] == 2
        assert _dump() == before


@pytest.mark.unit
def test_qa_replace_and_replace_back_keeps_ids_and_returns_to_the_same_rows() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        rows0 = client.get(f"/queries/{a['q']['north']}/rows?unpaged=true").json()["rows"]
        changed = copy.deepcopy(pack)
        next(q for q in changed["queries"] if q["name"] == "North calls")["definition"]["filters"][0]["val"] = "East"
        assert _import(client, a["ws"], changed, on_conflict="replace").status_code == 200
        r = _import(client, a["ws"], pack, on_conflict="replace")
        assert r.status_code == 200 and _items(r.json())[("query", "North calls")] == {
            "kind": "query",
            "name": "North calls",
            "action": "replace",
            "id": a["q"]["north"],
        }
        assert client.get(f"/queries/{a['q']['north']}/rows?unpaged=true").json()["rows"] == rows0


@pytest.mark.unit
def test_qa_a_cap_sized_pack_imports_quickly() -> None:
    import time

    with TestClient(app) as client:
        pack = _export(client, _build_a(client)["ws"])
        base = next(q for q in pack["queries"] if q["name"] == "North calls")
        big = {
            **pack,
            "queries": [dict(copy.deepcopy(base), name=f"Q {i:04d}") for i in range(1000)],
            "workflows": [],
            "dashboards": [],
        }
        big["datasets"] = [d for d in pack["datasets"] if d["name"] == "calls_demo"]
        ws = _workspace(client, "QA big")["ws"]
        t0 = time.perf_counter()
        r = _import(client, ws, big)
        assert r.status_code == 200 and r.json()["counts"]["create"] == 1000
        assert time.perf_counter() - t0 < 5.0  # under the 5 s busy timeout other writers wait for


# --- QA-1 (found at 78e0474, fixed in the review fold) ----------------------------


@pytest.mark.unit
def test_qa_refuse_names_every_conflicting_noun() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        next(q for q in pack["queries"] if q["name"] == "North calls")["definition"]["filters"][0]["val"] = "East"
        weekly = next(d for d in pack["dashboards"] if d["name"] == "Weekly")
        next(w for w in weekly["definition"]["widgets"] if w.get("md"))["md"] = "Changed note."
        plan = _import(client, a["ws"], pack, dry_run=True).json()
        items = _items(plan)
        # Weekly itself differs from the target: it is a conflict too, not only "needs North calls".
        assert items[("dashboard", "Weekly")]["action"] == "conflict"
        assert plan["counts"]["conflict"] == 2
        assert items[("dashboard", "Weekly")]["detail"] == "North calls"  # the noun it also needs


# --- CR-1 / CR-2 (code review of 78e0474) -------------------------------------------


@pytest.mark.unit
def test_cr1_deferred_workflow_check_still_refuses_duplicates_and_diverging_known_shapes() -> None:
    with TestClient(app) as client:
        pack = _export(client, _build_a(client)["ws"])
        pack["workflows"].append(
            {
                "name": "Dup",
                "definition": {"sources": [{"workflow": "All calls"}, {"workflow": "All calls"}], "steps": []},
            }
        )
        pack["workflows"].append(
            {
                "name": "Mixed",
                "definition": {
                    "sources": [{"query": "Calls in period"}, {"query": "North calls"}, {"workflow": "All calls"}],
                    "steps": [],
                },
            }
        )
        b = _workspace(client, "CR dup")
        items = _items(_import(client, b["ws"], pack, dry_run=True).json())
        dup, mixed = items[("workflow", "Dup")], items[("workflow", "Mixed")]
        assert (dup["action"], dup["reason"]) == ("invalid", "check_failed")
        assert dup["detail"].startswith("duplicate_source")
        assert (mixed["action"], mixed["reason"]) == ("invalid", "check_failed")
        assert mixed["detail"].startswith("sources_diverge")
        # the workflow over the never-run one alone is still deferred to its run
        assert items[("workflow", "Calls by team")]["action"] == "create"


@pytest.mark.unit
def test_cr2_a_deeply_nested_body_is_a_shape_error_not_a_500() -> None:
    with TestClient(app) as client:
        ws = _workspace(client, "CR deep", data=False)["ws"]
        deep = b"[" * 100_000 + b"]" * 100_000
        before = _dump()
        r = _import(client, ws, deep, dry_run=True)
        assert r.status_code == 422 and r.json()["reason"] == "shape", r.text
        assert _dump() == before


# --- re-check of b249f3a: QA-1 at two hops, BA-F2, BA-F3, BA-F7 -----------------------


@pytest.mark.unit
def test_qa_refuse_names_a_conflicting_noun_two_hops_from_the_first_conflict() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        next(q for q in pack["queries"] if q["name"] == "North calls")["definition"]["filters"][0]["val"] = "East"
        # "Calls by team" reads "All calls", which reads "North calls"; change "Calls by team" itself.
        team = next(w for w in pack["workflows"] if w["name"] == "Calls by team")
        team["definition"]["steps"][0]["measures"][0]["agg"] = "max"
        plan = _import(client, a["ws"], pack, dry_run=True).json()
        items = _items(plan)
        assert items[("workflow", "All calls")]["action"] == "invalid"  # unchanged itself: needs North calls
        assert items[("workflow", "Calls by team")]["action"] == "conflict", items[("workflow", "Calls by team")]
        assert plan["counts"]["conflict"] == 2


@pytest.mark.unit
def test_baf2_an_edit_between_the_check_and_the_click_refuses_the_apply() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        next(q for q in pack["queries"] if q["name"] == "North calls")["definition"]["filters"][0]["val"] = "East"
        dry = _import(client, a["ws"], pack, dry_run=True, on_conflict="replace").json()
        assert "_target" not in json.dumps(dry)
        # someone edits the query the plan replaces (the decision stays "replace")
        q = client.get(f"/queries/{a['q']['north']}").json()
        q["definition"]["filters"][0]["val"] = "South"
        assert client.put(f"/queries/{a['q']['north']}", json={"definition": q["definition"]}).status_code == 200
        before = _dump()
        r = _import(client, a["ws"], pack, on_conflict="replace", expected=dry["planHash"])
        assert r.status_code == 409 and r.json()["reason"] == "plan_changed"
        assert _items(r.json()["plan"])[("query", "North calls")]["action"] == "replace"  # same decision, other target
        assert _dump() == before
        # an unchanged workspace keeps its hash
        again = _import(client, a["ws"], pack, dry_run=True, on_conflict="replace").json()
        assert _import(client, a["ws"], pack, on_conflict="replace", expected=again["planHash"]).status_code == 200


@pytest.mark.unit
def test_baf3_baf7_slug_holder_named_and_kept_rows_carry_no_warnings() -> None:
    with TestClient(app) as client:
        a = _build_a(client)
        pack = _export(client, a["ws"])
        next(q for q in pack["queries"] if q["name"] == "North calls")["definition"]["filters"][0]["val"] = "East"
        weekly = next(d for d in pack["dashboards"] if d["name"] == "Weekly")
        weekly["name"] = "Weekly copy"  # same slug as the target's "Weekly"
        items = _items(_import(client, a["ws"], pack, dry_run=True, on_conflict="skip").json())
        copy_row = items[("dashboard", "Weekly copy")]
        assert (copy_row["action"], copy_row["reason"], copy_row["detail"], copy_row["via"]) == (
            "skip",
            "slug_taken",
            "weekly",
            "Weekly",
        )
        assert "binds" not in items[("query", "North calls")]  # the kept row itself
        assert items[("workflow", "All calls")]["binds"] == [{"kind": "query", "name": "North calls"}]
