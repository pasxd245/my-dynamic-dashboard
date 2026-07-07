# Round 153: "View metadata" — a consolidated read-only column/schema surface

**Status**: Planning — D-gate pending (design-sync pre-flight first)
**Date started**: 2026-07-07
**Flow**: TBD — set at the D-gate via flow-selector. Likely DCFBI (reuses the Columns-manager
popover pattern), but a new read-only schema layout could tip it; the selector decides at D exit.

## Goal

**Inherits from ← [Round_152](Round_152.md)** — the "view metadata" candidate surfaced during the
R152 close (a human idea while walking the column show/hide feature). Picked as R153 at open, after
the **entire R142 dogfood-ranked backlog shipped** (R143→R152) — the first between-themes inflection
since the probe.

**The problem:** the dataset-detail page surfaces metadata in three scattered places —
dataset-level in the `MetadataStrip` (workspace · rows · cols · size · uploaded · format), per-column
`dtype` badges in the preview headers, and the R152 **Columns manager** (names + visibility
checkboxes) — but there is **no consolidated, read-only full-schema view**: every column's
name · dtype · (format for dates) · hidden-state at a glance, **without horizontally scrolling** a
wide table. Same pain family as F7 (wide CRM exports).

**The proposal (human, R152 close):** a "view metadata" affordance from the dataset-detail
**`Actions ▾`** menu. **Design lean (NOT settled — the D-gate decides): EVOLVE the Columns manager
into the columns/schema surface** rather than add a second "Metadata" drawer — it already lists all
columns; add the schema fields. One surface for everything-about-columns, per noun-vs-mode + reuse
([[design-gate-noun-vs-mode]]).

## Open design questions (the D-gate — hard-stop for the human)

1. **Evolve vs. new surface** (load-bearing) — grow the R152 Columns manager into a "Columns &
   schema" panel (read fields + the existing visibility edit), OR a separate read-only "Metadata"
   drawer? Lean = evolve (avoid a 2nd column list). If evolve: does the `Actions ▾` "View metadata"
   entry open the **same** panel as the toolbar `[▦ Columns N/M]` button (one surface, two entries),
   or does the toolbar button get absorbed?
2. **What it shows** — the field set per column: name · dtype · format (date/datetime) · hidden.
   Candidates to weigh: nullability, sample value, column provenance (for query-detail). Read-only
   for schema; the only editable thing stays visibility (no rename/reorder/dtype-edit — those are
   upload-time / deferred). Dataset-level facts (rows/size/format) — repeated here or left to the
   `MetadataStrip`?
3. **Entry point + naming** — `Actions ▾` item label ("View metadata" vs "Columns & schema"), and
   whether it also serves the **query-detail** page (which has `resolvedColumns` with provenance) or
   is dataset-only for R153.

## Plan (draft — the D step refines; do NOT build before D sign-off)

- [ ] **D-gate pre-flight** — `design-sync --check` the **dataset-detail** design corpus before
      designing on it again (the R148 lesson; R152 already touched it, so re-verify no drift).
- [ ] **D**: design-corpus draft resolving Q1–Q3; flow-selector at D exit. **Human D sign-off.**
- [ ] **C**: contract only if new wire data is needed (likely **none** — dtype/format/hidden already
      ride on `Column`; a pure read-view reuses `GET /datasets/{id}`). Confirm at D.
- [ ] **B**: likely **zero backend** (read-only over existing `Column` fields). Confirm at D.
- [ ] **F**: the surface (evolved manager or drawer) + the `Actions ▾` entry.
- [ ] **I**: i18n en+vi for the metadata affordance + field labels.
- [ ] Tests: the surface renders the full schema (incl. hidden-state + format); read-only where
      declared; entry point opens it; per D decisions.

## Risks / unknowns

- **Overlap / two-column-lists smell** — the R152 Columns manager already lists columns; a second
  metadata surface would duplicate it. The evolve-lean mitigates, but Q1 must settle it or we ship
  redundancy.
- **Scope creep into a column editor** — keep it a *view* (+ the existing visibility edit); rename /
  reorder / dtype-edit are explicitly out (upload-time or deferred), same guard as R152.
- **Query-detail generality** — `resolvedColumns` carry provenance the dataset `Column` doesn't; if
  Q3 pulls query-detail in, the field set diverges. Default = dataset-only for R153 unless D pulls it.
- **May be small** — if it's "evolve the manager + add read columns," this could be a thin
  D+F(+I) round with no C/B. Right-size at D; don't manufacture layers.

## Do

_(D-gate pre-flight + D log land here.)_

## Check

- [ ] D signed off before C/B/F (Q1 evolve-vs-drawer · field set · entry point).
- [ ] The surface shows the full per-column schema (name · dtype · format · hidden); read-only where
      declared; opens from the `Actions ▾` entry.
- [ ] Backend/FE gates green; design/plan/markdown lints clean; i18n parity.
- [ ] Human review of the surface.

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_154 (TBD)

Re-rank at open. **Carried candidates**: Export ④ (unpark — loop is bright), AI-propose-key (#2
additive), R145 slice 1b (blast-radius preview). **Consider**: a 2nd dogfood probe to re-rank with
fresh evidence now that the R142 backlog is exhausted.
