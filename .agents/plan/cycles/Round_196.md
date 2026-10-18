# Round 196: data versions on the read paths and in exports (item 3.2c)

**Status**: Review — built and reviewed (code review, BA, QA + visual gate: no open P0/P1); awaiting the human acceptance walk (W1–W5) and sign-off
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

**Shipped** — every read says which data it read.

- `dataVersions: {<datasetId>: n}` on `/rows`, `/aggregate`, `/totals` and the preview: the versions
  of exactly the datasets the read touched (a join: both sides).
- The query export carries them: a **Data versions** block on the Filters sheet (dataset | id |
  version) and the `X-MDD-Data-Versions` header on both formats.
- `POST /datasets/{id}/export`: every row of a dataset or a saved copy (visible columns), with its
  version; a copy's Filters sheet says what it froze and that it is not the current numbers. The
  dataset page's Actions menu offers **Export all rows (.xlsx / .csv)**, also on a copy.

**Studied** — a file outlives its HTTP headers. The version had to go into the file itself (sheet
block, file name), and every text cell had to stay text: a dataset name or label starting with `=`
opened as a live formula in Excel until QA caught it on the Filters sheet. Also: the "too many rows" message of the R182 widget export never showed: the builder's
error guard did not know `export_too_large`, so the card fell back to "Could not export". Fixed at
the guard; one test pins it.

## Goal

**Inherits from ← [Round_195](Round_195.md)** — parameters reach the builder; the reads already
report which parameter values they used (`resolvedParams`).

Close the other half of "what did I see": which data. A number on screen or in a file must name the
dataset versions behind it, so a manager can tell whether two numbers came from the same rows.
Also export a saved copy (carried over from R193).

_Track: 1 (product). Pulled by: release program item 3.2c ([rc3.md § 3.2](../programs/release-rc2-rc5/rc3.md))
and the R193 carry-over "exporting a copy lands with 3.2c" — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**:

