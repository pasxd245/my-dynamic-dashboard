# Data Model: Query Builder & Execution (Spec 003)

**Date**: 2026-05-08 | **Spec**: `/specs/003-query-builder-execution/spec.md` | **Branch**: `003-query-builder-execution`

## Entities

### 1. Query Configuration (Logical DSL)

**Purpose**: Represent a user-defined query in structured, executable form.

```python
class QueryConfig:
    query_id: str  # UUID, unique identifier for saved queries
    workspace_id: str  # FK to workspace (spec 001)
    name: str  # User-provided name for saved queries (optional for transient queries)
    description: str  # User-provided description
    base_table_id: str  # FK to table in workspace

    # Column selection
    selected_columns: List[SelectedColumn]
    # SelectedColumn = {
    #   table_id: str,
    #   column_name: str,
    #   alias: str  # Optional; if empty, use column_name
    # }

    # Filters
    filters: List[FilterSpec]
    # FilterSpec = {
    #   column_id: str,  # FK to column_profiles (spec 001)
    #   operator: str,  # Enum: =, !=, <, >, <=, >=, IN, LIKE, IS NULL, IS NOT NULL
    #   value: Any,  # Parameterized (never raw string in SQL)
    #   is_advanced: bool  # If true, user specified custom SQL (deferred; use False for MVP 1)
    # }

    # Aggregations
    aggregations: List[AggregationSpec]
    # AggregationSpec = {
    #   column_id: str,
    #   function: str,  # Enum: SUM, COUNT, AVG, MAX, MIN
    #   alias: str  # User-provided name for aggregated column in results
    # }

    # GROUP BY
    group_by_columns: List[str]  # Column names from base or joined tables

    # Joins
    joins: List[JoinSpec]
    # JoinSpec = {
    #   relationship_rule_id: str,  # FK to relationship_rules (spec 002)
    #   join_type: str,  # Enum: INNER, LEFT, RIGHT, FULL
    #   joined_table_id: str  # Derived from relationship rule
    # }

    # Execution configuration
    execution_timeout_seconds: int  # Default 5; immutable for MVP 1
    result_limit: Optional[int]  # None = no limit; for LIMIT clause in SQL

    # Metadata
    created_at: datetime
    updated_at: datetime
    created_by: str  # User ID (optional; single-user MVP 1)
    config_hash: str  # SHA256 of canonical query_config JSON (for reproducibility tracking)
    is_saved: bool  # True if stored in saved_queries table; False for transient queries


class SelectedColumn:
    table_id: str
    column_name: str
    alias: Optional[str]


class FilterSpec:
    column_id: str
    operator: str  # Whitelist: =, !=, <, >, <=, >=, IN, LIKE, IS NULL, IS NOT NULL
    value: Any  # Parameterized value; may be list for IN operator
    is_advanced: bool  # False for MVP 1


class AggregationSpec:
    column_id: str
    function: str  # Whitelist: SUM, COUNT, AVG, MAX, MIN
    alias: str


class JoinSpec:
    relationship_rule_id: str
    join_type: str  # INNER, LEFT, RIGHT, FULL; whitelist
    joined_table_id: str


# Canonical JSON representation for config_hash:
# {
#   "base_table_id": "t1",
#   "selected_columns": [
#     {"table_id": "t1", "column_name": "id", "alias": null},
#     {"table_id": "t1", "column_name": "amount", "alias": "total_amount"}
#   ],
#   "filters": [
#     {"column_id": "c1", "operator": ">", "value": 1000}
#   ],
#   "aggregations": [
#     {"column_id": "c3", "function": "SUM", "alias": "total"}
#   ],
#   "group_by_columns": ["region"],
#   "joins": [
#     {"relationship_rule_id": "r1", "join_type": "INNER"}
#   ]
# }
```

---

### 2. Execution State

**Purpose**: Track query execution progress, results, and metadata.

