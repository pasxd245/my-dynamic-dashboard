"""R180 — metadata routes: read for everyone, write by token.

    GET    /metadata/{kind}/{noun_id}               → { entries, children? }
    PUT    /metadata/{kind}/{noun_id}/{namespace}   → the stored entry (201)
    DELETE /metadata/{kind}/{noun_id}/{namespace}   → 204

`kind` ∈ dataset · column · relationship · query · workflow · dashboard · widget.
A column's id is `<ds_id>:<name>`, a widget's `<dsh_id>:<wdg_id>`.

A write needs `Authorization: Bearer <token>` matching one of
`backend.metadata_tokens` (401 otherwise — the default install has none, so
writes are off), and the namespace must be in that token's list (403; `system`
is never writable). The server stamps `author` / `source` / `writtenAt` /
`definitionVersion`; a client-sent author is ignored (the body has no such
field — `extra=forbid`). The entry text is validated like a note widget's (safe
markdown subset) with a 64 KiB cap and a per-noun namespace cap (422
`metadata_invalid` + `reason`).

R197 (item 3.8) — the server stamps the triple anchor at write (`params` in the
body: the values the writer read under) and a read under `p.<name>=` answers
`current` plus a `state` per entry. Deletes elsewhere sweep orphans
(`app.metadata.sweep`).
"""

from __future__ import annotations

import json
from typing import Annotated, Literal

from fastapi import APIRouter, Header, Path, Request, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from app._config import CONFIG
from app.db import get_conn
from app import params as qparams
from app.metadata import (
    KINDS,
    MAX_NAMESPACES_PER_NOUN,
    RESERVED_NAMESPACE,
    anchor_for,
    children_for,
    entries_for,
    entry_dict,
    resolve_noun,
    validate_entry,
)
from app.models.common import ApiErrorForbidden, ApiErrorMetadataInvalid, ApiErrorNotFound, ApiErrorUnauthorized
from app.routers._shared import _now_iso
from app.saved_copies import read_only_refusal

router = APIRouter(tags=["metadata"])

Kind = Literal["dataset", "column", "relationship", "query", "workflow", "dashboard", "widget"]
NounIdPath = Annotated[str, Path(min_length=1, max_length=400)]
NamespacePath = Annotated[str, Path(min_length=1, max_length=64)]


class MetadataWriteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    md: str = Field(max_length=70_000)  # the byte cap (64 KiB) is checked in validate_entry
    # R197 — the values the writer read under (a reader's `p.<name>`); resolved by the server.
    params: dict[Annotated[str, Field(max_length=32)], Annotated[str, Field(max_length=256)] | int | float] | None = (
        Field(default=None, max_length=8)
    )


def _token_for(authorization: str | None):
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    secret = authorization[7:].strip()
    for tok in CONFIG.settings.backend.metadata_tokens:
        if tok.token == secret:
            return tok
    return None


def _not_found() -> JSONResponse:
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content=ApiErrorNotFound().model_dump())


@router.get("/metadata/{kind}/{noun_id}")
def read_metadata(kind: Kind, noun_id: NounIdPath, request: Request) -> JSONResponse:
    """Every entry on the noun, keyed by namespace, each with `stale` and, R197,
    `state` computed against the reader's anchor (`current`, built under the
    `p.<name>=` values); a dataset / dashboard also returns its columns' /
    widgets' entries under `children` and their anchors under `childrenCurrent`."""
    assert kind in KINDS  # noqa: S101 — the Literal already narrows; keeps the map honest
    viewer = {k[2:]: v for k, v in request.query_params.items() if k.startswith("p.") and len(k) > 2}
    with get_conn() as con:
        noun = resolve_noun(con, kind, noun_id)
        if noun is None:
            return _not_found()
        current, _assumed = anchor_for(con, noun, viewer, strict=False)
        body: dict = {"entries": entries_for(con, noun, current), "current": current}
        kids = children_for(con, noun, viewer)
        if kids is not None:
            body["children"], currents = kids
            if currents:
                body["childrenCurrent"] = currents
    return JSONResponse(status_code=status.HTTP_200_OK, content=body)


