# Round 137: Workflows FE — build (catalog + builder + detail/Run)

**Status**: Complete — F2 signed off 2026-07-01
**Date started**: 2026-07-01
**Date completed**: 2026-07-01
**Flow**: **DFCFBI** — C + B + Integration built here; **F2 hard-stops for the human** (MSW/tsc/vitest
can't see CORS/layout/feel — [[dfcfbi-f1-needs-human-review]]).

## Goal

**Inherits from ← [Round_136](Round_136.md)** (signed-off design) — build the first user-facing surface
for the `queries ⇒ workflows` module: a **Workflows catalog + builder + detail/Run**, reusing the
shipped query FE patterns. No live preview (frozen-output model, signed off).

_Track: 1. Pulled by ← R136 design gate. Reuses `StepsEditor`, `PagedRowsView`, the `QueriesPage`/
`QueryDetailPage` shells, and the `queriesApi`/hooks patterns — one genuinely new component
(`WorkflowSourcePicker`) and one new column-resolver hook (`useSourceColumns`)._

## Plan

- [x] Types (`workflows/types.ts`) + `workflowsApi` (create/list/get/run/getRows/delete) + hooks.
- [x] `WorkflowSourcePicker` (multi-select `qr_`/`wf_`); `useSourceColumns` (first-source schema for `StepsEditor`).
- [x] `WorkflowsPage` (catalog) · `WorkflowCreatePage` (builder) · `WorkflowDetailPage` (Run + `PagedRowsView`).
- [x] MSW handlers + fixtures (contract-validated); nav + routes + i18n (en/vi).
- [x] tsc + vitest (smoke tests exercising the handlers against contracts).
- [x] **F2 — human ran the app** (create → run → view output); signed off 2026-07-01.

## Risks / unknowns

- **No `PUT /workflows/{id}` exists** (R132 CRUD is create/list/get/delete). So R137 ships
  create/run/view/delete — **editing a saved workflow is deferred** (needs an update endpoint; "edit"
  = recreate for now). Honest scope correction found during build; the design gate assumed an Edit
  affordance that the backend can't yet serve.
- **No live preview** (signed off R136) — the builder authors steps against the first source's
  columns (`useSourceColumns`), but the shaped result is only visible after Run on the detail page.
- **MSW is stateless** — `getWorkflow`/`runWorkflow` return a MATERIALIZED fixture so the dev/detail
  UI shows output immediately; a create-then-run round-trip against the mock won't persist (real
  stateful behavior is the seeded backend's job — [[seed-data-vs-msw-complementary]]).
- **`DeleteConfirmModal` union widened** to include `'workflow'` (+ `resources.workflow` i18n) — a
  small additive change to a shared component.

## Do

**Built:** the Workflows FE surface. Data layer: `workflowsApi` + TanStack hooks (+ `useSourceColumns`
resolving a `qr_`/`wf_` source's columns for the steps editor) + MSW handlers + fixtures, all
contract-anchored. Surfaces: catalog (`QueriesPage` shape + [New workflow] + never-run badge), builder
(`WorkflowSourcePicker` multi-select → reused `StepsEditor`; workspace + name + Save; no canvas, no
live preview), detail (definition summary + **Run** → materialize → `PagedRowsView` of the frozen
output; never-run state; 409 stale/cycle messages; delete). Integration: nav item + 3 routes + en/vi
i18n. **Scope correction:** edit deferred (no `PUT` endpoint).

**Verification:** `tsc` clean · vitest green — new `workflows.test.tsx` (3 smoke tests) drives
`listWorkflows`/`getWorkflow`/`workflowRows` through the catalog + detail so their responses are
contract-validated; full FE suite passes (one unrelated join-graph test is load-flaky — 42/42 in
isolation). **F2 not yet run** (needs the human).

## Check

- [x] `tsc --noEmit` clean; workflow smoke tests green (handlers contract-validated on call).
- [x] Catalog lists + navigates; detail Runs → shows materialized output; 404/never-run states render.
- [x] Reuses `StepsEditor`/`PagedRowsView`/shells verbatim; one new picker + one resolver hook.
- [x] **F2 — human ran the app** (created a workflow from a seeded query, Ran it, viewed output) — signed off 2026-07-01.

## Act

**Learnings:**

- **The signed-off "simpler builder" held** — no canvas, no live preview, so the builder is mostly the
  reused `StepsEditor` plus a multi-select. The design gate's simplification paid off in the build.
- **The missing `PUT` surfaced only at build time** — the design gate wireframe showed [Edit], but the
  backend has no update route. Caught here, scoped out cleanly (recreate-for-now); an update endpoint
  is a clean follow-up. A reminder that a design gate can't see every backend gap.

**Promotions:** none — builds the R136 design.

**Prune check:** nothing pruned.

## Feeds into → Round_138

On F2 sign-off: the surface is live (create · run · view · delete). Candidate next pulls: a
`PUT /workflows/{id}` + builder edit mode; the value-out **deliverable** (Excel/CSV download of the
materialized output — deferred at R136, now decidable against a working output).
