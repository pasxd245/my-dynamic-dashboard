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
import logging
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
from app.ingest.csv_parser import CsvParseError, parse_csv
from app.ingest.excel_parser import ExcelParseError, parse_sheet
from app.ingest.filters import parse_advanced_from_query, parse_filters_from_query
from app.ingest.parquet_writer import (
    CoercionError,
    FormatUnsupportedError,
    translate_format,
    write_csv_to_parquet,
    write_excel_to_parquet,
)
from app.ingest.merge import MergeCastError, MergeDuplicateKeysError, merge_parquets
from app.ingest.rows_reader import query_dataset_rows
from app.models.common import (
    ApiErrorCoercionFailed,
    ApiErrorMergeDuplicateKeys,
    ApiErrorNameTaken,
    ApiErrorNotFound,
    CoercionFailedCell,
    Column,
    ColumnOverride,
    Dataset,
    ParseOptions,
)
from app.routers._shared import RowsPage, _is_unique_violation, _load_meta, _now_iso
from app.storage import dataset_dir, temp_upload_dir


router = APIRouter(tags=["datasets"])

logger = logging.getLogger(__name__)


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
    # R147 — merge refresh: names the target's committed identity-key
    # columns; requires target_dataset_id (422 on a create item).
    merge_key: Annotated[list[Annotated[str, Field(min_length=1)]], Field(min_length=1)] | None = None


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
            if ov.dtype in ("date", "datetime"):
                if not ov.format:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"column_overrides[{col['name']}] dtype={ov.dtype} requires `format`",
                    )
                # R144 — validate the token subset BEFORE any write; a token
                # outside it (or a time token under `date`) is a loud reject,
                # never a silent relabel (upload.md §Date and datetime coercion).
                try:
                    translate_format(ov.format, dtype=ov.dtype)
                except FormatUnsupportedError as err:
                    # R144 — supportability: the reject is also visible server-side.
                    logger.warning(
                        "format_unsupported: column=%r dtype=%s format=%r token=%r reason=%s",
                        col["name"],
                        ov.dtype,
                        ov.format,
                        err.token,
                        err.reason,
                    )
                    # Two distinct user mistakes, two messages: a time token under
                    # a `date` target means the VALUES need dtype `datetime` (the
                    # FM02.2025 dogfood trap — do not list HH mm ss as "supported"
                    # while rejecting them); an unknown token is a format typo.
                    if err.reason == "time_token_in_date":
                        detail = (
                            f"format_unsupported: column_overrides[{col['name']}] — dtype `date` "
                            f"accepts date tokens only (yyyy MM dd). Values that carry a time part "
                            f"need dtype `datetime`; group by day/week later with a Date bucket step."
                        )
                    else:
                        detail = (
                            f"format_unsupported: column_overrides[{col['name']}] token "
                            f"{err.token!r} is outside the supported subset (yyyy MM dd HH mm ss)"
                        )
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detail
                    ) from err
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


def _parse_and_target(item: _BatchItem, source_format: str, original_path: Path):  # type: ignore[no-untyped-def]
    """Parse one item's source, apply overrides + exclusions, and derive the
    parquet writer's coercion targets. Shared by the create and refresh paths
    so both enforce the R143/R144 dtype contract identically. Returns
    ``(parsed, cols, opts, kept_names, dtype_targets, dtype_formats)``."""
    opts = item.parse_options or ParseOptions()
    try:
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
    except (CsvParseError, ExcelParseError) as exc:
        # R147 — a commit whose source can't parse (unknown/renamed sheet,
        # malformed range) is a CLIENT error, not an opaque 500 (the R142-F1
        # class; the parse endpoint already mapped these, the commit path
        # didn't). Create raises in the up-front validation loop (nothing
        # committed); refresh raises BEFORE any staging write (dataset
        # untouched).
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    cols = _apply_overrides(parsed.columns, item.column_overrides)
    cols = _apply_exclusions(cols, item.excluded_columns)
    kept_names = [c["name"] for c in cols]
    kept = set(kept_names)
    # Every kept column's committed dtype is a coercion target (R143 build
    # deviation, made canonical). The former `if dtype in COERCIBLE_DTYPES`
    # guard was vestigial once R144 made all six dtypes coercible — pruned
    # (R145, per the carried R144 prune-check).
    dtype_targets = {c["name"]: c["dtype"] for c in cols}
    dtype_formats = {
        name: translate_format(ov.format, dtype=ov.dtype)
        for name, ov in (item.column_overrides or {}).items()
        if name in kept and ov.dtype in ("date", "datetime") and ov.format
    }
    return parsed, cols, opts, kept_names, dtype_targets, dtype_formats


