# Implementation Plan: Dashboard & Visualizations (MVP 2)

**Branch**: `005-dashboard-visualizations` | **Date**: 2026-05-08 | **Spec**: `/specs/005-dashboard-visualizations/spec.md`
**Input**: Feature specification from `/specs/005-dashboard-visualizations/spec.md`
**Dependencies**: Spec 003 (Query Builder & Execution), Spec 004 (Saved Queries)

## Summary

Implement a Streamlit-based dashboard surface for MVPs 2+ that analysts can compose from saved queries (spec 004), execute with parameters, render with auto-suggested charts, and export for distribution. The technical approach extends the FastAPI backend with dashboard lifecycle management, parameter validation, and panel execution orchestration; introduces a Streamlit app to replace the React builder for dashboard-specific UI (separate from the query builder); adds chart suggestion logic and KPI computation; and implements full traceability and reproducibility at the dashboard and panel level. The outcome enables recurring weekly reporting workflows where managers open a URL, see up-to-date results with clear refresh metadata, and export artifacts for downstream audit and distribution without manual Excel assembly.

## Delivery Notes (2026-05-09)

- Implementation now includes dashboard lifecycle CRUD, panel curation/reordering, run orchestration, chart suggestion + override persistence, panel-level failure isolation, run history, and export endpoints.
- Streamlit delivery includes dashboard header/health states, parameter input flow, panel rendering, chart viewer, export controls, and run-history drilldown.
- Verification coverage includes contract + integration tests for lifecycle, run flows, chart suggestion behavior, and safety/performance guards.
- Remaining work after this feature pass is operational closure in PDCA records (human confirmation for round closure), not additional unchecked tasks in `tasks.md`.

## Technical Context

**Language/Version**: Python 3.12 (backend + Streamlit), JavaScript ES2022 (React 18 + Vite for query builder, retained)

**Primary Dependencies**:

- Backend: FastAPI, Pydantic, Polars, DuckDB, SQLite (`sqlite3`), plotly (charting)
- Dashboard/UI: Streamlit, pandas (for Streamlit integration), plotly, python-dateutil
- Export: openpyxl (Excel), csv (built-in), PIL/Pillow (PNG capture), reportlab (PDF export)

**Storage**: SQLite metadata DB (dashboard definitions, panel configs, run history); inherited parquet-backed data frames from spec 003/004

**Testing**: `pytest` backend contract + integration suites for dashboard lifecycle, parameter validation, chart suggestion logic; Streamlit smoke tests via `streamlit run --logger.level=debug`; export integrity checks

**Target Platform**: Linux local/dev container with browser-based Streamlit dashboard UI

**Project Type**: Web application (backend API + Streamlit dashboard + React query builder)

**Performance Goals**:

- SC-001: Dashboard header and parameter panel render within 1 second of page load
- SC-002: Each panel (saved query execution + chart rendering) completes within 3 seconds for weekly-report workload with 100k row result sets
- SC-003: Full dashboard refresh (all panels) completes within 30 seconds when executed serially with no cached results
- SC-004: PNG/PDF export completes within 5 seconds for a 5-panel dashboard
- SC-005: Excel/CSV per-panel export completes within 10 seconds for 1M row result sets

**Constraints**:

- Only approved relationship rules (spec 002) usable in saved queries
- Only parameters declared by saved query may be supplied
- No real-time streaming; manual refresh or 15/60 minute intervals only
- Result sets > 100k rows must apply aggregation/binning/sampling for safe chart rendering
- One dashboard scoped to one workspace; no cross-workspace query mixing
- No overlapping auto-refresh runs for the same dashboard
- Recommendation language permitted only when metric contract trust gates pass
- All panel failures isolated; one failed query does not block healthy panels

