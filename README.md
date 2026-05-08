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
  - `QueryPersistenceService`: Saved query CRUD and history tracking

- **Endpoints** (50 tests covering contract + integration + E2E):
  - `POST /api/v1/workspaces/{id}/queries/validate` — Validate query with SQL preview
  - `POST /api/v1/workspaces/{id}/queries/preview` — LIMIT 100 preview with metadata
  - `POST /api/v1/workspaces/{id}/queries/execute` — Full execution with state tracking
  - `POST /api/v1/workspaces/{id}/queries/export` — Excel/CSV export
  - `POST/GET/PUT/DELETE /api/v1/workspaces/{id}/saved-queries` — CRUD operations
  - `GET /api/v1/workspaces/{id}/saved-queries/{id}/executions` — Execution history

### Frontend (React 18 + TypeScript + Vite)

- **Components**:
  - `QueryBuilderPanel`: Main UI with base table, columns, filters, aggregations, SQL preview
  - `JoinPanel`: Join relationship builder (scaffolded for integration)
  - `PreviewPanel`: LIMIT 100 results display (scaffolded)
  - `ExecutionPanel`: Full execution results (scaffolded)
  - `ExportPanel`: Excel/CSV download (scaffolded)
  - `SavedQueriesPanel`: Query library and CRUD (scaffolded)

- **API Client** (`src/api/queryBuilderApi.ts`):
  - Async functions: `validateQuery()`, `previewQuery()`, `executeQuery()`, `exportQuery()`
  - Saved query CRUD: `saveQuery()`, `listQueries()`, `getQuery()`, `updateQuery()`, `deleteQuery()`
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
