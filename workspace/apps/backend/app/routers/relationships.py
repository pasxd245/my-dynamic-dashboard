"""Relationships router — R70 relationship governance.

Four endpoints (see workspace/packages/contracts/relationships/*):

- ``POST   /workspaces/{id}/relationships`` — declare a governed edge.
- ``GET    /workspaces/{id}/relationships`` — list, most-recent-first.
- ``GET    /relationships/{id}``            — one edge (computed status).
- ``DELETE /relationships/{id}``            — delete (204).

Governance only — there is NO ``/rows`` route; producing joined rows is R71.
Persistence is raw-SQLite + Pydantic (the established backend standard). A
Relationship's ``status`` (valid|stale) is NOT stored — it is recomputed on
every read by validating both columns against the datasets' CURRENT schemas
(always-fresh, mirroring ``query_stale``). A drifted edge is flagged, never
errored on read (purpose.md principle 5); the ``409 relationship_stale``
envelope is reserved for R71 join execution.
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import ID_PATTERNS
from app.db import get_conn
from app.models.common import (
    ApiErrorNotFound,
    ApiErrorRelationshipExists,
    CreateRelationshipBody,
    Relationship,
)
from app.routers._shared import _compatible, _dtype_of, _now_iso


router = APIRouter(tags=["relationships"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
RelIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["relationship"])]


def _new_rel_id() -> str:
    return f"rel_{secrets.token_hex(4)}"


def _columns_of(con: sqlite3.Connection, dataset_id: str) -> list[dict] | None:
    row = con.execute("SELECT columns_json FROM datasets WHERE id = ?", (dataset_id,)).fetchone()
    return None if row is None else json.loads(row["columns_json"])


def _compute_status(con: sqlite3.Connection, row: sqlite3.Row) -> str:
    """`valid` iff both columns still exist with join-compatible dtypes."""
    left_cols = _columns_of(con, row["left_dataset_id"])
    right_cols = _columns_of(con, row["right_dataset_id"])
    if left_cols is None or right_cols is None:
        return "stale"
    left_dtype = _dtype_of(left_cols, row["left_column"])
    right_dtype = _dtype_of(right_cols, row["right_column"])
    return "valid" if _compatible(left_dtype, right_dtype) else "stale"


def _relationship_from_row(con: sqlite3.Connection, row: sqlite3.Row) -> Relationship:
    return Relationship(
        id=row["id"],
        workspaceId=row["workspace_id"],
        leftDatasetId=row["left_dataset_id"],
        leftColumn=row["left_column"],
        rightDatasetId=row["right_dataset_id"],
        rightColumn=row["right_column"],
        cardinality=row["cardinality"],
        status=_compute_status(con, row),
        createdAt=row["created_at"],
    )


def _validation_error(field: str, msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=[{"loc": ["body", field], "msg": msg, "type": "value_error"}],
    )


@router.post("/workspaces/{id}/relationships", status_code=status.HTTP_201_CREATED)
def create_relationship(id: WsIdPath, body: CreateRelationshipBody) -> JSONResponse:  # noqa: A002
    """Declare a governed edge. Both datasets must exist AND belong to this
    workspace; both columns must exist; their dtypes must be join-compatible.
    Self-joins (same dataset on both sides) are out this round → 422. A
    duplicate ordered column-pair → 409 relationship_exists."""
    if body.leftDatasetId == body.rightDatasetId:
        # Includes the degenerate self-pair; self-joins are deferred (Scope).
        raise _validation_error(
            "rightDatasetId",
            "self_join: left and right must be different datasets (self-joins are out this round)",
        )

    with get_conn() as con:
        left = con.execute("SELECT * FROM datasets WHERE id = ?", (body.leftDatasetId,)).fetchone()
        right = con.execute("SELECT * FROM datasets WHERE id = ?", (body.rightDatasetId,)).fetchone()

    for field, ds, ds_id in (
        ("leftDatasetId", left, body.leftDatasetId),
        ("rightDatasetId", right, body.rightDatasetId),
    ):
        if ds is None or ds["workspace_id"] != id:
            raise _validation_error(
                field, f"unknown_dataset: {ds_id} is not a dataset in workspace {id}"
            )

    left_dtype = _dtype_of(json.loads(left["columns_json"]), body.leftColumn)
    right_dtype = _dtype_of(json.loads(right["columns_json"]), body.rightColumn)
    if left_dtype is None:
        raise _validation_error("leftColumn", f"unknown_column: {body.leftColumn}")
    if right_dtype is None:
        raise _validation_error("rightColumn", f"unknown_column: {body.rightColumn}")
    if not _compatible(left_dtype, right_dtype):
        raise _validation_error(
            "rightColumn",
            f"incompatible_join_keys: {left_dtype} and {right_dtype} cannot join",
        )

    rid = _new_rel_id()
    created_at = _now_iso()
    try:
        with get_conn() as con:
            con.execute(
                "INSERT INTO relationships "
                "(id, workspace_id, left_dataset_id, left_column, "
                " right_dataset_id, right_column, cardinality, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    rid,
                    id,
                    body.leftDatasetId,
                    body.leftColumn,
                    body.rightDatasetId,
                    body.rightColumn,
                    body.cardinality,
                    created_at,
                ),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        # SQLite reports the violated column list (not the index name), e.g.
        # "UNIQUE constraint failed: relationships.workspace_id, ...".
        msg = str(err)
        if "UNIQUE constraint failed" in msg and "relationships." in msg:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorRelationshipExists().model_dump())
        raise

    created = Relationship(
        id=rid,
        workspaceId=id,
        leftDatasetId=body.leftDatasetId,
        leftColumn=body.leftColumn,
        rightDatasetId=body.rightDatasetId,
        rightColumn=body.rightColumn,
        cardinality=body.cardinality,
        status="valid",
        createdAt=created_at,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=created.model_dump())


@router.get("/workspaces/{id}/relationships")
def list_relationships(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's relationships, most-recent first (computed status)."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM relationships WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
        items = [_relationship_from_row(con, r).model_dump() for r in rows]
    return JSONResponse(status_code=status.HTTP_200_OK, content=items)


@router.get("/relationships/{id}")
def get_relationship(id: RelIdPath) -> JSONResponse:  # noqa: A002
    """Return one relationship (with computed status). 404 if absent."""
    with get_conn() as con:
        row = con.execute("SELECT * FROM relationships WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        rel = _relationship_from_row(con, row)
    return JSONResponse(status_code=status.HTTP_200_OK, content=rel.model_dump())


@router.delete("/relationships/{id}")
def delete_relationship(id: RelIdPath) -> Response:  # noqa: A002
    """Delete a relationship. 404 if already absent."""
    with get_conn() as con:
        row = con.execute("SELECT id FROM relationships WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM relationships WHERE id = ?", (id,))
        con.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