```python
class ExecutionState:
    execution_id: str  # UUID
    query_id: Optional[str]  # FK to saved_query if query is saved; None for transient queries
    workspace_id: str  # FK to workspace

    # Execution tracking
    state: str  # Enum: QUEUED, RUNNING, COMPLETED, TIMEOUT, FAILED
    started_at: datetime
    completed_at: Optional[datetime]
    execution_time_ms: int  # Duration from start to completion

    # Results
    result_rows: int  # Number of rows in result set (0 if failed)
    result_columns: List[str]  # Column names in result set
    is_preview: bool  # True if LIMIT 100; False if full execution

    # Error handling
    error_message: Optional[str]  # User-friendly error description (no stack traces)
    error_code: Optional[str]  # Machine-readable code: TIMEOUT, SQL_ERROR, MEMORY_ERROR, etc.

    # Lineage & reproducibility
    lineage: LineageMetadata
    query_config_snapshot: QueryConfig  # Immutable copy of query config at execution time


class LineageMetadata:
    source_tables: List[SourceTableMetadata]
    relationship_rules_used: List[RelationshipRuleMetadata]
    filters_applied: List[FilterMetadata]
    aggregations_applied: List[AggregationMetadata]
    group_by_columns: List[str]
    query_config_hash: str  # SHA256 of query config at execution time
    execution_timestamp: datetime
    execution_time_ms: int


class SourceTableMetadata:
    table_id: str
    table_name: str
    row_count_at_execution: int


class RelationshipRuleMetadata:
    rule_id: str
    rule_name: str
    rule_type: str
    approval_status: str  # "approved", "suggested", "reviewed", "rejected"
    approval_date: Optional[datetime]


class FilterMetadata:
    column_name: str
    column_type: str  # Data type from schema
    operator: str
    value_summary: str  # Human-readable representation (e.g., "1000" not parameter placeholder)


class AggregationMetadata:
    column_name: str
    function: str
    alias: str
```

---

### 3. Saved Query Persistence

**Purpose**: Store user-named queries in SQLite for reuse and history.

**Table**: `saved_queries`

```sql
CREATE TABLE saved_queries (
    query_id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    query_config JSON NOT NULL,  -- Canonical JSON per QueryConfig
    config_hash TEXT NOT NULL,   -- SHA256 of query_config
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_executed_at TIMESTAMP,
    created_by TEXT,  -- Optional; single-user MVP 1
    FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id)
);

CREATE INDEX idx_saved_queries_workspace ON saved_queries(workspace_id);
CREATE INDEX idx_saved_queries_created_at ON saved_queries(created_at DESC);
```

**Fields**:

- `query_id`: UUID; globally unique.
- `workspace_id`: Foreign key to workspace (spec 001).
- `name`: User-facing query name (e.g., "Sales by Region Q1 2026").
- `description`: Optional longer description.
- `query_config`: JSON serialized QueryConfig object.
- `config_hash`: SHA256 of query_config for reproducibility tracking.
- `created_at`, `updated_at`: Timestamps.
- `last_executed_at`: Last execution date; used for recent queries UI sorting.
- `created_by`: User ID (optional for single-user MVP 1).

**Validation Rules**:

- `name` is required and non-empty.
- `query_config` must parse as valid JSON and conform to QueryConfig schema.
- `config_hash` is computed at save time; immutable thereafter (used for reproducibility detection).

---

### 4. Execution Log

**Purpose**: Audit and troubleshoot query executions.

**Table**: `query_execution_log`

```sql
CREATE TABLE query_execution_log (
    execution_id TEXT PRIMARY KEY,
    query_id TEXT,  -- FK to saved_queries; NULL for transient queries
    workspace_id TEXT NOT NULL,
    state TEXT NOT NULL,  -- QUEUED, RUNNING, COMPLETED, TIMEOUT, FAILED
    result_row_count INT,
    result_column_count INT,
    execution_time_ms INT,
    is_preview BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    error_code TEXT,
    lineage_metadata JSON NOT NULL,  -- Serialized LineageMetadata
    query_config_snapshot JSON NOT NULL,  -- Immutable copy of query config
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(workspace_id),
    FOREIGN KEY (query_id) REFERENCES saved_queries(query_id)
);

CREATE INDEX idx_execution_log_workspace ON query_execution_log(workspace_id);
CREATE INDEX idx_execution_log_query ON query_execution_log(query_id);
CREATE INDEX idx_execution_log_executed_at ON query_execution_log(executed_at DESC);
```

