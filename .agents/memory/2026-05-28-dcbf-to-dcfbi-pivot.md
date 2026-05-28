# DCBF → DCFBI/DFCFBI — S-curve break-point in design-delivery methodology

**Date**: 2026-05-28
**Agent**: Claude Code
**Confidence**: High
**Status**: New

## Problem

Project methodology evolves through discrete inflection points
("break-points" in S-curve development theory: slow start → rapid
growth → plateau → break to next curve). These shifts often go
unmarked in memory — only the *outcome* lands as a new decision
or context file, while the *transition itself* becomes invisible
in retrospect. Without a captured break-point, future agents see
"DCBF was operational, then suddenly DCFBI was operational" with
no traceable pull explaining *why* the shift happened — which
makes the next break-point harder to recognize when it arrives.

## Finding

2026-05-28 is a **break-point**: the DCBF chain (Design → Contract
→ Backend → Frontend, validated R14→R21, codified in
[`context/contract-driven-feature.md`](../context/_archive/contract-driven-feature.md))
is superseded by the **DCFBI/DFCFBI hybrid flow** codified in
[`decisions/2026-05-28-hybrid-flow-governance.md`](../decisions/2026-05-28-hybrid-flow-governance.md).

**Previous S-curve (DCBF)**:

- Plateaued: shipped clean features but yielded fair-only results
  for over-effort (per 2026-05-28 MEMO-FINDINGS scan of
  [.agents/design/](../design/)).
- Plateau root cause: D-phase overwhelmed as design-corpus scope
  grew; hand-rolled HTML-preview workflow introduced a **parallel
  UX SoT** (`.preview.html` mockups vs. FE code) that became the
  #1 critical drift risk (token drift).

**New S-curve (DCFBI/DFCFBI)**:

- **Conceptual shift**: F (in DCFBI) or F1 (in DFCFBI) running
  against MSW *is* the canonical UX preview. Design markdown is
  the *spec*, not a parallel artifact. The two UX SoTs of the old
  curve collapse to one.
- **Procedural shift**: 2-of-5 flow selector picks default DCFBI
  vs. conditional DFCFBI; hard gates per phase; O-rule as
  cross-cutting invariant (UX, data behavior, execution — each
  one source, traceability explicit).

## Evidence

- 2026-05-28 brainstorm chain at
  [`plan/brainstorms/2026-05-28-hybrid-flow/`](../plan/brainstorms/2026-05-28-hybrid-flow/)
  (MEMO-FINDINGS, TOOLING-ANALYSIS, TOOLING-QUICK-START,
  FINAL-RECOMMENDATION).
- R47 decision artifact:
  [`decisions/2026-05-28-hybrid-flow-governance.md`](../decisions/2026-05-28-hybrid-flow-governance.md).
- R46 commit `c05a292` — brainstorm-housing convention
  establishing the durable analysis trail for this break-point.
- AGENTS.md horizons bullet added under R47, making the new flow
  discoverable at session load.
- promotions.md 2026-05-28 entries (R46 brainstorm-housing + R47
  governance).

## Recommendation

**Do**:

- **Mark break-points in memory explicitly.** When a new
  decision/methodology supersedes an old one, write a dated
  memory entry tagging the inflection. The memory tree already
  has a timeline shape (dated filenames); break-point entries
  let future readers reconstruct the *evolution*, not just the
  current state.
- **Identify the corpus that operationalized the old curve.**
  When a methodology break happens, audit all "official" docs
  that depend on the old shape — context files, design corpus,
  memory entries authored under the old methodology — and
  triage each one's fate (update / deprecate / preserve as
  historical). Failure mode: shiny new doctrine + corpus full
  of stale references that contradict it.
- **Use S-curve framing for retrospective context.** Not every
  methodology change is a break-point; some are extensions or
  refinements of the same curve. Break-points specifically:
  *the conceptual shape of the work changes* (here: 2 UX SoTs
  → 1 UX SoT), not just the steps.
