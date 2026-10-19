"""R201 (item 4.8) — the definition pack: a workspace's queries, workflows and
dashboards written BY NAME (export), and applied to another workspace by name
(import). Design: .agents/design/data-management/_shared/definition-pack.md.
Contracts: workspaces/definitions-get + definitions-import, _shared/definition-pack.yaml.

No parallel writer: every write goes through the routes' own bodies
(``write_*_create`` / ``write_*_update``), on one connection, inside one
``BEGIN IMMEDIATE`` transaction — a dry run rolls it back, an apply commits only
an ``ok`` plan (whole pack or nothing; ``deferred`` rows are a planned state).
"""

from __future__ import annotations

import heapq
import json
import sqlite3
from dataclasses import dataclass, field
from typing import Annotated, Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app._generated.constants import PACK_MAX_BYTES, PACK_MAX_NOUNS, PACK_VERSION
from app.metadata import _strip_none, definition_version
from app.models.common import DashboardDefinition, QueryDefinition, WorkflowDefinition
from app.routers._shared import NounGone, _now_iso
from app.routers.dashboards import write_dashboard_create, write_dashboard_update
from app.routers.queries import write_query_create, write_query_update
from app.routers.workflows import write_workflow_create, write_workflow_update

KINDS = ("query", "workflow", "dashboard")
_LISTS = {"query": "queries", "workflow": "workflows", "dashboard": "dashboards"}
_TABLES = {"query": "queries", "workflow": "workflows", "dashboard": "dashboards"}
_SHAPE_PROBLEMS_MAX = 20


# --- errors ----------------------------------------------------------------------


class PackInvalid(Exception):
    """``422 pack_invalid`` — the pack cannot be read (nothing checked against the
    workspace, nothing written)."""

    def __init__(self, reason: str, problems: list[dict], **extra: Any) -> None:
        super().__init__(reason)
        self.body = {"code": "pack_invalid", "reason": reason, "problems": problems, **extra}


class PackUnresolved(Exception):
    """``409 pack_unresolved`` — the exporting workspace references a deleted noun."""

    def __init__(self, problems: list[dict]) -> None:
        super().__init__("pack_unresolved")
        self.body = {"code": "pack_unresolved", "problems": problems}


# --- the pack's closed shape (read by the route itself — BA-C3) ----------------

