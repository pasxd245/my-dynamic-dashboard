# Round 141: Deliverable shaping steps — sort · select/rename/reorder

**Status**: Complete
**Date started**: 2026-07-02
**Date completed**: 2026-07-02
**Flow**: **DCFBI** — set at the Design gate via flow-selector (0 of 5 conditions fired); recorded
in the Do log.

## Goal

**Inherits from ← [Round_140](Round_140.md) "Feeds into" + the
[step-model brainstorm](../brainstorms/2026-07-01-step-model-extensibility.md) roadmap ③** — add the
two deliverable-shaping step kinds: **`sort`** (order without limit; `top_n` minus the limit) and
**`select`** (select / rename / reorder columns). Together they let a shaped output carry specific,
friendly, ordered columns — the prerequisite the "consolidated Excel out" value-out deliverable
(roadmap ④) needs. Also retires the R140 naming wart: `count_distinct(product)` can finally be
renamed instead of shipping a column confusingly named `product`.

_Track: 1. Pulled by ← the human's R139 ask ("more steps") via the brainstorm's value/cost table
(select/rename = high value / small cost; sort = medium value / tiny cost), selected by the human at
R141 open. D-gate first per the d-gate-artifact-in-design-corpus lesson._

## Plan

- [x] **D**: [queries.md](../../design/data-management/queries/queries.md) §Transform steps — spec
      both kinds: `sort` (multi-key? asc/desc per key; NULL ordering; dtype-agnostic) and `select`
      (projection list + rename map + implicit reorder; unknown-column and duplicate-output-name
      rules; effect on resolved output columns). Decide one step or two (brainstorm leans two small
      kinds). Sign off before code.
