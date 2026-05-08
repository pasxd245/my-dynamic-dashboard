# Feature Specification: Dashboard & Visualizations (MVP 2)

**Feature Branch**: `005-dashboard-visualizations`
**Created**: 2026-05-08
**Status**: Draft
**Input**: MVP 2 dashboard requirement from `docs/analysis/09-mvp-plan.md`
and user description above.

## Business Question _(mandatory for this project)_

> "Given a set of saved business queries, can an analyst turn them into a
> shared weekly dashboard that a manager can open by URL, refresh with the
> right parameters, and trust at a glance without rebuilding the report in
> Excel every week?"

**Decision consumed**: Whether the product can replace manual weekly report
assembly and distribution with a governed dashboard surface that saves at
least 2 hours per reporting cycle while preserving business context,
lineage, and refresh transparency.

**Primary roles**: analyst (curates dashboard composition, parameters, and
chart overrides), manager (consumes the weekly dashboard, reviews KPI and
chart evidence, exports results for follow-up).

**Constitution alignment**:

- **Principle I (Business-Question-First)**: The dashboard exists to answer a
  recurring business question, not to display charts for their own sake.
- **Principle II (Metric Contract Before Visualization)**: KPI cards and any
  metric-like summary shown to managers must expose the aggregation logic,
  filters, time anchor, and saved-query source. Where a confirmed metric
  contract does not yet exist, the surface must label the summary as
  exploratory rather than decision-ready.
- **Principle III (Relationship Rule Before Cross-Table Query)**: The
  dashboard may only run saved queries that remain valid under approved
  relationship rules from spec 002 and query definitions from spec 003.
- **Principle VI (Traceability For Every Claim)**: Every KPI, chart, and table
  must reveal which saved query, parameters, refresh time, and source fields
  produced it.
- **Principle VII (Reproducibility From Raw Inputs)**: A dashboard refresh is a
  reproducible run with persisted query versions, parameter values, output
  timestamps, and export artifacts.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Open the weekly dashboard and understand current status (Priority: P1)

A manager opens a Streamlit dashboard URL and immediately sees when it was
last refreshed, which saved queries are included, the current parameter
context, headline KPIs, supporting charts, and the underlying results table.

**Why this priority**: This is the business payoff. If the manager cannot open
the dashboard and understand the latest state within seconds, the workflow has
not replaced manual weekly report assembly.

**Independent Test**: Open a dashboard configured with multiple saved queries,
verify that the header, KPI panel, chart gallery, results table, and export
controls all render with the active refresh timestamp and parameter summary.

**Acceptance Scenarios**:

1. **Given** a dashboard with one or more saved queries, **When** the manager
   opens the dashboard URL, **Then** the header shows dashboard title,
   workspace, last refresh timestamp, refresh mode, and current parameter
   context.
2. **Given** a dashboard query has fresh results, **When** the manager views
   the query panel, **Then** they see KPI cards, at least one chart or an
   explicit "table-only" explanation, and a results table sourced from the
   same query run.
3. **Given** a dashboard contains multiple query panels, **When** the manager
   scrolls through the page, **Then** each panel clearly shows its saved query
   name, description, version, refresh status, and export actions.

---

### User Story 2 — Select, remove, reorder, and parameterize saved queries (Priority: P1)

An analyst curates the dashboard by adding saved queries from the library,
removing queries that are no longer needed, reordering panels for narrative
flow, and supplying parameter values such as date range, entity filter, or
threshold before running the dashboard.

**Why this priority**: The dashboard is valuable only if analysts can turn the
saved-query library from spec 004 into a repeatable, manager-facing reporting
surface without rebuilding queries.

**Independent Test**: Create a dashboard from three saved queries, reorder the
panels, remove one, apply parameter values, save, reopen the dashboard, and
confirm that composition and parameter defaults persist.

**Acceptance Scenarios**:

1. **Given** an active saved-query library, **When** the analyst adds a saved
   query to the dashboard, **Then** the dashboard stores the query reference,
   default chart settings, and parameter schema for that panel.
2. **Given** multiple query panels on the dashboard, **When** the analyst
   reorders them, **Then** the new order is persisted and the manager sees the
   same order on the next load.
