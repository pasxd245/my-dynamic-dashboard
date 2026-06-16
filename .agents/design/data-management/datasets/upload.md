# Upload — feature design (verb, full-page wizard, multi-source)

> ⚠️ **OUT OF SYNC** — `design-sync --check` (2026-06-17) found this doc has drifted from the
> implementation: **9 claim(s) diverge from code** (named helpers `cast_columns()`/`parse_excel()`/
> `read_excel_sheets()` don't exist — real ingest is `parse_csv`/`parse_sheet`/`enumerate_sheets`/
> `write_*_to_parquet` with no re-cast step; the temp FS layout is wrong; `POST /uploads` returns
> 200 not 201; the commit `temp_id` is top-level on `_BatchRequest`, not per-item; there is no
> parse-options-mismatch `409` and commit RE-PARSES from the original; name validation is 1–120,
> not 1–80). See `.agents/tmp/design-sync/datasets.md`. Re-sync before trusting or designing on it:
> run `design-sync .agents/design/data-management/datasets`.
<!-- design-sync:out-of-sync domain=data-management/datasets detected=2026-06-17 claims=9 -->

**Concept**: Upload is a **full-page wizard** at
`/data-management/datasets/new` that brings a tabular data file
into the product and turns it into one or more
[Dataset](datasets.md) rows. The user picks a **data source type**
(Excel primary · CSV secondary), a workspace, and a file; for
Excel can select **multiple sheets** in one run (each becomes its
own Dataset); reviews and **overrides inferred column dtypes** in
a Metadata step; previews the first ten rows of parsed data; names
each dataset; and commits. Dataset rows appear in the
[Datasets table](datasets.md) only after the Confirm step's atomic
commit succeeds — failed parses never become persisted Datasets.
**Status**: Accepted (R14 design; shipped R15–R17; extended R19/R21/R30/R32).
**Round introduced**: [Round_14](../../../plan/cycles/Round_14.md);
implementation chain begins R15.
**Backend**: [Round_16](../../../plan/cycles/Round_16.md) — temp
upload + per-sheet parse + atomic batch-commit endpoints land
against the locked R15 contracts; persistence is SQLite metadata +
filesystem tree for parsed parquet.
**Frontend**: [Round_17](../../../plan/cycles/Round_17.md) — full-page
wizard at `/data-management/datasets/new`; reducer-driven state;
CSV 3-step / Excel 4-step paths.
**Frontend**: [Round_21](../../../plan/cycles/Round_21.md) — parse-options
disclosure (range / skip_rows / has_header), Excel `[Re-parse this
sheet]`, three preview-failed action buttons, override-reset on
re-parse and on parse-options edit (R19 Q2, Q4).
**Sibling docs**:
[datasets.md](datasets.md) (the noun this wizard creates),
[workspaces.md](../workspaces/workspaces.md) (the container an upload targets),
[workspace-shell.target.md](../../_platform/workspace-shell.target.md) (the chrome
the wizard renders inside).

---

## Why a page, not a modal — and why a multi-source wizard

Two reframes shaped this design, both during R14's HIxAI review:

1. **Modal → page.** The modal couldn't carry a useful data
   preview — and previewing the parsed schema + first ten rows is
   the gate that justifies multi-step ingestion in an analytics
   product. The wizard gives the preview step the full content
   area, lets Cancel be a clean exit, and is the in-flow failure-
   handling surface (so the Datasets table never carries
   transient or failed rows).
2. **Single-source → multi-source.** The user named Excel as the
   primary data source (CRM exports are predominantly `.xlsx`;
   CSV is the export-of-export fallback). The wizard's IA
   accommodates this: a data-source selector at Step 1 sets the
   downstream step path. CSV stays a 3-step flow; Excel becomes
   a 4-step flow with a Sheet selection inserted before Preview.
   Future sources (API, Website, SQL, …) plug in as additional
   selector options with their own step variants; R15 commits
   only Excel + CSV.

The wizard's stepper renders dynamically — it shows 3 dots for
CSV, 4 for Excel. Users see only the steps relevant to their
chosen source.

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                | Layer                                                | Reusability  | Purity             | Allowed peer deps                                |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------ | ------------------ | ------------------------------------------------ |
| `DatasetNewPage` route component                       | `apps/builder/src/features/data-management/datasets` | feature      | feature            | react, react-router-dom, antd, @ant-design/icons |
| `UploadStepper` component                              | `apps/builder/src/features/data-management/datasets` | feature      | plain-UI           | react, antd                                      |
| `UploadSourceStep` component                           | `apps/builder/src/features/data-management/datasets` | feature      | feature            | react, antd, @tanstack/react-query               |
| `UploadSheetStep` component (Excel-only, checkboxes)   | `apps/builder/src/features/data-management/datasets` | feature      | feature            | react, antd                                      |
| `UploadMetadataStep` component (per-sheet tabs)        | `apps/builder/src/features/data-management/datasets` | feature      | feature            | react, antd                                      |
| `UploadPreviewStep` component (per-sheet tabs)         | `apps/builder/src/features/data-management/datasets` | feature      | feature            | react, antd                                      |
| `UploadConfirmStep` component (N-dataset summary)      | `apps/builder/src/features/data-management/datasets` | feature      | feature            | react, antd                                      |
| `useUploadInitMutation` hook                           | `apps/builder/src/features/data-management/datasets` | feature      | glue (server-data) | @tanstack/react-query                            |
| `useUploadParseMutation` hook                          | `apps/builder/src/features/data-management/datasets` | feature      | glue (server-data) | @tanstack/react-query                            |
| `useDatasetsCommitMutation` hook (atomic batch)        | `apps/builder/src/features/data-management/datasets` | feature      | glue (server-data) | @tanstack/react-query                            |
| `uploadsApi` client                                    | `apps/builder/src/api/`                              | builder-only | glue               | (fetch — no extra peer dep)                      |
| `POST /uploads` route (temp + light metadata)          | `apps/backend/`                                      | backend      | feature            | (FastAPI multipart — backend native)             |
| `POST /uploads/<temp_id>/parse` route (per-sheet)      | `apps/backend/`                                      | backend      | feature            | (FastAPI — backend native)                       |
| `POST /workspaces/<id>/datasets/batch` (atomic commit) | `apps/backend/`                                      | backend      | feature            | (FastAPI — backend native)                       |
| `parse_csv()` ingestion helper                         | `apps/backend/app/ingest/`                           | backend      | pure (data)        | duckdb                                           |
| `parse_excel()` ingestion helper                       | `apps/backend/app/ingest/`                           | backend      | pure (data)        | duckdb (excel ext) or pandas+openpyxl            |
| `read_excel_sheets()` helper                           | `apps/backend/app/ingest/`                           | backend      | pure (data)        | openpyxl (or duckdb excel ext)                   |
| `cast_columns()` helper (dtype-override re-cast)       | `apps/backend/app/ingest/`                           | backend      | pure (data)        | duckdb / pyarrow                                 |
| `UploadDraft` type (frontend in-memory)                | `apps/builder/src/features/data-management/datasets` | feature      | data type          | none                                             |

