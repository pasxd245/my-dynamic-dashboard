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
from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse, Response

from app._generated.constants import ID_PATTERNS
from app import params as qparams
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
from app.saved_copies import read_only_refusal
from app.metadata import sweep as metadata_sweep
from app.routers._shared import _now_iso


router = APIRouter(tags=["dashboards"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]
DashboardIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["dashboard"])]

_SELECT_DASHBOARD = "SELECT * FROM dashboards WHERE id = ?"


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


def _validate_widget_queries(con: sqlite3.Connection, workspace_id: str, definition: dict) -> None:
    """Every widget's ``queryId`` must reference a saved query in THIS workspace
    (cross-workspace widgets are constrained out). A dangling / cross-workspace
    id is a malformed definition → 422 (you can't save a widget pointing at a
    query that isn't here). A query deleted AFTER save is tolerated at render —
    that's the FE's per-widget "unavailable" state, not a save-time block."""
    for widget in definition.get("widgets", []):
        qid = widget.get("queryId")
        if qid is None:  # R179 — a `note` binds no query (the model enforced the kind).
            continue
        row = con.execute("SELECT workspace_id FROM queries WHERE id = ?", (qid,)).fetchone()
        if row is None or row["workspace_id"] != workspace_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=[
                    {
                        "loc": ["body", "definition", "widgets"],
                        "msg": f"unknown_query: {qid} is not a query in workspace {workspace_id}",
                        "type": "value_error",
                    }
                ],
            )


def _validate_controls(con: sqlite3.Connection, workspace_id: str, definition: dict) -> None:
    """R195 (D4) — the controls a save may hold: unique ids and parameter names,
    targets that are widgets of this dashboard (no note), and a saved value of the
    parameter's type in the targeted queries that use it (422 naming the field).
    R198 — a ``date_range`` control binds two distinct date parameters; its saved
    period must resolve and run forwards. R199 — one ``values`` control per
    column (``duplicate_column``); its column is not checked against the queries."""
    controls = definition.get("controls") or []
    widgets = {w["id"]: w for w in definition.get("widgets", [])}

    def bad(i: int, field: str, msg: str) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[{"loc": ["body", "definition", "controls", i, field], "msg": msg, "type": "value_error"}],
        )

    seen_ids: set[str] = set()
    seen_params: set[str] = set()
    seen_columns: set[str] = set()
    for i, c in enumerate(controls):
        if c["id"] in seen_ids:
            raise bad(i, "id", f"duplicate_control: {c['id']} appears twice")
        seen_ids.add(c["id"])
        is_range = c["kind"] == "date_range"
        is_values = c["kind"] == "values"
        if is_range and c["from"] == c["to"]:
            raise bad(i, "to", "range_same_param: from and to must be two different parameters")
        if is_values:
            # R199 (D4) — one shared filter per column, as one control per parameter.
            if c["column"] in seen_columns:
                raise bad(i, "column", f"duplicate_column: one values control per column ({c['column']!r})")
            seen_columns.add(c["column"])
            bound: tuple = ()
        else:
            bound = (("from", c["from"]), ("to", c["to"])) if is_range else (("param", c["param"]),)
        for field, name in bound:
            if name in seen_params:
                raise bad(i, field, f"duplicate_param: one control per parameter ({name!r})")
            seen_params.add(name)
        targets = list(widgets) if c["targets"] == "all" else c["targets"]
        if c["targets"] != "all" and len(set(targets)) != len(targets):
            raise bad(i, "targets", "duplicate_target: a widget is listed twice")
        for wid in targets:
            if wid not in widgets:
                raise bad(i, "targets", f"unknown_widget: {wid} is not a widget of this dashboard")
        if is_values:
            # The column is NOT checked against the targeted queries: a result that
            # lacks it skips the filter at read (D5), so a control may be added
            # before a query grows the column.
            continue
        if is_range:
            _validate_range_control(con, workspace_id, widgets, targets, i, c, bad)
            continue
        if c.get("saved") is None:
            continue
        for wid in targets:
            qid = widgets[wid].get("queryId")
            if qid is None:
                continue
            row = con.execute(
                "SELECT workspace_id, source_id, definition_json FROM queries WHERE id = ?", (qid,)
            ).fetchone()
            if row is None or row["workspace_id"] != workspace_id:
                continue
            qdef = json.loads(row["definition_json"])
            decl = qparams.declared(qdef).get(c["param"])
            if decl is None or c["param"] not in qparams.used(qdef):
                continue
            try:
                value = qparams.coerce(decl["type"], c["saved"], allow_relative=True)
            except (ValueError, TypeError):
                raise bad(i, "saved", f"param_type: the saved value is not a {decl['type']}") from None
            # A number on an integer column must be whole (R194's read rule, checked at save).
            if isinstance(value, float) and not value.is_integer():
                if _integer_site(con, row, qdef, c["param"]):
                    raise bad(i, "saved", "param_type: the saved value must be a whole number here")
            if qparams._is_relative(c["saved"]) and decl["type"] != "date":
                raise bad(i, "saved", "param_type: a relative value is for date parameters")


