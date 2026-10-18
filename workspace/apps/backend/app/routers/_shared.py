"""Shared helpers for the router layer (R106).

These helpers used to live on individual routers, which forced routers to
import each other (``queries`` ← ``relationships._dtype_of`` / ``_compatible``,
``workspaces._is_unique_violation``, ``datasets.RowsPage``; ``datasets`` ←
``uploads._load_meta`` / ``workspaces._is_unique_violation``). R106 relocates
them here so each router depends on a shared module instead of on its peers.

Behavior-preserving move — no logic change; names keep their leading underscore
so existing call sites are unchanged. DB access stays the caller's concern
(passed connections); this module holds only the small cross-router primitives.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict

from app.models.common import Column, Dataset, DatasetLineage
from app.storage import temp_upload_dir

# --- UTC timestamp (was duplicated across all CRUD routers) ----------------


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --- dtype join-compatibility (was relationships.py) -----------------------

_NUMERIC = {"integer", "float"}


def _dtype_of(columns_meta: list[dict], col_name: str) -> str | None:
    for c in columns_meta:
        if c["name"] == col_name:
            return c["dtype"]
    return None


def _compatible(left: str | None, right: str | None) -> bool:
    """J-4 — equal dtypes join, with integer/float numeric cross-compatible."""
    if left is None or right is None:
        return False
    if left == right:
        return True
    return left in _NUMERIC and right in _NUMERIC


# --- sqlite integrity-error mapping (was workspaces.py) --------------------


def _is_unique_violation(err: sqlite3.IntegrityError, table_index_substr: str) -> bool:
    """SQLite IntegrityError message names the violated index, e.g.
    'UNIQUE constraint failed: workspaces.name'."""
    return table_index_substr in str(err)


# --- temp-upload metadata (was uploads.py) ---------------------------------


def _load_meta(temp_id: str) -> dict | None:
    meta_path = temp_upload_dir(temp_id) / "meta.json"
    if not meta_path.exists():
        return None
    return json.loads(meta_path.read_text())


# --- paged rows response model (was datasets.py) ---------------------------


class RowsPage(BaseModel):
    """Response shape for GET /datasets/{id}/rows. Mirrors the inline
    RowsPage schema in workspace/packages/contracts/datasets/rows-get.contract.yaml.
    `additionalProperties: false` per the R16 conformance pattern."""

    model_config = ConfigDict(extra="forbid")

    rows: list[list[str | None]]
    page: int
    # R72: the page-size set is now centralized + extensible (PAGE_SIZES); the
    # route validates the value against it, so the echoed field is a plain int
    # (a Literal would re-hardcode the set the centralization just removed).
    pageSize: int
    total: int


# R192 — moved from `datasets` (R106 pattern): the workflow publish route reads
# a dataset row back and carries the `hidden` hint like a refresh does.
def _dataset_from_row(row) -> Dataset:  # type: ignore[no-untyped-def]
    """Hydrate a Dataset from a SQLite row — used by list + detail GETs."""
    return Dataset(
        id=row["id"],
        workspaceId=row["workspace_id"],
        name=row["name"],
        sizeBytes=row["size_bytes"],
        rowCount=row["row_count"],
        columnCount=row["column_count"],
        columns=[Column(**c) for c in json.loads(row["columns_json"])],
        sourceFormat=row["source_format"],
        sheetName=row["sheet_name"],
        createdAt=row["created_at"],
        # R185 — `refreshed_at` is backfilled by 0006 and set on every write;
        # the fallback only covers a row written between the two.
        refreshedAt=row["refreshed_at"] or row["created_at"],
        dataVersion=row["data_version"],
        # R192 — a published dataset's server-written lineage (NULL on uploads).
        lineage=DatasetLineage(**json.loads(row["lineage_json"])) if row["lineage_json"] else None,
    )


def _carry_forward_hidden(
    cols: list[dict[str, str]], prev_columns: list[dict[str, str]], *, ignore: set[str] | None = None
) -> None:
    """R152 — re-apply the `hidden` view-hint (in place) onto freshly re-parsed
    `cols` after a refresh. Match by name: a column still present keeps its
    hint, a column gone/renamed drops it, a new column stays visible. A dtype
    change is not a mismatch. Presentation-only — never touches the parquet.

    R158 — ``ignore`` drops names whose prior hint must NOT carry forward: on a
    provenance RENAME collision the old provenance name is now the incoming
    file's USER column, so its (system) hidden hint should not stick to it (the
    hint follows provenance to the new suffixed name, hidden-by-default there)."""
    prev_hidden = {c["name"] for c in prev_columns if c.get("hidden")} - (ignore or set())
    for c in cols:
        if c["name"] in prev_hidden:
            c["hidden"] = True
