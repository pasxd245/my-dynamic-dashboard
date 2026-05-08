# Quickstart: Query Builder & Execution (Spec 003)

**Date**: 2026-05-08 | **Spec**: `/specs/003-query-builder-execution/spec.md` | **Branch**: `003-query-builder-execution`

## Overview

This quickstart walks through the end-to-end query builder flow: building a query, previewing results, executing, exporting, and saving. By the end, you'll have verified all User Stories from the spec (US-1 through US-7).

**Prerequisites**:

- Workspace with uploaded and profiled data (spec 001).
- At least one approved relationship rule (spec 002).
- Backend and builder running locally (see setup steps below).

---

## Local Setup

### 1. Start Backend

```bash
cd apps/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at `http://localhost:8000`.

### 2. Start Builder

```bash
cd apps/builder
pnpm install
pnpm run dev
```

Builder runs at `http://localhost:5173`.

### 3. Prepare Test Data

Ensure workspace has sample data and relationships:

- Upload sample CSV/Excel files (spec 001).
- Create and approve a relationship rule between two tables (spec 002).

---

## Test Flow: US-1 through US-7

### User Story 1: Build a Query Visually

**Objective**: Verify analyst can select base table, columns, filters, and aggregations.

**Steps**:

1. Open query builder at `http://localhost:5173`.
2. Click **"New Query"** button.
3. In **"Select Base Table"** dropdown, choose a table (e.g., `sales_data`).
4. **Column Selection**: Checkbox-select columns (e.g., `date`, `amount`, `region`).
5. **Add Filter**:
   - Click **"+ Add Filter"**.
   - Select column: `amount`.
   - Select operator: `>`.
   - Enter value: `1000`.
   - Verify filter badge appears.
6. **Add Aggregation**:
   - Click **"+ Add Aggregation"**.
   - Select column: `amount`.
   - Select function: `SUM`.
   - Enter alias: `total_amount`.
   - Verify aggregation badge appears.
7. **Preview SQL**:
   - SQL preview panel should show:

     ```sql
     SELECT
       date,
       region,
       SUM(amount) AS total_amount
     FROM sales_data
     WHERE amount > ?
     ```

   - Verify parentheses and syntax are correct.

**Acceptance**: Preview SQL is syntactically valid and reflects all selections.

---

### User Story 2: Add Joins Using Approved Relationships

**Objective**: Verify analyst can join to related tables via approved relationships only.

**Prerequisite**: Create and approve a relationship rule (e.g., `sales_data.customer_id → customers.id`).

**Steps**:

1. From query with base table selected (from US-1):
2. Click **"+ Add Join"**.
3. **Join Builder** shows list of approved relationship rules for `sales_data`. Select `sales_data → customers`.
4. Verify join UI shows:
   - Relationship name: `sales_data → customers`.
   - Join type: `INNER` (default; can change to LEFT/RIGHT/FULL).
   - Join condition: `sales_data.customer_id = customers.id` (read-only, derived from relationship rule).
5. **Column Selection**: `customers.name` and `customers.region` become available for selection.
6. **Select** `customers.name` as column.
7. **Preview SQL** should now show:

   ```sql
   SELECT
     sales_data.date,
     sales_data.region,
     SUM(sales_data.amount) AS total_amount,
     customers.name
   FROM sales_data
   INNER JOIN customers ON sales_data.customer_id = customers.id
   WHERE sales_data.amount > ?
   ```

**Acceptance**: Join clause is correctly generated; unapproved relationships are not listed.

---

### User Story 3: Preview Results Safely

**Objective**: Verify LIMIT 100 preview completes within 5 seconds.

**Steps**:

