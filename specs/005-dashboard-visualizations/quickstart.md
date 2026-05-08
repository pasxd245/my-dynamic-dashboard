# Quickstart: Dashboard & Visualizations (MVP 2)

**Spec**: `/specs/005-dashboard-visualizations/spec.md`  
**Plan**: `/specs/005-dashboard-visualizations/plan.md`  
**Data Model**: `/specs/005-dashboard-visualizations/data-model.md`  
**Date**: 2026-05-08

This quickstart provides a step-by-step walkthrough for verifying User Stories 1-4 and Acceptance Criteria AC-001 through AC-011. It assumes you have completed specs 001 (upload), 002 (relationship rules), 003 (query builder), and 004 (saved queries).

---

## Prerequisites

1. **Backend API running**: `python -m uvicorn app.main:app --reload` on `http://localhost:8000`
2. **Streamlit app running**: `streamlit run apps/dashboard/streamlit_app.py` on `http://localhost:8501`
3. **Query builder running**: React builder available at `http://localhost:5173`
4. **Sample data uploaded**: Via spec 001 upload flow (minimal: one CSV with sales data)
5. **Saved queries created**: Via spec 004 saved-query library (minimal: two queries—e.g., "Revenue by Category" and "Sales Trend")

### Sample Setup (If Not Already Done)

If you don't have sample data and queries ready, follow this quick setup:

1. Upload a sample CSV with columns: `date`, `category`, `revenue`, `units`
2. Create two saved queries via the builder:
   - Query 1 "Revenue by Category": Group by category, SUM(revenue)
   - Query 2 "Daily Revenue Trend": Group by date, SUM(revenue)

---

## Story 1: Open Dashboard and Understand Current Status

**User Story**: A manager opens a Streamlit dashboard URL and immediately sees when it was last refreshed, which saved queries are included, the current parameter context, headline KPIs, supporting charts, and the underlying results table.

**Walkthrough**:

### Step 1.1: Create a Dashboard

1. In Streamlit app, click **"New Dashboard"** button
2. Enter dashboard name: `Weekly Sales Report`
3. Enter description: `Overview of weekly revenue and category trends`
4. Set refresh cadence: **Manual** (for now)
5. Click **"Create"**
6. You are redirected to dashboard edit view

**Expected Result**: Dashboard created with empty panel list; URL shows `/dashboard/{dashboard_id}`

### Step 1.2: Add First Query Panel

1. Click **"Add Query Panel"**
2. A modal opens showing list of saved queries from spec 004
3. Select saved query **"Revenue by Category"**
4. Leave chart overrides empty (use auto-suggestion)
5. Click **"Add Panel"**

**Expected Result**: Panel added to dashboard with order 1; "Revenue by Category" displayed

### Step 1.3: Add Second Query Panel

1. Click **"Add Query Panel"** again
2. Select saved query **"Daily Revenue Trend"**
3. Click **"Add Panel"**

**Expected Result**: Two panels now appear on dashboard in correct order

### Step 1.4: Trigger Manual Refresh

1. Scroll to top of dashboard
2. Observe **DashboardHeader** section showing:
   - Dashboard name: "Weekly Sales Report"
   - Last refreshed: "Never" (first run)
   - Refresh cadence: "Manual"
   - Service health: "Healthy"
3. Click **"Refresh Now"** button

**Expected Result**:

- Header shows "Refreshing..." indicator
- Panels begin rendering as queries complete (lazy loading)
- After all panels complete, header updates with timestamp: `Last refreshed: 2026-05-08 14:30:00`

### Step 1.5: Verify Panel Content (AC-001, AC-004)

For each panel, verify presence of:

1. **KPI Card** (if aggregation exists):
   - Displays primary metric (e.g., "Total Revenue: $1.5M")
   - Shows source query name: "Revenue by Category"
   - Shows aggregation: "SUM(revenue)"
   - Shows metric status badge: "Exploratory" (gray, because no metric contract yet)

2. **Chart View**:
   - Bar chart rendered for "Revenue by Category" (auto-suggested)
   - Line chart rendered for "Daily Revenue Trend" (auto-suggested)
   - Chart has title, axis labels, legend
   - Chart explains suggestion: "Chart type automatically selected based on columns detected"

3. **Results Table**:
   - Displays first 1000 rows with pagination
   - Shows column headers matching query output
   - Shows "Showing 1,000 of 1,500 rows" indicator if more rows available

4. **Lineage Summary** (expandable section):
   - Query name: "Revenue by Category"
   - Query version: "v1" (or version number)
   - Execution timestamp: "2026-05-08 14:30:00"
   - Execution time: "2.3s"
   - Relationship rules used: List of approved relationships or "None"

