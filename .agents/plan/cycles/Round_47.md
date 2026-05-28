# Round 47: DCFBI/DFCFBI governance codification

**Status**: Complete
**Date started**: 2026-05-28
**Date completed**: 2026-05-28

## Goal

**Inherits from ← [Round_46](Round_46.md)** — R46 established the
brainstorm-housing convention at
[`.agents/plan/brainstorms/`](../brainstorms/), with the 2026-05-28
hybrid-flow chain (MEMO-FINDINGS, TOOLING-ANALYSIS, TOOLING-QUICK-
START, FINAL-RECOMMENDATION) as the first instance. R47 cites the
chain's durable path from the decision file's `## Why`.

R47 codifies the hybrid design-and-delivery flow recommended in
[`brainstorms/2026-05-28-hybrid-flow/FINAL-RECOMMENDATION-2026-05-28.md`](../brainstorms/2026-05-28-hybrid-flow/FINAL-RECOMMENDATION-2026-05-28.md)
as a committed governance artifact under
[`.agents/decisions/`](../../decisions/). The artifact binds three
things: the **DCFBI default path**, the **DFCFBI conditional path**
(triggered by a 2-of-5 selector), and the **O-rule** (one-source-of-
truth as a cross-cutting invariant, not a terminal phase). It also
quantifies the **F1 timebox** the recommendation named but never
numbered — the missing number that turns "strict F1 timebox" from
slogan into mechanism.

R47 is a **pure governance round**. It writes one decision file, edits
references, and adds nothing else. **No design files are touched** —
that work is the R48 chain (audit → normalize → refresh) which only
makes sense once R47's gates exist as the ruler to measure against.

*R45 (validator coverage) is the most recent Track-2 milestone but
not an artifact-dependency for R47; R47's Track-1 pull comes from
the DCBF experiment + design-corpus pain, surfaced via the
2026-05-28 brainstorm chain and routed through R46.*

*Track: 2 (agent-method, process discipline). Pulled by Track-1
experience with the DCBF chain
([context/contract-driven-feature.md](../../context/contract-driven-feature.md),
validated R14→R21): the cycle delivered fair-only results for
over-effort, and **D-phase began to overwhelm as design-corpus
scope grew** — concretely surfaced by the 2026-05-28 brainstorm
chain at
[`plan/brainstorms/2026-05-28-hybrid-flow/`](../brainstorms/2026-05-28-hybrid-flow/)
(MEMO-FINDINGS scan flagged 6 D-side issues, 2 critical). R47
codifies the operating-model pivot the brainstorm chain
synthesized: DCFBI default + DFCFBI conditional, replacing the
flat DCBF chain. Per [Evolution Rule](../../AGENTS.md).*

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Decision filename**:
   `.agents/decisions/2026-05-28-hybrid-flow-governance.md`. Follows
   the `YYYY-MM-DD-<topic>.md` pattern used by every existing decision
   file. Topic slug `hybrid-flow-governance` covers selector + gates +
   O-rule as one bundle, since they only make sense together.
2. **One decision file, not three.** The selector, the gates, and the
   O-rule are coupled — splitting them would force three cross-linked
   files that all cite the same FINAL-RECOMMENDATION source. Keep them
   in one artifact; sub-headings inside the file carry the structure.
3. **F1 timebox default proposal**: **≤2 working days, ≤1 FE author,
   no contract-shape requests during F1.** Rationale: long enough to
   prototype the interaction model with MSW (typical scope is 1-3
   screens, ~6-12 hours of focused work), short enough to forbid
   open-ended exploration. The "no contract-shape requests" clause is
   the teeth — it forces F1 output to be UX-only, not API-fishing. The
   number is committed in the decision but flagged `revisit-trigger:
   after first DFCFBI run (R48 audit may discover the corpus has
   features that needed F1 — those become retrospective trial data)`.
4. **Reference wiring goes in `AGENTS.md § Operative horizons`**, not
   `context/governance.md`. Operative-horizons is the existing index of
   active commitments that constrain the Evolution Rule
   ([R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md)
   is already there); R47's decision belongs in the same list. The
   pattern is established — one new bullet, no structural change.