**Scale/Scope**: Single-workspace, single-manager-user dashboard consumption in MVP 2; up to 10 saved queries per dashboard; result sets up to 1M rows; dashboard composition and parameter history retained for 24 months; refresh cadence 15 minutes or 1 hour (no higher frequency)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. **Principle I (Business-Question-First)**: PASS
   - Spec states business question explicitly: Can analysts turn saved queries into a shared weekly dashboard that replaces manual report assembly?
   - Decision consumed: Replace weekly Excel-based report distribution with a governed, refresh-transparent dashboard surface
   - Primary roles: analyst (composes), manager (consumes), audit (inspects lineage)

2. **Principle II (Metric Contract Before Visualization)**: PASS WITH DESIGN REQUIREMENT
   - Dashboard is a visualization surface, not a metric definition layer
   - KPI cards must disclose source query, aggregation logic, and when metric contract is absent, must label summary as exploratory rather than decision-ready
   - Design must enforce contract-awareness in FR-013, FR-014, and prevent recommendation language without confirmed contracts

3. **Principle III (Relationship Rule Before Cross-Table Query)**: PASS
   - Dashboard consumes saved queries from spec 004, which in turn consume only approved relationships from spec 002
   - Revalidation at dashboard run time ensures broken/downgraded relationships are surfaced as panel errors, not silently passed to manager

4. **Principle IV (Reconciliation Before Recommendation)**: PASS
   - Dashboard surface is governance/reporting, not recommendation output
   - Recommendation language (action verbs, staffing/budget implications) is explicitly blocked by FR-026 when trust gates are not met
   - Reconciliation remains downstream concern (future spec)

5. **Principle V (Challenge & Sensitivity Before Decision-Ready)**: PASS
   - Dashboard surfaces are labeled exploration vs decision-ready per FR-014 and FR-026
   - Challenge/sensitivity gating enforced through UI surface role (analysis workbench vs decision-ready dashboard)
   - Findings labeled sensitive must not appear in decision-ready exports

6. **Principle VI (Traceability For Every Claim)**: PASS WITH DESIGN REQUIREMENT
   - FR-020 requires surface lineage for each panel down to saved query, query version, parameters, refresh timestamp
   - Dashboard run history (FR-019) persists dashboard ID, saved-query versions, parameter values, run start/finish, per-panel status
   - Export artifacts (FR-017, FR-018) include refresh timestamp, filter context, query version, source metadata
   - Design must ensure every visible claim is inspectable to source

7. **Principle VII (Reproducibility From Raw Inputs)**: PASS WITH DESIGN REQUIREMENT
   - Dashboard run records all immutable context: saved-query versions, parameter set, refresh timestamp, per-panel status
   - Design ensures dashboard + parameter set can be re-executed to regenerate same result or flag schema/rule drift
   - Manifest export includes all metadata needed for audit reproducibility

Post-design re-check (after Phase 1): PASS

- `research.md` resolves chart suggestion strategy, parameter validation, and refresh concurrency
- `data-model.md` enforces immutable dashboard composition and run history with full traceability
- API contract keeps approved-only semantics explicit and gates recommendation language
- Streamlit surface role declarations prevent confusion between exploration and decision-ready

## Project Structure

### Documentation (this feature)

```text
specs/005-dashboard-visualizations/
├── plan.md                          # This file (/speckit.plan output)
├── research.md                      # Phase 0 output
├── data-model.md                    # Phase 1 output
├── quickstart.md                    # Phase 1 output
├── contracts/
│   └── dashboard-visualizations.openapi.yaml
└── checklists/
    └── requirements.md              # Existing; maps FR-001..FR-026 + AC-001..AC-011
```

### Source Code (planned touch points)

