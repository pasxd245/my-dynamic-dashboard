# `GET /datasets/{id}/rows` — contract rationale

> **Authoritative shape**: [rows-get.contract.yaml](rows-get.contract.yaml).

## Purpose

Returns a paged slice of a dataset's rows for the data table on
the
[dataset detail page](../../../../.agents/design/data-management/dataset-detail.md).
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
  Filter changes (any `f<N>_*` add / change / remove) reset
  `page` for the same reason. The BE does not enforce this;
  it accepts whatever `page` arrives.
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

## Per-column filters via `f<N>_*` params (R38)

The four query params `f<N>_op`, `f<N>_val`, `f<N>_min`,
`f<N>_max` define a per-column typed predicate, where `<N>` is
the 0-based index into `Dataset.columns[]`. Each column
contributes at most one predicate; multiple columns compose
with implicit AND. The contract YAML declares the shape via
illustrative `f0_*` parameter entries; the convention extends
to all `N < Dataset.columnCount`.

- **Why column index, not column name.** Names can contain
  spaces, slashes, unicode — URL-escaping is brittle and
  unreadable. Indices are stable (the dataset schema is fixed
  post-commit per R14 Read/write boundary) and match the
  `col_N` convention R36 already uses for AntD `dataIndex`
  collision avoidance.
