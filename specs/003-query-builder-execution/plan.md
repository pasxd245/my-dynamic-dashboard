# Implementation Plan: Query Builder & Execution (Spec 003)

**Branch**: `003-query-builder-execution` | **Date**: 2026-05-08 | **Spec**: `/specs/003-query-builder-execution/spec.md`
**Input**: Feature specification from `/specs/003-query-builder-execution/spec.md`

## Summary

Implement a visual query builder with DuckDB SQL generation, safe preview (LIMIT 100 with 5-second timeout), full-query execution with timeout and memory safeguards, and Excel/CSV export with complete lineage metadata. The design adds query DSL models and executor service to the backend, exposes query-builder and query-execution REST endpoints, and delivers a React-based UI for column selection, filter/aggregation configuration, approved-relationship joins, and result visualization. The outcome enables analysts to perform governed, auditable analysis without writing SQL.

## Technical Context

**Language/Version**: Python 3.12 (backend), JavaScript ES2022 (React 18 + Vite builder)
**Primary Dependencies**: FastAPI, Pydantic, Polars, DuckDB, SQLite (`sqlite3`), openpyxl (Excel export), React 18, TanStack Query
**Storage**: SQLite metadata DB for saved queries; DuckDB for query execution against workspace data (parquet-backed)
**Testing**: `pytest` backend contract + integration suites; builder smoke via Vite build and manual flow checks
**Target Platform**: Linux local/dev container with browser-based builder UI
**Project Type**: Web application (backend API + frontend builder)
**Performance Goals**: SC-001 preview (LIMIT 100) under 5 seconds; SC-002 full execution under 5 seconds for filtered/aggregated result sets; SC-003 export to Excel/CSV under 10 seconds for result sets up to 1M rows
**Constraints**: Only approved relationships (spec 002) used in joins; no ad-hoc SQL; all filter values parameterized (SQL injection prevention); query timeouts are hard (cancellation, not graceful degradation); lineage metadata immutable in export; result set memory estimated before execution
**Scale/Scope**: Single-user workspace queries; result sets up to 1M rows with streaming export; concurrent execution with per-user queue (future); multi-table joins via spec 002 relationships only

## Constitution Check

Pre-design gate review (must pass):

1. **Business-Question-First (Principle I)**: PASS
   Feature answers the business question: "Can I visually query my data without SQL?"
2. **Metric Contract Gate (Principle II)**: PASS WITH DESIGN REQUIREMENT
   Feature is a query tool, not a metric definition layer. Metric contracts (spec 005 onwards) will consume queries and define metrics. This spec provides only query capability, not metrics.

3. **Relationship-Rule-Only Joins (Principle III)**: PASS WITH ENFORCEMENT
   Design enforces that only approved relationship rules from spec 002 are usable in joins. Unapproved rules are rejected at query build and execution time.

4. **Reconciliation Gate (Principle IV)**: PASS
   Feature is tool, not recommendation. Reconciliation is downstream (spec 005+).

5. **Challenge & Sensitivity Gate (Principle V)**: PASS
   Feature is exploration tool. Findings are "exploration only" surface role; challenge/sensitivity gating is downstream (spec 005+).

6. **Traceability (Principle VI)**: PASS WITH DESIGN REQUIREMENT
   Every export includes lineage: source tables, relationship rules (IDs + approval status), filters, aggregations, GROUP BY, execution timestamp. Query configuration stored with unique ID for retraceability.

7. **Reproducibility (Principle VII)**: PASS WITH DESIGN REQUIREMENT
   Saved query configurations are versioned and reproducible. Export includes manifest hashes and rule versions. Query re-execution against different data versions is auditable.

Post-design re-check: PASS

- `research.md` resolves SQL generation strategy, timeout policy, and lineage metadata structure.
- `data-model.md` defines query DSL, execution state, and lineage entities.
- API contract keeps approved-only semantics explicit; unapproved joins are HTTP 409.

## Project Structure

### Documentation (this feature)

```text
specs/003-query-builder-execution/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── spec.md
├── contracts/
│   └── query-builder-execution.openapi.yaml
└── tasks.md (generated via /speckit.tasks)
```

### Source Code (planned touch points)

```text
apps/backend/
├── app/
│   ├── main.py
│   ├── schemas.py
│   ├── core/
│   │   └── metadata_db.py
│   └── services/
│       ├── profile_service.py
│       ├── upload_service.py
│       ├── relationship_service.py
│       └── query_service.py                   # new
└── tests/
    ├── contract/
    │   └── test_query_builder_contract.py    # new
    └── integration/
        ├── test_query_builder_flows.py       # new
        └── test_query_execution_timeout.py   # new

apps/builder/
└── src/
    ├── App.tsx
    ├── components/
    │   ├── QueryBuilder.tsx                  # new
    │   ├── FilterPanel.tsx                   # new
    │   ├── AggregationPanel.tsx              # new
    │   ├── ResultsViewer.tsx                 # new
    │   └── SavedQueriesList.tsx              # new
    └── api/
        ├── workspaceApi.js
        └── queryApi.js                       # new
```