```text
apps/backend/
├── app/
│   ├── main.py
│   ├── schemas.py
│   ├── core/
│   │   └── metadata_db.py           # Add 3 new tables: dashboards, dashboard_panels, dashboard_runs
│   └── services/
│       ├── dashboard_service.py     # New — orchestrate dashboard CRUD and run lifecycle
│       ├── panel_executor_service.py # New — execute panel queries with parameter validation
│       ├── chart_suggestion_service.py # New — detect column roles, suggest chart type
│       └── [existing: query_service, upload_service, etc.]
└── tests/
    ├── contract/
    │   └── test_dashboard_contract.py # New
    └── integration/
        ├── test_dashboard_lifecycle.py # New
        ├── test_dashboard_run.py       # New
        └── test_chart_suggestion.py    # New

apps/dashboard/                       # New Streamlit app
├── Dockerfile
├── streamlit_app.py                 # Main entry point
├── requirements.txt
├── src/
│   ├── components/
│   │   ├── dashboard_header.py
│   │   ├── parameter_panel.py
│   │   ├── query_panel.py
│   │   ├── chart_viewer.py
│   │   └── export_controls.py
│   ├── api/
│   │   └── dashboard_api.py         # Client for backend API
│   └── utils/
│       ├── chart_config.py
│       ├── parameter_validator.py
│       └── export_helper.py

specs/005-dashboard-visualizations/  # Documentation
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── dashboard-visualizations.openapi.yaml
```

**Structure Decision**: Introduce a new Streamlit app (`apps/dashboard/`) separate from the React query builder. The backend remains unified (FastAPI) with new services for dashboard-specific logic (lifecycle, panel execution, chart suggestion). React builder retained for spec 003 (query creation) and spec 004 (saved-query management).

## Implementation Phases

### Phase 0: Research Plan

**Deliverable**: `research.md` with all NEEDS CLARIFICATION resolved

1. **Chart suggestion strategy**: Research best practices for auto-detecting column roles (numeric, date, categorical, text) from DuckDB/Polars result set schema and row samples. Decide on heuristics for chart type selection (line for time series, bar for categorical, scatter for numeric pairs, etc.) and handling of edge cases (too many categories, all nulls, mixed types).

2. **Parameter validation and injection**: Define parameter schema structure for saved queries, validation rules per parameter type (date range bounds, categorical allowlist, numeric range), and safe parameterized SQL generation to prevent injection attacks.

3. **Refresh concurrency and state management**: Define how overlapping auto-refresh requests are handled (queue, skip, fail), state machine for dashboard run lifecycle (pending → running → completed/failed), and UI state synchronization for long-running refreshes.

4. **Large result set handling**: Research aggregation/binning strategies for result sets > 100k rows. Decide whether to apply at query execution time or visualization time, and how to preserve full-data export while rendering aggregated charts.

5. **Panel isolation and error handling**: Define error types (validation failure, timeout, broken query, schema drift), bounded error messages for each panel, and retry/recovery UX flow.

6. **Export format preservation**: Research PNG/PDF capture approaches for Streamlit dashboards (e.g., Playwright, headless browser, or server-side rendering). Define metadata structure for Excel/CSV exports (lineage columns, parameter context, timestamp).

7. **Metric contract integration**: Define how dashboard KPI cards will surface metric contract trust metadata (confirmed, exploratory, sensitive) and what visualization rules depend on contract status.

Phase 0 output: `research.md` with decisions, rationale, alternatives considered, and technical validation.

### Phase 1: Design And Contracts

**Prerequisites**: `research.md` complete

**Deliverable**: `data-model.md`, `contracts/dashboard-visualizations.openapi.yaml`, `quickstart.md`, updated agent context

1. **Data Model** → `data-model.md`:
   - Dashboard entity: ID, workspace, owner, name, description, composition (ordered list of panel specs), refresh cadence, created/updated/deleted timestamps
   - Dashboard panel: ID, dashboard ID, saved-query reference, parameter defaults, chart override config (type, axes, colors, labels), order, visibility
   - Dashboard run: ID, dashboard ID, run start/end time, status (pending/running/completed/failed), parameter context at run time, per-panel execution state
   - Dashboard run event: audit trail for refresh actions, parameter changes, export requests
   - Validation rules: dashboard name unique per workspace, panel count limits, parameter values within saved-query schema
   - State machines: dashboard run lifecycle, panel execution states

