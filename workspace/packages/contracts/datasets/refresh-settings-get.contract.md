# `GET /datasets/{id}/refresh-settings` — contract rationale

> **Authoritative shape**: [refresh-settings-get.contract.yaml](refresh-settings-get.contract.yaml).

## Purpose

Returns the **carry-forward settings** a refresh wizard pre-fills from
(R145 § Refresh, F9). Powers the pre-fill of the
[upload wizard in refresh mode](../../../../.agents/design/data-management/datasets/upload.md#refresh-re-upload-into-an-existing-dataset-r145)
at `/data-management/datasets/:id/refresh`: the committed sheet, parse
options, per-column dtype/format overrides, and exclusions — so a monthly
re-upload does not re-configure everything from scratch (the lived R144
dogfood pain).

## Behavior

- **Idempotent and side-effect-free.** Pure read of the `commitSettings`
  snapshot the last commit persisted in the dataset's `source.json`.
- **Mirrors a commit item's settings shape.** The payload uses the same
  snake_case `parse_options` / `column_overrides` / `excluded_columns`
  fields a batch-commit item carries, so the wizard round-trips it straight
  back into the refresh commit — no re-shaping.
- **Off the hot detail path.** Deliberately a sibling of
  [`detail-get`](detail-get.contract.yaml) rather than a field on it: the
  detail page is read on every dataset open and should not pay a per-read
  `source.json` cost or a shape change for refresh-only fuel.
- **Legacy datasets return `available: false`.** Datasets committed before
  R145 have no snapshot; the wizard then uses a lossy fallback (sheet +
  final committed dtypes only) and writes a snapshot on the next refresh, so
  the gap self-heals forward.

## Error semantics

- **404 `not_found`** — no dataset with the given `id`. Reuses the shared
  [`ApiErrorNotFound`](../_shared/api-error.yaml) envelope, same as
  [`detail-get`](detail-get.contract.md).
- **No 422.** The id pattern is a structural path-param regex; violations
  short-circuit at FastAPI's request-validation layer.

## Examples

```http
GET /datasets/ds_71a4e2f0/refresh-settings HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "available": true,
  "sheet": "Worksheet",
  "parse_options": { "has_header": true },
  "column_overrides": {
    "Số gọi": { "dtype": "string" },
    "Ngày gọi": { "dtype": "datetime", "format": "dd-MM-yyyy HH:mm:ss" }
  },
  "excluded_columns": ["Ghi chú nội bộ"]
}
```

Legacy dataset (no snapshot):

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "available": false }
```

## Cross-links

- [batch-post.contract.yaml](batch-post.contract.yaml) — the refresh commit these settings feed (`target_dataset_id`)
- [detail-get.contract.yaml](detail-get.contract.yaml) — sibling read (the drift baseline `columns`)
- [`../_shared/parse-options.yaml`](../_shared/parse-options.yaml) · [`../_shared/column-override.yaml`](../_shared/column-override.yaml) — reused value shapes
- [upload.md § Refresh](../../../../.agents/design/data-management/datasets/upload.md#refresh-re-upload-into-an-existing-dataset-r145) — R145 design
