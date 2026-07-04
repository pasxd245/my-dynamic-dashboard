# Upload — feature design (verb, full-page wizard, multi-source)

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
**Status**: Accepted.
**Sibling docs**:
[datasets.md](datasets.md) (the noun this wizard creates),
[workspaces.md](../workspaces/workspaces.md) (the container an upload targets),
[workspace-shell.target.md](../../_platform/workspace-shell.target.md) (the chrome
the wizard renders inside).

---

## Why a page, not a modal — and why a multi-source wizard

Two rationales shape this design:

1. **Page, not modal.** A modal can't carry a useful data
   preview — and previewing the parsed schema + first ten rows is
   the gate that justifies multi-step ingestion in an analytics
   product. The wizard gives the preview step the full content
   area, lets Cancel be a clean exit, and is the in-flow failure-
   handling surface (so the Datasets table never carries
   transient or failed rows).
2. **Multi-source, Excel primary.** Excel is the primary data
   source (CRM exports are predominantly `.xlsx`; CSV is the
   export-of-export fallback). The wizard's IA accommodates this:
   a data-source selector at Step 1 sets the downstream step path.
   CSV stays a 4-step flow; Excel becomes a 5-step flow with a
   Sheet selection inserted before Metadata. Future sources (API,
   Website, SQL, …) plug in as additional selector options with
   their own step variants; today the wizard commits only Excel +
   CSV.

The wizard's stepper renders dynamically — it shows 4 steps for
CSV, 5 for Excel. Users see only the steps relevant to their
chosen source.

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                | Layer                                                | Reusability  | Purity             | Allowed peer deps                                |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------ | ------------------ | ------------------------------------------------ |
| `DatasetNewPage` route component (owns the inline AntD `<Steps>` stepper + reducer state) | `apps/builder/src/features/data-management/datasets` | feature      | feature            | react, react-router-dom, antd, @ant-design/icons |
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
| `parse_csv()` ingestion helper (`ingest/csv_parser.py`) | `apps/backend/app/ingest/`                          | backend      | pure (data)        | duckdb                                           |
| `parse_sheet()` + `enumerate_sheets()` (`ingest/excel_parser.py`) | `apps/backend/app/ingest/`                | backend      | pure (data)        | openpyxl / duckdb excel ext                      |
| `write_csv_to_parquet()` + `write_excel_to_parquet()` (`ingest/parquet_writer.py`) | `apps/backend/app/ingest/`     | backend      | pure (data)        | duckdb                                           |
| `UploadDraft` type (frontend in-memory)                | `apps/builder/src/features/data-management/datasets` | feature      | data type          | none                                             |

**Boundary check**: no wizard surface lives in `@mdd/ui`. The
stepper is an inline AntD `<Steps>` inside `DatasetNewPage`, not a
standalone component; all step components and ingestion helpers
live in their respective feature folders; the wizard's
state-machine wiring (`upload/state.ts`) stays co-located with the
step components.

The CSV and Excel ingest paths are intentionally parallel — one
parser entry point per source type (`parse_csv` /
`parse_sheet` + `enumerate_sheets`) feeding one parquet writer per
source (`write_csv_to_parquet` / `write_excel_to_parquet`). A
future source adds a new parser + writer pair following the same
shape.

---

## Layout — ASCII intent