2. **API Contracts** → `contracts/dashboard-visualizations.openapi.yaml`:
   - Dashboard CRUD: POST /dashboards, GET /dashboards/{id}, PATCH /dashboards/{id}, DELETE /dashboards/{id}, GET /dashboards (list per workspace)
   - Panel management: POST /dashboards/{id}/panels, PATCH /dashboards/{id}/panels/{panel_id}, DELETE /dashboards/{id}/panels/{panel_id}
   - Dashboard execution: POST /dashboards/{id}/run (manual refresh), PATCH /dashboards/{id}/refresh-cadence (set auto-refresh), GET /dashboards/{id}/runs (history)
   - Panel data: GET /dashboards/{id}/panels/{panel_id}/data (fetch query results with parameters)
   - Chart suggestion: GET /dashboards/{id}/panels/{panel_id}/chart-suggestion (auto-detect chart type)
   - Exports: POST /dashboards/{id}/export (PNG/PDF), POST /dashboards/{id}/panels/{panel_id}/export (Excel/CSV)
   - Error responses: 400 (validation), 404 (not found), 409 (conflict/concurrency), 422 (unprocessable), 503 (backend unavailable)

3. **UI Component Architecture** (Streamlit):
   - DashboardHeader: title, refresh timestamp, refresh cadence indicator, parameter summary
   - ParameterPanel: input fields per saved-query parameter with validation feedback
   - QueryPanel: KPI cards, chart viewer (with suggestion explanation), results table, lineage summary, export controls
   - ManualRefreshButton & AutoRefreshIndicator: trigger refresh, show cadence status
   - ExportDialog: PNG/PDF for dashboard, Excel/CSV per panel
   - ErrorPanel: isolated panel-level error with retry action

4. **Agent Context Update**:
   - Update `.github/copilot-instructions.md` plan reference to point to `/specs/005-dashboard-visualizations/plan.md`

Phase 1 output: data-model.md, contracts/dashboard-visualizations.openapi.yaml, quickstart.md, updated agent context.

### Phase 2: Implementation Plan (Execution-Ready)

**Start after Phase 1 design approved**

#### Phase 2.1: Backend Schema & Services

1. **Schema migration** (`apps/backend/app/core/metadata_db.py`):
   - Add `dashboards`, `dashboard_panels`, `dashboard_runs`, `dashboard_run_events` tables with immutable audit trail
   - Add indexes for workspace, owner, run history lookups
   - Enforce referential integrity to saved_queries and saved_query_versions

2. **Dashboard service** (`apps/backend/app/services/dashboard_service.py`):
   - Create/read/update/delete dashboards with composition persistence
   - Manage panel order and visibility
   - Validate dashboard name uniqueness per workspace
   - Orchestrate dashboard run lifecycle (start → execute panels → aggregate results → mark complete/failed)
   - Track refresh cadence and prevent overlapping runs

3. **Panel executor service** (`apps/backend/app/services/panel_executor_service.py`):
   - Load saved query by ID and version
   - Validate and inject parameters into query
   - Execute query against DuckDB with timeout (5 seconds for weekly workload)
   - Aggregate result set if > 100k rows
   - Return result with metadata (row count, execution time, status)
   - Handle and isolate query failures (schema drift, broken relationships, timeout)

4. **Chart suggestion service** (`apps/backend/app/services/chart_suggestion_service.py`):
   - Inspect result-set schema and sample data
   - Detect column roles (numeric measure, date dimension, categorical dimension, text)
   - Suggest chart type or explain why no safe chart exists
   - Persist suggestion for reuse

5. **Extend existing services**:
   - Query service: Add methods to fetch query lineage and parameter schema
   - Upload/profile service: No changes needed (inherited)

6. **Backend API endpoints** (extend `apps/backend/app/main.py`):
   - Dashboard CRUD, panel management, run control, export triggers
   - Lineage and traceability endpoints for audit UI
   - Health/status endpoints for service-level error handling

#### Phase 2.2: Streamlit Dashboard App

1. **Create app structure** (`apps/dashboard/streamlit_app.py`):
   - Page layout: header, parameter panel, grid of query panels
   - State management for dashboard ID, active run, parameter context, refresh cadence
   - Lazy load panels on scroll using Streamlit session state

