"""R193 (item 3.6b) — saved (frozen) copies and the read-only guard.

A **saved workspace** (`workspaces.kind = 'saved'`) holds frozen copies of its
parent (main) workspace's datasets. It is created on the first save, found by
its parent (never by its name), and nothing inside it can be changed: every
write route asks :func:`read_only_refusal` about **every object it touches**
before writing. Only deleting a copy and deleting the empty saved workspace are
allowed (those routes simply do not ask).

Design: `.agents/design/data-management/workspaces/saved-copies.md`.
"""

from __future__ import annotations

import json
import secrets
import shutil
import sqlite3
import time
from collections.abc import Iterable, Sequence
from pathlib import Path

from fastapi import status
from fastapi.responses import JSONResponse

from app._generated.constants import NAME_LENGTHS
from app.db import get_conn
from app.models.common import ApiErrorReadOnlyWorkspace, Workspace
from app.routers._shared import _is_unique_violation, _now_iso
from app.storage import dataset_dir

SAVED_SUFFIX = "-saved"
LABEL_MAX = 40

# The tables whose rows carry a `workspace_id` a write can touch.
_TABLES = {
    "datasets": "datasets",
    "queries": "queries",
    "workflows": "workflows",
    "dashboards": "dashboards",
    "relationships": "relationships",
}


def workspace_from_row(row: sqlite3.Row) -> Workspace:
    return Workspace(
        id=row["id"],
        name=row["name"],
        kind=row["kind"],
        parentWorkspaceId=row["parent_workspace_id"],
        createdAt=row["created_at"],
    )


def workspace_json(ws: Workspace) -> dict:
    """The wire shape — `parentWorkspaceId` only on a saved workspace."""
    return ws.model_dump(exclude_none=True)


def refusal() -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorReadOnlyWorkspace().model_dump())


def _touched_workspaces(con: sqlite3.Connection, workspaces: Iterable[str | None], by_table: dict) -> set[str]:
    ids = {w for w in workspaces if w}
    for key, values in by_table.items():
        table = _TABLES[key]
        wanted = [v for v in values if v]
        if not wanted:
            continue
        marks = ",".join("?" * len(wanted))
        rows = con.execute(
            f"SELECT workspace_id FROM {table} WHERE id IN ({marks})",  # noqa: S608 — table from a closed map
            wanted,
        ).fetchall()
        ids.update(r["workspace_id"] for r in rows)
    return ids


def read_only_refusal(
    *,
    workspaces: Iterable[str | None] = (),
    con: sqlite3.Connection | None = None,
    **by_table: Iterable[str | None],
) -> JSONResponse | None:
    """`409 read_only_workspace` when any named workspace — or the workspace of
    any named dataset / query / workflow / dashboard / relationship — is a saved
    one; ``None`` otherwise (unknown ids are left to the route's own 404)."""
    unknown = set(by_table) - set(_TABLES)
    if unknown:  # a programming error, never a request error
        raise ValueError(f"read_only_refusal: unknown table(s) {sorted(unknown)}")

    def _check(c: sqlite3.Connection) -> JSONResponse | None:
        ids = _touched_workspaces(c, workspaces, by_table)
        if not ids:
            return None
        marks = ",".join("?" * len(ids))
        hit = c.execute(
            f"SELECT 1 FROM workspaces WHERE kind = 'saved' AND id IN ({marks}) LIMIT 1",  # noqa: S608 — placeholders only
            sorted(ids),
        ).fetchone()
        return refusal() if hit else None

    if con is not None:
        return _check(con)
    with get_conn() as c:
        return _check(c)


# --- naming ----------------------------------------------------------------


def _fit(base: str, suffix: str, limit: int) -> str:
    """`base + suffix`, cutting `base` (never the suffix) to fit `limit`."""
    return base[: max(1, limit - len(suffix))] + suffix


def _saved_workspace_name(con: sqlite3.Connection, main_name: str) -> str:
    limit = NAME_LENGTHS["workspace_max"]
    n = 1
    while True:
        suffix = SAVED_SUFFIX if n == 1 else f"{SAVED_SUFFIX}-{n}"
        name = _fit(main_name, suffix, limit)
        if con.execute("SELECT 1 FROM workspaces WHERE name = ?", (name,)).fetchone() is None:
            return name
        n += 1


