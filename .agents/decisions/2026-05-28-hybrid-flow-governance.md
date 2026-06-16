---
# ─── Identity ─────────────────────────────────────────────────────
decided: 2026-05-28
source-round: conv:2026-05-28

# ─── Classification ───────────────────────────────────────────────
track: 2
status: active

# ─── Substance ────────────────────────────────────────────────────
applies-when: a design-and-delivery cycle starts for any product feature in this repo
failure-mode: contract locks bad UX assumptions early (pure contract-first), OR late API churn from open-ended frontend discovery (pure frontend-first), OR "one source of truth" rhetoric without traceability between artifacts

# ─── Lifecycle ────────────────────────────────────────────────────
revisit-trigger: after first complete DFCFBI run (selector triggered, F1 timebox tested); OR R48 supersession analysis surfaces an artifact category this doctrine did not anticipate (a fourth truth not captured by the O-rule, or a doctrine-displacement R47 did not predict); OR an F1 round overruns the <=2-day timebox by >50%
promoted-to: null
---

# Decision: Hybrid design-and-delivery flow — DCFBI default, DFCFBI conditional, O-rule cross-cutting

**Commitment**: Every feature round in this repo follows one of two phase chains.
The **default** is **DCFBI** — **D**esign → **C**ontract → **F**rontend → **B**ackend → **I**ntegration.
When a 2-of-5 flow-selector trigger fires, the chain becomes **DFCFBI** — Design → **F1** (frontend discovery, timeboxed) → Contract → **F2** (frontend confirmation) → Backend → Integration.
The **O-rule** (one source of truth, three truths cross-cutting: UX, data behavior, execution) applies at every gate, not as a terminal phase.
**F1 timebox** is hard: ≤2 working days, one FE author, no contract-shape changes during F1, no silent overrun.
The **FE running against MSW** (the F or F1 output) is the single source of truth for UX; design markdown is its spec, not a parallel artifact.

## Why

The DCBF chain (`../context/_archive/contract-driven-feature.md`, validated R14→R21) shipped clean features but yielded **fair-only results for over-effort**, and the **D-phase became overwhelmed**
as design-corpus scope grew (6 issues, 2 critical, flagged in the
2026-05-28 MEMO-FINDINGS scan of [.agents/design/](../design/)).
The 2026-05-28 brainstorm chain at [`plan/brainstorms/2026-05-28-hybrid-flow/`](../plan/brainstorms/2026-05-28-hybrid-flow/)
analysed three tensions:

1. **Process worked but had blockers** — token drift + undefined
   fidelity sign-off (per [MEMO-FINDINGS](../plan/brainstorms/2026-05-28-hybrid-flow/MEMO-FINDINGS-2026-05-28.md)).
2. **Pure single-direction flows trade off** — contract-first locks
   poor UX too early; frontend-first creates late API churn.
3. **MSW maturity now supports a two-stage frontend role** —
   discovery before contract freeze when needed, confirmation
   after contract freeze always (per [TOOLING-ANALYSIS](../plan/brainstorms/2026-05-28-hybrid-flow/TOOLING-ANALYSIS-2026-05-28.md)).

[`FINAL-RECOMMENDATION-2026-05-28.md`](../plan/brainstorms/2026-05-28-hybrid-flow/FINAL-RECOMMENDATION-2026-05-28.md) synthesized the hybrid response that this decision codifies.

