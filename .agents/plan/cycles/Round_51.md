# Round 51: Advanced query on datasets — first DCFBI/DFCFBI feature trial

**Status**: Planning
**Date started**: 2026-05-29
**Date completed**:

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

> "The next step *after* filters is a typed query language
> (`stage:won AND amount>10000`) — that's a separate concept
> with its own [DCBF] chain."

R51 picks up that deferral under the new chain (DCFBI default;
DFCFBI if flow-selector triggers at Design exit). The pre-existing
design + contract + FE + BE substrate from R37–R40 means the
predicate vocabulary already exists — R51 adds the parser, the
input UI, and the wiring; the BE evaluator stays unchanged if the
parser emits the same predicate shapes.

*Track: 1 (product feature). Pulled by: R37 dataset-filters
design doc's explicit "next step" deferral; R45 end-of-round Q&A
listing Track-1 return-to-product candidates (advanced query
named); user selection in R50 end-of-round Q&A as the strongest
DCFBI-vs-DFCFBI trial candidate (genuine flow-selector ambiguity).
Per [Evolution Rule](../../AGENTS.md).*

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
  *exactly* (no shape drift). Backend gate must verify zero
  regression in chip-filter tests. Integration gate must verify
  chip + advanced compose correctly when both are active.

**Flow**: _TBD — recorded at Design exit per
[`flow-selector`](../../skills/flow-selector/SKILL.md)._

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

- [ ] **Design (D)** — author
      `.agents/design/data-management/advanced-query.md`. Cover
      the MVP grammar, layout placement, error semantics,
      predicate-output mapping. Cross-link
      [`dataset-filters.md`](../../design/data-management/dataset-filters.md),
      [`dataset-detail.md`](../../design/data-management/dataset-detail.md).
      Exit gate: testable acceptance criteria + state-model
      table for the input lifecycle. Run
      [`flow-selector`](../../skills/flow-selector/SKILL.md)
      against this doc; record `Flow:` line in the Do log.
- [ ] **Contract (C)** — decide and document whether the
      existing `?filter[]=` encoded-params shape covers AND/OR
      composition, or whether a new `q_advanced` param /
      `?filter[]=` JSON-body fallback (`POST /datasets/{id}/rows:search`)
      carries the boolean structure. Update the relevant
      `*.contract.{yaml,md}` pair; validator stays green.
      Exit gate: contract document signed, validator passes
      end-to-end.
- [ ] **Frontend (F or F1+F2)** — build the input component +
      pure parser module + error display + integration on
      the dataset detail page. The parser is the load-bearing
      unit; unit-test it independently before wiring into the
      component. Exit gate: parser tests pass, component test
      covers the empty/typing/parsed/errored states, MSW
      handler returns expected predicate set for a fixture
      query.
- [ ] **Backend (B)** — if Contract added a param shape,
      extend the BE handler to accept it. If the parser emits
      the same shape the chip filters already use, this phase
      is a no-op confirmation only. Exit gate: BE tests green;
      54+ tests still pass; one new test exercises the
      AND/OR combination if a shape changed.
- [ ] **Integration (I)** — verify chip filters + advanced
      query compose correctly when both are set; verify
      `?q=` substring search composes correctly with both;
      verify the dataset-detail page handles all three
      simultaneously without UI thrash. Exit gate: one
      integration test covers the three-way composition.
- [ ] **Post-round audit** — run `markdownlint-cli2` and
      [`markdown-check-link`](../../skills/markdown-check-link/SKILL.md)
      across the round's touched docs. Triage any findings;
      apply safe candidates via `--fix` (gated at Review per
      R50 quality bar).

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

_Filled during execution. Record `Flow:` line at Design exit
(flow-selector output). Tick the Plan checkboxes as each phase
gate closes (gate-walker confirms exit criterion documented as
met)._

## Check

_End-of-round verification: every Plan checkbox ticked, every
gate documented as closed, audit pipeline clean, no spurious
gate-walker blocks unlogged._

## Act

_Carry-forwards, follow-up pulls (concrete skill pulls per R49's
deferred list — `f1-timeboxer`, `o-rule-checker`,
`round-scaffolder`, `contract-v2-router` — based on which
triggers fire in this round), end-of-round Q&A notes._

## Feeds into → Round_52 (TBD)

R51 is the **first trial**, not the only one. R52 is shaped by
what R51 surfaces:

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
