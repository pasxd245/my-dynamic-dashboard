# `PATCH /datasets/{id}/columns` — contract rationale

> **Authoritative shape**: [columns-patch.contract.yaml](columns-patch.contract.yaml).

## Purpose

Sets a dataset's **column visibility** set — the R152 (F7) `hidden`
view-hint. It is the **first post-commit column mutation**: rename is
name-only ([patch.contract.yaml](patch.contract.yaml)) and dtype overrides
are upload-time ([batch-post.contract.yaml](batch-post.contract.yaml)). Wide
CRM exports render every column in one horizontal scroll; this lets the user
focus the row-preview on what matters without touching stored data. Feature
design:
[datasets.md § Column visibility](../../../../.agents/design/data-management/datasets/datasets.md).

## Behavior

- **Presentation-only — never a projection.** The handler writes the
  `hidden` flag into `columns_json` and **never** re-reads or rewrites the
  parquet, `column_count`, `row_count`, or the storage directory. A hidden
  column is fully present in storage and in every compute path. This is the
  presentation-level default, complementary to — not a substitute for — the
  compute-level `select` step (R141).
- **Replace semantics.** The body's `hidden` array is the COMPLETE set of
  columns to hide; any column absent from it becomes visible. Idempotent and
  order-independent — a single toggle or a bulk edit is one call. An empty
  array clears all hints.
- **Honor / ignore split (Q1, the load-bearing decision).** Only the
  dataset-detail row-preview (`PagedRowsView`) honors `hidden` (default-hide +
  a "show all columns" escape). **Every** picker — filter · advanced-query ·
  relationship-key · query-builder · join · workflows — ignores it, so a
  hidden column stays fully joinable/selectable/filterable.
- **Returns the updated `Dataset`** so the FE can replace cached
  `['datasets', { id }]` state without a follow-up `GET`.
- **Refresh carry-forward.** A refresh re-parses and rewrites `columns_json`;
  the hidden set is carried forward by name-intersection with the re-parsed
  columns (a column no longer present drops its hint). Owned by the refresh
  handler (B), not this endpoint.

## Error semantics

- **`404 not_found`**: id resolves to nothing.
- **`422` (two shapes, FE branches on `code`)**:
  - FastAPI `{ detail }` envelope — a malformed request body (missing
    `hidden`, non-array, empty/blank or duplicate entries, extra keys).
  - `{ code: "unknown_column", column }` — a well-formed request naming a
    column that is not part of this dataset's schema. `column` is the first
    offending name; `columns_json` is untouched.
  - `{ code: "no_visible_columns" }` — the set would hide **every** column
    (the at-least-one-visible guard; an empty row-preview is not a valid
    state). `columns_json` is untouched.

There is deliberately **no `409`** — visibility is presentation-only and
fully reversible, so there is no cross-resource conflict to report.

## Examples

Hide two noisy columns:

```http
PATCH /datasets/ds_71a4e2f0/columns HTTP/1.1
Content-Type: application/json

{ "hidden": ["internal_notes", "raw_payload"] }
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "ds_71a4e2f0",
  "columns": [
    { "name": "amount", "dtype": "float" },
    { "name": "internal_notes", "dtype": "string", "hidden": true }
    /* ... */
  ]
  /* ...rest of Dataset... */
}
```

Unknown column:

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{ "code": "unknown_column", "column": "nope" }
```

Would hide everything:

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{ "code": "no_visible_columns" }
```

## Cross-links

- [\_shared/column.yaml](../_shared/column.yaml) — the `Column.hidden` field
  this endpoint writes.
- [\_shared/api-error.yaml](../_shared/api-error.yaml) —
  `unknown_column`, `no_visible_columns` variants.
- [patch.contract.yaml](patch.contract.yaml) — sibling (name-only) dataset PATCH.
- [batch-post.contract.yaml](batch-post.contract.yaml) — the creation path;
  its refresh mode owns the carry-forward.
- [datasets.md § Column visibility](../../../../.agents/design/data-management/datasets/datasets.md)
  — feature design.
- [Round_152](../../../../.agents/plan/cycles/Round_152.md) — D + C round.