5. **No `.agents/context/` promotion.** Decisions live in
   `decisions/`; context-promotion is reserved for *validated*
   patterns (per [PDCA.md § Promotions](../PDCA.md#act)). R47 commits
   a hypothesis to be measured against by R48 chain. Promotion is
   premature.
6. **No `.agents/memory/` note this round.** Memory captures
   *learnings* from completed work; R47 is the work itself. If R48
   audit surfaces gate ambiguities or F1-timebox-too-tight evidence,
   *that* round writes the memory.
7. **Brainstorm source-of-truth lives at
   [`.agents/plan/brainstorms/2026-05-28-hybrid-flow/`](../brainstorms/2026-05-28-hybrid-flow/)**
   (post-R46). The decision file paraphrases and tightens FINAL-
   RECOMMENDATION; it does not copy verbatim. The brainstorm chain
   stays as the durable analysis trail; the decision is the
   authoritative committed form. The decision cites
   `FINAL-RECOMMENDATION-2026-05-28.md` (and optionally its
   siblings) once in `## Why`. R47 *does not* edit the brainstorm
   docs — they are historical record after R46 moved them.
8. **`AGENTS.md` edit is one bullet**: under `### Operative horizons`,
   append one item matching the existing format. No new section, no
   prose changes elsewhere in AGENTS.md. Out-of-scope creep risk is
   real; constrain rigidly.

## What is IN scope

### 1. Draft and commit the decision artifact

- File: `.agents/decisions/2026-05-28-hybrid-flow-governance.md`.
- Template: [`_TEMPLATE.md`](../../decisions/_TEMPLATE.md) — frontmatter
  and sections in order.
- Frontmatter fields:
  - `decided: 2026-05-28`
  - `source-round: conv:2026-05-28` (per template — conversation, not
    a round, is the pull; FINAL-RECOMMENDATION was authored in chat)
  - `track: 2`
  - `status: active` (the commitment binds immediately — R47 will
    operate under it from day one)
  - `applies-when: a design-and-delivery cycle starts for any product
    feature in this repo`
  - `failure-mode: contract locks bad UX assumptions early (pure
    contract-first), OR late API churn from open-ended frontend
    discovery (pure frontend-first), OR "one source of truth"
    rhetoric without traceability`
  - `revisit-trigger: after first complete DFCFBI run (selector
    triggered, F1 timebox tested); OR R48 audit surfaces ≥3
    design files that can't pass the Design exit gate without gate
    revision; OR an F1 round overruns the ≤2-day timebox by >50%`
  - `promoted-to: null`
- Body sections, in this order:
  1. **Commitment** — one paragraph naming DCFBI default + DFCFBI
     conditional + O-rule cross-cutting + F1 timebox.
  2. **Why** — cite FINAL-RECOMMENDATION's three-point analysis
     (process worked but had blockers; pure flows trade off; MSW
      maturity now supports two-stage FE). One link to the durable
      brainstorm source under
      `plan/brainstorms/2026-05-28-hybrid-flow/`.
  3. **What this allows** — the carve-outs: DCFBI for low-uncertainty
     features (no F1 ceremony), per-test handler overrides at gates
     (with logged exit), contract v2 process when F2 surfaces real
     shape questions.
  4. **What this forbids** — adding a feature round without a Flow
     Selector check; running F1 longer than 2 working days; making
     contract-shape changes during F1; treating "one source of truth"
     as a phase rather than an invariant.
  5. **Trade-off accepted** — slower for high-uncertainty work (F1
     adds days); more ceremony at gates (gates are not optional);
     two-flow cognitive load (engineers must learn the selector).

### 2. Selector + gates + O-rule structured sub-headings

Inside the decision body (after `## Trade-off accepted`), add three
named sub-sections that paraphrase FINAL-RECOMMENDATION into normative
form:

- `## Flow selector (2-of-5)` — list the five conditions verbatim
  from FINAL-RECOMMENDATION, with a clarifying sentence on each
  ("more than 3 independent interactive states" → counts branches in
  the design markdown, not button variants).
- `## Hard gates (non-negotiable)` — table form:

  | Gate | Exit criterion | Who closes it |
  |---|---|---|
  | Design | Journeys + testable acceptance criteria documented | round author |
  | F1 (if triggered) | Interaction decisions frozen; open Qs resolved-or-deferred-explicitly | round author |
  | Contract | Request/response/error shapes frozen; MSW aligned | round author |
  | F2 (if F1 ran) | Confirmation pass complete; contract v2 process invoked for shape changes | round author |
  | Backend | Contract conformance tests pass | round author |
  | Integration | FE-vs-BE verified; conformance tests pass on both | round author |

- `## The O-rule (three truths, cross-cutting)` — name the three
  truths (UX truth = design artifact; data-behavior truth = contract
  artifact; execution truth = shared conformance tests). State the
  invariant: each truth has exactly one source; traceability between
  truths is explicit.

### 3. Quantify the F1 timebox

Inside the decision (in `## What this forbids` or a dedicated
sub-section), commit the number:

- **F1 timebox**: ≤2 working days from F1 start to F1 exit gate.
- **F1 author cap**: 1 FE engineer (no parallel exploration).
- **F1 output constraint**: locked UX acceptance criteria only.
  Contract-shape questions surface as input to phase C, not as F1
  output.
- **Overrun policy**: if F1 needs >2 days, the round pauses and the
  scope is re-cut (either drop to DCFBI with a known UX risk, or
  split the feature into smaller rounds). No silent extension.

### 4. Wire reference into AGENTS.md

- File: [`.agents/AGENTS.md`](../../AGENTS.md).
- Section: `### Operative horizons`.
- Add one bullet under the existing R99 evo-horizon entry, matching
  format exactly:

  ```markdown
  - **[Hybrid flow governance](decisions/2026-05-28-hybrid-flow-governance.md)** —
    DCFBI default, DFCFBI conditional (2-of-5 selector), O-rule
    cross-cutting; F1 timebox ≤2 working days.
  ```

- No other edits to AGENTS.md.

### 5. Pipeline

- `npx markdownlint-cli2` — 0 errors over the new + edited files.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this round file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No design-file edits.** R48 chain handles the corpus; R47 only
  defines the ruler. Touching design files this round mixes the
  layers and contaminates R48's supersession analysis (you can't
  classify an artifact as superseded against a ruler you bent
  while writing).
- **No measurement framework.** The Adoption Plan's "compare cycle
  time, change count, mismatch rate" lives in a later round once
  enough flow-selector data exists to compare. R47 commits the
  selector; measurement is downstream.
- **No `.agents/context/` promotion.** Promotion needs validation;
  R47 commits a hypothesis.
- **No new memory file.** Memory captures learnings from work; R47
  *is* the work. If R48 surfaces gate ambiguity, that's where the
  memory note lands.
- **No edits to the brainstorm chain at
  [`.agents/plan/brainstorms/2026-05-28-hybrid-flow/`](../brainstorms/2026-05-28-hybrid-flow/).**
  R46 moved the docs as-is; R47 treats them as historical record.
  The decision file is the committed form. If the recommendation
  is later revised, a new dated decision supersedes — not by editing
  either the decision or the brainstorm.
- **No CLAUDE.md edit.** [CLAUDE.md](../../../.claude/CLAUDE.md)
  already points at AGENTS.md as the shared knowledge base; the
  AGENTS.md horizon-bullet is the propagation path.
- **No skill creation.** A "design-and-delivery flow runner" skill
  could codify the selector + gate-walk; that's a Track-2/3 build,
  not justified yet. The selector is short enough to read inline.
- **No retroactive application.** R47 binds R48 onward. Existing
  rounds (R01-R45) are not re-classified or re-audited against the
  gates. The R48 design-corpus audit *will* be the first
  cross-application of the gates.

## Plan

- [x] Confirm scope at planning review (user reads Goal + IN/OUT
      sections, redirects if needed).
- [x] Draft `.agents/decisions/2026-05-28-hybrid-flow-governance.md`
      per `_TEMPLATE.md` frontmatter + body order.
- [x] Inside the decision, populate the three structured
      sub-sections (Flow selector, Hard gates table, O-rule).
- [x] Inside the decision, commit the F1 timebox numbers (≤2 days,
      1 FE, no contract-shape requests, no silent overrun).
- [x] Edit `AGENTS.md § Operative horizons` to add one bullet
      pointing at the new decision file. Match existing formatting
      exactly.
- [x] Run `npx markdownlint-cli2` — fix any errors introduced.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping Status to
      `Review`.

## Risks / unknowns

- **F1 timebox value (≤2 working days) is a guess.** The
  FINAL-RECOMMENDATION named the constraint but not the number;
  R47 commits ≤2 days because that's where most 1-3-screen
  interaction prototypes land in this codebase based on R26/R29's
  patterns. The number could be wrong in either direction — if F1
  rounds overrun by 50%+, that's evidence to tighten or revise the
  trigger conditions. `revisit-trigger` in frontmatter captures
  this explicitly so a future round can act on it.
- **Decision file is methodology, not code constraint.** Existing
  decisions
  ([MSW contract-anchor](../../decisions/2026-05-27-msw-contract-anchor.md),
  [R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md))
  constrain code or roadmap. This one constrains *process*. The
  template fits; the placement under `decisions/` is the right
  shape; but it's a slight broadening of what `decisions/` carries.
  Acceptable — `governance.md` already covers process governance at
  a higher level; this decision is the concrete instance.
- **"DCFBI" / "DFCFBI" abbreviations are non-obvious.** The decision
  file must define them inline on first use (D = Design, C =
  Contract, F = Frontend, B = Backend, I = Integration; DFCFBI
  inserts F1 between D and C, then F2 between C and B). Risk: future
  readers will skim past the definitions; mitigated by putting them
  in the Commitment paragraph.
- **R48 narrowed further to archive-only** (post-Review amendment
  5 — see Do log). Earlier amendments swept R48 from "audit" to
  "corpus reconciliation"; this latest narrowing pulls it back to
  *supersession analysis + archive move* only. Rewrites of
  surviving docs (design `.md` framing, README narratives, context
  files) are deferred to a later round that benefits from concrete
  DCFBI experience. Reason: at an S-curve break-point, archive is
  reversible (file moves preserve history) and content rewrites
  are not; the immediate need is workspace segregation to unblock
  the first DCFBI trial, not eager rewriting of survivors.
- **AGENTS.md edit is small but load-bearing.** The horizons section
  is read by every agent at session start (per Load Order). Adding
  one bullet is the path to making the decision actually constraining;
  forgetting it means the decision exists but no agent loads it.
  Single point of failure; mitigated by an explicit checkbox in Plan.
- **Markdownlint may complain about the gates table.** R45 hit
  zero issues; the new table follows the same format used in R45's
  handler-wrap table. Should be clean; verify before flipping Status.

## Do

**Scope confirmation.** User authorized R47 execution via "go with
R47" after R46 landed (commit c05a292). Proceeded under [auto mode].

**Decision artifact written** at
[`.agents/decisions/2026-05-28-hybrid-flow-governance.md`](../../decisions/2026-05-28-hybrid-flow-governance.md).

- Full frontmatter (8 fields) per
  [`_TEMPLATE.md`](../../decisions/_TEMPLATE.md):
  `decided: 2026-05-28`, `source-round: conv:2026-05-28`,
  `track: 2`, `status: active`, `promoted-to: null`,
  `applies-when:` covers any design-and-delivery cycle in this
  repo, `failure-mode:` names all three failure shapes (early
  contract lock, late FE churn, O-rule rhetoric without
  traceability), `revisit-trigger:` three conditions (first
  DFCFBI run, R48 ≥3 design-file fails, F1 overrun by >50%).
- Body sections in template order: Commitment, Why, What this
  allows, What this forbids, Trade-off accepted.
- Structured sub-sections after Trade-off accepted: **Flow
  selector (2-of-5)**, **Hard gates (non-negotiable)** table
  (6 phases: Design / F1 / Contract / F2 / Backend / Integration;
  F1 + F2 marked DFCFBI-only), **The O-rule (three truths,
  cross-cutting)**, **F1 timebox** (numbers committed).
- Commitment paragraph defines DCFBI / DFCFBI abbreviations
  inline on first use — mitigates the non-obvious-acronym risk
  flagged in Risks.
- Flow selector lists all 5 conditions verbatim from FINAL-
  RECOMMENDATION with one-sentence clarifications each.
- O-rule cites
  [MSW contract-anchor](../../decisions/2026-05-27-msw-contract-anchor.md)
  for the execution-truth conformance chain — the validator stack
  R45 extended is the enforcement.

**AGENTS.md horizons bullet added.**

- One bullet appended under the existing R99 evo-horizon entry in
  `### Operative horizons`, format matching exactly.
- No other AGENTS.md edits.

**Markdownlint sweep.**

- One issue surfaced in-Do: MD004 on decision file line 102 — a
  `+` at column 3 in a list-item continuation read as a sub-list
  plus-style marker. Replaced `+ which gates apply to which path`
  with `and which gates apply to which path`. Third instance of
  this family of gotcha (R46 PDCA.md, R46 Round_46.md, R47
  decision file); already captured in
  [memory/2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md).
- Repo-wide re-lint: **0 errors over 116 files** (was 115; +1
  for the new decision file).

**Promotion log entry appended.**

- Per R46's learning ("Audit-against-governance is worth doing
  before Complete"), appended a 2026-05-28 entry to
  [promotions.md](../promotions.md) covering both the new
  decision file and the AGENTS.md horizons bullet. Captures
  Source (R47), Rationale (DCBF over-effort + D-overwhelm
  Track-1 anchor), and Promoter (user via "go with R47").

**Brainstorm chain unchanged.**

- `git diff --stat` against the working tree showed no changes
  under [`.agents/plan/brainstorms/`](../brainstorms/). The 4
  source docs + README are exactly as R46 landed them.

**No design-file edits.**

- `git diff --stat` showed no changes under
  [`.agents/design/`](../../design/). R47 only defines the gates
  that R48 will audit against; corpus remediation is R48 work.

**Post-Review amendment: FE-as-preview consolidation made
explicit.**

User surfaced the central conceptual mismatch in the first draft:
the DCBF→DCFBI pivot is not just "add an F1 phase when uncertainty
is high" — its core shift is that **the F phase (or F1 in DFCFBI)
running against MSW *is* the canonical UX preview**, eliminating
the DCBF-era split between HTML mockups in
[`.agents/design/`](../../design/) and FE code in
[`workspace/apps/builder/`](../../../workspace/apps/builder/). That
split was exactly the token-drift risk MEMO-FINDINGS flagged as #1
critical. The decision artifact buried this; the user named it
sharply ("F1 => our FE work as Preview. So, we have only 1 SoT").

Three edits applied:

- **Commitment** now closes with one binding sentence: "The FE
  running against MSW (the F or F1 output) is the single source
  of truth for UX; design markdown is its spec, not a parallel
  artifact."
- **Why** gains a paragraph naming the SoT consolidation as the
  central conceptual shift (not just a side-effect).
- **O-rule** § UX truth reframed from "the design artifact" to
  "the FE running against MSW"; design markdown is reclassified
  as the *spec* the FE implements, not a parallel truth.
- **What this allows** item on Design artifacts demotes HTML
  previews from "optional" to "not SoT; historical scratch from
  DCBF rounds; R48 decides their fate."

Lint clean after edits (0 errors over 116 files).

**Post-Review amendment: R48 reframed from audit to corpus
reconciliation; cleanup is precondition for first DCFBI trial.**

User followed the FE-as-preview clarification with a sharper
sequencing question: "we need to remove all preview.html, update
design docs. Why? this must be done before first 'trial' of
DCFBI?" The answer is yes — and the implication is that R48
was misframed as "audit" when its actual work is *reconciliation*
of the corpus to the new SoT shape.

Four failure modes if a DCFBI trial runs before cleanup:

1. Contradictory state for the round author (decision forbids
   parallel UX artifacts; corpus shows 6+).
2. DCBF muscle-memory drift leaks back ("let me update the
   preview too" reflex).
3. R48 as an "audit" is degenerate — no `.preview.html` can
   pass any gate; the audit's only output would be "remove these."
4. First trial runs on contaminated baseline; drift causes are
   confounded.

Updates applied:

- **R47 Feeds-into**: rewritten to reframe R48 as
  reconciliation (remove `.preview.html`, update `.md`, reframe
  design/README.md). R46's speculative sub-round chain
  (`R48.A`/`.B`/`.C`) demoted to "may sub-structure, R48's call."
  Explicit precondition: R48 must flip Complete before any
  DCFBI/DFCFBI feature round.
- **R47 Risks** entry on R48 updated: "audit is the first
  test" → "cleanup is the first test; pure audit would be
  degenerate under R47."
- **R47 OUT-of-scope** updated: "makes R48's audit meaningless"
  → "makes R48's cleanup work double-handled."
- **Decision artifact frontmatter** `revisit-trigger` updated:
  "R48 audit surfaces ≥3 design files that cannot pass" →
  "R48 corpus reconciliation surfaces ≥3 surviving design
  files that cannot reach the Design exit gate."

The decision artifact's body did NOT need a new "What this
forbids" item for the precondition. The decision itself is
durable; the precondition is a R48-local sequencing concern
captured in R47's Feeds-into and (when drafted) R48's own Plan.
Adding a temporary precondition to the durable decision would
require retiring it once R48 lands — bad shape.

**Post-Review amendment: S-curve break-point captured in memory;
R48 scope widened to all DCBF-anchored docs.**

User followed the R48 reframe with a deeper methodological
observation: this moment is a **break-point / growth-point in
S-curve development theory** — methodology shifts that change the
*conceptual shape* of the work, not just its steps. They proposed
two complementary actions:

1. Capture the break-point in memory so the evolution is visible
   on the timeline (which already exists as dated memory files).
2. Widen R48 scope: beyond `.preview.html`, *any* "official"
   doc that operationalized DCBF can be reconciled.

Both applied:

- **Memory file written**:
  [`memory/2026-05-28-dcbf-to-dcfbi-pivot.md`](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md)
  captures the inflection (previous S-curve plateau, new S-curve
  conceptual + procedural shifts, recommendations for marking
  future break-points). Pulled-by line cites the user observation
  verbatim for traceability.
- **R47 Feeds-into widened**: R48's scope is now "corpus
  reconciliation across all DCBF-anchored docs" with primary
  (design corpus) + extended (`context/contract-driven-feature.md`,
  DCBF-era memory files) sub-scopes. Triage framing applied: not
  a blanket sweep — per-doc update/deprecate/preserve decisions
  are R48's call.

This is the **third** post-Review amendment to R47 (FE-as-preview
clarification → R48 audit→reconciliation reframe → S-curve
break-point capture + scope widening). Each amendment was caught
by user observation, not by my own audit. Worth surfacing as an
Act learning.

**Post-Review amendment: `R48.A` notation dropped as presumptive.**

User flagged that `R48.A` (and `.B`/`.C`) was speculative pre-naming
from R46's planning narrative — the sub-round notation
`Round_NN.A.md`/`.B.md` is not an established PDCA convention
([PDCA.md Naming Convention](../PDCA.md) names only
`Round_NN.md`, zero-padded two-digit). R46 (Status: Complete,
append-only) speculated a three-phase chain at planning time; that
speculation is locked as R46 history, but downstream editable docs
should not treat the sub-structure as decided.

Updates applied (in editable docs only — R46 left alone per
append-only rule):

- Bulk replaced `R48.A` → `R48` in
  [`memory/2026-05-28-dcbf-to-dcfbi-pivot.md`](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md),
  [decision artifact](../../decisions/2026-05-28-hybrid-flow-governance.md)
  (the `revisit-trigger` line), and Round_47.md body.
- Feeds-into section reframed: R46's speculative sub-round chain
  demoted to "may sub-structure if reconciliation splits cleanly;
  R48's call at planning time." The `Round_48.A.md`/`.B.md`
  naming itself is flagged as needing its own planning decision
  if R48 elects to sub-structure.
- Feeds-into header: `## Feeds into → Round_48.A (TBD)` →
  `## Feeds into → Round_48 (TBD)` matching the PDCA template
  format.

The remaining `R48.A`/`R48.B`/`R48.C` mentions in R47.md are
intentional — they exist only as *explanations* of why we dropped
the notation, or as references to R46's locked-history speculation.

This is the **fourth** post-Review amendment, again surfaced by
user observation rather than self-audit. The Act learning about
"governance audits catch procedural drift; conceptual audits need
fresh framing" applies here too — premature naming is a
*procedural* drift my audit could have caught but didn't.

**Post-Review amendment 5: R48 scope narrowed to archive-only;
"work carefully at the break-point" disposition codified.**

User pulled R48's scope tighter still — from "corpus reconciliation
across DCBF-anchored docs" (amendment 3 framing) to **supersession
analysis + archive move only**. Their reasoning: *"we are at the
break-point of S-curve. Thus, have to work carefully."*

Earlier amendment 3 had implicitly bundled two distinct concerns:
(a) removing contradictory artifacts from the live tree (necessary
precondition for the first DCFBI trial) and (b) rewriting
partially-displaced ones (content work that does not block the
trial). R48 now does only (a).

The disposition: at an S-curve break-point, archive is reversible
(file moves preserve history); content rewrites are not. Letting
the first DCFBI trial run against an *uncontaminated* workspace is
the immediate goal. Rewriting surviving docs benefits from
concrete DCFBI experience and belongs in a later round, not
pre-trial speculation.

Updates applied:

- **R47 Feeds-into** rewritten: two-step shape (analyse →
  archive), explicit out-of-scope list naming the deferred rewrite
  work, candidate scan reframed as supersession-triage with three
  statuses (*fully superseded* → archive; *partially* → leave
  in place; *not* → leave).
- **R47 Risks** R48 entry updated to name amendment-5 narrowing.
- **R47 OUT-of-scope** R48 line updated: contamination risk now
  framed as polluting supersession analysis, not double-handled
  reconciliation.
- **Decision artifact `revisit-trigger`** narrowed to match: R48
  archive analysis surfacing supersession ambiguity, not survival
  evaluation (survival of surviving docs is downstream of archive).
- **Decision artifact body** line on `.preview.html` fate updated
  from "R48 design-corpus chain decides their fate" to "R48
  archive round decides their archive status."
- **Pivot memory "Affected corpus" section** retitled
  *"Supersession triage candidates"* with the three-way
  classification reframed; archive applied only to *fully
  superseded*.
- **Pivot memory "Don't" entry** on methodology shifts updated to
  name archive-segregation (not reconciliation) as the
  operational transition R48 carries.

This is the **fifth** post-Review amendment, again surfaced by
user observation. The pattern noted at amendment 4 (conceptual
audits need fresh framing) deepens: each amendment has been a
narrowing toward what is *operationally minimal* for the
break-point to land safely. Lifted as an Act learning below.

## Check

- [x] `.agents/decisions/2026-05-28-hybrid-flow-governance.md` exists
      with full frontmatter (8 fields per `_TEMPLATE.md`).
- [x] Body sections present in template order: Commitment, Why, What
      this allows, What this forbids, Trade-off accepted, plus the
      three structured sub-sections (Flow selector, Hard gates,
      O-rule).
- [x] F1 timebox numbers explicitly stated: ≤2 working days, 1 FE
      author, no contract-shape requests during F1, no silent overrun.
- [x] `AGENTS.md § Operative horizons` has one new bullet pointing
      at the decision file; format matches existing R99 entry.
- [x] Brainstorm chain at
      [`.agents/plan/brainstorms/2026-05-28-hybrid-flow/`](../brainstorms/2026-05-28-hybrid-flow/)
      is unchanged from R46's move (governance committed, source
      preserved).
- [x] No design files touched (verify via `git diff --stat` —
      no `.agents/design/*` paths).
- [x] No `.agents/context/` changes. One `.agents/memory/` file
      added in post-Review amendment
      ([2026-05-28-dcbf-to-dcfbi-pivot.md](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md))
      capturing the S-curve break-point per user observation.
      Original plan said "no new memory file"; the break-point
      framing made the entry justified (timeline-visible evolution
      trace, not just a learning).
- [x] `npx markdownlint-cli2` — 0 errors.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md)
      complete; all Plan + Check boxes flipped.

