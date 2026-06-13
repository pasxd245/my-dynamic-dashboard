# Round 55: Close MVP query gaps — string `ne` + inclusive date bounds

**Status**: Complete
**Date started**: 2026-05-30
**Date completed**: 2026-05-31

## Goal

**Inherits from ← [Round_54](Round_54.md)** — R51 shipped the
advanced-query MVP and R54 made it discoverable (the `?` popover
renders operators from the **live** parser vocabulary). Two
operators were documented as MVP gaps and deferred to "their own
round" (R51 § Skill-pull trigger assessment; advanced-query.md
§ Read/write boundary → _Deferred_):

- **String `!=`** (`ne` for text columns) — today the parser maps
  `!=` to `undefined` for strings
  ([parser.ts:124](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/parser.ts#L124)).
- **Inclusive date bounds** — `won_at:>=2026-01-01` /
  `won_at:<=…`; today `>=`/`<=` map to `undefined` for date/
  datetime
  ([parser.ts:137-138](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/parser.ts#L137-L138)).

Both are **shared-vocabulary** changes (the advanced-query parser
and the R40 chip-row filter both read `OPS_BY_DTYPE` /
`FilterPredicate`), so this is a cross-cutting FE+BE round, not a
feature-local patch. With R54's live-vocabulary popover, **the new
operators surface in the `?` help automatically** — no extra
discoverability work.

_Track: 1 (product: the two operators). Pulled by: R51's
documented MVP gaps + R45 end-of-round Q&A. Per
[Evolution Rule](../../AGENTS.md)._

## Flow selection (R47 doctrine)

**DCFBI** (Design → Contract → Frontend → Backend → Integration).
The flow-selector 2-of-5 discovery triggers do **not** fire: the
predicate-vocabulary pattern is well-trodden (R39 BE, R40 chip
row, R51 parser), the data shape is the existing `FilterPredicate`
union, and the BE SQL path is already in place (see § Key finding).
No F1 timebox needed. The Design gate still does real work — it
must resolve two genuine questions (below) before any code.

> Run `flow-selector` + `gate-walker` formally at execution if you
> want the checklists on record; this draft pre-commits the
> rationale so the round can start at the Design gate.

## Key finding (scope-shaping)

The BE `_predicate_sql` is **operator-keyed and dtype-shared** for
the numeric/date/datetime branch
([filters.py:368-371](../../../workspace/apps/backend/app/ingest/filters.py#L368-L371)):
`gte` → `{col} >= CAST(? AS …)`, `lte` → `<=`. **Dates already get
inclusive-bound SQL for free** — the only BE change for inclusive
date bounds is *allowing* `gte`/`lte` in `OPS_BY_DTYPE["date"]` /
`["datetime"]`. No new SQL, no new operator name.

String `ne`, by contrast, has **no** SQL branch in the string
section (`contains`/`equals`/`starts_with`/`ends_with` only —
[filters.py:354-364](../../../workspace/apps/backend/app/ingest/filters.py#L354-L364))
and needs one: `lower({col}) != lower(?)` (case-insensitive, to
match the R36 `?q=` / existing string semantics).

## Design-gate decisions (resolved at R55 review)

1. **Date inclusive bounds: reuse `gte`/`lte`, or mint
   `on_or_after`/`on_or_before`?**
   _**Decided (user, 2026-05-30): reuse `gte`/`lte`.**_ The BE SQL, the
   `Operator` union, the `≥`/`≤` i18n labels, and the chip-row
   operand shape already exist for numeric — extending them to
   date/datetime is a one-line `OPS_BY_DTYPE` addition each side.
   Minting `on_or_after`/`on_or_before` (the R51 working names)
   would add two operators, two SQL branches, two i18n labels, and
   new operand-shape entries for **zero** behavioural gain. Cost of
   reuse: the chip-row shows `≥`/`≤` on a date rather than the
   prose "on or after" — acceptable and consistent with numeric.

2. **Do the new ops surface in the chip-row filter popover too?**
   `OPS_BY_DTYPE` is the **shared** source both consumers read, so
   "advanced-query-only" would mean forking the vocabulary — more
   complexity, not less. _**Decided: yes, surface in both.**_
   String `≠` and date `≥`/`≤` in the chip row are natural and keep
   the two surfaces consistent (an O-rule alignment: same data
   vocabulary, both surfaces).
   _Note (R55 review):_ string `ne` is absent from
   `OPS_BY_DTYPE["string"]` today, so **neither** surface offers
   string not-equals now — adding it to the shared set lights up
   the chip-row option **and** the `name:!=…` grammar together.
   (Numbers/dates already have `ne`; only string is missing it.)

3. **`ne` label: word or glyph `≠`?**
   The label is operator-keyed (`datasets.filters.op.ne`), shared
   across dtypes, and rendered in the help popover, the chip-row op
   dropdown, and the active-chip readback. Today `equals` is a word
   in both locales ("equals" / "bằng") but `ne` is the bare glyph
   "≠" — an asymmetric pair. _**Decided: make `ne` a word**_
   — en `"not equals"`, vi `"khác"` — restoring the equals/ne pair
   (follows the user's "VI: khác" steer). Applies everywhere `ne`
   shows (so number/date `≠` also becomes the word); the compact
   "≠" glyph is dropped. Comparison ops `>`/`<`/`≥`/`≤`
   (`gt`/`lt`/`gte`/`lte`) stay as glyphs — they aren't offered on
   strings anyway.

## What is IN scope

- **String `ne`** end-to-end:
  - FE shared types: add `ne` to the `string` `FilterPredicate`
    variant + `OPS_BY_DTYPE.string`
    ([filters/types.ts:46,60](../../../workspace/apps/builder/src/features/data-management/datasets/filters/types.ts#L46)).
  - FE parser: `STRING_OP` += `'ne'`; `STRING_OP_BY_PREFIX['!=']`
    = `'ne'`.
  - BE: `OPS_BY_DTYPE["string"]` += `"ne"`; string SQL branch
    `lower({col}) != lower(?)`.
- **Inclusive date bounds** (reuse `gte`/`lte`, pending D-gate):
  - FE shared types: add `gte`/`lte` to the `date`/`datetime`
    `FilterPredicate` variant + `OPS_BY_DTYPE.{date,datetime}`.
  - FE parser: `DateOp` += `'gte' | 'lte'`;
    `DATE_OP_BY_PREFIX['>=']` = `'gte'`, `['<=']` = `'lte'`.
  - BE: `OPS_BY_DTYPE["date"|"datetime"]` += `"gte"`, `"lte"`
    (SQL already handles them).
- i18n: `≥`/`≤` op labels already exist (reused for dates); per
  D-gate Q3, **re-word `ne`** — en `"not equals"`, vi `"khác"`
  (replaces the `≠` glyph) — and verify the chip-row, help popover,
  and active-chip readback render it for every dtype that offers
  `ne` (string + number + date, en + vi).
- The R54 `?` popover picks up all three automatically (live
  vocabulary) — verify, no code.

## What is OUT of scope

- Minting `on_or_after`/`on_or_before` as distinct operators
  (rejected in D-gate Q1 unless the gate overturns the
  recommendation).
- Negation (`NOT` / leading `-`), parentheses / nested grouping,
  operand-less ops in the grammar (`is_null`/`is_empty` surface
  syntax), `between` surface syntax — all remain deferred
  (advanced-query.md § Deferred).
- Autocomplete / token underline / saved queries — unchanged.
- Any new transport or composition change — `aq` DNF + AND-compose
  is unchanged; this round only widens the per-atom op set.

## Plan (by gate)

1. **Design** — amend advanced-query.md + dataset-filters.md:
   move string `ne` + inclusive date bounds out of _Deferred_,
   record the `gte`/`lte`-reuse decision and the both-surfaces
   decision. Run `ui-design` design-spec if the chip-row label
   change warrants it (likely a quick pass).
2. **Contract** — the `FilterPredicate` shape is unchanged
   (existing ops, newly allowed per dtype); confirm the rows-get
   contract / MSW fixtures cover a string-`ne` and a date-`gte`
   query.
3. **Frontend** — shared types + parser maps; FE parser tests
   (string `!=`, date `>=`/`<=`, unicode `≠`/`≥`/`≤` already
   aliased) + chip-row test for the newly-offered ops.
4. **Backend** — `OPS_BY_DTYPE` additions + the one string-`ne`
   SQL branch; pytest per new op (parse-allow + SQL).
5. **Integration** — one MSW (FE) + one pytest (BE) proving a
   mixed query (e.g. `name:!=foo AND won_at:>=2026-01-01`)
   round-trips through `aq`.

## Risks / unknowns

- **Chip-row regression surface** — adding ops to `OPS_BY_DTYPE`
  changes the chip-row operator dropdown for string/date columns;
  snapshot/option-count tests there may need updating. The `ne`
  re-label (Q3) also breaks any test asserting the literal "≠" in
  the chip row / active chips / help popover — grep and update.
  Low risk, but it is the one place a "shared vocabulary" change
  leaks beyond advanced-query.
- **Case sensitivity of string `ne`** — must mirror the existing
  `equals`/`contains` `lower(...)` semantics, or `≠` and `=`
  disagree on case. Covered by the SQL-branch spec above.
- **`>=`/`<=` parser precedence vs `>`/`<`** — `PREFIXES` already
  lists the two-char prefixes first
  ([parser.ts:101](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/parser.ts#L101)),
  so `>=` is matched before `>`; just verify with a test.

## Do

**Design** — amended both design docs:

- [advanced-query.md](../../design/data-management/datasets/advanced-query.md):
  the operator-prefix table now maps date `>=`/`<=` → `gte`/`lte`
  and string `!=` → `ne`; notes ²/³ rewritten from "known gap" to
  "Closed in R55" (recording the `gte`/`lte`-reuse decision and the
  case-insensitive string-`ne` SQL); the _Deferred_ bullet struck
  through and marked shipped.
- [dataset-filters.md](../../design/data-management/datasets/dataset-filters.md):
  predicate-vocabulary table gains a string `ne` row + date
  `gte`/`lte` rows; the `ne` UI label changed from `≠` to
  "not equals" across numeric/date/string; the per-dtype operator
  dropdown prose lists updated.

**Frontend**:

- Shared [filters/types.ts](../../../workspace/apps/builder/src/features/data-management/datasets/filters/types.ts):
  `ne` added to the `string` `FilterPredicate` variant +
  `OPS_BY_DTYPE.string`; `gte`/`lte` added to the `date`/`datetime`
  variant + `OPS_BY_DTYPE.{date,datetime}`. (`Operator` union and
  `OPERAND_SHAPE` already had all three.)
- [parser.ts](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/parser.ts):
  `StringOp` += `ne`, `DateOp` += `gte`/`lte`;
  `STRING_OP_BY_PREFIX['!=']='ne'`, `DATE_OP_BY_PREFIX['>=']='gte'`,
  `['<=']='lte'`.
- [FilterPopover.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/filters/FilterPopover.tsx):
  the `draftToPredicate` single-shape narrowing allow-lists were
  **hardcoded** per dtype — added `ne` (string) and `gte`/`lte`
  (date) so the chip row builds + renders them. (The value-input
  render path is shape-driven, so no change there.)
- i18n: `datasets.filters.op.ne` re-worded — en `"not equals"`,
  vi `"khác"`.
- The R54 `?` help popover surfaces all three with **no code
  change** — `reference.ts` derives `SYNTAX_REFERENCE` from the
  live prefix maps.

**Backend** ([filters.py](../../../workspace/apps/backend/app/ingest/filters.py)):
`OPS_BY_DTYPE["string"]` += `ne`; `["date"]`/`["datetime"]` +=
`gte`/`lte`. One new string SQL branch
`lower(col) != lower(?)` (case-insensitive, mirrors `equals`). Date
`gte`/`lte` needed **no** SQL — the shared numeric/date CAST branch
already emits `>=`/`<=` (the key finding).

**Tests**:

- FE parser: +2 R55 success cases (string `!=`/`≠`; date
  `>=`/`<=`/`≥`/`≤`); the two "documented gap" error tests retired
  (one replaced with a still-valid `~`-on-date unsupported case).
- FE vocab-parity (`dataset-detail.test.tsx`) + BE vocab-integrity
  (`test_datasets_rows_get.py`): expected `OPS_BY_DTYPE` updated.
- BE: +3 functional (`string ne` case-insensitive; date `gte`/`lte`
  inclusive-boundary) + 1 `aq` integration (`name!=Alice AND
  signed_up>=2024-02-03`, contract-validated).
- Results: **FE 121 green, tsc clean; BE 135 green.** (Two upload-
  wizard tests flake under concurrent BE+FE load — pass in
  isolation; pre-existing, not R55.)

## Check

- [x] Design gate: all three questions resolved; design docs
      amended (string `ne` + inclusive date bounds out of
      _Deferred_).
- [x] FE: shared types + parser maps; parser + chip-row vocab tests
      green (`FilterPopover` narrowing allow-lists also patched).
- [x] BE: `OPS_BY_DTYPE` + string-`ne` SQL; pytest green.
- [x] Integration: mixed `aq` query round-trips (BE pytest,
      contract-validated; FE parser covers `name:!=… AND won_at:>=…`).
- [x] R54 `?` popover renders the new ops with no code change
      (verified via `reference.ts` deriving from the live maps).
- [x] i18n en + vi labels present (`ne` re-worded to
      "not equals" / "khác").
- [x] Full FE suite (121) + BE pytest (135) green; `tsc --noEmit`
      clean.

## Act

- **MVP query gaps closed.** String `ne` + inclusive date bounds shipped
  end-to-end; the R55 advanced-query MVP is feature-complete for the two
  documented deferrals.
- **The key finding held** — date `gte`/`lte` needed zero new SQL and zero
  new operators; reuse beat minting `on_or_after`/`on_or_before`. One new
  string-`ne` SQL branch was the only backend logic added.
- **R54's discoverability investment compounded** — the live-vocabulary
  `?` popover surfaced all three new operators with no code change.
- **Cost confirmed the foot-gun**: one vocabulary addition still touched
  four hand-mirrored sites (FE/BE `OPS_BY_DTYPE` + two test copies) and a
  hardcoded `FilterPopover` allow-list — logged as Track-2 seeds below.
- **End-of-round discussion held 2026-05-31** — see Outcome below.

## End-of-round discussion — Track-2 lessons to pull in

_Reserved (user request, 2026-05-30): at R55 review+commit, discuss
lessons from this chain (R51→R55) that may warrant **Track-2**
(tooling / process / skill) work pulled in via the Evolution Rule.
Filled together at the end of the round; do not pre-populate._

Candidate seeds to weigh (not decisions) — observations surfaced
while building R51→R55:

- **`_predicate_sql` cognitive complexity.** The BE op→SQL dispatch
  ([filters.py](../../../workspace/apps/backend/app/ingest/filters.py))
  is a flat `if op == …` chain now flagged at complexity 26 (limit
  15); every vocabulary expansion nudges it. A table-driven dispatch
  (`{op: (sql_template, params_fn)}`) would flatten it and make the
  next op a one-line data entry. _Track-2 candidate: a small refactor
  round, or a lint-debt skill._
- **Vocabulary drift is guarded by hand-mirrored tests.** FE
  `OPS_BY_DTYPE`, BE `OPS_BY_DTYPE`, and two test copies must be
  edited in lock-step (R55 touched all four). A generated/shared
  source — or a single cross-language parity check — would remove
  the foot-gun. _Track-2 candidate._
- **Hardcoded narrowing allow-lists in `FilterPopover`.** The
  `draftToPredicate` per-dtype `op === …` guards silently drop any
  op not listed (string `ne` / date `gte`/`lte` would have rendered
  no input). They duplicate `OPS_BY_DTYPE` + `OPERAND_SHAPE` intent.
  _Track-2 candidate: derive the guard from the shared maps._
- **Test flakiness under concurrent FE+BE load.** Two upload-wizard
  tests time out only when suites run concurrently. _Track-2
  candidate: raise their timeout or serialize the heavy suites._
- **No one-shot "dev with mock" command.** Enabling the MSW layer
  today means editing `builder.enable_mock: true` in
  [values.yaml](../../../workspace/config/values.yaml) + re-rendering
  — easy to commit by accident. A `pnpm dev:builder:mock` util would
  flip mock on for one dev session only. _Finding (R55): Vite 7's
  `loadEnv` merges `process.env` VITE\_-prefixed vars **after** the
  `.env` file, so an inline `VITE_MOCKS=1 pnpm dev:builder` overrides
  the rendered `.env` and survives builder's `predev` re-render — a
  one-line script, no values.yaml edit, nothing committed._
  _Track-2 candidate (user-requested, 2026-05-30): dev-experience util._
- **Test selectors should be a Contract-gate artifact, not improvised.**
  R55 had a `dataset-detail` test assert on the display string
  "Advanced query help"; an R54/R55 copy change broke it, and the fix
  was to re-key the test on `data-component="AdvancedQueryHelp…"`
  ([AdvancedQueryHelp.tsx:80](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/AdvancedQueryHelp.tsx#L80))
  instead of volatile text/i18n. _Lesson for the **C-method**: decide
  stable `data-component` / `data-id` hooks **at the Contract gate** as
  part of the execution-truth (O-rule), so (a) tests stop coupling to
  copy/locale and (b) future Playwright E2E binds to stable hooks →
  adaptive, low-effort. The convention already exists in the build; it
  isn't yet a contracted, gate-checked deliverable._
  _Track-2 candidate (user-noted, 2026-05-30): C-gate enrichment +
  feeds the design-corpus audit's C-gate facet
  ([brainstorm](../brainstorms/2026-05-30-design-corpus-audit/README.md))._

### Outcome (2026-05-31)

Discussion held. **Decision: launch a design-corpus conformance-audit
program** — sweep the DCFBI/DFCFBI + D-gate doctrine across all live
design surfaces, one per round, to make them in-sync **and** to detect
method-gaps as concrete Evolution-Rule pulls. The seven seeds/gaps above
become the initial **gap-rollup**; they are **not** their own rounds yet
— the audit triages them (a gap recurring across many surfaces → a
Track-2 round; a one-off → an in-round fix).

- Brainstorm + 3 settled decisions:
  [2026-05-30-design-corpus-audit](../brainstorms/2026-05-30-design-corpus-audit/README.md)
  (pilot `dataset-filters` · doc-conformance + spot-verify · single
  program doc).
- Program doc: [design-corpus-audit.plan.md](../programs/design-corpus-audit.plan.md).
- Pilot: [Round_56](Round_56.md) — audit `dataset-filters`, paused at the
  Design gate for review.

_(Add/prune together at review; then decide which, if any, become
their own Track-2 rounds via the Evolution Rule.)_

## Feeds into → (TBD)

Remaining advanced-query deferrals — **negation**, **parentheses /
nested grouping**, **grammar v2** — are each their own round and
unscheduled. Confirm the next concept at R55 end-of-round Q&A.