3. **Given** a saved query defines parameters, **When** the analyst opens the
   parameter panel, **Then** only the parameters declared by that saved query
   are shown and each value is validated before execution.
4. **Given** a parameterized saved query, **When** the analyst refreshes the
   dashboard with a new date range or filter value, **Then** the dashboard run
   records the parameter set used for each panel.

---

### User Story 3 — Receive chart suggestions but keep analyst control (Priority: P1)

The system inspects query result columns, suggests suitable charts, and renders
them automatically, while still letting the analyst override chart type,
sorting, labels, colors, and visible fields when business context demands a
different visual explanation.

**Why this priority**: Auto-charting saves setup time, but unmanaged charting
risks misleading business readers. Analyst override is required to preserve
interpretability.

**Independent Test**: Run a saved query that returns date, category, and
numeric fields; verify the default chart suggestion is rendered, then override
it to a different supported chart type and confirm the override persists.

**Acceptance Scenarios**:

1. **Given** a result set containing one time column and one numeric measure,
   **When** the panel renders, **Then** the default chart suggestion is a line
   chart unless the analyst has stored a different override.
2. **Given** a result set containing one categorical dimension and one numeric
   measure, **When** the panel renders, **Then** the system suggests a bar chart
   and explains the chosen axes in the chart configuration summary.
3. **Given** the analyst changes chart type, labels, or colors, **When** the
   dashboard is reopened, **Then** the override is reapplied without changing
   the underlying saved query definition.
4. **Given** a result set is unsuitable for a safe chart suggestion,
   **When** the panel loads, **Then** the system falls back to KPI and table
   views with an explicit explanation of why no default chart was selected.

---

### User Story 4 — Refresh and export the dashboard for weekly distribution (Priority: P2)

An analyst or manager manually refreshes the dashboard or enables a batch
auto-refresh cadence, then exports either the visual dashboard (PNG/PDF) or
the underlying data table (Excel/CSV) for distribution and audit.

**Why this priority**: The weekly reporting workflow needs both reliable reruns
and lightweight distribution options beyond simply viewing the dashboard live.

**Independent Test**: Refresh a dashboard manually, enable 15-minute refresh,
export the dashboard to PDF and PNG, and export a panel table to Excel and CSV
with the same filter context applied.

**Acceptance Scenarios**:

1. **Given** a dashboard with current results, **When** the user clicks manual
   refresh, **Then** each panel reruns with the active parameter set and the
   header refresh timestamp updates when all requested panels finish.
2. **Given** the analyst enables auto-refresh, **When** they select 15 minutes
   or 1 hour, **Then** the dashboard reruns only on that interval and clearly
   shows the active cadence.
3. **Given** a completed dashboard run, **When** the user exports the dashboard
   as PNG or PDF, **Then** the artifact includes dashboard title, refresh time,
   active filters, and the visible panels in the persisted order.
4. **Given** a completed query panel, **When** the user exports the results
   table as Excel or CSV, **Then** the exported file uses the exact parameter
   context and query version shown in the panel.

---

### User Story 5 — Fail safely when one query panel is broken or slow (Priority: P2)

If one saved query is invalid, slow, or temporarily unavailable, the dashboard
keeps rendering the other panels, surfaces a bounded error for the failed
panel, and preserves enough context for the analyst to repair it.

**Why this priority**: A manager-facing dashboard cannot fail as a single
monolith because one query or backend call is unhealthy.

**Independent Test**: Break one saved query by removing a referenced field,
load the dashboard, and confirm only the affected panel shows an error while
the rest of the dashboard remains usable.

**Acceptance Scenarios**:

1. **Given** one saved query fails validation, **When** the dashboard loads,
   **Then** only that panel shows a bounded error message with the saved query
   name, failure reason, and retry action.
2. **Given** one panel exceeds the render-performance target, **When** the
   dashboard is refreshed, **Then** that panel enters a delayed state while
   already-completed panels stay visible.
3. **Given** the backend is unavailable, **When** the dashboard opens, **Then**
   the app shows a page-level service-health message and does not display stale
   data as if it were fresh.

### Edge Cases

- Saved query exists in the library but no longer validates because a source
  field, relationship rule, or query version became invalid.
- Result set is empty after applying parameters; the dashboard must show a
  zero-state explanation rather than a blank chart.