## Act

**Learnings**:

- **Decisions can constrain process, not just code.** Most existing
  entries in [`.agents/decisions/`](../../decisions/) constrain code
  ([MSW contract-anchor](../../decisions/2026-05-27-msw-contract-anchor.md))
  or roadmap
  ([R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md)).
  This decision constrains *the shape of every future feature
  round*. The template fits — frontmatter + Commitment + Why +
  What this allows + What this forbids + Trade-off accepted — but
  the body needed three structured sub-sections (Flow selector,
  Hard gates table, O-rule) because they're prescriptive lists,
  not prose. Worth remembering for future process-governance
  decisions.
- **Hard gates without enforcement are aspirational.** R47's gates
  are documented exit criteria for round authors to follow.
  Nothing in the repo *enforces* that a round can't flip to
  `Review` with an unclosed gate. Acceptable for now (the round
  author + human reviewer pair is the enforcement), but if drift
  appears in R48+, a lightweight Bash check (grep round file for
  gate-closure lines before letting Status flip) is a small
  next step.
- **Track-1 anchor citing a chain is acceptable.** R46's deep-check
  audit established the precedent: Track-2 work can chain its pull
  through multiple steps as long as each link is named and the
  Track-1 origin is concrete (here: DCBF chain experience +
  design-corpus pain). R47 cites it both in the decision footer
  and the round Pulled-by — redundant but intentional. Future
  Track-2 decisions should follow the shape.