@router.put("/metadata/{kind}/{noun_id}/{namespace}")
def write_metadata(
    kind: Kind,
    noun_id: NounIdPath,
    namespace: NamespacePath,
    body: MetadataWriteBody,
    authorization: Annotated[str | None, Header()] = None,
) -> JSONResponse:
    tok = _token_for(authorization)
    if tok is None:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content=ApiErrorUnauthorized().model_dump())
    if namespace == RESERVED_NAMESPACE or namespace not in tok.namespaces:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content=ApiErrorForbidden().model_dump())
    invalid = validate_entry(namespace, body.md)
    if invalid is not None:
        reason, problems = invalid
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=ApiErrorMetadataInvalid(reason=reason, problems=problems or None).model_dump(exclude_none=True),  # type: ignore[arg-type]
        )
    with get_conn() as con:
        noun = resolve_noun(con, kind, noun_id)
        if noun is None:
            return _not_found()
        # R193 — a saved copy's notes are frozen with it.
        if (ro := read_only_refusal(workspaces=[noun.workspace_id], con=con)) is not None:
            return ro
        existing = con.execute(
            "SELECT namespace FROM metadata_entries WHERE kind = ? AND noun_id = ?", (kind, noun_id)
        ).fetchall()
        names = {r["namespace"] for r in existing}
        if namespace not in names and len(names) >= MAX_NAMESPACES_PER_NOUN:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=ApiErrorMetadataInvalid(reason="namespace_cap").model_dump(exclude_none=True),
            )
        # R197 — the anchor, from the noun's state now under the writer's values.
        try:
            anchor, assumed = anchor_for(con, noun, body.params, strict=True)
        except qparams.ParamError as err:
            return err.response()
        if assumed:
            anchor["assumedParams"] = assumed
        now = _now_iso()
        con.execute(
            """INSERT INTO metadata_entries
                 (kind, noun_id, namespace, md, source, author, written_at, definition_version, anchor_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(kind, noun_id, namespace) DO UPDATE SET
                 md = excluded.md, source = excluded.source, author = excluded.author,
                 written_at = excluded.written_at, definition_version = excluded.definition_version,
                 anchor_json = excluded.anchor_json""",
            (
                kind,
                noun_id,
                namespace,
                body.md,
                tok.source,
                tok.author,
                now,
                noun.definition_version,
                json.dumps(anchor, ensure_ascii=False, separators=(",", ":")),
            ),
        )
        con.commit()
        row = con.execute(
            "SELECT * FROM metadata_entries WHERE kind = ? AND noun_id = ? AND namespace = ?",
            (kind, noun_id, namespace),
        ).fetchone()
        content = entry_dict(row, {k: v for k, v in anchor.items() if k != "assumedParams"})
    return JSONResponse(status_code=status.HTTP_201_CREATED, content=content)


@router.delete("/metadata/{kind}/{noun_id}/{namespace}")
def delete_metadata(
    kind: Kind,
    noun_id: NounIdPath,
    namespace: NamespacePath,
    authorization: Annotated[str | None, Header()] = None,
) -> Response:
    """A writer retracts its own namespace's entry (same token rules as a write)."""
    tok = _token_for(authorization)
    if tok is None:
        return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content=ApiErrorUnauthorized().model_dump())
    if namespace == RESERVED_NAMESPACE or namespace not in tok.namespaces:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content=ApiErrorForbidden().model_dump())
    with get_conn() as con:
        noun = resolve_noun(con, kind, noun_id)
        if noun is not None and (ro := read_only_refusal(workspaces=[noun.workspace_id], con=con)) is not None:
            return ro
        cur = con.execute(
            "DELETE FROM metadata_entries WHERE kind = ? AND noun_id = ? AND namespace = ?",
            (kind, noun_id, namespace),
        )
        con.commit()
        if cur.rowcount == 0:
            return _not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