- Result set contains more than 100k rows; visual layers must aggregate or
  sample safely before rendering, while the table export remains complete.
- Result set has many nulls, mixed types, or too many distinct categorical
  values for a readable default chart.
- Analyst attempts to provide a parameter not declared by the saved query; the
  dashboard must reject the run rather than silently ignore the value.
- Dashboard contains panels from only one workspace; cross-workspace query
  selection is out of scope and must be blocked.
- Auto-refresh is enabled but a prior run is still in progress; the system must
  avoid overlapping runs for the same dashboard.
- Export is requested before a panel has completed successfully; the system must
  block the export or label it as partial.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a dashboard surface that can be opened by a
  stable URL within a single workspace and render one or more saved-query
  panels from spec 004.
- **FR-002**: System MUST display, at minimum, a dashboard header with title,
  last refresh timestamp, refresh mode, active parameter summary, and service
  health state.
- **FR-003**: System MUST display, for each query panel, a KPI section, chart
  gallery, results table, lineage summary, and export controls.
- **FR-004**: System MUST allow analysts to add, remove, and reorder saved
  queries on a dashboard without modifying the underlying saved query.
- **FR-005**: System MUST persist dashboard composition, including selected
  saved queries, panel order, refresh cadence, and chart overrides.
- **FR-006**: System MUST support parameterized dashboard runs using only the
  parameter schema declared by each saved query.
- **FR-007**: System MUST validate parameter values before execution and reject
  missing, malformed, or out-of-range values with user-friendly feedback.
- **FR-008**: System MUST execute saved queries lazily so that dashboard panels
  load independently rather than waiting for every query to complete first.
- **FR-009**: System MUST isolate panel failures with bounded error handling so
  one failed panel does not prevent the rest of the dashboard from rendering.
- **FR-010**: System MUST detect column roles from query results and suggest a
  supported chart type from the set { bar, line, scatter, pie, heatmap }.
- **FR-011**: Auto-chart output MUST be a suggestion only; analysts MUST be able
  to override chart type, axis assignment, color palette, labels, sort order,
  and visible fields per panel.
- **FR-012**: System MUST persist analyst chart overrides at the dashboard-panel
  level and reapply them on subsequent runs.
- **FR-013**: System MUST compute and display KPI summaries that disclose source
  query, aggregation logic, applied parameters, and refresh timestamp.
- **FR-014**: System MUST distinguish exploratory summaries from
  decision-ready summaries when a confirmed metric contract is absent.
- **FR-015**: System MUST support manual refresh and optional auto-refresh
  intervals of 15 minutes and 1 hour; no real-time streaming is permitted.
- **FR-016**: System MUST prevent overlapping auto-refresh executions for the
  same dashboard and must surface the currently running status.
- **FR-017**: System MUST support dashboard export to PNG and PDF using the
  visible dashboard state at the moment of export.
- **FR-018**: System MUST support per-panel table export to Excel and CSV using
  the exact query version, parameters, and result snapshot shown to the user.
- **FR-019**: System MUST record a dashboard run history including dashboard
  identifier, saved-query versions, parameter values, run start, run finish,
  and per-panel status.
- **FR-020**: System MUST surface lineage for each panel down to saved query,
  query version, parameter values, and refresh timestamp from the current run.
- **FR-021**: System MUST handle result sets above 100k rows by applying
  aggregation, binning, or sampling rules suitable for visualization before
  rendering charts.
- **FR-022**: System MUST keep results-table rendering performant through lazy
  loading, pagination, or chunked retrieval while preserving full-data export.
- **FR-023**: System MUST complete chart rendering for a single dashboard panel
  in under 3 seconds for the target weekly-report workload when valid cached or
  freshly computed aggregated data is available.
- **FR-024**: System MUST scope dashboards and their runs to a single workspace;
  no dashboard may mix saved queries across workspaces in MVP 2.
- **FR-025**: System MUST revalidate saved-query availability and execution
  readiness against specs 003 and 004 before each dashboard run.
- **FR-026**: System MUST not display recommendation language, action verbs, or
  decision-ready labeling when required trust boundaries are not met.

### Acceptance Criteria

- **AC-001**: Opening a dashboard URL shows the header, refresh metadata,
  parameter summary, and persisted query panels without requiring query rebuild.