- **Why no `schema.enum` on `f<N>_op`.** Operator validity is
  dtype-dependent: `contains` is valid for `string` columns
  and invalid for `integer`; `between` is valid for numerics
  and dates and invalid for booleans. A single static `enum`
  would either reject valid ops (if narrowed to one dtype) or
  accept invalid ones (if union'd across all dtypes). The
  prose description on `f0_op` carries the full vocabulary;
  the BE does the per-dtype check at request time and returns
  422 with a descriptive `detail[].msg` on mismatch. See
  [dataset-filters.md § Predicate vocabulary table](../../../../.agents/design/data-management/dataset-filters.md#predicate-vocabulary-table)
  for the authoritative cross-stack spec.
- **Why `f<N>_val` is `schema.type: string`.** A more typed
  declaration would use `oneOf` with per-dtype schemas, but
  again the dtype is unknown without first looking up
  `Dataset.columns[N]`. `string` is a lexical envelope; the BE
  parses per dtype (integer → int64, float → IEEE-754 double,
  date → ISO `YYYY-MM-DD`, datetime → ISO `YYYY-MM-DDTHH:MM:SS`,
  boolean → not applicable, string → utf-8 verbatim). Parse
  failure returns 422 with `filter_value_unparseable`.
- **AND-compose with `?q=`.** Filters evaluate first (push-down
  into the DuckDB `WHERE` clause), then the `?q=` substring
  search runs over the filtered intermediate. The order is
  observationally equivalent to `WHERE (...filter predicates...)
  AND (?q=... substring across all cells)`; `total` reflects
  the AND-composed matched count. The FE's "Matched X / Y"
  counter uses `total` for `X` and `Dataset.rowCount` for `Y`
  regardless of which predicates are active.
- **Operator vs operand shape.** Each operator implies a fixed
  operand shape:

  | Operator family | Fields used |
  | --- | --- |
  | Single-operand (`equals`, `ne`, `gt`, `lt`, `gte`, `lte`, `contains`, `starts_with`, `ends_with`, `before`, `after`) | `f<N>_op`, `f<N>_val` |
  | Range (`between`) | `f<N>_op`, `f<N>_min`, `f<N>_max` |
  | No-operand (`is_null`, `is_not_null`, `is_empty`, `is_not_empty`, `is_true`, `is_false`) | `f<N>_op` only |

  Mismatch (e.g. `between` with `val` instead of `min`/`max`,
  or `equals` with `min` and no `val`) returns 422 with
  `filter_operand_shape`.

- **Why no JSON-body `POST :search` parallel.** R37 named
  encoded params as primary and `POST :search` as a parked
  fallback for promotion if URL bloat becomes routine
  (≥ 8 active filters typical). Today the encoded-params
  shape stays the only access path; the rows endpoint
  remains a pure GET.
- **Why no `_shared/filter-predicate.yaml`.** Single consumer
  (this endpoint). Per the
  [Evolution Rule](../../../../.agents/AGENTS.md):
  _default = don't add._ A `_shared/` schema lands when a
  second filter-accepting endpoint actually arrives (e.g.
  saved-query results, cross-dataset catalog filtering).

## Advanced query via `aq` param (R51)

The `aq` query param carries an **advanced query** — boolean
composition (`AND` / `OR`) over the same predicate vocabulary the
`f<N>_*` params use. It is the transport for
[advanced-query.md](../../../../.agents/design/data-management/advanced-query.md).

- **Why `f<N>_*` could not carry it.** The chip param shape is
  keyed by 0-based column index, at most one predicate per column,
  AND-only. There is no key for "a second predicate on the same
  column" nor for "OR between predicates." OR is structurally
  inexpressible. So `aq` is an **additive** transport, not an
  extension of `f<N>_*` — every existing `f<N>_*` / `q` / `page`
  request is byte-for-byte unchanged and stays green.
- **Why a single JSON param, not `aq_g<G>_<N>_*` structured keys.**
  A DNF needs two nesting levels (OR of AND). Flat structured keys
  for two levels (`aq_g0_0_op`, `aq_g0_1_op`, `aq_g1_0_op`, …)
  balloon fast and are unreadable. One URL-encoded JSON value is
  compact at MVP scale (single-level DNF, a handful of atoms) and
  reuses the exact atom shape `f<N>_*` already serializes.
- **Why GET, not the parked `POST :search`.** A GET keeps the
  endpoint shareable (URL is the durability surface for `aq`, same
  as `?q=` and `f<N>_*`) and TanStack-cacheable with the predicate
  set in the key. The
  [parked `POST :search` JSON-body fallback](../../../../.agents/design/data-management/dataset-filters.md#fallback-json-body-via-post-datasetsidrowssearch)
  stays parked; promote it only if `aq` URLs balloon in practice.
- **Atom shape = `FilterPredicate`.** Each `aq` atom is the same
  object the chip row serializes: `{ col, dtype, op, val | min,max }`.
  The BE validates each atom with the **same** per-dtype rules as
  `f<N>_*` (`OPS_BY_DTYPE`, value parse, operand shape) and reuses
  the same single-predicate SQL builder; the only new BE logic is
  the OR-of-AND **composition wrapper**:
  `(g1_atom AND …) OR (g2_atom AND …) OR …`.
- **Composition.** `aq` AND-composes with `f<N>_*` and `?q=`. The
  final WHERE is `chipSQL AND aqSQL AND qSQL`, any subset of which
  may be empty. `total` reflects the fully-composed matched count.
- **Grammar is FE-only.** The BE never receives query text. The
  precedence rule (`AND` binds tighter than `OR`), tokenization,
  and positional parse errors live entirely in the FE parser; the
  wire carries validated predicate JSON only. A future second
  grammar (or a different client) reuses the same `aq` transport.
- **Errors.** Malformed `aq` (not valid JSON, or not an
  array-of-arrays-of-objects) → 422 `advanced_query_malformed`,
  `loc = ["query", "aq"]`. A structurally valid atom that fails a
  per-atom check → the existing `filter_op_dtype_mismatch` /
  `filter_value_unparseable` / `filter_col_out_of_range` /
  `filter_operand_shape` code, with `loc = ["query", "aq"]` rather
  than `["query", "f<N>_op"]`.

### Advanced-query examples

OR across the same column (the capability `f<N>_*` cannot express):

```http
GET /datasets/ds_71a4e2f0/rows?aq=%5B%5B%7B%22col%22%3A3%2C%22dtype%22%3A%22string%22%2C%22op%22%3A%22equals%22%2C%22val%22%3A%22won%22%7D%5D%2C%5B%7B%22col%22%3A3%2C%22dtype%22%3A%22string%22%2C%22op%22%3A%22equals%22%2C%22val%22%3A%22lost%22%7D%5D%5D HTTP/1.1
```

(decoded `aq` = `[[{col:3,…equals "won"}],[{col:3,…equals "lost"}]]`
→ `stage=won OR stage=lost`.)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{ "rows": [ /* won + lost rows */ ], "page": 1, "pageSize": 50, "total": 1533 }
```

Malformed `aq` (422):

```http
GET /datasets/ds_71a4e2f0/rows?aq=not-json HTTP/1.1
```

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "detail": [
    {
      "loc": ["query", "aq"],
      "msg": "advanced_query_malformed: aq is not valid JSON",
      "type": "value_error"
    }
  ]
}
```

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
[Evolution Rule](../../../../.agents/AGENTS.md): _default = don't
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

### Filter-related 422 cases (R38)

The BE enforces the per-column filter semantics and surfaces
each violation via a descriptive `detail[].msg` string. The
envelope shape is unchanged (FastAPI's request-validation
shape); new error codes are communicated in `msg`, not in a
new schema. The four codes:

| `msg` prefix | Trigger |
| --- | --- |
| `filter_op_dtype_mismatch` | `f<N>_op` is not a valid operator for `Dataset.columns[N].dtype` (e.g. `f1_op=contains` on an integer column). |
| `filter_value_unparseable` | `f<N>_val` (or `_min` / `_max`) fails the per-dtype parse rule (e.g. `f1_val=foo` on an integer column; `f2_val=not-a-date` on a date column). |
| `filter_col_out_of_range` | `f<N>_*` for `N >= Dataset.columnCount` (no such column). |
| `filter_operand_shape` | Operator and operand shape disagree: `between` without both `_min` and `_max`, or `_min > _max`; a single-operand op with `_min`/`_max` and no `_val`; or a no-operand op with any `_val` / `_min` / `_max`. |

A request that matches the filter set but returns zero rows
is **not** 422; it returns 200 with `rows: []` and `total: 0`
(same shape as a `?q=` no-match). 422 is reserved for
_malformed_ requests, not _empty-result_ requests.

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

Per-column filter (column 3 = `stage`, equals "won"):

```http
GET /datasets/ds_71a4e2f0/rows?f3_op=equals&f3_val=won HTTP/1.1
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

Per-column filter — AND-compose with `?q=`:

```http
GET /datasets/ds_71a4e2f0/rows?q=renewal&f3_op=equals&f3_val=won HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "rows": [
    ["D-0005", "24500", "2026-05-02", "won", "1.00", "true", "2026-04-22T08:11:00Z", "renewal — multi-year"]
  ],
  "page": 1,
  "pageSize": 50,
  "total": 47
}
```

Per-column filter — dtype mismatch (422):

```http
GET /datasets/ds_71a4e2f0/rows?f1_op=contains&f1_val=foo HTTP/1.1
```

(`f1` = column 1 = `amount`, dtype `integer`; `contains` is
only valid for `string` columns.)

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "detail": [
    {
      "loc": ["query", "f1_op"],
      "msg": "filter_op_dtype_mismatch: op 'contains' is not valid for dtype 'integer'",
      "type": "value_error"
    }
  ]
}
```

Per-column filter — numeric range:

```http
GET /datasets/ds_71a4e2f0/rows?f1_op=between&f1_min=10000&f1_max=50000 HTTP/1.1
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "rows": [
    ["D-0001", "12400", "2026-03-01", "won", "0.95", "true", "2026-02-28T14:02:00Z", "quick close, no contention"],
    ["D-0017", "48200", "2026-04-08", "won", "0.92", "true", "2026-04-01T10:20:00Z", null]
  ],
  "page": 1,
  "pageSize": 50,
  "total": 412
}
```

## Cross-links

- [detail-get.contract.yaml](detail-get.contract.yaml) — schema + column metadata companion
- [`../_shared/dataset.yaml`](../_shared/dataset.yaml) — column dtype list the FE uses for cell rendering
- [`../_shared/api-error.yaml`](../_shared/api-error.yaml) — ApiErrorNotFound envelope
- [dataset-detail.md](../../../../.agents/design/data-management/dataset-detail.md) — R33 design doc (cell rendering rules + state transitions)
- [dataset-filters.md](../../../../.agents/design/data-management/dataset-filters.md) — R37 design doc (per-column filter UX + predicate vocabulary table — authoritative cross-stack spec for `f<N>_*` params)
- [advanced-query.md](../../../../.agents/design/data-management/advanced-query.md) — R51 design doc (advanced-query grammar + the `aq` transport rationale)
