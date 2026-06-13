"""Queries router — R69 Saved Query MVP.

Five endpoints (see workspace/packages/contracts/queries/*):

- ``POST   /workspaces/{id}/queries`` — save a query (validate-on-save).
- ``GET    /workspaces/{id}/queries`` — list, most-recent-first.
- ``GET    /queries/{id}``            — one saved query.
- ``GET    /queries/{id}/rows``       — RUN: live re-run, paged.
- ``DELETE /queries/{id}``            — delete (204).

Persistence is raw-SQLite + Pydantic (the established backend standard),
NOT SQLModel — see Round_69 Do (J-3 build-time deviation). The run path
re-validates the saved definition against the dataset's CURRENT columns
and delegates to the shipped ``query_dataset_rows`` engine; a definition
that no longer validates returns ``409 query_stale`` instead of executing.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import ID_PATTERNS
from app.db import get_conn
from app.ingest.filters import build_definition_predicates
from app.ingest.rows_reader import query_dataset_rows
from app.models.common import (
    ApiErrorNameTaken,
    ApiErrorNotFound,
    ApiErrorQueryStale,
    CreateQueryBody,
    Query as QueryModel,
    QueryDefinition,
)
from app.routers.datasets import RowsPage
from app.routers.workspaces import _is_unique_violation
from app.storage import dataset_dir


router = APIRouter(tags=["queries"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
QueryIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["query"])]

_PAGE_SIZE_ALLOWED = (25, 50, 100)


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_qr_id() -> str:
    return f"qr_{secrets.token_hex(4)}"


def _query_from_row(row: sqlite3.Row) -> QueryModel:
    return QueryModel(
        id=row["id"],
        workspaceId=row["workspace_id"],
        datasetId=row["dataset_id"],
        name=row["name"],
        definition=QueryDefinition(**json.loads(row["definition_json"])),
        createdAt=row["created_at"],
    )


@router.post("/workspaces/{id}/queries", status_code=status.HTTP_201_CREATED)
def create_query(id: WsIdPath, body: CreateQueryBody) -> JSONResponse:  # noqa: A002
    """Save a query. The source dataset must exist AND belong to this
    workspace; the definition is validated against its current columns
    (a definition that can't run is rejected 422). Names are unique
    per workspace."""
    with get_conn() as con:
        ds = con.execute("SELECT * FROM datasets WHERE id = ?", (body.datasetId,)).fetchone()
    if ds is None or ds["workspace_id"] != id:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "loc": ["body", "datasetId"],
                    "msg": f"unknown_dataset: {body.datasetId} is not a dataset in workspace {id}",
                    "type": "value_error",
                }
            ],
        )

    columns_meta = json.loads(ds["columns_json"])
    # Validate every atom against the dataset's current columns → 422 on a
    # bad atom (you cannot persist a query that can't run).
    build_definition_predicates(body.definition.model_dump(), columns_meta)

    qid = _new_qr_id()
    created_at = _now_iso()
    definition_json = json.dumps(body.definition.model_dump())
    try:
        with get_conn() as con:
            con.execute(
                "INSERT INTO queries "
                "(id, workspace_id, dataset_id, name, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (qid, id, body.datasetId, body.name, definition_json, created_at),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        if "idx_queries_name_unique" in str(err) or _is_unique_violation(err, "queries.name"):
            return JSONResponse(status_code=409, content=ApiErrorNameTaken().model_dump())
        raise

    created = QueryModel(
        id=qid,
        workspaceId=id,
        datasetId=body.datasetId,
        name=body.name,
        definition=body.definition,
        createdAt=created_at,
    )
    return JSONResponse(status_code=201, content=created.model_dump(exclude_none=True))


@router.get("/workspaces/{id}/queries")
def list_queries(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's saved queries, most-recent first."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM queries WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
    items = [_query_from_row(r).model_dump(exclude_none=True) for r in rows]
    return JSONResponse(status_code=200, content=items)


@router.get("/queries/{id}")
def get_query(id: QueryIdPath) -> JSONResponse:  # noqa: A002
    """Return one saved query (definition + metadata)."""
    with get_conn() as con:
        row = con.execute("SELECT * FROM queries WHERE id = ?", (id,)).fetchone()
    if row is None:
        return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
    return JSONResponse(status_code=200, content=_query_from_row(row).model_dump(exclude_none=True))


@router.get("/queries/{id}/rows")
def run_query(  # noqa: A002
    id: QueryIdPath,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query()] = 50,
) -> JSONResponse:
    """RUN the saved query: re-execute its definition against the source
    dataset's CURRENT data, paged. 409 query_stale if the definition no
    longer validates (schema drift)."""
    if page_size not in _PAGE_SIZE_ALLOWED:
        raise HTTPException(
            status_code=422,
            detail=f"page_size must be one of {_PAGE_SIZE_ALLOWED}; got {page_size}",
        )

    with get_conn() as con:
        qrow = con.execute("SELECT * FROM queries WHERE id = ?", (id,)).fetchone()
        if qrow is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        ds = con.execute("SELECT * FROM datasets WHERE id = ?", (qrow["dataset_id"],)).fetchone()
    if ds is None:
        # Defensive: the FK cascade should remove queries when their dataset
        # is deleted, so this is a belt-and-braces 404.
        return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())

    columns_meta = json.loads(ds["columns_json"])
    column_names = [c["name"] for c in columns_meta]
    definition = json.loads(qrow["definition_json"])

    try:
        filters, advanced = build_definition_predicates(definition, columns_meta)
    except HTTPException as exc:
        # A saved atom no longer validates against the current schema →
        # flag, don't crash (purpose.md principle 5).
        if exc.status_code == 422:
            return JSONResponse(status_code=409, content=ApiErrorQueryStale().model_dump())
        raise

    parquet_path = dataset_dir(ds["workspace_id"], ds["id"]) / "parsed.parquet"
    q = definition.get("q")
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
    return JSONResponse(status_code=200, content=body.model_dump())


@router.delete("/queries/{id}")
def delete_query(id: QueryIdPath) -> Response:  # noqa: A002
    """Delete a saved query. 404 if already absent."""
    with get_conn() as con:
        row = con.execute("SELECT id FROM queries WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM queries WHERE id = ?", (id,))
        con.commit()
    return Response(status_code=204)
