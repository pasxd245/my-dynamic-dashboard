# Query-owned relationships + "draw-to-pick is a selection, not a creation"

**Date**: 2026-06-19
**Agent**: Claude Code (Opus 4.8)
**Confidence**: High (human-driven product direction) / Medium (the UX principle — one rep so far)
**Status**: New

## Problem

R87 shipped a pick-pair canvas editor (draw a column→column link to **pick** an existing governed `rel_` →
`addJoin`). At the DFCFBI F1 review the human judged it "almost the same as the current Form builder" and
asked for a "free-form relationship builder."

## Finding

Two intertwined lessons:

1. **Draw-to-pick feels list-like because it _is_ a selection.** A direct-manipulation gesture only earns
   its keep when the act of drawing **creates** something. Drawing a line merely to select an existing
   governed `rel_` is redundant with a `<Select>` — no graph lib, drag, or pan/zoom changes that. The
   verdict was structural, not cosmetic.
2. **The product needs two kinds of relationship.** Governed workspace relationships (predefined,
   reusable, the biz-context ER) are a *library + a constraint*. But a Data Analyst exploring data needs
   **query-owned, ad-hoc relationships** — joins scoped to one query, beyond the declared FKs. The fix is
   NOT "declare into the workspace ER" (that dilutes governance); it's **a query owns its relationships**.

## Finding — the sealed model (human's calls, 2026-06-19)

A query owns its rels: **copy-on-pick** a governed rel into the query (with a back-ref) · **define
free-form** (no governed match needed) · **promote** a useful query-owned rel up into the governed ER.

- (1) **Back-ref / provenance** — yes (`originRelationshipId`).
- (2) **Divergence** — **warn only, no auto-impact**; re-sync is the user's choice; the future data-saver
  owns "save before staling." The query's snapshot is intentionally stable (this also fixes today's
  brittle "edit a governed rel → break the saved query" problem).
- (3) **Promote** — needs dedup/conflict rules.
- (4) **Model/contract/engine change** — accepted; reuse existing validation + join engine, don't reinvent.
- (5) **No backward-compat** — on `dev`, collapse alembic to a fresh `0001`, re-create seed; don't migrate
  old `relationshipId`-shaped queries.

## Evidence

- Files: `workspace/apps/builder/src/features/data-management/queries/QueryCanvas.tsx` (R87 pick-pair,
  retained as the copy-on-pick seed), `joinGraph.ts`; contract `workspace/packages/contracts/_shared/query.yaml`
  (`JoinStep = {relationshipId, type}` → to change); BE `workspace/apps/backend/app/routers/queries.py`,
  `alembic/versions/`.
- Round: [Round_87](../plan/cycles/Round_87.md) (F1 verdict / Act). Vision:
  [2026-06-19-query-owned-relationships brainstorm](../plan/brainstorms/2026-06-19-query-owned-relationships.md).
- Confirms [[dfcfbi-f1-needs-human-review]] — the F1 hard-stop surfaced a load-bearing gap
  before a graph-lib deviation chased the wrong target.

## Recommendation

**Do**: Sequence the theme truth-first — **R88 model** (query-owned rels: contract + BE + engine + FE
copy-on-pick, fresh `0001`, no new UX) → **R89 free-form canvas UX + promote** (React Flow, where drawing
finally *creates*) → **R90+ dashboards**. Keep R87's pick-pair as the governed copy-on-pick path + the
keyboard/SR equivalent.

**Don't**: reach for a graph lib / drag UX to fix a "feels like a list" gesture that only *picks*; let the
query builder mint *governed* relationships inline (query-scoped + explicit promote instead).

## Promotion Candidate?

- [ ] `context/` — the "draw-to-pick is a selection" UX principle is broadly applicable; promote after a
  second confirming rep.
- [ ] `skills/` — no.
- [x] Not yet — needs more validation; the model direction is tracked in the brainstorm + Round_88.