5. **Export Controls** (buttons):
   - "Export to Excel"
   - "Export to CSV"

**Expected Result**: All elements present for both panels; AC-001 and AC-004 verified

---

## Story 2: Select, Remove, Reorder, and Parameterize

**User Story**: An analyst curates the dashboard by adding saved queries, removing queries, reordering panels, and supplying parameter values.

**Walkthrough**:

### Step 2.1: Reorder Panels

1. On dashboard, hover over panel header for "Daily Revenue Trend"
2. Click **"Move Up"** button
3. Observe panel order swaps: "Daily Revenue Trend" now appears first, "Revenue by Category" second

**Expected Result**: Panel order persisted in `dashboard_panels.panel_order`; reload confirms order is maintained (AC-002)

### Step 2.2: Edit Panel Name

1. Click panel header for "Daily Revenue Trend"
2. Click **"Edit Panel"**
3. Change panel name from NULL to `Weekly Trend Analysis`
4. Click **"Save"**

**Expected Result**: Panel now displays as "Weekly Trend Analysis" on dashboard; `dashboard_panels.panel_name` updated

### Step 2.3: Hide Panel (Without Deleting)

1. Click panel header for "Revenue by Category"
2. Click **"Hide"** button
3. Panel disappears from dashboard view (marked as `is_visible = FALSE`)

**Expected Result**: Panel hidden but still exists in database; can be unhidden later

### Step 2.4: Remove Panel

1. Unhide the "Revenue by Category" panel via dropdown
2. Click panel header
3. Click **"Delete Panel"** button
4. Confirm deletion

**Expected Result**: Panel removed from dashboard; row deleted from `dashboard_panels`

### Step 2.5: Add Query with Parameters

1. Create a new saved query with parameters (if not already available):
   - Query name: `Revenue by Category (Filtered)`
   - Parameters: `start_date` (required), `end_date` (required), `min_revenue` (optional, default 0)
   - Logic: Filter date range, filter revenue > min_revenue, group by category

2. Back on dashboard, click **"Add Query Panel"**
3. Select `Revenue by Category (Filtered)`
4. A new section appears: **"Parameter Defaults (Optional)"**
5. For parameter `start_date`, enter `2026-05-01`
6. For parameter `end_date`, enter `2026-05-08`
7. Leave `min_revenue` empty (optional)
8. Click **"Add Panel"**

**Expected Result**: Panel added with parameter defaults stored in `dashboard_panels.parameter_overrides_json`

### Step 2.6: Run Dashboard with Parameters (AC-003)

1. Scroll to **Parameter Panel** section at top
2. Observe input fields for `start_date`, `end_date`, `min_revenue`
3. Pre-filled values from panel defaults appear (start_date = 2026-05-01, etc.)
4. Try entering invalid value for `start_date`: `2026-13-01` (invalid month)
5. Click **"Refresh"**

**Expected Result**:

- Error message appears: "Parameter 'start_date' must be a valid date (YYYY-MM-DD)"
- Refresh is blocked; no query execution

1. Fix the date to `2026-05-01`
2. Enter `10000` for `min_revenue`
3. Click **"Refresh"**

**Expected Result**:

- No validation error (valid range and type)
- Dashboard refreshes with parameters: `{start_date: 2026-05-01, end_date: 2026-05-08, min_revenue: 10000}`
- Panel results filtered to only show categories with revenue > 10000

---

## Story 3: Chart Suggestions and Analyst Overrides

**User Story**: System suggests suitable charts; analysts can override chart type, sorting, labels, and visible fields.

**Walkthrough**:

### Step 3.1: Verify Auto-Suggested Chart

1. On dashboard, find "Daily Revenue Trend" panel
2. Chart is rendered as **Line Chart** (time series auto-suggestion)
3. Hover over chart suggestion explanation: `"Chart type automatically selected based on columns detected: one date dimension + one numeric measure = line chart"`

**Expected Result**: Chart suggestion displayed with clear explanation (AC-005)

### Step 3.2: Override Chart Type

1. In "Daily Revenue Trend" panel, find **Chart Configuration** section
2. Click **"Change Chart Type"**
3. Dropdown appears with options: {bar, line, scatter, pie, heatmap, table_only}
4. Select **"Bar"** chart
5. Click **"Apply"**

**Expected Result**:

- Chart re-renders as bar chart
- Configuration persisted in `dashboard_panels.chart_config_json`

### Step 3.3: Verify Override Persists (AC-006)

1. Click **"Save Dashboard"** button
2. Navigate away from dashboard (close tab or go to home)
3. Return to dashboard via URL `/dashboards/{dashboard_id}`