- **AC-002**: Adding, removing, and reordering query panels persists across
  reload and is reflected identically for manager viewers.
- **AC-003**: Only declared saved-query parameters can be supplied, and invalid
  values block execution with a clear validation message.
- **AC-004**: Every successfully rendered panel includes KPI, chart or
  table-only explanation, table preview, lineage summary, and export controls.
- **AC-005**: Auto-chart suggestion selects a supported chart type or explains
  why no safe chart was chosen.
- **AC-006**: Analyst chart overrides persist independently of the saved-query
  definition and reappear on subsequent dashboard loads.
- **AC-007**: Manual refresh and 15-minute / 1-hour auto-refresh execute with a
  visible cadence indicator and no overlapping runs.
- **AC-008**: PNG/PDF dashboard export and Excel/CSV panel export preserve the
  visible filter context, refresh timestamp, and query version.
- **AC-009**: A failed or slow panel does not block healthy panels from
  rendering and exposes a bounded error state with retry guidance.
- **AC-010**: Panels using 100k+ row result sets still render usable charts via
  aggregation or sampling within the target performance budget.
- **AC-011**: Dashboard surfaces label exploratory versus decision-ready metric
  summaries according to available trust metadata.
- **AC-012**: Each visible claim on the dashboard can be traced to a saved
  query, query version, parameter set, and refresh timestamp.

### Dependencies

- **Spec 003 — Query Builder & Execution**: Supplies query-definition format,
  execution semantics, parameter execution path, and result/export behavior.
- **Spec 004 — Saved Queries**: Supplies the saved-query library, immutable
  query versions, metadata, validation state, and execution history context.
- **Spec 002 — Relationship Rules**: Governs whether cross-table saved queries
  remain eligible for dashboard execution.

### Out of Scope (MVP 2)

- Real-time streaming or push-based refresh beyond manual, 15-minute, or
  1-hour batch refresh.
- Cross-workspace dashboards or shared query composition across workspaces.
- Free-form query editing from the Streamlit dashboard surface.
- Multi-user editing conflict resolution for the same dashboard.
- Narrative recommendations, what-if simulation, anomaly explanation, or AI
  insight generation.
- Scheduled email delivery, external embed widgets, or public anonymous URLs.

### Key Entities

- **Dashboard**: A persisted workspace-local definition containing title,
  description, selected saved-query panels, panel order, refresh cadence, and
  dashboard-level export settings.
- **Dashboard Panel**: A dashboard slot bound to one saved query version with
  parameter schema, chart overrides, KPI configuration, table settings, and
  render status.
- **Dashboard Run**: A reproducible execution record for a dashboard refresh,
  capturing parameter values, run timing, per-panel statuses, and artifact
  references.
- **Visualization Suggestion**: The system-generated default chart proposal for
  a panel, including chart type, x/y assignment, grouping, sort, and rationale.
- **Chart Override**: Analyst-authored chart customization that replaces or
  amends the default suggestion without changing the saved query itself.
- **Metric Summary**: A KPI-style value shown on a panel together with its
  aggregation method, unit, filters, time anchor, and trust label.
- **Export Artifact**: A persisted PNG, PDF, Excel, or CSV output tied to a
  dashboard run or panel run with timestamp and parameter context.

## Streamlit Surface Architecture

The dashboard surface is a separate Streamlit process connected to the FastAPI
backend. The FastAPI service remains the source of truth for saved queries,
dashboard definitions, execution, validation, and export metadata.

### Layout

1. **Page Header**: dashboard title, workspace name, trust posture, last refresh
   timestamp, refresh cadence, manual refresh button, and active parameter chip
   summary.
2. **Dashboard Controls Row**: saved-query add/remove actions, panel reorder
   controls, dashboard-level parameter drawer, and export dropdown.
3. **Panel Stack**: one vertically ordered query panel per saved query.
4. **Panel Content Order**: panel title and metadata, KPI cards, chart gallery,
   table preview, lineage / query-context disclosure, panel-specific export.
5. **Error and Zero States**: bounded panel error container, loading skeleton,
   no-results state, and stale-run banner.

### Component Responsibilities

- **App Shell**: bootstraps dashboard metadata, service health, and session
  state for the selected dashboard ID.