- **Cite the break-point memory from rounds that operate post-
  shift.** R48 onward should cite this entry in their `Pulled
  by:` lines to make the lineage visible at-a-glance.

**Don't**:

- **Don't treat methodology shifts as "just add a new file."**
  R47 codified the new flow, but R48's archive-segregation of
  fully-superseded artifacts is the actual operational
  transition. Skipping archive means future rounds run in
  contradictory state (new doctrine in `decisions/` + old
  artifacts still in the live tree that contradict it). Content
  rewrites of partially-superseded survivors come later — they
  benefit from concrete DCFBI experience.
- **Don't bury the conceptual shift inside procedural changes.**
  First-draft R47 framed DCFBI primarily as "add F1 when
  uncertainty is high" — true but mechanism-only. The conceptual
  shift (FE = preview = 1 SoT) is the *why*; the procedural
  change is the *how*. User surfaced this mismatch during R47
  Review; captured in R47 Act learning.
- **Don't extend a plateau-stage curve indefinitely.** DCBF's
  fair-only-for-over-effort result was the plateau signal. The
  pull to a new curve is the right response, not "DCBF harder."

## Supersession triage candidates (R48)

R48's scope is **supersession analysis + archive only** (narrowed
further post-Review per "work carefully at the break-point"). For
each artifact, R48 classifies:

- **Fully superseded** → archive to `_archive/` (move only, no
  content edit).
- **Partially superseded** → leave in place; rewrite deferred to a
  later round.
- **Not superseded** → leave; no edit.

Candidate set:

- `design/**/*.preview.html` files (6, all under
  `data-management/`) — likely *fully superseded* (FE-as-preview
  means no separate HTML preview carries SoT). Archive.
- Preview-shell infrastructure (`design/index.html`,
  `design/_js/preview-shell.js`, `design/_css/preview-shell.css`,
  `design/_css/tokens.css`, any `*.target.md`) — auxiliary to the
  previews; R48 triage classifies alongside them. Likely *fully
  superseded* unless cited by surviving specs or live FE.
- [`design/README.md`](../design/README.md),
  `design/*.md` spec files — likely *partially superseded*
  (preview-as-artifact framing displaced; journeys, state notes,
  and acceptance criteria still valid). Leave in place; rewrite
  deferred.
- [`context/contract-driven-feature.md`](../context/_archive/contract-driven-feature.md)
  — DCBF context file (promoted from R14→R21). Likely *partially
  superseded* (contract-discipline content holds under DCFBI's
  unchanged C phase; chain-shape framing displaced). Leave in
  place; rewrite deferred.
- DCBF-era memory files (classification only, no Status edits):
  [2026-05-24-contract-round-methodology.md](2026-05-24-contract-round-methodology.md),
  [2026-05-24-be-round-conformance-pattern.md](2026-05-24-be-round-conformance-pattern.md),
  [2026-05-24-fe-round-typecheck-pattern.md](2026-05-24-fe-round-typecheck-pattern.md),
  [2026-05-24-design-first-reframe-absorption.md](2026-05-24-design-first-reframe-absorption.md).
  Most are likely *not superseded* (Contract / BE / FE
  conformance lessons hold within DCFBI's unchanged phases).

## Promotion Candidate?

- [ ] `context/` — Stable pattern, broadly applicable
- [ ] `skills/` — Reusable procedure/checklist
- [x] Not yet — Needs more validation. Single instance (this
      break-point); promotion to `context/` would require ≥3
      recognized break-points captured well. Revisit when the
      next break-point arrives.

---

> Captured during: [Round_47](../plan/cycles/Round_47.md)
> post-Review (third amendment, following the FE-as-preview
> clarification and the R48 audit→reconciliation reframe; further
> narrowed to archive-only in amendment 5).
> Pulled by: 2026-05-28 user observation — *"this is a break-point
> / growth-point (S-curve development theory). Thus, in the memory
> we have to capture this 'point' (as timeline already there) to
> see the evolution (pulls in)."*
