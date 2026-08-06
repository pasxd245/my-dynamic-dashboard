# Round 161: concepts & boundaries — the query-domain noun-model

**Status**: **COMPLETE** — 2026-08-06 (concept-lock: the five definitions + settled boundaries
Accepted; the query⇄query composition fork deliberately left OPEN; human-approved close)
**Date started**: 2026-07-22
**Date completed**: 2026-08-06
**Flow**: design/decision round — produces a canonical design-corpus concepts doc + the
query-identity decision; **no product UI this round** (build deferred to a later round).

## ⟢ At a glance

<!-- reader-layer authored at close (R159 doctrine). Shipped = what's now true ·
     Studied = predicted→saw→now-believe · Watch = open threads / next bearing. -->

**Shipped** — One canonical doc, no product code:
[`data-management/_noun-model.md`](../../design/data-management/_noun-model.md) defines the domain's
five nouns (dataset · query · join · relationship · workflow), draws 5 load-bearing boundaries, and
records where today's code diverges as **named debt D1–D4** (each with a verified code anchor). It
lands at the **domain root**, `_`-prefixed so `design-doc-lint` skips it — a concepts/meta doc has
no surfaces/tokens/layout/acceptance to declare, so it reuses the existing `_` carve-out rather than
teaching the lint a new artifact type. Adoption is by **hand-use**: queries.md · workflows.md ·
relationships.md now open with a "read first" pointer, and [design/README.md](../../design/README.md)
documents the artifact type. **Concepts are Accepted-locked; the query⇄query composition boundary is
deliberately OPEN.**

**Studied** _(predicted → saw → now believe)_ — Predicted that defining "query" would **force** the
model A/B call, and that the round would close by *deciding* it. Saw the first half hold exactly:
the definition did force the fork, and `cold-reviewer` found model A well-grounded (a bug-fix, not a
rewrite — `resolve_source` already wraps `qr_` as a subrelation). But it also surfaced that A is a
**one-way door on thin evidence** (n=1 dogfood, 3 probes unrun) whose commitment point is the R162
build, not this doc. Now believe: **a definition round and a decision round are different rounds,
and bundling them overpays.** The vocabulary was the robust, cheap-to-reopen half and was ready to
lock; the composition call was neither. Splitting them let the concept-lock ship at full confidence
instead of dragging a 60%-confidence decision along for the ride. The round's falsification test
passed on all three arms: the doc resolved real conflicts (not a restatement), defining "query" did
force the A/B call, and Brick B stayed under the floor.

**Watch**

- **The fork is OPEN, not settled** — model A leads with the analysis banked, but nothing downstream
  may assume it. Reopening it is its own commitment gate (cold-review anchor 5).
- **D1 (step-drop) is fixable now** — it's a correctness bug **independent** of the fork; D2/D3 are
  fork-contingent. R162 is therefore *not* auto-pulled as a single "model A build".