**Fields**:

- `execution_id`: UUID; uniquely identifies this execution.
- `query_id`: Foreign key to saved_queries; NULL if query is transient (not saved).
- `workspace_id`: Foreign key to workspace.
- `state`: Execution state (QUEUED, RUNNING, COMPLETED, TIMEOUT, FAILED).
- `result_row_count`, `result_column_count`: Result set dimensions.
- `execution_time_ms`: Duration in milliseconds.
- `is_preview`: True for LIMIT 100 preview; False for full execution.
- `error_message`: User-friendly error description (no stack traces).
- `error_code`: Machine-readable code for client handling (TIMEOUT, SQL_ERROR, MEMORY_ERROR).
- `lineage_metadata`: JSON serialized LineageMetadata object.
- `query_config_snapshot`: JSON copy of query config at execution time (immutable for audit).
- `executed_at`: Timestamp when execution began.

**Validation Rules**:

- `lineage_metadata` and `query_config_snapshot` are immutable after insert.
- `executed_at` is server-set, not client-provided.

---

## Relationships

```
Workspace (spec 001)
  ├── has many SavedQueries
  └── has many ExecutionLogs

SavedQuery
  ├── references Tables (via base_table_id in query_config)
  ├── references Relationships (via joins in query_config)
  ├── references Columns (via selected_columns, filters, aggregations, group_by_columns)
  └── has many ExecutionLogs

ExecutionLog
  └── records immutable snapshot of QueryConfig + LineageMetadata at execution time

RelationshipRules (spec 002)
  └── referenced by query joins (relationship_rule_id in JoinSpec)
```

---

## Validation Rules

### Query Configuration Validation

1. **Base Table**: Must exist in workspace and have profiled columns (spec 001).
2. **Selected Columns**: Must exist in base table or joined tables.
3. **Filters**:
   - Column must exist in base or joined table.
   - Operator must be in whitelist: =, !=, <, >, <=, >=, IN, LIKE, IS NULL, IS NOT NULL.
   - Value must match column data type (e.g., numeric filter values for numeric columns).
   - All filter values must be parameterized (no string concatenation).
4. **Aggregations**:
   - Column must be numeric (or COUNT(\*) is allowed).
   - Function must be in whitelist: SUM, COUNT, AVG, MAX, MIN.
   - Alias must be non-empty.
5. **GROUP BY**:
   - Columns must exist in base or joined table.
   - All non-aggregated columns in SELECT must be in GROUP BY (SQL standard).
   - Columns must not be aggregated.
6. **Joins**:
   - Relationship rule must exist and have status "approved".
   - Joined tables must be reachable from base table via acyclic relationship chain.
   - Join type must be in whitelist: INNER, LEFT, RIGHT, FULL.
   - No circular references (A→B→A).
7. **Timeout**: Must be positive integer (default 5 seconds; immutable for MVP 1).

### Execution State Validation

1. **State Transitions**: QUEUED → RUNNING → COMPLETED (or TIMEOUT/FAILED).
2. **Result Row Count**: Must be non-negative; set to 0 on failure.
3. **Execution Time**: Must be positive milliseconds.
4. **Lineage**: Must include all source tables, relationships used, and filters applied.

### Saved Query Validation

1. **Name**: Non-empty, max 256 characters.
2. **Description**: Optional; max 1000 characters.
3. **Query Config**: Must be valid QueryConfig JSON and pass all validation rules above.
4. **Config Hash**: Immutable after creation; re-computed only if query_config is updated.

---

## State Transitions

### Query Execution Lifecycle

```
┌────────┐
│ QUEUED │ (query received, queued for execution)
└────────┘
    │
    ▼
┌────────┐
│RUNNING │ (execution in progress)
└────────┘
    │
    ├─────────────────┬─────────────────┐
    ▼                 ▼                 ▼
┌──────────┐    ┌─────────┐      ┌──────────┐
│COMPLETED │    │ TIMEOUT │      │ FAILED   │
└──────────┘    └─────────┘      └──────────┘
 (results        (5s limit      (SQL error,
  ready)         exceeded)       param error,
                                 etc.)
```

### Query Status Interpretation