**Boundary check**: no wizard surface lives in `@mdd/ui`. All
step components and ingestion helpers live in their respective
feature folders; the wizard's state-machine wiring stays
co-located with `DatasetTable`.

The `parse_csv()` and `parse_excel()` helpers are intentionally
parallel — one entry point per source type. A future source adds
a new helper (`parse_api_endpoint`, `parse_database_query`, …)
following the same shape: `(source) → ParseResult`.

---

## Layout — ASCII intent

The wizard renders inside the master-layout chrome with the
sidebar's "Datasets" sub-item active. PageHeader carries the
breadcrumb, title, and Cancel affordance; PageCard wraps the
stepper, step content, and nav buttons. The stepper renders
**dynamically** — 3 dots for CSV, 4 dots for Excel.

### Step 1 — Source (data-source type + workspace + file)

```text
                                                                  ┌── PageHeader.actions ──┐
Home ▸ Data Management ▸ Datasets ▸ New                                          [Cancel] │
New dataset                                                                              │
Upload a file and turn it into a queryable dataset.                      ────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                         │
│                                                                                   │
│   Data source                                                                     │
│   ┌────────────────────────┐  ┌────────────────────────┐                          │
│   │ 📊  Excel              │  │ 📄  CSV                │                          │
│   │ .xlsx, .xls            │  │ .csv                   │                          │
│   │ (selected)             │  │                        │                          │
│   └────────────────────────┘  └────────────────────────┘                          │
│                                                                                   │
│   Workspace *                                                                     │
│   [Select a workspace                                            ▾]               │
│   The dataset will live in this workspace.                                        │
│                                                                                   │
│   File *                                                                          │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │                              📥                                         │    │
│   │              Drop a file here, or click to browse                       │    │
│   │              .xlsx · Up to 100 MB                                       │    │
│   └────────────────────────────────────────────────────────────────────────┘    │
│   (Drop-zone copy adapts to the selected source: .xlsx / .csv)                    │
│                                                                                   │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                          [Next >] │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Data-source selector renders as **two cards** (Excel + CSV) — a
  segmented control would also work, but cards leave room for an
  icon + format hint. Excel is the default selection because it's
  the primary R15 source; CSV is the fallback.
- Workspace picker required. Pre-filled from `?workspace=<id>`
  when entered from a filtered Datasets view.
- File required. The drop zone's accept-types and "Up to 100 MB"
  hint adapt to the selected source.
- `[Next >]` enabled iff source type + workspace + file are all
  set. Clicking Next triggers `POST /uploads` (temp + lightweight
  metadata extraction) and transitions to the next step:
  - **CSV path**: → Step 2 (Preview)
  - **Excel path**: → Step 2 (Sheet)

### Step 2 — Sheet (Excel only, multi-select)

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                         │
│      ●──────●──────○──────○──────○                                                │
│   1·Source 2·Sheet 3·Metadata 4·Preview 5·Confirm                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                   │
│  q1_pipeline_2026.xlsx · 248 KB · 4 sheets                                        │
│                                                                                   │
│  Select sheets to import (one Dataset will be created per sheet):                 │
│                                                                                   │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │  [✓]  Deals                            2,481 rows  · 12 columns        │    │
│   ├────────────────────────────────────────────────────────────────────────┤    │
│   │  [✓]  Contacts                        14,902 rows  ·  7 columns        │    │
│   ├────────────────────────────────────────────────────────────────────────┤    │
│   │  [ ]  Leads_2025                         431 rows  ·  9 columns        │    │
│   ├────────────────────────────────────────────────────────────────────────┤    │
│   │  [ ]  Summary                              1 row   ·  4 columns        │    │
│   └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                   │
│  [Select all]   [Clear]                                  2 of 4 selected          │
│                                                                                   │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                              [< Back]  [Next >]   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- Sheets are listed with **light metadata only** — sheet name,
  row count, column count — returned by `POST /uploads`. No
  parse yet. **Checkbox selection** (multi-select, 1+ required).
- `[Next >]` enabled iff ≥ 1 sheet selected. Clicking Next triggers
  `POST /uploads/<temp_id>/parse` for **each selected sheet** —
  parsed in sequence on the backend, each writing
  `parsed.<sheet_key>.parquet` and `preview.<sheet_key>.json`.
  Lean: parallel parse on the backend when feasible (small files);
  the frontend awaits all results before transitioning. R15+ Plan
  decides serial vs concurrent.
- Subsequent steps (Metadata, Preview) gain **tabs** — one per
  selected sheet. The wizard's "Next" navigation moves between
  steps, not between tabs; the user reviews each sheet inside the
  current step.
- One Dataset is created per selected sheet at the Confirm step's
  atomic commit. The user can rename each dataset individually
  in Confirm.

### Step 3 — Metadata (CSV: Step 2; Excel: Step 3)

```text
                  ●──────●──────●──────○──────○                  (Excel)
               1·Source 2·Sheet 3·Metadata 4·Preview 5·Confirm

                  ●──────●──────○──────○                          (CSV)
               1·Source 2·Metadata 3·Preview 4·Confirm
─────────────────────────────────────────────────────────────────────────────

  Excel only — sheet tabs at the top of the step body:
  [ Deals ●]  [ Contacts ○]                                          (active tab in solid dot)

  Detected schema for Deals (2,481 rows · 12 columns).
  Override any column's dtype before previewing the parsed data.

   ┌────────────────────────────────────────────────────────────────────────┐
   │ Column        │ Detected     │ Override          │ Sample values        │
   ├────────────────────────────────────────────────────────────────────────┤
   │ deal_id       │ string       │ [string      ▾]   │ D-001, D-002, D-003  │
   │ stage         │ string       │ [string      ▾]   │ Prospect, Active, Won│
   │ amount        │ float        │ [float       ▾]   │ 12000.00, 4500.50    │
   │ owner         │ string       │ [string      ▾]   │ alice@…, bob@…       │
   │ created_at    │ datetime     │ [datetime    ▾]   │ 2025-12-03 09:14     │
   │ closed        │ boolean      │ [boolean     ▾]   │ true, false, true    │
   │ ...                                                                     │
   └────────────────────────────────────────────────────────────────────────┘

   [Reset all to detected]                                          12 of 12 columns

                                                              [< Back]  [Next >]
