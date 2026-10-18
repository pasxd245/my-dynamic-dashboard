# Round 196: data versions on the read paths and in exports (item 3.2c)

**Status**: Do — built; reviews pending
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

**Studied** — the "too many rows" message of the R182 widget export never showed: the builder's
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

_(pending)_

## Check

_(pending)_

## Act

_(pending)_

## Feeds into → Round_197

Item 3.8 — the metadata triple anchor (definition hash + data versions + parameter values) and the
cascade delete (migration `0010`).
