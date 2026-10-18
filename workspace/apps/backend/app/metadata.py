"""R180 — read-only metadata on seven noun kinds.

A metadata ENTRY is a writer's statement about one noun (dataset, column,
relationship, query, workflow, dashboard, widget) in one NAMESPACE: a
markdown text (safe subset, may open with YAML frontmatter the server does
not interpret), stamped by the server with who wrote it (`author`, `source`
— from the writing token, never the client), when, and the noun's
`definition_version` at that moment. The UI only reads; a writer who wants to
change an entry writes it again through the API.

Writes are OFF by default: they need a bearer token from
`backend.metadata_tokens` (settings), each limited to a closed list of
namespaces. `system` is reserved for the server and can never be granted.

`definition_version` is a short hash of the part of the noun a note is ABOUT:
the dataset's schema, a column's dtype, a relationship's ends, a query's /
workflow's / dashboard's definition, a widget's own config. When it no longer
matches, the read marks the entry `stale` — "may be out of date" — so a
reader sees that the subject moved after the note was written.

R197 (item 3.8) — the TRIPLE ANCHOR. An entry also records the data behind the
noun (`dataVersions`, a workflow's `runId`), the definitions of the queries
behind a widget or dashboard (`queryVersions`) and the parameter values it was
written under (`params`; `assumedParams` names those the writer did not give).
A read builds the reader's anchor the same way and answers, per entry, `state`:
`other_definition` → `other_period` → `refreshed` → `current`. A deleted noun's
entries move to `metadata_entries_swept` (`sweep`).
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from dataclasses import dataclass

from app import data_versions
from app import params as qparams
from app.markdown_safe import markdown_problems

KINDS = ("dataset", "column", "relationship", "query", "workflow", "dashboard", "widget")
NAMESPACE_RE = re.compile(r"^[a-z][a-z0-9_]{0,31}$")
RESERVED_NAMESPACE = "system"
MAX_BYTES = 64 * 1024
MAX_NAMESPACES_PER_NOUN = 32


@dataclass(frozen=True)
class Noun:
    kind: str
    noun_id: str
    workspace_id: str
    definition_version: str


def _strip_none(v: object) -> object:
    """Drop `None` members recursively. A stored definition is a plain
    `model_dump()` — every optional field the model has ever gained appears as
    `null` — so the hash must see the SHAPE the writer saw, not the model's
    field list at save time (a widget untouched since R179 re-saved under
    R181's model must not read as changed)."""
    if isinstance(v, dict):
        return {k: _strip_none(x) for k, x in v.items() if x is not None}
    if isinstance(v, list):
        return [_strip_none(x) for x in v]
    return v


def _version(payload: object) -> str:
    raw = json.dumps(_strip_none(payload), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


def definition_version(definition: object) -> str:
    """R187 — the public name for a definition's version hash, so a workflow run's
    `definitionHash` (and its sources') is the very value a metadata entry anchors
    to as `definitionVersion` (T-e)."""
    return _version(definition)


def _schema_of(columns_json: str) -> list[dict]:
    return [{"name": c["name"], "dtype": c["dtype"]} for c in json.loads(columns_json)]


def resolve_noun(con: sqlite3.Connection, kind: str, noun_id: str) -> Noun | None:
    """The noun behind (`kind`, `noun_id`) — its workspace and current
    definition version — or None when it does not exist. A column is
    `<ds_id>:<column name>`; a widget is `<dsh_id>:<wdg_id>` (a colon: ids never contain one, and it stays a single path segment)."""
    if kind == "dataset":
        row = con.execute("SELECT workspace_id, columns_json FROM datasets WHERE id = ?", (noun_id,)).fetchone()
        return (
            None if row is None else Noun(kind, noun_id, row["workspace_id"], _version(_schema_of(row["columns_json"])))
        )
    if kind == "column":
        ds_id, sep, name = noun_id.partition(":")
        if not sep or not name:
            return None
        row = con.execute("SELECT workspace_id, columns_json FROM datasets WHERE id = ?", (ds_id,)).fetchone()
        if row is None:
            return None
        col = next((c for c in _schema_of(row["columns_json"]) if c["name"] == name), None)
        return None if col is None else Noun(kind, noun_id, row["workspace_id"], _version(col))
    if kind == "relationship":
        row = con.execute(
            "SELECT workspace_id, left_dataset_id, left_column, right_dataset_id, right_column, cardinality "
            "FROM relationships WHERE id = ?",
            (noun_id,),
        ).fetchone()
        if row is None:
            return None
        ends = {
            k: row[k] for k in ("left_dataset_id", "left_column", "right_dataset_id", "right_column", "cardinality")
        }
        return Noun(kind, noun_id, row["workspace_id"], _version(ends))
    if kind in ("query", "workflow", "dashboard"):
        table = {"query": "queries", "workflow": "workflows", "dashboard": "dashboards"}[kind]
        row = con.execute(f"SELECT workspace_id, definition_json FROM {table} WHERE id = ?", (noun_id,)).fetchone()  # noqa: S608 — table from a closed map
        return (
            None
            if row is None
            else Noun(kind, noun_id, row["workspace_id"], _version(json.loads(row["definition_json"])))
        )
    if kind == "widget":
        dsh_id, sep, wdg_id = noun_id.partition(":")
        if not sep or not wdg_id:
            return None
        row = con.execute("SELECT workspace_id, definition_json FROM dashboards WHERE id = ?", (dsh_id,)).fetchone()
        if row is None:
            return None
        widget = next((w for w in json.loads(row["definition_json"]).get("widgets", []) if w.get("id") == wdg_id), None)
        return None if widget is None else Noun(kind, noun_id, row["workspace_id"], _version(widget))
    return None


def validate_entry(namespace: str, md: str) -> tuple[str, list[str]] | None:
    """`(reason, problems)` when the entry must be refused (422), else None."""
    if not NAMESPACE_RE.match(namespace):
        return ("namespace", [])
    if not md.strip():
        return ("empty", [])
    if len(md.encode("utf-8")) > MAX_BYTES:
        return ("too_large", [])
    problems = markdown_problems(md)
    if problems:
        return ("markdown_unsafe", problems)
    return None


def stored_anchor(row: sqlite3.Row) -> dict:
    """The anchor an entry was written with; an rc.2 entry has the definition only."""
    raw = row["anchor_json"] if "anchor_json" in row.keys() else None
    return json.loads(raw) if raw else {"definitionVersion": row["definition_version"]}


def _differs(a: dict | None, b: dict | None) -> bool:
    """A key both maps carry with different values (keys only one side has are
    not compared: a reader without a value for a parameter, a dataset a query
    no longer reads — the definition rule already speaks for the latter)."""
    if not a or not b:
        return False
    return any(k in b and b[k] != v for k, v in a.items())


def state_of(written: dict, current: dict, *, legacy: bool = False) -> str:
    """D4 — how the reader's view relates to the writer's (first rule wins). A
    ``legacy`` (rc.2) entry recorded the definition only, so nothing else of it
    is compared; an R197 entry without a run (written before the first run)
    reads ``refreshed`` once there is one (code review P1-2)."""
    wq, cq = written.get("queryVersions"), current.get("queryVersions")
    if (
        written.get("definitionVersion") != current.get("definitionVersion")
        or _differs(wq, cq)
        # A query the entry was about is gone from the reader's view (P2-2).
        or (wq is not None and any(k not in (cq or {}) for k in wq))
    ):
        return "other_definition"
    if legacy:
        return "current"
    if _differs(written.get("params"), current.get("params")):
        return "other_period"
    if _differs(written.get("dataVersions"), current.get("dataVersions")) or (
        written.get("runId") != current.get("runId")
    ):
        return "refreshed"
    return "current"


def entry_dict(row: sqlite3.Row, current: dict) -> dict:
    """A stored entry as the API returns it (camelCase; `stale` and `state`
    computed now against the reader's anchor `current`)."""
    anchor = stored_anchor(row)
    legacy = not ("anchor_json" in row.keys() and row["anchor_json"])
    return {
        "md": row["md"],
        "source": row["source"],
        "author": row["author"],
        "writtenAt": row["written_at"],
        "definitionVersion": row["definition_version"],
        "stale": row["definition_version"] != current["definitionVersion"],
        "anchor": anchor,
        "state": state_of(anchor, current, legacy=legacy),
    }


def entries_for(con: sqlite3.Connection, noun: Noun, current: dict) -> dict[str, dict]:
    rows = con.execute(
        "SELECT * FROM metadata_entries WHERE kind = ? AND noun_id = ? ORDER BY namespace",
        (noun.kind, noun.noun_id),
    ).fetchall()
    return {r["namespace"]: entry_dict(r, current) for r in rows}


def children_for(
    con: sqlite3.Connection, noun: Noun, viewer: dict | None
) -> tuple[dict[str, dict[str, dict]], dict[str, dict]] | None:
    """A dataset's columns and a dashboard's widgets carry their own entries;
    the parent's read returns them keyed by column name / widget id so one
    request serves a page, with each child's anchor for this reader. Other
    kinds have no children (None)."""
    if noun.kind == "dataset":
        child_kind, prefix = "column", noun.noun_id + ":"
    elif noun.kind == "dashboard":
        child_kind, prefix = "widget", noun.noun_id + ":"
    else:
        return None
    rows = con.execute(
        "SELECT * FROM metadata_entries WHERE kind = ? AND noun_id LIKE ? ESCAPE '\\' ORDER BY noun_id, namespace",
        (child_kind, prefix.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"),
    ).fetchall()
    out: dict[str, dict[str, dict]] = {}
    currents: dict[str, dict] = {}
    for r in rows:
        child_id = r["noun_id"][len(prefix) :]
        if child_id not in currents:
            child = resolve_noun(con, child_kind, r["noun_id"])
            if child is None:
                continue  # a column gone after a refresh: kept (it may come back), not shown
            currents[child_id] = anchor_for(con, child, viewer, strict=False)[0]
        if child_id in currents:
            out.setdefault(child_id, {})[r["namespace"]] = entry_dict(r, currents[child_id])
    return out, currents


# --- R197 (3.8) the anchor ------------------------------------------------------


def _widget_viewer(definition: dict, widget_id: str, viewer: dict | None) -> dict:
    """The viewer values that reach one widget: those of the param controls
    targeting it (the dashboard rule, R195)."""
    if not viewer:
        return {}
    out: dict = {}
    for c in definition.get("controls") or []:
        if c.get("kind") != "param":
            continue
        t = c.get("targets")
        if (t == "all" or (isinstance(t, list) and widget_id in t)) and c.get("param") in viewer:
            out[c["param"]] = viewer[c["param"]]
    return out


def _query_part(
    con: sqlite3.Connection, query_id: str, viewer: dict | None, dashboard: dict | None, strict: bool
) -> tuple[str, dict, dict, list[str]] | None:
    """(definition hash, data versions, resolved values, assumed names) of a saved
    query, or None when it no longer exists. Raises ``ParamError`` when strict."""
    row = con.execute("SELECT id, workspace_id, definition_json FROM queries WHERE id = ?", (query_id,)).fetchone()
    if row is None:
        return None
    definition = json.loads(row["definition_json"])
    values, resolved = qparams.resolve(definition, viewer=viewer, dashboard=dashboard, strict=strict)
    assumed = sorted(n for n, r in resolved.items() if r["source"] != "viewer")
    return (
        _version(definition),
        data_versions.query_versions(con, row["id"], row["workspace_id"]),
        values,
        assumed,
    )


def _saved_for_widget(definition: dict, widget_id: str) -> dict:
    out: dict = {}
    for c in definition.get("controls") or []:
        if c.get("kind") != "param" or c.get("saved") is None:
            continue
        t = c.get("targets")
        if t == "all" or (isinstance(t, list) and widget_id in t):
            out.setdefault(c.get("param"), c["saved"])
    return out


def anchor_for(con: sqlite3.Connection, noun: Noun, viewer: dict | None, *, strict: bool) -> tuple[dict, list[str]]:
    """D2 — the noun's anchor now, under ``viewer`` values, and the names of the
    parameters that took a saved or default value (not the viewer's). A write is
    ``strict`` (``ParamError`` on a missing / wrong-typed value); a read is not."""
    anchor: dict = {"definitionVersion": noun.definition_version}
    assumed: list[str] = []
    kind = noun.kind
    if kind in ("dataset", "column"):
        ds_id = noun.noun_id.partition(":")[0]
        anchor["dataVersions"] = data_versions.versions(con, [ds_id])
    elif kind == "relationship":
        row = con.execute(
            "SELECT left_dataset_id, right_dataset_id FROM relationships WHERE id = ?", (noun.noun_id,)
        ).fetchone()
        if row is not None:  # deleted since it resolved: the bare anchor (CR P2-4)
            anchor["dataVersions"] = data_versions.versions(
                con, sorted({row["left_dataset_id"], row["right_dataset_id"]})
            )
    elif kind == "workflow":
        row = con.execute("SELECT run_id FROM workflows WHERE id = ?", (noun.noun_id,)).fetchone()
        if row is not None and row["run_id"]:
            anchor["runId"] = row["run_id"]
    elif kind == "query":
        part = _query_part(con, noun.noun_id, viewer, None, strict)
        if part is not None:
            _h, dv, values, assumed = part
            anchor["dataVersions"] = dv
            if values:
                anchor["params"] = values
    elif kind == "widget":
        dsh_id, _sep, wdg_id = noun.noun_id.partition(":")
        drow = con.execute("SELECT definition_json FROM dashboards WHERE id = ?", (dsh_id,)).fetchone()
        definition = json.loads(drow["definition_json"]) if drow is not None else {}
        widget = next((w for w in definition.get("widgets") or [] if w.get("id") == wdg_id), {})
        if widget.get("queryId"):
            part = _query_part(
                con,
                widget["queryId"],
                _widget_viewer(definition, wdg_id, viewer),
                _saved_for_widget(definition, wdg_id),
                strict,
            )
            if part is not None:
                qhash, dv, values, assumed = part
                anchor["queryVersions"] = {widget["queryId"]: qhash}
                anchor["dataVersions"] = dv
                if values:
                    anchor["params"] = values
    elif kind == "dashboard":
        anchor.update(_dashboard_anchor(con, noun.noun_id, viewer, strict, assumed))
    if not anchor.get("dataVersions"):
        anchor.pop("dataVersions", None)
    return anchor, sorted(set(assumed))


def _dashboard_anchor(
    con: sqlite3.Connection, dsh_id: str, viewer: dict | None, strict: bool, assumed: list[str]
) -> dict:
    """A dashboard: every widget's query (hash + data) and, BA contract-exit
    P0-2, the values of its param CONTROLS as the bar shows them (viewer →
    saved → the first targeted query's default), typed by that query's
    declaration. A control with no value at any level is left out — a
    dashboard note does not need every widget bound (P2-1)."""
    drow = con.execute("SELECT definition_json FROM dashboards WHERE id = ?", (dsh_id,)).fetchone()
    if drow is None:  # deleted since it resolved (CR P2-4)
        return {}
    definition = json.loads(drow["definition_json"])
    widgets = definition.get("widgets") or []
    qvers: dict[str, str] = {}
    dvs: dict[str, int] = {}
    decl_of: dict[str, list[tuple[str, dict]]] = {}  # widget id → [(param name, decl)]
    for w in widgets:
        qid = w.get("queryId")
        if not qid or qid in qvers:
            continue
        row = con.execute("SELECT workspace_id, definition_json FROM queries WHERE id = ?", (qid,)).fetchone()
        if row is None:
            continue
        qdef = json.loads(row["definition_json"])
        qvers[qid] = _version(qdef)
        dvs.update(data_versions.query_versions(con, qid, row["workspace_id"]))
    for w in widgets:
        qid = w.get("queryId")
        row = con.execute("SELECT definition_json FROM queries WHERE id = ?", (qid,)).fetchone() if qid else None
        if row is not None:
            decls = qparams.declared(json.loads(row["definition_json"]))
            decl_of[w.get("id")] = list(decls.items())
    values: dict = {}
    for c in definition.get("controls") or []:
        if c.get("kind") != "param":
            continue
        name = c.get("param")
        t = c.get("targets")
        targets = [w.get("id") for w in widgets] if t == "all" else list(t or [])
        decl = next((d for wid in targets for n, d in decl_of.get(wid, []) if n == name), None)
        if decl is None or name in values:
            continue
        ptype = decl["type"]
        for source, raw, relative in (
            ("viewer", (viewer or {}).get(name), False),
            ("dashboard", c.get("saved"), True),
            ("default", decl.get("default"), True),
        ):
            if raw is None or raw == "":
                continue
            try:
                values[name] = qparams.coerce(ptype, raw, allow_relative=relative)
            except (ValueError, TypeError):
                if source == "viewer":
                    if strict:
                        raise qparams.ParamError(
                            "param_invalid", name, label=decl.get("label"), expected=ptype, source="viewer"
                        ) from None
                    break  # a reader's bad value: not compared (QA P2-1)
                continue
            if source != "viewer":
                assumed.append(name)
            break
    out: dict = {}
    if qvers:
        out["queryVersions"] = qvers
    if dvs:
        out["dataVersions"] = dict(sorted(dvs.items()))
    if values:
        out["params"] = values
    return out


# --- R197 (3.8) the cascade -----------------------------------------------------

# Keep identical to alembic/versions/0010_metadata_anchor.py `_ORPHAN_WHERE`.
ORPHAN_WHERE = """
    (kind = 'dataset' AND noun_id NOT IN (SELECT id FROM datasets))
 OR (kind = 'column' AND substr(noun_id, 1, instr(noun_id, ':') - 1) NOT IN (SELECT id FROM datasets))
 OR (kind = 'relationship' AND noun_id NOT IN (SELECT id FROM relationships))
 OR (kind = 'query' AND noun_id NOT IN (SELECT id FROM queries))
 OR (kind = 'workflow' AND noun_id NOT IN (SELECT id FROM workflows))
 OR (kind = 'dashboard' AND noun_id NOT IN (SELECT id FROM dashboards))
 OR (kind = 'widget' AND NOT EXISTS (
        SELECT 1 FROM dashboards d, json_each(d.definition_json, '$.widgets') w
         WHERE d.id = substr(metadata_entries.noun_id, 1, instr(metadata_entries.noun_id, ':') - 1)
           AND json_extract(w.value, '$.id') = substr(metadata_entries.noun_id, instr(metadata_entries.noun_id, ':') + 1)))
"""

_COLS = "kind, noun_id, namespace, md, source, author, written_at, definition_version, anchor_json"


def sweep(con: sqlite3.Connection, now: str) -> int:
    """D5 — move every entry whose noun is gone to ``metadata_entries_swept``
    (archived, not dropped). A column that left its dataset in a refresh is NOT
    swept (BA P1-1: it may come back next week); only a deleted dataset takes
    its columns' entries. Runs inside the caller's transaction; returns the
    number moved."""
    con.execute(
        f"INSERT INTO metadata_entries_swept ({_COLS}, swept_at) "  # noqa: S608 — constants only
        f"SELECT {_COLS}, ? FROM metadata_entries WHERE {ORPHAN_WHERE}",
        (now,),
    )
    cur = con.execute(f"DELETE FROM metadata_entries WHERE {ORPHAN_WHERE}")  # noqa: S608 — constants only
    return cur.rowcount
