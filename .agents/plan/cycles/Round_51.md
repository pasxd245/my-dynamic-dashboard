# Round 51: Advanced query on datasets — first DCFBI/DFCFBI feature trial

**Status**: Complete
**Date started**: 2026-05-29
**Date completed**: 2026-05-29

## Goal

**Inherits from ← [Round_50](Round_50.md)** — R49 + R50 shipped the
operational toolkit for DCFBI/DFCFBI rounds (`flow-selector`,
`gate-walker`, `markdown-check-link`) ahead of the first feature
trial. R47 codified the doctrine itself at
[`decisions/2026-05-28-hybrid-flow-governance.md`](../../decisions/2026-05-28-hybrid-flow-governance.md);
R48 archived the DCBF artifacts it superseded. R51 is the trial
the previous five rounds funnel into: **the first product feature
round operating under R47 doctrine with the full toolkit in
hand**.

The feature is **advanced query on datasets** — a single-line
query input that layers on top of the R37-designed chip filters.
The chip row stays for discoverable per-column predicates; the
new advanced input handles boolean composition (`AND` / `OR`) and
direct key:value entry without clicking through popovers. R37's
own design doc explicitly pre-declared this as the next step:

> "The next step _after_ filters is a typed query language
> (`stage:won AND amount>10000`) — that's a separate concept
> with its own [DCBF] chain."

R51 picks up that deferral under the new chain (DCFBI default;
DFCFBI if flow-selector triggers at Design exit). The pre-existing
design + contract + FE + BE substrate from R37–R40 means the
predicate vocabulary already exists — R51 adds the parser, the
input UI, and the wiring; the BE evaluator stays unchanged if the
parser emits the same predicate shapes.

_Track: 1 (product feature). Pulled by: R37 dataset-filters
design doc's explicit "next step" deferral; R45 end-of-round Q&A
listing Track-1 return-to-product candidates (advanced query
named); user selection in R50 end-of-round Q&A as the strongest
DCFBI-vs-DFCFBI trial candidate (genuine flow-selector ambiguity).
Per [Evolution Rule](../../AGENTS.md)._

**Why this feature for the first trial:**

- **Design exit is non-trivial but bounded.** A new query syntax
  has real UX questions (error display, suggest-on-failure,
  partial input states); the design phase isn't ceremonial.
- **Flow-selector has genuine ambiguity.** The UI could be
  designed-then-built (DCFBI) or prototyped-then-frozen (DFCFBI)
  — the 2-of-5 selector decides honestly at Design exit, not
  by guess at planning time.
- **Cross-link surface is real.** R51 will cite the existing
  dataset-filters predicate vocabulary, the dataset-detail page
  it lives on, the `_shared/api-error.yaml` contract — exactly
  the rot surface `markdown-check-link` was built for.
- **Gates have teeth.** Contract gate must verify the new
  parser's predicate output matches the existing BE evaluator
  _exactly_ (no shape drift). Backend gate must verify zero
  regression in chip-filter tests. Integration gate must verify
  chip + advanced compose correctly when both are active.

