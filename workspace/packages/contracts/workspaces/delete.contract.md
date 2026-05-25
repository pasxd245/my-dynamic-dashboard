# `DELETE /workspaces/{id}` — contract rationale

> **Authoritative shape**: [delete.contract.yaml](delete.contract.yaml).

## Purpose

Deletes a workspace. Introduced by R23's CRUD hygiene chain to
close the delete gap deferred since R13. The cascade rule was
the load-bearing design question of R23 and was resolved as
**block-on-non-empty** — workspaces with datasets cannot be
deleted directly. See
[crud-hygiene.md § Open questions answered in R23](../../../.agents/design/data-management/crud-hygiene.md)
for the decision rationale.

## Behavior

- **204 No Content on success.** No response body. The FE
  invalidates both `['workspaces']` and `['datasets']` TanStack
  queries on success (per R23 state-management design).
- **404 on already-deleted resources** (not 204). This lets
  the FE distinguish "you did this" from "someone else did
  this (or you re-clicked)." The FE still treats 404 as
  effective success for its own UI state — the resource is
  gone — but the response code carries the provenance.
- **409 with `datasetCount` body** when the workspace is
  non-empty. The FE has two reach paths to this 409:
  1. **Pre-flight friendly path**: FE checks cached
     `['datasets']` query, sees datasets in this workspace,
     opens the blocked modal directly without a server
     round-trip.
  2. **Race-conditioned authoritative path**: FE saw zero
     datasets, opened the confirmation modal, user clicked
     Delete, BE returned 409 because a dataset was created
     in between. The confirmation modal swaps to the blocked
     modal in place.
     In both cases, the 409 from BE is the source of truth; the
     FE never trusts its own cached count.
- **No `?cascade=true` parameter.** R23 considered and
  rejected opt-in cascade for POC. A future round (named in
  [crud-hygiene.md § Out of scope](../../../.agents/design/data-management/crud-hygiene.md))
  may add it; the trigger is concrete user friction with the
  blocked path.

## Error semantics

- **`404 not_found`**: id resolves to nothing. Idempotent
  with respect to subsequent DELETE calls — the resource was
  already absent, so the second DELETE also returns 404.
- **`409 non_empty`**: workspace has ≥ 1 dataset. The body
  carries `datasetCount: integer` (≥ 1 by definition;
  `non_empty` would be `not_found` if the count were zero).
  `additionalProperties: false` on the body — extras would
  silently break the FE's discriminated-union branching.

Both error bodies use the shared `ApiError` envelope in
[\_shared/api-error.yaml](../_shared/api-error.yaml). The FE's
TypeScript `ApiError` discriminated union narrows on `code`.

## Examples

Empty workspace (success):

```http
DELETE /workspaces/ws_aa00bb11 HTTP/1.1
Host: localhost:8000
```

```http
HTTP/1.1 204 No Content
```

Non-empty workspace (blocked):

```http
DELETE /workspaces/ws_3f8a2c91 HTTP/1.1
```

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{ "code": "non_empty", "datasetCount": 4 }
```

Missing workspace (or already deleted):

```http
DELETE /workspaces/ws_deadbeef HTTP/1.1
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{ "code": "not_found" }
```

## Cross-links

- [patch.contract.yaml](patch.contract.yaml) — sibling rename verb.
- [datasets/delete.contract.yaml](../datasets/delete.contract.yaml)
  — parallel delete on the dataset resource (no `non_empty`
  case — datasets have no dependent rows in R23).
- [crud-hygiene.md](../../../.agents/design/data-management/crud-hygiene.md)
  — feature design; modal states 3, 5, 6 cover this endpoint's
  FE flows.
- [Round_23](../../../.agents/plan/cycles/Round_23.md) — D-round.
- [Round_24](../../../.agents/plan/cycles/Round_24.md) — C-round.
