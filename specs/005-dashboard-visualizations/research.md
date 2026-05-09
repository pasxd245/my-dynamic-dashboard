# Research: Dashboard & Visualizations (MVP 2)

**Spec**: `/specs/005-dashboard-visualizations/spec.md`  
**Plan**: `/specs/005-dashboard-visualizations/plan.md`  
**Date**: 2026-05-08

This research document resolves technical unknowns identified in the planning phase and provides evidence-based decisions for Phase 1 design.

---

## 1. Chart Suggestion Strategy

### Question

How do we auto-detect suitable chart types from DuckDB/Polars result-set schema and sample data while handling edge cases (nulls, mixed types, categorical explosion)?

### Research & Decision

**Approach: Column-Role Detection + Heuristic Selection**

1. **Column role classification** (from DuckDB DESCRIBE or Polars schema):
   - **Numeric measure**: data type in {INT, BIGINT, FLOAT, DECIMAL} and < 50% nulls
   - **Date/time dimension**: data type in {DATE, TIMESTAMP} or name matches `*date*`, `*time*`, `*_at`
   - **Categorical dimension**: VARCHAR/TEXT with distinct-value count ≤ 100 and < 30% nulls
   - **Text**: VARCHAR/TEXT with distinct-value count > 100 or > 30% nulls
   - **ID/foreign key**: Any type with "id" or "key" suffix

2. **Chart selection rules**:
   - If 1 date + 1 numeric (+ optional groupby dimension):
     - Default: **Line chart** (time series)
     - Rationale: Standard for temporal trends (weekly KPIs, cumulative metrics)
   - If 1 categorical + 1 numeric (+ optional date groupby):
     - Default: **Bar chart** (category comparison)
     - Rationale: Clearest for category-level metrics, manager-familiar
   - If 2 numeric measures (no time/category):
     - Default: **Scatter plot** (correlation exploration)
     - Rationale: Shows relationships between two measures
   - If 3+ dimensions or 3+ measures:
     - Default: **Table only** with explanation: "Result set too complex for default chart; use table view or analyst override"
     - Rationale: Prevents misleading 3D/bubble charts that obscure relationships
   - If result is all nulls, < 1 row, or undefined schema:
     - Default: **Table only** with explanation: "No data matches query parameters"
     - Rationale: Shows zero-state clearly rather than blank chart

3. **Edge case handling**:
   - Categorical cardinality > 100: Suggest table only (bar chart unreadable)
   - > 50% nulls in measure: Warn "many nulls detected" and show table alongside chart
   - Mixed numeric types (int + float): Coerce to float for consistent axis
   - Date column has timezones: Normalize to UTC at query time (handled by query executor)

4. **Analyst override**: Always available
   - Dropdown to select chart type from {bar, line, scatter, pie, heatmap, table}
   - Per-axis configuration (x/y assignment, aggregation function)
   - Color/label customization
   - Override persisted in `dashboard_panels.chart_config_json`

**Rationale**: Heuristic covers 80% of weekly-report use cases (time series, category breakdowns, simple scatter). Fallback to table prevents incorrect visualization. Manager sees explanation of why default was chosen, preserving transparency.

**Alternatives Considered**:

- ML-based chart recommendation (e.g., Draco): Rejected due to complexity + accuracy variability in weekly-report domain; heuristic is sufficient and auditable.
- Always default to table: Rejected; loses visual impact for KPI-style dashboards.
- Auto-switch chart type on parameter change: Rejected; too destabilizing; analyst override becomes default behavior.

---

## 2. Parameter Validation and Injection Prevention

### Question

How do we validate parameter values before execution and ensure safe parameterized SQL generation without injection attacks?

### Research & Decision

**Approach: Schema-Driven Validation + Parameterized Binding**

1. **Parameter schema definition** (stored in saved_query_versions.builder_snapshot_json):

   ```json
   "parameters": [
     {
       "parameterId": "date_range_start",
       "parameterName": "Start Date",
       "parameterType": "date",
       "required": true,
       "defaultValue": "2024-01-01",
       "validation": {
         "minDate": "2020-01-01",
         "maxDate": "today"
       }
     },
     {
       "parameterId": "product_category",
       "parameterType": "categorical",
       "required": false,
       "allowedValues": ["Electronics", "Apparel", "Home"],
       "defaultValue": null
     },
     {
       "parameterId": "revenue_threshold",
       "parameterType": "numeric",
       "required": true,
       "validation": { "min": 0, "max": 1000000 }
     }
   ]
   ```

