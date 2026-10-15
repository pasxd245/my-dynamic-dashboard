# Round 178: dataset date coverage — `Column.coverage`

**Status**: Review — C, B, F and the visual gate done; awaiting the human acceptance walk (W1–W3) and sign-off
**Flow**: DCFBI — one read-only profile field, contract-first, verified on a generic fixture in a real browser.
**Date started**: 2026-10-15
**Date completed**: —

## ⟢ At a glance

**Shipped** — every `date` / `datetime` column of a dataset carries `coverage` `{min, max, blankShare}`,
profiled by the server over the committed parquet at commit and at every refresh (replace / merge /
append), persisted in `columns_json`, served on the shared `Column` (list, detail, batch-post). The
dataset page shows a **Date coverage** strip under the metadata and a line per column in the
Properties drawer. Backend 492 · builder 405 · contracts 40, all green; visual gate on a 60-row
generic fixture with blanks, plus a pre-R178 dataset (no strip).

**Studied** _(predicted → saw → now believe)_ — **predicted** that a profile key inside
`columns_json` would ride for free. **Saw** that every consumer which reuses dataset columns as
the columns of something else — a query's `resolvedColumns`, an upload-parse preview, the MSW
mocks — must strip it, or a `forbid` schema rejects it (the backend's `_to_resolved` already
projected name/dtype; the mocks did not). **Now believe (high confidence)** that per-column
profile data belongs on the dataset noun only, and that "schema of a column" vs "profile of a
column's rows" is a distinction the mocks now encode (`schemaOf`).

**Watch** — datasets committed before this round show no strip until their next refresh (no
backfill job; by design, profiling is tied to a write). `blankShare` is rounded to 6 places.
`Dataset.profiledAt` was not added (it would need a DB column and migration); the product-wide
"when was this last written" gap is rc.3's metadata anchor, not this round's.

## Goal

**Inherits from ← [Round_177](Round_177.md)** — second rc.2 round, "trust" rather than
"presentation": a reader of a dashboard built on a refreshed export cannot tell what period the
dataset covers, or how many rows have no date at all, without opening the rows.

Profile every temporal column at every write and show the result where the dataset is described.

_Track: 1 (product). Pulled by: the rc.2 roadmap's R-b (external feedback item F4 — "which period
does this dataset cover?"), and purpose.md's key design decision #5 (version, flag, adapt: a dataset
that does not cover the period you think it does should say so, not fail silently) — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: a fixture with known dates gives exact min / max / blank share on commit; a
refresh that adds rows changes the numbers; non-temporal columns carry nothing; nothing else
(queries, dashboards) changes shape.
**Falsified if**: the profile has to be computed on read (too slow, or wrong after a refresh), or a
consumer of `Column` breaks on the new key.

- [x] **D** — a profile key on the shared `Column`, not a detail-only expansion (one contract, one
      model, one serializer rule like `hidden`). Server-written, never client-set.
- [x] **C** — `_shared/column.yaml`: `Column.coverage` → `ColumnCoverage {min?, max?, blankShare}`;
      `datasets/detail-get.contract.yaml` example carries it.
- [x] **B** — `app/models/common.py`: `ColumnCoverage` + `Column.coverage` (omitted when absent);
      `app/ingest/profile.py`: `profile_date_coverage(parquet, cols)` — one DuckDB query per
      dataset (`min`, `max`, NULL count per temporal column + row count); called in
      `routers/datasets.py` after the create-path `_write_parquet` and in `_handle_refresh` after
      merge / append, before the swap. `tests/test_datasets_date_coverage.py` +4; two existing
      tests relaxed from exact-dict to name/dtype projection.
- [x] **F** — `types.ts` (`ColumnCoverage`); `DateCoverage.tsx` (`formatCoverage`,
      `DateCoverageStrip`); strip under `MetadataStrip` on `DatasetDetailPage`; a secondary line per
      column in `PropertiesDrawer`; EN/VI i18n; `MOCK_DATASET` carries coverage matching
      `MOCK_ROWS`; `schemaOf` in the mocks strips it wherever dataset columns become other columns;
      `tests/dataset-coverage.test.tsx` +3.
- [x] **I / visual gate** — stack on the cloud runner; a 60-row generic `tickets.csv` (one date, one
      datetime with a third blank); the strip and the drawer lines; a dataset committed before this
      round shows no strip.

## Risks / unknowns

- **Extra keys in `columns_json` reach every reader.** Checked: `query_engine` projects
  name/dtype into `ResolvedColumn`; `relationships`, `filters`, `rows_reader` read name/dtype
  only; `set_column_visibility` keeps unknown keys (so a PATCH does not drop coverage). The mocks
  were the one leak, fixed with `schemaOf`.
- **A dtype override on refresh**: `profile_date_coverage` drops `coverage` from columns that are
  no longer temporal, so a column that changes dtype does not keep a stale profile.
- **Timezone**: `datetime` values are stored naive and reported as `YYYY-MM-DDTHH:MM:SS`; the page
  shows them without seconds. No conversion anywhere.

## Do

- 2026-10-15 — C + B: contract, model, `profile.py`, two call sites, 4 tests. Full backend run
  surfaced 10 exact-dict assertions on temporal columns in `test_datasets_batch.py` /
  `test_date_bucket.py`; relaxed to a name/dtype projection (the assertions were about dtype, not
  about the column having no other keys). Backend 492, contracts 40.
- 2026-10-15 — F: types, strip, drawer line, i18n, fixture coverage. Full builder run surfaced
  26 `ContractDriftError`s in `queries.test.tsx`: the MSW `previewQuery` / chain mocks reused
  `MOCK_DATASET.columns` as `resolvedColumns`, and `ResolvedColumn` forbids `coverage`. Added
  `schemaOf` and applied it at the five sites. Builder 405, type-check clean.
- 2026-10-15 — visual gate: strip reads `opened_on 2026-01-02 → 2026-08-25 · closed_at 2026-08-03
03:49 → 2026-09-27 15:38 · 33% blank` (matches the API: `blankShare` 0.333333); the drawer shows
  the same two lines under the column names; the pre-R178 `orders` dataset has `coverage` absent on
  its date column and renders no strip. Nothing written under `workspace/apps/backend/data/`.

## Check

- [x] backend 492 · builder 405 · contracts 40 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser, screenshots kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — the strip sits directly under the
      numbers a reader already looks at; Usability — nothing to operate, read-only; Accessibility —
      plain text, no colour-only meaning; Credibility — the numbers come from the same parquet the
      rows come from; Utility — answers "which period" without opening the rows; Desirability — one
      line per column, no chart.
- [x] ⟢ At a glance **Studied** line written
- [ ] **Acceptance walk** (human reviewer) — ⬜ verdicts, `coverage: 0 of 3`:
  - ⬜ W1 — upload a CSV with a date column that has a few blank cells. The dataset page shows the
    column's range and the blank share; the drawer repeats it under the column.
  - ⬜ W2 — refresh the dataset with a file that adds later dates. The `max` moves; the blank share
    changes accordingly.
  - ⬜ W3 — open a dataset uploaded before this round. No strip; everything else unchanged.

## Act

_(at close)_

## Feeds into → Round_179 (TBD)

R179 — the `note` widget (third rc.2 round): a widget kind with markdown text and no `queryId`,
sanitised on both sides. It inherits nothing from this round; R180 (metadata) will reuse R179's
markdown sanitiser.