```

### Parse-options disclosure (Metadata step)

Above the column-override table the Metadata step has a collapsed
**Parse options ▸** disclosure. Pulled forward from the
[drifted iteration](../../../context/drifted-iteration.md) — the
escape hatch for messy spreadsheets where the table doesn't start
at A1 with a header row. Defaults are fine for clean files; the
disclosure exists for the realistic CRM-export case where the
sheet has a title row, blank rows, or multiple tables.

**Excel parse options** (per sheet — each tab has its own):

- **Range** — text input. Default = the sheet's full used range
  (returned by the sniffer in Step 1's `POST /uploads`). Override
  with a cell range like `A1:C20` to skip title rows / blank
  columns / extract a sub-table.
- **First row is header** — checkbox. Default ON. When OFF, the
  parser auto-generates column names `column1, column2, column3, …`
  (Excel's "Format as Table → My table has headers OFF" pattern;
  HIxAI Q14c locks the naming convention).

**CSV parse options**:

- **Skip rows** — numeric input. Default 0. Number of leading
  rows to drop before reading. The CSV equivalent of an Excel
  range start.
- **First row is header** — same as Excel; same auto-gen
  fallback when OFF.

**Apply behavior**: editing parse options shows a `[Re-parse]`
button. Clicking it triggers `POST /uploads/<temp_id>/parse` for
the active sheet with the new options. The Metadata column list
refreshes (different columns may appear or disappear). **Any
dtype overrides the user made on the previous parse for this
sheet are reset** — column names may no longer match — with an
inline warning in the disclosure. Conservative R15 behavior;
smarter override-merge can land in a later round if real users
hit friction.

**Defaults applied at commit time**: if the user never expands
the disclosure, the parse options are unset and the backend uses
its sniffer-inferred defaults (full range, header in row 1).

---

## Metadata step — column overrides + selection

Below the parse-options disclosure sits the column-override
table. It serves two purposes: choosing which columns ship in
the Dataset, and overriding each kept column's dtype.

- **Include** is the first column — a checkbox per row. **All
  checked by default** (HIxAI Q14d locked the default). Unchecking
  a row marks that column as excluded; the row dims and the
  column is dropped at commit time. At least one row must remain
  checked or the wizard's `Next` button is disabled with an
  inline message.
- One row per inferred column. **Override** is the editable
  dtype field — column **name** is read-only in R15+ (renaming
  deferred to R∞).
- Override dropdown values: `string · integer · float · boolean ·
date · datetime`. Any override is allowed at this step; the
  Commit step's atomic commit re-casts via `cast_columns()` —
  implausible casts (e.g., `"abc"` → integer) surface as a 422
  with a row-pointing error and the wizard remains on Confirm
  with an inline `<Alert>`.
- **Format string** input appears under the dtype dropdown **only
  when the dtype is `date` or `datetime`**. CSV / Excel source
  dates are notoriously ambiguous (`01/02/2026` could be Jan 2
  or Feb 1 depending on locale); the format input lets the user
  disambiguate. Default value is auto-detected from the sample
  rows when possible (e.g., `yyyy-MM-dd HH:mm` for ISO-ish
  values); the user can edit. Format syntax follows the
  Java/`DateTimeFormatter`-style pattern (`yyyy-MM-dd`,
  `dd/MM/yyyy HH:mm`, …) — the same conventions pandas and
  DuckDB both understand. R15 ships the input; R∞ adds format
  autocomplete + a "Use detected" reset if user friction surfaces.
- **Sample values** column shows up to 3 distinct values from
  Step 2's preview JSON to help the user decide on the override
  (especially the format-string default for dates).
- `[Reset all to detected]` clears all overrides on the active
  tab. Per-row reset affordance is R∞ until a user has 50+
  columns and needs targeted reverts.
- **Excel multi-sheet**: tabs at the top of the step body, one
  per selected sheet. Active tab is highlighted. Switching tabs
  preserves overrides per sheet (held in `UploadDraft` client
  state, keyed by sheet name).
- **CSV**: no tabs; single column-list.

### Step 3/4 — Preview (parse succeeded)

```text
                  ●──────●──────●──────●──────○                  (Excel)
               1·Source 2·Sheet 3·Metadata 4·Preview 5·Confirm

                  ●──────●──────●──────○                          (CSV)
               1·Source 2·Metadata 3·Preview 4·Confirm
─────────────────────────────────────────────────────────────────────────────

  Excel only — sheet tabs (same set as Metadata step):
  [ Deals ●]  [ Contacts ○]

  Deals  (q1_pipeline_2026.xlsx) · 248 KB · 2,481 rows · 12 columns
                                                                                 ─
   ┌────────────────────────────────────────────────────────────────────────┐  │
   │ deal_id │ stage   │ amount  │ owner       │ created_at        │ ...   │  │
   │ string  │ string  │ float   │ string      │ datetime          │ ...   │  │
   ├────────────────────────────────────────────────────────────────────────┤  │
   │ D-001   │ Prospect │ 12000.00 │ alice@…   │ 2025-12-03 09:14 │ ...    │  │
   │ D-002   │ Active   │  4500.50 │ bob@…     │ 2025-12-03 11:02 │ ...    │  │
   │ D-003   │ Won      │ 88000.00 │ alice@…   │ 2025-12-04 16:38 │ ...    │  │
   │ ... (showing 10 of 2,481 rows)                                         │  │
   └────────────────────────────────────────────────────────────────────────┘  │
                                                                                 ─
   [Adjust parse options ▾]  (R∞ — header row, encoding, delimiter for CSV)

                                                              [< Back]  [Next >]
```

- Header row of the preview shows column name (top) + dtype
  (small label below). The dtype reflects the user's Metadata
  override (read-only here — to change it, go back to Metadata).
- 10 rows of sample data. Horizontal scroll for wide tables.
- **Excel multi-sheet**: same tabs as the Metadata step. Each
  tab's preview reads from `preview.<sheet_key>.json` (the temp
  upload's per-sheet preview file). Switching tabs is cheap; no
  re-parse needed since overrides only affect commit.
- `[Adjust parse options ▾]` R∞ stub. For Excel: header-row
  detection (sheets with title rows). For CSV: delimiter,
  encoding, header-row.
- `[Back]` returns to the Metadata step (preserves overrides).
- `[Next >]` transitions to Confirm.

### Step 3/4 — Preview (parse failed)

A parse failure surfaces inline on the failing sheet's tab (Excel)
or on the single content area (CSV). Other sheets' tabs continue
to render their previews normally — one bad sheet doesn't block
inspection of the others.

```text
   ●──────●──────●──────●──────○                                      (Excel)
1·Source 2·Sheet 3·Metadata 4·Preview 5·Confirm

   ●──────●──────●──────○                                              (CSV)
1·Source 2·Metadata 3·Preview 4·Confirm
─────────────────────────────────────────────────────────────────────────────

  [ Deals ✗]  [ Contacts ●]                                            (Excel tabs; failed sheet shows ✗)

┌──────────────────────────────────────────────────────────────────────────────┐
│  ✗  Could not parse this sheet                                                │
│                                                                                │
│  Row 2,103 has 11 columns; the header has 12.                                  │
│  This usually means a misaligned row or an unescaped delimiter.                │
│                                                                                │
│  [Re-pick file]   [Deselect this sheet]  (Excel)   [Adjust parse options]      │
└──────────────────────────────────────────────────────────────────────────────┘

                                                              [< Back]  [Next >]
                                                              (Next disabled if any
                                                               selected sheet failed)
