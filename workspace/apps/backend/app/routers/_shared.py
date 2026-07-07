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


class ColumnProfile(BaseModel):
    """R154 — per-column stats in GET /datasets/{id}/profile. Predictable
    shape: every field present, null where the stat doesn't apply to the
    dtype. Mirrors profile-get.contract.yaml. min/max/sample stringified
    like the rows payload (schema-free wire)."""

    model_config = ConfigDict(extra="forbid")

    name: str
    dtype: str
    # date/datetime display pattern from commitSettings; None if no override.
    format: str | None = None
    nullCount: int
    nullPct: float
    distinctCount: int
    # numeric/date/datetime only (stringified); None otherwise.
    min: str | None = None
    max: str | None = None
    # top-k sample values for string columns; None otherwise.
    sample: list[str | None] | None = None


class DatasetProfile(BaseModel):
    """R154 — response shape for GET /datasets/{id}/profile. On-demand DuckDB
    profile; read-only compute (never writes the parquet). Mirrors
    workspace/packages/contracts/datasets/profile-get.contract.yaml."""

    model_config = ConfigDict(extra="forbid")

    datasetId: str
    rowCount: int
    # True when computed on a sample, not a full scan.
    approx: bool
    # Rows scanned when approx; None on a full scan.
    sampledRows: int | None = None
    columns: list[ColumnProfile]
