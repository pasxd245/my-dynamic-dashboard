# `POST /uploads` — contract rationale

> **Authoritative shape**: [post.contract.yaml](post.contract.yaml).

## Purpose

Phase 1 of the **two-phase upload** flow described in
[upload.md](../../../.agents/design/data-management/upload.md).
A single multipart POST:

1. Receives a CSV or Excel file from the wizard's Source step.
2. Writes the file to `data/uploads_tmp/<temp_id>/` (server-side
   path; not exposed on the wire).
3. For CSV, parses the file inline using DuckDB's `read_csv_auto`
   and returns the parsed columns + first 10 sample rows. The
   wizard's Preview step renders this directly without a follow-up
   call.
4. For Excel, enumerates sheets (sheet name + row/column counts +
   detected used-range) via `openpyxl`. **Does not parse** any
   sheet — that's a separate POST per sheet at
   [`POST /uploads/{temp_id}/parse`](parse.contract.md).

No Dataset row is created at this step. The Dataset row appears
only at commit time via
[`POST /workspaces/{id}/datasets/batch`](../datasets/batch-post.contract.md).

## Behavior

- **Two-phase rationale.** Splitting upload-and-parse from commit
  serves two purposes: failed parses never leak Dataset rows
  (Q12 in [upload.md](../../../.agents/design/data-management/upload.md)),
  and the user can revise the parse (range, has_header, dtypes)
  before committing. Excel's per-sheet split additionally keeps
  the initial wait short on workbooks with 10+ sheets when the
  user will only select 2.
- **`temp_id` lifetime**: temp files live for 24 hours, then a
  sweeper removes them (sweeper round TBD; not in R16). The
  client treats `temp_id` as opaque; the format
  `tmp_<16 hex>` is conventional but the client must not parse it.
- **Idempotency**: not idempotent. Two identical multipart POSTs
  produce two distinct `temp_id`s. The wizard's `Next` button is
  client-throttled (disabled while in-flight) to avoid duplicate
  temp directories.
- **No `workspace_id` here.** The workspace is bound at commit
  time, not at upload. This lets the wizard's Workspace picker
  be edited after the file is uploaded without re-uploading
  (current wizard design doesn't expose that, but the contract
  allows for it).
- **File-size limit**: 100 MB enforced server-side. 413 is
  returned before the file is fully consumed.
- **Content-type sniffing**: backend cross-checks the
  client-declared `sourceFormat` against magic bytes (CSV =
  printable-ASCII first 4KB; Excel = `PK\x03\x04` ZIP signature
  for `.xlsx`, `\xD0\xCF\x11\xE0` OLE for `.xls`). Mismatch
  returns 415.

## Error semantics

- **`413 Payload Too Large`**: file exceeds 100 MB. Implementation
  may stream-reject (preferred) or accept-then-reject; behavior
  is the same from the client's perspective.
- **`415 Unsupported Media Type`**: claimed `sourceFormat`
  doesn't match the file's actual content, or the Excel file is
  encrypted / password-protected. Body is empty (FastAPI default).
- **`422 Unprocessable Entity`** (CSV only): the file is malformed
  (mid-row column count mismatch, unrecoverable encoding error,
  etc.). DuckDB's parse error is mapped to a short
  `{ "error", "detail" }` body. Excel parse failures don't appear
  here because Step 1 doesn't parse Excel sheets — those surface
  on the per-sheet `parse` endpoint.

## Examples

CSV success:

```http
POST /uploads HTTP/1.1
Host: localhost:8000
Content-Type: multipart/form-data; boundary=---X

---X
Content-Disposition: form-data; name="sourceFormat"

csv
---X
Content-Disposition: form-data; name="file"; filename="leads.csv"
Content-Type: text/csv

deal_id,stage,amount
D-001,Prospect,12000
D-002,Active,4500
---X--
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "temp_id": "tmp_4f8a91c0b3d7e251",
  "sourceFormat": "csv",
  "sizeBytes": 1442,
  "csvPreview": {
    "columns": [
      { "name": "deal_id", "dtype": "string"  },
      { "name": "stage",   "dtype": "string"  },
      { "name": "amount",  "dtype": "integer" }
    ],
    "rowCount": 2,
    "sampleRows": [
      ["D-001", "Prospect", "12000"],
      ["D-002", "Active",   "4500"]
    ]
  }
}
```

Excel success (sheet enumeration only):

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "temp_id": "tmp_4f8a91c0b3d7e251",
  "sourceFormat": "excel",
  "sizeBytes": 253408,
  "sheets": [
    { "sheet": "Deals",      "rowCount": 2481,  "columnCount": 12, "usedRange": "A1:L2482" },
    { "sheet": "Contacts",   "rowCount": 14902, "columnCount": 7,  "usedRange": "A1:G14903" },
    { "sheet": "Leads_2025", "rowCount": 431,   "columnCount": 9,  "usedRange": "A1:I432" }
  ]
}
```

CSV parse failure:

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "error": "csv_parse_failed",
  "detail": "Line 3: expected 4 columns, found 2"
}
```

## Cross-links

- [parse.contract.yaml](parse.contract.yaml) — Phase 2 (Excel-only
  per-sheet parse)
- [`../datasets/batch-post.contract.md`](../datasets/batch-post.contract.md) — commit step
- [upload.md](../../../.agents/design/data-management/upload.md) — design doc + wizard ASCII
- [`../_shared/temp-upload.yaml`](../_shared/temp-upload.yaml) — response shapes
