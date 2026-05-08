# Data Model: Dashboard & Visualizations (MVP 2)

**Spec**: `/specs/005-dashboard-visualizations/spec.md`  
**Research**: `/specs/005-dashboard-visualizations/research.md`  
**Date**: 2026-05-08

## Entities

### dashboards

Represents a dashboard composition created by an analyst, scoped to a workspace.

```sql
CREATE TABLE dashboards (
  dashboard_id TEXT PRIMARY KEY,                -- UUID v4, immutable
  workspace_id TEXT NOT NULL,                   -- Workspace scope
  owner_user_id TEXT NOT NULL,                  -- Creator/owner user ID
  dashboard_name TEXT NOT NULL,                 -- Display name
  description TEXT,                             -- Optional description
  dashboard_order INTEGER,                      -- Display order within workspace (for sorting)

  current_run_id TEXT,                          -- Reference to most recent run (or NULL if no runs yet)
  last_refreshed_at TIMESTAMP,                  -- Last successful refresh timestamp
  refresh_cadence TEXT,                         -- Enum: "manual" | "15min" | "60min"

  created_at TIMESTAMP NOT NULL,                -- Dashboard creation time
  updated_at TIMESTAMP NOT NULL,                -- Last update time (panel added/removed, name changed, cadence changed)
  deleted_at TIMESTAMP,                         -- Soft-delete timestamp (NULL if active)

  FOREIGN KEY (current_run_id) REFERENCES dashboard_runs(run_id),
  UNIQUE (workspace_id, owner_user_id, dashboard_name),
  CHECK (refresh_cadence IN ('manual', '15min', '60min')),
  CHECK (created_at <= updated_at)
);

-- Indexes
CREATE INDEX idx_dashboards_workspace_user ON dashboards(workspace_id, owner_user_id);
CREATE INDEX idx_dashboards_active ON dashboards(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_dashboards_cadence ON dashboards(refresh_cadence) WHERE refresh_cadence != 'manual';
```

**Semantics**:

- `dashboard_id`: Globally unique identifier; immutable after creation; used in public dashboard URL.
- `workspace_id`, `owner_user_id`: Enforce scope. In MVP 2, each user owns their dashboards independently (no sharing).
- `dashboard_name`: Current name; unique per (workspace, owner). Updated when analyst renames dashboard.
- `description`: Optional narrative explaining purpose of dashboard.
- `current_run_id`: Denormalized pointer to latest run for fast "what's the current state?" queries. Updated when new run completes.
- `last_refreshed_at`: Timestamp of most recent successful refresh. Used for UI "last refreshed at..." display.
- `refresh_cadence`: Manual (user triggers), 15-minute auto-refresh, or 1-hour auto-refresh. Default is manual.
- `deleted_at`: NULL if active; timestamp if soft-deleted (future deletion/recovery TBD).
- `created_at`, `updated_at`: Audit timestamps; `updated_at` changed when dashboard composition or metadata changes.

**Lifecycle**:

1. Dashboard created (INSERT) with `deleted_at = NULL`, `refresh_cadence = 'manual'`, `current_run_id = NULL`
2. Panels added/removed/reordered (UPDATE dashboard_panels table; `updated_at` refreshed on dashboard)
3. Refresh cadence changed (UPDATE dashboards; set `refresh_cadence`)
4. Manual or auto refresh triggered (INSERT into dashboard_runs; UPDATE dashboards.current_run_id when complete)
5. Soft-delete (UPDATE dashboards; set `deleted_at`, mark panels as invisible)

---

### dashboard_panels

Represents a saved query included in a dashboard, with analyst-specified overrides.