**Flow**: **DFCFBI (triggers 1, 2)** — recorded at Design exit per
[`flow-selector`](../../skills/flow-selector/SKILL.md); full
condition tally in the [Do log](#do).

## What is IN scope

- **A new design doc**
  `.agents/design/data-management/advanced-query.md` covering:
  syntax grammar (key:value, operators, AND/OR), error states,
  layout placement on the dataset detail page, lifecycle (when
  the advanced input is visible vs hidden), the predicate-
  output shape that maps to R37's vocabulary.
- **MVP query syntax**: `key:value` pairs joined by `AND` / `OR`
  (case-insensitive), one boolean depth (no parentheses, no
  negation in the MVP). Operators per column dtype as already
  declared in `dataset-filters.md` (`stage:won`, `amount:>1000`,
  `won_at:>=2026-01-01`, `is_active:true`).
- **Parser** in the FE that emits the existing predicate JSON
  shape; same encoded-params transport as chip filters.
- **Inline parse-error display** at the input (e.g., red
  underline + tooltip on the unparseable token).
- **Composes with chip filters AND `?q=`**: when both an
  advanced query and chip filters are set, the predicate sets
  union via AND (same join the chip row already uses
  internally).
- **Backend contract unchanged** if the parser emits the same
  predicate shape; if the existing `?filter[]=` param can't
  carry the OR semantics, **either** add a new `q_advanced`
  param **or** extend the existing one — Contract phase
  decides, documented in this round.
- **Tests**: FE parser unit tests, FE component test for the
  input + error state, BE regression suite still green, one
  integration test for chip + advanced composition.

## What is OUT of scope

- **Nested grouping / parentheses** — deferred to a follow-up
  round once the MVP grammar surfaces real ambiguity.
- **Negation operator (`NOT` / `-`)** — same reason.
- **Autocomplete / type-ahead suggestions** in the input —
  separate UX problem; deferred.
- **Saved queries / query history** — persistence concern,
  separate round.
- **Cross-column expressions** (e.g., `amount > revenue`) —
  out of the MVP predicate vocabulary; not in R37's contract.
- **Server-side query language exposure** (raw query text in
  the BE) — the BE still receives predicates, not text. The
  parser is a pure FE concern.
- **Dashboards / other surfaces** that might consume the same
  predicates — out of scope; design doc notes the portability
  but the implementation only touches dataset detail.

## Plan

The phase chain runs in **one round**. Each phase is gated by
[`gate-walker`](../../skills/gate-walker/SKILL.md) per R47.
Specific Plan bullets below assume **DCFBI**; if the
flow-selector flips to DFCFBI at the Design gate, the Contract
and Frontend bullets reorder (F1 → C → F2) and the F1 timebox
(≤2 working days, hard) applies — record the selection and the
adjusted ordering in the Do log before proceeding.

- [x] **Design (D)** — author
      `.agents/design/data-management/advanced-query.md`. Cover
      the MVP grammar, layout placement, error semantics,
      predicate-output mapping. Cross-link
      [`dataset-filters.md`](../../design/data-management/dataset-filters.md),
      [`dataset-detail.md`](../../design/data-management/dataset-detail.md).
      Exit gate: testable acceptance criteria + state-model
      table for the input lifecycle. Run
      [`flow-selector`](../../skills/flow-selector/SKILL.md)
      against this doc; record `Flow:` line in the Do log.
      **→ gate-walker: Design closed; Flow: DFCFBI (triggers 1, 2).**
- [x] **Contract (C)** — decide and document whether the
      existing `?filter[]=` encoded-params shape covers AND/OR
      composition, or whether a new `q_advanced` param /
      `?filter[]=` JSON-body fallback (`POST /datasets/{id}/rows:search`)
      carries the boolean structure. Update the relevant
      `*.contract.{yaml,md}` pair; validator stays green.
      Exit gate: contract document signed, validator passes
      end-to-end.
      **→ gate-walker: Contract closed; additive `aq` JSON param
      chosen (DFCFBI: ran after F1, informed by it).**
- [x] **Frontend (F or F1+F2)** — build the input component +
      pure parser module + error display + integration on
      the dataset detail page. The parser is the load-bearing
      unit; unit-test it independently before wiring into the
      component. Exit gate: parser tests pass, component test
      covers the empty/typing/parsed/errored states, MSW
      handler returns expected predicate set for a fixture
      query.
      **→ gate-walker: F1 + F2 closed (DFCFBI split); 36 new FE
      tests; full FE suite 101 pass, no regression.**
- [x] **Backend (B)** — if Contract added a param shape,
      extend the BE handler to accept it. If the parser emits
      the same shape the chip filters already use, this phase
      is a no-op confirmation only. Exit gate: BE tests green;
      54+ tests still pass; one new test exercises the
      AND/OR combination if a shape changed.
      **→ gate-walker: Backend closed; 131 BE pass (12 new aq
      tests, OR combination exercised).**
- [x] **Integration (I)** — verify chip filters + advanced
      query compose correctly when both are set; verify
      `?q=` substring search composes correctly with both;
      verify the dataset-detail page handles all three
      simultaneously without UI thrash. Exit gate: one
      integration test covers the three-way composition.
      **→ gate-walker: Integration closed; FE + BE three-way
      composition tests green against the shared contract.**
- [x] **Post-round audit** — run `markdownlint-cli2` and
      [`markdown-check-link`](../../skills/markdown-check-link/SKILL.md)
      across the round's touched docs. Triage any findings;
      apply safe candidates via `--fix` (gated at Review per
      R50 quality bar).
      **→ markdownlint clean (new docs); markdown-check-link caught + fixed one broken anchor; all links resolve.**

## Risks / unknowns

- **Parser grammar ambiguity.** A query like
  `stage:won OR stage:lost AND amount:>1000` is ambiguous
  without parentheses (does AND bind tighter than OR or
  vice-versa?). The Design doc must commit to a precedence
  rule; documenting "AND binds tighter than OR" is the
  conventional choice. Untested precedence = real bug surface.
- **Predicate-shape drift.** If the parser emits a structurally
  different predicate from the chip row's predicate (subtle
  field-name or type difference), the BE evaluator will accept
  it silently and return wrong rows — visible only through
  integration test. The Contract phase has to lock the exact
  JSON shape both producers emit.
