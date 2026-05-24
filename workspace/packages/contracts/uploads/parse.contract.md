# `POST /uploads/{temp_id}/parse` — contract rationale

> **Authoritative shape**: [parse.contract.yaml](parse.contract.yaml).

## Purpose

The Excel-only Phase 2 of the two-phase upload flow. Parses one
or more sheets of a previously-uploaded workbook into Parquet
companion files (server-side, not on the wire) and returns the
parsed schema + sample rows the wizard's Metadata / Preview steps
render. CSV uploads never hit this endpoint — their parse
happened inline on
[`POST /uploads`](post.contract.md).

The wizard calls this endpoint on the Sheet → Metadata transition
with **every selected sheet** in one request, and again on a
Metadata step `[Re-parse this sheet]` action with the new
`parse_options` and a single-item array.

## Behavior

- **Batched-per-call.** One request can parse multiple sheets;
  individual sheet failures are body-carried per item, **not**
  HTTP failures. Rationale: the wizard's multi-tab Metadata step
  needs to render `✗` on the failing tab while the user inspects
  successful tabs.
- **Idempotent against the same `parse_options`.** Calling with
  the same `{sheet, parse_options}` produces the same response;
  the server overwrites
  `parsed.<sheet_key>.parquet` + `preview.<sheet_key>.json` each
  time. Re-parsing the same sheet with new options is the
  expected wizard interaction.
- **`temp_id` validity**: the upload must exist and have been
  classified as `sourceFormat: excel` on Phase 1. CSV uploads
  return 404 (their sheet enumeration is degenerate; the contract
  is intentionally Excel-only).
- **`parse_options` defaults**: when a field is omitted, the
  backend uses the sniffer-inferred default from Phase 1
  (full used-range, header in row 1).
- **Sample rows**: capped at 10 rows per sheet (R16 implementation
  detail; the contract does not specify a max, so the cap can grow
  without a contract change).
- **`sheet` matching**: case-sensitive, exact-match against the
  sheet name returned in Phase 1's `sheets[]`. The contract does
  not normalize whitespace or case.

## Error semantics

- **`404 Not Found`**: `temp_id` is unknown. Causes: never
  created; refers to a CSV upload; TTL elapsed and the temp
  directory was swept. The body distinguishes the three reasons
  only by HTTP convention — no body distinguishing data is
  guaranteed.
- **`422 Unprocessable Entity`**: request-level validation
  failure. Causes: malformed JSON; `items` empty; a `sheet` value
  not present in the workbook; `parse_options.range` not a valid
  cell range; `parse_options.skip_rows` < 0.
- **Body-carried per-sheet failures**: each `results[i]` may
  have `status: "failed"` with an `error` machine code and a
  human `detail`. Causes include: range out of bounds, empty
  range, header row with duplicate column names, parser
  exception (corrupt sheet). The overall response is still 200
  if at least one sheet's status is `ok`. If **all** sheets
  fail, the response is still 200 with all-failed items — the
  wizard then disables `Next` until the user re-picks file or
  removes the failing sheets from selection.

## Examples

Two-sheet success request:

```http
POST /uploads/tmp_4f8a91c0b3d7e251/parse HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "items": [
    { "sheet": "Deals" },
    { "sheet": "Contacts", "parse_options": { "has_header": true } }
  ]
}
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "results": [
    {
      "sheet": "Deals",
      "status": "ok",
      "columns": [
        { "name": "deal_id", "dtype": "string"   },
        { "name": "amount",  "dtype": "float"    },
        { "name": "closed",  "dtype": "boolean"  }
      ],
      "rowCount": 2481,
      "sampleRows": [
        ["D-001", "12000.00", "false"],
        ["D-002",  "4500.50",  "true"]
      ]
    },
    {
      "sheet": "Contacts",
      "status": "ok",
      "columns": [ /* ... */ ],
      "rowCount": 14902,
      "sampleRows": [ /* ... */ ]
    }
  ]
}
```

Mixed success/failure (one bad sheet, others OK):

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "results": [
    { "sheet": "Deals", "status": "ok", "columns": [...], "rowCount": 2481, "sampleRows": [...] },
    { "sheet": "Summary", "status": "failed",
      "error": "duplicate_columns",
      "detail": "Header row contains duplicate column names: 'Total' (cols A and D)" }
  ]
}
```

Re-parse one sheet with new options:

```http
POST /uploads/tmp_4f8a91c0b3d7e251/parse HTTP/1.1
Content-Type: application/json

{
  "items": [
    { "sheet": "Deals",
      "parse_options": { "range": "A3:L2483", "has_header": true } }
  ]
}
```

## Cross-links

- [post.contract.yaml](post.contract.yaml) — Phase 1 (upload + sheet enumeration)
- [`../datasets/batch-post.contract.md`](../datasets/batch-post.contract.md) — commit step
- [`../_shared/parse-options.yaml`](../_shared/parse-options.yaml) — options shape
- [upload.md](../../../.agents/design/data-management/upload.md) — design doc + wizard ASCII
