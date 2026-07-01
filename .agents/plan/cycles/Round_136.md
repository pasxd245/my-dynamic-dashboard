# Round 136: Workflows FE — DESIGN GATE (catalog + builder shape)

**Status**: Complete — **design-first, NO build**; signed off 2026-07-01
**Date started**: 2026-07-01
**Date completed**: 2026-07-01
**Flow**: **DFCFBI**, split per [[dfcfbi-two-round-split]] — this is **D + F1** (design + feel-review
of the surface shape); **R137 = C + B + F2 + Integration** builds it after sign-off.

## Goal

**Inherits from ← [Round_135](Round_135.md)** — the `queries ⇒ workflows` backend module is whole
(consolidate · transform · materialize · read-back). Design the FIRST user-facing surface for it: a
**Workflows catalog + builder**, reusing the shipped query FE patterns. Get the shape signed off
BEFORE building (per [[requirements-table-before-building-ui]] — no design-by-building).

_Track: 1. Pulled by ← the brainstorm's `hg_code` reframing (a consolidation module needs a surface)
and the R131 arc. This round is a design artifact only — it commits a spec + wireframes, not code._

## Plan

- [x] Decide noun-vs-mode ([[design-gate-noun-vs-mode]]): new **Workflows** noun, not a mode of Queries.
- [x] Per-surface requirements table (catalog · builder · output).
- [x] Reuse map to REAL components (StepsEditor, PagedRowsView, QueriesPage shell, api pattern).
- [x] Wireframes for feel-review.
- [x] Surface the OPEN deliverable (value-out) question deferred here.
- [x] **Human feel sign-off (2026-07-01)** — approved as written; **no live preview** confirmed
      (frozen-output model: edit = define, Run = produce); deliverable stays deferred. → R137 builds.

## Design

### Noun vs mode — a NEW noun

Workflows is a **new top-level noun** in the data-management nav group (sibling to Datasets, Queries,
Dashboards), NOT a mode of the Query builder. Why: a workflow consolidates **multiple** sources and
produces a **materialized, frozen** output — the Query builder is single-base, join-graph-oriented,
and live. Forcing workflows into it would fight both its source picker (single `baseSourceId`) and its
live-run model. We REUSE its parts, not its page.

### Builder is SIMPLER than the query builder

