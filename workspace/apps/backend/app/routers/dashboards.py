"""Dashboards router — R101 dashboard-as-a-persisted-noun.

Five endpoints (see workspace/packages/contracts/dashboards/*):

- ``POST   /workspaces/{id}/dashboards`` — create a dashboard.
- ``GET    /workspaces/{id}/dashboards`` — list, most-recent-first.
- ``GET    /dashboards/{id}``            — one dashboard (id-keyed).
- ``PUT    /dashboards/{id}``            — full-representation update.
- ``DELETE /dashboards/{id}``            — delete (204).

A Dashboard is workspace-scoped; its widgets live in the embedded-JSON
``definition`` (mirrors ``queries.definition``; no widgets table). Both ``name``
and ``slug`` are unique PER WORKSPACE (the route nests the project —
``/dashboards/<ws_id>/<slug>``). Each widget binds a saved Query by ``queryId``,
which must reference a query in the dashboard's OWN workspace at save time
(cross-workspace widgets constrained out); a later delete of that query is
tolerated and renders the per-widget "unavailable" state on the FE. Persistence
is raw-SQLite + Pydantic, the established backend standard (see queries.py).
"""

from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import ID_PATTERNS
from app.db import get_conn
from app.models.common import (
    ApiErrorNameTaken,
    ApiErrorNotFound,
    ApiErrorSlugTaken,
    CreateDashboardBody,
    Dashboard as DashboardModel,
    DashboardDefinition,
    UpdateDashboardBody,
)


router = APIRouter(tags=["dashboards"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
DashboardIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["dashboard"])]

_SELECT_DASHBOARD = "SELECT * FROM dashboards WHERE id = ?"


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _new_dsh_id() -> str:
    return f"dsh_{secrets.token_hex(4)}"


def _collision_code(err: sqlite3.IntegrityError) -> str | None:
    """Map a SQLite UNIQUE-violation to its field. The error names the violated
    index's columns (e.g. 'UNIQUE constraint failed: dashboards.workspace_id,
    dashboards.slug'), so the trailing column disambiguates name vs slug."""
    s = str(err)
    if "dashboards.slug" in s:
        return "slug_taken"
    if "dashboards.name" in s:
        return "name_taken"
    return None


def _validate_widget_queries(
    con: sqlite3.Connection, workspace_id: str, definition: dict
) -> None:
    """Every widget's ``queryId`` must reference a saved query in THIS workspace
    (cross-workspace widgets are constrained out). A dangling / cross-workspace
    id is a malformed definition → 422 (you can't save a widget pointing at a
    query that isn't here). A query deleted AFTER save is tolerated at render —
    that's the FE's per-widget "unavailable" state, not a save-time block."""
    for widget in definition.get("widgets", []):
        qid = widget["queryId"]
        row = con.execute(
            "SELECT workspace_id FROM queries WHERE id = ?", (qid,)
        ).fetchone()
        if row is None or row["workspace_id"] != workspace_id:
            raise HTTPException(
                status_code=422,
                detail=[
                    {
                        "loc": ["body", "definition", "widgets"],
                        "msg": f"unknown_query: {qid} is not a query in workspace {workspace_id}",
                        "type": "value_error",
                    }
                ],
            )


def _dashboard_from_row(row: sqlite3.Row) -> DashboardModel:
    return DashboardModel(
        id=row["id"],
        workspaceId=row["workspace_id"],
        name=row["name"],
        slug=row["slug"],
        definition=DashboardDefinition(**json.loads(row["definition_json"])),
        createdAt=row["created_at"],
    )


@router.post("/workspaces/{id}/dashboards", status_code=status.HTTP_201_CREATED)
def create_dashboard(id: WsIdPath, body: CreateDashboardBody) -> JSONResponse:  # noqa: A002
    """Create a dashboard. Every widget's query must exist in this workspace
    (422 otherwise). Name + slug are unique per-workspace (409 on collision)."""
    definition_dict = body.definition.model_dump()
    with get_conn() as con:
        _validate_widget_queries(con, id, definition_dict)

    dsh_id = _new_dsh_id()
    created_at = _now_iso()
    definition_json = json.dumps(definition_dict)
    try:
        with get_conn() as con:
            con.execute(
                "INSERT INTO dashboards "
                "(id, workspace_id, name, slug, definition_json, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (dsh_id, id, body.name, body.slug, definition_json, created_at),
            )
            con.commit()
    except sqlite3.IntegrityError as err:
        code = _collision_code(err)
        if code == "name_taken":
            return JSONResponse(status_code=409, content=ApiErrorNameTaken().model_dump())
        if code == "slug_taken":
            return JSONResponse(status_code=409, content=ApiErrorSlugTaken().model_dump())
        raise

    created = DashboardModel(
        id=dsh_id,
        workspaceId=id,
        name=body.name,
        slug=body.slug,
        definition=body.definition,
        createdAt=created_at,
    )
    return JSONResponse(status_code=201, content=created.model_dump(exclude_none=True))


@router.get("/workspaces/{id}/dashboards")
def list_dashboards(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's dashboards, most-recent first."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM dashboards WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
        items = [_dashboard_from_row(r).model_dump(exclude_none=True) for r in rows]
    return JSONResponse(status_code=200, content=items)


@router.get("/dashboards/{id}")
def get_dashboard(id: DashboardIdPath) -> JSONResponse:  # noqa: A002
    """Return one dashboard (definition + metadata) by its stable id."""
    with get_conn() as con:
        row = con.execute(_SELECT_DASHBOARD, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        content = _dashboard_from_row(row).model_dump(exclude_none=True)
    return JSONResponse(status_code=200, content=content)


@router.put("/dashboards/{id}")
def update_dashboard(id: DashboardIdPath, body: UpdateDashboardBody) -> JSONResponse:  # noqa: A002
    """Full-representation update of name + slug + definition (every FE mutation
    resends the whole dashboard). Same guards as create: widget queries must be
    in-workspace (422); name + slug unique per-workspace (409)."""
    definition_dict = body.definition.model_dump()
    with get_conn() as con:
        row = con.execute(_SELECT_DASHBOARD, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        _validate_widget_queries(con, row["workspace_id"], definition_dict)

    definition_json = json.dumps(definition_dict)
    try:
        with get_conn() as con:
            con.execute(
                "UPDATE dashboards SET name = ?, slug = ?, definition_json = ? WHERE id = ?",
                (body.name, body.slug, definition_json, id),
            )
            con.commit()
            updated = _dashboard_from_row(con.execute(_SELECT_DASHBOARD, (id,)).fetchone())
    except sqlite3.IntegrityError as err:
        code = _collision_code(err)
        if code == "name_taken":
            return JSONResponse(status_code=409, content=ApiErrorNameTaken().model_dump())
        if code == "slug_taken":
            return JSONResponse(status_code=409, content=ApiErrorSlugTaken().model_dump())
        raise

    return JSONResponse(status_code=200, content=updated.model_dump(exclude_none=True))


@router.delete("/dashboards/{id}")
def delete_dashboard(id: DashboardIdPath) -> Response:  # noqa: A002
    """Delete a dashboard. 404 if already absent. The referenced queries are
    untouched (a widget points AT a query; the query has no back-reference)."""
    with get_conn() as con:
        row = con.execute("SELECT id FROM dashboards WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=404, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM dashboards WHERE id = ?", (id,))
        con.commit()
    return Response(status_code=204)