- **F1 timebox if DFCFBI selected.** ≤2 working days for the
  input prototype is tight for an unfamiliar pattern. Mitigate
  by deciding upfront on a library if any (e.g., react-aria
  for the popover error display) so F1 doesn't burn time on
  primitives. Overrun → drop to DCFBI with documented UX risk
  per R47.
- **Chip + advanced composition UX.** When both are set, is
  the AND join visible in the UI, or does it look like the
  advanced query "wins" silently? Design must call this out;
  a state row in the Layout-ASCII section, not a verbal
  aside.
- **First gate-walker trial.** The skill is untested against a
  real feature round. Wrong-shape exit criteria in this round
  file could block phase advance even when the phase is done.
  Mitigate: write exit criteria as checkboxes the human can
  tick (per the round-doc-flip-checkboxes feedback rule), and
  treat any spurious block as a `gate-walker` bug to log in
  Act.

## Do

### Design (D)

Authored [`advanced-query.md`](../../design/data-management/advanced-query.md)
— MVP `key:value AND/OR` grammar (single-level DNF, AND binds
tighter than OR), operator-prefix→predicate-vocabulary mapping
table (maps onto the **existing** R37 vocabulary; no new operator),
input state model, four layout states (idle/parsed/errored/
composition), the `aq` transport intent, and 17 numbered testable
acceptance criteria. Cross-links
[`dataset-filters.md`](../../design/data-management/dataset-filters.md)
and [`dataset-detail.md`](../../design/data-management/dataset-detail.md).

Key Design decisions locked:

- **Precedence**: `AND` binds tighter than `OR` → every MVP query
  is DNF (`OR` of `AND`-groups) → parser emits `FilterPredicate[][]`
  directly. (Risks § "parser grammar ambiguity" resolved.)
