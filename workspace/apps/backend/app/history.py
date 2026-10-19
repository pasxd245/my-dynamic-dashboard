"""R200 (item 4.4) — the definition history of queries, dashboards and workflows.

One row per DEFINITION change, written by the route that makes the change, on
the same connection and before its one `commit` — so a refused or rolled-back
save leaves no row, and a landed change always has its row
(`design/data-management/_shared/definition-history.md`).

- `record` — create (`#1 create`) and `record_if_changed` — a PUT whose
  definition hashes differently from the stored one (`#n+1 update`). A rename or
  an unchanged re-save writes nothing. `version` is `definition_version` — the
  value a metadata note records as `definitionVersion` (decision 14).
- `writer_of` — `(author, source)` of the writer token the request carried, or
  `(None, None)`. It labels a change; it never refuses one.
- `sweep` — a deleted noun's rows go in the deleting transaction (called next to
  every `metadata.sweep`).
- `entries` / `version_row` — the reads (`ORDER BY seq DESC`, explicit).
- `source_changed_since` — BA-C2: a query version whose source datasets were
  refreshed after it was saved (its filters address columns by index).
"""

from __future__ import annotations

import json
import sqlite3

from app.metadata import definition_version, token_for

KINDS: dict[str, str] = {"query": "queries", "dashboard": "dashboards", "workflow": "workflows"}

# Rows whose noun is gone. Constants only (the three tables are a closed map).
ORPHAN_WHERE = """
    (kind = 'query' AND noun_id NOT IN (SELECT id FROM queries))
 OR (kind = 'dashboard' AND noun_id NOT IN (SELECT id FROM dashboards))
 OR (kind = 'workflow' AND noun_id NOT IN (SELECT id FROM workflows))
"""

_ENTRY_COLS = "seq, version, change, changed_at, changed_by, changed_source"


def writer_of(authorization: str | None) -> tuple[str | None, str | None]:
    """`(author, source)` of the configured writer token the header names, else
    `(None, None)` — no header, a malformed one, an unknown token."""
    tok = token_for(authorization)
    return (None, None) if tok is None else (tok.author, tok.source)


def record(
    con: sqlite3.Connection,
    kind: str,
    noun_id: str,
    definition_json: str,
    change: str,
    writer: tuple[str | None, str | None],
    now: str,
) -> None:
    """Append the next row (`seq = MAX(seq) + 1` for the noun, in one statement)
    inside the caller's transaction. The caller has already written the noun, so
    SQLite's write lock is held and two writers cannot take the same `seq` (the
    primary key would refuse it anyway)."""
    assert kind in KINDS  # noqa: S101 — a closed map, checked by the CHECK too
    author, source = writer
    con.execute(
        "INSERT INTO definition_history "
        "(kind, noun_id, seq, version, definition_json, change, changed_at, changed_by, changed_source) "
        "SELECT ?, ?, COALESCE(MAX(seq), 0) + 1, ?, ?, ?, ?, ?, ? "
        "FROM definition_history WHERE kind = ? AND noun_id = ?",
        (
            kind,
            noun_id,
            definition_version(json.loads(definition_json)),
            definition_json,
            change,
            now,
            author,
            source,
            kind,
            noun_id,
        ),
    )


def record_if_changed(
    con: sqlite3.Connection,
    kind: str,
    noun_id: str,
    old_definition_json: str,
    new_definition_json: str,
    writer: tuple[str | None, str | None],
    now: str,
) -> bool:
    """`#n+1 update` when the definition's VERSION moved (a rename, a re-save of
    the same definition, even with `null` members spelled out, writes nothing)."""
    if definition_version(json.loads(old_definition_json)) == definition_version(json.loads(new_definition_json)):
        return False
    record(con, kind, noun_id, new_definition_json, "update", writer, now)
    return True


def sweep(con: sqlite3.Connection) -> int:
    """Delete every row whose noun is gone, inside the caller's transaction."""
    cur = con.execute(f"DELETE FROM definition_history WHERE {ORPHAN_WHERE}")  # noqa: S608 — constants only
    return cur.rowcount


def current_version(con: sqlite3.Connection, kind: str, noun_id: str) -> str | None:
    """The noun's definition version now, or None when it does not exist."""
    row = con.execute(f"SELECT definition_json FROM {KINDS[kind]} WHERE id = ?", (noun_id,)).fetchone()  # noqa: S608 — table from a closed map
    return None if row is None else definition_version(json.loads(row["definition_json"]))