2. **Validation logic** (panel_executor_service.py):
   - Check required parameters are present
   - Validate date ranges (minDate ≤ value ≤ maxDate)
   - Validate categorical values against allowedValues
   - Validate numeric ranges (min ≤ value ≤ max)
   - Reject unrecognized parameters (not in parameter schema)
   - Return 400 with detailed field-level errors on validation failure

3. **SQL parameter binding** (DuckDB execute):

   ```python
   # Safe parameterized query:
   query = "SELECT * FROM sales WHERE date >= $1 AND category = $2 AND revenue > $3"
   result = duckdb.execute(query, [start_date, category, threshold])
   ```

   - Never concatenate parameters into SQL strings
   - Use DuckDB's native parameter binding ($1, $2, $3)
   - Polars can also use placeholders for dynamic filtering

4. **Error handling**:
   - Missing required parameter → 400 "Parameter 'date_range_start' is required"
   - Invalid categorical value → 400 "Parameter 'product_category' must be one of: [Electronics, Apparel, Home]"
   - Out-of-range numeric → 400 "Parameter 'revenue_threshold' must be between 0 and 1000000"
   - Unknown parameter → 400 "Parameter 'unknown_param' is not defined in saved query"

**Rationale**: Schema-driven validation is transparent, auditable, and matches SQL injection prevention best practices. Parameter binding is standard across DuckDB and Polars.

**Alternatives Considered**:

- Regex validation: Rejected; too fragile and error-prone for complex values.
- Allowlist only certain parameter names: Rejected; restrictive and doesn't validate values.
- Stored procedures: Rejected; DuckDB/Polars do not have native stored procedures; parameter binding is equivalent.

---

## 3. Refresh Concurrency and State Management

### Question

How do we handle overlapping auto-refresh requests and maintain dashboard run state across long-running refreshes?

### Research & Decision

**Approach: Single-Active-Run Model + Event-Driven UI Update**

1. **Dashboard run state machine**:

   ```
   PENDING → RUNNING → COMPLETED
                    ↘ FAILED
   ```

   - PENDING: Dashboard run created, awaiting first panel start
   - RUNNING: At least one panel is executing; others may be queued or completed
   - COMPLETED: All panels finished (with mixed success/failure per panel)
   - FAILED: Dashboard-level failure (e.g., backend unavailable, all panels timed out)

2. **Concurrency guard**:
   - Before starting a new auto-refresh run, check if dashboard.current_run_id is already in RUNNING state
   - If yes, skip the new run (do not queue) and log "Dashboard refresh already in progress"
   - If no, start a new run and update dashboard.current_run_id
   - Rationale: Weekly-report use case does not need concurrent runs; skip is acceptable behavior

3. **Panel execution state**:
   - PENDING: Panel queued for execution
   - RUNNING: Panel query executing
   - COMPLETED: Panel query finished with row count
   - FAILED: Panel query failed (error details recorded)
   - TIMEOUT: Panel query exceeded 5-second limit

4. **Backend state persistence** (dashboard_runs, dashboard_run_events):
   - Record dashboard run start time, status
   - For each panel, record panel ID, status, execution time, row count, error message
   - Update dashboard_runs.status to COMPLETED only after all panels are COMPLETED or FAILED
   - Record each state transition as an event for audit trail

5. **Streamlit UI state management**:
   - Use Streamlit session state to track current_run_id and per-panel status
   - Implement polling loop (check status every 2 seconds) while run is RUNNING
   - Render panels as they complete (lazy rendering)
   - Display "Refreshing..." badge with completed/total panel count (e.g., "Refreshing 3 of 5")

6. **Auto-refresh cadence**:
   - Supported intervals: 15 minutes, 1 hour
   - Backend job (or Streamlit rerun) triggers refresh at specified interval
   - Skip run if prior run still in progress (see concurrency guard above)
   - Log all attempted refreshes (successful and skipped) for audit

