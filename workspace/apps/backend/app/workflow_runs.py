"""R187 (W-7) — workflow run stamps and staleness.

A workflow is a materialized view with manual refresh (R174 noun-map). Before
R187 its output outlived its sources silently: a source deleted, edited or
refreshed after the run left the output reading as healthy (W-7), and nothing
recorded which data a run had read (W-4).

At run, `stamp_sources` records, per source, what the run read:

- a saved query (`qr_`) — its definition hash (the R180 `definition_version`) and
  the `dataVersion` (R185) of every leaf dataset it reads;
- a workflow output (`wf_`) — that workflow's `runId`.

On read, `stale_sources` compares the stamp with the database NOW — metadata
lookups only, no data scanned — and names each source that moved:

- `source_missing`     — the source (or a leaf dataset) no longer exists, or a
                          workflow source has no output any more;
- `definition_changed` — the source query's definition changed;
- `data_refreshed`     — a leaf dataset was refreshed (its `dataVersion` moved);
- `source_rerun`       — a workflow source was run again.

A flag, never a block: the stale output stays readable (an archive is a feature,
R174), and re-running is the remedy.
"""

from __future__ import annotations

import json
import secrets
import sqlite3

from app import params as qparams
from app.metadata import definition_version
from app import data_versions


def new_run_id() -> str:
    return f"run_{secrets.token_hex(4)}"


def stamp_sources(con: sqlite3.Connection, sources: list[str], workspace_id: str) -> list[dict]:
    """What each source IS at run time. Called after a successful consolidation, so
    every source resolves."""
    out: list[dict] = []
    for src in sources:
        if src.startswith("wf_"):
            row = con.execute("SELECT run_id FROM workflows WHERE id = ?", (src,)).fetchone()
            entry: dict = {"id": src}
            if row is not None and row["run_id"] is not None:
                entry["runId"] = row["run_id"]
            out.append(entry)
            continue
        qrow = con.execute("SELECT definition_json FROM queries WHERE id = ?", (src,)).fetchone()
        versions = data_versions.query_versions(con, src, workspace_id)
        entry = {
            "id": src,
            "definitionHash": definition_version(json.loads(qrow["definition_json"])) if qrow else "",
            "dataVersions": versions,
        }
        # R194 (D6) — the values the source's used parameters ran with (defaults;
        # resolution already succeeded in the consolidation this stamp follows).
        if qrow:
            try:
                used_params, _resolved = qparams.resolve(json.loads(qrow["definition_json"]))
            except qparams.ParamError:
                used_params = {}
            if used_params:
                entry["params"] = used_params
        out.append(entry)
    return out


def _name(con: sqlite3.Connection, src: str) -> str | None:
    table = "queries" if src.startswith("qr_") else "workflows"
    row = con.execute(f"SELECT name FROM {table} WHERE id = ?", (src,)).fetchone()  # noqa: S608 — fixed table names
    return row["name"] if row is not None else None


def stale_sources(con: sqlite3.Connection, run: dict) -> list[dict]:
    """The sources that moved since the run, one reason each (the first that
    applies, in the order missing → definition → data / rerun)."""
    out: list[dict] = []
    for s in run.get("sources", []):
        src = s["id"]
        reason = _reason(con, s)
        if reason is not None:
            entry = {"sourceId": src, "reason": reason}
            name = _name(con, src)
            if name is not None:
                entry["name"] = name
            out.append(entry)
    return out


def _reason(con: sqlite3.Connection, s: dict) -> str | None:
    src = s["id"]
    if src.startswith("wf_"):
        row = con.execute("SELECT run_id FROM workflows WHERE id = ?", (src,)).fetchone()
        if row is None or row["run_id"] is None:
            return "source_missing"
        return "source_rerun" if row["run_id"] != s.get("runId") else None
    qrow = con.execute("SELECT definition_json FROM queries WHERE id = ?", (src,)).fetchone()
    if qrow is None:
        return "source_missing"
    if definition_version(json.loads(qrow["definition_json"])) != s.get("definitionHash"):
        return "definition_changed"
    for ds_id, version in (s.get("dataVersions") or {}).items():
        drow = con.execute("SELECT data_version FROM datasets WHERE id = ?", (ds_id,)).fetchone()
        if drow is None:
            return "source_missing"
        if drow["data_version"] != version:
            return "data_refreshed"
    return None
