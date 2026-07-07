# Round 153: "View metadata" — a consolidated read-only column/schema surface

**Status**: In progress — D signed off (2026-07-07); building C/B/F
**Date started**: 2026-07-07
**Flow**: **DCFBI** — set at the D-gate via flow-selector (0/5 fired); recorded in the Do log.

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

- [x] **D-gate pre-flight** — `design-sync --check` the **dataset-detail** design corpus before
      designing on it again (the R148 lesson; R152 already touched it, so re-verify no drift).
      ✅ IN SYNC, no marker; surfaced the `Column`-has-no-`format` finding (bounds Q2). See Do log.
- [x] **D**: design-corpus draft resolving Q1–Q3; flow-selector at D exit. **Human D sign-off.**
      ✅ Properties drawer; DCFBI 0/5; signed off 2026-07-07. See Do log.
- [x] **C**: **confirmed NONE** at D — dtype/hidden ride on `Column`, the read-view reuses
      `GET /datasets/{id}`, and Apply reuses the R152 `PATCH /datasets/{id}/columns`. No contract change.
- [x] **B**: **confirmed NONE** at D — read-only over existing `Column` fields; no backend.
- [x] **F**: `PropertiesDrawer` (right-side Drawer, schema + visibility), opened from the
      `[▦ Columns N/M]` toolbar button + the `Actions ▾ → Properties` entry. Replaced the R152
      popover; reused the R152 mutation. See Do log.
- [x] **I**: i18n `datasets.detail.properties.*` en+vi (parity clean).
- [x] Tests: the surface renders the full schema (name·dtype + hidden checkbox); default-hides +
      show-all; opens from BOTH entries; Apply PATCHes the full set. 5 FE tests.

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

### D-gate pre-flight — `design-sync --check` dataset-detail corpus (2026-07-07)