The wizard renders inside the master-layout chrome with the
sidebar's "Datasets" sub-item active. PageHeader carries the
breadcrumb, title, and Cancel affordance; PageCard wraps the
stepper, step content, and nav buttons. The stepper renders
**dynamically** — 4 steps for CSV, 5 for Excel.

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
  a single `POST /uploads/<temp_id>/parse` carrying one item per
  selected sheet; the backend parses each sheet from the stored
  `original.<ext>` and returns the per-sheet schema + sample rows
  in the response body. Nothing is persisted to disk at parse
  time — parses are re-read from the original on demand.
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
date · datetime`. **R143+R144 semantics** (see
  [§Commit dtype semantics](#commit-dtype-semantics-r143)): every
  override is **applied for real** at the commit's parquet write —
  `string`/`integer`/`float`/`boolean` since R143, `date`/`datetime`
  since R144 (parsed via the translated `format`). *(Pre-R143
  shipped behavior — all overrides relabel-only, parquet keeps
  parser-inferred dtypes — was the R142-F2 defect: metadata could
  contradict stored data.)* A `date` / `datetime` override
  **requires** a `format` (422 otherwise).
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
  tab's preview rows come from the `POST /uploads/<temp_id>/parse`
  response held in client state. Switching tabs is cheap; no
  re-parse needed since dtype overrides only relabel at commit.
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
- Each row's name input is editable; validation is **1–120 chars**
  (the `_BatchItem.name` bound, matching the rename path's
  `NAME_LENGTHS["dataset_max"]`). Duplicate names within this
  batch surface as inline validation errors.
- **Overrides column** summarizes how many columns the user
  overrode on each sheet in the Metadata step (`none` /
  `N columns`). Helps spot accidental misclicks.
- `[Create datasets]` triggers
  `POST /workspaces/<id>/datasets/batch` with the full payload —
  `temp_id` is a **single top-level field** (the whole batch comes
  from one upload), and each item carries its own sheet / name /
  options / overrides / exclusions:

  ```ts
  {
    temp_id,
    items: [
      { sheet?, name, parse_options?, column_overrides?, excluded_columns? },
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

## File storage

Each committed dataset is stored as the **raw source file** plus a
**Parquet companion** of the parsed table, on the backend
filesystem (`app/storage.py`):

```text
workspace/apps/backend/data/datasets/
└── <workspace_id>/
    └── <dataset_id>/
        ├── original.<csv|xlsx>           # verbatim bytes
        ├── parsed.parquet                # DuckDB-written, schema-enforced
        └── source.json                   # { temp_id, sourceFormat, sheet, originalName }
```

**Temp upload storage** (during the wizard, before commit) holds
**only the raw bytes plus light metadata** — there are no
per-sheet parsed/preview files; each parse is re-read from
`original.<ext>` on demand and returned in the response:

```text
workspace/apps/backend/data/uploads_tmp/
└── <temp_id>/
    ├── original.<csv|xlsx>
    └── meta.json                         # { sourceFormat, sheets?: [{sheet,rowCount,columnCount,usedRange?}] }
```

**Commit (`POST /workspaces/<id>/datasets/batch`)**: the backend
**re-parses each item from `original.<ext>` at commit time**
(applying that item's `parse_options`), `shutil.copy2`s the
original into the dataset directory, **writes a fresh
`parsed.parquet`** via the parquet writer, writes `source.json`,
and inserts the Dataset row. It does **not** delete the temp
directory — the TTL sweep is the sole reaper.

**TTL on temp uploads**: 24 hours, swept by a lifespan-spawned
asyncio task (`app.jobs.tmp_sweep.sweep_loop`) that re-runs on the
configured interval. Disabled in tests via
`MDD_BACKEND__TMP_SWEEP__ENABLED=false`. Configured under
`backend.tmp_sweep.{enabled, interval_seconds, ttl_seconds}` in
`workspace/config/values.yaml`.

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

## Commit dtype semantics (R143)

> **Status: SIGNED OFF (human, 2026-07-03) — R143 D-gate.** Restores the ORIGINAL intent of
> this doc's §Backend endpoint shape ("`cast_columns()` re-writes the Parquet with the override
> dtypes; implausible casts raise CastError → 422") and acceptance criterion **C9** — which the
> shipped implementation never honored: `_apply_overrides` relabels `columns_json` only, the
> writers receive only `kept_columns`, and an uncastable mixed-type column dies as an unhandled
> `ArrowInvalid` **500**, not a 422 (R142 findings **F1+F2**, verified on real files:
> `.agents/plan/brainstorms/2026-07-03-r142-dogfood-findings.md`).

### Invariant (the round's exit condition)

For every dtype in the **coerced set**, a committed dataset's `parsed.parquet` physical dtype
**equals** its `columns_json` dtype. Metadata never lies about storage.

### Coercion scope — decision Q1

- **Coerced set (this round): `string · integer · float · boolean`** — the formatless dtypes.
  The verified F1/F2 need is `→string` (leading-zero phones in mixed-type columns); the other
  three ride the same one-seam cast machinery at zero marginal design cost.
- **`date` / `datetime`: joined the coerced set in R144** — see
  [§ Date and datetime coercion (R144)](#date-and-datetime-coercion-r144) for the
  format-token subset, the date-vs-datetime split, and the rejection behavior. _(R143 had
  left them relabel-only because the wizard's `format` field speaks
  Java-`DateTimeFormatter` tokens, which neither pandas nor DuckDB `strptime` accept
  natively; R144's token translation closes that gap.)_

### Where coercion runs

At commit, inside the parquet writers (`write_csv_to_parquet` / `write_excel_to_parquet`):
signatures gain the item's dtype targets for kept columns, and the cast happens on the
table before the parquet write (one shared cell lexicon, `_coerce_dataframe`, for both
source paths; columns whose physical type already conforms skip without a scan — CSV's
no-override commits keep the pure-DuckDB COPY path). Parse/preview steps are untouched —
coercion is a commit-time contract, exactly where the F2 defect lives.

**Build deviation from the signed-off draft (flagged, R141-style):** targets are **every
kept column's committed formatless dtype** (parser-inferred or overridden), not
overrides-only. Discovered at B: the parser infers `string` for a MIXED-type column, so an
overrides-only cast would leave the no-override commit of such a column dying as the same
`ArrowInvalid` 500 (F1 alive) with `columns_json` still lying (F2 alive). The invariant
above is only real if the committed dtype is enforced wherever it came from. Intent
(user-set overrides applied; no new inference) unchanged — the committed metadata drives;
nothing guesses beyond the parser's existing inference.

### Date and datetime coercion (R144)

> **Status: SIGNED OFF (human, 2026-07-03) — R144 D-gate.** Week convention accepted as
> ISO-8601 Monday-start (the product's convention). Extends the R143 machinery so
> `date` / `datetime` overrides are applied for real at the parquet write; closes the
> deliberate R143 defer (the Java-token translation decision). Pulled by R142-F11 (②):
> THE weekly report needs `Ngày gọi` (`dd-MM-yyyy HH:mm:ss`) as a real datetime, not a
> 5,015-group timestamp string.

**Semantics.** A `date` / `datetime` override joins the coerced set: at the commit's
parquet write, a string cell is **parsed** via the override's translated `format`, and the
committed column lands as a physical **DATE / TIMESTAMP**. The invariant above extends:
for `date` / `datetime` too, `parsed.parquet`'s physical dtype equals the `columns_json`
dtype. The wire shape is unchanged — `ColumnOverride.format` already exists and is
already required for these dtypes (422 otherwise); only what it MEANS at commit changes
(relabel → real parse). The contract description note updates at C.

**Format-token subset (scope brake).** Exactly six Java-style tokens plus non-alphabetic
literal separators. The subset constrains the **format vocabulary**, not cell padding —
translation goes through pandas `strptime`, whose `%d`/`%m`/`%H` are **lenient on
padding** (a cell `3-7-2026` parses under `dd-MM-yyyy`; verified live). Deliberate: real
exports mix padding, and leniency here never mis-reads a value — the separators still
disambiguate. _(Grounded on the real FM1 file: 5,047/5,047 non-null `Ngày gọi` cells
match padded `dd-MM-yyyy HH:mm:ss`.)_

| Java token | pandas `strptime` | Meaning        |
| ---------- | ----------------- | -------------- |
| `yyyy`     | `%Y`              | 4-digit year   |
| `MM`       | `%m`              | 2-digit month  |
| `dd`       | `%d`              | 2-digit day    |
| `HH`       | `%H`              | 2-digit hour   |
| `mm`       | `%M`              | 2-digit minute |
| `ss`       | `%S`              | 2-digit second |

This covers the real FM1 family (`dd-MM-yyyy HH:mm:ss` and its separator variants). Any
other **alphabetic run** in the format (`d`, `M`, `EEE`, `a`, timezone tokens, …) →
**422 at commit validation, before any write** — `format_unsupported`, the same
dict-detail family as the existing "format required" 422. Loud reject, never a silent
relabel. _Trigger to widen: a real file whose format needs a token outside the subset._

**date vs datetime targets.**

- A **`date`** target's format must carry **date tokens only** (`yyyy`/`MM`/`dd`); a time
  token in a `date` format → `format_unsupported`. Day-level truncation of a timestamp is
  the **bucket step's** job ([queries.md § Transform steps](../queries/queries.md#transform-steps-workflows-r120r141)),
  not ingest's — ingest never silently discards a time part.
- A **`datetime`** target's format may use any subset tokens; absent time tokens parse as
  midnight (standard `strptime` default — honest, not lossy).

**Cell semantics** (same lexicon rules as the R143 casters):

- NULL cells pass through as NULL.
- A cell that is already a **native** date/datetime (pandas parses real Excel date cells
  natively) passes through; under a `date` target a native cell with a **non-midnight
  time part fails** (the user should pick `datetime` — never silent truncation).
- A **string** cell parses via the translated format, **whole-cell strict** (full-match;
  trailing garbage fails).
- Any failing non-NULL cell → the same `CoercionError` → `coercion_failed` 422 envelope
  (`dtype: "date" | "datetime"`, first 5 cells, 1-indexed data rows); the whole batch
  aborts. The Confirm step's R143 alert renders it unchanged — verify-only at F.
- Conformance fast-paths extend: a column already physically datetime64 conforms to
  `datetime` without a scan; `_DUCK_CONFORMS` gains `DATE → date`, `TIMESTAMP → datetime`
  (CSV columns DuckDB already inferred as temporal skip the pandas detour).

**Timezone: out of scope.** Naive datetimes only — the CRM exports carry no offsets;
timezone tokens are outside the subset (rejected loudly like any other).

**Acceptance (R144, maps to Check).**

1. Real FM1 `Ngày gọi` (`dd-MM-yyyy HH:mm:ss` + `datetime` override) → parquet TIMESTAMP
   == `columns_json` `datetime`.
2. An unparseable date cell → 422 `coercion_failed` naming sheet · column · cells; zero
   datasets created.
3. An unsupported format token → 422 `format_unsupported` at validation, before any
   write.
4. The R143 invariant regression extends to `date` / `datetime` commits.

### Failure semantics — the typed 422 (replaces the F1 500)

- A cell **fails** when its non-NULL value cannot cast to the target dtype (`TRY_CAST` → NULL
  on non-NULL input, or the pandas equivalent). NULL cells pass through as NULL. `→string`
  never fails by construction.
- Any failing cell → the item fails → the **whole batch aborts** (existing staged/rollback
  atomicity unchanged — no half-commit; matches "ATOMIC — all items succeed together").
- Response: **422** with structured detail, same dict-detail family as this router's existing
  422s:

  ```json
  {
    "code": "coercion_failed",
    "sheet": "Worksheet",
    "column": "Số gọi",
    "dtype": "integer",
    "cells": [{ "row": 2103, "value": "0387353189" }],
    "totalFailed": 17
  }
  ```

  `cells` carries the **first 5** offending cells; `row` is the 1-indexed **source-file
  row** — header and skipped/range rows INCLUDED, so it is the row number the user sees in
  Excel / a CSV editor and can jump straight to. _(R144 correction from real dogfood: the
  original data-row convention — header excluded — pointed the user one row off when
  locating the cell to fix; the FE copy reads "file row N".)_
- FE: the Confirm step's existing inline `<Alert>` renders the typed payload (column + sample
  cells + count) instead of today's generic "Failed to fetch" — display only, no new
  interaction. i18n under `upload.confirm.coercionFailed.*` (en + vi).

### Boundaries (named)

- **Forward-only.** Already-committed datasets keep their stored dtypes (FM1's int64 phones
  stay wrong until re-upload); systematic repair belongs to the ⑥ refresh theme.
- **No new wizard UI.** The Metadata step's override dropdown is unchanged; only what the
  override MEANS at commit changes (relabel → real cast for the coerced set).
- **No inference.** Nothing guesses dtypes beyond the parser's existing inference; the write
  enforces the COMMITTED dtypes (parser-inferred or user-overridden — see the flagged build
  deviation above), it never invents new ones.

### Acceptance (maps to Check)

1. Real FM2.25 + `int→string` overrides on `Số gọi`/`Số nhận` → commits; parquet holds
   leading-zero strings (F1 unblocked, F2 invariant).
2. An uncastable override (e.g. `"abc"` → `integer`) → 422 `coercion_failed` naming sheet ·
   column · cells; zero datasets created (C9 finally true).
3. Regression: parquet dtype == `columns_json` dtype for every commit with coerced-set
   overrides.

---

## Refresh: re-upload into an existing Dataset (R145)

_⑥ refresh theme, slice 1 — F9 (settings carry-forward) + F10 (schema-drift gate)._

> **Status: SIGNED OFF (human, 2026-07-04) — R145 D-gate.** Drift-severity = warn-loud-never-block
> and the header-skip rider deferral are the human's domain calls; carry-forward home
> (`commitSettings` on `source.json`, no migration) is the agent build-home call, accepted.
> Graduates the R14-deferred
> "Append / update an existing Dataset" bullet (§Read/write boundary) from `R∞` to shipped,
> in its first slice. Pulled by [Round_144](../../../plan/cycles/Round_144.md) Feeds-into +
> the signed-off ⑥ ranking in
> [2026-07-03-r142-dogfood-findings](../../../plan/brainstorms/2026-07-03-r142-dogfood-findings.md)
> (rank 3, month-2 blocker) + R144 Act learning #4 — the F9 pain was **lived, not predicted**
> (the human re-uploaded the FM family four times in one session, re-choosing sheet, dtype
> overrides, and format each time).

### Concept

A **Refresh** brings a *new export of the same source* into an **existing** Dataset instead
of creating a sibling. The real CRM cadence: every month a fresh call-log / lead export
lands, and it should update `monthly_calls` in place — not spawn a 12th near-duplicate row.

R145 ships **whole-table replace** semantics: the new file's parsed table **replaces** the
dataset's contents (original + parquet + `columns_json` + counts), forward-only (no version
history). This is the lived case — the FM exports are **cumulative** (FM2.25 carried 6,692
rows that supersede the earlier 5,047-row commit), so replace is correct and sufficient.

> **Not this round (revert seam → R147):** row **merge-on-key / precedence** (F5+F6) for
> *overlapping, non-cumulative* re-exports (identity key + precedence are domain decisions).
> Replace can't dedup overlapping partial exports; that wall pulled
> [§ Refresh merge mode](#refresh-merge-mode-merge-on-key-and-precedence-r147).

### Entry point — a mode of the wizard, not a new surface

Per the noun-vs-mode discipline
([specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md)): **reuse the
upload wizard in a refresh mode**, do not build a parallel "refresh page." Refresh is the
same verb (file → parsed table) against a *known target*.

- **Affordance**: a **Refresh** action on the Dataset row (Actions column, beside
  rename/delete) and on the dataset-detail header. See
  [datasets.md § Refresh affordance](datasets.md#refresh-affordance-r145).
- **Route**: `/data-management/datasets/:id/refresh` — the **same `DatasetNewPage`
  component** in refresh mode (a `targetDatasetId` prop / route param), NOT a duplicated
  page. The wizard's create-mode state machine
  ([§ Wizard state machine](#wizard-state-machine)) is **reused unchanged**; refresh only
  (a) **seeds** the reducer with a carry-forward preset, (b) fixes the workspace + target
  (Source step's workspace picker is read-only, pre-set to the dataset's workspace), and
  (c) has `commit` populate `target_dataset_id`.
- **Sheet step in refresh is SINGLE-select** (R147, human finding): a refresh maps one new
  table into one dataset (the wire's one-item invariant), so selecting a sheet REPLACES the
  selection (radio semantics; Select all/Clear hidden; advance requires exactly one).
  The committed sheet is a **default, not a lock** — monthly exports rename sheets
  (date-stamped names), so: pre-select only when the committed name exists in the new
  workbook (no ghost selection); when absent, the note flips to "pick the sheet to update
  from" (warning); and the carry-forward preset applies to whichever single sheet is parsed
  (fallback past its committed-name key), so a rename never silently drops carry-forward.

> **Strict on the skeleton (round risk):** the refresh preset must **not** fork the reducer
> into two half-duplicated flows. Known hazard — `PARSE_SHEET_SUCCESS` and
> `SET_PARSE_OPTIONS` currently **wipe** `columnOverrides` / `excludedColumns` on any
> re-parse ([upload/state.ts](../../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts)).
> A refresh seeds those from carry-forward; the first parse must **replay the preset**, not
> discard it. The build must preserve the preset across the initial parse (the design decision:
> carry-forward is applied *after* the seeding parse, keyed by column name — columns that
> still exist keep their override; columns that vanished drop theirs silently, columns that
> appeared start at their inferred dtype).

### F9 — settings carry-forward (where the state comes from)

**Problem**: committed datasets are **lossy** — `source.json` holds only
`{temp_id, sourceFormat, sheet, originalName}` and `columns_json` holds only `{name, dtype}`
per column. **Parse options** (`range` / `skip_rows` / `has_header`), the **date/datetime
`format`** string, the **exclusion** list, and pre-override dtypes are all *discarded* after
commit (they survive only as their effect on the parquet). So the two things the R144 human
re-typed most — **dtype/format overrides and parse options** — cannot be re-derived from
what's stored.

**Decision — persist a commit-settings snapshot (no migration).** At **every** commit
(create *and* refresh), extend the per-dataset `source.json` with a `commitSettings` block
capturing exactly what a future refresh needs to pre-fill:

```jsonc
// data/datasets/<ws>/<ds>/source.json  (R145 extends)
{
  "temp_id": "…", "sourceFormat": "excel", "sheet": "Worksheet",
  "originalName": "FM2.25.xlsx",
  "commitSettings": {                       // ← new (R145)
    "parseOptions": { "range": "A1:M6693", "has_header": true },
    "columnOverrides": {                    // keyed by column name; format preserved
      "Số gọi": { "dtype": "string" },
      "Ngày gọi": { "dtype": "datetime", "format": "dd-MM-yyyy HH:mm:ss" }
    },
    "excludedColumns": ["Ghi chú nội bộ"]
  }
}
```

- **Why `source.json`, not a DB column**: `source.json` is already written per-dataset at
  commit; extending it needs **zero Alembic migration** and mirrors the existing sidecar
  pattern — the least mechanism that works (per the `config-value-home-heuristic` lesson:
  single-consumer state, no cross-language contract, no query need → local home). The wire
  `Dataset` shape is **unchanged** — `commitSettings` is server-only refresh fuel, never sent
  to the list/detail views.
- **How the wizard reads it**: a dedicated **`GET /datasets/{id}/refresh-settings`** returns
  the stored `commitSettings` (`{ sheet?, parseOptions, columnOverrides, excludedColumns }`)
  or `null` for a legacy dataset (→ the lossy fallback below). Kept off the hot `detail-get`
  path (no shape change / per-read file cost there); the refresh wizard calls it once to seed
  the carry-forward preset. Empty `commitSettings` for legacy datasets is an honest `null`,
  not a fabricated snapshot.
- **Carry-forward scope** (pre-filled into the refresh wizard): **sheet** (source.json) ·
  **parse options** · **dtype overrides + formats** · **exclusions** (all from
  `commitSettings`). The user re-picks only the **file**; everything else arrives pre-set and
  editable.
- **Legacy datasets** (committed before R145, no `commitSettings`): **lossy-pre-fill
  fallback** — pre-fill `sheet` + each column's **final committed dtype** as an override
  (formats unavailable → the user re-enters date/datetime formats). Surfaced honestly with an
  inline note ("some settings couldn't be restored from an older upload"). The snapshot is
  written on that dataset's *next* refresh, so the gap self-heals forward.

### F10: schema-drift gate (surface loudly, never silently absorb)

Before the replace commits, the incoming file's parsed columns are compared against the
target's committed `columns_json`, and drift is surfaced in the wizard. purpose.md #5 —
version, flag, **adapt**: don't reject normal business drift, don't hide it either.

**Drift kinds** (per column, by name):

| Kind | Meaning | Severity (human decision, R145 D) |
| ---- | ------- | --------------------------------- |
| **Added** | in new file, not in committed schema | **warn** — informational (no dependent can reference it yet) |
| **Removed** | in committed schema, absent from new file | **warn + blast-radius** (see below) |
| **Dtype-changed** | same name, the carried-forward override no longer fits the new data | **warn** — the coercion path (below) is the hard net |
| **Renamed** | indistinguishable from removed+added without a heuristic | surfaced as **both** a removal and an addition (no rename inference in slice 1) |

**Severity policy — warn-loud, never block (human decision, R145 D-gate):** all drift is
surfaced in a dedicated **Drift review** step the user must explicitly acknowledge, then the
refresh **proceeds**. Nothing about column drift *blocks* the commit. Rationale: the runtime
`query_stale` / `relationship_stale` machinery already re-computes dependent-artifact validity
**on read** (it is never stored —
[relationships.py `_compute_status`](../../../../workspace/apps/backend/app/routers/relationships.py),
[query_engine.py](../../../../workspace/apps/backend/app/query_engine.py)); a refresh that
drops/changes a column auto-flips its dependents to stale on their next open. The drift gate's
job is to **preview that blast radius before the user commits**, not to duplicate or replace
the runtime net.

**Blast-radius preview** — **split to slice 1b (deferred, R145 Plan decision, 2026-07-04).**
The ideal is: for **removed** / **dtype-changed** columns, the Drift review step names the
dependent **queries** and **relationships** that reference those columns ("refreshing will
break the *Weekly Call Report* query"). That needs a BE read resolving a dataset's dependents
**by referenced column** — a per-column reference-extraction engine over query
definitions/predicates/joins. Per the fat-seam below, **R145 (slice 1a) does not build it.**
The Drift review step instead states plainly that the runtime staleness net re-checks
dependents on next open (see below); the named blast-radius preview lands in **slice 1b**.

> **Round fat-seam (revert seam) — TAKEN at Plan.** The blast-radius dependents lookup was the
> round's flagged fat point. Plan decision: **split**. Slice **1a** (R145) ships the drift
> *columns* surfaced (added / removed / dtype-changed) with the acknowledge gate; the
> *dependents* preview is slice **1b**. Safe because the runtime `query_stale` /
> `relationship_stale` machinery (recomputed on read) still catches broken dependents the next
> time they're opened — nothing goes silently wrong; 1a only lacks the *pre-commit* warning.
> _Trigger for 1b: dogfood shows refresh-then-discover-broken-query is too costly without the
> pre-commit preview._

### Refresh semantics — atomic replace, existing dataset intact on failure

The commit endpoint's `target_dataset_id` (already declared, currently **422-reserved** at
[datasets.py:210-214](../../../../workspace/apps/backend/app/routers/datasets.py)) graduates
to **real** and, when set on an item, is **mutually exclusive with `name`** (the target keeps
its name). In refresh mode the commit path **UPDATEs in place** — same `ds_id` — rather than
minting a new id:

- Re-parse the new file (applying the item's parse options + overrides, same machinery as
  create), producing the new parquet + `columns_json` + counts + the fresh `commitSettings`.
- **Stage** the new `original.<ext>` + `parsed.parquet` under temp names in the dataset dir,
  then **atomically swap** them over the old files and **UPDATE** the DB row
  (`columns_json`, `row_count`, `column_count`, `size_bytes`; `created_at` unchanged, no
  `updated_at` field in slice 1) inside one transaction; write the new `source.json` last.
  Forward-only — the previous parquet is **replaced**, not archived.
- **Failure leaves the existing dataset fully intact** (R145 Check): a coercion failure or FS
  error rolls back the staged files and aborts the UPDATE — the old `original` / `parsed` /
  `columns_json` are untouched. This extends the R143/R144 staged/rollback discipline
  ([datasets.py](../../../../workspace/apps/backend/app/routers/datasets.py) lines 280-389)
  from create-INSERT to refresh-UPDATE.

**Coercion on refresh** reuses the existing typed **`coercion_failed` 422** unchanged (a
carried-forward override that the new data can't satisfy → 422 naming sheet · column · cells;
zero mutation to the dataset). No new blocking envelope is introduced — **drift is
informational (FE acknowledge)**, and only coercion (existing) can abort.

### Wire shape (refresh)

The commit request gains no new *item* field — `target_dataset_id` already exists; refresh
just stops 422-ing it. A refresh batch carries **exactly one item** (a Dataset maps to one
source table), targeting one dataset:

```ts
// refresh: target_dataset_id set, name omitted (mutually exclusive)
{ temp_id, items: [{ target_dataset_id, sheet?, parse_options?, column_overrides?, excluded_columns? }] }
```

- 201 → the updated `Dataset` (same `id`). 404 if the target dataset is missing. 422
  `coercion_failed` (unchanged) on an uncoercible cell — dataset untouched. `name` +
  `target_dataset_id` both set → 422 (mutually exclusive).
- **Drift report** is served by the preview read (`GET /datasets/:id/dependents` +
  client-side column diff, or a dedicated drift-preview response), **not** the commit — the
  wizard shows it *before* Confirm. Shape: `{ added: string[], removed: [{name, dependents}],
  dtypeChanged: [{name, from, to, dependents}] }`.

### Boundaries (named)

- **Replace only** — merge-on-key / precedence (F5+F6) is
  [§ Refresh merge mode (R147)](#refresh-merge-mode-merge-on-key-and-precedence-r147).
- **Forward-only** — no version history / rollback-to-previous-parquet in slice 1.
- **One dataset per refresh** — a refresh batch is length 1 (multi-dataset refresh has no
  lived pull; the create path stays multi-item for Excel multi-sheet).
- **Header-skip rider deferred (R144 finding #3)** — a "skip rows that exactly repeat the
  header" parse option (the real FM append-seam) is **not** this round; it defers to the
  parse-options / UI-batch round with its trigger named (a real file whose append seam
  repeats the header mid-table). Human decision, R145 D-gate.
- **No rename inference** — a renamed column reads as removed + added.

### Acceptance (R145, maps to Check)

1. **Carry-forward**: refreshing a dataset committed with overrides + a datetime format
   pre-fills the wizard with the committed sheet · parse options · dtype overrides + formats ·
   exclusions (== what was committed); the user re-picks only the file.
2. **Real FM pair**: refresh the 5,047-row dataset with the 6,692-row FM2.25 export →
   settings pre-filled, one commit, whole-table replace; the dependent weekly-report query
   returns the wider range.
3. **Drift surfaced**: added / removed / dtype-changed columns each appear in the Drift review
   step; removed / dtype-changed name their dependent queries + relationships (blast-radius);
   the user acknowledges and the refresh proceeds (never blocked).
4. **Atomicity**: a refresh whose new data fails coercion → 422 `coercion_failed`, and the
   existing dataset (original + parquet + columns_json) is **fully intact**.
5. **Legacy fallback**: refreshing a pre-R145 dataset (no `commitSettings`) pre-fills
   sheet + final dtypes, notes the un-restorable settings, and writes a fresh snapshot on
   commit.

---

## Refresh merge mode: merge-on-key and precedence (R147)

_⑥ refresh theme, slice 2 — F5 (merge needs a key + precedence; UNION cannot fake it) +
F6 (the identity key is a domain decision)._

> **Status: SIGNED OFF (human, 2026-07-04) — R147 D-gate.** Domain decisions **D1–D5 all
> resolved to the tabled recommendations** ("recs are fine"): D1 = ≥1 committed columns,
> remembered in `commitSettings.mergeKey` · D2 = incoming dup-key rows → loud typed 422 ·
> D3 = incoming-wins · D4 = per-refresh choice, last-used default · D5 = incoming schema wins.
> The key-dtype exception to warn-never-block (blocks merge, not refresh) is part of the
> sign-off. Pulled by
> [Round_147](../../../plan/cycles/Round_147.md) ←
> [2026-07-03-r142-dogfood-findings](../../../plan/brainstorms/2026-07-03-r142-dogfood-findings.md)
> (rank 3, ⑥ month-2 blocker; F5 upgraded to correctness risk) + the R145 revert seam above.

### Concept: the case replace cannot serve

R145's refresh **replaces** the whole table — correct when each export supersedes the last
(the cumulative FM files). The second real export shape is **overlapping and non-cumulative**:
the two CRM lead snapshots share **6,960 phone values**, and under every counting policy
roughly **half changed** their call-status between snapshots. Set arithmetic cannot reconcile
that — `UNION ALL` double-lists, `UNION DISTINCT` keeps both (the rows differ). Replace loses
whatever the new partial export doesn't carry. What's needed is **record reconciliation**:
**keep one row per declared identity key, newest snapshot wins, and keep committed rows the
incoming export doesn't mention**. That last clause is the whole difference from replace.

### Build home: a refresh-commit mode, not a workflow step (argued)

Two candidate homes, per the noun-vs-mode discipline — the rejected one named:

- **Chosen: a second refresh semantics** (`replace | merge`) inside the existing refresh
  commit. The merge happens **once, at ingest**, and materializes into the dataset's parquet;
  the dataset stays the single source of truth every dependent reads, unchanged.
- **Rejected: a workflow step** ("keep latest per key"). It is *expressible* — one DuckDB
  window/anti-join step, and the workflows doctrine
  ([queries-to-workflows brainstorm](../../../plan/brainstorms/2026-07-01-queries-to-workflows-module.md);
  "query gains steps", DuckDB-first) rightly biases shaping toward steps. But a step-home dedup is **opt-in per consumer**: the
  dataset itself would stay double-rowed (it would also need a new *append* refresh semantics
  to even hold both snapshots), and every query/widget that forgets the step is **silently
  wrong by default** — exactly the F5 correctness failure. F5 is not presentation shaping;
  it is correctness of the *source*. Month-2 correctness must hold by construction.
  _(A "latest per key" step for presentation-level dedup remains open to a future pull —
  orthogonal, not precluded.)_

The wizard skeleton is untouched (strict on the skeleton): merge adds **no new step**. The
**Confirm step** in refresh mode gains a *refresh semantics* block — `replace | merge` choice;
choosing merge reveals the **key picker** (select from the committed columns).
_Build deviation (flagged, per `design-altitude-vs-build-home`): the draft placed merge-aware
severity on the Drift review step, but the key is only DECLARED on Confirm (which follows
Drift) — so the FE guard lives on Confirm (`mergeKeyIssues`: picker error state + blocking
alert + disabled commit); the Drift step is unchanged. The backend enforces the same guards
independently (the contract net), so the intent — key drift never silently merges — holds._

### Merge semantics: keep-latest-per-key

Inputs: the committed parquet (current rows) + the incoming staged table — the incoming side
already coerced to the committed dtype contract by the R143/R145 machinery, *before* any swap.

| Key present in… | Result |
| --------------- | ------ |
| both | **incoming row wins** (whole row — no cell-level merge) |
| incoming only | inserted |
| committed only | **kept** (the clause replace lacks) |

- **Precedence = snapshot recency**: the incoming file wins, period (❓ D3). No precedence
  column, no per-cell reconciliation in slice 1.
- One DuckDB statement over the two tables (anti-join committed-minus-incoming ∪ incoming),
  writing a fresh parquet via the same staged/atomic-swap path as replace — failure at any
  point leaves the existing dataset fully intact (the R145 invariant extends).
- **Merge report**: the commit response carries `{ updated, inserted, kept }` counts; the
  Confirm step shows them post-commit (toast/result), and the FE cannot precompute them
  (it never holds the full committed table).

### F6: the identity key (domain decisions)

The mechanism above is generic; **what a row IS is not inferable** — phone is not unique even
within one file (the source's own `TRÙNG` column counts 1..8+ occurrences per phone; 16,375
in-file duplicate-phone rows). These are the human's calls:

| ❓ | Decision | Options | Recommendation |
| --- | -------- | ------- | -------------- |
| **D1** | Key shape + persistence | (a) one or more committed columns, picked in the wizard, remembered per dataset in `commitSettings.mergeKey`; (b) single column only | **(a)** — composite keys are the *expected* real case ("lead = phone + creation-date"); a multi-select costs no extra skeleton. Remembered key pre-fills next month |
| **D2** | Incoming file has duplicate rows per key | (a) **loud stop** — typed 422 naming the key, dup count, sample keys (evidence the declared key is wrong); (b) last-in-file wins, count surfaced; (c) keep all dup-key rows | **(a)** — file row order is not time, so "last" is fiction; a dup-key incoming file means the key doesn't mean what the user thinks. The 422 teaches the fix (pick a fuller key or clean the export) |
| **D3** | Precedence rule | (a) incoming-wins (snapshot recency); (b) precedence column (e.g. max timestamp) | **(a)** for slice 1; (b) defers with trigger: a real pair where the older snapshot holds the newer truth |
| **D4** | Mode selection | (a) per-refresh choice, defaulting to the last-used mode (remembered in `commitSettings`); (b) fixed per-dataset setting | **(a)** — the same dataset can plausibly get a cumulative export one month and a partial the next; the choice stays visible at every refresh |
| **D5** | Result schema under column drift | (a) incoming schema wins (kept rows NULL-fill added columns, lose removed ones — consistent with replace; drift review already warns); (b) union of both schemas, NULL-filled | **(a)** — the incoming export defines the current shape; (b) accretes ghost columns forever |

Duplicates already inside the **committed** table (e.g. from a pre-merge replace commit) merge
per the same rule — all committed rows whose key matches an incoming key are superseded by the
one incoming row; committed dup-keys *not* touched by the incoming file are kept as-is
(cleaning history is not this slice's job). _Build deviation (flagged): the draft surfaced
untouched committed dups as their own count; the build folds them into `kept` — a fourth
count earned no wire field before a lived pull._

### F5×F2: the key-dtype guard (the one loud stop in the drift gate)

A silently drifted **key** dtype = the same phone failing to match its own prior row =
**false non-overlap** — dedup silently misses, the exact F5 corruption. General drift stays
**warn-never-block** (R145 human decision, unchanged); the **key columns are the exception**,
because a corrupt merge is a different severity class than a stale dependent:

- Key column **removed** from the incoming file, or its **dtype changed** → the Drift review
  step **blocks merge** (not refresh: the user may switch to replace, fix the override, or
  pick a different key).
- Backend enforces the same independently: a merge whose key column is missing or
  dtype-mismatched at commit → typed 422 (dataset untouched) — the FE gate is UX, the BE
  check is the contract.

### Wire shape (merge)

The refresh item gains one optional field — presence selects the mode:

```ts
// merge refresh: target_dataset_id + merge_key; absence of merge_key = replace (R145, unchanged)
{ temp_id, items: [{ target_dataset_id, merge_key?: string[], sheet?, parse_options?, column_overrides?, excluded_columns? }] }
```

- `merge_key` names committed columns (≥1). Unknown column → 422. Key column missing/
  dtype-drifted in the incoming parse → 422 (the F5×F2 guard). Incoming dup-key rows → per
  ❓ D2 (recommended: typed 422 naming key + count + sample).
- 201 → the updated `Dataset` (same `id`) **plus merge counts** `{ updated, inserted, kept }`
  (response-shape addition — lands at C with the contract update).
- `commitSettings` extends with `merge_key` + `refresh_mode` (remembered defaults; F9 pattern —
  snake_case like the rest of the snapshot, which mirrors a commit item's shape). A later
  REPLACE refresh flips `refresh_mode` but **carries the declared key forward** (the key is
  per-dataset memory, not per-run).
- `merge_key` on a **create** item (no `target_dataset_id`) → 422 (meaningless).

### Boundaries (named, R147)

- **Whole-row wins** — no cell-level merge / per-column precedence.
- **Incoming-wins only** — precedence columns defer with the ❓ D3 trigger.
- **No rename inference** (unchanged from R145) — a renamed key column reads as
  removed → blocks merge.
- **No AI-propose-key** — the F6 "agent proposes, human verifies meaning" moment is a natural
  #2 AI-loop slice, and #2 is additive, never load-bearing: the manual pick ships and lives
  first. Trigger: the manual key pick proves repetitive/error-prone in dogfood.
- **Forward-only** — no unmerge / version history (unchanged).
- **Committed-side dup cleanup** is out of scope (surfaced as a count, not repaired).

### Acceptance (R147, maps to Check)

1. **Real CRM pair**: merge the two lead snapshots on the declared key → one row per key,
   incoming status wins on the ~3.4k changed keys, committed-only rows kept, counts surfaced.
2. **Absence semantics**: a key in the committed table but not in the incoming file survives
   the merge (the difference from replace, proven by test).
3. **Loud key guard**: key-column dtype drift or removal blocks merge in the Drift review AND
   422s at the backend; the dataset is untouched.
4. **Dup-key policy** (per ❓ D2): the real dup-heavy file behaves per the signed-off rule,
   loudly.
5. **Replace unregressed**: an R145-style replace refresh (no `merge_key`) is byte-for-byte
   the old behavior.
6. **Carry-forward**: the declared key + mode are remembered; next month's refresh pre-fills
   both.

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
- **Append / update an existing Dataset** — **R145 ships the first slice (Refresh, replace
  semantics)** — see [§ Refresh](#refresh-re-upload-into-an-existing-dataset-r145).
  R15 shipped create-only with the commit endpoint's shape **forward-compatible**
  (`target_dataset_id?` per item, mutually exclusive with `name`); R145 graduates that field
  from 422-reserved to real for whole-table replace + settings carry-forward + a schema-drift
  gate. **Row merge-on-key / precedence** (overlapping non-cumulative re-exports) remains
  deferred to R146. Pulled by: user reference + CRM-export reality + the R142 dogfood ⑥
  ranking.
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
| Append / update existing Dataset?      | R15 create-only (forward-compat); **R145 ships Refresh (replace); R147 = merge**  | R14 Q14e defer → R145 D (§ Refresh)          |
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
