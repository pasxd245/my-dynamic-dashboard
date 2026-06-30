# Round 119: Plan gate — data-layer server-side aggregate (GROUP BY)

**Status**: In Progress
**Date started**: 2026-06-30
**Date completed**:
**Flow**: **DCFBI** — no-UI / backend+contract round; set via flow-selector (recorded in the Do log).

> **Scope note (2026-06-30):** originally drafted as a Design-only "Plan gate," now run as **one full
> DCFBI round** (Design done → Contract → Backend → Integration, committed per gate). A plain DCFBI
> round's Design is its first *phase*, not its own round (the round-split pattern is DFCFBI-only, for
> feel-review isolation — N/A here). The Design-phase reframe (DuckDB-not-Polars) is kept below as the
> round's rationale; the build now lands in the same round. ([[round-bundling-revert-seams]])

## Goal

**Inherits from ← [Round_118](Round_118.md)** — the charts-probe synthesis named a
**server-side aggregate / GROUP BY** as the dominant, demand-proven data-layer pull, with the
charts as ready consumers. This round is the **Plan/Design gate** for that theme: scope the first
build, ground it in the real engine, and lock the architecture forks **before** any code.

Build a **server-side aggregate** so a widget binds to `GROUP BY (dims) → aggregates` computed in
DuckDB, instead of fetching capped raw rows and rolling them up client-side (correct totals
regardless of the row cap — the sharpest R110 pull).

_Track: 1. Pulled by ← Round_118 synthesis (the demand-proven dominant pull) + memory
[[charts-probe-data-layer]] / [[2026-06-26-product-value-framing]] (the DuckDB-GROUP-BY compute rung)._

## Grounding (code truth, probed this round)

The synthesis was written from the consumer (charts) side. Reading the producer (engine) side
changes two things the design must respect:

1. **The engine already runs typed DuckDB SELECTs.** A query compiles to
   `build_joined_select` → `query_joined_rows`, which wraps the typed inner SELECT as
   `WITH joined AS (…) SELECT CAST(…) FROM joined LIMIT ? OFFSET ?`
   ([rows_reader.py:256](../../../workspace/apps/backend/app/ingest/rows_reader.py#L256)). A
   GROUP BY aggregate is a **new projection over that existing `joined` CTE**
   (`SELECT dim, SUM(m) FROM joined GROUP BY dim`) — **not a new engine, not Polars, not a YAML
   workflow DSL.** This is the [[charts-probe-data-layer]] / product-value-framing compute ladder:
   client JS → **DuckDB GROUP BY (this round)** → Polars-for-workflows (a later, heavier, not-yet-
   demanded rung). → **Reframes the synthesis's "workflow (YAML + Polars)" wording.**

2. **The grouping spec lives on the Widget, not the Query.** `dimensionCol` / `measureCol` /
   `agg` / `seriesCol` / `measureCol2` are Widget fields
   ([types.ts:24](../../../workspace/apps/builder/src/features/dashboard/types.ts#L24)); the saved
   Query is just a typed row source. So aggregation is **ad-hoc, per-widget, over a query** — which
   points to a **stateless aggregate request** (mirroring `POST /workspaces/{id}/queries/preview`,
   which runs an unsaved definition and persists nothing), **not** baking GROUP BY into the saved
   query definition.

Today's client-side roll-up lives in
[aggregate.ts](../../../workspace/apps/builder/src/features/dashboard/aggregate.ts) and is fed by
the single `?unpaged=true` capped fetch
([hooks.ts:64](../../../workspace/apps/builder/src/features/dashboard/hooks.ts#L64)); the cap is
`DASHBOARD_MAX_ROWS = 10000`. That is exactly the "wrong for totals when capped" path R110 flagged.

## Scoped design (the proposal to lock)

**Shape: a stateless aggregate endpoint over a saved query.**

```
POST /queries/{id}/aggregate
body: { dimensions: [col, …], measures: [{ col?, agg: 'sum'|'count' }, …] }
→ { columns: [{name, dtype}], rows: [[…]], total }   # grouped rows, no cap problem
```

- Resolves the saved query's plan exactly like `run`/`preview` (`_resolve_plan` →
  `build_joined_select`), then composes a GROUP BY **over the resulting `joined` CTE** in a new
  `rows_reader` function (`query_aggregate_rows`). Reuses the typed inner SELECT verbatim — joins,
  query-owned filters, drift semantics (409 stale / composition_cycle) all inherited for free.
- `agg` reuses the Widget's existing `Agg = 'sum' | 'count'`. Validate every `col` against the
  plan's effective columns (the create/preview discipline); `count` needs no col.
- Result is **small** (one row per group), so the cap is irrelevant → totals are correct.

**FE binding:** a new `useWidgetAggregate(queryId, spec)` path (or a mode inside `useWidgetData`)
that, for aggregating chart kinds, calls the aggregate endpoint and feeds the grouped rows straight
to the renderer — **retiring the client-side `sumByGroup`/`countByGroup`/`aggregateScalar`/
`aggregateByGroupSeries`/`sumTwoMeasures` path** for those widgets. Raw-row widgets (scatter,
table) keep the existing fetch — **different widgets, different fetch modes** (synthesis Finding 2).

### What is IN scope (the thin first build)

- `POST /queries/{id}/aggregate` + `query_aggregate_rows` (DuckDB GROUP BY over `joined`).
- Covers the **1-D grouped** + **scalar** shapes → **bar, pie, line, stat** widgets bind to it.
- Contract + MSW handler + the FE binding for those four kinds.

### What is OUT of scope (explicit brakes → follow-up rounds)

- **Time-bucketing** (`date_trunc`, R109) — the first genuinely new SQL op; its own round.
- **2-D / series** (`GROUP BY (dim, series)`, R111/R114 heatmap, multi-bar) and **multi-measure**
  combo (R112) — second grouping/measure axis; follow-up after 1-D lands.
- **TOP-N + "other"** bucketing (R111 cardinality) — needs a UX decision.
- **Server pagination+sort+filter for table** / **sampling for scatter** (raw-row fetch modes) —
  a separate fetch-mode round.
- **Polars / a YAML workflow noun / a saved "grouped query"** — NOT pulled; DuckDB serves this.
- Widget-config-builder refactor (presentation, synthesis Finding 3) — separate theme.

## Locked decisions (Design-gate forks — human sign-off 2026-06-30)

1. ✅ **Engine = DuckDB GROUP BY now, NOT Polars/YAML workflow.** Reframes the synthesis wording;
   matches code reality + the compute-ladder doctrine. Polars/YAML stays a later, not-yet-demanded rung.
2. ✅ **Aggregate is a stateless request, NOT baked into the saved query** — the grouping spec is a
   Widget concern; mirrors `POST /workspaces/{id}/queries/preview`.
3. ✅ **New `POST /queries/{id}/aggregate` endpoint** (a body carries dims/measures cleanly);
   `GET /queries/{id}/rows` stays the raw-row path.
4. ✅ **First-build width = 1-D grouped + scalar** (bar/pie/line/stat) only; defer 2-D, multi-measure,
   time-bucketing, TOP-N to follow-up rounds.

## Plan

- [x] **D (Design):** lock the four forks (human sign-off 2026-06-30); flow → **DCFBI** (no-UI
      branch, recorded in Do); acceptance criteria stated (Do § Acceptance criteria).
- [ ] **C (Contract):** `POST /queries/{id}/aggregate` YAML + `.md`; shared `AggregateRequest`
      schema (dimensions / measures / filters); MSW `withContractValidation` handler.
- [ ] **B (Backend):** `AggregateBody` model + `query_aggregate_rows` (GROUP BY over the `joined`
      CTE / single source) + the router endpoint; pytest (grouping, correct-totals-past-cap, drift
      409, bad-column 422, scalar, filter push-down).
- [ ] **I (Integration/FE):** `queriesApi.aggregate`, request/response types, bind **bar/pie/line/
      stat** in `useWidgetChartData` (push the widget's active R103 filters into the request),
      retire client roll-up for those kinds; FE tests + tsc + lint green.
- [ ] **Post-build:** sync the `data-management/queries` design doc via
      [`design-sync`](../../skills/design-sync/SKILL.md) ([[design-docs-are-source-code]]).
- [ ] `ux-design` skipped — no builder affordance changes (same widget config, correct data).

**Build finding (filter push-down — necessary, not scope creep):** R103 dashboard filters are
per-widget and **lazy** — the filter-options drawer fetches raw rows only for the one open widget
([DashboardDetailPage.tsx:370](../../../workspace/apps/builder/src/features/dashboard/DashboardDetailPage.tsx#L370)).
So an aggregating widget needs **no raw fetch** for its chart (no double-fetch), but the active
filters **must be pushed into the aggregate request** (a categorical name-based `IN` predicate over
the effective columns, mirroring `applyFilters`) or R103 silently regresses for those widgets.

## Risks / unknowns

- **Dtype of aggregates** — `SUM`/`COUNT` results are numeric; the wire CASTs to VARCHAR like
  every other cell, but the aggregate result's `columns[].dtype` must be reported correctly so the
  charts treat the measure as numeric. Resolve in the design doc.
- **GROUP BY over collision-qualified effective names** — the aggregate references effective column
  names; confirm they compose over the `joined` CTE the same way filters already do (they should —
  same alias level).
- **Empty / all-null groups** — define behavior (drop vs keep) in the design.
- **Does retiring client-side aggregation strand any widget?** Scatter/table are raw-row (kept);
  combo/heatmap/multi-bar stay client-side until the 2-D follow-up — confirm the binding switches
  **per chart kind**, not wholesale, so deferred kinds don't break.

## Do

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)) — **no-UI
branch**: this round changes contract / backend / data layer but adds **no new UI surface** (the
charts render unchanged; widget config is identical). The five conditions are UX-framed, so they
read vacuously **no**; the round lands **DCFBI by construction**. Run recorded for the audit trail:

| Condition                            | Fired? | Justification                                                        |
| ------------------------------------ | ------ | -------------------------------------------------------------------- |
| 1. >3 independent states/branches    | no     | No new interactive surface; one new server fetch path per chart kind. |
| 2. New interaction pattern           | no     | No UI interaction added — widgets keep the existing config + render.  |
| 3. High user-error risk              | no     | Read-only aggregate; no destructive/irreversible action.             |
| 4. Contract depends on unresolved UI | no     | The request/response shape is fixed by the locked forks, not by UX.  |
| 5. UX confidence below threshold     | no     | No UX decision in play; the charts are already built consumers.      |

Result: **Flow: DCFBI** (0 conditions fired; no-UI round → DCFBI by construction).

### Acceptance criteria (the no-UI round's Design output → R120 builds against these)

1. `POST /queries/{id}/aggregate` exists, taking `{ dimensions: [str], measures: [{col?, agg}] }`
   and returning `{ columns: [{name, dtype}], rows: [[…]], total }` — grouped rows, **no row cap**
   (one row per group; the result is small by construction).
2. It resolves the saved query's plan via the **same** `_resolve_plan` → `build_joined_select` path
   as `run`/`preview`, then composes `GROUP BY` over the resulting `joined` CTE in a new
   `query_aggregate_rows` (`rows_reader`). Joins, query-owned filters, and drift semantics
   (**409 relationship_stale / query_stale / composition_cycle**, **404 not-found**) are inherited
   and behave identically to `run`.
3. Every `dimensions[]` / `measures[].col` is validated against the plan's **effective** columns;
   an unknown column → **422**. `agg: 'count'` needs no `col`; `agg: 'sum'` requires a numeric `col`.
4. Result `columns[].dtype` reports the **aggregate's** type (a `SUM`/`COUNT` measure is numeric),
   so the charts treat the measure as numeric without client re-typing.
5. **Correct totals regardless of scale** — the headline pull: a `stat`/KPI value and a bar/pie
   total are computed server-side over the WHOLE result, never the capped first N rows (fixes R110).
6. FE: aggregating chart kinds (**bar, pie, line, stat**) bind to the aggregate endpoint and feed
   grouped rows straight to the renderer; their client-side roll-up
   (`sumByGroup`/`countByGroup`/`aggregateScalar`) is **retired for those kinds only**. Scatter,
   table (raw-row) and the deferred kinds (combo/heatmap/multi-bar) keep their current fetch — the
   binding switches **per chart kind**, not wholesale.
7. Contract YAML + MSW handler cover the new endpoint (the [[2026-05-27-msw-contract-anchor]]
   gate); existing query/dashboard contract tests stay green.

## Check

- [x] Forks 1–4 signed off by the human (2026-06-30).
- [x] Flow selected + recorded → DCFBI (no-UI branch).
- [x] Acceptance criteria stated (R120's build target).
- [x] Scope grounded in code truth (engine probe), not only the consumer-side synthesis.

_(No code, contract, or design-doc change this round → `design:lint` / `plan:lint` scope only the
round file; build-gate verification is R120's.)_

## Act

**Learnings**:

- **Probe the producer, not just the consumer.** R118's synthesis (written from the charts side)
  recommended a "workflow (YAML + Polars)" feature. Reading the engine showed queries already
  compile to typed DuckDB SELECTs, so the demand-proven pull (GROUP BY) is a **thin projection over
  the existing `joined` CTE** — DuckDB, not a new subsystem. The smallest useful move was hiding
  behind synthesis wording that named a much bigger one. _Grounding beats the brief._
- The **aggregate is widget-driven** (grouping spec lives on the Widget), so it's a **stateless
  request** like `preview`, not a saved-query property — the existing `preview` endpoint is the
  precedent to mirror.

**Promotions**: none this round — the DuckDB-GROUP-BY-before-Polars rung is already captured in
memory [[charts-probe-data-layer]] / [[2026-06-26-product-value-framing]] (the compute ladder); this
round is a concrete application of it, not a new general lesson.

**Follow-ups (not promotions, just notes):**

- Deferred sub-capabilities (own rounds): time-bucketing (`date_trunc`), 2-D / series GROUP BY,
  multi-measure combo, TOP-N + "other", raw-row fetch modes (table pagination / scatter sampling).
- Post-R120: `design-sync` the `data-management/queries` doc to the shipped aggregate.

## Feeds into → Round_120 (TBD)

The locked aggregate scope — **`POST /queries/{id}/aggregate`** (stateless, DuckDB GROUP BY over the
existing `joined` CTE), **1-D grouped + scalar** width (bar/pie/line/stat), **per-kind FE binding** —
plus the seven acceptance criteria above become R120's build input (DCFBI: Contract → Backend →
Integration). R120's Goal cites this via "Inherits from ← Round_119".
