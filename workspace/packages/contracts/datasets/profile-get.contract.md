# `GET /datasets/{id}/profile` — contract rationale

> **Authoritative shape**: [profile-get.contract.yaml](profile-get.contract.yaml).

## Purpose

Returns a **per-column data profile** computed on demand from the dataset's
parquet via DuckDB (R154). Powers the **Profiling section** of the
[Properties drawer](../../../../.agents/design/data-management/datasets/dataset-detail.md#properties-panel-r153)
on the dataset-detail page — the "how many nulls? how many distinct? what's the
range?" facts a user wants when sizing up a dataset, none of which are persisted.
It also carries each column's date/datetime `format` (from the last commit's
`commitSettings`) so the Columns section can show it without a second fetch.

## Behavior

- **Read-only compute.** A DuckDB aggregate over the stored parquet. It never
  writes `columns_json` or the parquet — the same presentation/purity boundary
  as the R152 `hidden` view-hint. Idempotent and side-effect-free.
- **One call, all columns.** The response profiles every committed column in a
  single request (not per-column), so the drawer opens with one fetch.
- **Cost guard — on-demand, sampled above a threshold, never cached.** A full
  profile is a full-scan aggregate; on a wide/deep parquet that is a real
  per-open cost. The backend runs a full scan when
  `rowCount <= PROFILE_FULL_SCAN_MAX` and otherwise an approximate
  `USING SAMPLE n ROWS` scan, setting `approx: true` and `sampledRows` so the UI
  labels the numbers as approximate. Nothing is cached server-side — the cost is
  re-paid per call but **bounded**. A server-side cache is a deferred additive if
  a real perf complaint lands; the Properties panel is the consumer, so the cost
  deliberately lands on drawer-open (the "consumer pays" boundary the datasets
  domain already holds).
- **Predictable per-column shape.** Every column object carries the full key set;
  a stat that does not apply to the column's dtype is `null` rather than omitted,
  so the FE renderer branches on `null`, not on key presence. The per-dtype
  matrix:
  - **every column** — `nullCount`, `nullPct`, `distinctCount`.
  - **integer / float / date / datetime** — `min`, `max` (`sample` null).
  - **string** — `sample` (top-k most-frequent) (`min`, `max` null).
  - **boolean** — null/distinct only (`min`, `max`, `sample` all null).
- **Stringified min/max/sample.** `min` / `max` / `sample` are `string | null`
  for the same reason as the rows payload (see
  [rows-get](rows-get.contract.md)): the wire stays schema-free and the FE
  re-applies dtype-aware display via the column's `dtype`.
- **`format` rides the profile.** The date/datetime display pattern lives at
  `source.json → commitSettings.column_overrides[<name>].format`, off the
  committed `Column`. Folding it onto each `ColumnProfile` (null when there is no
  override) means the Columns section shows `format` without a second endpoint.

## Error semantics

- **404 `not_found`** — no dataset with the given `id`. Reuses the shared
  [`ApiErrorNotFound`](../_shared/api-error.yaml) envelope, same as
  [`detail-get`](detail-get.contract.md).
- **No 422.** The id pattern is a structural path-param regex; violations
  short-circuit at FastAPI's request-validation layer. There is no request body.

## Examples

```http
GET /datasets/ds_71a4e2f0/profile HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "datasetId": "ds_71a4e2f0",
  "rowCount": 7,
  "approx": false,
  "sampledRows": null,
  "columns": [
    { "name": "deal_id", "dtype": "string", "format": null,
      "nullCount": 0, "nullPct": 0, "distinctCount": 7,
      "min": null, "max": null, "sample": ["D-001", "D-002", "D-003"] },
    { "name": "won_at", "dtype": "date", "format": "dd/MM/yyyy",
      "nullCount": 1, "nullPct": 14.29, "distinctCount": 6,
      "min": "2026-01-04", "max": "2026-06-30", "sample": null }
  ]
}
```

Large dataset (approximate scan on a sample):

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "datasetId": "ds_71a4e2f0",
  "rowCount": 4200000,
  "approx": true,
  "sampledRows": 200000,
  "columns": [ /* stats computed within the sample */ ]
}
```

## Cross-links

- [detail-get.contract.yaml](detail-get.contract.yaml) — sibling read; the `columns` this profiles
- [refresh-settings-get.contract.yaml](refresh-settings-get.contract.yaml) — the other `commitSettings` reader (the `format` source)
- [rows-get.contract.md](rows-get.contract.md) — the stringified-cell precedent `min`/`max`/`sample` follow
- [`../_shared/api-error.yaml`](../_shared/api-error.yaml) — the shared 404 envelope
- [dataset-detail.md § Properties panel](../../../../.agents/design/data-management/datasets/dataset-detail.md#properties-panel-r153) — R154 design