```

- **CSV**: a parse failure is total — there's only one content
  area. `[Re-pick file]` returns to Step 1.
- **Excel**: per-sheet failures. The tab marker switches to `✗`.
  `[Deselect this sheet]` removes the sheet from the selection
  (returns user to the tab list with one fewer sheet); the user
  can proceed with the others. `[Re-pick file]` re-enters Step 1.
- `[Next >]` is disabled when **any selected sheet** has a parse
  failure — the user must either deselect failed sheets or
  re-pick the file.

### Step 4/5 — Confirm (one row per dataset being created)

```text
                  ●──────●──────●──────●──────●            (Excel)
               1·Source 2·Sheet 3·Metadata 4·Preview 5·Confirm

                  ●──────●──────●──────●                   (CSV)
               1·Source 2·Metadata 3·Preview 4·Confirm
─────────────────────────────────────────────────────────────────────────────

  Review and name the datasets you're about to create.

  Workspace:     Marketing
  Source:        Excel · q1_pipeline_2026.xlsx (248 KB)

  ┌────────────────────────────────────────────────────────────────────────┐
  │ Sheet      │ Dataset name *               │ Rows   │ Cols │ Overrides  │
  ├────────────────────────────────────────────────────────────────────────┤
  │ Deals      │ [q1_pipeline_2026_Deals    ] │ 2,481  │ 12   │  none      │
  │ Contacts   │ [q1_pipeline_2026_Contacts ] │ 14,902 │  7   │  2 columns │
  └────────────────────────────────────────────────────────────────────────┘

  Creating 2 datasets in Marketing.

                                                  [< Back]  [Create datasets]
```

- **One row per selected sheet (Excel) or exactly one row (CSV)** —
  CSV is single-table by definition; the Confirm step's commit
  table always has exactly one row for CSV, hides the Sheet
  column, and the footer reads "Creating 1 dataset in &lt;workspace&gt;".
- **Default name format** differs by source:
  - CSV: `<filename_stem>` (e.g., `q1_pipeline`).
  - Excel: `<filename_stem>_<sheet_name>` (e.g.,
    `q1_pipeline_2026_Deals`) — disambiguates when multiple
    sheets from the same workbook are imported.
- Each row's name input is editable; validation is 1–80 chars
  (same as Workspace name). Duplicate names within this batch
  surface as inline validation errors.
- **Overrides column** summarizes how many columns the user
  overrode on each sheet in the Metadata step (`none` /
  `N columns`). Helps spot accidental misclicks.
- `[Create datasets]` triggers
  `POST /workspaces/<id>/datasets/batch` with the full payload:

  ```ts
  {
    items: [
      { temp_id, sheet, name, column_overrides? },
      ...
    ]
  }
  ```

  The backend handles all items in a single transaction —
  all-or-nothing. On success, navigate to
  `/data-management/datasets`; the N new rows appear at the top
  (or to `?workspace=<id>` if invoked from a filtered view).

- On commit failure (validation, cast error, FS error), an
  inline `<Alert>` surfaces above the action row with which
  item failed. The wizard stays on Confirm so the user can
  adjust and retry.

---

## Wizard state machine

```text
                              ┌─── CSV (4 steps) ───────────────────────────┐
            ┌─────────┐ Next  │  ┌──────────┐    ┌──────────┐   ┌──────────┐│
[entry] ──▶│ Source  │ ──────▶│  │ Metadata │──▶│ Preview  │─▶│ Confirm  ││
            │  (1)    │ ◀──── │  │  (CSV·2) │◀─ │ (CSV·3)  │◀─│ (CSV·4)  ││
            └─────────┘  Back │  └──────────┘    └──────────┘   └──────────┘│
                 │             └────────────────────────────────────────────┘
                 │
                 │   ┌─── Excel (5 steps) ────────────────────────────────────────────┐
                 │   │  ┌──────────┐    ┌────────────┐    ┌──────────┐   ┌──────────┐│
                 │   │  │  Sheet   │──▶│ Metadata   │──▶│ Preview  │─▶│ Confirm  ││
                 ├──▶│  │ (Excel·2)│◀─ │ (Excel·3)  │◀─ │(Excel·4) │◀─│(Excel·5) ││
                 │   │  │ checkbox │    │  tabs/sheet│    │ tabs/sht │   │ N-row    ││
                 │   │  └──────────┘    └────────────┘    └──────────┘   └──────────┘│
                 │   └────────────────────────────────────────────────────────────────┘
                 │
                 ▼ Cancel from any step       Create datasets (atomic batch)
            /data-management/             POST /workspaces/<id>/datasets/batch
             datasets                            │
                                                 ▼
                                        /data-management/datasets
                                        (N new rows appear)
```

- The state machine has **two parallel arms** branching at the
  Source step based on selected data-source type. Step indices
  are local to each arm.
- The Metadata + Preview steps' content varies by source:
  - **CSV**: single column list (Metadata) / single preview
    table (Preview). No tabs.
  - **Excel**: tabs at top of step body, one per selected sheet.
    Switching tabs is local to the step; "Next" advances the
    wizard step.
- The Preview step's failure surface is **per-sheet** on Excel
  (a `✗` marker on the failing tab) and total on CSV.
- `[Re-pick file]` from any failure state jumps back to Source.
  `[Deselect this sheet]` (Excel) removes a failing sheet from
  the selection and returns the user to the remaining tabs.
- `[Create datasets]` triggers the atomic batch commit. All
  N datasets succeed together or none do.

---

## Token map

The wizard is composed of AntD primitives (`<Steps>`, `<Card>`,
`<Upload.Dragger>`, `<Table>`, `<Tabs>`, `<Select>`, `<Alert>`,
`<Button>`) styled by the AntD `<ConfigProvider>` tokens derived from
the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts)
(the source of truth — R66). No new token is introduced; values are
informational (resolved via `theme.getDesignToken()`, antd 6.x).

| Surface                                    | AntD token                       | Value (informational) |
| ------------------------------------------ | -------------------------------- | --------------------- |
| Page background                            | `colorBgLayout`                  | `#f5f5f5`             |
| Page card background                       | `colorBgBase`                    | derived               |
| Stepper active dot                         | `colorPrimary`                   | `#1677ff`             |
| Stepper inactive dot                       | `colorBorderSecondary`           | `#f0f0f0`             |
| Source-type card border (selected)        | `colorPrimary`                   | `#1677ff`             |
| Drop-zone border (idle / hover)            | `colorBorder` → `colorPrimary`   | `#d9d9d9` / `#1677ff` |
| Override / preview table header background | `colorFillQuaternary`            | derived               |
| Table cell / column text                   | `colorText`                      | derived               |
| Sheet-tab active text                      | `colorPrimary`                   | `#1677ff`             |
| Parse-failed `✗` marker / error `<Alert>`  | `colorError`                     | `#ff4d4f`             |
| Helper / hint text                         | `colorTextTertiary`              | derived               |
| Primary `Next` / `Create datasets` button  | `colorPrimary`                   | `#1677ff`             |
| Border radius (cards, table, buttons)      | `borderRadius`                   | `6`                   |
| Font family                                | `fontFamily`                     | system stack          |