- **Three post-Review amendments — all surfaced by the user, none
  by my own audit.** The R46 deep-check audit pattern worked for
  governance compliance (Track-1 pull, memory placement,
  promotions log) but missed three substantive conceptual issues:
  (1) FE-as-preview SoT consolidation, (2) R48 audit→cleanup
  reframe, (3) S-curve break-point worth capturing in memory.
  Worth holding future Review work to a higher bar: re-read the
  draft as a stranger after a 5-min break, asking "is the
  conceptual shift visible? does the next-round sequencing make
  sense? is the lineage capturable in 6 months?" The user's
  observations were each a single sentence; the gaps were
  noticeable once named, but my self-audit didn't find them. The
  generalized rule: **governance audits catch procedural drift;
  conceptual audits need someone reading with fresh framing.**
- **S-curve break-points deserve memory entries.** Methodology
  shifts (DCBF → DCFBI here) often go unmarked — only the
  outcome lands as a new decision, while the transition itself
  fades. The dated memory tree is already a timeline; adding a
  break-point entry turns it into an *evolution trace*. Pattern
  to repeat: when a decision supersedes a prior decision/context,
  write a memory entry naming the inflection. See
  [memory/2026-05-28-dcbf-to-dcfbi-pivot.md](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md)
  as the worked example.