- **Dashboard Registry View**: lists available dashboards and opens one by URL.
- **Parameter Drawer**: renders dashboard-level and panel-level parameter
  controls derived from saved-query configuration.
- **Panel Runner**: requests lazy query execution, tracks panel status, and
  marshals results into KPI, chart, and table blocks.
- **KPI Block**: shows headline values plus formula / filter disclosure.
- **Chart Gallery**: renders one or more Plotly charts from either default
  suggestions or stored overrides.
- **Results Table**: lazy-loads rows for preview while exposing full export.
- **Export Controls**: emits PNG/PDF for dashboard-level export and Excel/CSV
  for panel-table export.
- **Error Boundary**: catches and isolates panel-specific failures, preventing a
  page-wide crash for a single broken query.

### State Management

The Streamlit session state MUST at minimum track:

- selected dashboard ID and workspace ID
- dashboard metadata and panel order
- current parameter values and validation state
- refresh mode, last completed run, and in-flight run status
- panel execution states (`idle`, `loading`, `ready`, `error`, `stale`)
- visualization suggestions and analyst overrides
- table pagination or chunk cursor state
- export request state and latest artifact references

## Backend API Endpoints Consumed

The Streamlit app consumes or requires the following FastAPI endpoints. Existing
specs 003 and 004 own the saved-query and execution contracts; this feature
adds dashboard-specific endpoints.

| Method | Path                                                                                   | Purpose                                                                          | Dependency          |
| ------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------- |
| GET    | `/api/health`                                                                          | Service liveness for page header and outage messaging                            | Existing backend    |
| GET    | `/api/v1/workspaces/{workspace_id}/saved-queries`                                      | List active saved queries for dashboard composition                              | Spec 004            |
| GET    | `/api/v1/workspaces/{workspace_id}/saved-queries/{saved_query_id}`                     | Retrieve saved-query metadata, parameter schema, latest version, and description | Spec 004            |
| POST   | `/api/v1/workspaces/{workspace_id}/saved-queries/{saved_query_id}/validate`            | Revalidate a saved query before dashboard execution                              | Spec 004            |
| POST   | `/api/v1/workspaces/{workspace_id}/saved-queries/{saved_query_id}/execute`             | Execute a saved query with dashboard-supplied parameters                         | Spec 003 + Spec 004 |
| GET    | `/api/v1/workspaces/{workspace_id}/dashboards`                                         | List dashboards for the workspace                                                | New in Spec 005     |
| POST   | `/api/v1/workspaces/{workspace_id}/dashboards`                                         | Create a dashboard definition                                                    | New in Spec 005     |
| GET    | `/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}`                          | Retrieve dashboard metadata, panel order, overrides, and cadence                 | New in Spec 005     |
| PATCH  | `/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}`                          | Update title, panel order, panel membership, defaults, and overrides             | New in Spec 005     |
| POST   | `/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/refresh`                  | Start a dashboard run using current parameters                                   | New in Spec 005     |
| GET    | `/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/runs/{run_id}`            | Poll run status and fetch per-panel results lazily                               | New in Spec 005     |
| POST   | `/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/export`                   | Create dashboard PNG/PDF export for the active run                               | New in Spec 005     |
| POST   | `/api/v1/workspaces/{workspace_id}/dashboards/{dashboard_id}/panels/{panel_id}/export` | Export a panel table to Excel or CSV                                             | New in Spec 005     |

## Chart Type Selection Algorithm

Chart suggestion is deterministic and explainable. The system MUST record the
reason for the selected default chart and expose that reason in panel metadata.

### Column Classification

1. Classify each result column as one of: time, numeric measure, integer,
   categorical, boolean, or unsupported.
2. Derive candidate dimensions from non-numeric fields and candidate measures
   from numeric fields.
3. Compute distinct-count, null-rate, and basic range statistics for every
   candidate chart field.

### Suggestion Rules

1. **Line chart**: choose when exactly one time column and at least one numeric
   measure are present, with the time column on x-axis and the primary measure
   on y-axis.
2. **Bar chart**: choose when one low- or medium-cardinality categorical field
   and one numeric measure are present. Default sort is descending by measure.
3. **Scatter chart**: choose when two numeric measures are present and row-level
   points remain interpretable after sampling or binning.
