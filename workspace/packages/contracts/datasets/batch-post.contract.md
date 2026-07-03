# `POST /workspaces/{id}/datasets/batch` — contract rationale

> **Authoritative shape**: [batch-post.contract.yaml](batch-post.contract.yaml).

## Purpose

The **commit** step of the upload wizard. Promotes one or more
sheets from a temp upload into permanent Dataset rows under the
named workspace. The endpoint is the only way a Dataset row
comes into existence; there is no DB-only Dataset create path.

Atomic: all items succeed together or none do. A 4-sheet Excel
commit either creates 4 Datasets or creates 0. Partial-success
is explicitly excluded from the contract — the wizard's
Metadata step is the place where individual sheets get filtered
out, not this endpoint.

## Behavior

- **Idempotency.** Not idempotent. A retry creates fresh Dataset
  rows with new `id`s and a new `createdAt`. The wizard
  client-throttles the `Create datasets` button to avoid double-
  commits. R∞ may introduce a client-supplied idempotency key.
- **Atomicity scope.** The contract guarantees Dataset-row
  atomicity: either all rows are visible after the response, or
  none. File-system moves (temp → `data/datasets/<ws>/<ds>/`) are
  also expected to be atomic-on-success, but the contract treats
  filesystem state as implementation; clients must not depend on
  inspecting it.
- **`temp_id` consumption.** After a successful commit, the temp
  directory is moved (renamed) into the per-dataset directories;
  the `temp_id` is invalidated. A second commit against the same
  `temp_id` returns 404. Failed commits leave the temp directory
  intact for retry.
- **CSV vs Excel.** CSV sends `items: [{ name, ... }]` (length 1,
  no `sheet`). Excel sends `items: [{ sheet, name, ... }, ...]`
  (length = selected-sheets count, each with `sheet`). The
  contract validates per-item that the `sheet` field is present
  iff the temp upload is Excel.
- **`parse_options` on commit items.** If present, the contract
  requires the value to match what the temp directory was last
  parsed with (i.e., the client must have called
  [`POST /uploads/{temp_id}/parse`](../uploads/parse.contract.md)
  with these exact options first). Mismatch returns 409 with
  `error: parse_options_stale` — the wizard then prompts
  `[Re-parse this sheet]`.
- **`column_overrides` semantics.** Each key is a column name
  (post-`excluded_columns` set). Each value's `dtype` is the
  client-requested type. For `date` / `datetime`, the
  `format` is required (R14 HIxAI Q14a). **R143**: the FORMATLESS
  dtypes (string · integer · float · boolean) are cast for real at
  the parquet write — stored dtype equals committed `columns_json`
  dtype (the R142-F2 invariant); an uncastable non-NULL cell fails
  the batch with 422 `coercion_failed` (column + first-5 cells +
  count). `date` / `datetime` overrides remain metadata-only
  relabels until the date-ingest round decides the format-token
  translation (upload.md §Commit dtype semantics). *(Pre-R143 the
  doc claimed `cast_columns()` casting here while the shipped code
  relabeled only — the R142-F1/F2 defects; R143 makes this
  paragraph true for the formatless set.)*
- **`excluded_columns` semantics.** Drop these columns from the
  parsed Parquet at commit time. Must leave ≥ 1 remaining column
  or 422. R14 HIxAI Q14d locked this.
- **`target_dataset_id` semantics.** Forward-compatible slot for
  R∞ append-mode (R14 HIxAI Q14e). In R16+, any value here
  returns 422 with `error: append_mode_not_implemented`. The
  field is intentionally in the contract from day one so a
  future round can implement append without breaking the wire.
- **Authentication / workspace authorization**: none (single-user
  product).

## Error semantics

