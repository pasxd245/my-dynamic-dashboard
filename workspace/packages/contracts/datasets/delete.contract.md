# `DELETE /datasets/{id}` — contract rationale

> **Authoritative shape**: [delete.contract.yaml](delete.contract.yaml).

## Purpose

Deletes a committed dataset. Introduced by R23's CRUD hygiene
chain. Closes the R∞-deferred delete affordance from
[datasets.md](../../../.agents/design/data-management/datasets.md).

## Behavior

- **204 No Content on success.** No response body. The FE
  invalidates `['datasets']` on success (per R23 state-
  management design); workspace counts also refresh via the
  `['workspaces']` query for any UI that shows aggregates
  (none today, but the invalidation is cheap and
  forward-compatible).
- **Atomic with parquet cleanup.** R25 (BE) handles the DB
  row delete and the underlying parquet file unlink in one
  transaction — same atomic-commit discipline as the R16 BE
  conformance pattern, just in reverse: validate everything
  first, then delete the row, then unlink the parquet (or
  the inverse order — both are fine as long as a partial
  state never lands).
- **404 on already-deleted resources** (not 204). Same
  rationale as workspace delete: distinguishes "you did this"
  from "someone else did this." The FE treats 404 as
  effective success.
- **No 409 path.** Datasets have no dependent resources in
  R23 — they don't own queries, dashboards, or anything else
  that would block deletion. If a future round adds
  dependents (saved queries referencing the dataset by id),
  it gains a 409 path then; this contract does not.

## Error semantics

- **`404 not_found`**: id resolves to nothing. Body uses the
  shared `ApiError` envelope.

That's the entire error surface — no 409, no 422 (DELETE
takes no body so there's nothing to validate). The contract
is intentionally narrow.

## Examples

Happy path:

```http
DELETE /datasets/ds_71a4e2f0 HTTP/1.1
Host: localhost:8000
```

```http
HTTP/1.1 204 No Content
```

Missing dataset (or already deleted):

```http
DELETE /datasets/ds_deadbeef HTTP/1.1
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{ "code": "not_found" }
```

## Cross-links

- [patch.contract.yaml](patch.contract.yaml) — sibling dataset CRUD verb.
- [workspaces/delete.contract.yaml](../workspaces/delete.contract.yaml)
  — parallel delete on the workspace resource (which DOES
  have a 409 `non_empty` case).
- [batch-post.contract.yaml](batch-post.contract.yaml) — the
  creation path; matching atomic-commit discipline.
- [crud-hygiene.md](../../../.agents/design/data-management/crud-hygiene.md)
  — feature design; modal state 4 covers this endpoint's FE flow.
- [Round_23](../../../.agents/plan/cycles/Round_23.md) — D-round.
- [Round_24](../../../.agents/plan/cycles/Round_24.md) — C-round.
