# Research: Query Builder & Execution (Spec 003)

**Date**: 2026-05-08 | **Spec**: `/specs/003-query-builder-execution/spec.md` | **Branch**: `003-query-builder-execution`

## Unknowns Resolved

### U1: SQL Generation Strategy — DuckDB Dialect & Parameterization

**Decision**: Use DuckDB SQL dialect with parameterized filters (prepared statements).

**Rationale**:

- DuckDB is already the workspace data engine (spec 001), so no new dependency.
- Parameterized queries prevent SQL injection; all user filter values bound as parameters, never concatenated into SQL strings.
- DuckDB supports `LIMIT`, `OFFSET`, aggregations, and window functions natively.
- DuckDB's `CAST` and `TRY_CAST` enable safe type conversions for filter matching.

**Implementation**:

- QueryBuilder generates SQL templates with `?` placeholders (DuckDB parameter syntax).
- QueryExecutor binds filter values as parameters before execution.
- Example: `SELECT ... WHERE amount > ? AND status = ?` with params `[1000, 'active']`.

**Alternatives Considered**:

- Raw string concatenation with manual escaping: Error-prone, doesn't prevent all injection vectors. Rejected.
- ORM-based query construction (e.g., SQLAlchemy): Adds dependency, DuckDB integration immature. Rejected.

---

### U2: Timeout Policy & Resource Estimation

**Decision**: Hard 5-second timeout per query (preview and execution); estimate memory before execution; reject if estimated result set exceeds 1GB.

**Rationale**:

- Spec 003 business question requires "under 5 seconds" — hard timeout ensures predictability.
- Preview (LIMIT 100) typically completes sub-second on profiled data; 5-second timeout is conservative safety margin.
- Full query execution may take longer on large datasets; 5 seconds is MVP target, can be revisited after performance profiling.
- Memory estimation prevents OOM crashes: estimate result set size from row count (profile stats) and column widths (schema), reject if exceeds 1GB threshold.

**Implementation**:

- CardinalityEstimator queries column_profiles table for uniqueness_ratio and sampled value distributions.
- For each GROUP BY dimension, cardinality = (table_row_count × uniqueness_ratio).
- For each aggregation, estimate 8 bytes (assume INT64 or FLOAT64).
- Total memory = (estimated_result_rows × avg_column_width_bytes) + overhead.
- If memory_estimate > 1GB, return 413 Payload Too Large before executing.
- QueryExecutor uses `signal.alarm()` (Linux) or `threading.Timer()` (cross-platform) to enforce hard timeout; on timeout, cancel DuckDB connection and raise TimeoutError.

**Alternatives Considered**:

- Streaming results to browser (lazy loading): Complicates export (must materialize all rows for Excel/CSV); adds pagination complexity. Kept for future optimization, not MVP 1.
- Soft timeout with graceful partial results: Breaks reproducibility (different runs return different row counts). Rejected.
- No memory estimation: Risk of OOM crashes. Rejected.

---

### U3: Lineage Metadata Structure & Immutability

**Decision**: Capture lineage at execution time; immutably store in export; include source tables, relationship rules (IDs + approval status), filters, aggregations, GROUP BY, execution timestamp, and query config hash.

**Rationale**:

- Constitution Principle VI (Traceability): Every export must be traceable back to inputs, rules, and filters.
- Immutability ensures audits remain valid (edits to rules after execution do not retroactively change export metadata).
- Query config hash enables reproducibility detection (if config or rule versions change, hash mismatch is detected).

**Implementation**:

- ResultsLineage class captures at execution time:

  ```python
  {
    "source_tables": [{"table_id": "t1", "table_name": "sales", "row_count": 50000}],
    "relationship_rules": [
      {
        "rule_id": "r1",
        "rule_name": "sales_to_customers",
        "rule_type": "exact_key",
        "approval_status": "approved",
        "approval_date": "2026-05-01T10:00:00Z"
      }
    ],
    "filters": [
      {"column": "amount", "operator": ">", "value": "1000"}
    ],
    "aggregations": [
      {"column": "amount", "function": "SUM", "alias": "total_amount"}
    ],
    "group_by": ["region"],
    "query_config_hash": "sha256:abc123...",
    "execution_timestamp": "2026-05-08T14:30:00Z",
    "execution_time_ms": 234
  }
  ```