1. From query with join (from US-2):
2. Click **"Preview"** button.
3. Verify spinner appears during execution.
4. **After <5 seconds**: Results table shows, max 100 rows, with header **"Showing 100 of ~X rows"** (X is estimated total).
5. If result set < 100 rows, header shows exact count: **"Showing 5 of 5 rows"**.
6. Verify columns and data types match selected columns and schema.
7. **Timeout test** (optional):
   - Modify query to add expensive aggregation or cross-join (if builder supports).
   - Click "Preview" again; verify timeout message appears within 5 seconds if query is slow.

**Acceptance**: Preview completes within 5 seconds; row count metadata is accurate.

---

### User Story 4: Execute Full Query & Handle Results

**Objective**: Verify full query execution returns all rows (or graceful error).

**Steps**:

1. From previewed query (from US-3):
2. Click **"Execute"** button.
3. Verify spinner appears with progress indicator.
4. **After execution**: Results table displays all rows (paginated if > 100).
5. **Row count**: Display should show total row count (e.g., "234 rows returned").
6. **Verify results** match expected output (if you know the expected data).
7. **Error handling test** (optional):
   - Modify a filter to reference non-existent column (e.g., `column_name` → `fake_column`).
   - Click "Execute".
   - Verify user-friendly error message appears (e.g., "Column 'fake_column' not found in base table or joined tables").
   - No raw stack traces shown.

**Acceptance**: Full query executes and returns all rows; errors are user-friendly.

---

### User Story 5: Export Results to Excel or CSV

**Objective**: Verify export to both formats includes lineage metadata.

**Steps**:

1. From executed query (from US-4):
2. Click **"Download as Excel"** button.
3. Verify `.xlsx` file downloads to local machine.
4. **Open Excel file**:
   - **Sheet 1 ("Results")**: Contains all query results as rows/columns.
   - **Sheet 2 ("Lineage")**: Contains metadata:
     - Source tables: `sales_data`, `customers`.
     - Relationship rules: `sales_data → customers (INNER, approved)`.
     - Filters: `sales_data.amount > 1000`.
     - Aggregations: `SUM(sales_data.amount) AS total_amount`.
     - Execution timestamp and time.
5. **CSV Export**:
   - Click **"Download as CSV"** button.
   - Verify `.csv` file downloads.
   - Open in text editor or spreadsheet.
   - Verify first 100 rows are CSV-formatted data (with proper quoting/escaping).
   - Verify final rows include lineage as comment lines (starting with `#`).

**Acceptance**: Excel has two sheets (Results + Lineage); CSV includes lineage as headers/comments.

---

### User Story 6: Validate Query & Surface Errors Early

**Objective**: Verify continuous validation highlights issues without execution.

**Steps**:

1. **Start with valid query** (from US-1).
2. **Add orphaned filter**: Modify base table selection (removing current table). Verify filter on old table's column shows red error badge: **"Filter column 'amount' not found in selected tables"**.
3. **Fix error**: Re-select original base table. Verify error badge clears.
4. **Unapproved join test** (if builder supports editing relationship approval status on-the-fly):
   - Add join via approved relationship.
   - Simulate relationship unapproval (backend operation).
   - Verify join shows warning: **"Relationship rule no longer approved"**.
5. **GROUP BY without aggregation**: Add GROUP BY column without any aggregations. Verify validation warning: **"GROUP BY requires at least one aggregation"**.

**Acceptance**: Validation errors are surfaced immediately; user can fix them before attempting execution.

---

### User Story 7: Save & Reuse Query Configurations

**Objective**: Verify query persistence and retrieval.

**Steps**:

1. From a complete query (from US-6):
2. Click **"Save Query"** button.
3. **Save Dialog**:
   - Enter query name: `Sales by Region > $1k`.
   - Enter description: `Total sales by customer region for orders over $1000`.
   - Click **"Save"**.