_Name = Annotated[str, Field(min_length=1, max_length=120)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _PackColumn(_Strict):
    name: Annotated[str, Field(min_length=1)]
    dtype: Literal["string", "integer", "float", "boolean", "date", "datetime"]


class _PackDataset(_Strict):
    name: _Name
    columns: Annotated[list[_PackColumn], Field(min_length=1)]
    publishedBy: _Name | None = None  # noqa: N815 — wire shape


class _PackQuery(_Strict):
    name: _Name
    dataset: _Name
    definition: dict


class _SourceQuery(_Strict):
    query: _Name


class _SourceWorkflow(_Strict):
    workflow: _Name


class _PackWorkflowDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")  # `steps` as stored; the target's model reads them
    sources: Annotated[list[_SourceQuery | _SourceWorkflow], Field(min_length=1)]


class _PackWorkflow(_Strict):
    name: _Name
    definition: _PackWorkflowDefinition


class _PackDashboard(_Strict):
    name: _Name
    slug: Annotated[str, Field(min_length=1, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    definition: dict


class _Pack(_Strict):
    packVersion: int  # noqa: N815
    exportedAt: str  # noqa: N815
    exportedBy: str  # noqa: N815
    workspace: str
    datasets: list[_PackDataset]
    queries: list[_PackQuery]
    workflows: list[_PackWorkflow]
    dashboards: list[_PackDashboard]


def _loc(loc: tuple) -> str:
    return "/".join(str(p) for p in loc)


def read_pack(raw: bytes) -> dict:
    """Read a pack in the order BA-C3 fixed: size → JSON → version → the total cap
    → the closed shape → duplicates → references (a closed pack, datasets
    included — BA-C4) → workflow cycles. Returns the pack as a plain dict."""
    if len(raw) > PACK_MAX_BYTES:
        raise PackInvalid("too_large", [])
    try:
        obj = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise PackInvalid("shape", [{"path": "", "detail": "the body is not JSON"}]) from None
    except RecursionError:  # CR-2 — nesting deeper than the parser can follow
        raise PackInvalid("shape", [{"path": "", "detail": "the body is nested too deeply"}]) from None
    if not isinstance(obj, dict):
        raise PackInvalid("shape", [{"path": "", "detail": "the body is not a JSON object"}])
    version = obj.get("packVersion")
    if not isinstance(version, int) or isinstance(version, bool):
        raise PackInvalid("shape", [{"path": "packVersion", "detail": "packVersion must be an integer"}])
    if version != PACK_VERSION:
        raise PackInvalid("version", [], packVersion=version, supported=[PACK_VERSION])
    total = sum(len(obj[k]) for k in ("queries", "workflows", "dashboards") if isinstance(obj.get(k), list))
    if total > PACK_MAX_NOUNS:
        raise PackInvalid("too_large", [])
    try:
        pack = _Pack.model_validate(obj).model_dump(exclude_none=True)
    except RecursionError:  # CR-2
        raise PackInvalid("shape", [{"path": "", "detail": "the body is nested too deeply"}]) from None
    except ValidationError as exc:
        problems = [{"path": _loc(e["loc"]), "detail": e["msg"]} for e in exc.errors()[:_SHAPE_PROBLEMS_MAX]]
        raise PackInvalid("shape", problems) from None
    _check_reference_shapes(pack)
    _check_duplicates(pack)
    _check_references(pack)
    _check_cycles(pack)
    return pack


def _check_reference_shapes(pack: dict) -> None:
    """The renamed reference fields are the only spelling a pack has: a query
    relationship names its datasets (`leftDataset` / `rightDataset`, never an
    install id) and a widget its query (`query`, never `queryId`)."""
    problems: list[dict] = []
    for qi, q in enumerate(pack["queries"]):
        rels = q["definition"].get("relationships") or []
        if not isinstance(rels, list):
            problems.append({"path": f"queries/{qi}/definition/relationships", "detail": "must be a list"})
            continue
        for ri, r in enumerate(rels):
            at = f"queries/{qi}/definition/relationships/{ri}"
            if not isinstance(r, dict):
                problems.append({"path": at, "detail": "must be an object"})
                continue
            for k in ("leftSourceId", "rightSourceId", "originRelationshipId"):
                if k in r:
                    problems.append({"path": f"{at}/{k}", "detail": "a pack names datasets, not ids"})
            for k in ("leftDataset", "rightDataset"):
                if not isinstance(r.get(k), str) or not r.get(k):
                    problems.append({"path": f"{at}/{k}", "detail": "Field required"})
    for di, d in enumerate(pack["dashboards"]):
        widgets = d["definition"].get("widgets")
        if not isinstance(widgets, list):
            problems.append({"path": f"dashboards/{di}/definition/widgets", "detail": "must be a list"})
            continue
        for wi, w in enumerate(widgets):
            at = f"dashboards/{di}/definition/widgets/{wi}"
            if not isinstance(w, dict):
                problems.append({"path": at, "detail": "must be an object"})
            elif "queryId" in w:
                problems.append({"path": f"{at}/queryId", "detail": "a pack names queries, not ids"})
            elif "query" in w and not isinstance(w["query"], str):
                problems.append({"path": f"{at}/query", "detail": "must be a string"})
    if problems:
        raise PackInvalid("shape", problems[:_SHAPE_PROBLEMS_MAX])


def _check_duplicates(pack: dict) -> None:
    problems: list[dict] = []
    for kind, key in (
        ("dataset", "datasets"),
        ("query", "queries"),
        ("workflow", "workflows"),
        ("dashboard", "dashboards"),
    ):
        seen: set[str] = set()
        for entry in pack[key]:
            if entry["name"] in seen:
                problems.append({"kind": kind, "name": entry["name"]})
            seen.add(entry["name"])
    slugs: set[str] = set()
    for d in pack["dashboards"]:
        if d["slug"] in slugs:
            problems.append({"kind": "dashboard", "name": d["name"], "ref": d["slug"]})
        slugs.add(d["slug"])
    if problems:
        raise PackInvalid("duplicate", problems)


def _query_datasets(q: dict) -> list[str]:
    """Every dataset a pack query reads: its own and its relationships' ends."""
    names = [q["dataset"]]
    for r in q["definition"].get("relationships") or []:
        names += [r["leftDataset"], r["rightDataset"]]
    return names


def _widget_queries(d: dict) -> list[str]:
    return [w["query"] for w in d["definition"]["widgets"] if isinstance(w.get("query"), str)]


def _source_refs(w: dict) -> list[tuple[str, str]]:
    return [("query", s["query"]) if "query" in s else ("workflow", s["workflow"]) for s in w["definition"]["sources"]]


def _check_references(pack: dict) -> None:
    datasets = {d["name"] for d in pack["datasets"]}
    names = {k: {e["name"] for e in pack[_LISTS[k]]} for k in KINDS}
    problems: list[dict] = []
    for q in pack["queries"]:
        for ds in dict.fromkeys(_query_datasets(q)):
            if ds not in datasets:
                problems.append({"kind": "query", "name": q["name"], "ref": ds, "refKind": "dataset"})
    for w in pack["workflows"]:
        for kind, ref in _source_refs(w):
            if ref not in names[kind]:
                problems.append({"kind": "workflow", "name": w["name"], "ref": ref, "refKind": kind})
    for d in pack["dashboards"]:
        for ref in dict.fromkeys(_widget_queries(d)):
            if ref not in names["query"]:
                problems.append({"kind": "dashboard", "name": d["name"], "ref": ref, "refKind": "query"})
    for ds in pack["datasets"]:
        if "publishedBy" in ds and ds["publishedBy"] not in names["workflow"]:
            problems.append({"kind": "dataset", "name": ds["name"], "ref": ds["publishedBy"], "refKind": "workflow"})
    if problems:
        raise PackInvalid("reference", problems)


def _workflow_order(pack: dict) -> list[dict]:
    """Workflows after the workflows they read; otherwise by name (Kahn, a heap on
    the name). Raises ``cycle`` naming every workflow left in a loop."""
    by_name = {w["name"]: w for w in pack["workflows"]}
    needs = {n: {ref for kind, ref in _source_refs(w) if kind == "workflow"} for n, w in by_name.items()}
    readers: dict[str, set[str]] = {n: set() for n in by_name}
    for n, deps in needs.items():
        for dep in deps:
            readers[dep].add(n)
    waiting = {n: len(deps) for n, deps in needs.items()}
    ready = [n for n, k in waiting.items() if k == 0]
    heapq.heapify(ready)
    order: list[str] = []
    while ready:
        n = heapq.heappop(ready)
        order.append(n)
        for r in sorted(readers[n]):
            waiting[r] -= 1
            if waiting[r] == 0:
                heapq.heappush(ready, r)
    if len(order) != len(by_name):
        loop = sorted(n for n in by_name if n not in order)
        raise PackInvalid("cycle", [{"kind": "workflow", "name": n} for n in loop])
    return [by_name[n] for n in order]


def _check_cycles(pack: dict) -> None:
    _workflow_order(pack)


# --- export ------------------------------------------------------------------------


def _app_version() -> str:
    """The exporting app's version (informational); `_version.py` is written by
    the build (hatch-vcs), so a source checkout without it says 0.0.0."""
    try:
        from app._version import version
    except ImportError:  # pragma: no cover — a checkout never built
        return "0.0.0"
    return version


def _columns(columns_json: str) -> list[dict]:
    return [{"name": c["name"], "dtype": c["dtype"]} for c in json.loads(columns_json)]


def _query_form(definition: dict, ds_name: dict[str, str]) -> tuple[dict, list[str]]:
    """A stored query definition, normalized by the model, with its relationship
    ends by name and no `originRelationshipId`. Returns the form and the ids it
    could not name."""
    d = _strip_none(QueryDefinition(**definition).model_dump())
    missing: list[str] = []
    rels = []
    for r in d.get("relationships") or []:
        r = dict(r)
        r.pop("originRelationshipId", None)
        left, right = r.pop("leftSourceId"), r.pop("rightSourceId")
        for side in (left, right):
            if side not in ds_name:
                missing.append(side)
        rels.append({**r, "leftDataset": ds_name.get(left, left), "rightDataset": ds_name.get(right, right)})
    if "relationships" in d:
        d["relationships"] = rels
    return d, missing


def _workflow_form(definition: dict, q_name: dict[str, str], w_name: dict[str, str]) -> tuple[dict, list[str]]:
    d = _strip_none(WorkflowDefinition(**definition).model_dump())
    missing: list[str] = []
    sources = []
    for src in d["sources"]:
        if src.startswith("qr_"):
            sources.append({"query": q_name[src]} if src in q_name else None)
        else:
            sources.append({"workflow": w_name[src]} if src in w_name else None)
        if sources[-1] is None:
            missing.append(src)
    d["sources"] = [s for s in sources if s is not None]
    return d, missing


def _dashboard_form(definition: dict, q_name: dict[str, str]) -> tuple[dict, list[str]]:
    """Widgets by query name; returns the titles of widgets whose query is gone."""
    d = _strip_none(DashboardDefinition(**definition).model_dump())
    missing: list[str] = []
    widgets = []
    for w in d["widgets"]:
        w = dict(w)
        qid = w.pop("queryId", None)
        if qid is not None:
            if qid not in q_name:
                missing.append(w["title"])
            w["query"] = q_name.get(qid, qid)
        widgets.append(w)
    d["widgets"] = widgets
    return d, missing


def _rows(con: sqlite3.Connection, table: str, workspace_id: str) -> list[sqlite3.Row]:
    # review-cr item 13 — every listing has an explicit order on a stable key.
    return con.execute(
        f"SELECT * FROM {table} WHERE workspace_id = ? ORDER BY name, id",  # noqa: S608 — constant table names
        (workspace_id,),
    ).fetchall()


def export_pack(con: sqlite3.Connection, workspace_id: str) -> dict:
    """The workspace's pack. Raises ``PackUnresolved`` when a definition names a
    deleted noun."""
    ds_rows = _rows(con, "datasets", workspace_id)
    q_rows, w_rows, d_rows = (_rows(con, _TABLES[k], workspace_id) for k in KINDS)
    ds_name = {r["id"]: r["name"] for r in ds_rows}
    q_name = {r["id"]: r["name"] for r in q_rows}
    w_name = {r["id"]: r["name"] for r in w_rows}
    problems: list[dict] = []

    queries = []
    for r in q_rows:
        form, missing = _query_form(json.loads(r["definition_json"]), ds_name)
        if r["source_id"] not in ds_name:
            missing.append(r["source_id"])
        if missing:
            problems.append({"kind": "query", "name": r["name"], "reason": "dataset_missing"})
        queries.append({"name": r["name"], "dataset": ds_name.get(r["source_id"], ""), "definition": form})
    workflows = []
    for r in w_rows:
        form, missing = _workflow_form(json.loads(r["definition_json"]), q_name, w_name)
        if missing:
            problems.append({"kind": "workflow", "name": r["name"], "reason": "source_missing"})
        workflows.append({"name": r["name"], "definition": form})
    dashboards = []
    for r in d_rows:
        form, missing = _dashboard_form(json.loads(r["definition_json"]), q_name)
        for title in missing:
            problems.append({"kind": "dashboard", "name": r["name"], "reason": "query_missing", "ref": title})
        dashboards.append({"name": r["name"], "slug": r["slug"], "definition": form})
    if problems:
        raise PackUnresolved(problems)

    used = {n for q in queries for n in _query_datasets(q)}
    datasets = []
    for r in ds_rows:  # already by name
        if r["name"] not in used:
            continue
        entry: dict = {"name": r["name"], "columns": _columns(r["columns_json"])}
        if r["published_workflow_id"] in w_name:
            entry["publishedBy"] = w_name[r["published_workflow_id"]]
        datasets.append(entry)
    ws = con.execute("SELECT name FROM workspaces WHERE id = ?", (workspace_id,)).fetchone()
    return {
        "packVersion": PACK_VERSION,
        "exportedAt": _now_iso(),
        "exportedBy": _app_version(),
        "workspace": ws["name"],
        "datasets": datasets,
        "queries": queries,
        "workflows": workflows,
        "dashboards": dashboards,
    }


# --- import ------------------------------------------------------------------------


@dataclass
class _Target:
    """The target workspace as the import sees it, inside its transaction."""

    con: sqlite3.Connection
    ids: dict[str, dict[str, str]] = field(default_factory=lambda: {k: {} for k in KINDS})  # kind → name → id
    broken: set[tuple[str, str]] = field(default_factory=set)  # invalid / conflicting: readers cannot import
    later: set[tuple[str, str]] = field(default_factory=set)  # deferred
    kept: set[tuple[str, str]] = field(default_factory=set)  # Keep mine, definition differs


def _check_message(exc: Exception) -> str:
    """One readable line from a save check's refusal (FastAPI 422 detail, a model
    error, a typed error body)."""
    if isinstance(exc, HTTPException):
        detail = exc.detail
        if isinstance(detail, list) and detail and isinstance(detail[0], dict):
            return str(detail[0].get("msg", detail[0]))
        if isinstance(detail, dict):
            return str(detail.get("code") or detail)
        return str(detail)
    if isinstance(exc, ValidationError):
        e = exc.errors()[0]
        return f"{_loc(e['loc'])}: {e['msg']}" if e.get("loc") else e["msg"]
    return str(exc)


def _same(a: dict, b: dict) -> bool:
    return definition_version(a) == definition_version(b)


def _comparable_query(definition: dict) -> dict:
    """A stored query definition as its pack form compares: normalized by the
    model, without `originRelationshipId` (provenance the pack does not carry)."""
    d = QueryDefinition(**definition).model_dump()
    for r in d.get("relationships") or []:
        r.pop("originRelationshipId", None)
    return d


def _dataset_plan(con: sqlite3.Connection, workspace_id: str, pack: dict) -> tuple[list[dict], dict[str, str]]:
    read = {n for q in pack["queries"] for n in _query_datasets(q)}
    workflows = {w["name"] for w in pack["workflows"]}
    plan: list[dict] = []
    ids: dict[str, str] = {}
    for ds in pack["datasets"]:
        entry: dict = {"name": ds["name"]}
        if "publishedBy" in ds:
            entry["publishedBy"] = ds["publishedBy"]
        row = con.execute(
            "SELECT id, columns_json FROM datasets WHERE workspace_id = ? AND name = ?", (workspace_id, ds["name"])
        ).fetchone()
        if ds["name"] not in read:
            entry["status"] = "unused"
        elif row is None:
            entry["status"] = "awaits_publish" if ds.get("publishedBy") in workflows else "missing"
        else:
            found = _columns(row["columns_json"])
            if found == ds["columns"]:
                entry["status"] = "found"
                ids[ds["name"]] = row["id"]
            else:
                entry["status"] = "columns_differ"
                entry["columns"] = {"expected": ds["columns"], "found": found}
        plan.append(entry)
    return plan, ids


def _savepoint(con: sqlite3.Connection, write) -> tuple[str | None, str | None]:  # type: ignore[no-untyped-def]
    """Run one noun's write in a savepoint: ``(id, None)`` or ``(None, message)``
    with the noun's partial write undone (the import's transaction goes on)."""
    con.execute("SAVEPOINT pack_noun")
    try:
        noun_id = write()
    except (HTTPException, ValidationError, NounGone, sqlite3.IntegrityError, ValueError, KeyError, TypeError) as exc:
        con.execute("ROLLBACK TO pack_noun")
        con.execute("RELEASE pack_noun")
        return None, _check_message(exc)
    con.execute("RELEASE pack_noun")
    return noun_id, None


def _own_conflict(
    t: _Target,
    blocked: dict,
    existing: sqlite3.Row | None,
    on_conflict: str,
    refs: list[tuple[str, str]],
    differs,  # type: ignore[no-untyped-def]
) -> dict:
    """QA-1 — under `refuse`, a noun that reads a conflicting noun but ALSO differs
    from its own same-named noun here is a `conflict` itself (its own conflict
    takes precedence over `needs`; `detail` keeps the noun it also needs), so the
    plan counts every conflict. Otherwise the blocked state stands."""
    if blocked["action"] != "invalid" or on_conflict != "refuse" or existing is None:
        return blocked
    if not all(ref[1] in t.ids[ref[0]] for ref in refs):
        return blocked  # a needed noun has no id here (it could not be written): nothing to compare
    try:
        if not differs():
            return blocked
    except (ValidationError, ValueError, TypeError, KeyError):
        return blocked
    return {"action": "conflict", "id": existing["id"], "reason": "exists", "detail": blocked["detail"]}


def _readers_state(t: _Target, refs: list[tuple[str, str]]) -> tuple[dict | None, list[dict]]:
    """For a noun reading `refs`: the item fields when it cannot be written now
    (`invalid` / `deferred`, reason `needs`), and its `binds` (kept nouns that
    differ from the pack)."""
    for ref in refs:
        if ref in t.broken:
            return {"action": "invalid", "reason": "needs", "detail": ref[1]}, []
    for ref in refs:
        if ref in t.later:
            return {"action": "deferred", "reason": "needs", "detail": ref[1]}, []
    binds = [{"kind": k, "name": n} for k, n in dict.fromkeys(refs) if (k, n) in t.kept]
    return None, binds


def _decide(
    t: _Target,
    kind: str,
    name: str,
    existing: sqlite3.Row | None,
    same: bool,
    on_conflict: str,
    create,  # type: ignore[no-untyped-def]
    update,  # type: ignore[no-untyped-def]
) -> dict:
    """create / unchanged / replace / skip / conflict for one noun, writing
    through the route bodies; a refused write is `invalid` (`check_failed`)."""
    if existing is None:
        noun_id, err = _savepoint(t.con, create)
        if err is not None:
            t.broken.add((kind, name))
            return {"action": "invalid", "reason": "check_failed", "detail": err}
        t.ids[kind][name] = noun_id  # type: ignore[assignment]
        return {"action": "create", "id": noun_id}
    t.ids[kind][name] = existing["id"]
    if same:
        return {"action": "unchanged", "id": existing["id"]}
    if on_conflict == "refuse":
        t.broken.add((kind, name))
        return {"action": "conflict", "id": existing["id"], "reason": "exists"}
    if on_conflict == "skip":
        t.kept.add((kind, name))
        return {"action": "skip", "id": existing["id"]}
    _id, err = _savepoint(t.con, update)
    if err is not None:
        t.broken.add((kind, name))
        return {"action": "invalid", "reason": "check_failed", "detail": err}
    return {"action": "replace", "id": existing["id"]}


def _existing(con: sqlite3.Connection, kind: str, workspace_id: str, name: str) -> sqlite3.Row | None:
    return con.execute(
        f"SELECT * FROM {_TABLES[kind]} WHERE workspace_id = ? AND name = ?",  # noqa: S608 — constant table names
        (workspace_id, name),
    ).fetchone()


def plan_import(
    con: sqlite3.Connection,
    workspace_id: str,
    pack: dict,
    on_conflict: str,
    writer: tuple[str | None, str | None],
) -> dict:
    """Plan and write the pack on ``con`` (the caller holds ``BEGIN IMMEDIATE``
    and decides commit or rollback). Returns the plan (without dry-run fields)."""
    now = _now_iso()
    t = _Target(con)
    datasets, ds_ids = _dataset_plan(con, workspace_id, pack)
    status = {d["name"]: d for d in datasets}
    items: list[dict] = []

    for q in pack["queries"]:
        item: dict = {"kind": "query", "name": q["name"]}
        names = list(dict.fromkeys(_query_datasets(q)))
        waiting = [n for n in names if status[n]["status"] == "awaits_publish"]
        bad = [n for n in names if status[n]["status"] in ("missing", "columns_differ")]
        existing = _existing(con, "query", workspace_id, q["name"])
        if bad:
            st = status[bad[0]]["status"]
            item.update(
                action="invalid", reason="dataset_missing" if st == "missing" else "columns_differ", detail=bad[0]
            )
            t.broken.add(("query", q["name"]))
        elif waiting:
            item.update(
                action="deferred", reason="awaits_publish", detail=waiting[0], via=status[waiting[0]]["publishedBy"]
            )
            t.later.add(("query", q["name"]))
        elif existing is not None and existing["source_id"] != ds_ids[q["dataset"]]:
            # BA-C1 — a query's update cannot move its dataset: blocks under every choice.
            item.update(action="conflict", id=existing["id"], reason="source_differs")
            t.broken.add(("query", q["name"]))
        else:
            try:
                candidate = _install_query(q, ds_ids)
            except (ValidationError, ValueError, TypeError) as exc:
                item.update(action="invalid", reason="check_failed", detail=_check_message(exc))
                t.broken.add(("query", q["name"]))
            else:
                same = existing is not None and _same(
                    candidate, _comparable_query(json.loads(existing["definition_json"]))
                )
                item.update(
                    _decide(
                        t,
                        "query",
                        q["name"],
                        existing,
                        same,
                        on_conflict,
                        lambda: write_query_create(
                            con, workspace_id, q["name"], ds_ids[q["dataset"]], candidate, writer, now
                        ),
                        lambda: write_query_update(con, existing["id"], candidate, writer, now),
                    )
                )
        items.append(item)

    for w in _workflow_order(pack):
        item = {"kind": "workflow", "name": w["name"]}
        refs = _source_refs(w)
        blocked, binds = _readers_state(t, refs)
        existing = _existing(con, "workflow", workspace_id, w["name"])
        if blocked is not None:
            blocked = _own_conflict(
                t,
                blocked,
                existing,
                on_conflict,
                refs,
                lambda: (
                    not _same(
                        _install_workflow(w, t.ids),
                        WorkflowDefinition(**json.loads(existing["definition_json"])).model_dump(),
                    )
                ),
            )
            item.update(blocked)
            (t.later if blocked["action"] == "deferred" else t.broken).add(("workflow", w["name"]))
        else:
            try:
                candidate = _install_workflow(w, t.ids)
            except (ValidationError, ValueError, TypeError) as exc:
                item.update(action="invalid", reason="check_failed", detail=_check_message(exc))
                t.broken.add(("workflow", w["name"]))
            else:
                stored = (
                    WorkflowDefinition(**json.loads(existing["definition_json"])).model_dump() if existing else None
                )
                same = existing is not None and _same(candidate, stored)  # type: ignore[arg-type]
                item.update(
                    _decide(
                        t,
                        "workflow",
                        w["name"],
                        existing,
                        same,
                        on_conflict,
                        lambda: write_workflow_create(
                            con, workspace_id, w["name"], candidate, writer, now, defer_unrun=True
                        ),
                        lambda: write_workflow_update(
                            con, existing["id"], w["name"], candidate, writer, now, defer_unrun=True
                        ),
                    )
                )
                if binds and item["action"] not in ("invalid", "conflict"):
                    item["binds"] = binds
        items.append(item)

    for d in pack["dashboards"]:
        item = {"kind": "dashboard", "name": d["name"]}
        refs = [("query", n) for n in _widget_queries(d)]
        blocked, binds = _readers_state(t, refs)
        existing = _existing(con, "dashboard", workspace_id, d["name"])
        holder = con.execute(
            "SELECT id, name FROM dashboards WHERE workspace_id = ? AND slug = ? AND name <> ?",
            (workspace_id, d["slug"], d["name"]),
        ).fetchone()
        if blocked is not None:
            blocked = _own_conflict(
                t,
                blocked,
                existing,
                on_conflict,
                refs,
                lambda: (
                    existing["slug"] != d["slug"]
                    or not _same(
                        _install_dashboard(d, t.ids),
                        DashboardDefinition(**json.loads(existing["definition_json"])).model_dump(),
                    )
                ),
            )
            item.update(blocked)
            (t.later if blocked["action"] == "deferred" else t.broken).add(("dashboard", d["name"]))
        elif holder is not None:
            if on_conflict == "skip":
                item.update(action="skip", reason="slug_taken", detail=d["slug"])
            else:
                item.update(action="conflict", reason="slug_taken", detail=d["slug"])
                t.broken.add(("dashboard", d["name"]))
        else:
            try:
                candidate = _install_dashboard(d, t.ids)
            except (ValidationError, ValueError, TypeError) as exc:
                item.update(action="invalid", reason="check_failed", detail=_check_message(exc))
                t.broken.add(("dashboard", d["name"]))
            else:
                stored = (
                    DashboardDefinition(**json.loads(existing["definition_json"])).model_dump() if existing else None
                )
                same = (
                    existing is not None and existing["slug"] == d["slug"] and _same(candidate, stored)  # type: ignore[arg-type]
                )
                item.update(
                    _decide(
                        t,
                        "dashboard",
                        d["name"],
                        existing,
                        same,
                        on_conflict,
                        lambda: write_dashboard_create(con, workspace_id, d["name"], d["slug"], candidate, writer, now),
                        lambda: write_dashboard_update(
                            con, existing["id"], d["name"], d["slug"], candidate, writer, now
                        ),
                    )
                )
                if binds and item["action"] not in ("invalid", "conflict"):
                    item["binds"] = binds
        items.append(item)

    counts = {a: 0 for a in ("create", "replace", "unchanged", "skip", "deferred", "conflict", "invalid")}
    for it in items:
        counts[it["action"]] += 1
    ok = (
        all(d["status"] not in ("missing", "columns_differ") for d in datasets)
        and counts["conflict"] == 0
        and counts["invalid"] == 0
    )
    plan = {
        "onConflict": on_conflict,
        "ok": ok,
        "warnings": sum(1 for it in items if it.get("binds")),
        "datasets": datasets,
        "items": items,
        "counts": counts,
    }
    plan["planHash"] = plan_hash(plan)
    return plan


def plan_hash(plan: dict) -> str:
    """BA C10 — the hash of a plan's decisions (not ids, `dryRun`, `applied`)."""
    keys = ("kind", "name", "action", "reason", "detail", "via", "binds")
    return definition_version(
        {
            "onConflict": plan["onConflict"],
            "datasets": [[d["name"], d["status"]] for d in plan["datasets"]],
            "items": [[it.get(k) for k in keys] for it in plan["items"]],
        }
    )


# --- pack form → install form --------------------------------------------------------


def _install_query(q: dict, ds_ids: dict[str, str]) -> dict:
    d = json.loads(json.dumps(q["definition"]))
    rels = []
    for r in d.get("relationships") or []:
        r = dict(r)
        r["leftSourceId"] = ds_ids[r.pop("leftDataset")]
        r["rightSourceId"] = ds_ids[r.pop("rightDataset")]
        rels.append(r)
    if "relationships" in d:
        d["relationships"] = rels
    return QueryDefinition(**d).model_dump()


def _install_workflow(w: dict, ids: dict[str, dict[str, str]]) -> dict:
    d = json.loads(json.dumps(w["definition"]))
    d["sources"] = [ids[kind][ref] for kind, ref in _source_refs(w)]
    return WorkflowDefinition(**d).model_dump()


def _install_dashboard(dash: dict, ids: dict[str, dict[str, str]]) -> dict:
    d = json.loads(json.dumps(dash["definition"]))
    widgets = []
    for w in d.get("widgets") or []:
        w = dict(w)
        if "query" in w:
            w["queryId"] = ids["query"][w.pop("query")]
        widgets.append(w)
    d["widgets"] = widgets
    return DashboardDefinition(**d).model_dump()