- Excel export: Main sheet "Results" contains query results; second sheet "Lineage" contains JSON metadata pretty-printed.
- CSV export: Lineage appended as comment header rows (# prefix).
- Lineage stored in `query_execution_log` table; accessible for audit and reproducibility checks.

**Alternatives Considered**:

- Store only rule IDs, resolve to current rule state at export time: Breaks reproducibility if rule is later edited. Rejected.
- Include full rule definitions (join conditions, etc.): Redundant with rule ID; full definitions accessible via rule lookup. Rejected.

---

### U4: JOIN Order Safety & Circular Dependency Detection

**Decision**: Validate join order before SQL generation; detect circular references (e.g., A→B→C→A); enforce single-hop or acyclic multi-hop joins.

**Rationale**:

- Circular joins are invalid SQL (no clear join order).
- MVP 1 scope: single-user, simple workflows; support single-hop joins (base table + one related table) as primary case; multi-hop joins (base table + chain of 2+ tables) supported only if acyclic and explicitly validated.
- Relationship rules from spec 002 are named and directional; JoinValidator uses relationship IDs to build a DAG and check for cycles.

**Implementation**:

- JoinValidator.validate_joins(base_table_id, joins):
  - Build directed graph of tables and relationship rules.
  - Detect cycles via DFS; raise ValueError if found.
  - Validate join order (base table is root; all other tables reachable from base via approved relationships).
  - Return topologically sorted join order for SQL generation.
- QueryBuilder.generate_sql() applies join order when constructing FROM/JOIN clauses.

**Alternatives Considered**:

- Allow any join configuration, let DuckDB error: User-unfriendly (raw SQL error); late feedback. Rejected.
- Restrict to single-hop joins only: Limits analytical power; multi-hop joins are common (sales→customers→regions). Rejected.

---

### U5: Cardinality & Memory Estimation Before Execution

**Decision**: Estimate result set row count from table row counts and relationship cardinalities; estimate column widths from schema and sampled values; reject if memory estimate exceeds 1GB.

**Rationale**:

- Prevents OOM crashes and browser hangs.
- Uses existing column_profiles data (spec 001) for uniqueness ratios.
- Conservative estimation (assume worst-case column widths) to avoid under-estimation.

**Implementation**:

- CardinalityEstimator.estimate(query_config):
  - Start with base table row count (from table metadata).
  - For each join, apply relationship cardinality (from spec 002 relationship_rules.cardinality field).
  - For each GROUP BY, divide by product of uniqueness ratios of GROUP BY columns.
  - Example: 100k rows × uniqueness(region=0.1) → 10k result rows.
  - For each column in result set, estimate width:
    - Numeric: 8 bytes (INT64/FLOAT64).
    - String: sample 100 values from column_profiles, compute mean length + 4 bytes overhead.
    - Date/Timestamp: 8 bytes.
  - memory_estimate = (estimated_result_rows × avg_column_width) + (overhead = 10%).
  - If estimate > 1GB, raise MemoryError.

**Alternatives Considered**:

- No estimation, execute and handle OOM: Risk of crash. Rejected.
- Conservative fixed limit (e.g., max 100k rows): Overly restrictive for large datasets. Rejected.

---

### U6: Approved-Only Joins — Enforcement Point

**Decision**: Validate relationship rule approval status at both query build time (UI validation endpoint) and execution time (backend enforce).

**Rationale**:

- Catch errors early for UX: Feedback at build time helps analyst fix joins immediately.
- Enforce at execution time to guard against rule unapproval between build and execution (e.g., analyst builds query with rule X approved, then rule X is unapproved by another user, query execution should reject with clear messaging).
- Constitution Principle III (Relationship-Rule-Only): Only approved rules are used in decision paths; rejection is non-negotiable.

**Implementation**:

- QueryBuilder.validate_joins() checks relationship_rules table for status='approved' before adding join to config.
- QueryValidator.validate_at_execution() re-checks approval status immediately before executing; if rule is no longer approved, return 409 Conflict with message "Relationship rule {rule_name} is no longer approved; please rebuild query with current approved rules."
- Builder UI shows relationship rule status (approved/suggested/rejected) and disables selecting unapproved rules.

**Alternatives Considered**:

- Validate only at build time: Risk of silently using unapproved rule if it's unapproved between build and execution. Rejected.
- Validate only at execution time: UX friction (analyst builds query, then gets rejection at execution). Rejected.

---

### U7: SQL Injection Prevention — Parameterization Scope

**Decision**: Parameterize all user-supplied filter values; never concatenate strings into SQL. Column names and operators are app-controlled (whitelist) or derive from schema metadata (safe).

**Rationale**:

- Filter values are the only user-supplied inputs to SQL; parameterization is standard defense.
- Column names come from schema (uploaded data), pre-validated by spec 001.
- Operators come from predefined enum (=, !=, <, >, <=, >=, IN, LIKE, IS NULL, IS NOT NULL).
- Aggregation functions come from predefined enum (SUM, COUNT, AVG, MAX, MIN).

**Implementation**:

- QueryBuilder.generate_sql() produces template with `?` placeholders for filter values.
- QueryBuilder.get_parameters() returns list of filter values in order matching placeholders.
- QueryExecutor.execute() passes (template, parameters) tuple to DuckDB API (not raw string).
- Example: `SELECT ... WHERE name LIKE ?` with param `['%alice%']` is safe even if param is `'%' OR '1'='1'`.

**Alternatives Considered**:

- Quote and escape filter values: Prone to edge cases (e.g., embedded quotes, unicode). Rejected.

---

## Technology Choices

### Why DuckDB for Query Execution?

- Already integrated in spec 001 as workspace data engine.
- In-process; no separate database server needed for MVP.
- Supports SQL standard; parameterized queries; efficient filtering and aggregation.
- Fast on parquet files (columnar, vectorized execution).

### Why React Components + TanStack Query for UI?

- Consistent with existing builder (spec 001).
- TanStack Query handles caching and re-fetching of query results.
- React component composition supports modular builder panels.

### Why SQLite for Metadata (saved queries)?

- Already used for profile/relationship metadata (specs 001-002).
- ACID guarantees for saved query configurations.
- No separate migration needed.

---

## Open Questions (Deferred to Spec 004+)

1. **Metric Definition Layer**: Spec 004 (saved queries + metrics) will add metric contracts on top of query execution. This spec is query tool only; metrics are downstream.
2. **Concurrent Execution & Queuing**: MVP 1 assumes single-user; multi-user queuing and concurrency control deferred to spec 006+ (production deployment).
3. **Query Optimization & Hints**: DuckDB does internal optimization; user-supplied hints (indexes, join order directives) deferred to spec 006+.
4. **Streaming Export for Large Result Sets**: MVP 1 materializes results in memory; streaming export (chunked file writing) deferred to spec 004+.

---

## Summary Table

| Unknown                   | Decision                                | Justification                                   | Risk Mitigation                                                                             |
| ------------------------- | --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| SQL generation            | DuckDB + parameterized filters          | Standard, proven, prevents injection            | Contract tests for SQL syntax                                                               |
| Timeout                   | Hard 5 seconds; cancel on breach        | Spec requirement; predictable; safety           | Signal handling or thread timer; test with slow queries                                     |
| Memory estimation         | Pre-compute from profiles; reject >1GB  | Prevents OOM; uses existing profile data        | Conservative estimates (worst-case column widths); integration tests with large datasets    |
| Lineage immutability      | Capture at execution; store in export   | Auditability; reproducibility                   | Version lineage with query config hash; audit tests                                         |
| JOIN safety               | Acyclic DAG validation; cycle detection | Prevents invalid SQL; enables multi-hop         | DFS cycle check; integration tests with complex joins                                       |
| Cardinality estimation    | Profile-based; GROUP BY reduces rows    | Fast (no table scan); accurate for common cases | Integration tests comparing estimate vs. actual; fallback to conservative estimate on error |
| Approved-only enforcement | Validate at build and execution         | Early feedback + late safety                    | 409 response if rule unapproved; test relationship unapproval mid-query                     |
| SQL injection prevention  | Parameterized values only               | Standard practice; robust                       | No string concatenation; fuzz testing with injection patterns                               |
