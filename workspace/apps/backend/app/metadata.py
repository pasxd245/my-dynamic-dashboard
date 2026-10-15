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
reader sees that the subject moved after the note was written. (Data
refreshes do not move it; anchoring a note to data version / run and to view
parameters is a later round.)
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from dataclasses import dataclass

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


def entry_dict(row: sqlite3.Row, current_version: str) -> dict:
    """A stored entry as the API returns it (camelCase; `stale` computed now)."""
    return {
        "md": row["md"],
        "source": row["source"],
        "author": row["author"],
        "writtenAt": row["written_at"],
        "definitionVersion": row["definition_version"],
        "stale": row["definition_version"] != current_version,
    }


def entries_for(con: sqlite3.Connection, noun: Noun) -> dict[str, dict]:
    rows = con.execute(
        "SELECT * FROM metadata_entries WHERE kind = ? AND noun_id = ? ORDER BY namespace",
        (noun.kind, noun.noun_id),
    ).fetchall()
    return {r["namespace"]: entry_dict(r, noun.definition_version) for r in rows}


def children_for(con: sqlite3.Connection, noun: Noun) -> dict[str, dict[str, dict]] | None:
    """A dataset's columns and a dashboard's widgets carry their own entries;
    the parent's read returns them keyed by column name / widget id so one
    request serves a page. Other kinds have no children (None)."""
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
    for r in rows:
        child_id = r["noun_id"][len(prefix) :]
        child = resolve_noun(con, child_kind, r["noun_id"])
        if child is None:
            continue  # the column / widget is gone; its entries are unreadable until swept
        out.setdefault(child_id, {})[r["namespace"]] = entry_dict(r, child.definition_version)
    return out