- **No new predicate operator**: the grammar maps only onto R37's
  existing vocabulary. Inclusive date bounds (`won_at:>=…`) and
  string `!=` have **no existing op** and are rejected with a
  clear message + recorded as a follow-up vocabulary-expansion
  pull (would touch the shared chip system — out of this round's
  scope). The round-framing example `won_at:>=2026-01-01` is
  realized as `won_at:>2025-12-31`. (Risks § "predicate-shape
  drift" pre-empted — the parser cannot emit a shape the BE
  evaluator doesn't already accept.)
- **Composition UX**: advanced input + chip row + `?q=` render as
  three independent stacked boxes, AND-composed server-side;
  advanced never silently "wins". (Risks § "chip + advanced
  composition UX" resolved with a layout-ASCII composition state,
  not a verbal aside.)
- **Transport (design intent, Contract formalizes)**: a single
  additive `aq` query param carrying URL-encoded JSON of the DNF;
  the flat `f<N>_*` shape structurally cannot carry OR.

**Design gate closed**: user journeys (4 layout states + Mermaid
lifecycle + state-model table) and 17 testable acceptance criteria
documented in
[`advanced-query.md` § Acceptance criteria](../../design/data-management/advanced-query.md#acceptance-criteria-design-gate-exit).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                                                                                                     |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | yes    | The input state model has 4 states (Empty, Typing, Parsed, Errored); the Mermaid lifecycle shows Typing branching to both Parsed and Errored — 4 > 3.                                             |
| 2. New interaction pattern           | yes    | No existing product surface parses a typed expression grammar with operator precedence and emits token-positional parse errors; the R36 `?q=` input is a flat substring search with zero parsing. |
| 3. High user-error risk              | no     | Read-only row filtering — no destructive or irreversible action; an unparseable query surfaces an inline error and leaves the last-applied query governing the table.                             |
| 4. Contract depends on unresolved UI | no     | The design decouples grammar (pure FE concern) from transport (DNF of the existing `FilterPredicate` JSON); the `aq` schema is fully writable now and does not move with input-UX decisions.      |
| 5. UX confidence below threshold     | no     | The design resolved the load-bearing UX questions (error model, three-box composition, commit-on-valid-only) with stock-pattern grounding (GitHub/JQL/Gmail) and reasonable defaults.             |

Result: **Flow: DFCFBI (triggers 1, 2)**

This is the **first DFCFBI selection in the repo** — the round
chain reorders to **D → F1 → C → F2 → B → I**. The F1 timebox
(≤2 working days, one FE author, no contract-shape changes during
F1, output = locked UX acceptance criteria only) applies per
[R47 § F1 timebox](../../decisions/2026-05-28-hybrid-flow-governance.md).
F1 here = build the pure parser + `AdvancedQueryInput` against the
mock dataset to lock the error-display and commit-on-valid UX;
contract questions discovered in F1 are logged as input to C, not
resolved in F1.

### F1 (frontend discovery — timeboxed)

Built the load-bearing surfaces against the mock dataset
(`MOCK_DATASET.columns`), one FE author, no contract-shape changes:

- [`advanced-query/parser.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/parser.ts)
  — pure `parseAdvancedQuery(text, columns)` → DNF or positioned
  error. Tokenizer (quote-aware), AND-tighter-than-OR grouping,
  per-dtype atom builders mapping onto the **existing** vocabulary.
- [`advanced-query/serialize.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/serialize.ts)
  — `groupsToParam` (JSON for `?aq=` + cache key), `groupsFromParam`
  (validated decode, malformed → `[]`), `groupsToText` (canonical
  re-serialization for URL→input repopulation).
- [`advanced-query/AdvancedQueryInput.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/AdvancedQueryInput.tsx)
  — URL-agnostic input; empty/typing/parsed/errored states;
  debounce 300 ms + Enter; **apply-on-valid only**.
- i18n `datasets.advancedQuery.*` (en + vi).
- [`tests/advanced-query-parser.test.ts`](../../../workspace/apps/builder/tests/advanced-query-parser.test.ts)
  — **30 tests pass** (acceptance criteria 1–7 + serialize
  round-trip). `tsc --noEmit` clean.

**Interaction decisions frozen** (F1 gate criterion):

- Commit model: debounce 300 ms + immediate on Enter; valid parse
  writes `?aq=`, errored parse leaves the last-applied query and
  the table untouched (never blank results mid-edit).
- Empty input clears `?aq=`. Success readback shows `N groups · M
predicates` so the user can confirm precedence parsed as
  intended.
- Operator surface = the existing R37 predicate vocabulary only.

**Open UX questions explicitly deferred** (F1 gate criterion):

- Token-level red underline on the offending substring → deferred
  (needs a rich-text input; MVP uses error border + 1-based
  positional message). Logged in
  [`advanced-query.md` § Out of scope](../../design/data-management/advanced-query.md#readwrite-boundary).
- Autocomplete / type-ahead → deferred (same rich-editor
  dependency).

**Contract question surfaced by F1 (input to phase C, not resolved
here)**: the parser emits the existing `FilterPredicate` atoms, but
the OR-of-AND structure has **no carrier** in the flat `f<N>_*`
param shape — phase C must add a transport. F1 introduced **no**
contract-shape change (per R47 F1 output constraint).

**F1 timebox**: completed in one session — well under the ≤2
working-day hard cap. No overrun; no re-cut needed.

**F1 gate closed**: interaction decisions frozen + open UX
questions deferred, evidenced by the locked UX above and the 30
passing parser tests (`tsc` clean).

### Contract (C)

**Decision**: the existing `f<N>_*` encoded-params shape **cannot**
carry AND/OR — it is keyed by column index, one predicate per
column, AND-only, so OR (and a second predicate on one column) is
structurally inexpressible. Resolved by an **additive `aq` query
param** (not an extension of `f<N>_*`, not the parked `POST
:search`): a single URL-encoded JSON value carrying the DNF
(`FilterPredicate[][]`) — the same atoms `f<N>_*` serializes,
wrapped in OR-of-AND. Additive ⇒ every existing rows-GET request
is unchanged ⇒ no regression.

- [`rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml)
  — added the `aq` param (shape + composition + grammar-is-FE
  note), two `aq` 200 examples (`filtered_advanced_or`,
  `filtered_advanced_compose_all`), and the 422 cases
  (`advanced_query_malformed` + per-atom `filter_*` reuse with
  `loc=["query","aq"]`).
- [`rows-get.contract.md`](../../../workspace/packages/contracts/datasets/rows-get.contract.md)
  — new § "Advanced query via `aq` param (R51)" with the
  why-not-`f<N>_*` / why-JSON / why-GET / atom-shape / composition
  / errors rationale + worked examples; cross-link added.
- MSW handler
  ([`handlers.ts`](../../../workspace/apps/builder/src/mocks/handlers.ts))
  aligned: `parseAq` (malformed → 422 `advanced_query_malformed`;
  bad atom → reused `filter_*` with `loc=["query","aq"]`),
  `rowMatchesAq` (OR-of-AND), composed into `applyFiltersAndQ` as
  `chips AND aq AND q`.

**Contract gate closed**: request/response/error shapes frozen
(YAML committed, valid OpenAPI 3.1 — the FE contract-validator
dereferences + compiles it on load), MSW handler aligned, and the
200 response schema is **unchanged** so the validator stays green
end-to-end. Evidence: `tsc --noEmit` clean; the `contract-validator`
and `dataset-detail` suites green (32 tests) with the YAML loaded.

### F2 (frontend confirmation)

Wired the F1 surfaces into the page against the contract-derived
MSW (the canonical UX SoT per R47 O-rule):

- [`useAdvancedQueryState`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/useAdvancedQueryState.ts)
  — URL `?aq=` ↔ DNF + canonical text (peer to `useFiltersState`).
- [`datasetsApi.getRows(..., advanced?)`](../../../workspace/apps/builder/src/api/datasetsApi.ts)
  and the [`useDatasetRowsQuery`](../../../workspace/apps/builder/src/features/data-management/datasets/hooks.ts)
  cache key both gain the `aq` JSON.
- [`DatasetDetailPage`](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetDetailPage.tsx)
  — `AdvancedQueryInput` placed between the search bar and the chip
  row (the three-box stacked composition from the design).
- **UX fix found in F2 confirmation**: the value-sync effect was
  wiping the success readback on our own apply. Refactored the
  component so display state (hint/summary/error) is a **pure
  function of the buffer** (`useMemo`), decoupled from commit — no
  flash. This is exactly the kind of run-it-against-MSW discovery
  F2 exists to catch.
- [`tests/advanced-query.test.tsx`](../../../workspace/apps/builder/tests/advanced-query.test.tsx)
  — **6 tests pass**: empty state, deep-link apply + canonical
  repopulation + readback (criteria 8–9), OR-across-same-column
  via MSW, typing+Enter apply, invalid→error-no-apply (criterion
  10), clear→restore (criterion 11).

**No shape change surfaced** → no contract v2 needed; the parser
emits the exact `FilterPredicate` atoms the Contract froze.

**Full FE suite: 101 pass** (65 pre-round baseline + 30 parser +
6 component) — zero regression. `tsc --noEmit` clean.

**F2 gate closed**: confirmation pass complete against the
contract-derived MSW (101 FE tests green); no shape change to
re-route as contract v2.

### Backend (B)

The Contract added the `aq` param ⇒ the BE is **not** a no-op. But
the predicate vocabulary is unchanged, so the change is contained:

- [`filters.py`](../../../workspace/apps/backend/app/ingest/filters.py)
  — `parse_advanced_from_query` (decode `aq` JSON → DNF groups,
  reusing `OPS_BY_DTYPE` + `_parse_value`; errors carry
  `loc=["query","aq"]`) and `build_advanced_sql` (OR-of-AND,
  reusing `build_filter_sql` per group). `_parse_value` gained an
  explicit `loc` so the same parser serves both `f<N>_*` and `aq`.
- [`rows_reader.py`](../../../workspace/apps/backend/app/ingest/rows_reader.py)
  — composes `chips AND aq AND q` (param order matches fragment
  order).
- [`datasets.py`](../../../workspace/apps/backend/app/routers/datasets.py)
  — handler parses `aq` and passes `advanced=` through.
- [`tests/test_datasets_rows_get.py`](../../../workspace/apps/backend/tests/test_datasets_rows_get.py)
  — **12 new tests**: AND-within-group, OR-across-groups (the
  capability `f<N>_*` can't express), single-group↔chip parity,
  three-way chip∧aq∧q compose, `aq=[]` no-op, malformed/non-array
  → `advanced_query_malformed`, bad-atom op/col/value → reused
  `filter_*` codes with `loc=["query","aq"]`, plus `build_advanced_sql`
  SQL-shape units.

**Backend gate closed**: contract-conformance (`validate_response`
against the rows-get YAML) + per-endpoint behavior tests pass.
**Full BE suite: 131 pass** (119 pre-round baseline + 12 new) —
zero regression. `ruff check` + `ruff format` clean.

### Integration (I)

Three-way composition (`chip ∧ advanced(OR-of-AND) ∧ q`) verified
on **both** sides of the contract:

- **FE end-to-end** (criterion 17):
  [`tests/advanced-query.test.tsx`](../../../workspace/apps/builder/tests/advanced-query.test.tsx)
  deep-links `?f1_op=gt&f1_val=10000&q=24500&aq=[[stage:won],[stage:lost]]`
  → intersects to D-0005 only; asserts all three surfaces render
  independently (advanced box `stage:won OR stage:lost`, `?q=` box
  `24500`, chip `amount > 10,000`) — no surface silently "wins",
  no UI thrash. Counter `Matched 1 / 8`.
- **BE end-to-end**:
  [`test_aq_composes_with_chip_and_q_three_way`](../../../workspace/apps/backend/tests/test_datasets_rows_get.py)
  exercises the same composition server-side (`f2>50 ∧ aq(Alice OR
Carol) ∧ q=carol → Carol`).
- **Shared conformance**: both sides validate against the **same**
  [`rows-get.contract.yaml`](../../../workspace/packages/contracts/datasets/rows-get.contract.yaml)
  — MSW via `withContractValidation`, BE via `validate_response`.
  The O-rule's three truths stay aligned (FE-on-MSW UX, contract
  YAML, shared conformance) with no drift.

**Integration gate closed**: FE-vs-BE verified end-to-end; shared
conformance green against both MSW (FE 102 pass) and the real
backend (BE 131 pass).

## Check

End-of-round verification:

- **Every Plan checkbox ticked** — Design, Contract, Frontend
  (F1+F2), Backend, Integration, Post-round audit.
- **Every gate documented as closed** — Design, F1, Contract, F2,
  Backend, Integration each have a `**<Gate> gate closed**` line
  with a citable evidence pointer in the Do log (gate-walker
  structural check satisfied for all six).
- **Tests green, no regression**:
  - FE **102 pass** (pre-round baseline 65 + 30 parser + 6
    component + 1 integration).
  - BE **131 pass** (pre-round baseline 119 + 12 advanced-query).
  - `tsc --noEmit` clean; `ruff check` + `ruff format` clean.
- **Audit pipeline clean** — `markdownlint-cli2` clean on
  `advanced-query.md` and `rows-get.contract.md`;
  `markdown-check-link` reports zero broken links across the three
  touched docs (it caught one real broken anchor —
  `#surfaces--layer…` doubled-hyphen vs the checker's
  hyphen-collapsing slug — now fixed). The only residual
  markdownlint notes were MD049 underscore-emphasis in the Check/
  Act template placeholders, removed by filling those sections.
- **No spurious gate-walker blocks** — the skill returned
  Gate-closed on every well-formed gate; no false block to log as
  a bug (Risks § "first gate-walker trial" cleared).
- **All four R51 risks resolved** — precedence committed (AND ＞
  OR, DNF); predicate-shape drift pre-empted (parser cannot emit a
  shape the BE evaluator doesn't already accept; verified by the
  single-group↔chip parity test); composition UX shown as three
  stacked boxes (integration test asserts all three render); F1
  timebox respected (no overrun).

## Act

### Doctrine-trial outcomes (R51 = first DFCFBI + first gate-walker + first audit-pipeline `markdown-check-link`)

- **flow-selector** worked cleanly: the **first DFCFBI selection
  in the repo** (triggers 1, 2). The 2-of-5 tally was decidable
  off the design markdown alone, as designed. The genuine
  ambiguity R51 was picked to test was real — conditions 1 (4
  states) and 2 (new typed-grammar pattern) are defensible yeses;
  3/4/5 defensible noes. The grammar/transport decoupling made
  condition 4 a clean "no," which is worth noting: F1's value here
  was UX de-risking, not contract de-risking.
- **gate-walker** verified all six gates with **zero spurious
  blocks** (Risks § 5 cleared). One refinement learned: the
  Design gate must close _before_ flow-selector runs, but
  gate-walker's step-2 requires a `Flow:` line — so the **Design**
  gate is the one gate verified by author-attestation + design-doc
  evidence prior to the Flow line existing. The sequence
  D-close → flow-selector → gate-walker(rest) is correct; worth a
  one-line note in the gate-walker SKILL if it recurs.
- **markdown-check-link** earned its keep: it caught a **real
  broken anchor** (`#surfaces--layer…` — my GitHub-style
  double-hyphen vs the checker's hyphen-collapsing slug). Without
  it the rot would have shipped. Note for authors: this checker
  **collapses `-+` → `-`**, so multi-punctuation headings get
  single-hyphen anchors.

### Skill-pull trigger assessment (R49 deferred list)

- **`f1-timeboxer`** — F1 _fired_ (DFCFBI) but did **not** overrun
  (one session, well under the ≤2-day cap). Trigger is "F1 fires
  **+** overruns" → **not pulled**. First clean F1 data point;
  pull only when a real overrun appears.
- **`o-rule-checker`** — gates passed _and_ the feature did **not**
  break at integration (three-way composition green) → **not
  pulled**.
- **`round-scaffolder`** — **soft pull signal observed**: real
  manual-authoring drag this round (hand-typing the flow-selector
  table, per-checkbox gate annotations, the multi-section Do-log
  boilerplate). Not yet acute enough to pull on its own, but it is
  the strongest Track-2 candidate if the next 1–2 rounds repeat
  the pattern.
- **`contract-v2-router`** — the flat `f<N>_*` shape genuinely
  _could not_ carry OR, but this was resolved with a **planned
  additive `aq` param**, not a contract-v2 re-route (no locked
  contract was amended; the new transport was designed up front).
  → **not pulled**; the "shape can't carry cleanly" language was
  exercised but the additive path absorbed it.

### Carry-forwards / follow-up product pulls

- **Predicate-vocabulary expansion** (own round): inclusive date
  bounds (`won_at:>=`/`<=` → `on_or_after`/`on_or_before`) and
  string `!=` (`ne` for strings). These are the documented MVP
  gaps; closing them is cross-cutting (FE types, BE `OPS_BY_DTYPE`,
  MSW, the chip date editor, dataset-filters.md) so it is
  deliberately _not_ folded into R51. Pulled by: this round's
  operator-prefix mapping notes ² and ³.
- **Grammar v2** (own round, would supersede the MVP doc per its
  Lifecycle): parentheses + negation. Pull when the flat single-
  level DNF surfaces real user ambiguity.
- **Autocomplete / token-underline / saved queries** — deferred
  per the design's Out-of-scope; each its own round when pulled.

### End-of-round Q&A

A two-step decision came out of the close:

1. **First Q&A pick** (next _feature_): **close the MVP query
   gaps** (Track-1, predicate-vocabulary expansion).
2. **Brainstorm re-prioritization**: reviewing R51's _shipped_ UI
   surfaced an affordance gap — the advanced-query field renders
   indistinguishable from the `?q=` search box (no visible
   "Advanced query" label) and the clear action is hidden
   (`allowClear` × / backspace), **drifting from R51's own design
   doc**, which specified a labeled box + an explicit `[Clear]`
   button. F2's gate checked _behavior against MSW_, not
   _affordance against the design spec_ — so nothing caught it.
   That pulled a **`ui-design` tooling skill** ahead of the
   feature work (same shape as R49/R50: a tooling round pulled by
   a feature-round lesson, landed before more feature rounds so it
   can be applied going forward).

**Resulting order**:

- **R52 → `ui-design` skill** (Track-2). _Pulled by: R51's
  advanced-query field shipping label-less + hidden-clear and
  drifting from its design doc; F2 verified behavior, not
  affordance._ Its first run fixes the R51 field (label +
  `[Clear]`) as a worked example. See
  [`Round_52.md`](Round_52.md).
- **R53 → close MVP query gaps** (Track-1): add the operators R51
  documented as MVP gaps to the **shared** predicate vocabulary so
  chips and advanced query gain them in lockstep —
  inclusive date/datetime bounds (`won_at:>=` / `<=` →
  `on_or_after` / `on_or_before`) and string `ne`. Cross-cutting
  by design (FE
  [`filters/types.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/filters/types.ts)
  `OPS_BY_DTYPE` + the date chip editor, BE
  [`filters.py`](../../../workspace/apps/backend/app/ingest/filters.py)
  `OPS_BY_DTYPE` + `_predicate_sql`, the MSW `cellMatches`, and
  [`dataset-filters.md`](../../design/data-management/dataset-filters.md)'s
  vocabulary table) — which is exactly why R51 kept it out of
  scope. The advanced-query parser's `DATE_OP_BY_PREFIX` /
  string-prefix maps then light up the deferred prefixes
  automatically, and R53 is the first feature round reviewed
  _through_ the R52 `ui-design` skill.

Other candidates (grammar v2 parens/negation, dashboard kickoff)
stay queued; the `round-scaffolder` soft signal carries forward to
watch over the next rounds.

## Feeds into → Round_52 — `ui-design` skill (then R53 query-gaps)

**Selected at R51 close** (see [§ Act → End-of-round Q&A](#end-of-round-qa)):

- **R52 → `ui-design` skill** (Track-2 tooling) — pulled by R51's
  advanced-query field shipping without a label or a discoverable
  clear action, drifting from its design doc; F2 verified
  behavior, not affordance. First run fixes that field.
- **R53 → close MVP query gaps** (Track-1) — inclusive date bounds
  (`on_or_after` / `on_or_before`) + string `ne`, added to the
  **shared** predicate vocabulary; the first feature round
  reviewed through the R52 skill.

R51 is the **first DCFBI/DFCFBI trial**, not the only one. The
other candidates remain queued; the dimensions R51 surfaced (and
the skill-pull triggers each would fire) are kept below:

- **F1 fires + overruns** → `f1-timeboxer` becomes the next
  skill pull (per R49 deferred list).
- **Gate-walker structurally passes but feature breaks at
  Integration** → `o-rule-checker` or a sharpened gate-walker.
- **Round authoring drags** (template re-typing, manual
  Flow-line authoring) → `round-scaffolder`.
- **Contract phase surfaces real shape change** that the
  current `?filter[]=` shape can't carry cleanly →
  `contract-v2-router`.

If R51 ships clean with no skill-pull triggers, R52 is the next
queued product feature (candidates: dashboard kickoff, workspace-
shell target collapse, sort DCBF chain) — selected at R51's
end-of-round Q&A.

## Appending to Complete rounds

**Roadmap update (2026-05-29, during R52 planning)** — the
forward slots above were refined after R51 closed; recorded here
rather than rewritten, per [PDCA § Governance](../PDCA.md)
(Complete rounds are append-only):

- **R53 reslotted** from "close MVP query gaps" to **apply
  `ui-design` — the R51 UI-fix** (visible "Advanced query" label +
  explicit `[Clear]`). Rationale: R52 ships the `ui-design` skill
  (tool); applying it to the R51 field is its own use-the-tool
  round, separating build from use (R49/R50 → R51 pattern).
- **Close MVP query gaps → R54** (was R53), now the first _feature_
  round designed with `ui-design` applied at its Design gate.
- The authoritative forward roadmap lives in
  [`Round_52.md` § Feeds into](Round_52.md#feeds-into-round_53-apply-ui-design-the-r51-ui-fix).