No new token is introduced. Identifier parity against the live AntD
registry is enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

---

## File storage decision

R15+ stores each uploaded file as the **raw source file** plus a
**Parquet companion** of the parsed table, on the backend
filesystem:

```text
workspace/apps/backend/data/datasets/
└── <workspace_id>/
    └── <dataset_id>/
        ├── original.<csv|xlsx>           # verbatim bytes
        ├── parsed.parquet                # DuckDB/pandas-written, schema-enforced
        └── source.json                   # { sourceFormat, sheetName?, parsedAt }
```

**Temp upload storage** (Step 1 → Step 2/3):

```text
workspace/apps/backend/data/uploads_tmp/
└── <temp_id>/
    ├── original.<csv|xlsx>
    ├── metadata.json                     # { sourceFormat, sheets?: [{name,rowCount,columnCount}] }
    ├── parsed.<sheetkey>.parquet         # written after /uploads/<temp_id>/parse succeeds
    └── preview.<sheetkey>.json           # first 10 rows + schema for the preview step
```

For CSV `<sheetkey>` is `default`. For Excel it's the sanitized
sheet name. This lets a user pick a different sheet in Step 2 and
get a fresh parse without re-uploading the file.

**Commit (Step 3/4 → POST /workspaces/<id>/datasets/batch)**: the
backend reads `metadata.json` to know which sheet was chosen
last, copies `original.<ext>` and `parsed.<sheetkey>.parquet` →
`datasets/<workspace_id>/<dataset_id>/{original.ext, parsed.parquet}`,
writes a `source.json` summarising the source format + sheet
name, inserts the Dataset row, deletes the temp directory.

**TTL on temp uploads**: 24 hours, swept by a lifespan-spawned
asyncio task (`app.jobs.tmp_sweep.sweep_loop`) that re-runs on the
configured interval. Disabled in tests via
`MDD_BACKEND__TMP_SWEEP__ENABLED=false`. Configured under
`backend.tmp_sweep.{enabled, interval_seconds, ttl_seconds}` in
`workspace/config/values.yaml` (R30). Original R15 framing
("swept on backend startup") was a one-shot; R30 replaced it with
a real periodic sweep.

**File-size cap**: 100 MB per upload, same for both formats.
Larger files defer to a future chunked-upload round.

---

## Parse-time decision

**Two-phase parse**, both server-side:

1. **Initial upload** (`POST /uploads`) — extracts lightweight
   metadata only:
   - **CSV**: sniffs the schema (column names + dtypes from
     `duckdb.read_csv_auto`'s metadata) and writes the Parquet
     companion. Returns `{ temp_id, sourceFormat: 'csv', schema, sampleRows, rowCount, sizeBytes }`.
   - **Excel**: opens the workbook (openpyxl or DuckDB excel
     extension), enumerates sheet names + per-sheet row/column
     counts. Does **not** parse any sheet. Returns
     `{ temp_id, sourceFormat: 'excel', sheets: [{name, rowCount, columnCount}], sizeBytes }`.
2. **Sheet parse** (`POST /uploads/<temp_id>/parse`, Excel only) —
   the Sheet step's Next button triggers this. The chosen sheet is
   parsed to Parquet; schema + 10 sample rows returned. CSV skips
   this step (the schema and sample rows were already returned in
   step 1).

This split keeps Step 1's wait short for Excel workbooks (sheet
enumeration is fast; parsing all sheets eagerly would be slow for
multi-sheet files where the user only wants one).

**Parser libraries**:

- **CSV**: `duckdb.read_csv_auto` for type inference + Parquet
  output. Mature, fast, handles edge cases.
- **Excel**: lead choice is `openpyxl` for sheet enumeration +
  `pandas.read_excel` (engine='openpyxl') for parse-to-DataFrame
  → DuckDB Parquet write. DuckDB has an `excel` extension too;
  the R15 Plan decides between them based on robustness
  (openpyxl is the more battle-tested path; DuckDB excel is
  newer and the round can benchmark).

---

## Backend endpoint shape

R15+ ships **three endpoints**:

```python
# apps/backend/app/routers/uploads.py
@router.post("/uploads", status_code=201, response_model=UploadInit)
async def init_upload(
    source: Literal["csv", "excel"] = Form(...),
    file: UploadFile = File(...),
) -> UploadInit:
    # 1. Validate file size + mime; 413 / 415 on violation.
    # 2. temp_id = secrets.token_hex(8).
    # 3. Stream-write to data/uploads_tmp/<temp_id>/original.<ext>.
    # 4. Branch by source:
    #    - CSV: parse_csv() → schema + Parquet + sampleRows.
    #    - Excel: enumerate sheets only (no parse) → sheet list.
    # 5. Persist metadata.json. Return UploadInit.

@router.post("/uploads/{temp_id}/parse", status_code=200, response_model=UploadParse)
async def parse_sheet(
    temp_id: str,
    body: ParseRequest,  # { items: [{ sheet?: str, parse_options?: ParseOptions }] }
) -> UploadParse:
    # ParseOptions = { range?: str (Excel only), skip_rows?: int (CSV only),
    #                  has_header?: bool (default true) }
    # Parses each item to data/uploads_tmp/<temp_id>/parsed.<sheetkey>.parquet
    # and writes preview.<sheetkey>.json with the first 10 rows + schema.
    # When has_header=false, auto-generates column names as column1, column2, …
    # (HIxAI Q14c). For CSV, items has exactly one entry with sheet omitted.
    # Returns UploadParse with per-sheet results (success or failure per sheet).
    # Individual sheet failures DO NOT 422 the whole request — the response
    # carries a per-sheet status so the wizard can show a partial-fail UI.

# apps/backend/app/routers/datasets.py
@router.post(
    "/workspaces/{workspace_id}/datasets/batch",
    status_code=201,
    response_model=list[Dataset],
)
def commit_datasets_batch(
    workspace_id: str,
    body: CommitBatch,
) -> list[Dataset]:
    # body = { items: [{ temp_id, sheet?: str, name: str,
    #                     parse_options?: ParseOptions,
    #                     column_overrides?: dict[str, ColumnOverride],
    #                     excluded_columns?: list[str] }] }
    # ParseOptions = { range?: str, skip_rows?: int, has_header?: bool }
    # ColumnOverride = { dtype: str, format?: str }  # `format` only meaningful for date/datetime
    # excluded_columns: names the user unchecked in the Metadata step;
    # backend drops them from the committed Parquet (SELECT * EXCEPT excluded_columns).
    # Empty / omitted = include all. At least one column must remain
    # after exclusion or the commit fails with 422.
    # parse_options on the commit must match what was last applied via /parse —
    # the backend reads the parsed.<sheetkey>.parquet that reflects those options;
    # mismatch is a 409 (the user changed options without re-parsing).
    # ATOMIC — all items succeed together or none do.
    # 1. Validate workspace; 404 otherwise.
    # 2. For each item:
    #    - Validate temp_id; ensure parsed.<sheetkey>.parquet exists; 409 otherwise.
    #    - Validate name (1-80 chars, unique within batch); 422 otherwise.
    #    - If column_overrides set: cast_columns() re-writes the Parquet
    #      with the override dtypes. Implausible casts raise CastError → 422
    #      with row-pointing message; the whole batch aborts.
    # 3. Open a single DB transaction.
    # 4. For each item: dataset_id = secrets.token_hex(8); move
    #    data/uploads_tmp/<temp_id>/{original.ext, parsed.<sheetkey>.parquet} →
    #    data/datasets/<workspace_id>/<dataset_id>/{original.ext, parsed.parquet};
    #    insert Dataset row; write source.json.
    # 5. Commit the transaction. Delete the temp directory once all items
    #    are committed (or roll back filesystem moves on failure — best-effort,
    #    the TTL sweep is the safety net).
    # 6. Return the list of created Datasets.
```

