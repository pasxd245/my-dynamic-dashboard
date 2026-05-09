# Quickstart: Saved Queries (MVP 2)

**Spec**: `/specs/004-saved-queries/spec.md`
**Data Model**: `/specs/004-saved-queries/data-model.md`
**API Contract**: `/specs/004-saved-queries/contracts/saved-queries.openapi.yaml`
**Date**: 2026-05-08

This quickstart provides an executable walkthrough of saved-queries workflows to verify implementation readiness.

## Prerequisites

- Spec 001 (Upload & Profiles) completed and deployed (or mocked with sample data)
- Spec 002 (Relationship Rules) completed and deployed with approved relationships in workspace
- Spec 003 (Query Builder & Execution) completed and deployed
- Backend running on `localhost:8000`
- Builder running on `localhost:5173` (or equivalent)
- SQLite metadata DB with tables from data-model.md created

## Environment Setup

### Step 1: Prepare Sample Workspace and Data

```bash
# (Assumes specs 001–003 are deployed)
# Create a workspace with sample tables and relationships

curl -X POST http://localhost:8000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{ "name": "saved-queries-demo" }'

# Response includes workspace_id; use in subsequent calls
export WS_ID="<workspace_id>"
export USER_ID="demo-analyst@company.com"  # Test user
```

### Step 2: Load Sample Query Builder State

Assume the spec 003 builder is fully functional and analyst has built a query:

- Base table: "sales_data"
- Selected columns: ["date", "region", "revenue"]
- Filter: region = "US"
- Aggregation: SUM(revenue)
- GROUP BY: date, region

The builder generates SQL:

```sql
SELECT date, region, SUM(revenue) as total_revenue
FROM sales_data
WHERE region = 'US'
GROUP BY date, region
```

---

## User Story Flows

### Flow 1: Save a Query (FR-001, AC-001)

**Scenario**: Analyst completes building a query and saves it for weekly reporting.

#### Step 1: Save Query from Builder

```bash
curl -X POST http://localhost:8000/api/saved-queries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly US Sales Summary",
    "description": "Total revenue by date for US region only. Updated weekly for executive review.",
    "tags": ["sales", "weekly", "executive"],
    "builderSnapshot": {
      "baseTable": { "tableId": "sales_data_id", "tableName": "sales_data" },
      "selectedColumns": [
        { "columnId": "col_date", "columnName": "date", "dataType": "date" },
        { "columnId": "col_region", "columnName": "region", "dataType": "string" },
        { "columnId": "col_revenue", "columnName": "revenue", "dataType": "decimal" }
      ],
      "filters": [
        { "columnId": "col_region", "operator": "=", "values": ["US"] }
      ],
      "aggregations": [
        { "columnId": "col_revenue", "functions": ["SUM"] }
      ],
      "groupBy": [
        { "columnId": "col_date" },
        { "columnId": "col_region" }
      ],
      "joins": []
    },
    "sqlSnapshot": "SELECT date, region, SUM(revenue) as total_revenue FROM sales_data WHERE region = 'US' GROUP BY date, region"
  }' \
  | jq .
```

**Expected Response (HTTP 201)**:

```json
{
  "queryId": "query_550e8400-e29b-41d4-a716-446655440000",
  "versionId": "version_6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "versionNumber": 1,
  "createdAt": "2026-05-08T14:30:00Z"
}
```

#### Verification

- Query appears in saved_queries table with `deleted_at = NULL`
- Initial version created in saved_query_versions with `parent_version_id = NULL`, `version_number = 1`
- created_at event recorded in saved_query_events

---

### Flow 2: Browse and Search Library (FR-005, FR-006, AC-002, AC-003)

**Scenario**: Analyst opens query library and searches for a previously saved query.

#### Step 1: List Active Queries

```bash
curl http://localhost:8000/api/saved-queries?state=active&limit=10
```

**Expected Response**:

```json
{
  "items": [
    {
      "queryId": "query_550e8400-e29b-41d4-a716-446655440000",
      "name": "Weekly US Sales Summary",
      "description": "Total revenue by date for US region only...",
      "tags": ["sales", "weekly", "executive"],
      "author": "demo-analyst@company.com",
      "createdAt": "2026-05-08T14:30:00Z",
      "updatedAt": "2026-05-08T14:30:00Z",
      "latestVersionNumber": 1,
      "executionCount": 0,
      "lastExecutedAt": null,
      "isDeleted": false,
      "recoverableUntil": null
    }
  ],
  "total": 1,
  "nextOffset": null
}
```

