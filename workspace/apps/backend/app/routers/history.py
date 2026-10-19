"""R200 (item 4.4) — read a query's, dashboard's or workflow's definition history.

`GET /{queries,dashboards,workflows}/{id}/history` lists every saved definition
newest first (`seq DESC`) with the noun's `current` version;
`GET …/history/{version}` returns the newest row with that version and the
definition as stored (plus, for a query, `sourceChangedSince` — BA-C2). The
rows are written by the create / update routes (`app.history`); nothing writes
through here. Restore is the noun's ordinary PUT. Contracts:
`packages/contracts/{queries,dashboards,workflows}/history-get.contract.yaml`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse

from app import history
from app._generated.constants import ID_PATTERNS
from app.db import get_conn
from app.models.common import ApiErrorNotFound

router = APIRouter(tags=["history"])

QueryIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["query"])]
DashboardIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["dashboard"])]
WfIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workflow"])]
VersionPath = Annotated[str, FastApiPath(pattern=r"^[0-9a-f]{12}$")]


def _not_found() -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())


def _list(kind: str, noun_id: str) -> JSONResponse:
    with get_conn() as con:
        current = history.current_version(con, kind, noun_id)
        if current is None:
            return _not_found()
        body = {"kind": kind, "id": noun_id, "current": current, "entries": history.entries(con, kind, noun_id)}
    return JSONResponse(status_code=status.HTTP_200_OK, content=body)


def _version(kind: str, noun_id: str, version: str) -> JSONResponse:
    with get_conn() as con:
        if history.current_version(con, kind, noun_id) is None:
            return _not_found()
        found = history.version_row(con, kind, noun_id, version)
        if found is None:
            return _not_found()
        entry, definition = found
        body = {**entry, "definition": definition}
        if kind == "query":
            body["sourceChangedSince"] = history.source_changed_since(con, noun_id, definition, entry)
    return JSONResponse(status_code=status.HTTP_200_OK, content=body)


@router.get("/queries/{id}/history")
def query_history(id: QueryIdPath) -> JSONResponse:  # noqa: A002
    """A query's saved definitions, newest first."""
    return _list("query", id)


@router.get("/queries/{id}/history/{version}")
def query_history_version(id: QueryIdPath, version: VersionPath) -> JSONResponse:  # noqa: A002
    """One past definition of a query, read-only, with `sourceChangedSince`."""
    return _version("query", id, version)


@router.get("/dashboards/{id}/history")
def dashboard_history(id: DashboardIdPath) -> JSONResponse:  # noqa: A002
    """A dashboard's saved definitions, newest first."""
    return _list("dashboard", id)


@router.get("/dashboards/{id}/history/{version}")
def dashboard_history_version(id: DashboardIdPath, version: VersionPath) -> JSONResponse:  # noqa: A002
    """One past definition of a dashboard, read-only."""
    return _version("dashboard", id, version)


@router.get("/workflows/{id}/history")
def workflow_history(id: WfIdPath) -> JSONResponse:  # noqa: A002
    """A workflow's saved definitions, newest first."""
    return _list("workflow", id)


@router.get("/workflows/{id}/history/{version}")
def workflow_history_version(id: WfIdPath, version: VersionPath) -> JSONResponse:  # noqa: A002
    """One past definition of a workflow, read-only."""
    return _version("workflow", id, version)