**HTTP semantics**:

- `POST /uploads` → `201` with `UploadInit` on success;
  `422` on parse failure (CSV only — Excel doesn't parse here);
  `413 / 415` on validation.
- `POST /uploads/<temp_id>/parse` → `200` with `UploadParse`
  (per-sheet status list); `404` if temp missing. Individual
  sheet parse failures are carried in the response body, not a
  4xx — the wizard surfaces them as per-tab `✗` markers.
- `POST /workspaces/<id>/datasets/batch` → `201` with
  `list[Dataset]` on success; `404` if workspace missing; `409`
  if any temp's parsed Parquet is missing; `422` on validation
  failure (name, cast). The whole batch is atomic — partial
  commits never happen.

**CORS**: already configured by R13 for `http://localhost:3000`.

---

## Dataset model implications

The Dataset model gains two fields (see
[datasets.md](datasets.md) for the full schema):

```ts
type Dataset = {
  // …existing fields…
  sourceFormat: 'csv' | 'excel';
  sheetName?: string; // present iff sourceFormat === 'excel'
};
```

These let the Datasets table surface a small source-format icon
prefix (`📊` for Excel, `📄` for CSV) next to the dataset name,
and a future "Re-upload from source" affordance has the metadata
it needs.

---

## TanStack Query patterns

```ts
function useUploadInitMutation() {
  return useMutation({
    mutationFn: ({ source, file }: { source: 'csv' | 'excel'; file: File }) => uploadsApi.init(source, file),
  });
}

function useUploadParseMutation() {
  return useMutation({
    mutationFn: ({ tempId, sheet }: { tempId: string; sheet: string }) => uploadsApi.parseSheet(tempId, sheet),
  });
}

type ParseOptions = { range?: string; skip_rows?: number; has_header?: boolean };
type ColumnOverride = { dtype: Dtype; format?: string };

function useDatasetsCommitMutation(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      items: {
        temp_id: string;
        sheet?: string;
        name: string;
        parse_options?: ParseOptions;
        column_overrides?: Record<string, ColumnOverride>;
        excluded_columns?: string[];
      }[];
    }) => uploadsApi.commitBatch(workspaceId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['datasets'] }),
  });
}
```

- CSV path: `useUploadInitMutation` (Step 1) → Metadata → Preview
  → Confirm. No sheet parse.
- Excel path: `useUploadInitMutation` (Step 1, returns sheet list)
  → `useUploadParseMutation` (Step 2 → Step 3, called with the
  array of selected sheets, returns per-sheet parse results).
- Both paths use `useDatasetsCommitMutation` for the atomic batch
  commit. CSV sends `items: [{ temp_id, name, column_overrides }]`
  (length 1); Excel sends `items: [{ temp_id, sheet, name,
column_overrides }, …]` (length N = selected-sheets count).

---

## Workspace-persistence dependency

Unchanged from earlier R14 framings: R15's first impl round must
swap R13's in-memory workspace store to real persistence because
Datasets reference `workspace_id` via a foreign key.

---

## Read/write boundary (R15+ scope)

**R15+ implements**:

- `/data-management/datasets/new` route with the dynamic wizard
  (3 steps for CSV, 4 for Excel).
- Data-source selector at Step 1 (Excel default, CSV alternate).
- Sheet selection step for Excel.
- `UploadStepper`, all four step components, three mutation
  hooks, the uploads client.
- `POST /uploads`, `POST /uploads/<temp_id>/parse`,
  `POST /workspaces/<id>/datasets/batch` backend routes.
- File storage layout (`uploads_tmp/` and `datasets/`) with the
  parsed-Parquet companions keyed by sheet name.
- `parse_csv()` + `parse_excel()` ingestion helpers.
- Pytest coverage for all three endpoints (success + parse-
  failure + validation paths, both source types).
- 24h temp-upload sweep — R15 shipped the one-shot bootstrap;
  R30 replaced it with a lifespan-spawned periodic loop
  (`app.jobs.tmp_sweep`).

**Deferred**:

- **Adjust parse options (extended)** — R15 ships table range
  (Excel), skip-rows (CSV), and has-header toggle (auto-gen
  names when off). Delimiter, encoding, and header-row offset
  beyond the first row remain R∞ until a real user is blocked.
- **Column rename** in the Metadata step. R∞ per HIxAI Q16 —
  dtype override only. Rename triggers when a user is blocked by
  an ugly auto-extracted column name.
- **Append / update an existing Dataset** — R16+ named pull
  (HIxAI Q14e). Real CRM workflow: upload February's sales export
  into the existing `monthly_sales` Dataset rather than creating
  a 12th sibling. **R15 ships create-only**; the commit endpoint's
  shape is **forward-compatible** for this — a future round adds
  `target_dataset_id?: string` to each batch item (mutually
  exclusive with `name`), and the backend handles schema-match
  validation, conflict resolution, and append vs upsert semantics.
  Concretely deferred to R16+ because R15's scope is already
  heavy — persistence, Excel parser, 5-step wizard, multi-sheet,
  dtype/format overrides, parse options, and column selection —
  and append-mode is a feature in its own right, not a polish
  pass. Pulled by: user reference + CRM-export reality.
- **Draft persistence** (resume wizard after reload). R∞.
- **Browser back/forward** inside the wizard. R∞.
- **Optimistic dataset row** during commit. R15+ Plan decides.
- **Background parsing** (queue + worker). R∞.
- **Chunked / resumable upload**. R∞.
- **Additional source types** (API, Website, SQL, …). R∞ — the
  wizard's IA is forward-compatible; each new source adds a
  selector option + its own step variants.

---

## Acceptance criteria (Design gate exit)

Testable criteria the R15–R17 chain satisfies (extended R19/R21/R30/R32),
each mapping to at least one automated test across F / B / I. Numbered
`C1`–`C11`; they describe the **shipped** wizard behaviour.

**User journey** — as a user I bring a CSV or Excel file into the
product through a guided wizard, review and adjust the parsed schema,
preview the rows, and commit one or more datasets.

1. **Source step** _(FE component)_ — Step 1 offers an Excel (default)
   and a CSV card, a required workspace picker (pre-filled from
   `?workspace=<id>`), and a required file drop-zone whose accept-types
   adapt to the source; `[Next]` is enabled only when all three are set
   and triggers `POST /uploads`.
2. **Stepper branching** _(FE)_ — the stepper renders 3 steps for CSV
   and 4 for Excel; Excel inserts a Sheet step before Metadata.
3. **Sheet step (Excel)** _(FE + BE)_ — sheets are listed with light
   metadata (name / row / column counts) from `POST /uploads`;
   multi-select checkboxes require ≥1; `[Next]` triggers
   `POST /uploads/{temp_id}/parse` for each selected sheet.
4. **Metadata step** _(FE)_ — a per-column Include checkbox (all checked
   by default; ≥1 must remain), a read-only column name, and a dtype
   override dropdown; a format-string input appears **only** for
   `date` / `datetime`; `[Reset all to detected]` clears the active
   tab's overrides; Excel shows per-sheet tabs that preserve overrides
   per sheet.
5. **Parse options** _(FE + BE)_ — Excel exposes range + has-header and
   CSV exposes skip-rows + has-header in the Metadata disclosure;
   editing them and clicking `[Re-parse]` re-parses and **resets** that
   sheet's dtype overrides + exclusions with an inline warning
   (R19 Q2 / Q4). CSV has no re-parse — its options apply at commit
   (R19 Q1) and the BE honours them observably (R20).
6. **Preview step** _(FE + BE)_ — shows each column's name + dtype and
   10 sample rows read from `preview.<sheetkey>.json`; Excel renders
   per-sheet tabs.
7. **Preview failure** _(FE)_ — a parse failure surfaces inline: CSV is
   total (`[Re-pick file]` → Step 1); Excel is per-sheet (a `✗` tab
   marker + `[Deselect this sheet]`). `[Next]` is disabled while any
   selected sheet has failed.
8. **Confirm + atomic commit** _(FE + BE)_ — one editable dataset-name
   row per selected sheet (exactly one for CSV); duplicate names within
   the batch are flagged inline; `[Create datasets]` POSTs
   `/workspaces/{id}/datasets/batch` atomically (all-or-nothing) and on
   success navigates to the Datasets list with the new rows. _Flag:
   the Confirm step copy validates names as "1–80 chars"; this is
   narrower than [crud-hygiene.md](../_shared/crud-hygiene.md)'s `NAME_LENGTHS`
   `DATASET_MAX = 120` used by the rename path. Recorded as a cross-doc
   length inconsistency, not rewritten here — a parity-check candidate
   for R66._
9. **Commit validation** _(pytest)_ — an implausible dtype cast (e.g.
   `"abc"` → integer) raises a `422` with a row-pointing message and the
   wizard stays on Confirm with an inline `<Alert>`; a commit whose
   `parse_options` differ from the last `/parse` returns `409`.
10. **File guards** _(pytest)_ — a 100 MB size cap with `413` / `415`
    on size / mime violation; temp uploads are swept on a 24 h TTL by
    the R30 periodic sweep (`app.jobs.tmp_sweep`), disabled in tests.
11. **i18n (R32)** _(FE)_ — all five step components and the page shell
    are keyed under `upload.*` namespaces; en + vi resources resolve.

---

## Scope boundary

This concept covers:

- The full-page upload **wizard** at `/data-management/datasets/new` —
  the verb that turns a file into one or more Datasets: the data-source
  selector (Excel + CSV), workspace + file selection, Excel multi-sheet
  selection, the Metadata step (dtype overrides, column include/exclude,
  date/datetime format string), the parse-options disclosure, the
  Preview step (success + per-sheet / total failure), and the Confirm
  step's atomic batch commit — plus the three backend endpoints and the
  temp / committed file-storage layout.

This concept defers:

- All of the "Deferred" bullets in § Read/write boundary above (extended
  parse options, column rename, append / update an existing dataset,
  draft persistence, in-wizard browser back/forward, optimistic dataset
  rows, background parsing, chunked upload, and additional source types).

This concept explicitly does NOT cover:

- The Dataset **noun** and its table list (lives in
  [datasets.md](datasets.md)).
- The per-dataset inspector page (lives in
  [dataset-detail.md](dataset-detail.md)).
- Rename / delete of an already-committed dataset (lives in
  [crud-hygiene.md](../_shared/crud-hygiene.md)).
- The Workspace container an upload targets (lives in
  [workspaces.md](../workspaces/workspaces.md)).

---

## Lifecycle

This doc:

- **Amended in place** during R15+ if implementation surfaces a
  decision not pre-baked here.
- **Superseded** by `upload-v2.md` if a third+ source type
  arrives that doesn't fit the current wizard pattern (unlikely
  — the selector + branching steps generalize cleanly).
