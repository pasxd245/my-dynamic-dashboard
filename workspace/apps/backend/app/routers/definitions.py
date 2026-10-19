"""R201 (item 4.8) — the definition pack routes.

- ``GET  /workspaces/{id}/definitions``        — export the workspace's pack.
- ``POST /workspaces/{id}/definitions/import`` — import a pack (dry run first).

Contracts: workspaces/definitions-get + definitions-import. The import reads the
raw body itself, in bounded chunks (size before parsing → JSON → version → the total cap → the
closed shape …, BA-C3), then plans and writes the whole pack in ONE
``BEGIN IMMEDIATE`` transaction through the routes' own create / update bodies
(``app.definition_pack``). An unexpected error — a bug, or a writer holding the
lock past the connection's busy timeout — leaves the transaction uncommitted
and answers the app's ``500 internal_error`` (BA C9): nothing is written.
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Header, Query, Request, status
from fastapi import Path as FastApiPath
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from app import history
from app._generated.constants import ID_PATTERNS, PACK_MAX_BYTES
from app.db import get_conn
from app.definition_pack import PackInvalid, PackUnresolved, export_pack, plan_import, read_pack
from app.models.common import ApiErrorNotFound
from app.saved_copies import read_only_refusal

router = APIRouter(tags=["definitions"])

WsIdPath = Annotated[str, FastApiPath(pattern=ID_PATTERNS["workspace"])]


def _workspace_exists(workspace_id: str) -> bool:
    with get_conn() as con:
        return con.execute("SELECT 1 FROM workspaces WHERE id = ?", (workspace_id,)).fetchone() is not None


def _not_found() -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())


@router.get("/workspaces/{id}/definitions")
def export_definitions(id: WsIdPath) -> JSONResponse:  # noqa: A002
    """The workspace's definition pack (a saved workspace too — a read). 409
    ``pack_unresolved`` when a definition names a deleted noun."""
    with get_conn() as con:
        if con.execute("SELECT 1 FROM workspaces WHERE id = ?", (id,)).fetchone() is None:
            return _not_found()
        # CR-4 — one read transaction: every listing sees the same snapshot.
        con.execute("BEGIN")
        try:
            pack = export_pack(con, id)
        except PackUnresolved as exc:
            return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=exc.body)
        finally:
            con.rollback()
    return JSONResponse(status_code=status.HTTP_200_OK, content=pack)


def _run_import(
    workspace_id: str,
    raw: bytes,
    dry_run: bool,
    on_conflict: str,
    expected_plan: str | None,
    writer: tuple[str | None, str | None],
) -> JSONResponse:
    try:
        pack = read_pack(raw)
    except PackInvalid as exc:
        return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=exc.body)
    with get_conn() as con:
        con.execute("BEGIN IMMEDIATE")
        plan = plan_import(con, workspace_id, pack, on_conflict, writer)
        if dry_run:
            con.rollback()
            return JSONResponse(
                status_code=status.HTTP_200_OK, content=_without_new_ids({"dryRun": True, "applied": False, **plan})
            )
        refused = {"dryRun": False, "applied": False, **plan}
        if expected_plan is not None and expected_plan != plan["planHash"]:
            con.rollback()  # BA C10 — not the plan the client showed
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={"code": "pack_refused", "reason": "plan_changed", "plan": _without_new_ids(refused)},
            )
        if not plan["ok"]:
            con.rollback()  # whole pack or nothing
            return JSONResponse(
                status_code=status.HTTP_409_CONFLICT,
                content={"code": "pack_refused", "reason": "not_ok", "plan": _without_new_ids(refused)},
            )
        con.commit()
    return JSONResponse(status_code=status.HTTP_200_OK, content={"dryRun": False, "applied": True, **plan})


def _without_new_ids(plan: dict) -> dict:
    """A rolled-back plan names no id it minted (a `create` that was not kept)."""
    return {
        **plan,
        "items": [
            {k: v for k, v in it.items() if not (k == "id" and it["action"] == "create")} for it in plan["items"]
        ],
    }


@router.post("/workspaces/{id}/definitions/import")
async def import_definitions(
    id: WsIdPath,  # noqa: A002
    request: Request,
    dryRun: bool = False,  # noqa: N803 — wire name
    onConflict: Literal["refuse", "replace", "skip"] = "refuse",  # noqa: N803
    expectedPlan: Annotated[str | None, Query(pattern=r"^[0-9a-f]{12}$")] = None,  # noqa: N803
    authorization: Annotated[str | None, Header()] = None,
) -> JSONResponse:
    """Import a pack by name into a main workspace — dry run (200 plan, nothing
    written) or apply (200 plan, every item but the deferred ones written; 409
    ``pack_refused`` with the plan otherwise). 422 ``pack_invalid`` when the
    pack cannot be read; 409 ``read_only_workspace`` for a saved workspace."""
    if not await run_in_threadpool(_workspace_exists, id):
        return _not_found()
    if (ro := await run_in_threadpool(lambda: read_only_refusal(workspaces=[id]))) is not None:
        return ro
    # BA-C3 — the size first, before parsing; a declared size over the cap is
    # refused before a byte of the body is read.
    too_large = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"code": "pack_invalid", "reason": "too_large", "problems": []},
    )
    declared = request.headers.get("content-length")
    if declared is not None and declared.isdigit() and int(declared) > PACK_MAX_BYTES:
        return too_large
    # CR-3 — a body without (or under-declaring) Content-Length is read in chunks
    # and refused as soon as it passes the cap: never buffered past cap + 1 chunk.
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > PACK_MAX_BYTES:
            return too_large
        chunks.append(chunk)
    raw = b"".join(chunks)
    return await run_in_threadpool(
        _run_import, id, raw, dryRun, onConflict, expectedPlan, history.writer_of(authorization)
    )