**Rationale**: Single-active-run model is simple, prevents race conditions, and matches weekly-report cadence (analysts don't need 10 concurrent refreshes). Polling UI is acceptable for internal dashboards; real-time WebSocket is deferred to MVP 3+.

**Alternatives Considered**:

- Queue overlapping runs: Rejected; overkill for MVP 2 use case and adds queue management complexity.
- WebSocket updates: Rejected; Streamlit doesn't have native WebSocket support; polling is simpler.
- Streaming results: Rejected; not applicable for batch weekly-report workload.

---

## 4. Large Result Set Handling (100k+ Rows)

### Question

How do we render charts safely for 100k+ row result sets without overwhelming the browser or losing chart utility?

### Research & Decision

**Approach: Query-Time Aggregation + Preserve Full Export**

1. **Detection trigger**:
   - Query returns row count ≥ 100,000
   - Result set memory estimate (based on column types and row count) exceeds 50MB

2. **Aggregation strategy** (applied at query execution time):
   - If result has a date column and numeric measure: Aggregate by date (e.g., daily/weekly rollup depending on date range span)
   - If result has a categorical dimension and numeric measure: Aggregate by category (keep top N categories, roll rest into "Other")
   - If result has 3+ dimensions: Aggregate by highest-cardinality dimension or apply multi-level rollup
   - Use DuckDB aggregate functions: SUM, AVG, COUNT, MIN, MAX
   - Preserve original result set separately for export

3. **Sampling fallback** (if aggregation not applicable):
   - Random sample of 50,000 rows
   - Apply stratified sampling if categorical column present (e.g., ensure each category is represented)
   - Record sample size and seed in result metadata

4. **Lazy table rendering** (Streamlit):
   - Display paginated results table in dashboard (load 1000 rows at a time)
   - Show "Showing 1,000 of 1,000,000 rows" indicator
   - Provide download button for full result in Excel/CSV (no pagination)

5. **Performance targets**:
   - Chart rendering for aggregated data < 1 second
   - Table pagination rendering < 500ms per page
   - Full export generation < 10 seconds (even for 1M rows)

**Rationale**: Aggregation preserves data integrity for charts while maintaining full data for export. Lazy rendering keeps UI responsive.

**Alternatives Considered**:

- Always render full result: Rejected; browser will crash or become unresponsive with 100k+ points.
- Server-side rendering (rasterize chart on backend): Rejected; adds complexity; browser-side rendering is sufficient with aggregation.
- Decimate/undersample without aggregation: Rejected; loses data integrity for KPI summaries.

---

## 5. Panel Isolation and Error Handling

### Question

How do we handle panel-level failures without blocking the entire dashboard?

### Research & Decision

**Approach: Per-Panel Try-Catch + Bounded Error Messages**

1. **Error types and handling**:

   | Error Type          | Root Cause                                                     | UI Display                                                | Retry Behavior                                    |
   | ------------------- | -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------- |
   | Validation Failure  | Parameter out of range, missing required param                 | "Parameter error: ..."; show parameter panel              | Manual retry by changing params                   |
   | Schema Drift        | Source table/column no longer exists                           | "Query schema changed"; link to saved-query editor        | Analyst fixes saved query                         |
   | Broken Relationship | Referenced relationship rule no longer exists or is downgraded | "Relationship rule changed"; show rule details            | Analyst updates dashboard or reviews relationship |
   | Query Timeout       | Execution exceeded 5 seconds                                   | "Query too slow (>5s); try narrower date range or filter" | Manual retry with different params                |
   | Backend Unavailable | 503, network error                                             | "Dashboard service unavailable; try again in 1 minute"    | Auto-retry with exponential backoff               |
   | Unexpected Error    | Unhandled exception                                            | "Query failed unexpectedly; contact support"              | Manual retry + error report                       |

2. **Implementation** (panel_executor_service.py):

   ```python
   try:
       result = execute_panel_query(panel_id, params)
   except ParameterValidationError as e:
       return {"status": "FAILED", "error_type": "validation", "message": str(e)}
   except SchemaDriftError as e:
       return {"status": "FAILED", "error_type": "schema_drift", "message": f"Column {e.column} no longer exists"}
   except QueryTimeoutError:
       return {"status": "TIMEOUT", "error_type": "timeout", "message": "Query exceeded 5 seconds"}
   except Exception as e:
       return {"status": "FAILED", "error_type": "unexpected", "message": "Query failed unexpectedly"}
   ```

3. **UI error panel** (Streamlit ErrorPanel component):
   - Show error type, message, timestamp
   - Provide "Retry" button for timeout/backend errors
   - Provide "Edit Saved Query" link for schema drift
   - Provide "View Relationship" link for broken relationship

4. **Dashboard-level health status**:
   - If all panels failed: Show page-level error "Dashboard unavailable; check backend health"
   - If some panels failed: Show success panels + error panels; indicate dashboard is partially loaded
   - Health check endpoint: `GET /health` to diagnose backend availability

**Rationale**: Per-panel isolation ensures one bad query doesn't block the entire dashboard. Error categorization guides analyst toward resolution. Retry buttons allow transient failures to self-heal.

**Alternatives Considered**:

- Batch all panels + fail entire dashboard on any error: Rejected; unacceptable for manager experience.
- Silent panel hiding (no error display): Rejected; managers need to know why a panel is missing.
- Auto-downgrade to table view on chart failure: Rejected; could mask legitimate errors that need analyst attention.

---

## 6. Export Format Preservation

### Question

How do we ensure exported artifacts (PNG/PDF, Excel/CSV) preserve all necessary metadata and context for audit and downstream use?

### Research & Decision

**Approach: Metadata-Embedded Export + Lineage Columns**

### 6.1 PNG/PDF Export

**Approach**: Use Playwright headless browser to capture Streamlit dashboard as PNG, then convert to PDF using ReportLab.

1. **PNG capture**:
   - URL: `GET /dashboards/{id}?export=true` renders dashboard in headless browser without live-update UI
   - Capture full-page screenshot at 1920x1080 resolution
   - Include dashboard title, refresh timestamp, all visible panels
   - Preserve chart styling, colors, table formatting

2. **PDF generation**:
   - Convert PNG to PDF using ReportLab
   - Add metadata: Title (dashboard name), Author (logged-in user), CreationDate (export time), Subject (parameter summary)
   - Add page breaks between panels if needed for readability
   - Include footer: "Refreshed at {timestamp} | Query versions: {list} | Parameters: {summary}"

3. **Implementation**:

   ```python
   # Backend export endpoint
   @app.post("/dashboards/{dashboard_id}/export")
   async def export_dashboard(dashboard_id: str, format: str):  # format in {png, pdf}
       run = get_latest_dashboard_run(dashboard_id)
       page = await browser.new_page()
       await page.goto(f"{STREAMLIT_URL}/dashboards/{dashboard_id}?export=true")
       screenshot = await page.screenshot(path="export.png")

       if format == "pdf":
           image = Image.open(screenshot)
           pdf = canvas.Canvas("export.pdf", pagesize=image.size)
           pdf.drawImage(screenshot, 0, 0)
           pdf.save()

       return FileResponse(f"export.{format}")
   ```

4. **Limitations & workarounds**:
   - Streamlit doesn't provide native headless rendering; Playwright adds 3-5 second overhead
   - Interactive elements (dropdowns, buttons) are static in export (acceptable for weekly-report use case)
   - Charts render as images in PDF (prevents interactivity but ensures fidelity)

### 6.2 Excel/CSV Export

**Approach**: Generate Excel file with multiple sheets (one per panel) + lineage columns + metadata.

1. **Excel structure**:
   - Sheet 1: Dashboard metadata (title, refresh time, parameters)
   - Sheets 2+: One sheet per query panel with results table + lineage columns
   - Each result sheet includes:
     - Query name, saved-query ID, saved-query version
     - Parameter values used in this execution
     - Execution timestamp, execution duration
     - Lineage: Source tables, relationship rules (IDs + approval status), filters applied
     - Results rows with source columns + calculated columns

2. **Example Excel output**:

   ```
   Sheet "Dashboard":
   - Title: Weekly Sales Dashboard
   - Refreshed: 2026-05-08 14:30:00 UTC
   - Parameters: Start Date = 2026-05-01, End Date = 2026-05-08

   Sheet "Revenue by Category":
   - Saved Query: revenue_by_category (v3)
   - Execution Time: 2026-05-08 14:30:00 (2.3s)
   - Parameters: start_date=2026-05-01, end_date=2026-05-08
   - Filters Applied: revenue > 100, category IN [Electronics, Apparel]
   - Relationships: sales.product_id -> products.id (Approved)

   [Table with columns: category, revenue, units, _source_query_id, _execution_timestamp]
   ```

3. **CSV export** (per-panel only):
   - Single CSV file with headers including lineage metadata at top
   - Comments rows (prefixed with #) documenting query, parameters, relationships
   - Data rows with source columns only (no Excel-specific formatting)

4. **Implementation** (openpyxl):

   ```python
   wb = Workbook()
   ws_meta = wb.active
   ws_meta.title = "Dashboard"
   ws_meta.append(["Title", dashboard.name])
   ws_meta.append(["Refreshed", run.created_at.isoformat()])

   for panel in dashboard.panels:
       ws = wb.create_sheet(title=panel.name[:31])  # Excel sheet name limit 31 chars
       result = get_panel_result(panel.id, run.id)

       # Add lineage metadata rows
       ws.append(["# Query", result.saved_query.name])
       ws.append(["# Version", result.saved_query.current_version_id])
       ws.append(["# Parameters", json.dumps(run.parameters)])

       # Add data rows
       ws.append(result.columns)
       for row in result.rows:
           ws.append(row)
   ```

5. **Performance targets**:
   - Export generation < 10 seconds for 1M-row result sets
   - File size < 100MB for typical dashboard (compression applied if needed)

**Rationale**: Metadata-embedded exports ensure downstream users can audit the data source and parameters without returning to Streamlit. Lineage columns preserve traceability per Constitution Principle VI.

**Alternatives Considered**:

- Separate metadata file: Rejected; users often lose separate files; embedding in Excel/CSV is safer.
- CSV only: Rejected; Excel format more familiar to business users and supports multi-sheet structure.
- PDF only: Rejected; not suitable for downstream analysis or reimport.

---

## 7. Metric Contract Integration

### Question

How do we surface metric contract trust metadata on dashboard KPI cards and enforce decision-readiness gating?

### Research & Decision

**Approach: Contract-Aware KPI Cards + Surface Role Enforcement**

1. **Metric contract schema** (inherited from future spec, preliminary):

   ```json
   {
     "metricId": "gross_revenue",
     "metricName": "Gross Revenue",
     "definition": "SUM(order.total) WHERE status IN (completed, shipped)",
     "confirmationStatus": "confirmed" | "exploratory" | "sensitive",
     "trustGate": { "dataQuality": "pass", "relationshipConfidence": "pass", "reconciliation": "pass", "challenge": "pass" },
     "owner": "finance@company.com",
     "lastConfirmedAt": "2026-05-01"
   }
   ```

2. **KPI card rendering** (QueryPanel component):
   - If saved query references a metric contract:
     - Fetch contract metadata from backend
     - Display badge: "Confirmed Metric" (green), "Exploratory" (yellow), "Sensitive" (orange)
     - Show summary: "Gross Revenue: $1.2M (Confirmed Metric, last verified 2026-05-01)"
   - If no metric contract exists for query aggregation:
     - Display badge: "Ad-Hoc Summary" (gray)
     - Show summary: "Total Revenue: $1.5M (Exploratory; not a confirmed metric)"
   - Click badge to expand lineage details (numerator, denominator, filters, owner, confirmation status)

3. **Export labeling**:
   - In Excel/CSV, add column: `_metric_status` with values {confirmed, exploratory, sensitive}
   - In PDF footer, include note: "Some metrics are exploratory and not recommended for decision-making"

4. **Recommendation language gating** (FR-026):
   - Block dashboard-level language like "You should increase spending on Electronics" unless all referenced metrics are confirmed and all trust gates pass
   - Allow exploratory language: "Revenue breakdown by category shows Electronics growing 15% week-over-week" (no action verb)
   - Allow analysis language: "Category performance analysis: [metrics shown]" (no recommendation)

5. **Implementation** (backend):

   ```python
   # In dashboard_service.py, when rendering panel KPI:
   def get_kpi_summary(panel_id, run_id):
       result = get_panel_result(panel_id, run_id)
       metric = resolve_metric_from_query(result.saved_query)

       if metric:
           return {
               "value": result.kpi_value,
               "metricId": metric.id,
               "confirmationStatus": metric.confirmationStatus,
               "trustGates": metric.trustGate,
               "isDecisionReady": all(metric.trustGate.values())
           }
       else:
           return {
               "value": result.kpi_value,
               "confirmationStatus": "exploratory",
               "trustGates": {},
               "isDecisionReady": False
           }
   ```

**Rationale**: Metric contract integration enforces Constitution Principle II (Metric Contract Before Visualization) and prevents misleading recommendations. Explicit badging makes trust status visible to end users.

**Alternatives Considered**:

- Hide all unconfirmed metrics: Rejected; exploratory analysis is valid, just needs labeling.
- Auto-derive metrics from queries: Rejected; metrics must be explicitly defined and confirmed by domain experts.
- Separate "metric dashboard" vs "exploratory dashboard": Rejected; single unified dashboard with clear labeling is simpler.

---

## 8. Dependency Verification on Dashboard Run

### Question

What must we verify before executing a dashboard to ensure all dependencies (saved queries, relationships, data sources) are still valid?

### Research & Decision

**Approach: Pre-Flight Validation at Dashboard Run Time**

1. **Validation checklist** (panel_executor_service.py):
   - [ ] Saved query still exists and is not deleted
   - [ ] Saved query version is valid (builder_snapshot_json is parseable)
   - [ ] All tables referenced in saved query still exist in workspace
   - [ ] All columns referenced in filters, aggregations, GROUP BY still exist with compatible types
   - [ ] All relationship rules referenced in joins are still approved (not downgraded, not pending, not deleted)
   - [ ] Query can be re-executed against current data without SQL error (dry-run or parse-only)
   - [ ] Parameters supplied match saved-query parameter schema

2. **Validation result codes**:
   - VALID: All checks pass; safe to execute
   - SCHEMA_DRIFT: Table or column no longer exists
   - RELATIONSHIP_DOWNGRADED: Referenced relationship changed from approved → pending/suggested/deleted
   - PARAMETER_MISMATCH: Supplied parameter not in saved-query schema
   - INVALID_SNAPSHOT: builder_snapshot_json is corrupted

3. **Action per result**:
   - VALID: Proceed with panel execution
   - SCHEMA_DRIFT: Return error "Saved query schema changed; please update the query and re-save"
   - RELATIONSHIP_DOWNGRADED: Return error "Relationship rule changed from approved to pending; cannot run query until restored"
   - PARAMETER_MISMATCH: Return error "Supplied parameter 'unknown_param' not in saved query"
   - INVALID_SNAPSHOT: Return error "Saved query is corrupted; contact support"

4. **When to validate**:
   - On dashboard load: Run pre-flight for all panels; show warnings but don't block render
   - On manual refresh: Run pre-flight before each panel executes; fail panel if validation fails
   - On auto-refresh: Run pre-flight; skip auto-refresh if validation fails (log to audit)

**Rationale**: Pre-flight validation ensures dashboard remains trustworthy when data model changes. Constitution Principle III requires explicit relationship validation before every cross-table query.

**Alternatives Considered**:

- Validate only at dashboard creation time: Rejected; doesn't catch downstream schema drift.
- Silently downgrade query to table-only: Rejected; could mask data model problems; explicit error is safer.

---

## Summary of Decisions

| Decision                                                           | Rationale                                                                             | Risk Level                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------- |
| Chart suggestion heuristic (date→line, category→bar, others→table) | 80% coverage for weekly-report use case; auditable; fallback to table prevents errors | Low                                         |
| Schema-driven parameter validation + parameterized SQL binding     | Transparent, injection-safe, matches database best practices                          | Low                                         |
| Single-active-run model (skip overlapping auto-refresh)            | Simple; adequate for MVP 2 batch workload                                             | Low                                         |
| Query-time aggregation for 100k+ rows                              | Preserves chart readability; export remains complete                                  | Medium (requires careful aggregation logic) |
| Per-panel error isolation                                          | Improves manager experience; detailed error messages guide recovery                   | Low                                         |
| Playwright-based PNG/PDF export                                    | Captures full dashboard state; adds ~3-5s latency                                     | Medium (browser dependency)                 |
| Metadata-embedded Excel/CSV with lineage columns                   | Enables audit trail; adds complexity to export generation                             | Low                                         |
| Metric contract awareness in KPI cards                             | Enforces Constitution; prevents misleading recommendations                            | Low                                         |
| Pre-flight validation on dashboard run                             | Catches schema drift early; matches spec 003 dependency checks                        | Low                                         |

---

## Next Steps

Phase 1 design will use these decisions to create:

- `data-model.md`: Entities for dashboards, panels, runs, with validation rules
- `contracts/dashboard-visualizations.openapi.yaml`: API endpoint specifications
- `quickstart.md`: Step-by-step verification of Stories 1-4

All decisions are final pending design review; if new evidence emerges during Phase 1, this document will be updated with amended decisions and rationale.
