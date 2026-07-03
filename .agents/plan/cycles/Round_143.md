# Round 143: Commit honors dtype overrides — typed coercion errors (F1+F2)

**Status**: Review
**Date started**: 2026-07-03
**Date completed**:
**Flow**: **DCFBI** — set at the Design gate via flow-selector (0 of 5 conditions fired);
recorded in the Do log.

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

- [x] **D**: [upload.md](../../design/data-management/datasets/upload.md) — new §Commit dtype
      semantics: which coercions the commit applies (`→string` from any pandas-inferred type is
      the F1/F2 case; decide whether `→date` parsing is in or out of scope), WHEN coercion runs
      (at parquet write, per `kept_columns` order), what counts as failure, the typed error
      shape (error code · sheet · column · first-N offending cells with row refs), and batch
      atomicity (one bad sheet must not half-commit the batch — today's staged/rollback
      behavior holds). Sign off before code.
- [x] **C**: contract — commit endpoint's 422 error envelope for `coercion_failed` (and the
      existing success shape unchanged). Check whether `values.yaml`/`_shared` error schemas
      already carry a slot for it.
- [x] **B**: `write_excel_to_parquet` / CSV path accept dtype targets from `column_overrides`
      (not just `kept_columns`); coercion failure raised as a typed error → router maps to 422;
      rollback semantics verified.
- [x] **F**: wizard Confirm step surfaces the typed 422 (column + cells) instead of today's
      generic message — bounded to error display, no new interaction.
- [x] **I**: i18n en/vi for the error surface; design-doc sync.
- [x] Tests: FM2.25-shaped fixture (mixed-type column + override → commits; leading zeros
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

**2026-07-03 — D SIGNED OFF (human, same day)** ([upload.md §Commit dtype semantics
(R143)](../../design/data-management/datasets/upload.md#commit-dtype-semantics-r143)). Draft discovery: the design doc was **self-contradictory** — §Metadata said
overrides relabel-only (design-synced to the shipped defect) while §Backend endpoint shape + C9
specced real casting with a 422; R143 restores the original intent, and C9 turns out to be a
checked-off criterion the implementation never honored (500s today). Key leans taken in the
draft: coerced set = the four **formatless** dtypes (string/integer/float/boolean);
**date/datetime stay relabel-only** this round — their `format` field speaks Java-style tokens
that pandas/DuckDB don't parse, a translation decision that belongs to ②'s date-ingest round;
typed 422 `coercion_failed` (sheet · column · dtype · first-5 cells · totalFailed); batch
atomicity unchanged; forward-only.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | The wizard state machine is untouched (upload.md §Wizard state machine unchanged); the only FE delta is one additional payload shape rendered by the Confirm step's EXISTING commit-failure `<Alert>`. |
| 2. New interaction pattern           | no     | Inline `<Alert>` on Confirm-step commit failure already exists in this exact surface (upload.md §Confirm: "On commit failure … an inline `<Alert>` surfaces above the action row"); R143 only structures its content. |
| 3. High user-error risk              | no     | The change REDUCES misstep cost (opaque 500 → typed 422 naming column/cells); commit stays atomic all-or-nothing, nothing new is destructive or irreversible. |
| 4. Contract depends on unresolved UI | no     | The signed-off D section fully states the 422 wire shape (`coercion_failed` · sheet · column · dtype · first-5 cells · totalFailed); no UI question feeds the schema. |
| 5. UX confidence below threshold     | no     | Display-only rendering of a specified payload in an existing surface; D signed off same-day with zero open UX questions (near the no-UI branch by construction). |

Result: **Flow: DCFBI**

**Built (2026-07-03), one seam per layer:** C — `ApiErrorCoercionFailed` + `CoercionFailedCell`
join the code-first union (`api-error.yaml`, enum + oneOf + mapping); batch-post 422 becomes a
documented oneOf (FastAPI detail | coercion_failed); `column-override.yaml` corrects the false
"pandas+DuckDB parse Java-style formats" claim. B — writers gain `dtype_targets`; ONE shared
cell lexicon (`_coerce_dataframe`) for both source paths with conformance fast-path skips
(CSV no-override commits keep the pure-DuckDB COPY); `CoercionError` → `JSONResponse` 422.
F+I — Confirm-step helpers render column (sheet-prefixed) · dtype · first-5 cells · count;
en/vi keys; FE `ApiError` union + `ERROR_CODES.COERCION_FAILED` (values.yaml → both templates).

**Deviation from the D draft (flagged, design doc updated in the same change):** coercion
targets are **every kept column's committed formatless dtype**, not overrides-only. Discovered
at B: the parser infers `string` for a MIXED column, so overrides-only would leave the
no-override commit dying as the same ArrowInvalid 500 (F1 alive) with `columns_json` still
lying (F2 alive). Intent unchanged — committed metadata drives; nothing new is inferred.

**Verification (2026-07-03):** backend pytest **312 pass** (6 new: FM2-shaped mixed column ×
with/without override · F2 invariant · typed-422 payload · 2-sheet atomicity abort · CSV both
paths) · ruff clean · FE tsc clean · vitest **259 pass** (1 new). **Real-file acceptance**: the
actual FM2.25 + the probe's exact `int→string` overrides → **201**, 26 leading-zero `Số gọi`
cells intact, parquet == `columns_json` (zero violations), Hot-line dimension range extracted
in the same batch; `Trạng thái`→integer → **422** `coercion_failed` (totalFailed 6692), and the
live wizard renders the typed alert (headless screenshot; the R142 "stuck upload" scenario now
fails loud, in-place, with the fix named).

## Check

- [x] D signed off before C/B/F (2026-07-03).
- [x] FM2.25 (real file) commits through the wizard with `int→string` overrides on
      `Số gọi`/`Số nhận`; leading-zero phones intact in parquet (probe fixture unblocked).
      *(2026-07-03: real-file API run → 201; 26 leading-zero `Số gọi` cells preserved;
      Hot-line range extracted in the same batch.)*
- [x] Coercion failure returns typed 422 naming sheet · column · offending cells; nothing
      half-committed. *(Real-file demo: `Trạng thái`→integer → 422 `coercion_failed`,
      totalFailed 6692; atomicity test covers the two-sheet abort.)*
- [x] Parquet dtypes == `columns_json` dtypes for every new commit (F2 invariant test).
- [ ] Backend pytest + ruff green; FE tsc + vitest green; human eyeball of the new error
      surface (gate per selected flow). *(pytest 312 · ruff clean · tsc clean · vitest 259 —
      all green 2026-07-03; HUMAN EYEBALL PENDING — screenshot of the live alert captured.)*

## Act

**Learnings:** _(pending)_

**Promotions:** _(pending)_

**Prune check:** _(pending)_

## Feeds into → Round_144

Per the signed-off R142 order: **② date-bucketing (F11)** — date-typed ingest (enabled by this
round's coercion machinery) + a date-bucket step kind → THE weekly report's time axis. Behind
it: ⑥ refresh theme (F9/F10 → F5/F6) → F8 multi-range wizard → UI-batch (F7/F3/F4/F12/F13 +
carried R140 list).