- **Folded back** into [datasets.md](datasets.md) if the verb
  shrinks (unlikely with multi-source).

---

## Open questions answered in R14

| Q                                      | Decision                                                                          | Source                                       |
| -------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| File storage backend                   | Filesystem + raw source + Parquet companion at `data/datasets/<ws>/<ds>/`         | R14 HIxAI Q1 (lean accepted)                 |
| Parse-time                             | Server-side; light metadata in `POST /uploads`, sheet parse on demand             | R14 HIxAI Q2 (refined)                       |
| Dataset data model                     | Includes sourceFormat + optional sheetName; see datasets.md                       | R14 HIxAI Q3 + Q15                           |
| Server-side vs client-side parse       | Server-side via DuckDB (CSV) and openpyxl/pandas → Parquet (Excel)                | R14 HIxAI Q8 (refined)                       |
| Upload as sub-menu peer to Workspaces? | No — Datasets is the noun; upload is a verb against datasets                      | R14 HIxAI Q9 (user-directed)                 |
| Card grid or table list?               | Table list with sortable columns and workspace filter                             | R14 HIxAI Q10 (user-directed)                |
| Workspace detail route?                | No detail route — workspace cards link to `/datasets?workspace=<id>`              | R14 HIxAI Q11 (user-directed)                |
| Keep `status` field on Dataset?        | No — wizard validates pre-commit, every persisted Dataset is ready                | R14 HIxAI Q12 (lean accepted)                |
| Upload UI surface                      | Full-page wizard at `/data-management/datasets/new`                               | R14 HIxAI Q13 (user-directed)                |
| Wizard step count                      | Branching: 4 for CSV, 5 for Excel (Sheet + Metadata steps inserted)               | R14 HIxAI Q13a (refined twice)               |
| Wizard column-dtype override?          | **Yes** — dedicated Metadata step with per-column dtype dropdown                  | R14 HIxAI Q14 (reversed; user-directed)      |
| Format string for date / datetime?     | **Yes** — text input under the dtype dropdown when dtype is date/datetime         | R14 HIxAI Q14a (user-directed)               |
| Table range / skip-rows override?      | **Yes** — Excel range + CSV skip-rows in a Parse-options disclosure on Metadata   | R14 HIxAI Q14b (drifted pull, user-directed) |
| Auto-generate headers when no header?  | **Yes** — has-header toggle; auto-gen names `column1, column2, …` when off        | R14 HIxAI Q14c (drifted pull, user-directed) |
| Column-selection (Include checkboxes)? | **Yes** — Include column on Metadata table; all-checked default; uncheck to drop  | R14 HIxAI Q14d (user-directed)               |
| Append / update existing Dataset?      | **Deferred to R16+** — R15 ships create-only; commit endpoint is forward-compat   | R14 HIxAI Q14e (user-directed defer)         |
| Column rename in Metadata step?        | No — dtype override only; column rename is R∞                                     | R14 HIxAI Q16 (lean accepted)                |
| Primary data source?                   | Excel (CRM-export dominant); CSV as secondary                                     | R14 HIxAI Q15 (user-directed)                |
| Multi-sheet selection per wizard run?  | **Yes** — checkboxes in Sheet step; one Dataset per selected sheet; atomic commit | R14 HIxAI Q17 (user-directed)                |
| Multi-sheet UX for Metadata + Preview? | Tabs within step (one per selected sheet); overrides preserved per tab            | R14 HIxAI Q17a (lean accepted)               |
| Multi-sheet ships in which round?      | R15 — multi-sheet from day one                                                    | R14 HIxAI Q17b (lean accepted)               |
| Future source types?                   | None pre-baked in R14; wizard IA generalizes for R∞ additions                     | R14 HIxAI Q15 (user-directed)                |