## Implementation Phases

### Phase 0: Research

- Complete `research.md` resolving:
  - SQL generation strategy (DuckDB dialect, parameterization, safe SQL construction).
  - Timeout policy and resource estimation (memory cost of result sets, streaming export).
  - Lineage metadata structure and immutability in exports.
  - JOIN order safety for multi-table queries and circular dependency detection.
  - Cardinality and memory estimation before execution.

### Phase 1: Data Model + Query DSL

- Add query DSL entities to `apps/backend/app/core/metadata_db.py`:
  - `saved_query` table: query_id, workspace_id, name, description, query_config (JSON), created_at, updated_at, last_executed_at.
  - `query_execution_log` table: execution_id, query_id, execution_state (running/completed/timeout/failed), row_count, execution_time_ms, error_message, executed_at.
  - Indexes on query_id, workspace_id, and executed_at.
- Define query configuration structure (in `data-model.md`):
  - Base table and columns.
  - Filters (column, operator, value(s), is_parameterized).
  - Aggregations (column, function, alias).
  - GROUP BY columns.
  - Joins (relationship_rule_id, join_type, joined_columns).
  - Sort order and result limit.
  - Execution timeout in seconds.

- Update `apps/backend/app/schemas.py` with DTOs for:
  - QueryConfigRequest / QueryConfigResponse.
  - FilterSpec, AggregationSpec, JoinSpec.
  - PreviewResultsResponse (rows, estimated_total, execution_time_ms).
  - ExecutionResultResponse (rows, lineage_metadata, execution_log).
  - SavedQueryResponse (query_id, name, description, config, status).

### Phase 2: Query Service & SQL Generator

- Add `apps/backend/app/services/query_service.py` implementing:
  - **QueryBuilder**: Translate query config to DuckDB SQL with parameterized filters.
  - **QueryExecutor**: Execute SQL against workspace DuckDB connection, enforce timeout, handle cancellation.
  - **ResultsLineage**: Build lineage metadata (source tables, rules used, filters, aggregations, execution details).
  - **CardinalityEstimator**: Estimate result set size and memory footprint before execution; reject if exceeds threshold.
  - **JoinValidator**: Verify only approved relationship rules are used; detect circular dependencies.
- Validation rules:
  - Ensure GROUP BY columns are non-aggregated and exist in base or joined tables.
  - Ensure all filter columns exist in selected tables.
  - Ensure aggregations are applied to numeric columns only.
  - Ensure relationship rules are approved (status='approved' from spec 002).
  - Enforce 5-second timeout hard limit on all query execution paths.
  - Parameterize all filter values (no string concatenation).

### Phase 3: API Endpoints

- Extend `apps/backend/app/main.py` with endpoints:
  - `POST /api/v1/workspaces/{workspaceId}/queries/validate` — Validate query config (no execution).
  - `POST /api/v1/workspaces/{workspaceId}/queries/preview` — Execute with LIMIT 100, return preview + estimated total + lineage.
  - `POST /api/v1/workspaces/{workspaceId}/queries/execute` — Execute full query, return results + lineage.
  - `POST /api/v1/workspaces/{workspaceId}/queries/export` — Execute and export to Excel or CSV with lineage sheet.
  - `POST /api/v1/workspaces/{workspaceId}/saved-queries` — Save query config with name.
  - `GET /api/v1/workspaces/{workspaceId}/saved-queries` — List saved queries.
  - `GET /api/v1/workspaces/{workspaceId}/saved-queries/{queryId}` — Retrieve saved query config.
  - `PUT /api/v1/workspaces/{workspaceId}/saved-queries/{queryId}` — Update saved query.
  - `DELETE /api/v1/workspaces/{workspaceId}/saved-queries/{queryId}` — Delete saved query.
  - `GET /api/v1/workspaces/{workspaceId}/saved-queries/{queryId}/executions` — List execution history.

- Error semantics:
  - `400` for invalid query config (orphaned columns, non-approved joins, circular refs).
  - `408` for timeout (query exceeded 5-second limit).
  - `413` for memory estimation failure (result set too large).
  - `409` for relationship rule no longer approved.
  - `404` for missing saved query, workspace, or table.

### Phase 4: Builder UI Components