- **COMPLETED**: Execution finished; results available (may be 0 rows). Lineage populated. No error_message.
- **TIMEOUT**: Execution exceeded 5-second limit; query cancelled. error_code = "TIMEOUT". Results empty.
- **FAILED**: SQL error, parameter error, memory estimation failure, or other error. error_code set (SQL_ERROR, MEMORY_ERROR, etc.). error_message contains user-friendly description.
- **QUEUED**: Not used for MVP 1 (single-user, synchronous execution); reserved for future concurrent execution model.
- **RUNNING**: Not exposed to client; internal state during execution.

---

## SQL Generation Examples

### Example 1: Single-Table Query with Filter

**QueryConfig**:

```json
{
  "base_table_id": "t1",
  "selected_columns": [
    { "table_id": "t1", "column_name": "date" },
    { "table_id": "t1", "column_name": "amount", "alias": "sale_amount" }
  ],
  "filters": [{ "column_id": "c1", "operator": ">", "value": 1000 }],
  "aggregations": [],
  "group_by_columns": [],
  "joins": []
}
```

**Generated SQL**:

```sql
SELECT
  "date",
  "amount" AS sale_amount
FROM table_t1
WHERE "amount" > ?
-- Parameters: [1000]
```

---

### Example 2: Query with Aggregation & GROUP BY

**QueryConfig**:

```json
{
  "base_table_id": "t1",
  "selected_columns": [{ "table_id": "t1", "column_name": "region" }],
  "filters": [],
  "aggregations": [{ "column_id": "c2", "function": "SUM", "alias": "total_sales" }],
  "group_by_columns": ["region"],
  "joins": []
}
```

**Generated SQL**:

```sql
SELECT
  "region",
  SUM("amount") AS total_sales
FROM table_t1
GROUP BY "region"
```

---

### Example 3: Multi-Table Query with Approved Relationship Join

**QueryConfig**:

```json
{
  "base_table_id": "t1",
  "selected_columns": [
    { "table_id": "t1", "column_name": "id" },
    { "table_id": "t2", "column_name": "customer_name" }
  ],
  "filters": [],
  "aggregations": [],
  "group_by_columns": [],
  "joins": [
    {
      "relationship_rule_id": "r1",
      "join_type": "INNER",
      "joined_table_id": "t2"
    }
  ]
}
```

**Generated SQL** (after JoinValidator confirms r1 is acyclic and approved):

```sql
SELECT
  t1."id",
  t2."customer_name"
FROM table_t1 AS t1
INNER JOIN table_t2 AS t2 ON t1."customer_id" = t2."id"
-- Relationship rule r1 provides join condition
```

---

## Traceability & Reproducibility

### Traceability (Principle VI)

Every export (Excel or CSV) includes:

1. **Main worksheet ("Results")**: Query results as rows/columns.
2. **Lineage worksheet ("Lineage" in Excel; comment header in CSV)**:
   - Source tables and row counts at execution.
   - Relationship rules used (IDs, names, approval status).
   - Filters applied (column, operator, value).
   - Aggregations (column, function).
   - GROUP BY columns.
   - Query config hash and execution timestamp.

### Reproducibility (Principle VII)

1. **Query Config Hash**: Deterministic SHA256 of canonical JSON query_config. Allows detection of query changes.
2. **Execution Snapshot**: `query_config_snapshot` and `lineage_metadata` immutable in `query_execution_log`. Future re-execution with same config produces comparable results (if data unchanged).
3. **Rule Versioning**: Relationship rule IDs and approval status captured; rule edits do not retroactively change past execution records.
4. **Result Reproducibility**: Re-executing same query on same data set (with same relationship rule versions) yields identical result set (assuming no data mutations).

---

## Notes

- **No Custom SQL in MVP 1**: QueryConfig.aggregations[].is_advanced and FilterSpec.is_advanced are always False; user cannot supply raw SQL. Custom SQL deferred to spec 004+.
- **Time Anchor Type**: Not applicable to spec 003 (query tool). Deferred to metric contracts (spec 005+).
- **Parameterization Library**: Use DuckDB's native parameter binding (`:param_name` or `?` syntax).
- **Memory Estimation**: Stored in QueryExecutor; not persisted in data model (computed at query time).