2. **Implement components** (`apps/dashboard/src/components/`):
   - DashboardHeader: render refresh timestamp, cadence indicator, health status
   - ParameterPanel: dynamic input fields per saved-query schema, validation feedback
   - QueryPanel: KPI cards (with contract label), chart viewer, results table preview, lineage link
   - ChartViewer: render plotly chart with fallback to table if no suggestion
   - ExportControls: buttons for PNG/PDF/Excel/CSV with progress indicator
   - ErrorPanel: show panel-level failures with retry button

3. **Implement API client** (`apps/dashboard/src/api/dashboard_api.py`):
   - HTTP client for backend endpoints
   - Parameter validation before submission
   - Error handling and retry logic with exponential backoff

4. **Implement export helpers** (`apps/dashboard/src/utils/export_helper.py`):
   - Excel/CSV generation with lineage metadata columns
   - PNG capture via Streamlit screenshot (or Playwright if needed)
   - PDF generation with dashboard title, refresh timestamp, all visible panels

#### Phase 2.3: Integration & Verification

1. **Hardening tests** (`apps/backend/tests/`):
   - Contract tests for dashboard CRUD, panel management, run lifecycle
   - Integration tests for full dashboard → panel → query → result flow
   - Chart suggestion logic tests (edge cases: nulls, empty sets, type mismatches)
   - Parameter validation and injection prevention tests
   - Export integrity tests (Excel lineage, CSV format, PDF structure)

2. **Smoke tests**:
   - Streamlit app build and startup
   - Manual end-to-end: compose dashboard, set parameters, trigger refresh, view panel, export

3. **Performance profiling**:
   - Measure panel render time, export duration against SC-001..SC-005
   - Profile result-set aggregation for large datasets
   - Identify N+1 query patterns in run orchestration

#### Phase 2.4: Documentation & Deployment

1. **Quickstart** (`specs/005-dashboard-visualizations/quickstart.md`):
   - Step-by-step walkthrough of creating a dashboard from two saved queries
   - Instructions for parameterized refresh, chart override, export
   - Validation checklist (stories 1-4 pass, AC-001..AC-011 verified)

2. **Docker update**: Add `apps/dashboard/Dockerfile` to existing docker-compose.yml

3. **Deployment runbook**: Versioning, rollback, monitoring

## Requirement Traceability (Plan-Level)