def _write_parquet(  # type: ignore[no-untyped-def]
    source_format: str,
    original_path: Path,
    parquet_target: Path,
    *,
    opts: ParseOptions,
    kept_names: list[str],
    dtype_targets: dict[str, str],
    dtype_formats: dict[str, str],
    sheet: str | None,
) -> None:
    """Write the full coerced table to parquet. Raises CoercionError on an
    uncastable cell (→ typed 422 by the callers). Shared by create + refresh."""
    if source_format == "csv":
        write_csv_to_parquet(
            original_path,
            parquet_target,
            skip_rows=0 if opts.skip_rows is None else opts.skip_rows,
            has_header=True if opts.has_header is None else opts.has_header,
            kept_columns=kept_names,
            dtype_targets=dtype_targets or None,
            dtype_formats=dtype_formats or None,
        )
    else:
        write_excel_to_parquet(
            original_path,
            parquet_target,
            sheet=sheet or "",
            range_=opts.range,
            has_header=True if opts.has_header is None else opts.has_header,
            kept_columns=kept_names,
            dtype_targets=dtype_targets or None,
            dtype_formats=dtype_formats or None,
        )


def _commit_settings_dict(item: _BatchItem, sheet_name: str | None) -> dict:
    """The carry-forward snapshot persisted in source.json (R145 F9) — exactly
    what a future refresh wizard pre-fills. Stores the USER's overrides
    (Java-token formats intact), re-translated at the next commit. Mirrors a
    commit item's settings shape so `GET .../refresh-settings` round-trips it."""
    d: dict = {
        "parse_options": (item.parse_options or ParseOptions()).model_dump(exclude_none=True),
        "column_overrides": {
            name: ov.model_dump(exclude_none=True) for name, ov in (item.column_overrides or {}).items()
        },
        "excluded_columns": list(item.excluded_columns or []),
    }
    if sheet_name is not None:
        d["sheet"] = sheet_name
    return d


def _source_json_dict(temp_id: str, source_format: str, sheet: str | None, meta: dict, commit_settings: dict) -> str:
    return json.dumps(
        {
            "temp_id": temp_id,
            "sourceFormat": source_format,
            "sheet": sheet,
            "originalName": meta.get("originalName"),
            "commitSettings": commit_settings,
        },
        ensure_ascii=False,
    )


def _load_source_json(workspace_id: str, ds_id: str) -> dict | None:
    p = dataset_dir(workspace_id, ds_id) / "source.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except (OSError, json.JSONDecodeError):
        return None


def _merge_key_guards(
    merge_key: list[str], committed_cols: dict[str, str], dtype_targets: dict[str, str]
) -> None:
    """R147 F5×F2 — the key columns are the ONE loud stop in the otherwise
    warn-never-block drift policy: a silently drifted key dtype = the same
    value failing to match its own prior row (false non-overlap). All three
    guards 422 BEFORE any write; the dataset is untouched."""
    unknown = [k for k in merge_key if k not in committed_cols]
    if unknown:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"merge_key references column(s) not in the existing dataset: {', '.join(unknown)}",
        )
    missing = [k for k in merge_key if k not in dtype_targets]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"merge_key column(s) missing from the incoming file: {', '.join(missing)} — "
                f"fix the file or switch the refresh to replace"
            ),
        )
    drifted = [
        f"{k} ({committed_cols[k]} → {dtype_targets[k]})"
        for k in merge_key
        if committed_cols[k] != dtype_targets[k]
    ]
    if drifted:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"merge_key column dtype changed between the dataset and the incoming file: "
                f"{', '.join(drifted)} — a drifted key silently mis-matches rows; "
                f"fix the override or switch the refresh to replace"
            ),
        )