```sql
CREATE TABLE dashboard_panels (
  panel_id TEXT PRIMARY KEY,                    -- UUID v4, immutable
  dashboard_id TEXT NOT NULL,                   -- Reference to parent dashboard (immutable)
  saved_query_id TEXT NOT NULL,                 -- Reference to saved query from spec 004 (immutable)
  panel_name TEXT,                              -- Optional override name; if NULL, use saved_query.name
  panel_order INTEGER NOT NULL,                 -- Display order within dashboard (1, 2, 3, ...)
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,    -- Analyst can hide panels without deleting

  chart_config_json TEXT,                       -- Analyst chart overrides (or NULL for auto-suggest):
                                                -- {
                                                --   "chartType": "bar" | "line" | "scatter" | "pie" | "heatmap",
                                                --   "xAxis": { "column": "...", "label": "..." },
                                                --   "yAxis": { "column": "...", "label": "..." },
                                                --   "colorBy": { "column": "..." },
                                                --   "palette": "default" | "colorblind" | "dark",
                                                --   "showLegend": true,
                                                --   "visibleColumns": ["col1", "col2"]
                                                -- }

  parameter_overrides_json TEXT,                -- Analyst-supplied parameter defaults for this panel:
                                                -- {
                                                --   "start_date": "2026-05-01",
                                                --   "category": "Electronics"
                                                -- }

  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,

  FOREIGN KEY (dashboard_id) REFERENCES dashboards(dashboard_id),
  FOREIGN KEY (saved_query_id) REFERENCES saved_queries(query_id),
  UNIQUE (dashboard_id, panel_order),
  CHECK (panel_order >= 1)
);

-- Indexes
CREATE INDEX idx_dashboard_panels_dashboard ON dashboard_panels(dashboard_id, panel_order);
CREATE INDEX idx_dashboard_panels_query ON dashboard_panels(saved_query_id);
```

**Semantics**:

- `panel_id`: Globally unique identifier; immutable after creation.
- `dashboard_id`: Reference to parent dashboard; immutable.
- `saved_query_id`: Reference to saved query; immutable. If saved query is deleted, panel remains but marked as invalid (future soft-delete on saved_queries).
- `panel_name`: Optional override; if NULL, default to saved_query.canonical_name. Allows analyst to customize panel title on dashboard without modifying saved query.
- `panel_order`: Determines display order within dashboard (1, 2, 3, ...). Can be updated when analyst reorders panels.
- `is_visible`: Boolean flag allowing analyst to hide a panel without deleting it. Useful for temporary exploration.
- `chart_config_json`: Analyst overrides for chart type, axes, colors, labels. If NULL, auto-suggestion applies. Updated when analyst changes chart settings.
- `parameter_overrides_json`: Default values for parameters specific to this panel run. Merged with dashboard-level parameters at runtime. If NULL, all parameters are required at runtime.
- `created_at`, `updated_at`: Audit timestamps.

**Lifecycle**:

1. Panel added to dashboard (INSERT) with `panel_order = {next_order}`, `chart_config_json = NULL`, `parameter_overrides_json = NULL`
2. Analyst reorders panel (UPDATE panel_order; also update other panels' orders as needed)
3. Analyst overrides chart settings (UPDATE chart_config_json)
4. Analyst sets parameter defaults (UPDATE parameter_overrides_json)
5. Analyst hides panel (UPDATE is_visible = FALSE)
6. Panel removed from dashboard (DELETE)

---

### dashboard_runs

Represents a single execution of a dashboard (either manual or auto-triggered).

```sql
CREATE TABLE dashboard_runs (
  run_id TEXT PRIMARY KEY,                      -- UUID v4, immutable
  dashboard_id TEXT NOT NULL,                   -- Reference to dashboard (immutable)
  run_number INTEGER NOT NULL,                  -- Auto-increment per dashboard (1, 2, 3, ...)

  triggered_by TEXT NOT NULL,                   -- Enum: "manual" | "auto_15min" | "auto_60min"
  triggered_by_user_id TEXT,                    -- User ID if manual; NULL if auto

  status TEXT NOT NULL,                         -- Enum: "pending" | "running" | "completed" | "failed"

  parameters_json TEXT NOT NULL,                -- Snapshot of parameter values used in this run:
                                                -- {
                                                --   "start_date": "2026-05-01",
                                                --   "category": "Electronics"
                                                -- }

  created_at TIMESTAMP NOT NULL,                -- Run start time
  started_at TIMESTAMP,                         -- When execution actually began (NULL if pending)
  completed_at TIMESTAMP,                       -- When run finished (NULL if still running)

  total_duration_ms INTEGER,                    -- Total execution time in milliseconds

  FOREIGN KEY (dashboard_id) REFERENCES dashboards(dashboard_id),
  FOREIGN KEY (triggered_by_user_id) REFERENCES users(user_id),  -- If exists; otherwise foreign key not enforced
  UNIQUE (dashboard_id, run_number),
  CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  CHECK (started_at IS NULL OR created_at <= started_at),
  CHECK (completed_at IS NULL OR started_at IS NOT NULL),
  CHECK (total_duration_ms IS NULL OR total_duration_ms >= 0)
);

-- Indexes
CREATE INDEX idx_dashboard_runs_dashboard_created ON dashboard_runs(dashboard_id, created_at DESC);
CREATE INDEX idx_dashboard_runs_status ON dashboard_runs(status);
```

**Semantics**:

- `run_id`: Globally unique identifier; immutable.
- `dashboard_id`: Reference to dashboard; immutable.
- `run_number`: Sequential counter per dashboard (1, 2, 3, ...); used to identify "2nd run of dashboard X".
- `triggered_by`: How the run was initiated (manual button click, or auto-refresh cadence).
- `triggered_by_user_id`: User who manually triggered (NULL for auto).
- `status`: Run state machine: pending → running → completed or failed.
- `parameters_json`: Immutable snapshot of all parameters used for this run. Enables audit and reproducibility.
- `created_at`: When run was created (immediately, before execution starts).
- `started_at`: When first panel started executing.
- `completed_at`: When last panel finished (or run failed).
- `total_duration_ms`: Wall-clock time from started_at to completed_at.

**Lifecycle**:

1. Run created (INSERT) with status='pending', created_at=NOW(), started_at=NULL
2. First panel starts (UPDATE status='running', started_at=NOW())
3. Last panel completes (UPDATE status='completed', completed_at=NOW(), total_duration_ms=...)
4. If all panels fail, status remains 'completed' (per-panel success/failure tracked in dashboard_run_panels)
5. If backend-level failure (e.g., no panels run), status='failed'

---

### dashboard_run_panels

Represents execution state and results of a single panel within a dashboard run.

```sql
CREATE TABLE dashboard_run_panels (
  run_panel_id TEXT PRIMARY KEY,                -- UUID v4, immutable
  run_id TEXT NOT NULL,                         -- Reference to dashboard run (immutable)
  panel_id TEXT NOT NULL,                       -- Reference to dashboard panel (immutable)
  saved_query_version_id TEXT,                  -- Reference to saved_query_versions at time of run (immutable)

  status TEXT NOT NULL,                         -- Enum: "pending" | "running" | "completed" | "failed" | "timeout"

  started_at TIMESTAMP,                         -- When panel execution began (NULL if not started)
  completed_at TIMESTAMP,                       -- When panel execution finished (NULL if still running)
  duration_ms INTEGER,                          -- Execution time in milliseconds

  row_count INTEGER,                            -- Number of rows returned (NULL if failed)
  is_aggregated BOOLEAN,                        -- TRUE if result was aggregated due to > 100k rows
  result_memory_bytes INTEGER,                  -- Estimated memory size of result (for audit)

  error_type TEXT,                              -- If failed: "validation" | "schema_drift" | "broken_relationship" | "timeout" | "unexpected"
  error_message TEXT,                           -- Human-readable error message for UI display

  chart_suggestion_type TEXT,                   -- Auto-suggested chart type: "line" | "bar" | "scatter" | "pie" | "heatmap" | "table_only" | NULL
  chart_suggestion_reason TEXT,                 -- Explanation for chart suggestion or why no chart was suggested

  kpi_value NUMERIC,                            -- If query contains aggregation, the primary KPI value (e.g., SUM)
  kpi_label TEXT,                               -- Label for KPI (e.g., "Total Revenue")

  created_at TIMESTAMP NOT NULL,

  FOREIGN KEY (run_id) REFERENCES dashboard_runs(run_id),
  FOREIGN KEY (panel_id) REFERENCES dashboard_panels(panel_id),
  FOREIGN KEY (saved_query_version_id) REFERENCES saved_query_versions(version_id),
  UNIQUE (run_id, panel_id),
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout')),
  CHECK (is_aggregated IS NOT NULL),
  CHECK (row_count IS NULL OR row_count >= 0)
);

-- Indexes
CREATE INDEX idx_dashboard_run_panels_run ON dashboard_run_panels(run_id, status);
CREATE INDEX idx_dashboard_run_panels_panel ON dashboard_run_panels(panel_id);
```

**Semantics**:

- `run_panel_id`: Globally unique identifier; immutable.
- `run_id`, `panel_id`: Immutable references to parent run and panel.
- `saved_query_version_id`: Captures which version of the saved query was used for this execution. Enables traceability.
- `status`: Per-panel state machine: pending → running → completed/failed/timeout.
- `started_at`, `completed_at`, `duration_ms`: Execution timing for UI progress indication and performance analysis.
- `row_count`: Result set size; used to validate performance targets and aggregation behavior.
- `is_aggregated`: TRUE if query result was aggregated at runtime (result > 100k rows). Important for chart interpretation.
- `result_memory_bytes`: Estimated size of result in memory; used to track resource consumption.
- `error_type`, `error_message`: Detailed error information for panel-level error display.
- `chart_suggestion_type`: Auto-detected chart type or "table_only" if no safe chart.
- `chart_suggestion_reason`: Explanation (e.g., "Time series detected: one date column and one numeric measure").
- `kpi_value`, `kpi_label`: If query aggregates to a single value (SUM, AVG, COUNT), store here for KPI card display.

**Lifecycle**:

1. Panel execution queued (INSERT) with status='pending', started_at=NULL
2. Panel starts (UPDATE status='running', started_at=NOW())
3. Query completes successfully (UPDATE status='completed', completed_at=NOW(), row_count=..., chart_suggestion_type=..., kpi_value=...)
4. Query fails (UPDATE status='failed', completed_at=NOW(), error_type=..., error_message=...)
5. Query exceeds 5-second timeout (UPDATE status='timeout', completed_at=NOW(), error_message="Query exceeded timeout")

---

### dashboard_run_events

Audit trail of dashboard run lifecycle events (for future use; may be omitted in MVP 2 Phase 1).

```sql
CREATE TABLE dashboard_run_events (
  event_id TEXT PRIMARY KEY,                    -- UUID v4
  run_id TEXT NOT NULL,                         -- Reference to dashboard run
  event_type TEXT NOT NULL,                     -- Enum: "run_started" | "panel_started" | "panel_completed" | "panel_failed" | "run_completed" | "export_requested"
  event_timestamp TIMESTAMP NOT NULL,
  details_json TEXT,                            -- Event-specific metadata (e.g., panel_id, error_type)

  FOREIGN KEY (run_id) REFERENCES dashboard_runs(run_id)
);

-- Index
CREATE INDEX idx_dashboard_run_events_run ON dashboard_run_events(run_id);
```

---

## Validation Rules

### Dashboard Composition

1. **Panel order must be contiguous**: If a dashboard has N panels, panel_order values must be {1, 2, ..., N}.
   - Enforcement: Application-level validation on insert/delete/reorder.

2. **Saved queries must be valid**: When a panel is added to a dashboard, the referenced saved_query_id must exist and be active (not deleted).
   - Enforcement: Foreign key constraint + application check.

3. **Dashboard name must be unique per workspace and owner**: No two dashboards with the same name for a given (workspace_id, owner_user_id).
   - Enforcement: UNIQUE constraint.

4. **Parameter overrides must match saved-query schema**: If panel defines parameter_overrides_json, each key must be a parameter name declared in the saved query's parameter schema.
   - Enforcement: Application-level validation at panel creation/update time.

### Dashboard Run

1. **Parameters must be complete**: All required parameters from all panels must be supplied before run starts.
   - Enforcement: Parameter validation service before run creation.

2. **Parameter values must be valid**: Each supplied parameter must pass type and range validation defined in saved-query parameter schema.
   - Enforcement: Parameter validator service.

3. **Only one active run per dashboard at a time**: If dashboard.status is 'running', a new run cannot be created for the same dashboard.
   - Enforcement: Application-level concurrency guard (check current_run_id status before creating new run).

### Panel Execution

1. **Pre-flight validation before execution**:
   - Saved query still exists and is not deleted
   - Saved query version is valid
   - All source tables exist in workspace
   - All columns referenced in filters, aggregations, GROUP BY exist with compatible types
   - All relationship rules are still approved
   - Parameters are complete and valid

   Enforcement: panel_executor_service.py pre-flight validation before query execution.

2. **Result set aggregation trigger**: If row_count > 100,000 or memory_bytes > 50MB, set is_aggregated=TRUE.
   - Enforcement: Logic in panel_executor_service after query execution.

---

## State Machines

### Dashboard Run Lifecycle

```
PENDING ──→ RUNNING ──→ COMPLETED
                  └──→ FAILED
```

- **PENDING** → **RUNNING**: First panel starts execution.
- **RUNNING** → **COMPLETED**: Last panel finishes (all panels are in terminal state: completed, failed, or timeout).
- **RUNNING** → **FAILED**: Dashboard-level failure (e.g., backend unavailable, cannot load any panels).

### Panel Execution Lifecycle (per-run)

```
PENDING ──→ RUNNING ──→ COMPLETED
                  ├──→ FAILED
                  └──→ TIMEOUT
```

- **PENDING** → **RUNNING**: Panel execution starts.
- **RUNNING** → **COMPLETED**: Query finishes successfully with results.
- **RUNNING** → **FAILED**: Query fails (validation, schema drift, broken relationship, unexpected error).
- **RUNNING** → **TIMEOUT**: Query execution exceeds 5-second limit.

---

## Indexing Strategy

| Table                | Index                                                 | Purpose                                                             |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| dashboards           | `(workspace_id, owner_user_id)`                       | List dashboards for user in workspace                               |
| dashboards           | `(deleted_at)` WHERE deleted_at IS NULL               | Filter active dashboards                                            |
| dashboards           | `(refresh_cadence)` WHERE refresh_cadence != 'manual' | Find auto-refresh dashboards for background jobs                    |
| dashboard_panels     | `(dashboard_id, panel_order)`                         | Fetch panels in display order                                       |
| dashboard_panels     | `(saved_query_id)`                                    | Find all panels referencing a saved query (for cascade on deletion) |
| dashboard_runs       | `(dashboard_id, created_at DESC)`                     | Fetch recent runs for dashboard                                     |
| dashboard_runs       | `(status)`                                            | Find running/pending runs (for health checks)                       |
| dashboard_run_panels | `(run_id, status)`                                    | Fetch panel statuses for a run                                      |
| dashboard_run_panels | `(panel_id)`                                          | Find all executions of a panel (for audit)                          |
| dashboard_run_events | `(run_id)`                                            | Fetch events for a specific run                                     |

---

## Constraints & Checks

- `created_at ≤ updated_at` on all tables: Time ordering sanity check.
- `started_at ≥ created_at` on runs: Execution start time is after creation.
- `completed_at ≥ started_at` on runs: Completion time is after start.
- `row_count ≥ 0` on run panels: No negative row counts.
- `panel_order ≥ 1` on panels: Panel order is 1-indexed.
- Enum checks on status, triggered_by, error_type, chart_suggestion_type: Only valid values allowed.

---

## Relationships to Other Specs

### To Spec 004 (Saved Queries)

- `dashboard_panels.saved_query_id` → `saved_queries.query_id`
- `dashboard_run_panels.saved_query_version_id` → `saved_query_versions.version_id`
- Dashboard can only reference active saved queries (not deleted).
- On dashboard run, pre-flight validation checks saved query validity (per research #8).

### To Spec 003 (Query Builder & Execution)

- Query executor from spec 003 is invoked by panel_executor_service.
- Parameter schema defined in saved_query_versions (from spec 004 builder snapshot) is used for dashboard parameter validation.

### To Spec 002 (Relationship Rules)

- Pre-flight validation ensures only approved relationships are used in saved queries before dashboard run.
- If relationship is downgraded, panel fails with clear error message.

### To Spec 001 (Upload & Profile)

- Data source: Dashboard queries execute against workspace data uploaded via spec 001.
- No direct dependency; inherited via spec 003 query executor.

---

## Future Extensions (Out of Scope for MVP 2)

1. **Dashboard sharing**: Extend with dashboard_permissions table for cross-user sharing.
2. **Scheduled exports**: Extend with export_schedules table to automate weekly report email.
3. **Version history**: Track dashboard composition changes (add/remove/reorder panel history).
4. **Collaborative editing**: Track concurrent user edits to dashboard composition.
5. **Custom metrics**: Allow analysts to define dashboard-level KPIs (beyond saved-query aggregations).
6. **Alerts**: Trigger notifications when KPI values cross thresholds.