Beyond those three tensions, the operating-model shift carries a
**single-source-of-truth consolidation for UX**: under DCBF, the
design phase produced HTML previews in
[`.agents/design/*.preview.html`](../design/) — a _parallel_
implementation of "what the UI looks like," separate from the
actual FE code in
[`workspace/apps/builder/`](../../workspace/apps/builder/). Two
parallel UX implementations is exactly the shape MEMO-FINDINGS
flagged as token drift (#1 critical issue). **DCFBI eliminates the
split**: the F phase (in DCFBI) or F1 (in DFCFBI) running against
MSW _is_ the canonical UX preview. Design markdown remains the
_spec_ (journeys, state notes, acceptance criteria); the FE code
is the single source of truth for what the UI actually does. This
is the central conceptual shift from DCBF, not just "add a
discovery phase."

## What this allows

- **DCFBI without F1 ceremony** for low-to-medium-uncertainty
  features — the default path stays fast.
- **DFCFBI with F1** when the 2-of-5 selector fires — bounded
  discovery before contract freeze.
- **Per-test handler overrides at gates**, provided the override
  and its exit are logged in the round's Do/Check; gates verify
  state, not absence of exceptions.
- **Contract v2 process** when F2 surfaces real shape questions —
  log the new shape as `contract v2`, re-freeze the gate, do not
  silently amend the locked contract.
- **Markdown-only Design artifacts** (Mermaid, ASCII, state notes,
  acceptance criteria). The FE running against MSW (F or F1
  output) is the canonical UX preview — **no separate HTML
  preview artifact carries SoT** under this flow. Quick HTML
  sketches _informing_ the F1 author remain allowable as
  pre-round exploration but are not authoritative outputs of any
  phase. Existing
  [`.agents/design/**/*.preview.html`](../design/) files (and the
  preview-shell infrastructure they depend on: `design/index.html`,
  `design/_js/`, `design/_css/`, `*.target.md`) are historical
  scratch from DCBF rounds; the R48 archive round decides their
  archive status (move to `_archive/` if fully superseded; no
  content edits).

## What this forbids

- **Adding a feature round without a Flow Selector check.** Round
  authors run the 2-of-5 check immediately after Design exit and
  record the result in the round file.
- **Running F1 longer than 2 working days.** Hard timebox; overrun
  forces re-cut (drop to DCFBI with documented UX risk, or split
  the feature into smaller rounds).
- **Contract-shape changes during F1.** F1 output is UX acceptance
  criteria only; contract questions surface as input to phase C,
  not as F1 output.
- **Treating "one source of truth" as a phase.** O is a
  cross-cutting invariant — every phase respects it, no phase
  closes it.
- **Silent extension of F1.** If F1 needs more time, the round
  pauses and the user is consulted before scope re-cut.
- **Bundling the whole D→C→F→B→I chain into one uncommitted
  changeset.** Each gate commits (see § Hard gates). Reaching
  Integration with nothing committed leaves no revert seam — an
  altitude/modeling error then contaminates all layers with nothing
  to roll back to (the R69 failure).

## Trade-off accepted

- **Slower for high-uncertainty work.** DFCFBI adds 1-2 days for
  F1 + the F2 confirmation pass. Worth it when UX risk is real;
  wasteful when it isn't — hence the selector gate.
- **More ceremony at gates.** The Hard Gates table below is not
  optional. Gates that everyone passes silently become theater;
  gates that block real work catch real drift. We accept the
  ceremony cost for the drift-catching benefit.
- **Two-flow cognitive load.** Engineers must learn the selector
  and which gates apply to which path. Mitigated by short selector
  (5 conditions, 2-of-5 trigger) and by making DCFBI the default
  most rounds use.
- **The F1 timebox is a guess** — 2 working days is the
  best-current-estimate from R26/R29 prototype patterns, not
  validated. `revisit-trigger` captures the case where it's wrong.

## Flow selector (2-of-5)

Run this check **immediately after Design exit**, before declaring
the round's phase chain. Enable F1 (use **DFCFBI**) if **any 2** of
the following are true:

1. **More than 3 independent interactive states or branches** in
   the design artifact. Count branches in the design markdown's
   state model — not button variants, not visual states.
2. **New interaction pattern not previously used in product.**
   Compare against existing
   [.agents/design/](../design/) artifacts; if the pattern is
   genuinely new (not "new screen, same pattern"), this condition
   triggers.
3. **High user-error risk if flow is unclear** — destructive
   actions, irreversible commits, multi-step wizards where
   misstep cost is high.
4. **Contract shape depends on unresolved UI behavior decisions.**
   If you cannot write the YAML schema without first answering
   "how does the user do X," the contract isn't ready to freeze.
5. **Team confidence in UX is below agreed threshold.** Subjective
   — but if the round author would say "I'm not sure this is the
   right UX," that counts.

If fewer than 2 conditions fire, use **DCFBI**. The result is
recorded in the round's Plan section
(`Flow: DCFBI` or `Flow: DFCFBI (triggers N, M)`).

## Design-model confidence valve (distinct from F1)

The 2-of-5 selector and F1 address **UX-flow** uncertainty — *"am I
sure how the user moves through this?"* They do **not** address
**design-model** uncertainty — *"is this the right noun / model?"*
F1 confirms a flow; it cannot question the model. R69 is the proof: a
coherent-but-wrong model (Query-as-noun, with parallel
`QueriesPage`/`QueryDetailPage` surfaces) passed the Design gate *and*
would have passed any F-phase, because the build faithfully realized
the wrong spec.

So model confidence is a **separate axis** from the selector. When the
round author would say *"I'm not sure this is the right model"* (not
just the flow), the Design phase must de-risk **before** the chain
commits to it:

- **D-only round** — Design is its own round; its gate is "model
  validated," it **commits**, and C→F→B→I follow in a later round. A
  committed design doc is the cheapest revert seam for the most
  expensive class of error (altitude / modeling errors).
- **Discardable spike** — prototype *only* the risky model, throwaway
  by design (**not** the real chain), validate, then design with
  evidence. The spike must be cheap to throw away — unlike R69, whose
  "spike" was the entire real chain.
- **Noun-vs-mode gate question** — at the Design gate, ask explicitly
  *"new noun, or a mode of an existing surface?"* Default to
  mode/reuse; a new noun must justify itself against an existing one.
- **Discovered-vs-imposed test** — *"what evidence for this model did I
  find vs. generate by adopting it?"* Self-made evidence (a surface you
  created) is circular; treat the model as unproven. See
  [specious-model-lock-in](../memory/2026-06-13-specious-model-lock-in.md).