- **The central conceptual shift was nearly buried.** First-draft
  decision artifact framed DCFBI/DFCFBI primarily as "add F1 phase
  when uncertainty is high," with the FE-as-preview SoT
  consolidation tucked into a parenthetical "MSW maturity now
  supports two-stage frontend role." User surfaced this as a real
  mismatch — the FE-as-preview shift is the *reason* DCFBI is
  better than DCBF, not a side-effect. Worth holding future
  decision drafts to: **lead with the conceptual shift, not the
  procedural change.** Procedural changes (add phase X, run check
  Y) are mechanism; the conceptual shift is the *why anyone
  should care*. If the conceptual shift would survive a one-line
  paraphrase test ("we changed X to Y because Z"), it belongs in
  Commitment + leading paragraph of Why, not as a buried citation.
- **At S-curve break-points, narrow until reversible.** R48's
  scope traveled three reframings — audit → reconciliation →
  archive-only — each user-surfaced (last one with explicit
  "work carefully at the break-point" framing). The endpoint
  (archive-only) is reversible work; the rejected scopes
  (rewriting surviving docs) were not. Pattern: when the
  conceptual shape of work changes, the first round operating
  under the new shape should do *only* what is reversible. Eager
  absorption of the new curve's work backlog is a curve-anxiety
  reflex, not a sound default. Save it for the round *after* the
  first trial under the new curve runs cleanly. Captured here as
  the first instance; recurrence should lift it to memory.
