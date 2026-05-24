"""Datasets router — R16 implementation against R15's locked contracts.

Two endpoints:

- ``POST /workspaces/{id}/datasets/batch`` — atomic batch commit.
- ``GET /datasets[?workspace_id=…]`` — list, most-recent-first.

Commit strategy: parse + validate every item up front (fail fast →
409 / 422), then write each dataset's filesystem tree under a
per-dataset directory. Only after all writes succeed does the SQLite
transaction commit. On any failure, rmtree all per-dataset trees we
created so the filesystem matches the (rolled-back) DB state.
"""

from __future__ import annotations

import json
import secrets
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from app.db import get_conn
from app.ingest.csv_parser import parse_csv
from app.ingest.excel_parser import parse_sheet
from app.models.common import (
    Column,
    ColumnOverride,
    Dataset,
    ParseOptions,
)
from app.routers.uploads import _load_meta
from app.storage import dataset_dir, temp_upload_dir


router = APIRouter(tags=["datasets"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_ds_id() -> str:
    return f"ds_{secrets.token_hex(4)}"


class _BatchItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sheet: Annotated[str, Field(min_length=1)] | None = None
    name: Annotated[str, Field(min_length=1, max_length=120)]
    parse_options: ParseOptions | None = None
    column_overrides: dict[str, ColumnOverride] | None = None
    excluded_columns: list[str] | None = None
    target_dataset_id: Annotated[str, Field(pattern=r"^ds_[0-9a-f]{8}$")] | None = None


class _BatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    temp_id: Annotated[str, Field(pattern=r"^tmp_[0-9a-f]{16}$")]
    items: Annotated[list[_BatchItem], Field(min_length=1)]


def _apply_overrides(
    columns: list[dict[str, str]],
    overrides: dict[str, ColumnOverride] | None,
) -> list[dict[str, str]]:
    if not overrides:
        return columns
    by_name = {c["name"]: c for c in columns}
    missing = [name for name in overrides if name not in by_name]
    if missing:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "unknown_column",
                "detail": f"column_overrides references missing column(s): {', '.join(missing)}",
            },
        )
    out: list[dict[str, str]] = []
    for col in columns:
        ov = overrides.get(col["name"])
        if ov is None:
            out.append(col)
        else:
            if ov.dtype in ("date", "datetime") and not ov.format:
                raise HTTPException(
                    status_code=422,
                    detail=f"column_overrides[{col['name']}] dtype={ov.dtype} requires `format`",
                )
            out.append({"name": col["name"], "dtype": ov.dtype})
    return out


def _apply_exclusions(
    columns: list[dict[str, str]], excluded: list[str] | None
) -> list[dict[str, str]]:
    if not excluded:
        return columns
    by_name = {c["name"]: c for c in columns}
    missing = [n for n in excluded if n not in by_name]
    if missing:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "unknown_column",
                "detail": f"excluded_columns references missing column(s): {', '.join(missing)}",
            },
        )
    kept = [c for c in columns if c["name"] not in set(excluded)]
    if not kept:
        raise HTTPException(
            status_code=422,
            detail="excluded_columns leaves zero columns",
        )
    return kept