| Functional Requirement                           | Phase    | Delivery                                | Notes                                    |
| ------------------------------------------------ | -------- | --------------------------------------- | ---------------------------------------- |
| FR-001 (Dashboard surface)                       | 2.1, 2.2 | Backend API + Streamlit UI              | Stable URL scoped to workspace           |
| FR-002 (Header with metadata)                    | 2.2      | DashboardHeader component               | Refresh timestamp, cadence, health       |
| FR-003 (Panel UI: KPI/chart/table/export)        | 2.2      | QueryPanel + ChartViewer                | Per-panel lineage + export controls      |
| FR-004 (Add/remove/reorder queries)              | 2.1, 2.2 | Dashboard panel management              | Persist order in data model              |
| FR-005 (Persist composition, cadence, overrides) | 2.1, 2.2 | Dashboards + dashboard_panels tables    | Immutable audit trail                    |
| FR-006 (Parameterized runs)                      | 2.1, 2.2 | Panel executor service + API            | Parameter schema from saved query        |
| FR-007 (Validate parameter values)               | 2.1, 2.2 | Parameter validator + ParameterPanel    | Reject invalid before execution          |
| FR-008 (Lazy panel execution)                    | 2.1, 2.2 | Panel executor orchestration            | Independent panel loading                |
| FR-009 (Isolate panel failures)                  | 2.1, 2.2 | Try-catch in panel executor             | One failure doesn't block others         |
| FR-010 (Detect column roles, suggest chart)      | 2.1, 2.2 | Chart suggestion service                | From DuckDB result schema + sample       |
| FR-011 (Analyst override)                        | 2.1, 2.2 | Dashboard panel config + ChartViewer    | Persist overrides per panel              |
| FR-012 (Persist chart overrides)                 | 2.1      | dashboard_panels.chart_config_json      | Reapply on subsequent runs               |
| FR-013 (KPI disclosure: query, logic, params)    | 2.2      | QueryPanel KPI card + lineage           | Show source, aggregation, filter context |
| FR-014 (Exploratory vs decision-ready)           | 2.1, 2.2 | Metric contract awareness in KPI card   | Label based on contract status           |
| FR-015 (Manual + auto-refresh cadence)           | 2.1, 2.2 | Dashboard run control + DashboardHeader | 15 min, 1 hour intervals                 |
| FR-016 (Prevent overlapping runs)                | 2.1      | Dashboard service concurrency guard     | Track active run state                   |
| FR-017 (Export dashboard PNG/PDF)                | 2.2      | ExportControls + export helper          | Visible state at export time             |
| FR-018 (Export panel table Excel/CSV)            | 2.2      | ExportControls + export helper          | Query version + params + timestamp       |
| FR-019 (Dashboard run history)                   | 2.1      | dashboard_runs + dashboard_run_events   | Persist all metadata                     |
| FR-020 (Surface lineage per panel)               | 2.2      | QueryPanel + lineage API                | Down to saved query, version, params     |
| FR-021 (Aggregate 100k+ rows)                    | 2.1      | Panel executor aggregation logic        | Binning/sampling for safe charts         |
| FR-022 (Lazy-load results table)                 | 2.2      | Results table pagination                | Full export still available              |
| FR-023 (Panel render < 3 sec)                    | 2.1, 2.2 | Performance target (SC-002)             | Measure in Phase 2.3                     |
| FR-024 (Single workspace scope)                  | 2.1, 2.2 | Dashboard validation                    | Block cross-workspace mixing             |
| FR-025 (Revalidate saved-query readiness)        | 2.1, 2.2 | Panel executor pre-flight               | Check spec 003/004 before run            |
| FR-026 (No recommendation without trust)         | 2.1, 2.2 | Surface role enforcement                | Only show if gates pass                  |

| Acceptance Criterion | Phase    | Delivery                                                            |
| -------------------- | -------- | ------------------------------------------------------------------- |
| AC-001               | 2.1, 2.2 | Dashboard header + persisted queries render on URL open             |
| AC-002               | 2.1, 2.2 | Panel order persistence + reload verification                       |
| AC-003               | 2.1, 2.2 | Parameter validation rejection + clear feedback                     |
| AC-004               | 2.2      | Every panel includes KPI, chart/explanation, table, lineage, export |
| AC-005               | 2.1, 2.2 | Auto-chart or fallback explanation                                  |
| AC-006               | 2.1, 2.2 | Chart override persistence independent of saved query               |
| AC-007               | 2.1, 2.2 | Refresh cadence indicator + no overlapping runs                     |
| AC-008               | 2.2      | Export metadata: timestamp, version, filter context                 |
| AC-009               | 2.1, 2.2 | Panel errors isolated, others remain usable                         |
| AC-010               | 2.1, 2.2 | 100k+ row charts render safely via aggregation                      |
| AC-011               | 2.2      | Exploration vs decision-ready labeling                              |

## Key Technical Decisions

1. **Streamlit for dashboard UI**: Chosen for rapid iteration, native charting integration, and built-in parameter handling. React builder retained for spec 003/004 to preserve query composition UX.

2. **Lazy panel execution**: Each panel executes independently and asynchronously to unblock manager from waiting for slow queries. Orchestration handles timeout/error isolation.

3. **Chart suggestion heuristic**: Based on column count, data type cardinality, and presence of time dimension. Edge cases (nulls, mixed types, too-many-categories) fall back to table-only with explanation.

4. **Result-set aggregation**: Applied at query execution time if result > 100k rows. Preserves full data in export but visualizes aggregated summary for chart rendering.

5. **Metric contract gating**: KPI cards surface contract status (confirmed, exploratory, sensitive) via badge. Recommendation language blocked when contract is absent or status is not confirmed.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