- **Two open engine questions** ride on any future A-lock: the silent raw-join-then-top-aggregate
  double-count (needs a per-source PK we don't have) and the two-views-vs-genuine-self-join
  discriminator (no named mechanism yet).
- **3 live probes still unrun** (anti-join · messy/composite key · render) — inherited from R160,
  still deferred; they validate the definitions against real data.
- **Adoption is unenforced by design** — if a later round shows nobody reads the doc, that's the
  signal to wire it into the load order harder, not to add a presence-lint
  ([[adopt-artifact-defer-enforcement]]).

## Goal

**Inherits from ← [Round_160](Round_160.md)** — the dogfood verdict that the query surface's real
defect is a **missing/conflicting noun-model** (dataset · query · join · relationship · workflow),
not the join capability; every R160 finding is a boundary collision between the engine's implicit
definition and the surface's.

Give those five concepts **explicit definitions and boundaries in one canonical place**, so the
engine and the surface stop encoding conflicting implicit models and we stop re-arguing the same
seam every round. **Target model** (what each concept *should* be); where current code diverges,
record it as **named debt**, don't fix it here. The **query-identity decision (model A vs B)**
falls out of defining "query". These definitions are **Brick B — for the builders, kept under the
floor; the user never sees them** (R160's two-brick lens is the guardrail).

_Track: 1 (product — the confusion is a real user-facing seam surfaced via the surface↔engine
split). Pulled by: [Round_160](Round_160.md) dogfood — per [Evolution Rule](../../AGENTS.md)._

## Plan

[Expected outcome + what observation would falsify it — a one-line prediction the **Studied** line
checks against at close.]

Expected outcome: a single canonical concepts/boundaries doc that (a) defines each noun, (b) draws
the load-bearing boundaries (join = operation, workflow = mode, query-identity), (c) marks each
code divergence as named debt, and (d) records the model A vs B decision — after which a future
round can build toward *one* north. Falsified if: the doc merely restates the scattered per-surface
docs without resolving a single conflict; or defining "query" does **not** actually force the A/B
call; or the definitions leak Brick B into user-facing complexity.

- [x] Draft the concept definitions + boundary table (dataset · query · join · relationship ·
      workflow) — the in-conversation walk.
- [x] Reconcile each boundary against code (R160's traced lines) **and** the existing per-surface
      design docs ([queries.md](../../design/data-management/queries/queries.md),
      [workflows.md](../../design/data-management/workflows/workflows.md),
      [relationships.md](../../design/data-management/workspaces/relationships.md)); mark divergence
      as named debt.
- [x] Force the **query-identity decision (model A vs B)** from the "query" definition;
      run `cold-reviewer` before locking (engine + promote-to-ER provenance are at stake).
      — Forced and cold-reviewed (all six anchors grounded); **outcome = hold OPEN**, model A
      recorded as leading candidate. The lock itself was deliberately *not* taken — see Check.
- [x] Land the canonical doc in the design corpus (pick home + lint conformance); link it from the
      per-surface docs and the load order so the next round reads it before touching queries.
      — Landed at the domain root, `_`-prefixed (lint skips it); linked from the three per-surface
      docs + the design index ([design/README.md](../../design/README.md)). **AGENTS.md Load Order
      untouched** — the design corpus is reached via its own index, so no constitution edit was
      needed (Default = don't add).
- [x] Validation **(paper arm only)**: mapped each R160 finding → the boundary/debt it resolves;
      all 6 land. ~~Live real-data cases (anti-join, messy/composite key, render)~~ — **still
      deferred** (inherited unrun from R160); they become acceptance checks for whichever build
      round reopens the fork, not a blocker on the concept-lock.

## Risks / unknowns

- **Ontology rabbit-hole** — defining nouns can go theory-heavy, which cuts against product #1
  (ease). Mitigation: success = *fewer seams*, not a beautiful ontology; Brick B stays under the
  floor; timebox the walk.
- **Canonizing the confusion** — defining *current reality* first would enshrine the very overlap
  we're killing. Mitigation: target-model framing (chosen), divergence-as-debt.
- **Decision drags a build in** — the A/B call can tempt an engine rewrite inside this round.
  Mitigation: **decide only**; the build is a separate round; divergence is named debt.
- **Drift returns** — a doc nobody loads becomes a fourth implicit model. Mitigation: one canonical
  home + wired into the load order / design index (argue once, deliberately — not every round).

## Do

### Canonical doc landed + reconciliation (2026-07-23)

Authored the canonical concepts/boundaries doc:
[`data-management/_noun-model.md`](../../design/data-management/_noun-model.md).

- **Home + format decision.** Domain-level (`data-management/`, above every cluster, beside
  `_TEMPLATE.md`), `_`-prefixed so the design-doc conformance lint
  (`scripts/lint/design-doc-lint.mjs`) skips it — a **concepts/meta** doc has no
  surfaces/tokens/layout/acceptance to declare, and forcing those sections is theater a
  presence-lint can't make meaningful ([[adopt-artifact-defer-enforcement]]). Least-mechanism:
  reuse the lint's existing `_`-file carve-out; **do not** add a new artifact-type to the lint
  (Default = don't add). Adopted by hand-use (per-surface docs + load order point here).
- **Five nouns defined (target model)** — dataset (leaf, owns rows) · query (live readable view,
  own identity) · join (an *operation* in a query, not a noun) · relationship (governed `rel_`
  *asset* vs query-owned `qrel_` *snapshot* — one word, two concepts) · workflow (frozen; target =
  a materialization *mode* of a query, not a co-equal noun).
- **Boundary table** drawn (5 load-bearing boundaries).
- **Reconciled against code + per-surface docs**; divergence recorded as **named debt** (D1
  step-drop · D2 shared-leaf `cyclic_join` · D3 workflow-as-noun · D4 error-at-wrong-time), each
  with a current-code anchor verified this session (`query_engine.py:62-129` / `:212-218` / `:74-76`;
  `rows_reader.py:373-407`).
- **Validation** — mapped each R160 finding → the boundary/debt it resolves (the round's
  falsification test); the 3 unrun live probes stay deferred to R162 as *its* acceptance checks.

### The A/B decision — cold-reviewed, staged for human lock (2026-07-23)

Defining "query" forced the fork. Doc records **model A** (query behaves like a dataset:
full stepped output + own identity; relax shared-leaf `cyclic_join`, keep `composition_cycle`;
steps compose live) as the **recommendation** — grounded in R160 #5/#6 + verified code:
A is a **bug-fix, not a rewrite** (`resolve_source` already wraps `qr_` as a subrelation;
`_apply_step` is already nested SQL), fan-out **largely pre-paid** by aggregate locality; the one
real cost is deferring promote-to-governed-ER leaf provenance (unbuilt).

Marked **PROPOSED, not Accepted** — ran `cold-reviewer [mix]` before lock (all six anchors
grounded). Anchors 1/5 clear; **surfaced** for the human's lock:

1. **Residual fan-out (anchor 2+4)** — A trades a *loud* `cyclic_join` for a *potentially silent*
   double-count in the raw-join-then-top-aggregate case; backstop deferred + needs a per-source PK
   we don't have. Decide: acceptable R162 deferral, or pair the lock with a loud guard?
2. **Two-views vs genuine-self-join discriminator (anchor 3)** — "relax shared-leaf only" names no
   engine mechanism to distinguish the two; R162 must own it.
3. **Lock the decision, not the build (anchor 5)** — the doc is a two-way door; the R162
   `cyclic_join` relaxation becomes one-way *after* users depend on shared-leaf joins — treat it as
   its own commitment gate.
4. **Confidence (anchor 6)** — n=1 dogfood + industry triangulation; 3 probes unrun. Being locked
   before those validate.

**Flow note:** design/decision round — no DCFBI/DFCFBI chain (no C/B/F/I), so `flow-selector`
n-a; the only Hard Gate is the **Design/decision lock**, which is the human's, not a
`gate-walker` doc-check ([[dfcfbi-f1-needs-human-review]]: Complete = signed-off, not gates-green).

### Human call — lock concepts, hold the fork OPEN (2026-07-23)

The human's decision at the A/B gate: **don't force the composition lock yet — lock the concepts
first, keep them reopenable "when needed."** Rationale (agreed): the concept definitions are the
robust half (validated against what R160 found, cheap to reopen); the A/B call is the one-way door
(cold-review anchor 5 — only truly commits at the R162 build) resting on thin evidence (anchor 6 —
n=1 dogfood, 3 probes unrun). Lock the vocabulary you're sure of; hold open the decision you're
not. Consistent with [[query-is-a-connection-not-a-load]]'s "argue once, deliberately."

Refactored [`_noun-model.md`](../../design/data-management/_noun-model.md) accordingly:

- **Concepts Accepted — locked R161**: the five definitions + the settled boundaries (dataset owns
  rows · query is a readable table-source with its own identity · join = operation not noun ·
  governed `rel_` vs query-owned `qrel_` · Query⇄Workflow = live-vs-frozen).
- **One boundary OPEN, not locked**: *query⇄query composition* (model A vs B). Model A recorded as
  the leading candidate with the code-verified grounds + the two cold-review concerns, so a future
  round reopens with the analysis done — but nothing downstream may assume A is settled.
- **Named debt reframed**: D1 (step-drop) is a correctness bug **independent of the fork** (fix
  regardless); D2/D3 are **fork-contingent** (resolve only when the fork closes toward A).

**Round status → can close as a concept-lock** (fork deliberately open) once the human confirms the
locked definitions read right. R162 is *not* auto-pulled — it fires only when the fork is reopened.

### Human confirm → COMPLETE (2026-08-06)

The human confirmed the locked definitions read right and called the flip. Round closed as a
**concept-lock**: five nouns + settled boundaries Accepted, query⇄query composition OPEN. Reader
layer, Check verdict, and Act authored at close (R159 doctrine). No successor round auto-pulled —
see the **Feeds into** section below.

## Check

**Verdict: PASS as a concept-lock** — with one goal clause deliberately re-scoped, not met.

- [x] **Canonical doc exists** — [`_noun-model.md`](../../design/data-management/_noun-model.md) at
      the domain root; `design:lint` 0/14 (skipped as `_`-prefixed, by design), `check_links` clean.
- [x] **Boundaries drawn** — 5 load-bearing boundaries; the five nouns defined as a target model.
- [x] **Divergence named** — D1 step-drop · D2 shared-leaf `cyclic_join` · D3 workflow-as-noun ·
      D4 error-at-wrong-time, each anchored to current code and verified in-session.
- [x] **Falsification test passed on all three arms** — the doc resolved real conflicts rather than
      restating the per-surface docs; defining "query" *did* force the A/B call; Brick B stayed
      under the floor (no user-facing vocabulary changed).
- [ ] ~~A/B decided~~ — **deliberately not met.** The fork was forced, analysed, and cold-reviewed,
      then held **OPEN** on the human's call: lock the vocabulary you're sure of, hold open the
      one-way door you're not. This is a re-scope of the goal, **not** an unmet deliverable — the
      analysis is banked in the doc so reopening starts warm.
- [x] ⟢ At a glance **Studied** line written — the revised belief: a definition round and a
      decision round are different rounds, and bundling them overpays.

## Act

**Learnings**:

- **Separate the robust half from the one-way door.** The round's real yield wasn't the doc — it was
  noticing that its two deliverables had *very different* confidence and reversibility, and that
  shipping them together would have dragged a 60%-confidence, one-way decision through a
  high-confidence, two-way gate. Lock what's cheap to reopen; hold what isn't. Same shape as
  [[adopt-artifact-defer-enforcement]] (adopt the artifact, defer the enforcement) — worth promoting
  as a general pre-lock move, not a one-off.
- **`cold-reviewer` earned its keep by *not* blocking.** All six anchors came back grounded and it
  still changed the outcome — anchors 5 (two-way vs one-way door) and 6 (confidence: n=1, 3 probes
  unrun) are what turned "lock A" into "hold A." A review that surfaces-but-never-decides fed the
  human exactly the two facts the call needed. Consistent with [[fair-review-at-lockin]].
- **A `_`-prefixed doc is the cheap home for a non-UI design artifact.** The design corpus is built
  for UI-surface concept docs; a definitional/meta doc has no surfaces or tokens to declare.
  Reusing the lint's existing `_` carve-out beat teaching the lint a second artifact type
  ([[d-gate-artifact-in-design-corpus]] extended: the D-gate artifact is a design-corpus doc, but
  not every design-corpus doc is a surface spec).
- **Definition rounds are legitimately code-free.** No product code shipped and that was correct —
  R160's diagnosis was definitional, so the fix was too. Guarded against the ontology rabbit-hole by
  the round's own brake (success = fewer seams, not a beautiful ontology).

**Promotions**: candidate → `memory/` — "lock the concepts, hold the fork" as a reusable pre-lock
move (the confidence×reversibility split). Log in [`promotions.md`](../promotions.md) if it survives
a second use.

**Prune check**: nothing pruned. No new skill, lint, orchestrator, or process artifact was added —
the round's one addition is a design-corpus doc adopted by hand-use, and it reused an existing lint
carve-out rather than growing the toolchain (Default = don't add, honoured).

## Feeds into → (no auto-pulled successor)

**R162 is not auto-pulled.** The fork is OPEN, so there is no "build model A" round queued. What
exists instead, in priority order:

- **D1 (step-drop) — fixable now, fork-independent.** A correctness bug: steps are dropped when a
  query is composed. Can be scoped as its own bounded round without touching the fork.
- **Reopening the fork is its own commitment gate** — not a build task. It should be triggered by
  evidence (more dogfood, or a build that can't proceed without it), and it must resolve the two
  open engine questions: the silent raw-join-then-top-aggregate double-count (needs a per-source PK)
  and the two-views-vs-genuine-self-join discriminator. **D2/D3 resolve only here.**
- **The 3 unrun live probes** (anti-join · messy/composite key · render) — acceptance checks for
  whichever round reopens the fork.
