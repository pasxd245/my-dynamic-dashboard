"""Uploads router — R16 implementation against R15's locked contracts.

Two endpoints:

- ``POST /uploads`` — multipart upload + light parse. CSV inline-
  parses; Excel only enumerates sheets.
- ``POST /uploads/{temp_id}/parse`` — per-sheet Excel parse with
  body-carried per-item success/failure.

Filesystem layout (per ``app/storage.py``):
``data/uploads_tmp/<temp_id>/{original.<ext>, meta.json}``.
"""

from __future__ import annotations

import json
import secrets
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from app.ingest.csv_parser import CsvParseError, parse_csv
from app.ingest.excel_parser import ExcelParseError, enumerate_sheets, parse_sheet
from app.models.common import (
    Column,
    CsvParsePreview,
    ParseOptions,
    SheetSummary,
    TempUploadCsv,
    TempUploadExcel,
)
from app.storage import temp_upload_dir, temp_uploads_dir


router = APIRouter(prefix="/uploads", tags=["uploads"])


MAX_UPLOAD_BYTES = 100 * 1024 * 1024  # 100 MB — matches contract `413` clause.

_CSV_EXTS = {".csv"}
_EXCEL_EXTS = {".xlsx", ".xls"}


def _new_temp_id() -> str:
    return f"tmp_{secrets.token_hex(8)}"


def _ext_for_format(filename: str, source_format: str) -> str:
    suffix = Path(filename).suffix.lower()
    if source_format == "csv":
        if suffix not in _CSV_EXTS:
            raise HTTPException(status_code=415, detail="sourceFormat/extension mismatch")
        return ".csv"
    if source_format == "excel":
        if suffix not in _EXCEL_EXTS:
            raise HTTPException(status_code=415, detail="sourceFormat/extension mismatch")
        return suffix
    raise HTTPException(status_code=422, detail="unknown sourceFormat")


def _write_temp(temp_id: str, ext: str, payload: bytes, *, source_format: str, original_name: str) -> Path:
    target_dir = temp_upload_dir(temp_id)
    target_dir.mkdir(parents=True, exist_ok=True)
    file_path = target_dir / f"original{ext}"
    file_path.write_bytes(payload)
    meta = {
        "sourceFormat": source_format,
        "originalName": original_name,
        "sizeBytes": len(payload),
        "ext": ext,
    }
    (target_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False))
    return file_path


def _load_meta(temp_id: str) -> dict | None:
    meta_path = temp_upload_dir(temp_id) / "meta.json"
    if not meta_path.exists():
        return None
    return json.loads(meta_path.read_text())


@router.post("")
async def create_temp_upload(
    file: Annotated[UploadFile, File()],
    sourceFormat: Annotated[Literal["csv", "excel"], Form()],  # noqa: N803 — wire shape
):
    payload = await file.read()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file too large")

    ext = _ext_for_format(file.filename or "", sourceFormat)
    temp_id = _new_temp_id()
    file_path = _write_temp(
        temp_id, ext, payload,
        source_format=sourceFormat, original_name=file.filename or "",
    )

    if sourceFormat == "csv":
        try:
            result = parse_csv(file_path)
        except CsvParseError as exc:
            # Rollback the temp dir — contract says no temp is retained.
            import shutil
            shutil.rmtree(file_path.parent, ignore_errors=True)
            raise HTTPException(status_code=422, detail=str(exc)) from exc

        return TempUploadCsv(
            temp_id=temp_id,
            sourceFormat="csv",
            sizeBytes=len(payload),
            csvPreview=CsvParsePreview(
                columns=[Column(**c) for c in result.columns],
                rowCount=result.row_count,
                sampleRows=result.sample_rows,
            ),
        )

    # Excel
    try:
        sheets = enumerate_sheets(file_path)
    except Exception as exc:
        import shutil
        shutil.rmtree(file_path.parent, ignore_errors=True)
        raise HTTPException(status_code=415, detail=f"excel read failed: {exc}") from exc

    if not sheets:
        import shutil
        shutil.rmtree(file_path.parent, ignore_errors=True)
        raise HTTPException(status_code=415, detail="excel workbook has no sheets")

    return TempUploadExcel(
        temp_id=temp_id,
        sourceFormat="excel",
        sizeBytes=len(payload),
        sheets=[
            SheetSummary(
                sheet=s.sheet,
                rowCount=s.row_count,
                columnCount=s.column_count,
                usedRange=s.used_range,
            )
            for s in sheets
        ],
    )


class _ParseItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sheet: Annotated[str, Field(min_length=1)]
    parse_options: ParseOptions | None = None


class _ParseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: Annotated[list[_ParseItem], Field(min_length=1)]


@router.post("/{temp_id}/parse")
def parse_temp_upload_sheets(temp_id: str, body: _ParseRequest):
    meta = _load_meta(temp_id)
    if meta is None or meta.get("sourceFormat") != "excel":
        raise HTTPException(status_code=404, detail="temp_id unknown or not excel")

    file_path = temp_upload_dir(temp_id) / f"original{meta['ext']}"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="temp file missing")

    # Validate every requested sheet exists in the workbook.
    sheet_names = {s.sheet for s in enumerate_sheets(file_path)}
    unknown = [item.sheet for item in body.items if item.sheet not in sheet_names]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"unknown sheet(s): {', '.join(unknown)}",
        )

    results: list[dict] = []
    for item in body.items:
        opts = item.parse_options or ParseOptions()
        try:
            r = parse_sheet(
                file_path,
                item.sheet,
                range_=opts.range,
                has_header=True if opts.has_header is None else opts.has_header,
            )
        except ExcelParseError as exc:
            msg = str(exc)
            code = msg.split(":", 1)[0] if ":" in msg else "parse_failed"
            results.append(
                {
                    "sheet": item.sheet,
                    "status": "failed",
                    "error": code,
                    "detail": msg,
                }
            )
            continue
        results.append(
            {
                "sheet": item.sheet,
                "status": "ok",
                "columns": r.columns,
                "rowCount": r.row_count,
                "sampleRows": r.sample_rows,
            }
        )

    return {"results": results}


def reset_storage_for_tests() -> None:
    """Clear the temp uploads tree. Used by autouse test fixtures."""
    import shutil

    root = temp_uploads_dir()
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True, exist_ok=True)