def copy_name(original: str, label: str, taken: set[str]) -> str:
    """`<name> @<label>`, then `… v2`, `v3`… — cut to the dataset name limit,
    keeping the label and version suffix."""
    limit = NAME_LENGTHS["dataset_max"]
    n = 1
    while True:
        suffix = f" @{label}" if n == 1 else f" @{label} v{n}"
        name = _fit(original, suffix, limit)
        if name not in taken:
            return name
        n += 1


# --- the saved workspace -----------------------------------------------------


def saved_workspace_for(main: sqlite3.Row) -> tuple[sqlite3.Row, bool]:
    """The main workspace's saved workspace, and whether this call created it —
    created on first use. Found by its parent, so renames of either workspace
    change nothing. A racing first save loses the UNIQUE parent index and reads
    the winner's row."""
    with get_conn() as con:
        row = con.execute("SELECT * FROM workspaces WHERE parent_workspace_id = ?", (main["id"],)).fetchone()
        if row is not None:
            return row, False
        new_id = f"ws_{secrets.token_hex(4)}"
        for _ in range(5):
            name = _saved_workspace_name(con, main["name"])
            try:
                con.execute(
                    "INSERT INTO workspaces (id, name, created_at, kind, parent_workspace_id) "
                    "VALUES (?, ?, ?, 'saved', ?)",
                    (new_id, name, _now_iso(), main["id"]),
                )
                con.commit()
            except sqlite3.IntegrityError as err:
                con.rollback()
                if _is_unique_violation(err, "workspaces.name"):
                    continue  # a name taken in between — try the next suffix
            row = con.execute("SELECT * FROM workspaces WHERE parent_workspace_id = ?", (main["id"],)).fetchone()
            if row is not None:
                return row, row["id"] == new_id
        raise RuntimeError(f"could not create the saved workspace of {main['id']}")


# --- saving ------------------------------------------------------------------


