# `POST /workspaces` — contract rationale

> **Authoritative shape**: [post.contract.yaml](post.contract.yaml).

## Purpose

Creates a new workspace from a user-supplied name. The
workspace's `id` and `createdAt` are server-stamped (the client
does not propose either). On success, returns the full
`Workspace` so the client can append it to a list without a
follow-up `GET`.

## Behavior

- **Not idempotent.** Two identical POSTs create two workspaces.
- **Globally unique `name`.** _(R25 tightening.)_ Workspace
  names must be unique across all workspaces; a collision
  returns 409 `name_taken`. The R13 contract originally
  allowed duplicates (silent dup-allow); R25 added the unique
  index `idx_workspaces_name_unique` and tightened the create
  path to surface the conflict. Any pre-existing duplicates
  are auto-resolved at startup via the back-fill in
  [`app/db.py`](../../../apps/backend/app/db.py) (older row
  keeps the name; newer rows get `<name> (2)`, `<name> (3)`
  suffixes; rename logged to stdout). Clients should treat
  the 409 the same way they treat
  [`PATCH /workspaces/{id}` § 409](../workspaces/patch.contract.md).
- **`id` format**: `ws_<8 lowercase hex>` (24 bits of entropy).
  Single-user product; collision probability is acceptable.
- **`createdAt`**: server-stamped at insert time, second-
  precision, ISO-8601 UTC with `Z` suffix. The format is
  sortable as a plain string — see
  [`workspace.yaml`](../_shared/workspace.yaml).
- **Concurrent creates**: from a single-user product's
  perspective, concurrency is not in scope. The R13 backend's
  Python-side append is not transactional; R16's persistence
  layer will gain proper transactional semantics.

## Error semantics

- **`422 Unprocessable Entity`**: returned by FastAPI's
  pydantic-validation layer for any of:
  - missing `name` field
  - `name` is empty string (`minLength: 1`)
  - `name` exceeds 80 characters (`maxLength: 80`)
  - `name` is not a string
  - request body is not valid JSON
  - request body contains unexpected top-level keys (the
    contract uses `additionalProperties: false`; the live R13
    backend currently accepts extras — R16's BE round will tighten
    that as a conformance fix)

The 422 body is FastAPI's default `{ "detail": [...] }` envelope;
the contract does not narrow it further because the FastAPI
shape is well-known and the client doesn't depend on individual
field-level messages.

## Examples

Happy path:

```http
POST /workspaces HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{ "name": "Marketing" }
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": "ws_3f8a2c91",
  "name": "Marketing",
  "createdAt": "2026-05-24T11:23:45Z"
}
```

Validation failure:

```http
POST /workspaces HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{ "name": "" }
```

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{ "detail": [ /* FastAPI-shaped error array */ ] }
```

## Cross-links

- [get.contract.yaml](get.contract.yaml) — list companion
- [workspaces.md](../../../../.agents/design/data-management/workspaces.md) — design doc
- [Round_13](../../../../.agents/plan/cycles/Round_13.md) — round of origin