## Hard gates (non-negotiable)

Every phase exits through a named gate. The round cannot proceed
to the next phase until the gate's exit criterion is documented as
met in the round file. Gates apply uniformly to both DCFBI and
DFCFBI; F1 / F2 gates are skipped on the DCFBI path.

| Gate                   | Exit criterion                                                                                     | Who closes it |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------- |
| **Design**             | User journeys + testable acceptance criteria documented in the design artifact                     | Round author  |
| **F1** _(DFCFBI only)_ | Interaction decisions frozen for this round; open UX questions resolved or explicitly deferred     | Round author  |
| **Contract**           | Request / response / error shapes frozen; MSW handlers aligned; YAML committed                     | Round author  |
| **F2** _(DFCFBI only)_ | Confirmation pass complete against contract-derived MSW; any shape change re-routed as contract v2 | Round author  |
| **Backend**            | Contract conformance tests pass; per-endpoint behavior tests pass                                  | Round author  |
| **Integration**        | FE-vs-BE verified end-to-end; shared conformance tests pass against both MSW and real backend      | Round author  |

**No-UI / refactor rounds.** A feature round that changes the contract /
backend / data layer but introduces **no new UI surface** (e.g. a wire-field
rename, a persistence refactor) has no "user journeys." For such a round the
Design criterion's journeys clause is **N/A**; substitute the **resolved
design judgment calls + testable acceptance criteria** documented in the round
file. The flow-selector's five conditions are all UX-framed, so they read
vacuously **no** → such a round lands **DCFBI** by construction (still run and
record the selector — the audit trail is the point).

**Each gate is a commit boundary (revert seam).** When a gate's exit
criterion is met, the round **commits** before the next phase opens. A
gate is therefore not only a checkpoint *documented* in the round file
— it is a point in git history you can revert to. This restores the
per-phase revert seam the DCBF 4-round shape had for free
([contract-round-methodology](../memory/2026-05-24-contract-round-methodology.md):
`phase = round = commit`) and which collapsing the chain into one
DCFBI round silently dropped. A round that reaches Integration with
**nothing committed** has no seam: a single altitude error then forces
discarding all layers (the R69 failure). See § Amendment 2026-06-13.

## The O-rule (three truths, cross-cutting)

"One source of truth" is **not** a phase. It is an invariant the
round respects at every gate, expressed as **three truths** with
explicit traceability between them:

1. **UX truth** — the **FE running against MSW** (the F or F1
   output). Lives in
   [`workspace/apps/builder/`](../../workspace/apps/builder/),
   exercised by the MSW handler set established in
   [MSW contract-anchor](2026-05-27-msw-contract-anchor.md). The
   design markdown in [.agents/design/](../design/) is the _spec_
   that the FE implements (journeys, state notes, acceptance
   criteria) — **the FE itself is the lived SoT**. No separate
   HTML preview artifact competes for this role under DCFBI/DFCFBI.
2. **Data-behavior truth** — the **contract artifact**
   (request/response schemas, examples, errors). Lives in
   [`workspace/packages/contracts/`](../../workspace/packages/contracts/).
3. **Execution truth** — the **shared conformance tests** that run
   against both MSW (FE side) and the real backend (BE side).
   Lives alongside the contract; enforced by the validator chain
   established in
   [MSW contract-anchor](2026-05-27-msw-contract-anchor.md).