## Open questions answered in R19 (parse-options chain D-step)

| Q                                             | Decision                                                                                                                                                                                                                                                                                                                                                                                              | Source                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| CSV re-parse endpoint?                        | **No CSV re-parse**. CSV parse-options collected on Metadata, applied at commit time; preview shows sniffer's parse. `/parse` stays Excel-only                                                                                                                                                                                                                                                        | R19 HIxAI Q1 (user-directed against the lean)                                                                    |
| Override-reset on re-parse?                   | Reconfirm R14: reset all column overrides + excluded-columns for the re-parsed sheet on a successful re-parse                                                                                                                                                                                                                                                                                         | R19 HIxAI Q2 (lean accepted)                                                                                     |
| Preview-failed action buttons scope?          | All three (`Re-pick file`, `Deselect this sheet`, `Adjust parse options`) ship in the F-step of this chain                                                                                                                                                                                                                                                                                            | R19 HIxAI Q3 (lean accepted; closes R18's W2 defer)                                                              |
| CSV parse-options edit vs existing overrides? | Reset overrides + excluded-columns for that file when CSV parse-options change; mirror Excel's behavior with an inline warning before the edit                                                                                                                                                                                                                                                        | R19 HIxAI Q4 (lean accepted; symmetric with Q2)                                                                  |
| Chain shape for the parse-options feature?    | **D + B + F** (corrected mid-R19-Review). C is genuinely collapsed (R15's `ParseOptions` schema already covers all three fields). B is a real round: `parse_csv()` ignores all options, and the CSV branch of the commit handler at `routers/datasets.py:170` calls it with no `parse_options`. Q1=C's promise that "CSV options apply at commit" is not actually implemented today. R20 = B; R21 = F | R19 finding (methodology evidence; user-probed correction caught shape-vs-behavior conformance drift R16 missed) |

> **Methodology notes for `context/contract-driven-feature.md`
> evaluation** (two findings from R19 — both deferred to R∞
> until R21 (F) closes and two instances exist):
>
> 1. **D-step can output "no C needed" findings.** R19 confirmed
>    the contract surface is complete (`ParseOptions` already
>    covers `range`, `skip_rows`, `has_header`). The "Single-
>    layer changes — no contract surface, no chain" clause
>    already covered this case in principle; R19 is the first
>    deliberate output of that finding.
> 2. **Shape-conformance is not behavior-conformance.** R19
>    initially claimed the chain compressed to D+F because
>    R16's BE accepts `parse_options` on CSV commits. User
>    probing forced a re-check: the BE **silently ignores** the
>    field — `parse_csv()` accepts no options. R16's conformance
>    tests verified response shape against the YAML but didn't
>    assert that accepted request fields produced an observable
>    effect. The methodology refinement candidate: every request
>    field whose contract semantics imply behavior change must
>    have at least one BE test asserting the change is
>    observable in the response. R16's gap is the worked anti-
>    example; the [BE round conformance memo](../../../memory/2026-05-24-be-round-conformance-pattern.md)
>    deserves this rule as an amendment.

## R18 design reflection — Metadata-vs-Preview ordering (still open)

R17 silently folded Preview into Metadata as a scroll-down. R18
caught the divergence during user verification and restored the
designed order (Metadata → Preview, separate steps). **But** the
accidental combined view surfaced a real reframe candidate the user
raised in the R18 Q&A:

> "The current implement gave me an idea: I should _see/preview_ data
> before I can decide the dtype?"

In other words: maybe the right order is **Preview → Metadata**, not
Metadata → Preview. The argument:

- For a CRM export the user often does not know the shape coming in.
- Inferred dtypes shown on the Metadata column-table are a guess; a
  user who has not seen the rows yet has to trust them.
- "Look at the data, then decide what to fix" is a more natural
  mental model than "configure the data, then check what you did."

**Decision (R18)**: ship A (Metadata → Preview) per the original
design. Do **not** flip to B on a hunch. The lean is to use A on the
next real CRM export and decide afterwards whether the friction
shows up. If it does, R∞ flips the order (cheap — one `stepsByFormat`
edit plus the design doc).

**Trigger to flip**: one real instance of "I changed a dtype, then
saw the preview, then went Back and re-changed it because the
preview surprised me." That signal is the pull. Until then, A is
the order.

---

## R32 stamp — i18n keying for the upload wizard

All 5 wizard step components (`UploadSourceStep`,
`UploadSheetStep`, `UploadMetadataStep`, `UploadPreviewStep`,
`UploadConfirmStep`) plus the `DatasetNewPage` shell have their
user-facing strings keyed under `upload.*` namespaces in
[`src/i18n/locales/{en,vi}.json`](../../../../workspace/apps/builder/src/i18n/locales/).
Sub-namespaces match the step names (`upload.source.*`,
`upload.sheet.*`, etc.) so a translator can work one step at a
time. Inline markup (`<code>A1:C20</code>`, the `<strong>`-wrapped
file name in the confirm footer) uses
`<Trans components={{ code: <code />, strong: <strong /> }}>`.
Pluralization uses i18next's `_one`/`_other` suffix convention
(e.g. `upload.sheet.fileSummary_one`/`_other`).