- `dataVersions` on the four read responses and the preview, taken from the plan the read ran
  (single dataset or the join's dataset ids).
- Export: the block and the header; CORS exposes the header.
- `POST /datasets/{id}/export` (`exportDataset`): visible columns, 422 `export_too_large`, 404.
- Builder: types, the two menu items, EN/VI.

**Out**:

- `updatedAt` on query, dashboard and workflow. 3.8 anchors on `definitionHash` + `dataVersions`,
  and 4.4 (definition history) needs a history table, not a single timestamp. Skipped and logged,
  as rc3.md allows.
- A "Data version" line on the query view — the response carries it; no screen asked for it yet.
- `dataHash`, an integer `definitionVersion` (not planned, rc3.md).

**Acceptance**: each read path reports the versions of exactly the datasets it read (join
included); the export sheet and header carry them; a dataset and a copy export with their version.

## Risks / unknowns

- **A join over one dataset twice** — the map has one key per dataset; correct by construction.
- **Export of a big dataset** — the same `EXPORT_MAX_ROWS` cap as query export; counted first.

## Do

- 2026-10-18 — D: none new.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                         |
| ------------------------------------ | ------ | ----------------------------------------------------- |
| 1. >3 independent states/branches    | no     | one map on the response; two menu items               |
| 2. New interaction pattern           | no     | the export items reuse the R182 widget export pattern |
| 3. High user-error risk              | no     | read-only additions                                   |
| 4. Contract depends on unresolved UI | no     | the response shape is fixed by rc3.md                 |
| 5. UX confidence below threshold     | no     | menu items only                                       |

Result: **Flow: DCFBI** — no condition fired.

- C: `_shared/query.yaml` `DataVersions`; the field on rows-get, aggregate, totals, preview; export
  header and block; `datasets/export-post.contract.yaml` + `.md`.
- B: `_data_versions(plan)`, `_stamped(...)` in `routers/queries.py`; `build_xlsx(data_versions=)`,
  `file_stem`, `attachment_disposition` in `ingest/export.py`; `export_dataset` in
  `routers/datasets.py`; `tests/test_data_versions.py` (4) + existing tests updated.
- F: `datasetsApi.exportFile`, `datasets/exportDataset.ts`, the Actions items (normal and copy),
  `export_too_large` in the `ApiError` guard, EN/VI; `tests/data-versions-r196.test.tsx` (4).

### F, the reviews and the fixes

- Build (`30f9ca2`): contracts, backend, builder, tests as above.
- **Reviews after build:**
  - code review **PASS** — P2: version read before or after the rows (refresh window); XLSX
    formula text (pre-existing since R182); test gaps (cap, steps); column change mid-export.
  - BA **PASS** — P2: CSV carries the version only in a header; frozen-copy wording false when the
    original was not refreshed, and no link to the original; "save a query" advice impossible on a
    copy; VI terms ("tập dữ liệu", "truy vấn"); version read order; filters on screen vs all rows.
- **Fold 1 (`14d0530`)** — `_v<n>` in the dataset export's file name; copy meta reads "frozen; the
  live dataset may have been refreshed since" with `original_id` and `original_data_version_now`
  (`deleted` when gone); a copy's too-large message without the query advice; VI terms; `=` text
  kept as text on the data sheet; tests for the cap and the guard.
- QA **CHANGES** — P1: the guard missed the Filters sheet (dataset name, label, parameter value
  → live formula). P2: `__` in file names; duplicate `dataset` key in column A.
- **Fix (`f75a535`)** — `_keep_text` over every sheet before save; runs of `_` collapse; the block
  header reads `dataset name`. QA re-check **PASS** (no `<f>` in any workbook part, 4 API checks).
- **Not folded, by judgement:** the version/rows race needs the bump moved into the refresh swap
  (or a shared read-consistent helper) — R197 owns it, since 3.8 anchors on this value; reading the
  version twice does not close it (a read between swap and bump sees the old version both times).

## Check

- [x] backend 656 · builder 529 (3 upload-wizard timeouts under load; the file passes alone, 15/15)
      · contracts 49 green; `tsc --noEmit`; `ruff check`; lints 0
- [x] Visual gate: light (EN + VI), normal dataset and saved copy; dark N/A (no dark theme — owner)
- [x] BA · code review · QA — no open P0/P1
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 5`. Setup: a workspace
      with `walk_deals.csv` (**deals**) and `walk_accounts.csv` (**accounts**), a relationship on
      the account id, a joined query **Deals × accounts**.
  - ⬜ W1 — Refresh **accounts** once. Export **Deals × accounts** (XLSX): the Filters sheet has a
    Data versions block — deals v1, accounts v2.
  - ⬜ W2 — On **deals**, hide one column, then Actions › **Export all rows (.csv)**: the file is
    `deals_v1.csv`, without the hidden column.
  - ⬜ W3 — Save a frozen copy of **deals**, refresh **deals**, export the copy (XLSX): the Filters
    sheet says "frozen; the live dataset may have been refreshed since", `original_data_version_now`
    2, and the rows are the frozen ones.
  - ⬜ W4 — Rename **deals** to `=SUM(1,2)` and export it (XLSX): Excel shows the text `=SUM(1,2)`,
    not 3. Rename it back.
  - ⬜ W5 — VI: the Actions menu reads "Xuất toàn bộ dòng (.xlsx)" / "(.csv)".

## Act

- **Rolling log:** closed — Filters sheet without a data version; `updated_at` (skipped, reason
  logged). New P2 rows: version/rows race (→ R197); shared `_data_versions` helper (→ R197); CSV
  formula prefixes; query export file name without a version; on-screen version on the query view;
  all-rows vs filters on screen; ASCII fallback `__`; upload-wizard test timeouts under load.
- **Promotion:** none. Candidate lesson (memory, if it recurs): an export is read long after the
  request — anything only in a response header is lost once the file is saved.
- **Prune check:** QA's live-backend probe found the one P1 that both read-only reviews missed;
  the loop keeps earning its place.

## Feeds into → Round_197

Item 3.8 — the metadata triple anchor (definition hash + data versions + parameter values) and the
cascade delete (migration `0010`).
