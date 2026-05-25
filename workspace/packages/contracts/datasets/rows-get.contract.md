# `GET /datasets/{id}/rows` — contract rationale

> **Authoritative shape**: [rows-get.contract.yaml](rows-get.contract.yaml).

## Purpose

Returns a paged slice of a dataset's rows for the data table on
the
[dataset detail page](../../../.agents/design/data-management/dataset-detail.md).
The FE pairs this with
[`detail-get.contract.yaml`](detail-get.contract.yaml) — that
endpoint returns the schema + column dtypes (the table header
information); this endpoint returns the cells (the table body).

## Behavior

- **Idempotent and side-effect-free.** Pure read.
- **Pagination is offset-based, 1-indexed.** `page=1&page_size=50`
  is the default. The page-size enum (`25 / 50 / 100`) mirrors
  the FE's `<Pagination>` page-size selector exactly. Cursor
  pagination is overkill at POC scale; row counts are
  commit-time-known so total-page math is trivial.
- **Optional substring filter via `?q=<value>`.** Case-insensitive
  match against the stringified value of any cell in the row; a
  row matches when **any** cell contains `q`. Effectively
  `LOWER(cell_as_string) LIKE '%q%'` evaluated across the row.
  No regex, no per-column scoping, no AND/OR composition this
  round — this is Cmd-F-style "find a row in this dataset," not
  the future query/dashboard surface (which remains R∞ and will
  bring per-column / typed filters).
- **`total` semantics with `q`.** When `q` is present, `total`
  is the **matched-row count**, not the dataset's full row
  count. The FE pairs it with `Dataset.rowCount` (from the
  parallel `GET /datasets/{id}`) to render an "X of Y" match
  counter above the table. When `q` is absent, `total ===
  Dataset.rowCount`.
- **Page resets on `q` change.** The FE re-issues with `page=1`
  whenever `q` changes — same UX rule as `page_size` change.
  The BE does not enforce this; it accepts whatever `page`
  arrives.
- **Out-of-range page returns 200 with empty rows, not 422.**
  When `page > ceil(total / page_size)`, the response is
  `{ rows: [], page: <echo>, pageSize: <echo>, total: <full> }`.
  This matches the precedent set by `GET /datasets?workspace_id=`:
  "the filter expression is well-formed even if it matches
  nothing." Reserving 422 for truly malformed requests
  (page < 1, page_size off-enum, id pattern mismatch) keeps the
  FE branching simple — a non-2xx response is always
  user-actionable.
- **`additionalProperties: false` on the response body.** Mirrors
  the BE's `extra='forbid'` Pydantic discipline (per the R16
  conformance pattern). Adding a new field is a contract change,
  not a silent extension.
- **`pageSize` echo in response.** Redundant with the request
  param, kept so the response is self-describing and the FE can
  pass it verbatim to AntD `<Pagination>` without re-reading the
  URL.

## Cell stringification

Cells are transported as `string | null`. The BE renders each
cell BE-side via pyarrow → python-string conversion per dtype
(`amount: 12400` → `"12400"`, `won_at: 2026-03-01` → `"2026-03-01"`,
`is_priority: True` → `"true"`, missing → `null`). The FE then
re-applies dtype-aware display formatting using the column
dtypes carried on the parent `Dataset.columns[].dtype`
(numerics get `Intl.NumberFormat` thousand separators, dates get
`Intl.DateTimeFormat` localization, nulls become a muted `—`).

Why not typed cells (`(string | number | boolean | null)[][]`)?
That would leak the BE parser's opinions through the wire — every
pyarrow → JSON serializer difference would become an FE display
bug. Stringified cells keep the responsibility line clean: BE
renders to string; FE display-formats from the dtype it already
has. The FE never round-trips a parsed-then-reformatted value.

## Why no `_shared/rows-page.yaml`

Single consumer (this endpoint). Per the
[Evolution Rule](../../../.agents/AGENTS.md): _default = don't
add._ A `_shared/` schema lands when a second paged-rows
endpoint actually arrives (e.g. saved-query results, audit-log
slices). Keeping `RowsPage` inline today makes the shape
co-located with the only contract that uses it.

## Why `total`, not `rowCount`

`Dataset.rowCount` is the canonical full row count for a
dataset. Naming this field `total` (instead of `rowCount`) keeps
the door open for a future `?filter=` query that would scope the
count to the active filter — at which point `total` and
`rowCount` would diverge. Today they're always equal; tomorrow
they may not be.

## Error semantics

- **404 `not_found`** — the dataset id resolves to nothing.
  Reuses the existing
  [`ApiErrorNotFound`](../_shared/api-error.yaml) envelope. Same
  envelope as `GET /datasets/{id}`; the FE handles both 404s
  identically (transition to the "deleted" state).
- **422** — FastAPI's default request-validation envelope.
  Triggered by `page < 1`, `page_size` outside `{25, 50, 100}`,
  an `id` that doesn't match `^ds_[0-9a-f]{8}$`, or `q` longer
  than 200 chars. Out-of-range `page` (i.e., `page > ceil(total
  / page_size)`) is **not** 422 — see Behavior above. A `q=`
  that matches zero rows is also **not** 422; it returns 200
  with `rows: []` and `total: 0` (same shape as out-of-range).

## Examples

Full first page:

```http
GET /datasets/ds_71a4e2f0/rows?page=1&page_size=50 HTTP/1.1
Host: localhost:8000
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "rows": [
    ["D-0001", "12400", "2026-03-01", "won", "0.95", "true", "2026-02-28T14:02:00Z", "quick close, no contention"],
    ["D-0002", null, null, "open", "0.45", "false", "2026-03-15T09:18:00Z", null]
  ],
  "page": 1,
  "pageSize": 50,
  "total": 2481
}
```

Out-of-range page (200, not 422):

```http
GET /datasets/ds_71a4e2f0/rows?page=999&page_size=50 HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "rows": [], "page": 999, "pageSize": 50, "total": 2481 }
```

Malformed page_size (422):

```http
GET /datasets/ds_71a4e2f0/rows?page_size=37 HTTP/1.1
```

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{ "detail": [ /* FastAPI request-validation entries */ ] }
```

Substring filter — matched subset:

```http
GET /datasets/ds_71a4e2f0/rows?q=won HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "rows": [
    ["D-0001", "12400", "2026-03-01", "won", "0.95", "true", "2026-02-28T14:02:00Z", "quick close, no contention"],
    ["D-0005", "24500", "2026-05-02", "won", "1.00", "true", "2026-04-22T08:11:00Z", "renewal — multi-year"]
  ],
  "page": 1,
  "pageSize": 50,
  "total": 1204
}
```

Substring filter — zero matches (200, not 422):

```http
GET /datasets/ds_71a4e2f0/rows?q=ZZZZZ HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "rows": [], "page": 1, "pageSize": 50, "total": 0 }
```

## Cross-links

- [detail-get.contract.yaml](detail-get.contract.yaml) — schema + column metadata companion
- [`../_shared/dataset.yaml`](../_shared/dataset.yaml) — column dtype list the FE uses for cell rendering
- [`../_shared/api-error.yaml`](../_shared/api-error.yaml) — ApiErrorNotFound envelope
- [dataset-detail.md](../../../.agents/design/data-management/dataset-detail.md) — R33 design doc (cell rendering rules + state transitions)
