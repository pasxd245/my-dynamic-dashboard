# Round 143: Commit honors dtype overrides — typed coercion errors (F1+F2)

**Status**: Planning
**Date started**: 2026-07-03
**Date completed**:
**Flow**: TBD at D-gate exit via flow-selector (R47 2-of-5).

## Goal

**Inherits from ← [Round_142](Round_142.md) "Feeds into" (signed off 2026-07-03)** — fix the
two verified ingest-dtype defects from the dogfood probe, as ONE thin round:

- **F1 (blocker):** a mixed-type Excel column crashes batch commit with an opaque 500
  (`ArrowInvalid` from `df.to_parquet`) — FM2.25's phone column blocked the whole month-2 file.
- **F2 (silent corruption):** wizard `column_overrides` update metadata only and never reach the
  parquet write — FM1's `Số gọi` says `string` in `columns_json` but stores `int64` in parquet;
  leading zeros silently destroyed. The override the user set to prevent F1 is ignored.

After this round: the commit path **applies** `column_overrides` when writing parquet, and a
coercion that cannot succeed returns a **typed 422 naming the column and offending cells**
instead of a 500. Stored dtypes match committed metadata — the invariant every later round
(② date-typed ingest, ⑥ merge-on-key per F5×F2) stands on.

_Track: 1. Pulled by ← the R142 findings doc
([2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md), human
sign-off 2026-07-03): "R143 = F1+F2 — smallest verified blocker; prerequisite to both ② and ⑥."
D-gate first per the d-gate-artifact-in-design-corpus lesson._

## Plan

- [ ] **D**: [upload.md](../../design/data-management/datasets/upload.md) — new §Commit dtype
      semantics: which coercions the commit applies (`→string` from any pandas-inferred type is
      the F1/F2 case; decide whether `→date` parsing is in or out of scope), WHEN coercion runs
      (at parquet write, per `kept_columns` order), what counts as failure, the typed error
      shape (error code · sheet · column · first-N offending cells with row refs), and batch
      atomicity (one bad sheet must not half-commit the batch — today's staged/rollback
      behavior holds). Sign off before code.
- [ ] **C**: contract — commit endpoint's 422 error envelope for `coercion_failed` (and the
      existing success shape unchanged). Check whether `values.yaml`/`_shared` error schemas
      already carry a slot for it.
- [ ] **B**: `write_excel_to_parquet` / CSV path accept dtype targets from `column_overrides`
      (not just `kept_columns`); coercion failure raised as a typed error → router maps to 422;
      rollback semantics verified.
- [ ] **F**: wizard Confirm step surfaces the typed 422 (column + cells) instead of today's
      generic message — bounded to error display, no new interaction.
- [ ] **I**: i18n en/vi for the error surface; design-doc sync.
- [ ] Tests: FM2.25-shaped fixture (mixed-type column + override → commits; leading zeros
      survive) · coercion-failure → 422 payload shape · parquet-dtype-equals-metadata
      regression (the F2 invariant) · batch atomicity on one failing sheet.

## Risks / unknowns

- **Coercion scope creep** — `→string` is the verified need; date parsing tempts because of ②
  (F11) but pulls in format inference (dd-mm-yyyy vs ISO). D-gate decides; default = string-only
  this round, date-typed ingest belongs to ②'s round. Scope brake.
- **Existing corrupted data** — FM1's committed dataset keeps its wrong int64 phones; this round
  is forward-only (re-upload fixes it; systematic repair belongs to ⑥ refresh). Say so in the
  design doc rather than implying retroactive healing.
- **Error-envelope precedent** — the typed 422 shape should not invent a one-off; align with
  the existing 409/422 error vocabulary (`query_stale` pattern) so F3's later error-envelope
  round inherits a consistent family.

## Do

_(pending — D first)_

## Check

- [ ] D signed off before C/B/F.
- [ ] FM2.25 (real file) commits through the wizard with `int→string` overrides on
      `Số gọi`/`Số nhận`; leading-zero phones intact in parquet (probe fixture unblocked).
- [ ] Coercion failure returns typed 422 naming sheet · column · offending cells; nothing
      half-committed.
- [ ] Parquet dtypes == `columns_json` dtypes for every new commit (F2 invariant test).
- [ ] Backend pytest + ruff green; FE tsc + vitest green; human eyeball of the new error
      surface (gate per selected flow).

## Act

**Learnings:** _(pending)_

**Promotions:** _(pending)_

**Prune check:** _(pending)_

## Feeds into → Round_144

Per the signed-off R142 order: **② date-bucketing (F11)** — date-typed ingest (enabled by this
round's coercion machinery) + a date-bucket step kind → THE weekly report's time axis. Behind
it: ⑥ refresh theme (F9/F10 → F5/F6) → F8 multi-range wizard → UI-batch (F7/F3/F4/F12/F13 +
carried R140 list).