- **`404 Not Found`**: workspace missing _or_ temp upload missing
  (deliberately ambiguous; clients should treat as "either is
  gone").
- **`409 Conflict`** — two body shapes (see YAML's `oneOf`):
  - **Legacy `{ error, detail }` shape**, used for:
    - `parse_options_stale` — `parse_options` in an item don't
      match the last parse. Client must call `parse` again.
    - `column_not_in_schema` — `excluded_columns` or
      `column_overrides` references a column name not present
      in the parsed schema.
    - `cast_failed` — a `column_overrides` cast (e.g., `"abc"`
      to integer) failed at commit time. Body includes the row
      index and column.
  - **Code-first `{ code: "name_taken" }` envelope** _(R25
    tightening)_ — at least one item's `name` collides with an
    existing dataset in the same workspace, per the new unique
    index `idx_datasets_name_unique`. The FE handles this with
    the same inline-error treatment as standalone
    [`PATCH /datasets/{id}` § 409](patch.contract.md). The two
    shapes are kept distinct because the legacy 409s carry
    per-row context (`parse_options_stale` etc.) that the
    code-first envelope does not.
- **`422 Unprocessable Entity`** — two body shapes (see YAML's
  `oneOf`; FE branches on top-level `code` presence, same rule as
  the 409):
  - **FastAPI `{ detail: ... }` envelope** — request-level
    validation (per the field-level rules in the YAML), plus the
    R16+ rejection of `target_dataset_id`, plus the
    `excluded_columns` would leave zero columns case, plus the
    date/datetime override missing `format`.
  - **Code-first `{ code: "coercion_failed", … }` envelope**
    _(R143)_ — a commit-time cast failed: sheet (Excel only) ·
    column · target dtype · first-5 offending cells (1-indexed
    data rows) · totalFailed. Atomic — nothing commits. Replaces
    the pre-R143 unhandled 500 (`ArrowInvalid`), and supersedes
    the never-implemented legacy `cast_failed` 409 listed above
    (kept in the 409 list for history; no code path emits it).

## Examples

CSV commit (length-1 batch):

```http
POST /workspaces/ws_3f8a2c91/datasets/batch HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "temp_id": "tmp_4f8a91c0b3d7e251",
  "items": [
    {
      "name": "leads_q1",
      "column_overrides": {
        "closed_at": { "dtype": "date", "format": "yyyy-MM-dd" }
      },
      "excluded_columns": ["legacy_status"]
    }
  ]
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

[
  {
    "id": "ds_71a4e2f0",
    "workspaceId": "ws_3f8a2c91",
    "name": "leads_q1",
    "sizeBytes": 1442,
    "rowCount": 431,
    "columnCount": 8,
    "columns": [ /* ... */ ],
    "sourceFormat": "csv",
    "createdAt": "2026-05-24T11:23:45Z"
  }
]
```

Excel commit (length-N batch — two sheets):

```http
POST /workspaces/ws_3f8a2c91/datasets/batch HTTP/1.1
Content-Type: application/json

{
  "temp_id": "tmp_4f8a91c0b3d7e251",
  "items": [
    { "sheet": "Deals",    "name": "q1_pipeline_Deals"    },
    { "sheet": "Contacts", "name": "q1_pipeline_Contacts" }
  ]
}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

[
  { "id": "ds_71a4e2f0", "workspaceId": "ws_3f8a2c91", "name": "q1_pipeline_Deals",    "sheetName": "Deals",    "sourceFormat": "excel", /* ... */ },
  { "id": "ds_82b5f3e1", "workspaceId": "ws_3f8a2c91", "name": "q1_pipeline_Contacts", "sheetName": "Contacts", "sourceFormat": "excel", /* ... */ }
]
```

Stale-options conflict (re-parse needed):

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": "parse_options_stale",
  "detail": "Item 1 (sheet 'Deals'): parse_options differ from last parse. Call /uploads/{temp_id}/parse with these options first."
}
```

## Cross-links

- [`../uploads/post.contract.md`](../uploads/post.contract.md) — Phase 1
- [`../uploads/parse.contract.md`](../uploads/parse.contract.md) — Phase 2 (Excel)
- [get.contract.yaml](get.contract.yaml) — list companion
- [`../_shared/dataset.yaml`](../_shared/dataset.yaml) — Dataset shape
- [datasets.md](../../../../.agents/design/data-management/datasets/datasets.md) — design doc
- [upload.md](../../../../.agents/design/data-management/datasets/upload.md) — wizard design
