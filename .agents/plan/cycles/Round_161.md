# Round 161: concepts & boundaries — the query-domain noun-model

**Status**: **In Progress** — 2026-07-22 (definitions drafted in-conversation; canonical doc +
model A/B decision land after we walk them)
**Date started**: 2026-07-22
**Date completed**:
**Flow**: design/decision round — produces a canonical design-corpus concepts doc + the
query-identity decision; **no product UI this round** (build deferred to a later round).

## ⟢ At a glance

<!-- reader-layer authored at close (R159 doctrine). Shipped = what's now true ·
     Studied = predicted→saw→now-believe · Watch = open threads / next bearing. -->

_TBD — authored at close._

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

- [ ] Draft the concept definitions + boundary table (dataset · query · join · relationship ·
      workflow) — the in-conversation walk.
- [ ] Reconcile each boundary against code (R160's traced lines) **and** the existing per-surface
      design docs ([queries.md](../../design/data-management/queries/queries.md),
      [workflows.md](../../design/data-management/workflows/workflows.md),
      [relationships.md](../../design/data-management/workspaces/relationships.md)); mark divergence
      as named debt.
- [ ] Force the **query-identity decision (model A vs B)** from the "query" definition;
      run `cold-reviewer` before locking (engine + promote-to-ER provenance are at stake).
- [ ] Land the canonical doc in the design corpus (pick home + lint conformance); link it from the
      per-surface docs and the load order so the next round reads it before touching queries.
- [ ] Validation: confirm the definitions hold against R160's real-data cases (anti-join,
      messy/composite key) — the deferred probes become the check.

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

## Check

- [ ] Verify outcomes against the goal (canonical doc exists, boundaries drawn, divergence named,
      A/B decided) — the pass/fail verdict.
- [ ] ⟢ At a glance **Studied** line written: what the round taught (the revised belief).

## Act

_(learnings + prune check at close)_

## Feeds into → Round_162 (TBD)

_(the build round(s) toward the target model — e.g. the model-A step-dropping fix + scoped
`cyclic_join` relaxation — if A is chosen; each a separate, bounded round.)_
