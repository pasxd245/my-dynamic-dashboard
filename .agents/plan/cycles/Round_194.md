# Round 194: typed parameters — the engine (item 3.7a)

**Status**: In Progress
**Flow**: **DCFBI** — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-18
**Date completed**: —

## ⟢ At a glance

_(at close)_

## Goal

**Inherits from ← [Round_193](Round_193.md)**: a manager can freeze a week's numbers as a read-only copy.

This round is the other half: the same report can be re-read for a different period without
rewriting a query. A query declares typed parameters, and its filter operands use them. Every read
picks a value (viewer → dashboard → default) and says which value it used.

_Track: 1 (product). Pulled by: release program item 3.7 (typed parameters, starting with `as_of`)
and the accepted design `dashboards/dashboard-filters.md` D1–D3, D6, D7 — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**:

- `QueryDefinition.params` (≤ 8; `date | number | string`; optional default; a date default may be
  relative) and `{"param": name}` operands, allowed only in the D2 places.
- Save checks return 422 naming the field.
- Reads resolve values in this order: viewer, then dashboard, then default, otherwise
  `422 param_unbound`. A wrong-typed value gives `422 param_invalid`.
  - `GET /rows` takes `p.<name>`.
  - `/aggregate`, `/totals`, `/export` and preview take `params` (and `dashboard`).
  - Every read that resolved a parameter answers `resolvedParams`. A query without params answers
    exactly as before.
- `backend.time_zone` resolves `today`.
- Workflow sources run on defaults only. The run stamps `sources[].params`, and a run whose source
  parameter has no default is refused, naming both the parameter and the source.
- The export carries a `Parameters` block (XLSX) and an `X-MDD-Params` header (CSV).

**Falsified if** any of these happens:

- a value lands in the stored definition;
- two `as_of` values change the `definitionVersion`;
- a query without params answers differently from rc.2;
- a reference is accepted outside D2;
- a read guesses a value.

- [x] **D** — no new design doc. `dashboard-filters.md` (Accepted) is the design; wire choices
      are recorded in Do.
- [x] **C** — contracts: `_shared/query.yaml`, `_shared/api-error.yaml`, `_shared/workflow.yaml`,
      `queries/{rows-get, aggregate, totals, export, preview}`, `workflows/{run-post, post, put}`.
      BA review at Contract exit.
- [ ] **B** — `app/params.py` (resolve, bind, save checks, `today` in the zone); reads, preview, save;
      workflow sources + stamp; export block + header; tests (design criteria 1–4, 7 params part, 8)
- [ ] **F** — MSW and builder types only (the builder UI is 3.7b)
- [ ] Reviews: code review, QA, BA after build — rc3.md § Execution

## Risks / unknowns

- **A read path that skips binding** would hand `{"param": …}` to the engine. Mitigation: bind
  centrally, right after a definition is loaded, at every load site (queries router, workflow
  source resolution, resolved columns). A test reads every path with a parameterised query.
- **Byte-identity for queries without params.** `params` is stored as `null` when absent (the hash
  drops nulls) and omitted on the wire; `resolvedParams` is omitted unless something was resolved.
- **Column-family check inside steps** needs the column space at the step's position; computed
  per step from the step plan.

## Do

- 2026-10-18 — D: none new; `dashboard-filters.md` D1–D7 accepted 2026-10-18.

- **BA review at Contract exit: CHANGES** (P1 ×3, P2 ×4). Folded in before code:
  - **F1** — the client-asserted `dashboardParams` is replaced by `dashboard: {id, widgetId}`
    (`dashboard=` + `widget=` on `GET /rows`, the widget load path). The server reads that
    dashboard's saved control values itself. That level is empty until 3.7b adds `controls`, so a
    "dashboard" source can never be a client's say-so.
  - **F2** — only parameters the definition **uses** are resolved, required and echoed (and stamped
    on a run). A declared but unused parameter never claims to have been applied.
  - **F3** — a `date` parameter on a `datetime` column compares by calendar day (lower bounds 00:00,
    upper bounds end of day). `equals` / `ne` / `in` / `not_in` there are refused at save.
  - P2s folded: `label`, `expected`, `source` on the errors; ≤ 24 values; `X-MDD-Params` as ASCII
    JSON on both formats; workflow notes (refs refused, `today` never makes a run stale).
  - Kept: an undeclared `p.` value is ignored silently (D5).

### C — what changed in the contracts

- `_shared/query.yaml`:
  - new `Operand` (literal or `ParamRef`), `ParamRef`, `RelativeDate`, `QueryParam`,
    `ParamValues`, `DashboardRef`, `ResolvedParams`;
  - atom and filter-step operands are now `Operand`;
  - `QueryDefinition.params` (≤ 8);
  - `AggregateRequest.params` / `dashboard` (`DashboardRef`).
- `_shared/api-error.yaml`: `ApiErrorParamUnbound` (`param`, and `sourceId` on a run) and
  `ApiErrorParamInvalid`. The closed code enum gains `read_only_workspace` (missed in R193),
  `param_unbound` and `param_invalid`.
- `_shared/workflow.yaml`: `WorkflowRunSource.params`.
- `rows-get`: `p.<name>`, `resolvedParams`, 422 `oneOf`.
- `aggregate`, `totals`, `export`, `preview`: `params` (+ `dashboard` except preview), and
  `resolvedParams` (for export: the `X-MDD-Params` header).
- `run-post`: 422 `param_unbound`.
- `post` / `put` workflows: a step reference is refused.
- `values.yaml`: `backend.time_zone: UTC`, plus the two codes.

## Check

- [ ] backend · builder · contracts green; `tsc --noEmit`; `ruff check`; lints 0
- [ ] Design criteria 1–4, 7 (params part), 8 as tests
- [ ] BA · code review · QA — no open P0/P1

## Act

_(at close)_

## Feeds into → Round_195

Item 3.7b covers the builder side:

- the query page's Parameters panel and "Use parameter" switch;
- dashboard `controls` (`kind: param`), the bar, URL `p.*`, Reset to saved, Copy link;
- the reach badge.