4. Verify success notification: **"Query saved as 'Sales by Region > $1k'"**.
5. **Open "Saved Queries"** panel (or sidebar).
6. Verify saved query appears in list with name, description, created date.
7. **Load Saved Query**:
   - Click **"Load"** on the saved query.
   - Verify query builder repopulates with all settings:
     - Base table: `sales_data`.
     - Columns: `date`, `region`, `customers.name`.
     - Filter: `amount > 1000`.
     - Aggregation: `SUM(amount) AS total_amount`.
     - Join: `sales_data → customers (INNER)`.
8. **Duplicate Query**:
   - From saved query, click **"Duplicate"**.
   - Verify new query appears in saved list as `Sales by Region > $1k - Copy`.
   - Verify builder opens with duplicated settings.
   - Modify (e.g., change filter to `> 500`).
   - Save as new query: `Sales by Region > $500`.
   - Verify both queries coexist in saved list.
9. **Orphaned Query Test** (optional):
   - Backend operation: Delete a column or table referenced by saved query.
   - Click "Load" on the saved query.
   - Verify warning: **"Column 'region' no longer exists; please update the query"**.
   - Verify builder allows modification and re-save.

**Acceptance**: Query configs persist; loading restores all settings; orphaned queries are detected.

---

## Verification Checklist

Use this checklist to confirm all features are working:

- [ ] US-1: Query builder UI with base table, columns, filters, aggregations displays SQL preview.
- [ ] US-2: Join builder shows only approved relationships; join condition is auto-populated.
- [ ] US-3: Preview completes within 5 seconds; shows up to 100 rows with row count metadata.
- [ ] US-4: Full execution returns all rows; user-friendly error messages (no stack traces).
- [ ] US-5: Excel export has Results + Lineage sheets; CSV export includes lineage.
- [ ] US-6: Validation errors appear immediately (orphaned columns, unapproved joins, GROUP BY warnings).
- [ ] US-7: Queries save and load with all settings restored; duplicates work; orphaned queries detected.

---

## Edge Cases to Test

1. **Empty Result Set**: Query with very restrictive filters returns 0 rows. Verify UI shows "No results" clearly.
2. **Large Result Set (1M+ rows)**: Query on large table. Verify export completes; memory estimate may reject execution if result set is too large.
3. **Special Characters in Filter**: Filter value contains `'`, `"`, `%`, etc. Verify SQL injection is prevented (no errors, correct escaping).
4. **Null Aggregations**: SUM on column with all nulls. Verify result shows `NULL` (not 0 or error).
5. **Concurrent Execution**: Two analysts run large queries simultaneously. MVP 1 may queue or reject; verify messaging is clear.

---

## Performance Baselines (SC-001 through SC-005)

- **SC-001**: Preview (LIMIT 100) completes within 5 seconds. ✓ (measure time in browser DevTools).
- **SC-002**: Full execution on 100k-row dataset completes within 5 seconds (if aggregated). ✓ (set up test dataset).
- **SC-003**: Export to Excel (up to 1M rows) completes within 10 seconds. ✓ (time file write).
- **SC-004**: SQL preview displays instantly (no perceptible lag). ✓ (browser performance tab).
- **SC-005**: Error messages (e.g., "Column not found") appear within 1 second. ✓ (time validation endpoint).

---

## Rollback & Troubleshooting

If tests fail:

1. **Backend not running**: Verify `http://localhost:8000/api/v1/workspaces` returns 200 (health check).
2. **Query builder UI not loading**: Verify `http://localhost:5173` loads without console errors (DevTools).
3. **Preview/execution hangs**: Check backend logs for stack traces; verify DuckDB connection is active.
4. **Export not downloading**: Check browser console for fetch errors; verify CORS headers if backend and builder on different ports.
5. **Relationship rule not listed**: Verify relationship status is "approved" in spec 002 backend.

---

## Next Steps (Post-MVP 1)

- Spec 004 (Saved Queries + Metrics): Add metric contracts on top of queries.
- Spec 005 (Dashboard Visualizations): Visualize query results in charts.
- Spec 006 (Production Deployment): Multi-user queuing, query optimization hints.