- **The `+ at column 3` gotcha bit a third time.** R46 hit it in
  PDCA.md and Round_46.md; R47 hit it in the decision file. Same
  shape every time: a list-item continuation that contains a
  literal `+` at the indented continuation column reads as a
  sub-list marker. The
  [memory/2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md)
  now has 3+ instances — meets the bar to revisit Status. Surface
  as follow-up.

**Promotions**:

- [x] → `decisions/`: Hybrid flow governance — DCFBI / DFCFBI /
  O-rule / F1 timebox. Logged in
  [promotions.md](../promotions.md) 2026-05-28 (paired with
  the AGENTS.md horizons bullet).

**Follow-ups (not promotions, just notes):**

- **R48 is the first measurement.** R47 commits a hypothesis;
  R48's audit of the design corpus against the new Design exit
  gate is the calibration. If ≥3 files fail the gate without
  revision, `revisit-trigger` in the decision frontmatter fires
  and an interim round amends the gate before R48 closes.
- **F1 timebox empirical evidence is missing.** No DFCFBI round
  has run yet. First DFCFBI completion will be the first data
  point; the ≤2-day value is best-estimate, revisitable per
  `revisit-trigger`.
- **Markdownlint plus-prefix gotcha has 3+ instances now.** Worth
  lifting its memory Status from "New" toward promotion to
  `.agents/context/`. Not pulled this round (Track-2 cleanup,
  not on R47's path); R48 could absorb it if convenient.
- **No enforcement mechanism for hard gates.** Compliance relies
  on round-author discipline + human review. If R48+ surfaces
  gate drift, consider a Bash check on Status-flip.

## Feeds into → Round_48 (TBD) — supersession analysis + archive

R48 is **purely supersession analysis + archive of fully-superseded
artifacts** under R47's new doctrine. Two-step shape, nothing more
(narrowed post-Review per user's "work carefully at the
break-point" framing; see amendment 5 in Do log, and
[memory/2026-05-28-dcbf-to-dcfbi-pivot.md](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md)
for the S-curve framing).

1. **Analyse**: enumerate the `.agents/`-tracked corpus (`design/`,
   `context/`, `memory/`, anywhere doctrine-bearing) and classify
   each artifact:
   - **Fully superseded** — R47's doctrine explicitly displaces
     it. The artifact has no role under DCFBI/DFCFBI.
   - **Partially superseded** — DCBF-shape framing inside the
     artifact is displaced, but lessons still hold cleanly within
     DCFBI's unchanged phases (e.g., Contract / BE / FE
     conformance).
   - **Not superseded** — lessons hold cleanly; no displacement.

   Output is a triage list, no edits.

