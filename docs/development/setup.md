# Development Setup

## Prerequisites

- Python 3.12+
- Node.js 20.19+ (or 22.12+)
- pnpm

## Quick start

Run services directly during development:

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

- Backend: <http://localhost:8000>
- Frontend: <http://localhost:5173>

Containerized local stack:

```bash
cd devops && docker compose up -d --build
```

- Backend: <http://localhost:8000>
- Builder: <http://localhost:3000>
- Dashboard: <http://localhost:8501>

## Architecture at a glance

### Backend (FastAPI + Python 3.12)

- **Database**: SQLite for metadata (schemas, roles, relationships, saved queries); DuckDB for query execution.
- **Services**: `QueryConfigValidator`, `SqlTranslator`, `JoinGraphValidator`, `QueryExecutionService`, `QueryExportService`, `SavedQueryService`.
- See per-feature docs under [`docs/features/`](../features/) for endpoint and service details.

### Frontend (React 19 + TypeScript + Vite)

- Builder UI: `QueryBuilderPanel`, `JoinPanel`, `PreviewPanel`, `ExecutionPanel`, `ExportPanel`.
- Saved queries: `SaveQueryDialog`, `SavedQueryLibraryPage`, `SavedQueryDetail`, `VersionTimeline`, `ExecutionHistoryTable`, `UpdateQueryDialog`.
- API client: [`apps/builder/src/api/queryApi.ts`](../../apps/builder/src/api/queryApi.ts).

## Tests

```bash
cd apps/backend
python -m pytest tests/ -v
```

Coverage includes contract tests (API shape), integration tests (SQL generation, validation), and E2E workflows (build → preview → execute → export; save → reload → execute → history; saved-query CRUD lifecycle).
