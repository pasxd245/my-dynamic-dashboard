# Feature Specification: Query Builder & Execution (MVP 1)

**Feature Branch**: `003-query-builder-execution`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: MVP 1 core engine requirement from `docs/analysis/09-mvp-plan.md` and user description above.

## Business Question _(mandatory for this project)_

> "Given that I've uploaded my datasets and defined the relationships between them,
> can I now visually select the tables and columns I want, add filters and aggregations,
> preview the results safely, and export the answer to Excel or CSV in under 5 seconds —
> without writing SQL or crashing my Excel?"

**Decision consumed**: Whether the analyst can move from manual Excel data wrangling to
a governed, repeatable query process within MVP 1 timeline and performance constraints.

**Primary roles**: Data analyst (builds queries, executes exports), business owner (receives
decision-ready exports with full lineage).

**Constitution alignment**:

- **Principle I (Business-Question-First)**: Answers specific business question about
  data transformation without manual Excel workflow.
- **Principle III (Relationship Rule Before Cross-Table Query)**: Only approved
  relationships from spec 002 are usable in joins; no ad-hoc SQL.
- **Principle VI (Traceability For Every Claim)**: Every export includes source tables,
  relationship rules used, filters applied, aggregations, and cardinality.
- **Principle VII (Reproducibility From Raw Inputs)**: Query configuration is versioned
  and reproducible alongside the manifest.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Build a query visually (Priority: P1)

An analyst selects a base table, chooses which columns to display, adds filters (with
support for comparison operators), specifies aggregations and GROUP BY dimensions, and
sees a generated SQL preview before executing.

**Why this priority**: This is the core feature. Without query building, the analyst
cannot consume the uploaded data.

**Independent Test**: Build a single-table query with a filter and an aggregation,
verify the SQL preview is valid, and execute to see results.

**Acceptance Scenarios**:

1. **Given** a workspace with uploaded and profiled tables, **When** the analyst opens
   the query builder, **Then** they see a base-table selector listing all available
   tables.
2. **Given** a selected base table, **When** the analyst views the columns panel,
   **Then** all columns from that table are listed with their data types and can be
   toggled on/off for inclusion in the result set.
3. **Given** selected columns, **When** the analyst adds a filter, **Then** the filter
   builder shows the column name, a selector for comparison operator (=, !=, <, >, <=,
   > =, IN, LIKE, IS NULL, IS NOT NULL), and an input for the filter value(s).
4. **Given** a numeric column, **When** the analyst selects it for an aggregation,
   **Then** the aggregation selector shows available functions (SUM, COUNT, AVG, MAX,
   MIN) and the analyst can apply one or more aggregations.
5. **Given** aggregations selected, **When** the analyst specifies GROUP BY dimensions,
   **Then** the GROUP BY columns are validated to be non-aggregated columns from the
   base table or joined tables.
6. **Given** a complete query configuration, **When** the analyst previews the query,
   **Then** the generated SQL is displayed for review (read-only, no direct edit).

---

### User Story 2 — Add joins using approved relationships (Priority: P1)

An analyst adds a join to a related table by selecting an approved relationship rule
from spec 002, which automatically configures the join columns and type.

**Why this priority**: Multi-table analysis requires safe, governed joins. Only approved
relationships are used; this enforces the Constitution's Principle III.

**Independent Test**: Define a relationship between two tables in spec 002, approve it,
then in the query builder select the same relationship to add a join, and verify the
join clause appears correctly in the SQL preview.

**Acceptance Scenarios**:

1. **Given** a query with a base table selected, **When** the analyst opens the join
   builder, **Then** a list of approved relationship rules involving the base table or
   already-joined tables is displayed with relationship type and join type.