Ran the CODE-TRUTH map focused on the facts the view-metadata surface designs on. **Verdict:
dataset-detail.md IN SYNC** — R152 reconciled it and cleared its OUT-OF-SYNC marker; confirmed
against code: the `Actions ▾` menu = **Join · Refresh · Rename · Delete** (matches the doc), the
Columns manager + `[▦ Columns N/M]` button match §Column visibility, `PagedRowsView` matches. **No
material drift → no marker stamped.** (One cosmetic imprecision: §Column visibility prose implies
`columns.filter(c=>!c.hidden)` where the code skips-by-flag to preserve `ci`; behaviourally
identical — fix opportunistically when R153's D touches that section, not a blocker.)

**Key design finding (code fact, not drift) — bounds Q2:** the persisted `Column` =
**`{name, dtype, hidden?}` only**. There is **no `format`, no nullability** on the committed
column. `format` exists only as an upload-time `ColumnOverride` retained in `source.json`
commitSettings (date/datetime overrides only), **not** on the `Column`; sample values live in the
rows, not the schema. So a read-view sourced from `GET /datasets/{id}` can honestly show
**name · dtype · hidden** with zero backend; `format` would need a commitSettings read (adds B) and
only ever applies to date columns.

### D — design resolved + signed off (2026-07-07)

Q1–Q3 resolved with the human (AskUserQuestion + a synthesis pass):

- **Q1 (surface)**: a **right-side "Properties" Drawer** opened from a new **`Actions ▾` →
  Properties** entry **and** the existing `[▦ Columns N/M]` toolbar button (two entries, one
  surface). It **absorbs the R152 Columns manager** — the visibility checklist moves from the
  toolbar popover into this drawer, alongside the per-column schema. AntD `Drawer` is already a
  shipped pattern (`WidgetFilterDrawer`).
- **Q2 (fields)**: **name · dtype · hidden** per column — all on the `Column` from
  `GET /datasets/{id}`, **zero backend**. The human's reasoning confirmed: because the panel
  *edits* visibility, it lists **all** columns incl. hidden, each with the show/hide control.
  `format` **not** shown (not on the committed `Column`; deferred). Dataset-level facts stay in
  the always-visible `MetadataStrip`, not duplicated.
- **Q3 (entry/scope)**: `Actions ▾ → "Properties"`; **dataset-only** (query-detail
  `resolvedColumns`/provenance deferred). Schema view + visibility edit only — no
  rename/reorder/dtype.

Design written into the corpus (D-gate artifact lives in `.agents/design/`):
[dataset-detail.md § Properties panel](../../design/data-management/datasets/dataset-detail.md#properties-panel-r153)
(+ synced the row-preview mechanism to skip-by-flag, the stale R152 status header, and the
surface-list references). **Human D sign-off: 2026-07-07.**

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification |
| ------------------------------------ | ------ | ------------- |
| 1. >3 independent states/branches    | no     | A drawer with a checklist + schema rows; preview states pre-exist. |
| 2. New interaction pattern           | no     | Right-side `Drawer` + checklist are both already shipped (`WidgetFilterDrawer`; the R152 popover checklist); the container changes, the interaction (toggle + Apply) doesn't. |
| 3. High user-error risk              | no     | Presentation-only, reversible; at-least-one-visible guard client + server. |
| 4. Contract depends on unresolved UI | no     | **No new contract** — reuses the R152 `PATCH /datasets/{id}/columns`. |
| 5. UX confidence below threshold     | no     | Well-understood; Q1–Q3 resolved with the human at D. |

Result: **Flow: DCFBI** (0/5 fired). Human-review of the drawer feel folds into the Integration walk.

### F + I — Properties drawer built (2026-07-07)

**C/B were empty** (confirmed at D): no contract change, no backend — the surface reads `Column`
from `GET /datasets/{id}` and Apply reuses the R152 `PATCH /datasets/{id}/columns`.

- **[`PropertiesDrawer`](../../../workspace/apps/builder/src/features/data-management/datasets/PropertiesDrawer.tsx)**
  — a **controlled** right-side AntD `Drawer` (default size) that **replaces** the R152 toolbar
  popover. One row per column (incl. hidden): a visibility **checkbox** (name) + a **dtype `Tag`**;
  a "show all" `Switch` in the drawer `extra`; Apply/Cancel at the foot. At-least-one-visible guard
  client-side; Apply reuses `useSetColumnVisibilityMutation` unchanged.
- **Two entries, one surface** — `DatasetDetailPage` owns `propertiesOpen`; the
  `[▦ Columns N/M]` toolbar button (still shows the live count) and a new `Actions ▾ → Properties`
  menu item both open the drawer. The old `ColumnsManager.tsx` was deleted (evolved, not kept).
- **i18n**: `datasets.detail.properties.{title,action}` en+vi (VN "Thuộc tính"); reuses
  `datasets.detail.columns.*` for show-all/apply/guard.
- **Dropped the `Drawer width` deprecation** (used the default size) — same discipline as R152's
  `destroyTooltipOnHide` fix.

Tests: [`column-visibility.test.tsx`](../../../workspace/apps/builder/tests/column-visibility.test.tsx)
grew to **5** — the PagedRowsView pair (unchanged) + drawer default-hide/N-M/show-all, **opens from
the Actions ▾ entry**, and Apply PATCHes the full hidden set. Gates: FE **tsc clean · vitest 309**;
i18n parity clean; backend untouched (**pytest 362**).

## Check

- [x] D signed off before C/B/F (Q1 evolve-vs-drawer · field set · entry point). ✅ 2026-07-07
      — Properties drawer, name·dtype·hidden, Actions ▾ + toolbar entries; DCFBI 0/5.
- [x] The surface shows the per-column schema (name · dtype + visibility checkbox); `format` deferred
      (not on `Column`); opens from BOTH the `Actions ▾` entry and the toolbar button. 5 FE tests.
- [x] Backend/FE gates green; design/plan/markdown lints clean; i18n parity. FE tsc clean · vitest
      309; backend pytest 362 (untouched); design/plan/md lints 0; i18n parity clean.
- [ ] Human review of the surface. **← awaiting human (the DCFBI Integration walk)**

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_154 (TBD)

Re-rank at open. **Carried candidates**: Export ④ (unpark — loop is bright), AI-propose-key (#2
additive), R145 slice 1b (blast-radius preview). **Consider**: a 2nd dogfood probe to re-rank with
fresh evidence now that the R142 backlog is exhausted.