The invariant: **each truth has exactly one source**, and
**traceability between truths is explicit** (the FE implements the
design markdown's acceptance criteria; the contract cites the
same; the conformance tests cite the contract's operationIds). If
two artifacts would each need to change to keep behavior
consistent, the chain has drifted and must be repaired before the
next gate closes. The DCBF-era HTML-preview-vs-FE drift cannot
recur because there is no second UX artifact to drift against.

## F1 timebox

The 2-of-5 selector enables F1 only when it earns its cost. The
cost is bounded:

- **Duration**: ≤2 working days from F1 start to F1 exit gate.
- **Author cap**: 1 FE engineer. No parallel exploration —
  multiple authors guarantee the chain drifts at F2.
- **Output constraint**: locked UX acceptance criteria only.
  Contract-shape questions are noted as input to phase C; they
  are **not** F1 output.
- **Overrun policy**: if F1 needs >2 days, the round **pauses**
  and the scope is re-cut. Either drop to DCFBI with a documented
  UX risk in the round's Do log, or split the feature into
  smaller rounds. **No silent extension.**

The number (2 working days) is best-estimate from R26/R29
prototype patterns and is reviewed by the `revisit-trigger` if
empirical evidence diverges.

_Track: 2. Pulled by: 2026-05-28 brainstorm chain at
[`plan/brainstorms/2026-05-28-hybrid-flow/`](../plan/brainstorms/2026-05-28-hybrid-flow/),
which itself was pulled by DCBF chain experience (R14→R21,
`../context/_archive/contract-driven-feature.md`):
over-effort for fair-only results + D-phase overwhelm as
design-corpus scope grew. Codified by
[Round_47](../plan/cycles/Round_47.md)._

---

## Amendment — 2026-06-13 (R69 post-mortem)

`revisit-trigger` fired (the *"surfaces an artifact category this
doctrine did not anticipate"* clause): R69 (Saved Query) exposed **the
commit boundary the Hard-gates table never specified.** Both patches
are **additive** — the DCFBI/DFCFBI chain, the 2-of-5 selector, and the
O-rule are unchanged:

1. **Gate = commit boundary** (§ Hard gates, § What this forbids). DCBF
   had `phase = round = commit`; the R47 collapse into one round kept
   the gate as a *documented* checkpoint but dropped the *commit*. R69
   passed every gate and still had zero revert points. Re-bound: each
   gate commits.
2. **Design-model confidence valve** (new § after the Flow selector).
   F1 / the selector are a **UX-flow** valve; nothing addressed
   design-**model** uncertainty. Added the D-only round / discardable
   spike / noun-vs-mode + discovered-vs-imposed checks for when *model*
   confidence is low.

**Root cause (one line):** the one-round chain was adopted to fix
UX-SoT token-drift + D-phase overwhelm — the revert seam was un-priced
collateral of that collapse, never a decision. The fix re-welds the
seam without un-collapsing the chain.

_Pulled by: 2026-06-13 conversation, post-R69-discard. Companions:
[specious-model-lock-in](../memory/2026-06-13-specious-model-lock-in.md)
(discovered-vs-imposed; modeling-error trap),
[gate-vs-commit-conflation](../memory/2026-06-13-gate-vs-commit-conflation.md)
(the lineage: vertical-slice → DCBF → DCFBI, and where the seam was
lost)._

## Amendment — 2026-06-16 (R79 Design-gate cold-start harness test)

Running the gate harness on R79 (a no-UI `datasetId → sourceId` rename) as a
cold-start surfaced two leaks; both fixes are **additive** (the chain,
selector, and O-rule are unchanged):

1. **No-UI / refactor rounds now named** (§ Hard gates note above). The Design
   exit criterion and the 2-of-5 selector were UI-only by assumption; a
   contract/BE refactor has no journeys and the five conditions read vacuously
   no. The substitution (judgment calls + acceptance criteria → DCFBI) is now
   explicit so a cold agent doesn't read the gate as un-closable.
2. **`gate-walker` model-check grep made tolerant.** Step 5 grepped the literal
   `Noun-vs-mode:` / `Discovered-vs-imposed:`; a round recording the answer as
   `noun-vs-mode → …` (prose/arrow/case variant) produced a **false "gate
   open."** The grep is now case-insensitive and accepts `:` or `→`; the
   canonical format stays the colon form.

_Pulled by: 2026-06-16 conversation — R79 cold-start gate run (Track-2
agent-method; harness hardening, within the [R99 evo-horizon](2026-05-27-r99-evo-horizon.md)
artifact-only scope)._