2. **Archive**: move *fully superseded* artifacts under an
   `_archive/` subdir local to their parent (`design/_archive/`,
   etc.), preserving them as historical record. **Move only — no
   rename, no content edit, no in-place doctoring.**
   Partially-superseded artifacts stay in place; rewriting them is
   deferred to a later round.

**Why narrowed to archive-only.** At an S-curve break-point
(DCBF → DCFBI; see pivot memory) the safest operation is
*segregation*, not *rewrite*. Archive is reversible (file moves
preserve history); content rewrites are not. The immediate goal
is to let the first DCFBI trial run against an *uncontaminated*
workspace; rewriting surviving docs is a later-round concern that
benefits from concrete DCFBI experience rather than pre-trial
speculation.

**Out of R48 scope** (deferred to later rounds):

- Substantive rewrites of surviving design `.md` files (journey
  reframing, acceptance-criteria normalization, preview-reference
  scrubbing).
- Reframing [`.agents/design/README.md`](../../design/README.md)
  around FE-as-preview.
- Updating [`.agents/context/contract-driven-feature.md`](../../context/contract-driven-feature.md)'s
  chain-shape framing to point at the new decision.
- Status changes on DCBF-era memory files beyond classification.
- Running the first DCFBI/DFCFBI feature round.

**Candidate scan** (starting set; R48's triage is authoritative):

- `.agents/design/**/*.preview.html` files (6, all under
  `data-management/`) — likely *fully superseded* (FE-as-preview
  means no separate HTML preview carries SoT). Archive.
- **Preview-shell infrastructure** —
  `.agents/design/index.html`, `.agents/design/_js/preview-shell.js`,
  `.agents/design/_css/preview-shell.css`,
  `.agents/design/_css/tokens.css`, and any `*.target.md`
  (e.g.
  [`design/data-management/workspace-shell.target.md`](../../design/data-management/workspace-shell.target.md))
  — auxiliary to the `.preview.html` artifacts. R48 triage decides
  their classification alongside the previews; likely *fully
  superseded* if they serve no consumer beyond the archived
  previews, but check before archiving (`tokens.css` in particular
  may be cited by surviving spec markdown or live FE code).
- `.agents/design/*.md` spec files,
  [`.agents/design/README.md`](../../design/README.md) — likely
  *partially superseded* (preview-as-artifact framing displaced;
  journeys + state notes + criteria still valid). Leave in place;
  rewrite deferred.
- [`.agents/context/contract-driven-feature.md`](../../context/contract-driven-feature.md)
  — likely *partially superseded* (contract-discipline content
  holds under DCFBI's unchanged C phase; chain-shape framing
  displaced). Leave in place; rewrite deferred.
- DCBF-era memory files
  ([2026-05-24-contract-round-methodology.md](../../memory/2026-05-24-contract-round-methodology.md),
  [2026-05-24-be-round-conformance-pattern.md](../../memory/2026-05-24-be-round-conformance-pattern.md),
  [2026-05-24-fe-round-typecheck-pattern.md](../../memory/2026-05-24-fe-round-typecheck-pattern.md),
  [2026-05-24-design-first-reframe-absorption.md](../../memory/2026-05-24-design-first-reframe-absorption.md))
  — likely *not superseded* (Contract / BE / FE conformance
  lessons still hold). R48 records classification; no Status
  edits.

**Precondition for first DCFBI/DFCFBI trial.** R48 must reach
Complete before any feature round runs under the new flow.
Archive segregation removes the contradictory-state risk
(decision says no parallel UX artifact; corpus shows 6+
`.preview.html`). Content-level reconciliation of survivors is
*not* on the precondition path — survivors keep their DCBF-era
framing until a later round rewrites them, and that's acceptable
because the first DCFBI trial reads doctrine from
[`decisions/2026-05-28-hybrid-flow-governance.md`](../../decisions/2026-05-28-hybrid-flow-governance.md)
and AGENTS.md horizons, not from survivors.

**Sub-structuring is R48's call.** R46's speculative
`R48.A`/`.B`/`.C` chain is not a commitment. The narrowed
archive-only scope is small enough that a single `Round_48.md` is
the likely shape; the sub-round notation
(`Round_48.A.md`/`.B.md`/...) is not an established PDCA
convention and would need its own planning decision at R48-start
if R48 elects to split.

R48 may surface evidence to revise R47:

- If the supersession analysis reveals an artifact category R47's
  doctrine did not anticipate (e.g., a fourth truth not captured
  by the O-rule, or a doctrine-displacement R47 did not predict),
  the `revisit-trigger` in the decision frontmatter fires and an
  interim round amends the doctrine before R48 closes.
- If archiving turns out non-trivial (broken cross-links inside
  archived files, link rot from siblings citing the moved paths,
  etc.), R48 records the friction as follow-up evidence; the
  cross-link fixes for those follow back to the live tree land
  inside R48 only when they are themselves archive-mechanical
  (path updates, not content rewrites). Anything resembling a
  content rewrite is deferred.