The query builder has Form **+ Canvas** tabs (join graph). Workflows consolidate via `UNION ALL BY
NAME` — **no joins, no canvas**. The workflow builder is one Form: pick sources, add steps, save; then
run. So it reuses `StepsEditor` + `PagedRowsView` + the page shell, and needs ONE new small piece: a
**multi-source picker** (the query builder's picks a single base).

### Per-surface requirements table

| Surface | Header | Pager | Scroll | Why |
|---|---|---|---|---|
| **Catalog** (`/workflows`) | Breadcrumb + title + workspace select + name search + **[New workflow]** | AntD table pager (25 default) | page-flow | Mirror `QueriesPage` exactly — same list affordances the user already knows. Rows show name · #sources · steps count · **materialized badge** (`materializedAt` or "never run"). Row → detail. |
| **Builder** (`/workflows/new`, `/workflows/:id/edit`) | Breadcrumb + name + **[Save]** (gated) | none | page-flow | One Form: **multi-source picker** (≥1 `qr_`/`wf_`) → `StepsEditor` (columns = 1st source's schema) → Save. No preview table while editing (materialize is explicit, not live) — keeps the "frozen output" model honest. |
| **Detail / output** (`/workflows/:id`) | Breadcrumb + name + **[Run]** + materialized-at + **[Edit]** | `PagedRowsView` pager | **contained** (inner scroll) | After Run, show the materialized output via `PagedRowsView` (`GET /workflows/{id}/rows`). Empty/"never run" state before first run. Contained scroll so the header + Run stay put. |

### Reuse map (real components)

| Need | Reuse | File |
|---|---|---|
| Nav item + route | add `workflows` key + path | `src/components/AppLayout.tsx` · `src/main.tsx` |
| Catalog list | copy `QueriesPage` shape (filter bar · table · paging) | `src/features/data-management/queries/QueriesPage.tsx` |
| Steps editor | `StepsEditor` — props `{steps, columns, onChange}` | `src/features/data-management/queries/StepsEditor.tsx` |
| Output table | `PagedRowsView` — `{columns, rows, total, page, pageSize, onPageChange, scrollMode}` | `src/features/data-management/_shared/PagedRowsView.tsx` |
| API module | mimic `queriesApi` → `workflowsApi` (create/list/get/run/getRows/delete) | `src/api/queriesApi.ts` |
| i18n | add root `workflows` key in en/vi | `src/i18n/locales/{en,vi}.json` |
| **NEW** | multi-source picker (list of workspace queries + workflows, multi-select, ordered) | _new_ `WorkflowSourcePicker.tsx` |

### Wireframes (for feel-review)

```
CATALOG  /workflows
┌───────────────────────────────────────────────────────────┐
│ Workspaces ▸ Acme ▸ Workflows              [ + New workflow ]│
│ [Workspace ▾]   [Search name… ]                             │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Name              Sources  Steps   Last run           │ │
│ │ Q1 consolidated   3        2       2026-07-01 14:02   │ │
│ │ Provider union    5        1       ● never run        │ │
│ └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘

BUILDER  /workflows/new
┌───────────────────────────────────────────────────────────┐
│ ▸ Workflows ▸ New            name:[ Q1 consolidated ] [Save]│
│ SOURCES (consolidated by union)                            │
│  [✓] qr_ Won deals — Jan     [✓] qr_ Won deals — Feb       │
│  [ ] wf_ Prior quarter out   [ + add source ▾ ]            │
│ STEPS                                                      │
│  ┌ StepsEditor (aggregate / derive / filter / top_n) ──┐  │
│  │  1. aggregate  dims=[region]  sum(amount)           │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘

DETAIL/OUTPUT  /workflows/:id
┌───────────────────────────────────────────────────────────┐
│ ▸ Workflows ▸ Q1 consolidated     [Run]  [Edit]            │
│ Materialized: 2026-07-01 14:02                             │
│ ┌ PagedRowsView (materialized output) ─────────────────┐  │
│ │ region     amount                                    │  │
│ │ North      36900                                     │  │
│ └───────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

## Open question for sign-off — the value-out deliverable

Deferred to this gate (you flagged export earlier). The wireframe above shows the materialized output
**in-app only** (recommended for R137). The download/export decision (Excel/CSV of the materialized
output — the `hg_code` "consolidated out" deliverable) stays OPEN: build it as its own round AFTER you
see the in-app output working, so we decide value-out against something real, not a wireframe.

## Do

**Produced (design artifacts only — no code):** the noun-vs-mode decision (new noun), the per-surface
requirements table (catalog · builder · detail/output), the reuse map to REAL shipped components, the
three wireframes, and the deliverable open-question — all above. This doc IS the round's output.

## Check

- [x] Reuse map verified against real files (component props quoted from source: `StepsEditor
      {steps, columns, onChange}`; `PagedRowsView {columns, rows, total, page, pageSize, onPageChange,
      scrollMode}`; `queriesApi` module pattern) — not guessed.
- [x] Requirements table covers header · pager · scroll · why for every surface
      ([[requirements-table-before-building-ui]]).
- [x] **Human feel sign-off (2026-07-01)** — approved; no-live-preview confirmed.

## Act

**Learnings:**

- **The backend arc made the FE small.** Because materialize is explicit + frozen, the builder needs
  no live-preview path and no join canvas — it's the query builder MINUS complexity, plus one
  multi-source picker. The hard modeling was all upstream (R131–R135); the surface is thin.
- **Design-first caught the preview departure before building it.** The one real feel-risk (no live
  preview, unlike the trained-for query builder) surfaced at the gate and was signed off — not
  discovered mid-build (the [[requirements-table-before-building-ui]] point, applied).

**Promotions:** none — a design gate.

**Prune check:** nothing pruned.

## Feeds into → Round_137 (build)

On sign-off: **R137 = C + B + F2 + Integration** — `workflowsApi` + MSW handlers (contract-anchored) ·
catalog page · builder (multi-source picker + `StepsEditor`) · detail/output (`PagedRowsView` + Run) ·
nav + routes + i18n. Feel-review (F2) runs the app; deliverable stays deferred.
