# My Dynamic Dashboard

**Version**: MVP 1.0 | **Status**: Feature-Complete (Spec 001-003) | **Test Coverage**: 50 backend tests passing

## Overview

My Dynamic Dashboard is a data discovery and analytics platform that combines:

- **Data profiling** (Spec 001): Automatic schema inference and column role classification
- **Relationship rules** (Spec 002): Governed multi-table joins with approval workflows
- **Query builder** (Spec 003): Visual query composition with DuckDB SQL generation and safe preview/execution

This repository implements a **specification-driven development (SDD)** workflow using Spec-Kit for feature planning, decomposition, and task generation.

---

## Features

### ✅ Spec 001: Data Upload & Profiling (Complete)

Upload CSV/Excel files with automatic:

- Column type detection (int, float, string, date, etc.)
- Role assignment (identity_key, measure, dimension, time_anchor, status, outcome)
- Profile statistics (null %, distinctness, numeric ranges, date ranges)
- Data quality warnings

### ✅ Spec 002: Relationship Rules (Complete)

Define and approve multi-table relationships with:

- Visual relationship rule builder
- Overlap and cardinality analysis
- Status tracking (suggested → approved)
- Governance gates (low-overlap acknowledgment, actor audit trail)

### ✅ Spec 003: Query Builder & Execution (Complete)

Build queries visually with full feature set:

#### **US1: Build Query Visually** ✅

- Base table selection
- Multi-column picker
- Filter builder (=, !=, <, >, <=, >=, IN, LIKE, IS NULL, IS NOT NULL)
- Aggregations (SUM, COUNT, AVG, MAX, MIN)
- GROUP BY with automatic consistency validation
- SQL preview with syntax highlighting

#### **US2: Add Joins** ✅

- Join builder with approved relationship rules only
- Join type selector (INNER, LEFT, RIGHT, FULL)
- Automatic join condition derivation from relationship metadata
- Acyclic join graph validation

#### **US3: Preview Results** ✅

- Safe preview execution with LIMIT 100
- Result count estimation and metadata
- 5-second hard timeout with graceful error handling
- Lineage metadata capture for traceability

#### **US4: Execute Full Query** ✅

- Full query execution with result handling
- State tracking (QUEUED, RUNNING, COMPLETED, TIMEOUT, FAILED)
- Memory pre-checks for large result sets
- Execution time reporting

#### **US5: Export Results** ✅

- Export to Excel with Results and Lineage sheets
- Export to CSV with lineage header comments
- Immutable lineage snapshot with full query audit trail
- Null and special character handling

#### **US7: Saved Queries** ✅

- Save/load/update/delete query configurations
- Execution history tracking per saved query
- Config hash generation for reproducibility
- Query duplication and version management

### ✅ Spec 004: Saved Queries (Complete)

Enable analysts to persist, version, search, and reuse ad-hoc queries with full audit trail and soft-delete recovery.

#### **US1: Save a Query** ✅

- Save query from builder with name, description, and tags
- Automatic tag normalization (lowercase, deduplicate)
- Builder snapshot and SQL snapshot capture (immutable)
- Duplicate name detection within workspace
- Version 1 auto-creation with event logging

#### **US2: Browse and Search Library** ✅

- List all saved queries with pagination (50 per page)
- Keyword search across name, description, tags (case-insensitive)
- Tag-based filtering with autocomplete suggestions
- Exclude soft-deleted queries from active list
- Execution count and version count summaries

#### **US3: Load and Inspect** ✅

- Retrieve query detail with full version history
- Revalidation on load (column existence, relationship status, base table)
- Validation warnings for schema drift (non-blocking)
- Load specific version by version_id
- Builder snapshot return for UI reload

#### **US4: Duplicate and Create Versions** ✅

- Duplicate saved query to new independent entry with lineage (`source_query_id`)
- Update query metadata (name, description, tags)
- Create new immutable version on builder snapshot change
- Auto-increment version numbers with parent-version-id chain
- Change summary capture per version update

#### **US5: Soft Delete and Recovery** ✅

- Soft-delete saved queries with 24-hour recovery window
- Exclude deleted queries from active library (state=active)
- Restore deleted queries within grace period
- Reject restore after expiry (409 Conflict)
- Preserve execution history and event trail across delete