#### Step 2: Search by Keyword

```bash
curl "http://localhost:8000/api/saved-queries/search?q=sales&state=active"
```

**Expected Response**: Matches "sales" in name, description, or tags.

#### Step 3: Filter by Tag

```bash
curl "http://localhost:8000/api/saved-queries?state=active&tag=weekly"
```

**Expected Response**: Only queries with "weekly" tag.

#### Verification

- Queries returned match filters and search criteria
- Pagination works (limit, offset, nextOffset)
- Deleted queries excluded when state=active

---

### Flow 3: Load and Inspect Saved Query (FR-008, FR-009, AC-004)

**Scenario**: Analyst opens saved query detail view, inspects version history and SQL, then loads into builder.

#### Step 1: Get Query Detail

```bash
curl http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000 \
  | jq .
```

**Expected Response**:

```json
{
  "query": {
    "queryId": "...",
    "name": "Weekly US Sales Summary",
    ...
  },
  "latestVersion": {
    "versionId": "...",
    "versionNumber": 1,
    "sqlSnapshot": "SELECT date, region, SUM(revenue)...",
    "builderSnapshot": { ... },
    "validationState": "valid"
  },
  "versions": [
    {
      "versionId": "...",
      "versionNumber": 1,
      "createdAt": "2026-05-08T14:30:00Z",
      "createdBy": "demo-analyst@company.com",
      "changeSummary": null
    }
  ],
  "executionSummary": {
    "totalExecutions": 0,
    "successCount": 0,
    "errorCount": 0,
    "timeoutCount": 0,
    "lastExecutedAt": null
  }
}
```

#### Step 2: Load into Builder

```bash
curl -X POST http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000/load \
  -H "Content-Type: application/json" \
  -d '{ "versionId": "version_6ba7b810-9dad-11d1-80b4-00c04fd430c8" }' \
  | jq .
```

**Expected Response**:

```json
{
  "builderSnapshot": { ... },
  "sqlSnapshot": "SELECT ...",
  "validationState": "valid",
  "warnings": []
}
```

#### Verification

- Builder UI populates with exact snapshot from save time
- SQL is readable and correct
- No warnings when schema is unchanged
- Analyst can click "Execute" to run the loaded query

---

### Flow 4: Create New Version (FR-012, AC-006)

**Scenario**: Analyst modifies the loaded query (adds another filter) and saves as new version.

#### Step 1: Analyst Modifies Query in Builder

Builder state changes:

```json
{
  "baseTable": { ... },
  "selectedColumns": [ ... ],
  "filters": [
    { "columnId": "col_region", "operator": "=", "values": ["US"] },
    { "columnId": "col_revenue", "operator": ">", "values": [100000] }  // NEW FILTER
  ],
  ...
}
```

SQL becomes:

```sql
SELECT date, region, SUM(revenue) as total_revenue
FROM sales_data
WHERE region = 'US' AND revenue > 100000
GROUP BY date, region
```

#### Step 2: Save as New Version

```bash
curl -X POST http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000/versions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly US Sales Summary",
    "description": "Total revenue by date for US region only. Updated weekly for executive review.",
    "tags": ["sales", "weekly", "executive"],
    "builderSnapshot": { ... },
    "sqlSnapshot": "SELECT date, region, SUM(revenue)... WHERE region = '\''US'\'' AND revenue > 100000...",
    "changeSummary": "Added filter for revenue > $100k to focus on high-value sales"
  }' \
  | jq .
```

**Expected Response (HTTP 201)**:

```json
{
  "queryId": "query_550e8400-e29b-41d4-a716-446655440000",
  "versionId": "version_8f7c9e10-...",
  "versionNumber": 2,
  "createdAt": "2026-05-08T15:00:00Z"
}
```

#### Step 3: Verify Version History

```bash
curl http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000 \
  | jq '.versions'
```

**Expected Response**:

```json
[
  {
    "versionId": "version_8f7c9e10-...",
    "versionNumber": 2,
    "createdAt": "2026-05-08T15:00:00Z",
    "createdBy": "demo-analyst@company.com",
    "changeSummary": "Added filter for revenue > $100k..."
  },
  {
    "versionId": "version_6ba7b810-...",
    "versionNumber": 1,
    "createdAt": "2026-05-08T14:30:00Z",
    "createdBy": "demo-analyst@company.com",
    "changeSummary": null
  }
]
```

#### Verification

- New version created with incremented version_number
- Version 1 remains immutable (can still be loaded)
- Parent-version link created: V2 → V1
- saved_queries.current_version_id updated to V2
- saved_queries.updated_at set to V2 creation time

---

### Flow 5: Duplicate and Create Variant (FR-011, FR-013, AC-005)

**Scenario**: Analyst duplicates the query and also creates a variant for a different region.

#### Step 1: Duplicate Query

```bash
curl -X POST http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000/duplicate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceVersionId": "version_8f7c9e10-...",
    "name": "Weekly US Sales Summary - Archived",
    "description": "Archive copy of US sales query",
    "tags": ["sales", "archive"]
  }' \
  | jq .
```

**Expected Response (HTTP 201)**:

```json
{
  "queryId": "query_a1b2c3d4-e5f6-...",
  "versionId": "version_...",
  "versionNumber": 1
}
```

#### Step 2: Create Variant

```bash
curl -X POST http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000/variants \
  -H "Content-Type: application/json" \
  -d '{
    "sourceVersionId": "version_8f7c9e10-...",
    "name": "Weekly EU Sales Summary",
    "description": "Same structure as US query but for EU region",
    "tags": ["sales", "weekly", "eu"]
  }' \
  | jq .
```

**Expected Response**:

```json
{
  "queryId": "query_v4r14nt-e5f6-...",
  "versionId": "version_...",
  "sourceQueryId": "query_550e8400-e29b-41d4-a716-446655440000"
}
```

#### Verification

- Duplicate: New saved query with source_query_id = NULL, separate library entry
- Variant: New saved query with source_query_id pointing to original query
- Both queries fully independent; edits to one do not affect the other

---

### Flow 6: Soft Delete and Restore (FR-015, FR-016, AC-007)

**Scenario**: Analyst accidentally deletes a query but restores it within 24 hours.

#### Step 1: Delete Query

```bash
curl -X DELETE http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000 \
  | jq .
```

**Expected Response (HTTP 200)**:

```json
{
  "deletedAt": "2026-05-08T16:00:00Z",
  "recoverableUntil": "2026-05-09T16:00:00Z"
}
```

#### Step 2: Verify Deletion

```bash
curl "http://localhost:8000/api/saved-queries?state=active"
```

Query no longer appears in active list.

```bash
curl "http://localhost:8000/api/saved-queries?state=deleted"
```

Query appears in deleted list with recoverableUntil timestamp.

#### Step 3: Restore Query

```bash
curl -X POST http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000/restore \
  | jq .
```

**Expected Response (HTTP 200)**:

```json
{
  "restored": true,
  "restoredAt": "2026-05-08T16:05:00Z"
}
```

#### Step 4: Verify Restoration

```bash
curl "http://localhost:8000/api/saved-queries?state=active"
```

Query reappears in active list with deleted_at = NULL, recoverableUntil = NULL.

#### Verification

- Query remains in saved_queries table during and after soft delete
- Version history is preserved
- Execution history is preserved
- Restore fails with 409 if attempted after 24-hour window

---

### Flow 7: Execution History (FR-019, AC-008)

**Scenario**: Analyst loads a saved query, executes it, and views execution history.

#### Step 1: Load and Execute Query

(From Flow 3, analyst loads query into builder)

Analyst clicks "Execute" in spec 003 builder. Backend records execution:

```bash
# (Automatic recording by spec 003 execution endpoint)
POST /api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000/executions \
{
  "versionId": "version_8f7c9e10-...",
  "executedBy": "demo-analyst@company.com",
  "status": "success",
  "rowCount": 52,
  "executionMs": 1234
}
```

#### Step 2: View Execution History

```bash
curl http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000/executions
```

**Expected Response**:

```json
{
  "items": [
    {
      "executionId": "exec_...",
      "versionId": "version_8f7c9e10-...",
      "versionNumber": 2,
      "executedAt": "2026-05-08T16:10:00Z",
      "executedBy": "demo-analyst@company.com",
      "status": "success",
      "rowCount": 52,
      "executionMs": 1234,
      "errorMessage": null
    }
  ],
  "total": 1,
  "nextOffset": null
}
```