def _copy_files(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def _in_flux(src: Path) -> bool:
    """A refresh / re-publish swap is in progress (or the tree is missing): the
    swap renames the live tree to a ``<id>.bak*`` sibling, moves the staged tree
    in, commits the new version, and only then removes the backup — so while a
    backup exists, the files and the row's version may disagree."""
    return not src.exists() or any(src.parent.glob(f"{src.name}.bak*"))


_SNAPSHOT_ATTEMPTS = 20


def _snapshot(original_id: str, dst: Path) -> sqlite3.Row:
    """Copy the original's files and return the row whose version they hold
    (design S2 — one snapshot). A copy counts only if no swap was in flux
    before or after it, the version did not move across it, and the parquet is
    the same file it was when the copy began; otherwise it is taken again.
    A tree that stays missing (no swap in sight) is refused as unknown."""
    for attempt in range(_SNAPSHOT_ATTEMPTS):
        with get_conn() as con:
            row = con.execute("SELECT * FROM datasets WHERE id = ?", (original_id,)).fetchone()
        if row is None:
            raise LookupError(original_id)
        src = dataset_dir(row["workspace_id"], row["id"])
        if _in_flux(src):
            if not src.parent.exists() or not any(src.parent.glob(f"{src.name}*")):
                raise LookupError(original_id)  # no rows stored and no swap coming
            time.sleep(0.05 * (attempt + 1))
            continue
        parquet = src / "parsed.parquet"
        before = parquet.stat() if parquet.exists() else None
        try:
            _copy_files(src, dst)
        except (FileNotFoundError, shutil.Error):
            continue  # the tree moved under the copy — take it again
        after_stat = parquet.stat() if parquet.exists() else None
        with get_conn() as con:
            after = con.execute("SELECT data_version FROM datasets WHERE id = ?", (original_id,)).fetchone()
        same_file = (before is None and after_stat is None) or (
            before is not None
            and after_stat is not None
            and (before.st_ino, before.st_mtime_ns, before.st_size)
            == (after_stat.st_ino, after_stat.st_mtime_ns, after_stat.st_size)
        )
        if after is not None and after["data_version"] == row["data_version"] and same_file and not _in_flux(src):
            return row
    raise RuntimeError(f"could not take a consistent snapshot of {original_id}")


def save_copies(main: sqlite3.Row, label: str, dataset_ids: Sequence[str]) -> tuple[Workspace, list[sqlite3.Row]]:
    """Freeze ``dataset_ids`` (already checked to belong to ``main``) into its
    saved workspace. All copies or none: files are staged first, then one DB
    transaction inserts every copy and its metadata; any failure removes the
    staged trees."""
    saved, created_saved = saved_workspace_for(main)
    saved_at = _now_iso()
    staged: list[tuple[str, sqlite3.Row]] = []
    created: list[Path] = []
    try:
        for ds_id in dataset_ids:
            copy_id = f"ds_{secrets.token_hex(4)}"
            dst = dataset_dir(saved["id"], copy_id)
            dst.parent.mkdir(parents=True, exist_ok=True)
            created.append(dst)
            staged.append((copy_id, _snapshot(ds_id, dst)))

        with get_conn() as con:
            # IMMEDIATE: the names in use are read under the write lock, so two
            # saves at once queue instead of racing to the same `@label`.
            con.execute("BEGIN IMMEDIATE")
            taken = {r["name"] for r in con.execute("SELECT name FROM datasets WHERE workspace_id = ?", (saved["id"],))}
            for copy_id, orig in staged:
                name = copy_name(orig["name"], label, taken)
                taken.add(name)
                saved_from = {
                    "datasetId": orig["id"],
                    "datasetName": orig["name"],
                    "workspaceId": orig["workspace_id"],
                    "dataVersion": orig["data_version"],
                    "refreshedAt": orig["refreshed_at"] or orig["created_at"],
                    "label": label,
                    "savedAt": saved_at,
                }
                con.execute(
                    "INSERT INTO datasets (id, workspace_id, name, size_bytes, row_count, column_count, "
                    "columns_json, source_format, sheet_name, created_at, refreshed_at, data_version, "
                    "lineage_json, published_workflow_id, saved_from_json) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
                    (
                        copy_id,
                        saved["id"],
                        name,
                        orig["size_bytes"],
                        orig["row_count"],
                        orig["column_count"],
                        orig["columns_json"],
                        orig["source_format"],
                        orig["sheet_name"],
                        saved_at,
                        saved_from["refreshedAt"],
                        orig["data_version"],
                        orig["lineage_json"],
                        json.dumps(saved_from, ensure_ascii=False),
                    ),
                )
                # Metadata goes with it, as it is (S2): the dataset's entries and
                # its columns' (`<ds_id>:<column>` → `<copy_id>:<column>`). R197 —
                # with its anchor, the data version keyed to the copy (ids are
                # `ds_<8 hex>`, so the quoted id is unique in the JSON).
                remap = ('"' + orig["id"] + '"', '"' + copy_id + '"')
                con.execute(
                    "INSERT INTO metadata_entries (kind, noun_id, namespace, md, source, author, written_at, "
                    "definition_version, anchor_json) SELECT kind, ?, namespace, md, source, author, written_at, "
                    "definition_version, replace(anchor_json, ?, ?) FROM metadata_entries "
                    "WHERE kind = 'dataset' AND noun_id = ?",
                    (copy_id, *remap, orig["id"]),
                )
                con.execute(
                    "INSERT INTO metadata_entries (kind, noun_id, namespace, md, source, author, written_at, "
                    "definition_version, anchor_json) SELECT kind, ? || substr(noun_id, ?), namespace, md, source, "
                    "author, written_at, definition_version, replace(anchor_json, ?, ?) FROM metadata_entries "
                    "WHERE kind = 'column' AND substr(noun_id, 1, ?) = ?",
                    (copy_id, len(orig["id"]) + 1, *remap, len(orig["id"]) + 1, orig["id"] + ":"),
                )
            con.commit()
            rows = [con.execute("SELECT * FROM datasets WHERE id = ?", (cid,)).fetchone() for cid, _ in staged]
    except Exception:
        for d in created:
            shutil.rmtree(d, ignore_errors=True)
        if created_saved:  # a refused first save leaves no empty saved workspace behind
            try:
                dataset_dir(saved["id"], "_").parent.rmdir()  # its (empty) tree too
            except OSError:
                pass
            with get_conn() as con:
                con.execute(
                    "DELETE FROM workspaces WHERE id = ? AND NOT EXISTS "
                    "(SELECT 1 FROM datasets WHERE workspace_id = ?)",
                    (saved["id"], saved["id"]),
                )
                con.commit()
        raise
    return workspace_from_row(saved), rows