#### **Supporting Features**

- Execution history tracking: query_id, version_id, status, row_count, duration, executed_by
- Event logging: create, update, delete, restore, duplicate events with timestamps
- Workspace-scoped CRUD: All operations scoped by workspace_id
- Structured error handling: 404 (not found), 409 (conflict/expired), 400 (validation)

---

## Architecture

### Backend (FastAPI + Python 3.12)

- **Database**: SQLite for metadata (schemas, roles, relationships, saved queries), DuckDB for query execution
- **Services**:
  - `QueryConfigValidator`: Filter, aggregation, GROUP BY consistency validation
  - `SqlTranslator`: Parameterized SQL generation with operator whitelist
  - `JoinGraphValidator`: Approved-only and acyclic join validation
  - `QueryExecutionService`: Timeout enforcement, memory checks, result handling
  - `QueryExportService`: Excel/CSV export with lineage metadata
  - `SavedQueryService`: Immutable versioning, search, revalidation, soft-delete recovery (Spec 004)

- **Database Tables**:
  - `saved_queries`: Query metadata with version/execution counters, soft-delete columns
  - `saved_query_versions`: Immutable versioned snapshots with parent-version lineage
  - `saved_query_events`: Audit trail (create, update, delete, restore, duplicate)
  - `saved_query_executions`: Execution history with status, row count, duration per version

- **Endpoints** (90 tests covering contract + integration + E2E):
  - **Query Execution** (Spec 003):
    - `POST /api/v1/workspaces/{id}/queries/validate` — Validate query with SQL preview
    - `POST /api/v1/workspaces/{id}/queries/preview` — LIMIT 100 preview with metadata
    - `POST /api/v1/workspaces/{id}/queries/execute` — Full execution with state tracking
    - `POST /api/v1/workspaces/{id}/queries/export` — Excel/CSV export
  - **Saved Queries** (Spec 004):
    - `POST /api/v1/workspaces/{id}/saved-queries` — Save new query (201)
    - `GET /api/v1/workspaces/{id}/saved-queries` — List with pagination/filtering
    - `GET /api/v1/workspaces/{id}/saved-queries/search` — Keyword + tag search
    - `GET /api/v1/workspaces/{id}/saved-queries/{queryId}` — Detail with version history
    - `POST /api/v1/workspaces/{id}/saved-queries/{queryId}/load` — Load with revalidation
    - `PATCH /api/v1/workspaces/{id}/saved-queries/{queryId}` — Update (creates new version)
    - `POST /api/v1/workspaces/{id}/saved-queries/{queryId}/duplicate` — Duplicate as new entry
    - `DELETE /api/v1/workspaces/{id}/saved-queries/{queryId}` — Soft-delete (24h recovery)
    - `POST /api/v1/workspaces/{id}/saved-queries/{queryId}/restore` — Restore from deletion
    - `GET /api/v1/workspaces/{id}/saved-queries/{queryId}/executions` — Execution history

### Frontend (React 18 + TypeScript + Vite)

- **Components**:
  - `QueryBuilderPanel`: Main UI with base table, columns, filters, aggregations, SQL preview
  - `JoinPanel`: Join relationship builder
  - `PreviewPanel`: LIMIT 100 results display
  - `ExecutionPanel`: Full execution results
  - `ExportPanel`: Excel/CSV download
  - **Saved Queries** (Spec 004):
    - `SaveQueryDialog`: Save form with name, description, tag input
    - `SavedQueryLibraryPage`: Library browser with search/filter/pagination
    - `SavedQueryDetail`: Detail view with metadata, version timeline, execution history
    - `VersionTimeline`: Immutable version history with clickable load actions
    - `ExecutionHistoryTable`: Execution runs with timestamps, status, row counts, duration
    - `UpdateQueryDialog`: Update metadata or create new version

- **API Client** (`src/api/queryApi.ts`):
  - Query execution: `validateQuery()`, `previewQuery()`, `executeQuery()`, `exportQuery()`
  - Saved queries: `createSavedQuery()`, `listSavedQueries()`, `searchSavedQueries()`, `getSavedQuery()`, `loadSavedQuery()`, `updateSavedQuery()`, `duplicateSavedQuery()`, `deleteSavedQuery()`, `restoreSavedQuery()`, `getExecutionHistory()`
  - History: `getQueryHistory()`

