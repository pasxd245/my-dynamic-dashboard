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
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Header, Path, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field

from app._config import CONFIG
from app.db import get_conn
from app.metadata import (
    KINDS,
    MAX_NAMESPACES_PER_NOUN,
    RESERVED_NAMESPACE,
    children_for,
    entries_for,
    entry_dict,
    resolve_noun,
    validate_entry,
)
from app.models.common import ApiErrorForbidden, ApiErrorMetadataInvalid, ApiErrorNotFound, ApiErrorUnauthorized
from app.routers._shared import _now_iso

router = APIRouter(tags=["metadata"])

Kind = Literal["dataset", "column", "relationship", "query", "workflow", "dashboard", "widget"]
NounIdPath = Annotated[str, Path(min_length=1, max_length=400)]
NamespacePath = Annotated[str, Path(min_length=1, max_length=64)]


class MetadataWriteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    md: str = Field(max_length=70_000)  # the byte cap (64 KiB) is checked in validate_entry


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
def read_metadata(kind: Kind, noun_id: NounIdPath) -> JSONResponse:
    """Every entry on the noun, keyed by namespace, each with `stale` computed
    against the noun's current definition; a dataset / dashboard also returns
    its columns' / widgets' entries under `children`."""
    assert kind in KINDS  # noqa: S101 — the Literal already narrows; keeps the map honest
    with get_conn() as con:
        noun = resolve_noun(con, kind, noun_id)
        if noun is None:
            return _not_found()
        body: dict = {"entries": entries_for(con, noun)}
        children = children_for(con, noun)
        if children is not None:
            body["children"] = children
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
        existing = con.execute(
            "SELECT namespace FROM metadata_entries WHERE kind = ? AND noun_id = ?", (kind, noun_id)
        ).fetchall()
        names = {r["namespace"] for r in existing}
        if namespace not in names and len(names) >= MAX_NAMESPACES_PER_NOUN:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content=ApiErrorMetadataInvalid(reason="namespace_cap").model_dump(exclude_none=True),
            )
        now = _now_iso()
        con.execute(
            """INSERT INTO metadata_entries (kind, noun_id, namespace, md, source, author, written_at, definition_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(kind, noun_id, namespace) DO UPDATE SET
                 md = excluded.md, source = excluded.source, author = excluded.author,
                 written_at = excluded.written_at, definition_version = excluded.definition_version""",
            (kind, noun_id, namespace, body.md, tok.source, tok.author, now, noun.definition_version),
        )
        con.commit()
        row = con.execute(
            "SELECT * FROM metadata_entries WHERE kind = ? AND noun_id = ? AND namespace = ?",
            (kind, noun_id, namespace),
        ).fetchone()
        content = entry_dict(row, noun.definition_version)
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
        cur = con.execute(
            "DELETE FROM metadata_entries WHERE kind = ? AND noun_id = ? AND namespace = ?",
            (kind, noun_id, namespace),
        )
        con.commit()
        if cur.rowcount == 0:
            return _not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
