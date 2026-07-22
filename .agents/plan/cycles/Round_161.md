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

_(the definitions walk + reconciliation + decision accrue here)_

## Check

- [ ] Verify outcomes against the goal (canonical doc exists, boundaries drawn, divergence named,
      A/B decided) — the pass/fail verdict.
- [ ] ⟢ At a glance **Studied** line written: what the round taught (the revised belief).

## Act

_(learnings + prune check at close)_

## Feeds into → Round_162 (TBD)

_(the build round(s) toward the target model — e.g. the model-A step-dropping fix + scoped
`cyclic_join` relaxation — if A is chosen; each a separate, bounded round.)_
