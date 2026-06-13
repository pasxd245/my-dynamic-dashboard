# `GET /workspaces` — contract rationale

> **Authoritative shape**: [get.contract.yaml](get.contract.yaml).
> This file annotates the YAML for human (and HIxAI) readers; it
> does not redefine the shape.

## Purpose

Returns every workspace the user has created. Powers the
[Workspaces page](../../../apps/builder/src/features/data-management/workspaces/WorkspacesPage.tsx)
grid and the [Datasets page](../../../../.agents/design/data-management/datasets/datasets.md)
workspace-filter dropdown.

## Behavior

- **Idempotent and side-effect-free.** Safe to call any number of
  times; pure read.
- **Sort order**: `createdAt` descending. The wire-shape
  `createdAt` is a sortable ISO-8601 string, so the order is
  stable across server processes — clients can re-sort if
  needed without losing fidelity.
- **No pagination**. Single-user product; the workspace count is
  expected to stay small (single-digit to low-double-digit).
  Pagination is R∞ — landed when a real user hits friction.
- **No filtering query params** on this endpoint. The
  [`GET /datasets`](../datasets/get.contract.md) endpoint takes
  `workspace_id`; workspace listing itself is unconditional.
- **Authentication**: none. Single-user product; multi-user is R∞.

## Error semantics

This endpoint has no documented non-2xx response in the contract.
A 5xx return is always an implementation defect, never an
expected client-driven outcome.

## Examples

```http
GET /workspaces HTTP/1.1
Host: localhost:8000
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  { "id": "ws_3f8a2c91", "name": "Marketing",  "createdAt": "2026-05-24T11:23:45Z" },
  { "id": "ws_1a4d8f02", "name": "Sales Ops", "createdAt": "2026-05-23T09:12:30Z" }
]
```

Empty case:

```http
HTTP/1.1 200 OK
Content-Type: application/json

[]
```

## Cross-links

- [post.contract.yaml](post.contract.yaml) — creation companion
- [workspaces.md](../../../../.agents/design/data-management/workspaces/workspaces.md) — design doc
- [Round_13](../../../../.agents/plan/cycles/Round_13.md) — the round
  that first introduced this endpoint (without a contract);
  this contract is retroactive.