def _entry(row: sqlite3.Row) -> dict:
    return {
        "seq": row["seq"],
        "version": row["version"],
        "change": row["change"],
        "changedAt": row["changed_at"],
        "changedBy": row["changed_by"],
        "changedSource": row["changed_source"],
    }


def entries(con: sqlite3.Connection, kind: str, noun_id: str) -> list[dict]:
    """The noun's rows, newest first by `seq` (an explicit order, never time)."""
    rows = con.execute(
        f"SELECT {_ENTRY_COLS} FROM definition_history WHERE kind = ? AND noun_id = ? ORDER BY seq DESC",  # noqa: S608 — constants only
        (kind, noun_id),
    ).fetchall()
    return [_entry(r) for r in rows]


def version_row(
    con: sqlite3.Connection, kind: str, noun_id: str, version: str, seq: int | None = None
) -> tuple[dict, dict] | None:
    """The newest row with that version — or, with `seq`, that row when it carries
    the version — as `(entry, stored definition)`, else None. A restored version
    occurs more than once; `seq` names the row the reader clicked, so its own
    `changedAt` is the one `source_changed_since` compares (R200 visual gate)."""
    where = "WHERE kind = ? AND noun_id = ? AND version = ?"
    args: tuple = (kind, noun_id, version)
    if seq is not None:
        where += " AND seq = ?"
        args = (*args, seq)
    row = con.execute(
        f"SELECT {_ENTRY_COLS}, definition_json FROM definition_history {where} ORDER BY seq DESC LIMIT 1",  # noqa: S608 — constants only
        args,
    ).fetchone()
    if row is None:
        return None
    return _entry(row), json.loads(row["definition_json"])


def _source_ids(source_id: str, definition: dict) -> set[str]:
    """The sources a STORED query definition reads: its driving source and both
    ends of each join's query-owned relationship (`ds_` or `qr_`). Structural —
    an old definition need not resolve today."""
    ids = {source_id}
    rels = {r.get("id"): r for r in definition.get("relationships") or [] if isinstance(r, dict)}
    joins = definition.get("joins") or ([definition["join"]] if definition.get("join") else [])
    for step in joins:
        rel = rels.get(step.get("queryRelId")) if isinstance(step, dict) else None
        if rel is not None:
            ids.update(i for i in (rel.get("leftSourceId"), rel.get("rightSourceId")) if i)
    return ids


def _leaf_datasets(con: sqlite3.Connection, ids: set[str], seen: set[str]) -> set[str]:
    """`ds_` ids, a `qr_` counted through ITS current definition's sources."""
    out: set[str] = set()
    for i in ids:
        if i.startswith("ds_"):
            out.add(i)
        elif i.startswith("qr_") and i not in seen:
            seen.add(i)
            row = con.execute("SELECT source_id, definition_json FROM queries WHERE id = ?", (i,)).fetchone()
            if row is not None:
                out |= _leaf_datasets(con, _source_ids(row["source_id"], json.loads(row["definition_json"])), seen)
    return out


def source_changed_since(con: sqlite3.Connection, query_id: str, definition: dict, entry: dict) -> bool:
    """BA-C2 — did a dataset this stored query definition reads change after the
    row was saved? A filter addresses its column by 0-based index and a refresh
    that drops or adds a column only warns, so restoring a pre-refresh version can
    validate and read another column. True when a source dataset's `refreshed_at`
    is not earlier than the row's `changed_at` (a same-second tie warns); for a `baseline` row (written time
    unknown) when one was ever refreshed (`data_version > 1`); when one no longer
    exists."""
    qrow = con.execute("SELECT source_id FROM queries WHERE id = ?", (query_id,)).fetchone()
    if qrow is None:
        return False
    ds_ids = _leaf_datasets(con, _source_ids(qrow["source_id"], definition), {query_id})
    for ds_id in sorted(ds_ids):
        ds = con.execute("SELECT refreshed_at, data_version FROM datasets WHERE id = ?", (ds_id,)).fetchone()
        if ds is None:
            return True
        if entry["change"] == "baseline":
            if ds["data_version"] > 1:
                return True
        # CR-2 — `>=`: times have one-second resolution, so a refresh in the same
        # second as the save may have come after it; warn on a tie.
        elif ds["refreshed_at"] is not None and ds["refreshed_at"] >= entry["changedAt"]:
            return True
    return False