---

## Testing

### Backend Test Suite (50 passing tests)

```bash
cd apps/backend
python -m pytest tests/ -v
# Output: 50 passed, 4 warnings
```

**Test Coverage**:

- **Contract Tests** (3 tests): API endpoint shape validation
- **Integration Tests** (11 tests): SQL generation, parameter ordering, validation
- **E2E Workflows** (4 tests):
  - Build → Preview → Execute → Export (with and without joins)
  - Save → Reload → Execute → History
  - Saved query CRUD lifecycle

---

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 20.19+ (or 22.12+)
- pnpm (package manager)

### Quick Start

```bash
# Backend
cd apps/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# Frontend (separate terminal)
cd apps/builder
pnpm install
pnpm run dev
```

Backend: `http://localhost:8000`  
Frontend: `http://localhost:5173`

### Run Tests

```bash
cd apps/backend
python -m pytest tests/ -v
```

---

## Production Ops Commands

1. Validate production artifacts:

- `scripts/ops/validate-production-config.sh`

1. Start production stack:

- `docker compose -f docker-compose.prod.yml up -d --build`

1. Trigger on-demand backup:

- `curl -X POST http://localhost:8000/api/v1/ops/backups/run`

1. List backups:

- `curl http://localhost:8000/api/v1/ops/backups`

1. Restore backup:

- `curl -X POST http://localhost:8000/api/v1/ops/restore -H 'Content-Type: application/json' -d '{"backup_id":"<id>","operator_id":"ops"}'`

1. Deploy release:

- `RELEASE_BUNDLE_ID=<id> BACKEND_IMAGE=<image:tag> BUILDER_IMAGE=<image:tag> DASHBOARD_IMAGE=<image:tag> scripts/ops/deploy-release.sh`

1. Roll back release:

- `ROLLBACK_TARGET_BUNDLE=<id> scripts/ops/rollback-release.sh`

## Incident Evidence Checklist

1. Timestamped health responses (`/health`, builder, dashboard probes).
2. Correlation IDs from failing API requests.
3. Service state snapshot: `docker compose -f docker-compose.prod.yml ps`.
4. Relevant log excerpts and severity/event_type context.
5. Backup artifact ID, restore run ID, and outcome timestamps.

---

## Specification-Driven Development

This project uses **Spec-Kit** for feature specification and implementation:

1. **Specify**: Define feature requirements and business questions
2. **Plan**: Generate implementation phases and technical context
3. **Tasks**: Decompose into granular, parallelizable tasks
4. **Implement**: Execute tasks with test-first discipline
5. **Analyze**: Validate against original requirements

### Feature Artifacts

Each feature in `specs/{NUMBER}-{NAME}/` includes:

- `spec.md` — Feature specification with user stories and acceptance criteria
- `plan.md` — Implementation phases and architecture decisions
- `tasks.md` — Granular, dependency-ordered task breakdown
- `data-model.md` — Database schema and data contract
- `quickstart.md` — Manual testing guide
- `contracts/*.openapi.yaml` — OpenAPI 3.0.3 REST contracts

### Specs in Development

- ✅ **Spec 001**: Upload Profile Field Roles (Complete)
- ✅ **Spec 002**: Relationship Rules (Complete)
- ✅ **Spec 003**: Query Builder & Execution (Complete)
- 🚀 **Spec 004**: Dashboard Visualizations (Planned)
- 🚀 **Spec 005**: Production Deployment (Planned)
- 🚀 **Spec 006**: Reporting & Exports (Planned)

---

## Governance & Compliance

### Constitution Principles (All Enforced)

1. **Business Question First**: Every feature begins with clear user need + success metric
2. **Metric Contracts**: Explicit success criteria for every user story
3. **Approved-Only Joins**: Multi-table queries restricted to approved relationship rules
4. **Data Lineage**: Full audit trail of query source tables, filters, aggregations
5. **Reconciliation Gates**: Query state validation before execution
6. **Reproducibility**: Config hash and immutable execution metadata
7. **Challenge/Sensitivity Gates**: Unapproved relationships rejected with clear error messages

---

## Transparency

AI-assisted development (e.g., Claude Code, Copilot) was used for scaffolding and iteration.