def _run_merge(
    staging_dir: Path, ds_dir: Path, merge_key: list[str], cols: list[dict[str, str]], target_id: str
) -> dict[str, int] | JSONResponse:
    """R147 — run keep-latest-per-key against the STAGED incoming parquet and
    swap the merged result into staging. Any failure discards staging and the
    dataset is untouched: duplicate incoming keys → the typed
    `merge_duplicate_keys` 422 (D2 — loud stop); an uncastable kept committed
    value → 422 detail (loud, never a silent TRY_CAST NULL)."""
    staged_parquet = staging_dir / "parsed.parquet"
    merged_target = staging_dir / "merged.parquet"
    try:
        merge_stats = merge_parquets(
            ds_dir / "parsed.parquet",
            staged_parquet,
            merged_target,
            key=merge_key,
            incoming_cols=cols,
        )
    except MergeDuplicateKeysError as err:
        shutil.rmtree(staging_dir, ignore_errors=True)
        logger.warning(
            "merge_duplicate_keys (refresh): dataset=%r key=%r duplicated=%d sample=%r",
            target_id,
            merge_key,
            err.duplicate_key_count,
            err.sample_keys[0],
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ApiErrorMergeDuplicateKeys(
                key=merge_key,
                duplicateKeyCount=err.duplicate_key_count,
                sampleKeys=err.sample_keys,
            ).model_dump(exclude_none=True),
        )
    except MergeCastError as err:
        shutil.rmtree(staging_dir, ignore_errors=True)
        logger.warning("merge_cast_failed (refresh): dataset=%r key=%r error=%s", target_id, merge_key, err)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"merge failed casting existing rows to the incoming schema: {err}",
        ) from err
    merged_target.replace(staged_parquet)
    return merge_stats