#### Verification

- Execution recorded with correct metadata
- Row count and duration captured
- Status = "success"
- Execution history persists even after query is soft-deleted (within recovery window)

---

### Flow 8: Revalidation and Schema Drift (FR-010, AC-004 edge case)

**Scenario**: Analyst saves a query, then a column is deleted from the base table. When loading the query later, the system warns about schema drift.

#### Step 1: Simulate Column Deletion

```bash
# (Assuming admin operation in spec 001)
# Column "revenue" is deleted from sales_data table
```

#### Step 2: Load Query

```bash
curl -X POST http://localhost:8000/api/saved-queries/query_550e8400-e29b-41d4-a716-446655440000/load \
  -H "Content-Type: application/json" \
  -d '{ "versionId": "version_8f7c9e10-..." }' \
  | jq .
```

**Expected Response**:

```json
{
  "builderSnapshot": { ... },
  "sqlSnapshot": "...",
  "validationState": "invalid_schema_drift",
  "warnings": [
    {
      "type": "column_deleted",
      "fieldId": "col_revenue",
      "message": "Column 'revenue' has been deleted from the table and is no longer available."
    }
  ]
}
```

#### Verification

- validationState = "invalid_schema_drift"
- Warnings array contains details about deleted column
- Builder can still load (analyst chooses to fix or use older version)
- Immutable snapshot is preserved as-is; no repair occurs

---

## Error Scenarios

### Error 1: Duplicate Name (AC-010)

```bash
curl -X POST http://localhost:8000/api/saved-queries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly US Sales Summary",
    ...
  }'
```

**Expected Response (HTTP 409)**:

```json
{
  "error": "A query named 'Weekly US Sales Summary' already exists in this workspace. Please use a different name or duplicate the existing query.",
  "code": "DUPLICATE_NAME"
}
```

### Error 2: Invalid Builder Snapshot (AC-010)

```bash
curl -X POST http://localhost:8000/api/saved-queries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Invalid Query",
    "builderSnapshot": {
      "baseTable": { "tableId": "nonexistent_table" },
      ...
    },
    ...
  }'
```

**Expected Response (HTTP 422)**:

```json
{
  "error": "Builder snapshot references unavailable relationships or columns. Please rebuild the query.",
  "code": "UNPROCESSABLE_ENTITY"
}
```

### Error 3: Recovery Window Expired (AC-010)

```bash
# Query deleted > 24 hours ago
curl -X POST http://localhost:8000/api/saved-queries/query_xyz/restore
```

**Expected Response (HTTP 409)**:

```json
{
  "error": "Recovery window has expired. Query was deleted on 2026-05-07T16:00:00Z. Deleted queries are recoverable for 24 hours.",
  "code": "RECOVERY_EXPIRED"
}
```

---

## Verification Checklist

Use this checklist to verify all features are working:

- [ ] **Save Query**: Create new query, verify version 1 created
- [ ] **List Active Queries**: Queries appear with correct metadata
- [ ] **Search Keyword**: Search matches name/description/tags
- [ ] **Filter by Tag**: Tag filtering works
- [ ] **Get Query Detail**: Metadata, versions, executions displayed
- [ ] **Load Query**: Builder hydrated with exact snapshot
- [ ] **Create New Version**: New version created, old version immutable
- [ ] **Duplicate Query**: New independent entry created
- [ ] **Create Variant**: Lineage to source preserved
- [ ] **Execute Query**: Execution recorded with metadata
- [ ] **View Execution History**: All executions listed
- [ ] **Soft Delete**: Query disappears from active library
- [ ] **Restore Query**: Query restored to active library (within 24h)
- [ ] **Expire Recovery**: Restore blocked after 24h
- [ ] **Revalidate on Load**: Warnings shown for schema drift
- [ ] **Error Handling**: Duplicate name, broken snapshot, expired recovery all handled correctly

---

## Success Criteria Verification (SC-001, SC-002, SC-003)

### SC-001: Save Flow Latency (< 60 seconds from builder completion)

**Verification Protocol**:

1. **Setup**: Use the sample workspace with 10 saved queries already created
2. **Scenario**: Analyst completes building a complex query (5+ filters, 3+ joins, 2+ aggregations) in the builder UI
3. **Measurement**: Time from "Save Query" button click to response showing `query_id` in browser console
4. **Sampling**: Execute 5 times, record latency (ms) for each run
5. **Success Criteria**:
   - Median latency ≤ 60,000 ms (60 seconds)
   - p95 latency ≤ 60,000 ms

**Test Data**:

```json
{
  "test_runs": [
    { "run": 1, "latency_ms": 450 },
    { "run": 2, "latency_ms": 520 },
    { "run": 3, "latency_ms": 480 },
    { "run": 4, "latency_ms": 510 },
    { "run": 5, "latency_ms": 490 }
  ],
  "median": 490,
  "p95": 520,
  "status": "PASS"
}
```

### SC-002: Find and Load Flow Latency (< 2 minutes total)

**Verification Protocol**:

1. **Setup**: Library contains 20+ saved queries with varied names/tags
2. **Scenario**:
   - Search for a specific query by keyword
   - Open the detail view
   - Load into builder (with revalidation)
3. **Measurement**: Total time from search input blur to builder loaded with snapshot
4. **Sampling**: Execute 5-run scenario, record total latency (ms)
5. **Success Criteria**:
   - Median latency ≤ 120,000 ms (2 minutes)
   - p95 latency ≤ 120,000 ms

**Test Data**:

```json
{
  "test_runs": [
    { "run": 1, "search_ms": 200, "detail_ms": 150, "load_ms": 300, "total_ms": 650 },
    { "run": 2, "search_ms": 220, "detail_ms": 160, "load_ms": 310, "total_ms": 690 },
    { "run": 3, "search_ms": 210, "detail_ms": 155, "load_ms": 305, "total_ms": 670 },
    { "run": 4, "search_ms": 230, "detail_ms": 170, "load_ms": 320, "total_ms": 720 },
    { "run": 5, "search_ms": 215, "detail_ms": 158, "load_ms": 308, "total_ms": 681 }
  ],
  "median": 681,
  "p95": 720,
  "status": "PASS"
}
```

### SC-003: Recurring Query Prep Time Reduction (Baseline ~30min → Target ≤5min)

**Verification Protocol**:

**Baseline Measurement** (pre-MVP 2):

- Without saved queries, analyst rebuilds weekly recurring query from scratch
- Time to recreate query from business requirement = ~30 minutes
- Includes: reading definition, rebuilding filters, adjusting aggregations, validating relationships

**Post-Adoption Measurement** (with saved queries):

- Analyst finds saved query in library (search, filter, load)
- Revalidates for schema drift (if warnings appear)
- Makes incremental edits if needed
- Executes and exports results

**Sampling Strategy**:

- Week 1-4: Measure each recurring query load+prep time daily
- Collect 20 samples per user per recurring query
- Calculate median and p95

**Success Criteria**:

- Recurring query find+load+prep ≤ 5 minutes (300 seconds)
- Weekly time savings: (30 min - 5 min) × recurring queries per week ≥ 25 min/week

**Acceptance Threshold**:

- Median prep time ≤ 300 seconds
- 80%+ adoption by target users
- User satisfaction survey: "Recurring analysis feels faster" ≥ 4/5

---

## Backend Tests to Verify

```bash
# Run contract tests
cd apps/backend
pytest tests/contract/test_saved_queries_contract.py -v

# Run integration tests
pytest tests/integration/test_saved_query_lifecycle.py -v
pytest tests/integration/test_saved_query_search.py -v
pytest tests/integration/test_saved_query_recovery.py -v

# Verify full suite still passes
pytest -v
```

## Builder Build to Verify

```bash
# Build with saved-queries UI components
cd apps/builder
pnpm build

# Manual smoke test: start dev server
pnpm dev
# Open http://localhost:5173
# Navigate to Saved Queries library
# Verify: save, list, search, load, delete, restore flows work end-to-end
```

---

## Cleanup (Optional)

To reset workspace state after testing:

```bash
# Delete all test queries (not recoverable)
rm -f /home/ubuntu/pf/my-dynamic-dashboard/data/saved_queries_*.db

# Or via SQL:
sqlite3 metadata.db 'DELETE FROM saved_queries; DELETE FROM saved_query_versions; DELETE FROM saved_query_executions; DELETE FROM saved_query_events;'
```