def _validate_range_control(
    con: sqlite3.Connection,
    workspace_id: str,
    widgets: dict[str, dict],
    targets: list[str],
    i: int,
    c: dict,
    bad: Callable[[int, str, str], HTTPException],
) -> None:
    """R198 — each targeted query that uses `from` or `to` declares it as a
    `date`; a saved period resolves (presets in the zone, a pair's bounds valid)
    and its `to` is not before its `from`."""
    for wid in targets:
        qid = widgets[wid].get("queryId")
        if qid is None:
            continue
        row = con.execute("SELECT workspace_id, definition_json FROM queries WHERE id = ?", (qid,)).fetchone()
        if row is None or row["workspace_id"] != workspace_id:
            continue
        qdef = json.loads(row["definition_json"])
        decls, used = qparams.declared(qdef), qparams.used(qdef)
        for field in ("from", "to"):
            decl = decls.get(c[field])
            if decl is not None and c[field] in used and decl["type"] != "date":
                raise bad(i, field, f"param_type: {c[field]!r} is a {decl['type']} parameter, not a date")
    if c.get("saved") is None:
        return
    try:
        rng = qparams.resolve_range(c["saved"])
    except (ValueError, TypeError):
        raise bad(i, "saved", "param_type: the saved period is not two dates") from None
    if rng is not None and rng[1] < rng[0]:
        raise bad(i, "saved", "range_reversed: the saved period ends before it starts")


def _integer_site(con: sqlite3.Connection, qrow: sqlite3.Row, qdef: dict, name: str) -> bool:
    """Does the query use ``name`` on an integer column? (Resolved against its
    current columns; a query that no longer resolves answers no.)"""
    from app.query_engine import _chain_of, _rels_of, _resolve_plan  # local: avoid an import cycle

    plan, reason = _resolve_plan(con, qrow["source_id"], _chain_of(qdef), _rels_of(qdef), qrow["workspace_id"])
    if reason is not None or plan is None:
        return False
    dtypes = qparams.site_dtypes(qdef, plan["columns"])
    for site in qparams._sites(qdef):
        if any(n == name for _, n in qparams._refs(site)) and dtypes.get(site.loc) == "integer":
            return True
    return False


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
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(workspaces=[id])) is not None:
        return ro
    definition_dict = body.definition.model_dump()
    with get_conn() as con:
        _validate_widget_queries(con, id, definition_dict)
        _validate_controls(con, id, definition_dict)  # R195

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
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
        if code == "slug_taken":
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorSlugTaken().model_dump())
        raise

    created = DashboardModel(
        id=dsh_id,
        workspaceId=id,
        name=body.name,
        slug=body.slug,
        definition=body.definition,
        createdAt=created_at,
    )
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=created.model_dump(exclude_none=True))


@router.get("/workspaces/{id}/dashboards")
def list_dashboards(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """List a workspace's dashboards, most-recent first."""
    with get_conn() as con:
        rows = con.execute(
            "SELECT * FROM dashboards WHERE workspace_id = ? ORDER BY created_at DESC, id DESC",
            (id,),
        ).fetchall()
        items = [_dashboard_from_row(r).model_dump(exclude_none=True) for r in rows]
    return JSONResponse(status_code=status.HTTP_200_OK, content=items)


@router.get("/dashboards/{id}")
def get_dashboard(id: DashboardIdPath) -> JSONResponse:  # noqa: A002
    """Return one dashboard (definition + metadata) by its stable id."""
    with get_conn() as con:
        row = con.execute(_SELECT_DASHBOARD, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        content = _dashboard_from_row(row).model_dump(exclude_none=True)
    return JSONResponse(status_code=status.HTTP_200_OK, content=content)


@router.put("/dashboards/{id}")
def update_dashboard(id: DashboardIdPath, body: UpdateDashboardBody) -> JSONResponse:  # noqa: A002
    """Full-representation update of name + slug + definition (every FE mutation
    resends the whole dashboard). Same guards as create: widget queries must be
    in-workspace (422); name + slug unique per-workspace (409)."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(dashboards=[id])) is not None:
        return ro
    definition_dict = body.definition.model_dump()
    with get_conn() as con:
        row = con.execute(_SELECT_DASHBOARD, (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        _validate_widget_queries(con, row["workspace_id"], definition_dict)
        _validate_controls(con, row["workspace_id"], definition_dict)  # R195

    definition_json = json.dumps(definition_dict)
    try:
        with get_conn() as con:
            con.execute(
                "UPDATE dashboards SET name = ?, slug = ?, definition_json = ? WHERE id = ?",
                (body.name, body.slug, definition_json, id),
            )
            # R197 (3.8) — a widget removed here takes its metadata entries with it.
            metadata_sweep(con, _now_iso())
            con.commit()
            updated = _dashboard_from_row(con.execute(_SELECT_DASHBOARD, (id,)).fetchone())
    except sqlite3.IntegrityError as err:
        code = _collision_code(err)
        if code == "name_taken":
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorNameTaken().model_dump())
        if code == "slug_taken":
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=ApiErrorSlugTaken().model_dump())
        raise

    return JSONResponse(status_code=status.HTTP_200_OK, content=updated.model_dump(exclude_none=True))


@router.delete("/dashboards/{id}")
def delete_dashboard(id: DashboardIdPath) -> Response:  # noqa: A002
    """Delete a dashboard. 404 if already absent. The referenced queries are
    untouched (a widget points AT a query; the query has no back-reference)."""
    # R193 — nothing inside a saved workspace can be changed.
    if (ro := read_only_refusal(dashboards=[id])) is not None:
        return ro
    with get_conn() as con:
        row = con.execute("SELECT id FROM dashboards WHERE id = ?", (id,)).fetchone()
        if row is None:
            return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())
        con.execute("DELETE FROM dashboards WHERE id = ?", (id,))
        # R197 (3.8) — its metadata entries go with it (archived in metadata_entries_swept).
        metadata_sweep(con, _now_iso())
        con.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