- [x] **C**: `query.yaml` `SortStep` + `SelectStep` + union ×2 (QueryDefinition AND
      `workflow.yaml`'s enumerated mirror — NOT a `$ref`-free ride this time).
- [x] **B**: models (`SortKey/SortStep/SelectCol/SelectStep`, union) · `_plan_sort` /
      `_plan_select` (unknown_column / duplicate_output_column; select re-binds the column
      space) · `_apply_step` SQL (`ORDER BY … NULLS LAST` both directions; projected SELECT).
- [x] **F**: FE `Step` union + `steps.ts` (`stepOutput` select re-binds, sort preserves; blanks;
      `STEP_KINDS` ×2) + `SortBody` (key list, then-by) + `SelectBody` (ordered rows: move /
      col / rename / remove) + MSW `sortStepMock` / `selectStepMock` mirrors.
- [x] **I**: i18n en/vi (9 keys) + workflows.md step-kind list sync.
- [x] Tests: backend 11 new (multi-key sort · NULLS LAST ×2 · aggregate→sort typed · select
      project/rename/reorder · rename re-binds · R140-wart closure · 4× 422); FE 5 new
      (threading, blanks, editor render+rename, preview sort/select through the contract).

## Risks / unknowns

- **`select` semantics need a real decision** (D-gate): is it projection-only, or
  projection+rename+reorder in one body? Duplicate output names, renaming a group key mid-chain, and
  downstream-step column references all need rules.
- **`sort` guarantees** — SQL ORDER BY on an intermediate step doesn't survive later steps; spec
  honestly where ordering is meaningful (final step / deliverable boundary) instead of implying a
  stable pipeline-wide order.
- **Scope brake**: no `compute` step, no function catalog, no export — those are roadmap ② and ④.

## Do

**2026-07-02 — D signed off** (human, same day). [queries.md §Transform steps](../../design/data-management/queries/queries.md)
now specs both kinds. Decisions taken in the draft: **two kinds** (`sort` + `select`, per the
brainstorm — shaping, not computation); `sort` is **multi-key** (`keys: [{col, descending}]` —
chained single-key sorts don't compose, the later one wins); explicit **NULLS LAST both
directions** (deterministic deliverable, blanks at the bottom); `select` is **one body** doing
projection + rename + reorder (`cols: [{col, as?}]`, output = exactly these, dtypes kept, names
`as ?? col`, unique); renames are **real re-bindings** (later steps + `resolvedColumns` see new
names).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | Two step-body forms inside the existing StepsEditor cards; no new state model — a key/col row list per body, same shape as the existing step list. |
| 2. New interaction pattern           | no     | Ordered row-list with add / up / down / remove already exists in this exact surface (StepsEditor step cards, `move`/`remove`/`add`); sort keys + select cols reuse it. |
| 3. High user-error risk              | no     | Non-destructive shaping over a live preview; bad specs are 422-blocked at save and 409-surfaced on drift — nothing irreversible. |
| 4. Contract depends on unresolved UI | no     | The D spec fully states both wire shapes (`keys: [{col, descending}]`, `cols: [{col, as?}]`); no UI question feeds the schema. |
| 5. UX confidence below threshold     | no     | Bodies mirror the four existing step kinds' editor pattern; D signed off same-day with no open UX questions. |

Result: **Flow: DCFBI**

**Built (2026-07-02):** both kinds end-to-end, one seam per layer — contract schemas + the two
union enumerations, the model classes + `Step` union, `_plan_sort`/`_plan_select` (the select
plan RE-BINDS the evolving column space, so `_step_plan`'s fold gives old-name-after-rename 422s
for free), `_apply_step` SQL, the FE type/mirror/editor bodies, the MSW mock mirrors, en/vi
labels. Queries, saved steps, and workflows all gain both kinds via the shared union.

**Deviation from the D draft (flagged):** the select rename wire field is **`name`**, not `as` —
`as` is a Python keyword, and the `model_dump()`-everywhere serialization would have leaked an
`as_` alias onto the wire; `name` also matches `derive.name`'s existing rename vocabulary. Design
doc + contract updated in the same change; intent (optional per-col rename) unchanged.

**Verification:** backend `pytest` **306 pass** (11 new) · `ruff check` clean · FE `tsc` clean ·
FE vitest **258 pass** (5 new; preview responses contract-validated by the MSW setup).

## Check

- [x] Design doc section signed off (D-gate) before C/B/F (2026-07-02).
- [x] Backend pytest 306 green (11 new specs); ruff clean.
- [x] FE tsc + vitest 258 green; editor offers both kinds (sort keys any-dtype; select rows
      move/rename/remove).
- [x] count_distinct-rename path works end-to-end (the R140 wart is closed —
      `test_count_distinct_rename_closes_the_r140_wart`).
- [x] Optional human eyeball (two new step bodies in the existing editor; DCFBI F confirms, no
      hard F2 gate). 2026-07-02: human signed off.

## Act

**Learnings:**

- **The fold-validator pays rent again** — because `_plan_select` returns the RE-BOUND column
  space, "old name after a rename → 422" needed zero extra code: `_step_plan`'s existing fold
  caught it. The evolving-column-space design (R120) keeps absorbing new step kinds.
- **"$ref the union — free" was half-true** — `workflow.yaml` ENUMERATES the union member list
  rather than referencing one shared `Step` schema, so every new kind is a two-file contract
  edit. Cheap, but worth knowing: a shared `Step` schema would make workflow inheritance
  actually free.
- **Wire names must dodge implementation keywords** — `as` (the natural SQL rename word) is a
  Python keyword; with `model_dump()`-everywhere serialization the alias would leak. Checking the
  serialization path BEFORE locking a field name avoided a late contract break.

**Promotions:** none — executes brainstorm roadmap ③.

**Prune check:** nothing pruned.

## Feeds into → Round_142

Roadmap ④ **value-out deliverable (Excel/CSV export)** is now unblocked once shaping lands.
Alternatives when pulled: roadmap ② (lock fork: `compute` step + catalog, then `date_trunc`) or the
batched UI/UX bug round (carrying the R140-noted issues).
