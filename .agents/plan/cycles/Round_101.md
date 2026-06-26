# Round 101: Dashboard as a persisted noun — create / name / list dashboards (headline-value round)

**Status**: **Planning** — opened from R100's Feeds-into; the human chose "persist-noun next"
(2026-06-26). **Awaiting human Design-gate kickoff/ratification. Not building yet.**
**Date started**: 2026-06-26
**Flow**: TBD — set at the Design gate via `flow-selector`. Likely **DCFBI** (a persisted CRUD surface +
migration + contract; the list/create/detail interaction pattern is already established by Datasets /
Queries) — but the "what config does creating a widget expose" question may pull **DFCFBI**; confirm at
Design exit.

## Goal

Turn the dashboard from R100's single hardcoded `Sales` leaf into a **persisted, user-created noun**: a
user can **create + name + list** dashboards (e.g. `Dashboard › Weekly report`), the nav lists them
**dynamically** from the saved set, and each dashboard persists **which widgets it shows** (each widget =
a saved Query + chart type + group/value mapping — R100's three become a default/seed).

**This is the round where the headline value lands** ([[product-value-framing]] · [[post-mvp-roadmap-migration-first]]):
a dashboard **defined once** that **re-runs live on the latest upload** and **absorbs CRM drift** — the
way out of the report-maintenance treadmill. R100 only proved the render path; persistence is what makes
the analysis a durable, reusable thing.

**Hard constraint:** creating/configuring a dashboard must stay **formula-free** — pick a saved Query +
choose a chart from UI controls; never write/read a formula ([[product-value-framing]] #1).

_Track: 1 (product). Pulled by ← R100 Feeds-into + the human's F1 feedback (dynamic widgets · multiple
named dashboards · settings) + "persist-noun next" choice. Per the [Evolution Rule](../../AGENTS.md)._

## Open Design questions (resolve at the Design gate — do not pre-decide)

1. **Data model — what IS a dashboard?** Proposed: `Dashboard { id, workspaceId, name, definition }`
   where `definition = { widgets: Widget[] }` and `Widget = { queryId, chartType, title, groupColumn,
   valueColumn?, agg }`. Workspace-scoped (consistent with Datasets/Queries IA). Embedded-JSON
   `definition` mirrors `queries.definition` (vs a separate `dashboard_widgets` table). **Confirm.**
2. **Widget → query binding.** Now that it persists, bind by **`queryId` (FK)**, not R100's by-name
   lookup. Confirm + decide drift behavior if the query is deleted/renamed (flag, like query-stale?).
3. **Scope of "create" in THIS round.** Thinnest valuable slice: create a named dashboard + add widgets
   by **picking a saved Query + choosing a chart type + group/value columns** (sensible defaults). Rich
   interactivity (filters/date-range/drill — feedback ①) is the **next** round; keep them separate.
4. **Migration.** New alembic revision adding a `dashboards` table (clean-slate `0001` is the current
   baseline). Confirm shape + that it's additive.
5. **Nav.** Dynamic list under the `Dashboard` group from `GET …/dashboards` (replaces R100's hardcoded
   `sales-dashboard` leaf); empty state when none. A `New dashboard` affordance.
6. **Persist-first vs FE-state-first.** R100 was FE-only; this round's value REQUIRES persistence. Decide
   whether the create/config UX gets an F1 discovery pass (DFCFBI) before the contract freezes, or the
   CRUD shape is obvious enough for DCFBI.
7. **Settings (feedback ③).** Keep minimal here — name is the only real setting; layout/default-range
   deferred. Confirm nothing more is in scope.

## Plan (provisional — finalize at Design)

1. **Design gate** — ratify the data model + the 7 questions; run `flow-selector` + `ux-design
   --design-spec`. **Human ratify.**
2. **Contract** — `Dashboard` schemas + CRUD endpoints (create / list / get / update / delete), MSW
   aligned, YAML committed.
3. **Backend** — SQLModel `Dashboard` + alembic migration; per-endpoint behavior + conformance tests.
4. **Frontend** — list/create/detail surface; dynamic nav; the detail reuses R100's widget components,
   now bound by `queryId` from the persisted definition.
5. **Integration** — create a `Weekly report` dashboard against the real seeded backend; it persists,
   re-runs live, and survives a reload. **Human confirm + Complete.**

## Acceptance criteria (finalize at Design)

+ [ ] A user can **create + name** a dashboard and it **persists** (survives reload / re-run).
+ [ ] The `Dashboard` nav lists saved dashboards **dynamically**; `New dashboard` works; empty state.
+ [ ] A dashboard's widgets bind to saved Queries by id and render **live** aggregates (reusing R100's
  widget components).
+ [ ] Backend `Dashboard` entity + **additive alembic migration**; contract + conformance tests pass.
+ [ ] Creating/configuring stays **formula-free** (pick query + chart via UI).

## Do

### Plan-gate draft — opened from R100 (2026-06-26)

R100 (static render-proof) Complete + signed off. Human's F1 feedback (widgets should be dynamic ·
nav should host created dashboards like `Dashboard › Weekly report` · do we need settings?) maps to this
theme; human chose **persist-noun first** (value-first sequence: persist → dynamic widgets → settings).
Drafted the goal, data-model proposal, and the 7 open Design questions. **Next: human Design-gate
kickoff.**

## Check

_Pending — populated at Integration._

## Act

_Pending — round in planning._

## Feeds into

**Feeds into →** the rest of the dashboard theme, after the noun persists:

+ **Dynamic / interactive widgets** (feedback ①) — filters · date-range · drill-down · swap
  dimension/measure via UI; **formula-free**.
+ **Dashboard settings** (feedback ③) — beyond name: layout, default range; minimal-first.
+ **Snapshot / Report noun** + **heavy-DA #3 (Dash) / Polars compute** — parked
  ([[product-value-framing]]; Polars may arrive earlier as core workflow compute, not gated by #3).