2. **Given** the analyst selects a relationship rule, **When** the join is added,
   **Then** the system computes and shows the join clause (e.g., "INNER JOIN table_b ON
   table_a.id = table_b.id") and the joined table's columns become available for
   selection, filtering, and aggregation.
3. **Given** a join is added, **When** the analyst attempts to remove the base table
   from column selection, **Then** an error is raised because at least one column from
   the base table must remain.
4. **Given** multiple joins configured, **When** the analyst views the query preview,
   **Then** all join clauses are shown in correct SQL order and nesting (or confirmed
   as flat joins if using a single query layer).
5. **Given** a relationship rule's status changes from approved to something else
   **after** the query is built, **When** the query is executed, **Then** the query is
   rejected with a clear message that the relationship is no longer approved, and the
   user is prompted to rebuild the query with current approved relationships.

---

### User Story 3 — Preview results safely (Priority: P1)

Before executing a potentially expensive query, the analyst sees a LIMIT 100 preview
of the results, row count, and execution metadata (columns, types) without waiting for
the full query.

**Why this priority**: Safe preview prevents runaway queries and incorrect configurations
from wasting compute time.

**Independent Test**: Build a query that would return 10k+ rows, click preview, confirm
exactly 100 rows are shown and the UI indicates more rows exist.

**Acceptance Scenarios**:

1. **Given** a query configuration is complete and valid, **When** the analyst clicks
   "Preview", **Then** the system executes the query with a LIMIT 100, displays the
   result set (max 100 rows), and shows metadata: "Showing 100 of ~X rows" where X is
   an estimated total.
2. **Given** a preview is in progress, **When** the preview execution exceeds 5 seconds,
   **Then** the preview is cancelled and a message informs the analyst that the preview
   timed out (likely indicating the full query would also be slow).
3. **Given** a preview result set contains fewer than 100 rows, **When** the preview
   completes, **Then** the display shows the exact row count ("Showing 5 of 5 rows")
   with no "more rows" indicator.
4. **Given** a preview has been run, **When** the analyst modifies the query (columns,
   filters, joins), **Then** the preview is automatically invalidated and must be
   re-run.

---

### User Story 4 — Execute full query and handle large result sets (Priority: P1)

The analyst executes the full query and receives either the complete result set or
clear messaging about execution failure (timeout, invalid syntax, missing relationship,
etc.).

**Why this priority**: Actually running queries is the core value; without execution,
the builder is just a toy.

**Independent Test**: Execute a query on a 100k+ row dataset, confirm completion in
under 5 seconds or graceful timeout message, and receive full results.

**Acceptance Scenarios**:

1. **Given** a preview has been run, **When** the analyst clicks "Execute", **Then** the
   system queues the full query, shows a progress indicator, and displays results as
   they become available (or all at once if query completes sub-second).
2. **Given** a query execution is in progress, **When** the execution exceeds the 5-second
   timeout target, **Then** the query is cancelled, the analyst is notified of the
   timeout, and suggestions are offered (e.g., "reduce result set with filters" or
   "aggregate earlier").
3. **Given** a query execution fails due to invalid SQL or a runtime error, **When** the
   error is caught, **Then** the analyst sees a user-friendly message describing the
   error (not raw stack traces) and a suggestion for remediation (e.g., "check that all
   filter columns exist in the selected tables").
4. **Given** a query execution succeeds and returns N rows where N > 100k, **When** the
   results are ready, **Then** all rows are available for download; UI pagination or
   lazy loading is used to prevent browser performance degradation.
5. **Given** a result set exceeds available memory on the backend, **When** this is
   detected before query execution, **Then** the query is rejected with a message
   advising the analyst to add filters or aggregations to reduce the result set.

---

### User Story 5 — Export results to Excel or CSV (Priority: P1)

The analyst downloads the query results in Excel (.xlsx) or CSV (.csv) format, with
full lineage metadata included in the export.

**Why this priority**: Export to Excel/CSV is the primary value driver; this is how
analysts consume results and share with stakeholders.

**Independent Test**: Build, execute, and export a query as both Excel and CSV, confirm
both files open correctly, contain all results, and include lineage metadata.

**Acceptance Scenarios**:

1. **Given** a successful query execution with results, **When** the analyst clicks
   "Download as Excel", **Then** a .xlsx file is generated with all result rows and
   columns in a worksheet named "Results".
2. **Given** an Excel export, **When** the file is opened, **Then** a second worksheet
   named "Lineage" contains: source table names, relationship rules used (with IDs and
   approval status), filters applied, aggregations, GROUP BY columns, and execution
   timestamp.
3. **Given** a successful query execution with results, **When** the analyst clicks
   "Download as CSV", **Then** a .csv file is generated with all result rows, using
   standard CSV encoding (UTF-8, comma-delimited).
4. **Given** an export is requested for a very large result set (1M+ rows), **When** the
   export is in progress, **Then** a progress indicator is shown and the download
   completes without browser hang or memory exhaustion.
5. **Given** a result set contains special characters or null values, **When** export
   occurs, **Then** special characters are properly escaped and nulls are represented
   consistently (e.g., empty string in CSV, #N/A in Excel).

---

### User Story 6 — Validate query and surface errors early (Priority: P2)

As the analyst builds or modifies a query, validation runs continuously, highlighting
issues such as orphaned filter columns, circular relationships, or invalid SQL syntax,
before execution is attempted.

**Why this priority**: Early validation improves UX and reduces wasted compute on
invalid queries.

**Independent Test**: Build a query with a filter on a non-existent column, confirm a
validation error appears, fix the filter, and confirm the error clears.

**Acceptance Scenarios**:

1. **Given** a query builder state where a selected filter column no longer exists
   (e.g., schema was updated), **When** the analyst reviews the query, **Then** a
   validation error is shown highlighting the missing column and blocking execution.
2. **Given** a join is configured but the relationship rule is no longer approved,
   **When** the analyst attempts execution, **Then** validation fails with a clear
   message and the join is highlighted for review.
3. **Given** a GROUP BY is specified without aggregations, **When** the analyst attempts
   to generate SQL, **Then** validation warns that the query will fail and suggests
   adding aggregations.
4. **Given** two joins share a common intermediate table, **When** the query preview is
   generated, **Then** the system validates the join order and warns if ambiguity or
   redundancy is detected.

---

### User Story 7 — Save and reuse query configurations (Priority: P2)

An analyst saves a query configuration with a name and description, can retrieve it
later, and can fork or duplicate a saved query to create variants.

**Why this priority**: Query reuse and variants are essential for efficiency in iterative
analysis.

**Independent Test**: Build a query, save it with a name, reload the workspace, retrieve
the saved query, and verify all settings are restored.

**Acceptance Scenarios**:

1. **Given** a query configuration, **When** the analyst clicks "Save Query", **Then** a
   dialog appears asking for a name and optional description, and the configuration is
   stored with a unique ID.
2. **Given** a workspace with one or more saved queries, **When** the analyst opens the
   "Saved Queries" view, **Then** all queries are listed with name, description,
   creation date, and last-executed date.
3. **Given** a saved query listed in the library, **When** the analyst clicks "Load",
   **Then** the query builder is populated with all prior settings (base table, columns,
   filters, joins, aggregations, GROUP BY).
4. **Given** a saved query, **When** the analyst clicks "Duplicate", **Then** a copy is
   created with the name "{original name} - Copy", and the analyst is placed in the
   builder to make modifications.
5. **Given** a saved query whose configuration refers to a table or column that no
   longer exists, **When** the query is loaded, **Then** a warning is shown and the
   analyst is prompted to update the configuration.

---

### Edge Cases

- **Filter with special characters or SQL injection attempts**: All filter values must be
  parameterized to prevent injection; raw user input is never concatenated into SQL.
- **Empty result set**: Query executes successfully but returns 0 rows; UI should show
  "No results" clearly, not an error.
- **Null aggregations**: If a SUM or AVG is computed on a column with all nulls, the
  result is NULL; UI must display this clearly and not confuse with an error.
- **Circular or redundant joins**: Two paths through relationships could join the same
  table twice; query builder must detect and reject or prompt for clarification.
- **Concurrent execution**: Multiple analysts run large queries; backend must handle
  queue or rejection with clear messaging about resource limits.
- **Export of result set with 1M+ rows**: Export must not crash browser or backend;
  streaming or chunked export strategies must be used.
- **Very wide result sets (500+ columns)**: Browser display and Excel export must handle
  gracefully; horizontal scrolling and column filtering may be necessary.
- **Relationship rule changes mid-query**: If a relationship is unapproved or deleted
  after query is built but before execution, execution must fail clearly.
- **Timeout edge case**: Query is just under 5 seconds; if system load increases,
  timeout may trigger unpredictably; analyst needs clear messaging that query is at
  risk of timeout.
- **Result set with identical column names from different tables**: Ambiguity must be
  resolved by aliasing or prefixing column names in results.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a query builder UI with base-table selector, column
  picker, filter builder, aggregation selector, GROUP BY configuration, and SQL preview.
- **FR-002**: System MUST support comparison operators in filters: `=`, `!=`, `<`, `>`,
  `<=`, `>=`, `IN`, `LIKE`, `IS NULL`, `IS NOT NULL`.
- **FR-003**: System MUST support aggregation functions: `SUM`, `COUNT`, `AVG`, `MAX`,
  `MIN`.
- **FR-004**: System MUST validate that GROUP BY columns are non-aggregated and exist
  in the base table or joined tables.
- **FR-005**: System MUST allow joins only via approved relationship rules from spec 002;
  unapproved or deleted relationships MUST be rejected with clear messaging.
- **FR-006**: System MUST generate valid DuckDB SQL from query builder selections.
- **FR-007**: System MUST execute queries with a timeout target of 5 seconds; queries
  exceeding this MUST be cancelled and the analyst notified.
- **FR-008**: System MUST support preview mode (LIMIT 100) that completes within 5
  seconds or times out with messaging.
- **FR-009**: System MUST support result set pagination or streaming for result sets
  exceeding 100k rows without browser/backend degradation.
- **FR-010**: System MUST parameterize all filter values to prevent SQL injection.
- **FR-011**: System MUST support export to Excel (.xlsx) and CSV (.csv) formats,
  including all result rows.
- **FR-012**: Excel exports MUST include a "Lineage" worksheet containing: source tables,
  relationship rules used (rule ID, type, approval status), filters, aggregations, GROUP
  BY columns, and execution timestamp.
- **FR-013**: System MUST handle null values consistently in results and exports (null
  in CSV as empty, null in Excel with clear formatting).
- **FR-014**: System MUST handle empty result sets (0 rows) without error; UI MUST show
  "No results" messaging.
- **FR-015**: System MUST validate query configuration continuously and surface errors
  (missing columns, unapproved relationships, circular joins, etc.) without attempting
  execution.
- **FR-016**: System MUST provide clear, user-friendly error messages for execution
  failures (not raw stack traces).
- **FR-017**: System MUST save query configurations with name and description,
  persisting to metadata store (SQLite).
- **FR-018**: System MUST allow loading, duplicating, and deleting saved queries.
- **FR-019**: System MUST handle schema changes gracefully; queries referring to
  deleted/renamed tables or columns MUST fail with clear guidance to rebuild query.
- **FR-020**: System MUST log all query executions with query ID, configuration, actor,
  timestamp, result row count, execution time, and outcome (success/timeout/error).

### API Endpoints

#### Query Builder Backend API

- **POST /api/queries/validate**
  - Input: `{ baseTable, columns, filters, joins, aggregations, groupBy }`
  - Output: `{ valid: bool, errors: [], warnings: [] }`
  - Validates query configuration without execution.

- **POST /api/queries/preview**
  - Input: `{ baseTable, columns, filters, joins, aggregations, groupBy }`
  - Output: `{ rows: [...], totalEstimated: int, sql: string, executionMs: int }`
  - Executes query with LIMIT 100, times out at 5 seconds, returns preview metadata.

- **POST /api/queries/execute**
  - Input: `{ baseTable, columns, filters, joins, aggregations, groupBy }`
  - Output: `{ queryId, rows: [...], totalCount: int, sql: string, executionMs: int,
lineage: { tables, rules, filters, aggregations, groupBy } }`
  - Executes full query, streams/chunks if result set is large, supports pagination.

- **GET /api/queries/{queryId}**
  - Output: `{ queryId, configuration, results, status, executionTime, lineage }`
  - Retrieves previously executed query and results.

- **POST /api/queries/save**
  - Input: `{ configuration: {...}, name, description }`
  - Output: `{ queryId, savedAt, configuration }`
  - Saves a query configuration to the metadata store.

- **GET /api/queries**
  - Output: `{ queries: [{ queryId, name, description, createdAt, lastExecutedAt,
configuration: {...} }] }`
  - Lists all saved queries in the workspace.

- **GET /api/queries/{queryId}/download?format=excel|csv**
  - Output: Binary file (Excel or CSV).
  - Downloads query results in the specified format with lineage metadata.

- **DELETE /api/queries/{queryId}**
  - Output: `{ deleted: bool }`
  - Deletes a saved query configuration.

#### Query Metadata & Schema API

- **GET /api/tables**
  - Output: `{ tables: [{ name, schema: { columns: [{ name, type }] }, rowCount: int,
approvedRelationships: [...] }] }`
  - Lists all available tables with schema and approved relationships for join options.

- **GET /api/relationships/approved**
  - Output: `{ relationships: [{ ruleId, sourceTable, sourceColumn, targetTable,
targetColumn, type, joinType, overlap, cardinality }] }`
  - Lists all approved relationship rules available for join builder (from spec 002).

### Data Model Changes

#### Query Configurations (SQLite metadata store)

```sql
CREATE TABLE query_configurations (
  query_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  configuration JSON NOT NULL,  -- { baseTable, columns, filters, joins, aggregations, groupBy }
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
);
```

#### Query Execution History (SQLite metadata store)

```sql
CREATE TABLE query_executions (
  execution_id TEXT PRIMARY KEY,
  query_id TEXT,
  workspace_id TEXT NOT NULL,
  configuration JSON NOT NULL,  -- snapshot of configuration at execution time
  generated_sql TEXT NOT NULL,
  executed_by TEXT NOT NULL,
  executed_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL,  -- 'success', 'timeout', 'error'
  error_message TEXT,
  result_row_count INT,
  execution_ms INT,
  lineage JSON NOT NULL,  -- { tables, rules, filters, aggregations, groupBy, ruleStatuses }
  FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id),
  FOREIGN KEY (query_id) REFERENCES query_configurations(query_id)
);
```

#### Result Materialization (DuckDB / temporary storage)

- Large result sets (>100k rows) are materialized to DuckDB or a temporary table for
  pagination, export, and download.
- Results are keyed by `execution_id` and purged after 24 hours or workspace cleanup.

### Key Entities

- **Query Configuration**: { baseTable, columns[], filters[], joins[], aggregations[],
  groupBy[] }, saved with name, creator, timestamp.
- **Filter**: { column, operator, value(s) }, validated against column type and
  operator compatibility.
- **Join**: { relationshipRuleId, sourceTable, targetTable }, referencing only approved
  relationships from spec 002.
- **Aggregation**: { column, functions: [SUM|COUNT|AVG|MAX|MIN] }, applied only to
  numeric columns.
- **Execution Lineage**: { tables[], relationships[], filters, aggregations, groupBy,
  relationship approval statuses, execution time, timestamp }, included in exports.

## Success Criteria _(mandatory for this project)_

- **SC-001 (Query Building)**: Analyst can build a multi-table query with filters and
  aggregations using the UI in < 2 minutes without writing SQL.
- **SC-002 (Safe Joins)**: Joins work only with approved relationships; unapproved
  relationships are rejected with clear messaging.
- **SC-003 (Preview Speed)**: Preview (LIMIT 100) completes in < 5 seconds or times out
  with user messaging.
- **SC-004 (Execution Performance)**: Full query on 100k+ row dataset completes in < 5
  seconds or times out with user messaging; no crashes.
- **SC-005 (Export Completeness)**: Exported Excel/CSV includes all result rows, correct
  data types, and full lineage metadata.
- **SC-006 (Error Messaging)**: All error messages are user-friendly and actionable
  (e.g., "Column 'revenue' not found in table 'transactions'; available columns: [list]").
- **SC-007 (Validation Early)**: Query validation surfaces errors before execution,
  reducing wasted compute on invalid configurations.
- **SC-008 (Query Reuse)**: Analyst can save and reload saved queries, reproducing
  configuration and results consistently.
- **SC-009 (Traceability)**: Every exported result is traceable to source tables,
  relationship rules, filters, and execution timestamp.
- **SC-010 (Reproducibility)**: Query execution can be reproduced from saved
  configuration + current data state; lineage allows forensic analysis of past executions.

## Acceptance Criteria

### AC-001: Query Builder UI Components

- [ ] Base table selector displays all available tables in workspace.
- [ ] Column picker shows all columns from selected table with data types.
- [ ] Filter builder supports all required operators (=, !=, <, >, <=, >=, IN, LIKE, IS
      NULL, IS NOT NULL).
- [ ] Aggregation selector shows SUM, COUNT, AVG, MAX, MIN for numeric columns.
- [ ] GROUP BY selector available and validated against non-aggregated columns.
- [ ] SQL preview panel displays generated DuckDB SQL (read-only).
- [ ] Join panel shows approved relationships and allows selection.

### AC-002: SQL Translation

- [ ] Query builder selections translate to valid DuckDB SQL.
- [ ] Joins are correctly ordered and nested; ambiguities are resolved.
- [ ] Filter values are parameterized (no string concatenation).
- [ ] Aggregations and GROUP BY clauses are syntactically correct.
- [ ] SQL preview is human-readable and matches generated SQL on execution.

### AC-003: Query Execution

- [ ] Execute button triggers full query on DuckDB.
- [ ] Query completes within 5 seconds or times out with user messaging.
- [ ] Result row count is accurate.
- [ ] Null values are handled consistently.
- [ ] Empty result sets show "No results" messaging, not an error.
- [ ] Backend query queue prevents resource exhaustion; excess queries are rejected.

### AC-004: Preview Mode

- [ ] Preview executes query with LIMIT 100.
- [ ] Preview completes within 5 seconds or times out.
- [ ] UI shows "Showing X of Y rows" or "Showing all X rows".
- [ ] Preview invalidates when query configuration changes.
- [ ] Preview metadata (column names, types) is displayed.

### AC-005: Export

- [ ] Excel export creates valid .xlsx file with "Results" worksheet.
- [ ] Excel export includes "Lineage" worksheet with: tables, rules, filters,
      aggregations, GROUP BY, execution timestamp.
- [ ] CSV export creates valid .csv file with all rows.
- [ ] Special characters and nulls are properly handled in both formats.
- [ ] Large exports (1M+ rows) complete without browser/backend hang.

### AC-006: Relationship Integration

- [ ] Query builder displays only approved relationships in join selector.
- [ ] Unapproved relationships are excluded; deletion is caught with messaging.
- [ ] Join clauses reference relationship rule ID for lineage.
- [ ] Lineage export includes relationship rule status at execution time.

### AC-007: Error Handling & Validation

- [ ] Validation error for missing filter column; error is surfaced in UI.
- [ ] Validation error for unapproved relationship; error is surfaced with
      relationship name and current status.
- [ ] Execution error (e.g., SQL syntax) is caught and shown as user-friendly message.
- [ ] Timeout error is shown with suggestion to refine query.
- [ ] No raw stack traces are shown to analysts.

### AC-008: Query Persistence

- [ ] Save query with name and description; configuration is stored.
- [ ] Load saved query; all settings (base table, columns, filters, joins,
      aggregations, GROUP BY) are restored.
- [ ] Delete saved query; configuration is removed; execution history is retained.
- [ ] Duplicate saved query; new query is created with "{name} - Copy".

### AC-009: Audit & Lineage

- [ ] Every query execution is logged with: queryId, configuration, actor, timestamp,
      result row count, execution time, outcome.
- [ ] Lineage is stored with execution record and included in exports.
- [ ] Lineage includes tables, relationship rules, filters, aggregations, GROUP BY,
      relationship approval statuses.

### AC-010: Scale & Performance

- [ ] System handles 100k+ row result sets without memory issues.
- [ ] Execution times are < 5 seconds for typical business queries on 1M+ row datasets.
- [ ] Export of 1M+ row result set completes and downloads without hang.

## Dependencies & Integration Points

### Hard Dependencies

- **Spec 001 (Upload + Profile + Field Roles)**: Query builder depends on uploaded
  tables, schema metadata, and field-role assignments to populate table/column selectors.
- **Spec 002 (Relationship Rules)**: Query builder depends on approved relationship
  rules to populate join options and validate joins at execution time.

### Related Features

- **Spec 004 (Saved Queries)**: Query persistence and configuration reuse (partially
  scoped here in User Story 7).
- **Spec 005 (Dashboard Visualizations)**: Saved queries from spec 003 feed chart
  selection in spec 005.

## Constraints

- **Only approved relationships**: Joins MUST use only approved relationship rules from
  spec 002. Unapproved, rejected, or deleted relationships MUST be rejected.
- **Query execution timeout**: Target < 5 seconds; queries exceeding this MUST be
  cancelled. Backend MUST enforce this hard limit.
- **Preview result limit**: Preview MUST use LIMIT 100 to prevent runaway preview
  queries.
- **Parameter binding**: All filter values MUST be parameterized to DuckDB to prevent
  SQL injection.
- **Result set scale**: System MUST support result sets up to 1M+ rows; materialization,
  pagination, and streaming strategies MUST be used to prevent memory exhaustion.
- **Export file formats**: Support ONLY Excel (.xlsx) and CSV (.csv); other formats are
  out of scope.
- **Schema stability**: Query builder MUST gracefully handle table/column deletion or
  renaming; queries referencing deleted entities MUST fail clearly.
- **Single workspace scope**: Each query is scoped to a single workspace; cross-workspace
  queries are out of scope.

## Assumptions

- Approved relationship rules from spec 002 are available and stable for the duration of
  query building and execution.
- DuckDB is capable of executing all supported query patterns within the 5-second target
  on typical business datasets (100k-1M rows).
- Filter values provided by analysts are well-formed; invalid dates or malformed
  numbers are rejected with messaging, not silently coerced.
- Relationship cardinality information from spec 002 is accurate and used for query
  planning hints (optional optimization, not required for correctness).
- Export sizes are bounded by available disk space on the backend; 1M+ row exports are
  feasible but may require temporary cleanup.
- Analysts have sufficient permissions to view all tables and columns in the workspace;
  fine-grained column-level access control is out of scope for MVP 1.

## Out of Scope

- Natural language to SQL translation (deferred to Phase 3 in MVP plan).
- Caching or materialized view management.
- Query optimization hints or statistics collection.
- Parameterized query templates or query variables (deferred to future).
- Fine-grained access control (column-level masking).
- Collaborative query editing or version control.
- Query scheduling or automation (deferred to Phase 5 in MVP plan).
- Advanced window functions or recursive CTEs beyond standard aggregation.
- Cross-workspace or multi-datasource joins.

## Relationship to MVP 1 Timeline

This feature is the **core execution engine** of MVP 1 (spec 003 of 3 core features).
Timeline is **Week 3, Days 15–21** of the MVP plan (after backend foundation in Week 1
and frontend builder bootstrap in Week 2):

- **Days 15–17**: Query builder UI implementation (base table, columns, filters, group by,
  aggregations, SQL preview).
- **Days 18–19**: Execute button, download Excel/CSV, progress indicator.
- **Days 20–21**: Integration test with real data, bug fixes, README documentation, demo
  recording.

**Readiness gate for spec 003 start**: Specs 001 and 002 MUST be implemented and tested.
Metadata schema, profile data, and relationship rules MUST be available via backend API.

---

## Traceability

- Constitution Principles I, III, VI, VII.
- MVP 1 Plan: Core Engine, Query Builder Feature.
- Specs 001, 002 (dependencies).
- Frontend: React Query Builder Component + Results Table + Export Dialog.
- Backend: FastAPI Query Endpoints + DuckDB Executor + SQLite Query Metadata + SQL
  Translator.
- Data Layer: DuckDB (execution), SQLite (query configs and execution history).
