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
import sqlite3
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from app._generated.constants import ID_PATTERNS, NAME_LENGTHS, PAGE_SIZES
from app.db import get_conn
from app.ingest.csv_parser import parse_csv
from app.ingest.excel_parser import parse_sheet
from app.ingest.filters import parse_advanced_from_query, parse_filters_from_query
from app.ingest.parquet_writer import write_csv_to_parquet, write_excel_to_parquet
from app.ingest.rows_reader import query_dataset_rows
from app.models.common import (
    ApiErrorNameTaken,
    ApiErrorNotFound,
    Column,
    ColumnOverride,
    Dataset,
    ParseOptions,
)
from app.routers._shared import RowsPage, _is_unique_violation, _load_meta, _now_iso
from app.storage import dataset_dir, temp_upload_dir


router = APIRouter(tags=["datasets"])


class RenameDatasetBody(BaseModel):
    """PATCH /datasets/{id} body — dataset `name` bound from
    NAME_LENGTHS (R29 — was hardcoded 1-120)."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=NAME_LENGTHS["dataset_max"])]


# R29: pattern sourced from ID_PATTERNS (was hardcoded `^ds_[0-9a-f]{8}$`).
DsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["dataset"])]


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
            status_code=status.HTTP_409_CONFLICT,
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
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"column_overrides[{col['name']}] dtype={ov.dtype} requires `format`",
                )
            out.append({"name": col["name"], "dtype": ov.dtype})
    return out


def _apply_exclusions(columns: list[dict[str, str]], excluded: list[str] | None) -> list[dict[str, str]]:
    if not excluded:
        return columns
    by_name = {c["name"]: c for c in columns}
    missing = [n for n in excluded if n not in by_name]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "unknown_column",
                "detail": f"excluded_columns references missing column(s): {', '.join(missing)}",
            },
        )
    kept = [c for c in columns if c["name"] not in set(excluded)]
    if not kept:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="excluded_columns leaves zero columns",
        )
    return kept


@router.post(
    "/workspaces/{id}/datasets/batch",
    status_code=status.HTTP_201_CREATED,
    response_model=list[Dataset],
    response_model_exclude_none=True,
)
def commit_datasets_batch(id: str, body: _BatchRequest) -> list[Dataset] | JSONResponse:  # noqa: A002
    with get_conn() as con:
        ws_row = con.execute("SELECT id FROM workspaces WHERE id = ?", (id,)).fetchone()
    if ws_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workspace or temp_id not found")

    meta = _load_meta(body.temp_id)
    if meta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workspace or temp_id not found")

    temp_dir = temp_upload_dir(body.temp_id)
    original_path = temp_dir / f"original{meta['ext']}"
    if not original_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workspace or temp_id not found")

    source_format = meta["sourceFormat"]

    # Validate items up front. Any failure rejects the whole batch.
    for item in body.items:
        if item.target_dataset_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="target_dataset_id is reserved for append-mode (R∞)",
            )
        if source_format == "excel" and item.sheet is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="excel commits require a sheet per item",
            )
        if item.excluded_columns is not None and not item.excluded_columns:
            # Explicit empty list is fine; it's "exclude nothing".
            pass

    # Parse + validate each item. Build the dataset rows in memory first.
    # Staged carries (Dataset, ParseOptions, kept_column_names) — enough for
    # the parquet writer to re-read the source and persist the full table.
    staged: list[tuple[Dataset, ParseOptions, list[str]]] = []
    for item in body.items:
        opts = item.parse_options or ParseOptions()
        if source_format == "csv":
            parsed = parse_csv(
                original_path,
                skip_rows=0 if opts.skip_rows is None else opts.skip_rows,
                has_header=True if opts.has_header is None else opts.has_header,
            )
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

        kept_names = [c["name"] for c in cols]
        staged.append((ds, opts, kept_names))

    # Write filesystem trees, then commit DB. Roll back files on DB failure.
    created_dirs: list[Path] = []
    try:
        for ds, opts, kept_names in staged:
            target = dataset_dir(ds.workspaceId, ds.id)
            target.mkdir(parents=True, exist_ok=True)
            created_dirs.append(target)
            shutil.copy2(original_path, target / f"original{meta['ext']}")
            # R35: write the FULL table (not the wizard's 10-row sample)
            # so GET /datasets/{id}/rows can serve real data.
            parquet_target = target / "parsed.parquet"
            if source_format == "csv":
                write_csv_to_parquet(
                    original_path,
                    parquet_target,
                    skip_rows=0 if opts.skip_rows is None else opts.skip_rows,
                    has_header=True if opts.has_header is None else opts.has_header,
                    kept_columns=kept_names,
                )
            else:
                write_excel_to_parquet(
                    original_path,
                    parquet_target,
                    sheet=ds.sheetName or "",
                    range_=opts.range,
                    has_header=True if opts.has_header is None else opts.has_header,
                    kept_columns=kept_names,
                )
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
            for ds, _opts, _kept in staged:
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
    except sqlite3.IntegrityError as err:
        for d in created_dirs:
            shutil.rmtree(d, ignore_errors=True)
        # R25 tightening: the new unique index on (workspace_id, name)
        # rejects duplicate dataset names within the same workspace.
        # Map the violation to the contract's `name_taken` envelope.
        if _is_unique_violation(err, "datasets.name") or "idx_datasets_name_unique" in str(err):
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content=ApiErrorNameTaken().model_dump(),
            )
        raise
    except Exception:
        for d in created_dirs:
            shutil.rmtree(d, ignore_errors=True)
        raise

    return [ds for ds, _opts, _kept in staged]


@router.patch("/datasets/{id}")
def rename_dataset(  # noqa: A002 — match contract path param name
    id: DsIdPath,
    body: RenameDatasetBody,
) -> JSONResponse:
    """Rename a committed dataset.

    R23 design + R24 contract. Per-workspace uniqueness on `name`.
    Pre-checks existence (404); UPDATE may violate the unique index
    (409 `name_taken`).
    """
    with get_conn() as con:
        row = con.execute("SELECT * FROM datasets WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        try:
            con.execute(
                "UPDATE datasets SET name = ? WHERE id = ?",
                (body.name, id),
            )
            con.commit()
        except sqlite3.IntegrityError as err:
            if _is_unique_violation(err, "datasets.name") or "idx_datasets_name_unique" in str(err):
                return JSONResponse(
                    status_code=status.HTTP_409_CONFLICT,
                    content=ApiErrorNameTaken().model_dump(),
                )
            raise

        # Re-read for the response (name field changed; everything else
        # stays). Simpler than synthesizing the dict from the prior row.
        updated = con.execute("SELECT * FROM datasets WHERE id = ?", (id,)).fetchone()

    ds = Dataset(
        id=updated["id"],
        workspaceId=updated["workspace_id"],
        name=updated["name"],
        sizeBytes=updated["size_bytes"],
        rowCount=updated["row_count"],
        columnCount=updated["column_count"],
        columns=[Column(**c) for c in json.loads(updated["columns_json"])],
        sourceFormat=updated["source_format"],
        sheetName=updated["sheet_name"],
        createdAt=updated["created_at"],
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content=ds.model_dump(exclude_none=True),
    )


@router.delete("/datasets/{id}")
def delete_dataset(id: DsIdPath) -> Response:  # noqa: A002
    """Delete a committed dataset.

    Atomic with parquet cleanup: validate exists → delete DB row →
    rmtree the dataset directory. If the rmtree fails after the DB
    commit, the row is gone but the directory leaks — acceptable for
    POC (the directory is unreferenced; a future GC round can sweep).
    R23 design has no 409 path because datasets have no dependents.

    R79 (J-1): the dataset → dataset-rooted-query cascade that the dropped
    `queries.dataset_id` FK used to express is now done HERE, in the app —
    a polymorphic `source_id` (`ds_`/`qr_`) can't carry a DB FK. Exactly one
    level, matching the old FK: a `qr_`-rooted query built ON a now-deleted
    `ds_`-rooted query is left dangling exactly as before (the resolver
    already handles a missing source).

    404 on already-absent (lets the FE distinguish "you did this"
    from "someone else did").
    """
    with get_conn() as con:
        row = con.execute("SELECT id, workspace_id FROM datasets WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        workspace_id = row["workspace_id"]
        # App-level cascade (R79 J-1): drop the dataset's directly-rooted queries
        # first, then the dataset itself. Same connection (PRAGMA foreign_keys=ON).
        con.execute("DELETE FROM queries WHERE source_id = ?", (id,))
        con.execute("DELETE FROM datasets WHERE id = ?", (id,))
        con.commit()

    # Filesystem cleanup AFTER the DB commit. A failure here leaks a
    # directory but the DB is consistent; the FE refreshes and sees
    # the dataset is gone.
    target = dataset_dir(workspace_id, id)
    if target.exists():
        shutil.rmtree(target, ignore_errors=True)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


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
    )


@router.get("/datasets/{id}", response_model_exclude_none=True)
def get_dataset(id: DsIdPath) -> JSONResponse:  # noqa: A002
    """Return a single dataset by id. R33 design / R34 contract / R35 impl."""
    with get_conn() as con:
        row = con.execute("SELECT * FROM datasets WHERE id = ?", (id,)).fetchone()
    if row is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    ds = _dataset_from_row(row)
    return JSONResponse(status_code=status.HTTP_200_OK, content=ds.model_dump(exclude_none=True))


_PAGE_SIZE_ALLOWED = PAGE_SIZES  # R72 — centralized (values.yaml → constants)


@router.get("/datasets/{id}/rows")
def get_dataset_rows(  # noqa: A002
    request: Request,
    id: DsIdPath,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 50,
    q: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
) -> JSONResponse:
    """Paged row reader. R33 design / R34 contract / R35 impl
    (R38 contract + R39 BE adds per-column `f<N>_*` filters; R51
    adds the advanced-query `aq` DNF param, AND-composed with both).

    Out-of-range `page > ceil(total / page_size)` returns 200 with an
    empty `rows` array (matches the list-GET precedent — see
    rows-get.contract.md § Behavior). 422 only for malformed inputs
    (including the four filter-related codes per R38).
    """
    # FastAPI doesn't coerce query strings to Literal[int, ...], so we
    # enforce the page_size enum manually. Off-enum returns 422 to match
    # the contract.
    if page_size not in _PAGE_SIZE_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(f"page_size must be one of {_PAGE_SIZE_ALLOWED}; got {page_size}"),
        )

    with get_conn() as con:
        row = con.execute("SELECT * FROM datasets WHERE id = ?", (id,)).fetchone()
    if row is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())

    parquet_path = dataset_dir(row["workspace_id"], row["id"]) / "parsed.parquet"
    columns_meta = json.loads(row["columns_json"])  # full {name, dtype} list
    column_names = [c["name"] for c in columns_meta]

    # Parse + validate per-column filters from the raw query params.
    # Raises 422 with the FastAPI-shape detail envelope per R38 contract.
    filters = parse_filters_from_query(request.query_params, columns_meta)
    # Parse + validate the advanced query (`aq` DNF param, R51).
    advanced = parse_advanced_from_query(request.query_params, columns_meta)

    rows, total = query_dataset_rows(
        parquet_path,
        column_names,
        page=page,
        page_size=page_size,
        q=q,
        filters=filters,
        advanced=advanced,
    )

    body = RowsPage(rows=rows, page=page, pageSize=page_size, total=total)
    return JSONResponse(status_code=status.HTTP_200_OK, content=body.model_dump())


@router.get("/datasets", response_model=list[Dataset], response_model_exclude_none=True)
def list_datasets(
    workspace_id: Annotated[str | None, Query(pattern=ID_PATTERNS["workspace"])] = None,
) -> list[Dataset]:
    with get_conn() as con:
        if workspace_id is None:
            rows = con.execute("SELECT * FROM datasets ORDER BY created_at DESC, id DESC").fetchall()
        else:
            rows = con.execute(
                "SELECT * FROM datasets WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
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