4. **Pie chart**: choose only when one categorical field has between 2 and 6
   distinct values and one numeric measure expresses part-to-whole share.
5. **Heatmap**: choose when two categorical or bucketed dimensions plus one
   numeric measure form a matrix with manageable cardinality.
6. **No default chart**: choose table-first fallback when no rule above yields
   a readable visualization.

### Safety Rules

- High-cardinality categories default to bar-with-top-N or table-only, not pie.
- Null-heavy fields are excluded from default axis assignment unless no safer
  alternative exists.
- Mixed-type columns are never used as default chart axes.
- If multiple charts are viable, choose the one with the clearest mapping from
  business question to visual comparison, preferring line over bar for time,
  bar over pie for comparison, and table-only over ambiguous charts.

## Data Transformation For Visualization

Visualization data preparation must be explicit, repeatable, and suitable for
large weekly-report result sets.

### Aggregation And Binning

- If a saved query already returns aggregated data, the dashboard must preserve
  that grain and avoid re-aggregating unless the analyst explicitly requests a
  visualization-specific grouping.
- If a saved query returns row-level data above the visualization threshold,
  the system must apply visualization-safe aggregation or binning before chart
  rendering.
- Top-N reduction may be applied for high-cardinality categorical charts, with
  the reduction rule disclosed in panel metadata.
- Scatter plots may use deterministic sampling or density-style binning when
  point count would otherwise exceed readable limits.

### Null And Missing-Value Handling

- Numeric nulls are excluded from aggregate math unless a metric definition says
  otherwise; excluded-row count must be surfaced in lineage or tooltip context.
- Categorical nulls are grouped under a visible `Missing` label rather than
  silently dropped.
- Time nulls are excluded from time-series axis construction and counted in the
  panel-quality summary.
- Panels must display a no-results or low-quality explanation when null or
  invalid values leave no safe chartable dataset.

### Result Formatting

- Table preview must preserve original column names, ordering, and display
  formatting consistent with the saved query result contract.
- KPI values must expose units, decimal precision, and denominator context when
  applicable.
- Chart labels and legends must use analyst overrides when present; otherwise,
  they default to human-readable column labels.

## Decision-Readiness & Trust Boundaries

This feature serves two surface roles depending on the state of the underlying
query outputs:

- **Analysis workbench**: default posture for auto-generated charts and KPI
  summaries that are informative but not backed by a confirmed metric contract.
- **Executive report / manager-ready dashboard**: allowed only when the visible
  summaries expose sufficient aggregation, parameter, and lineage context and
  no blocked trust gate is present.

The dashboard must therefore:

- show refresh timestamp and active parameters on every manager-facing run
- label exploratory summaries clearly when metric-contract evidence is absent
- suppress recommendation language entirely
- provide drill-down context to the saved query and version for every panel

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An analyst can assemble or update a weekly dashboard from saved
  queries in under 10 minutes without rebuilding the underlying queries.
- **SC-002**: A manager can open the dashboard URL and understand the latest
  refresh state, active filters, and headline results in under 30 seconds.
- **SC-003**: 95% of dashboard panels in the target weekly-report workflow show
  their first usable visual state within 3 seconds after panel execution begins.
- **SC-004**: The weekly reporting process saves at least 2 hours of assembly
  and distribution effort compared with the prior manual workflow.
- **SC-005**: 100% of displayed KPI and chart panels expose source query,
  version, parameter set, and refresh timestamp.
- **SC-006**: Dashboard runs remain usable for result sets above 100k rows by
  aggregating or sampling charts while preserving full-data export.

## Assumptions

- The workspace already has valid saved queries from spec 004 and executable
  query definitions from spec 003.
- Streamlit is the manager-facing dashboard surface, while FastAPI remains the
  authoritative backend for validation, execution, persistence, and exports.
- A dashboard may contain multiple panels, but all panels belong to the same
  workspace and run under one shared refresh context.
- Parameter definitions are owned by the saved query and are not invented ad
  hoc by the dashboard.
- Weekly-report dashboards are primarily read-mostly surfaces; simultaneous
  multi-editor conflict management is out of scope for MVP 2.
- Decision-grade labeling depends on constitution trust gates; absent trust
  evidence, the dashboard remains an analysis workbench rather than a
  recommendation surface.
