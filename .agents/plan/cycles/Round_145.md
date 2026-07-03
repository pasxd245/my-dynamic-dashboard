# Round 145: Refresh a dataset — settings carry-forward + schema-drift gate (⑥ / F9+F10)

**Status**: Planning
**Date started**: 2026-07-04
**Date completed**:
**Flow**: _TBD — run flow-selector at the Design gate exit._

## Goal

**Inherits from ← [Round_144](Round_144.md) "Feeds into" (signed off 2026-07-04)** — per the
signed-off R142 order, the **⑥ refresh theme** opens (rank 3: "every month-2+ upload, by
definition"; multi-round, split by revert seam). This round is the theme's first slice,
**F9 + F10 only**:

- **F9 — settings carry-forward**: re-uploading a new export of an EXISTING dataset must not
  force re-picking everything. The R144 dogfood made this pain **lived, not predicted**: the
  human re-uploaded the FM family four times in one session, re-choosing sheet, dtype
  overrides, and format each time. A refresh pre-fills the wizard from the dataset's
  committed settings (sheet · parse options · dtype overrides + formats · exclusions).
- **F10 — schema-drift gate**: the incoming file's columns are compared against the
  dataset's committed `columns_json` BEFORE commit; drift (added / removed / renamed
  columns) is surfaced loudly, never silently absorbed (purpose.md #5: version, flag,
  adapt — don't reject normal business drift, don't hide it either).

After this round: month-2 of the loop stops being a from-scratch re-configuration. Row
**merge-on-key / precedence (F5+F6) is explicitly NOT this round** — the lived FM exports
are cumulative (FM2.25 carried 6,692 rows superseding the 5,047-row commit), so this
round's refresh semantics can be **whole-table replace**; overlapping non-cumulative
exports pull the merge round next.

_Track: 1. Pulled by ← [Round_144](Round_144.md) Feeds-into + the signed-off ranking in
[2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md)
(rank 3: F9+F10+F5+F6 (⑥) — month-2 blocker) + R144 Act learning #4 (F9 pain lived).
D-gate first per the d-gate-artifact-in-design-corpus lesson._

## Plan

- [ ] **D**: design-corpus touches, signed off before code:
      [upload.md](../../design/data-management/datasets/upload.md) — a **§Refresh** section:
      entry point (the noun-vs-mode question: reuse the wizard against an existing dataset —
      likely via the R15-reserved `target_dataset_id` seam — vs a parallel surface; the
      reuse-not-duplicate discipline
      ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)) says
      reuse), carry-forward scope (sheet · parse options · overrides+formats ·
      exclusions), refresh semantics (**replace** — atomic swap of `original` + parquet +
      `columns_json`, forward-only history), and the drift gate's UX (what blocks vs what
      warns — **domain decision, ask the human**: is a NEW column a warn-and-continue or a
      stop?). [datasets.md](../../design/data-management/datasets/datasets.md) — the Refresh
      affordance on the dataset row/detail + what happens to dependent queries/widgets on
      drift (the existing `query_stale`/`relationship_stale` machinery is the runtime net —
      name it, don't rebuild it).
- [ ] **Candidate rider (decide at D, split if fat)**: the R144 finding-#3 mechanism — a
      "skip rows that exactly repeat the header" parse option (deterministic, zero
      information loss; the real FM export's append seam). It naturally belongs to the same
      ingest-hygiene surface; if D says it fattens the round, it defers with its trigger
      already named.
- [ ] **Flow selector** at D exit; record the table in Do. (Note: a refresh wizard is a
      REUSED surface in a new mode — condition 2 likely reads no; but a drift-gate step may
      be a genuinely new interaction, condition 1/3 may fire. Let the selector decide.)
- [ ] **C**: contract — refresh request shape (probably the batch endpoint's reserved
      `target_dataset_id` graduating from 422-reserved to real), the drift report shape
      (columns added/removed/dtype-changed), error envelopes (reuse `coercion_failed` /
      the 422 families; a drift-block needs its own typed envelope).
- [ ] **B**: settings snapshot read (the dataset already persists what's needed — verify:
      parse options were NOT persisted per-dataset at R15; D must name where carry-forward
      state comes from, likely `source.json` + `columns_json`), drift diff, atomic replace
      (the R143/R144 staged/rollback discipline extends).
- [ ] **F**: wizard in refresh mode (pre-filled steps, drift gate surface); dataset
      row/detail affordance.
- [ ] **I**: i18n en/vi; design-doc sync.
- [ ] Tests: refresh happy path (carry-forward pre-fill == committed settings; replace is
      atomic; dependent query re-runs against new rows) · drift: added column / removed
      column / dtype change each surface per the D decision · refresh with a coercion
      failure → typed 422, dataset UNTOUCHED (atomicity) · the real FM pair (5,047-row
      commit refreshed by the 6,692-row export) as the fixture shape.

## Risks / unknowns

- **Noun-vs-mode** — a parallel "refresh page" would violate the reuse invariant; the
  wizard must be the surface. But the wizard's state machine assumes create-mode; the
  refresh preset must not fork it into two half-duplicated flows. Strict on the skeleton.
- **Where do carry-forward settings live?** R15 never persisted parse options / overrides
  per dataset (`source.json` carries temp_id/sheet/originalName only). D must decide:
  persist the commit settings on the dataset (new metadata, migration-lite) vs re-derive.
  This is the round's likely fat point — split seam if it grows.
- **Drift-gate severity is a domain decision** — block vs warn per drift kind (new column
  vs removed column vs dtype change). Ask the human at D; the `TRÙNG` lesson stands.
- **Replace vs merge boundary** — replace is THIS round (cumulative exports, the lived
  case); merge-on-key/precedence (F5/F6) is the NEXT round. If D discovers replace can't
  serve the real refresh cadence, stop and re-rank rather than absorbing merge.
- **Dependent artifacts on refresh** — saved queries/widgets referencing dropped/renamed
  columns: the run-time stale machinery already flags them; the drift gate should PREVIEW
  that blast radius, not duplicate it.

## Do

_(pending — opens at D)_

## Check

- [ ] D signed off before C/B/F (incl. the drift-severity domain decisions + the rider
      decision).
- [ ] Real FM pair: refresh the 5,047-row dataset with the 6,692-row export — settings
      pre-filled, one commit, dependent weekly-report query returns the wider range.
- [ ] Drift cases surface per the signed-off D (added / removed / dtype-changed).
- [ ] A refresh that fails coercion leaves the existing dataset fully intact.
- [ ] Backend pytest + ruff green; FE tsc + vitest green; human eyeball of the refresh flow
      (gate per selected flow).

## Act

**Learnings:** _(pending)_

**Promotions:** _(pending)_

**Prune check:** _(pending)_ — carried in: `COERCIBLE_DTYPES` is now the full dtype set
(vestigial filter, R144 Act) — prune/repurpose when this theme touches the commit path.

## Feeds into → Round_146 (TBD)

Per the signed-off R142 order: ⑥ round 2 — **F5+F6 merge-on-key / precedence** (overlapping
non-cumulative exports; identity key + precedence are domain decisions) → F8 multi-range
wizard → UI-batch (F7/F3/F4/F12/F13 + carried R140 list). Re-rank allowed at open per
evidence.
