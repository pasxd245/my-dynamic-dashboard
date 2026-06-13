# `PATCH /workspaces/{id}` — contract rationale

> **Authoritative shape**: [patch.contract.yaml](patch.contract.yaml).

## Purpose

Renames a workspace. Introduced by R23's CRUD hygiene chain
([crud-hygiene.md](../../../../.agents/design/data-management/_shared/crud-hygiene.md))
to close the rename gap deferred since R13. The mutation is
narrow by design — only `name` is mutable this round; other
fields (`createdAt`, `id`) are server-owned, and description /
metadata mutability are out of scope per
[crud-hygiene.md § Out of scope](../../../../.agents/design/data-management/_shared/crud-hygiene.md).

## Behavior

- **Partial update via PATCH.** Only `name` is in the request
  body. `PUT` would imply a whole-resource replacement; PATCH
  matches the actual intent (mutate one field, leave the rest).
- **Returns the updated `Workspace`** so the FE can replace
  cached state without a follow-up `GET`. Same shape the
  create endpoint uses.
- **Pessimistic UX on the FE side** (per R23 design Q4): the
  rename modal stays in loading state until the response
  lands; no optimistic update, no rollback path.
- **Global uniqueness on `name`.** Two workspaces cannot share
  a name. This is a behavior change from the existing
  `POST /workspaces` contract, which currently allows name
  duplicates ("not idempotent; same `name` permitted on
  multiple rows" — see [post.contract.md](post.contract.md)).
  The CRUD hygiene chain tightens this — R25 (BE) enforces
  uniqueness on both PATCH and the existing POST going
  forward; a follow-up note in R23 logs the back-fill
  decision for any pre-existing duplicate names (best read
  is: pick one to rename manually before R25 ships).

## Error semantics

- **`404 not_found`**: the path `id` does not match any
  workspace. Idempotent — repeated calls return the same 404.
- **`409 name_taken`**: another workspace owns the requested
  `name`. The workspace itself is unchanged; the FE renders
  an inline error in the rename modal (modal state 3 of the
  R23 preview) and the modal stays open for the user to edit.
- **`422`**: FastAPI's validation envelope for malformed
  bodies (missing `name`, empty `name`, length out of range,
  extra keys via `extra='forbid'`). Body shape is FastAPI's
  default — the FE treats any 422 generically.

The `404` and `409` bodies use the shared `ApiError` envelope
introduced by R24 in [\_shared/api-error.yaml](../_shared/api-error.yaml).
The FE branches on `code` directly without parsing free-text
messages.

## Examples

Happy path:

```http
PATCH /workspaces/ws_3f8a2c91 HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{ "name": "Marketing 2026" }
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "ws_3f8a2c91",
  "name": "Marketing 2026",
  "createdAt": "2026-05-21T09:12:00Z"
}
```

Name collision:

```http
PATCH /workspaces/ws_3f8a2c91 HTTP/1.1
Content-Type: application/json

{ "name": "Sales Ops" }
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{ "code": "name_taken" }
```

Missing workspace:

```http
PATCH /workspaces/ws_deadbeef HTTP/1.1
Content-Type: application/json

{ "name": "anything" }
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{ "code": "not_found" }
```

## Cross-links

- [delete.contract.yaml](delete.contract.yaml) — sibling
  CRUD verb (workspace deletion with 409 `non_empty` cascade
  rule).
- [datasets/patch.contract.yaml](../datasets/patch.contract.yaml)
  — parallel rename on the dataset resource.
- [crud-hygiene.md](../../../../.agents/design/data-management/_shared/crud-hygiene.md)
  — feature design.
- [Round_23](../../../../.agents/plan/cycles/Round_23.md) — D-round.
- [Round_24](../../../../.agents/plan/cycles/Round_24.md) — C-round (this contract).