- Add query builder interface in `apps/builder/src/`:
  - **QueryBuilder** (main orchestrator):
    - Base table selector (dropdown listing all tables in workspace).
    - Column picker (checkboxes, searchable, grouped by table if joins present).
    - Filter panel (add/remove filters, column/operator/value selectors, validation errors).
    - Aggregation panel (add/remove aggregations, function selector, alias input).
    - GROUP BY panel (drag-to-select from available columns).
    - Join panel (add via approved relationship rules, display join type, show join columns).
    - SQL preview (read-only, syntax highlighted).
  - **ResultsViewer**:
    - Paginated table for preview and execution results.
    - "Showing X of Y rows" indicator with more-rows badge.
    - Column filtering/sorting.
    - Spinner during execution with timeout progress indicator.
    - Error display (user-friendly messages for validation, timeout, memory errors).
    - Download buttons for Excel and CSV.
  - **SavedQueriesList**:
    - Table showing saved queries (name, description, created_at, last_executed_at).
    - Load/duplicate/delete actions.
    - Orphaned query detection (table/column no longer exists).
    - Re-validation prompt on load.

- Extend `apps/builder/src/api/queryApi.js` with client methods for all endpoints above.

### Phase 5: Verification & Hardening

- Add contract tests in `apps/backend/tests/contract/test_query_builder_contract.py`:
  - Validate request/response shapes match API contract (all required fields, correct types).
  - Error status codes (400/408/413/409/404).
  - Parameter validation (filter values are parameterized, no SQL injection).
- Add integration tests in `apps/backend/tests/integration/`:
  - Single-table query with filter and aggregation → correct SQL preview + execution.
  - Multi-table query with approved relationship → correct JOIN clause.
  - Query execution with unapproved relationship → 409 rejection.
  - Preview timeout (query taking >5 seconds) → cancellation + 408.
  - Circular relationship detection → 400 rejection.
  - Memory estimation (expected large result set) → 413 rejection before execution.
  - Saved query lifecycle (create/load/update/delete).
  - Execution history logging.
  - Export to Excel with lineage sheet + CSV export.
- Builder smoke checks:
  - Verify `pnpm --filter builder build` completes without errors.
  - Manual end-to-end: Build query, preview, execute, export.
  - Verify UI error messages are user-friendly (no stack traces).

- Run `cd apps/backend && pytest` and keep existing test suite green.

## Requirement Traceability (Plan-Level)

- **FR-001** (Query builder UI): Phase 4 QueryBuilder component.
- **FR-002..FR-003** (Operators, aggregations): Phase 2 SQL generator, Phase 4 UI controls.
- **FR-004** (GROUP BY validation): Phase 2 QueryBuilder validation.
- **FR-005** (Approved-only joins): Phase 2 JoinValidator, Phase 3 endpoint validation.
- **FR-006** (Valid DuckDB SQL): Phase 2 QueryBuilder SQL generation.
- **FR-007..FR-008** (Timeout enforcement): Phase 2 QueryExecutor, Phase 3 endpoints.
- **FR-009** (Result set pagination): Phase 4 ResultsViewer, Phase 2 streaming export.
- **FR-010** (Excel/CSV export with lineage): Phase 2 ResultsLineage, Phase 3 export endpoint, Phase 4 download UI.
- **FR-011** (Continuous validation): Phase 4 UI form validation, Phase 3 validate endpoint.
- **FR-012** (Save/load queries): Phase 1 data model, Phase 3 saved-queries endpoints, Phase 4 SavedQueriesList component.
- **SC-001..SC-005** (Performance, safety, SQL injection): Phase 2 CardinalityEstimator, Phase 3 parameterization, Phase 5 integration tests.

## Complexity Tracking

| Violation                                                         | Why Needed                                                                          | Simpler Alternative Rejected Because                                                                                                                                                                                |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Timeout hardening                                                 | Safety: prevent runaway queries from consuming resources or hanging browser         | Soft timeout with retry: unreliable, confusing to users; graceful degradation into partial results: violates reproducibility (different runs return different data)                                                 |
| Memory estimation before execution                                | Safety: prevent OOM crashes on oversized result sets                                | Execute then handle OOM: too late, destabilizes backend; stream all results: unbounded browser memory usage                                                                                                         |
| Parameterized filters                                             | Security: SQL injection prevention                                                  | String escaping: prone to edge case failures (e.g., embedded quotes); parameterization: standard, proven                                                                                                            |
| Lineage immutability in export                                    | Traceability (Principle VI): export must not drift from execution                   | Lineage as reference to mutable rule: future edits to rules would retroactively change export metadata; immutable snapshot: auditable, reproducible                                                                 |
| Approved-only joins enforcement at query build AND execution time | Safety: prevent rule changes mid-query from silently using unapproved relationships | Check only at execution: query builds successfully with rule X, then X is unapproved before execution, query executes with wrong rule (breaks reproducibility); check at build: caught early, UX feedback immediate |
