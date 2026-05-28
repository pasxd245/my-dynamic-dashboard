# `GET /datasets` — contract rationale

> **Authoritative shape**: [get.contract.yaml](get.contract.yaml).

## Purpose

Lists committed datasets across all workspaces, or scoped to a
single workspace via the `workspace_id` query parameter. Powers
the
[Datasets page](../../../../.agents/design/data-management/datasets.md)
table.

## Behavior

- **Idempotent and side-effect-free.** Pure read.
- **Sort order**: `createdAt` descending. Stable across server
  processes (ISO-8601 string sort matches chronological order).
- **`workspace_id` filter semantics**: when present, applies as an
  exact-match equality filter (no fuzzy / prefix / multi-id
  matching in R16+). An unknown `workspace_id` returns an empty
  array, **not** 404 — the filter expression is well-formed even
  if it matches nothing.
- **Status field absent.** Per R14 HIxAI Q12: failed parses
  never become Datasets, so every returned row is by definition
  committed-ready. The wire shape carries no `status` field, no
  `errorMessage`, no `parseDurationMs`.
- **No pagination.** Single-user product; the dataset count is
  expected to stay small. Pagination is R∞.
- **No search query param.** The Datasets page uses client-side
  substring search against `name`; the contract does not surface
  a server-side `q=` parameter until a real user has >1000
  datasets.
- **Source-format icons**: the `sourceFormat` field is exposed
  precisely so the
  [Datasets page](../../../../.agents/design/data-management/datasets.md)
  can render `📊` (excel) / `📄` (csv) prefixes on the name
  column. The contract does not encode icon characters.

## Error semantics

This endpoint has no documented non-2xx response in the
contract. A 5xx return is always an implementation defect.
A malformed `workspace_id` (e.g., `?workspace_id=garbage`)
returns an empty array — the contract does not require the
backend to validate the parameter format, but R16's implementation
may choose to 422 invalid patterns.

## Examples

All workspaces, two results:

```http
GET /datasets HTTP/1.1
Host: localhost:8000
```

Filtered to a single workspace:

```http
GET /datasets?workspace_id=ws_3f8a2c91 HTTP/1.1
Host: localhost:8000
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": "ds_82b5f3e1",
    "workspaceId": "ws_3f8a2c91",
    "name": "q1_pipeline_Contacts",
    "sizeBytes": 253408,
    "rowCount": 14902,
    "columnCount": 7,
    "columns": [ /* ... */ ],
    "sourceFormat": "excel",
    "sheetName": "Contacts",
    "createdAt": "2026-05-24T11:30:01Z"
  }
]
```

Empty filter:

```http
GET /datasets?workspace_id=ws_doesnotexist HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

[]
```

## Cross-links

- [batch-post.contract.yaml](batch-post.contract.yaml) — creation companion (commit endpoint)
- [`../_shared/dataset.yaml`](../_shared/dataset.yaml) — Dataset shape
- [datasets.md](../../../../.agents/design/data-management/datasets.md) — design doc