**Expected Result**:

- Dashboard reloads with same composition
- "Daily Revenue Trend" panel still shows bar chart (override persisted)

### Step 3.4: Customize Chart Labels and Colors

1. In "Revenue by Category" panel, click **"Chart Configuration"**
2. Advanced options appear:
   - X-axis label: change from "category" to "Product Category"
   - Y-axis label: change from "revenue" to "Revenue ($)"
   - Color palette: select "colorblind" mode
3. Click **"Apply"**

**Expected Result**: Chart re-renders with new labels and colors; configuration saved

### Step 3.5: Test Edge Case: Table-Only Fallback (AC-005)

1. Create a saved query with too many dimensions (e.g., 5+ categorical columns, no clear aggregation)
2. Add it as a panel to dashboard
3. Click **"Refresh"**

**Expected Result**:

- Chart suggestion is **"table_only"**
- Explanation displayed: "Result set too complex for automatic charting. Review table view or select a chart type manually."
- Only table view rendered (no chart by default)
- Analyst can still manually override to bar/line/etc. if desired

---

## Story 4: Refresh and Export

**User Story**: Analyst refreshes dashboard or enables auto-refresh, then exports dashboard (PNG/PDF) or panel data (Excel/CSV).

**Walkthrough**:

### Step 4.1: Manual Refresh Indicator (AC-007)

1. On dashboard, click **"Refresh Now"**
2. Header shows "Refreshing... (2 of 5 panels)" indicator
3. Panels render as they complete (lazy loading)
4. Once all complete, indicator disappears and timestamp updates

**Expected Result**: Refresh status is visible throughout execution

### Step 4.2: Enable Auto-Refresh (AC-007)

1. In dashboard header, click **"Refresh Settings"**
2. Dropdown shows options: {Manual, 15 minutes, 1 hour}
3. Select **"15 minutes"**
4. Close settings; dashboard now displays "Auto-refresh: Every 15 minutes"

**Expected Result**:

- Cadence persisted in `dashboards.refresh_cadence`
- Backend job triggers refresh every 15 minutes (or next manual trigger)
- Header shows active cadence indicator

### Step 4.3: Export Dashboard to PNG (AC-008)

1. In dashboard header, click **"Export Dashboard"**
2. Modal appears with format options: {PNG, PDF}
3. Select **"PNG"**
4. Click **"Generate"**

**Expected Result**:

- Spinner shows "Generating PNG export..."
- After 3-5 seconds, PNG file downloaded: `weekly-sales-report-2026-05-08.png`
- Image shows full dashboard state including:
  - Title: "Weekly Sales Report"
  - Refresh timestamp: "2026-05-08 14:30:00"
  - All visible panels with charts and tables
  - Footer: "Parameters: start_date=2026-05-01, end_date=2026-05-08"

### Step 4.4: Export Dashboard to PDF (AC-008)

1. Click **"Export Dashboard"** again
2. Select **"PDF"**
3. Click **"Generate"**

**Expected Result**:

- PDF file downloaded with same content as PNG (plus metadata)
- PDF metadata shows: Title="Weekly Sales Report", CreationDate=2026-05-08

### Step 4.5: Export Panel Data to Excel (AC-008)

1. In "Revenue by Category" panel, find **Export Controls**
2. Click **"Export to Excel"**

**Expected Result**:

- Excel file downloaded: `revenue-by-category-2026-05-08.xlsx`
- File structure:
  - Sheet 1 "Metadata": Query name, version, parameters, execution timestamp
  - Sheet 2 "Data": Results table with lineage columns
    - Columns: category, revenue, units, \_source_query_id, \_execution_timestamp, \_metric_status
    - Lineage footer: "Refreshed: 2026-05-08 14:30:00 | Query Version: v1 | Relationships: None"

### Step 4.6: Export Panel Data to CSV (AC-008)

1. In "Daily Revenue Trend" panel, click **"Export to CSV"**

**Expected Result**:

- CSV file downloaded: `daily-revenue-trend-2026-05-08.csv`
- File structure:
  - Header comments (lines starting with #):

    ```
    # Query: Daily Revenue Trend
    # Version: v1
    # Parameters: start_date=2026-05-01, end_date=2026-05-08
    # Execution Time: 2026-05-08 14:30:00
    # Relationships: None
    ```

  - Data rows: date, revenue, \_source_query_id, \_execution_timestamp

---

## Story 5: Error Handling (AC-009)

**User Story**: If one saved query fails, the dashboard keeps rendering other panels and shows bounded error.

**Walkthrough**:

### Step 5.1: Simulate Schema Drift

1. On dashboard with 3 panels, manually delete a column from the source data that one of the queries references
2. Click **"Refresh Now"**

**Expected Result**:

- 2 panels complete successfully and render normally
- 1 panel shows bounded error box:

  ```
  ⚠️ Panel Error: Revenue by Region

  Saved query schema changed. Column 'region' no longer exists in source table.

  [Retry] [Edit Query]
  ```

- Dashboard remains usable with 2/3 panels visible

### Step 5.2: Retry Failed Panel

1. Click **"Retry"** button on failed panel
2. If schema is still broken, same error appears
3. Click **"Edit Query"** to navigate to query editor for fix

**Expected Result**: Error panel provides recovery guidance without blocking dashboard

### Step 5.3: Backend Unavailable (AC-009)

1. Stop backend server
2. On dashboard, click **"Refresh Now"**
3. Panels timeout after 5 seconds

**Expected Result**:

- Page-level error message appears at top:

  ```
  ⚠️ Dashboard Service Unavailable

  Backend is not responding. Try again in 1 minute.
  [Retry]
  ```

- Existing panels remain visible but marked as stale
- No new query results fetched

---

## Acceptance Criteria Verification Checklist

| AC     | Description                                                         | Verified? | Notes                        |
| ------ | ------------------------------------------------------------------- | --------- | ---------------------------- |
| AC-001 | Dashboard header + parameters render on URL open                    | ✓         | Step 1.4                     |
| AC-002 | Panel order persists and reloads correctly                          | ✓         | Step 2.1                     |
| AC-003 | Parameter validation rejects invalid values with feedback           | ✓         | Step 2.6                     |
| AC-004 | Every panel includes KPI, chart/explanation, table, lineage, export | ✓         | Step 1.5                     |
| AC-005 | Auto-chart suggestion or fallback explanation                       | ✓         | Steps 3.1, 3.5               |
| AC-006 | Chart overrides persist independently of saved query                | ✓         | Step 3.3                     |
| AC-007 | Refresh cadence indicator + no overlapping runs                     | ✓         | Steps 4.1, 4.2               |
| AC-008 | Export metadata: timestamp, version, filter context                 | ✓         | Steps 4.5, 4.6               |
| AC-009 | Panel errors isolated; others remain usable                         | ✓         | Step 5.1                     |
| AC-010 | 100k+ row charts render safely via aggregation                      | ✗         | (Manual data setup required) |
| AC-011 | Exploration vs decision-ready labeling                              | ✓         | Step 1.5 (KPI badge)         |

---

## Performance Targets (SC-001..SC-005)

Run the dashboard with typical workload data and measure:

1. **SC-001**: Dashboard header render time (header + parameter panel):
   - Target: < 1 second
   - Measurement: Open dashboard URL, time to first paint of header

2. **SC-002**: Single panel render time (query execution + chart):
   - Target: < 3 seconds per panel
   - Measurement: Time from refresh click to chart display for each panel

3. **SC-003**: Full dashboard refresh (all panels):
   - Target: < 30 seconds
   - Measurement: Time from refresh click to all panels completed

4. **SC-004**: PNG/PDF export time:
   - Target: < 5 seconds
   - Measurement: Time from export click to file download

5. **SC-005**: Excel/CSV export for 1M row result set:
   - Target: < 10 seconds
   - Measurement: Time from export click to file download for panel with large result

---

## Troubleshooting

**Issue**: Dashboard URL returns 404

- **Solution**: Verify dashboard_id in URL matches a dashboard in the database for current workspace

**Issue**: Panels show "Query too slow" timeout

- **Solution**: Reduce parameter date range or add filters to query; verify query completes in < 5s in query builder

**Issue**: Chart suggestion is "table_only" when expecting chart

- **Solution**: Check result-set schema; if > 3 dimensions or no clear numeric/date pattern, heuristic correctly falls back to table

**Issue**: Export button is disabled

- **Solution**: Dashboard run must be completed (status = 'completed'); cannot export while refresh is in progress

**Issue**: Parameter validation error on refresh

- **Solution**: Check parameter types and ranges defined in saved query; ensure values match schema

---

## Next Steps

After quickstart verification:

1. **Add metric contracts** (future spec): Create metric definitions for KPIs to upgrade "Exploratory" labels to "Confirmed"
2. **Enable scheduled exports**: Set up nightly dashboard refresh and email export to managers
3. **Cross-workspace dashboards** (MVP 3): Remove single-workspace scope; allow dashboards to reference queries from multiple workspaces
4. **Dashboard sharing** (MVP 3): Add dashboard_permissions table to allow analysts to grant managers read-only access