def _handle_refresh(
    body: _BatchRequest, meta: dict, original_path: Path, source_format: str
) -> list[Dataset] | JSONResponse:
    """R145 § Refresh — whole-table REPLACE of an existing dataset; R147 —
    MERGE (keep-latest-per-key) when the item carries ``merge_key``.

    The dataset's ``id`` is kept (dependent queries/relationships survive); the
    parquet, original file, columns_json, counts and commitSettings are
    atomically swapped. Coercion is validated on a STAGING copy before any swap,
    so a coercion failure leaves the existing dataset fully intact (acceptance
    #4). A directory-level rename (old → .bak, staging → live) keeps the swap
    atomic; any failure during the DB update restores the old directory.
    The merge (dup-key check + reconciliation) also runs against the staging
    copy BEFORE any swap — same intact-on-failure invariant.
    """
    if len(body.items) != 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="a refresh commits exactly one dataset (target_dataset_id)",
        )
    item = body.items[0]
    target_id = item.target_dataset_id
    with get_conn() as con:
        row = con.execute("SELECT * FROM datasets WHERE id = ?", (target_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workspace or temp_id not found")
    ws_id = row["workspace_id"]
    if source_format == "excel" and item.sheet is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="excel commits require a sheet per item",
        )
    if row["source_format"] != source_format:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="refresh source format must match the existing dataset",
        )

    parsed, cols, opts, kept_names, dtype_targets, dtype_formats = _parse_and_target(
        item, source_format, original_path
    )
    sheet_name = item.sheet if source_format == "excel" else None

    # R147 — merge guards run BEFORE any write (key must exist on both
    # sides with the committed dtype; the F5×F2 false-non-overlap stop).
    merge_key = list(dict.fromkeys(item.merge_key)) if item.merge_key else None
    if merge_key is not None:
        committed_cols = {c["name"]: c["dtype"] for c in json.loads(row["columns_json"])}
        _merge_key_guards(merge_key, committed_cols, dtype_targets)

    ds_dir = dataset_dir(ws_id, target_id)
    staging_dir = ds_dir.parent / f"{target_id}.staging"
    bak_dir = ds_dir.parent / f"{target_id}.bak"
    if staging_dir.exists():
        shutil.rmtree(staging_dir, ignore_errors=True)
    staging_dir.mkdir(parents=True, exist_ok=True)

    # Coercion is validated HERE, on the staging copy, BEFORE any swap → the
    # existing dataset is untouched on failure (acceptance #4).
    try:
        _write_parquet(
            source_format,
            original_path,
            staging_dir / "parsed.parquet",
            opts=opts,
            kept_names=kept_names,
            dtype_targets=dtype_targets,
            dtype_formats=dtype_formats,
            sheet=sheet_name,
        )
    except CoercionError as err:
        shutil.rmtree(staging_dir, ignore_errors=True)
        logger.warning(
            "coercion_failed (refresh): dataset=%r column=%r dtype=%s total_failed=%d first_cell=(row %d, %r)",
            target_id,
            err.column,
            err.dtype,
            err.total_failed,
            err.cells[0][0],
            err.cells[0][1],
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ApiErrorCoercionFailed(
                sheet=sheet_name,
                column=err.column,
                dtype=err.dtype,  # type: ignore[arg-type]
                cells=[CoercionFailedCell(row=r, value=v) for r, v in err.cells],
                totalFailed=err.total_failed,
            ).model_dump(exclude_none=True),
        )
    # R147 — MERGE: reconcile the staged incoming table with the committed
    # parquet (keep-latest-per-key), still before any swap. A dup-key or
    # cast failure discards staging; the dataset is untouched.
    merge_stats: dict[str, int] | None = None
    if merge_key is not None:
        merge_result = _run_merge(staging_dir, ds_dir, merge_key, cols, target_id)
        if isinstance(merge_result, JSONResponse):
            return merge_result
        merge_stats = merge_result

    shutil.copy2(original_path, staging_dir / f"original{meta['ext']}")
    commit_settings = _commit_settings_dict(item, sheet_name)
    # R147 D1/D4 — remember the refresh semantics + declared key per dataset
    # (the wizard's next-refresh defaults). A replace refresh carries the
    # previously declared key forward so it isn't forgotten between merges.
    commit_settings["refresh_mode"] = "merge" if merge_key is not None else "replace"
    if merge_key is not None:
        commit_settings["merge_key"] = merge_key
    else:
        prev_key = (((_load_source_json(ws_id, target_id) or {}).get("commitSettings")) or {}).get("merge_key")
        if prev_key:
            commit_settings["merge_key"] = prev_key
    (staging_dir / "source.json").write_text(
        _source_json_dict(body.temp_id, source_format, sheet_name, meta, commit_settings)
    )

    columns_json = json.dumps(cols, ensure_ascii=False)
    new_size = original_path.stat().st_size
    new_row_count = parsed.row_count if merge_stats is None else sum(merge_stats.values())

    # Atomic swap: old dir → .bak, staging → live, then UPDATE the row. Any
    # failure restores the old directory so the dataset is never left broken.
    if bak_dir.exists():
        shutil.rmtree(bak_dir, ignore_errors=True)
    ds_dir.replace(bak_dir)
    try:
        staging_dir.replace(ds_dir)
        with get_conn() as con:
            con.execute("BEGIN")
            con.execute(
                "UPDATE datasets SET row_count=?, column_count=?, columns_json=?, "
                "size_bytes=?, sheet_name=? WHERE id=?",
                (new_row_count, len(cols), columns_json, new_size, sheet_name, target_id),
            )
            con.commit()
    except Exception:
        shutil.rmtree(ds_dir, ignore_errors=True)
        bak_dir.replace(ds_dir)
        shutil.rmtree(staging_dir, ignore_errors=True)
        raise
    shutil.rmtree(bak_dir, ignore_errors=True)

    with get_conn() as con:
        updated = con.execute("SELECT * FROM datasets WHERE id = ?", (target_id,)).fetchone()
    updated_ds = _dataset_from_row(updated)
    if merge_stats is not None:
        # R147 — the merge report wrapper (contract 201 shape 2). Bypasses
        # response_model (JSONResponse); contract-verified via validate_response.
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "datasets": [updated_ds.model_dump(exclude_none=True, mode="json")],
                "merge": merge_stats,
            },
        )
    return [updated_ds]


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

    # R145 — any item carrying target_dataset_id is a REFRESH (whole-table
    # replace of an existing dataset). Route the whole batch to the refresh
    # handler, which enforces single-item + atomic in-place swap.
    if any(it.target_dataset_id is not None for it in body.items):
        return _handle_refresh(body, meta, original_path, source_format)

    # Validate items up front. Any failure rejects the whole batch.
    for item in body.items:
        if item.merge_key is not None:
            # R147 — merge is a refresh semantics; meaningless on a create.
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="merge_key requires target_dataset_id (merge is a refresh mode)",
            )
        if source_format == "excel" and item.sheet is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="excel commits require a sheet per item",
            )

    # Parse + validate each item. Build the dataset rows in memory first.
    # Staged carries (Dataset, ParseOptions, kept_column_names, dtype_targets,
    # dtype_formats) (R143 — formatless overrides applied at the write; R144 —
    # date/datetime too, via the translated format) — enough for the parquet
    # writer to re-read the source and persist the full table.
    staged: list[tuple[Dataset, ParseOptions, list[str], dict[str, str], dict[str, str], dict]] = []
    for item in body.items:
        # R143/R144 — the parquet write ENFORCES every kept column's committed
        # dtype (parser-inferred or overridden) via _parse_and_target's
        # dtype_targets/dtype_formats, so `parsed.parquet` can never contradict
        # `columns_json` (shared with the refresh path).
        parsed, cols, opts, kept_names, dtype_targets, dtype_formats = _parse_and_target(
            item, source_format, original_path
        )
        ds = Dataset(
            id=_new_ds_id(),
            workspaceId=id,
            name=item.name,
            sizeBytes=original_path.stat().st_size,
            rowCount=parsed.row_count,
            columnCount=len(cols),
            columns=[Column(**c) for c in cols],
            sourceFormat=source_format,
            sheetName=item.sheet if source_format == "excel" else None,
            createdAt=_now_iso(),
        )
        commit_settings = _commit_settings_dict(item, ds.sheetName)
        staged.append((ds, opts, kept_names, dtype_targets, dtype_formats, commit_settings))

    # Write filesystem trees, then commit DB. Roll back files on DB failure.
    created_dirs: list[Path] = []
    try:
        for ds, opts, kept_names, dtype_targets, dtype_formats, commit_settings in staged:
            target = dataset_dir(ds.workspaceId, ds.id)
            target.mkdir(parents=True, exist_ok=True)
            created_dirs.append(target)
            shutil.copy2(original_path, target / f"original{meta['ext']}")
            # R35: write the FULL table (not the wizard's 10-row sample)
            # so GET /datasets/{id}/rows can serve real data.
            try:
                _write_parquet(
                    source_format,
                    original_path,
                    target / "parsed.parquet",
                    opts=opts,
                    kept_names=kept_names,
                    dtype_targets=dtype_targets,
                    dtype_formats=dtype_formats,
                    sheet=ds.sheetName,
                )
            except CoercionError as err:
                # R143 — typed 422 instead of the pre-R143 ArrowInvalid 500.
                # The whole batch aborts; nothing half-commits.
                # R144 — supportability: the data issue is also visible in the
                # backend log (the wizard alert is transient; this isn't).
                logger.warning(
                    "coercion_failed: sheet=%r column=%r dtype=%s total_failed=%d first_cell=(row %d, %r)",
                    ds.sheetName,
                    err.column,
                    err.dtype,
                    err.total_failed,
                    err.cells[0][0],
                    err.cells[0][1],
                )
                for d in created_dirs:
                    shutil.rmtree(d, ignore_errors=True)
                return JSONResponse(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    content=ApiErrorCoercionFailed(
                        sheet=ds.sheetName,
                        column=err.column,
                        dtype=err.dtype,  # type: ignore[arg-type] — writer guards to COERCIBLE_DTYPES
                        cells=[CoercionFailedCell(row=r, value=v) for r, v in err.cells],
                        totalFailed=err.total_failed,
                    ).model_dump(exclude_none=True),
                )
            (target / "source.json").write_text(
                _source_json_dict(body.temp_id, source_format, ds.sheetName, meta, commit_settings)
            )

        with get_conn() as con:
            con.execute("BEGIN")
            for ds, _opts, _kept, _targets, _formats, _cs in staged:
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

    return [ds for ds, _opts, _kept, _targets, _formats, _cs in staged]


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


@router.get("/datasets/{id}/refresh-settings")
def get_dataset_refresh_settings(id: DsIdPath) -> JSONResponse:  # noqa: A002
    """R145 § Refresh (F9) — the carry-forward settings a refresh wizard
    pre-fills from. Reads the `commitSettings` snapshot the last commit
    persisted in source.json. `available: false` for pre-R145 datasets (no
    snapshot) → the wizard uses its lossy fallback. Kept off the hot
    detail-get path."""
    with get_conn() as con:
        row = con.execute("SELECT id, workspace_id FROM datasets WHERE id = ?", (id,)).fetchone()
    if row is None:
        return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
    src = _load_source_json(row["workspace_id"], id)
    settings = (src or {}).get("commitSettings")
    if not settings:
        return JSONResponse(status_code=status.HTTP_200_OK, content={"available": False})
    return JSONResponse(status_code=status.HTTP_200_OK, content={"available": True, **settings})


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
