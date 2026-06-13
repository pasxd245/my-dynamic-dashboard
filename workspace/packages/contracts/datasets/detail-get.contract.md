# `GET /datasets/{id}` — contract rationale

> **Authoritative shape**: [detail-get.contract.yaml](detail-get.contract.yaml).

## Purpose

Returns a single dataset by id. Powers the
[dataset detail page](../../../../.agents/design/data-management/datasets/dataset-detail.md)
at `/data-management/datasets/:id`. The page header, metadata
strip, and column-header dtype badges all read from this
response; per-row data comes from the sibling
[`rows-get.contract.yaml`](rows-get.contract.yaml).

## Behavior

- **Idempotent and side-effect-free.** Pure read.
- **Shape parity with the list-GET.** The 200 response is the
  same `Dataset` object the list returns; the FE can hydrate
  the TanStack cache for `['datasets', { id }]` either from a
  prefetch on row click (cached from the list query) or from a
  direct fetch on deep-link entry. No detail-only fields.
- **No `?expand=` / `?fields=` / `?include=` query params.**
  The shape is fixed; the wire format does not carry per-call
  expansion in this iteration. If a detail-only enrichment
  becomes useful (column statistics, sample rows inline), it
  lands as a new optional field with a default rather than a
  new query parameter.

## Error semantics

- **404 `not_found`** — the only documented non-2xx response.
  Reuses the existing
  [`ApiErrorNotFound`](../_shared/api-error.yaml) envelope
  from R24 (`{ code: "not_found" }`). The FE 404 state mirrors
  the wording on the
  [crud-hygiene delete-already-gone race](../../../../.agents/design/data-management/_shared/crud-hygiene.md):
  the dataset may have been deleted from another tab.
- **No 410.** A successfully-deleted dataset returns 404, not
  410, to match the existing delete + patch contracts. The
  FE treats both the same way (back-to-list + toast).
- **No 422.** The id pattern check is structural (path-param
  regex). Pattern violations short-circuit at FastAPI's
  request-validation layer with its default `{ detail: [...] }`
  envelope; that shape is documented by FastAPI and not
  duplicated here.

## Examples

Successful fetch of an Excel dataset:

```http
GET /datasets/ds_71a4e2f0 HTTP/1.1
Host: localhost:8000
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "ds_71a4e2f0",
  "workspaceId": "ws_3f8a2c91",
  "name": "q1_pipeline_Deals",
  "sizeBytes": 86016,
  "rowCount": 2481,
  "columnCount": 12,
  "columns": [ /* ... */ ],
  "sourceFormat": "excel",
  "sheetName": "Deals",
  "createdAt": "2026-05-26T14:02:00Z"
}
```

Deleted-from-another-tab race:

```http
GET /datasets/ds_71a4e2f0 HTTP/1.1
```

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{ "code": "not_found" }
```

## Cross-links

- [rows-get.contract.yaml](rows-get.contract.yaml) — per-row data companion
- [get.contract.yaml](get.contract.yaml) — list-GET (same item shape)
- [delete.contract.yaml](delete.contract.yaml) — the operation that makes 404 a real state
- [`../_shared/dataset.yaml`](../_shared/dataset.yaml) — Dataset shape
- [`../_shared/api-error.yaml`](../_shared/api-error.yaml) — ApiErrorNotFound envelope
- [dataset-detail.md](../../../../.agents/design/data-management/datasets/dataset-detail.md) — R33 design doc
