from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.core.config import metadata_db_path, parquet_root_dir
from app.core.metadata_db import get_connection, init_metadata_db
from app.schemas import (
    ApiErrorModel,
    ColumnSchema,
    ErrorResponse,
    TableSummary,
    UploadTableResponse,
    WorkspaceCreateRequest,
    WorkspaceResponse,
)
from app.services.upload_service import (
    build_upload_result,
    read_dataframe,
    save_parquet,
    slugify_filename,
    utc_now_iso,
)

app = FastAPI(title="My Dynamic Dashboard Backend")

DB_PATH = metadata_db_path()
PARQUET_ROOT = parquet_root_dir()


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


@app.on_event("startup")
def startup_event() -> None:
    init_metadata_db(DB_PATH)


@app.exception_handler(ApiError)
def handle_api_error(_: object, exc: ApiError) -> JSONResponse:
    payload = ErrorResponse(error=ApiErrorModel(code=exc.code, message=exc.message))
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


@app.exception_handler(HTTPException)
def handle_http_error(_: object, exc: HTTPException) -> JSONResponse:
    message = str(exc.detail)
    payload = ErrorResponse(error=ApiErrorModel(code="http_error", message=message))
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/v1/workspaces")
def create_workspace(request: WorkspaceCreateRequest) -> WorkspaceResponse:
    workspace_id = str(uuid.uuid4())
    now = utc_now_iso()

    with get_connection(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO workspaces (id, name, status, manifest_version, content_hash, created_at, updated_at)
            VALUES (?, ?, 'draft', 1, NULL, ?, ?)
            """,
            (workspace_id, request.name, now, now),
        )

    return WorkspaceResponse(
        id=workspace_id,
        name=request.name,
        status="draft",
        manifest_version=1,
    )


@app.post(
    "/api/v1/tables/upload",
    responses={400: {"description": "Unsupported or malformed upload file."}},
)
async def upload_table(file: Annotated[UploadFile, File(...)]) -> UploadTableResponse:
    filename = file.filename or ""
    lower_name = filename.lower()

    if not (lower_name.endswith(".csv") or lower_name.endswith(".xlsx")):
        raise ApiError(
            status_code=400,
            code="unsupported_file",
            message="Unsupported file type. Only .csv and .xlsx are allowed.",
        )

    file_bytes = await file.read()

    try:
        df = read_dataframe(filename=filename, file_bytes=file_bytes)
    except Exception as exc:
        raise ApiError(
            status_code=400,
            code="parse_failed",
            message=f"Unable to parse file: {exc}",
        ) from exc

    with get_connection(DB_PATH) as conn:
        latest_row = conn.execute(
            """
            SELECT version, schema_hash
            FROM files
            WHERE filename = ?
            ORDER BY version DESC
            LIMIT 1
            """,
            (filename,),
        ).fetchone()

        version = 1 if latest_row is None else int(latest_row["version"]) + 1
        previous_schema_hash = None if latest_row is None else str(latest_row["schema_hash"])

    table_id = slugify_filename(filename)

    parquet_path = save_parquet(df=df, parquet_root=PARQUET_ROOT, table_id=table_id, version=version)
    result = build_upload_result(
        filename=filename,
        df=df,
        parquet_path=parquet_path,
        version=version,
        previous_schema_hash=previous_schema_hash,
    )

    with get_connection(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO files (
                id, table_id, filename, extension, version, parquet_path,
                row_count, schema_hash, schema_changed, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result.file_id,
                result.table_id,
                result.filename,
                result.filename.rsplit(".", 1)[-1].lower(),
                result.version,
                result.parquet_path,
                result.row_count,
                result.schema_hash,
                int(result.schema_changed),
                utc_now_iso(),
            ),
        )

        for index, column in enumerate(result.columns):
            conn.execute(
                """
                INSERT INTO file_schemas (
                    id, file_id, column_name, data_type, is_nullable, ordinal
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    str(uuid.uuid4()),
                    result.file_id,
                    column.name,
                    column.data_type,
                    int(column.is_nullable),
                    index,
                ),
            )

    return UploadTableResponse(
        file_id=result.file_id,
        table_id=result.table_id,
        filename=result.filename,
        version=result.version,
        row_count=result.row_count,
        parquet_path=result.parquet_path,
        schema_changed=result.schema_changed,
        schema=[
            ColumnSchema(
                name=column.name,
                data_type=column.data_type,
                is_nullable=column.is_nullable,
            )
            for column in result.columns
        ],
    )


@app.get("/api/v1/tables")
def list_tables() -> list[TableSummary]:
    with get_connection(DB_PATH) as conn:
        latest_files = conn.execute(
            """
            SELECT f.*
            FROM files f
            INNER JOIN (
                SELECT filename, MAX(version) AS max_version
                FROM files
                GROUP BY filename
            ) latest
            ON f.filename = latest.filename
            AND f.version = latest.max_version
            ORDER BY f.filename ASC
            """
        ).fetchall()

        summaries: list[TableSummary] = []

        for file_row in latest_files:
            schema_rows = conn.execute(
                """
                SELECT column_name, data_type, is_nullable
                FROM file_schemas
                WHERE file_id = ?
                ORDER BY ordinal ASC
                """,
                (file_row["id"],),
            ).fetchall()

            summaries.append(
                TableSummary(
                    file_id=str(file_row["id"]),
                    table_id=str(file_row["table_id"]),
                    filename=str(file_row["filename"]),
                    version=int(file_row["version"]),
                    row_count=int(file_row["row_count"]),
                    schema_changed=bool(file_row["schema_changed"]),
                    schema=[
                        ColumnSchema(
                            name=str(column_row["column_name"]),
                            data_type=str(column_row["data_type"]),
                            is_nullable=bool(column_row["is_nullable"]),
                        )
                        for column_row in schema_rows
                    ],
                )
            )

    return summaries