@router.post(
    "/workspaces/{id}/datasets/batch",
    status_code=status.HTTP_201_CREATED,
    response_model=list[Dataset],
    response_model_exclude_none=True,
)
def commit_datasets_batch(id: str, body: _BatchRequest) -> list[Dataset]:  # noqa: A002
    with get_conn() as con:
        ws_row = con.execute(
            "SELECT id FROM workspaces WHERE id = ?", (id,)
        ).fetchone()
    if ws_row is None:
        raise HTTPException(status_code=404, detail="workspace or temp_id not found")

    meta = _load_meta(body.temp_id)
    if meta is None:
        raise HTTPException(status_code=404, detail="workspace or temp_id not found")

    temp_dir = temp_upload_dir(body.temp_id)
    original_path = temp_dir / f"original{meta['ext']}"
    if not original_path.exists():
        raise HTTPException(status_code=404, detail="workspace or temp_id not found")

    source_format = meta["sourceFormat"]

    # Validate items up front. Any failure rejects the whole batch.
    for item in body.items:
        if item.target_dataset_id is not None:
            raise HTTPException(
                status_code=422,
                detail="target_dataset_id is reserved for append-mode (R∞)",
            )
        if source_format == "excel" and item.sheet is None:
            raise HTTPException(
                status_code=422,
                detail="excel commits require a sheet per item",
            )
        if item.excluded_columns is not None and not item.excluded_columns:
            # Explicit empty list is fine; it's "exclude nothing".
            pass

    # Parse + validate each item. Build the dataset rows in memory first.
    staged: list[tuple[Dataset, pd.DataFrame]] = []
    for item in body.items:
        opts = item.parse_options or ParseOptions()
        if source_format == "csv":
            parsed = parse_csv(original_path)
        else:
            parsed = parse_sheet(
                original_path,
                item.sheet or "",
                range_=opts.range,
                has_header=True if opts.has_header is None else opts.has_header,
            )

        cols = _apply_overrides(parsed.columns, item.column_overrides)
        cols = _apply_exclusions(cols, item.excluded_columns)

        ds_id = _new_ds_id()
        created_at = _now_iso()
        ds = Dataset(
            id=ds_id,
            workspaceId=id,
            name=item.name,
            sizeBytes=original_path.stat().st_size,
            rowCount=parsed.row_count,
            columnCount=len(cols),
            columns=[Column(**c) for c in cols],
            sourceFormat=source_format,
            sheetName=item.sheet if source_format == "excel" else None,
            createdAt=created_at,
        )

        # Build a dataframe of the kept columns for parquet write.
        df = pd.DataFrame(
            parsed.sample_rows, columns=[c["name"] for c in parsed.columns]
        )
        kept_names = [c["name"] for c in cols]
        df = df[[n for n in kept_names if n in df.columns]]

        staged.append((ds, df))

    # Write filesystem trees, then commit DB. Roll back files on DB failure.
    created_dirs: list[Path] = []
    try:
        for ds, df in staged:
            target = dataset_dir(ds.workspaceId, ds.id)
            target.mkdir(parents=True, exist_ok=True)
            created_dirs.append(target)
            shutil.copy2(original_path, target / f"original{meta['ext']}")
            df.to_parquet(target / "parsed.parquet", index=False)
            (target / "source.json").write_text(
                json.dumps(
                    {
                        "temp_id": body.temp_id,
                        "sourceFormat": source_format,
                        "sheet": ds.sheetName,
                        "originalName": meta.get("originalName"),
                    },
                    ensure_ascii=False,
                )
            )

        with get_conn() as con:
            con.execute("BEGIN")
            for ds, _df in staged:
                con.execute(
                    """INSERT INTO datasets (
                        id, workspace_id, name, size_bytes, row_count,
                        column_count, columns_json, source_format, sheet_name,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        ds.id,
                        ds.workspaceId,
                        ds.name,
                        ds.sizeBytes,
                        ds.rowCount,
                        ds.columnCount,
                        json.dumps([c.model_dump() for c in ds.columns]),
                        ds.sourceFormat,
                        ds.sheetName,
                        ds.createdAt,
                    ),
                )
            con.commit()
    except Exception:
        for d in created_dirs:
            shutil.rmtree(d, ignore_errors=True)
        raise

    return [ds for ds, _df in staged]


@router.get("/datasets", response_model=list[Dataset], response_model_exclude_none=True)
def list_datasets(
    workspace_id: Annotated[str | None, Query(pattern=r"^ws_[0-9a-f]{8}$")] = None,
) -> list[Dataset]:
    with get_conn() as con:
        if workspace_id is None:
            rows = con.execute(
                "SELECT * FROM datasets ORDER BY created_at DESC, id DESC"
            ).fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM datasets WHERE workspace_id = ? "
                "ORDER BY created_at DESC, id DESC",
                (workspace_id,),
            ).fetchall()

    out: list[Dataset] = []
    for r in rows:
        out.append(
            Dataset(
                id=r["id"],
                workspaceId=r["workspace_id"],
                name=r["name"],
                sizeBytes=r["size_bytes"],
                rowCount=r["row_count"],
                columnCount=r["column_count"],
                columns=[Column(**c) for c in json.loads(r["columns_json"])],
                sourceFormat=r["source_format"],
                sheetName=r["sheet_name"],
                createdAt=r["created_at"],
            )
        )
    return out
