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
pip install -e .[dev,test]
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
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q
```

Backend test command matrix:

```bash
cd apps/backend
# default regression
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q

# layer-specific triage
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/unit -q
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/integration -q
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract -q

# opt-in perf harness
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest -m perf tests/perf -q
```

Dashboard command matrix:

```bash
cd apps/dashboard

# editable install via pyproject
pip install -e .[dev,test]

# layer-specific tests
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/dashboard pytest tests/unit -q
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/dashboard pytest tests/integration -q

# governance scan: only env helper should read environment directly
rg -n "os\.getenv|os\.environ" apps/dashboard

# app runtime smoke
streamlit run streamlit_app.py
```

Coverage includes contract tests (API shape), integration tests (SQL generation, validation), and E2E workflows (build -> preview -> execute -> export; save -> reload -> execute -> history; saved-query CRUD lifecycle).

## Backend Release Tooling (Spec 011)

Backend packaging and release workflows are now driven by `apps/backend/pyproject.toml`.

```bash
cd apps/backend

# Resolve package version from backend-scoped tags via hatch-vcs metadata
python - <<'PY'
import importlib.metadata as m
print(m.version('my-dynamic-dashboard-backend'))
PY

# Run backend lint policy (Ruff: E,F,B,SIM,I; line length 120)
ruff check app

# Simulate next conventional-commit release bump/changelog entry
cz bump --dry-run
```

Tag format for backend releases is `apps/backend/v$version`.

## Metadata persistence foundation

Feature 008 moves metadata schema ownership to SQLModel models plus Alembic migrations, but it does not change the backend service-layer data access contract.

- Startup now converges the metadata database through Alembic bootstrap steps instead of treating `init_metadata_db()` as the primary schema owner.
- Existing backend services still use raw `sqlite3` access patterns in this round.
- ORM session wiring is foundation-only for future work and is intentionally not required by current handlers.
- Migration strategy stays locked to explicit baseline table creation plus auto-stamp for legacy databases that do not yet have `alembic_version`.

### METADATA_DB_PATH

Use `METADATA_DB_PATH` to point the backend at a different metadata SQLite file for local development, test isolation, or operator workflows.

- Runtime default resolves to the repo data directory: `data/metadata.db`.
- Relative override values resolve from that same data directory.
- Existing services still talk to SQLite through raw `sqlite3`; this variable changes the file location, not the service contract.

Local shell example:

```bash
cd apps/backend
METADATA_DB_PATH=/tmp/metadata.dev.db python -m uvicorn app.main:app --reload
```

Local migration example:

```bash
cd apps/backend
METADATA_DB_PATH=/tmp/metadata.dev.db alembic upgrade head
```

Container one-off example:

```bash
cd devops
docker compose run --rm -e METADATA_DB_PATH=/app/data/metadata.dev.db backend alembic upgrade head
```

For long-running compose environments, add `METADATA_DB_PATH` through a compose override or service environment block. The checked-in compose file does not currently inject this variable by default.

### Resetting metadata state

For a fresh local metadata database, remove the target SQLite file and rerun either the backend startup or `alembic upgrade head` with the same `METADATA_DB_PATH` value.

For an existing pre-migration database, do not run ad hoc schema SQL. Keep the file in place and let the normal startup bootstrap perform the locked auto-stamp-then-upgrade flow.

Local reset example:

```bash
cd apps/backend
rm -f ../../data/metadata.dev.db
METADATA_DB_PATH=metadata.dev.db alembic upgrade head
```

## Builder Workflow Shell (Spec 007)

- Open `http://localhost:3000/workflow/upload-source` for the stage-oriented shell.
- Stage navigation persists in session storage and stays lock-aware to prerequisites.
- Active workspace/source context and connection status are shown persistently in the shell header.
- Query and Results/Saved stages remain blocked until active context is resolved.

Smoke commands:

```bash
# Local/stub smoke (deterministic diagnostics)
pnpm dev:builder:smoke:stub

# Local backend smoke endpoint execution
pnpm dev:builder:smoke:docker

# Compose profile smoke runner (requires backend service up)
docker compose -f devops/compose.yaml --profile smoke run --rm builder-smoke
```

## Builder Frontend Configuration (Spec 013)

### Setting `VITE_*` environment variables for local dev

Create `apps/builder/.env.local` (git-ignored) to override defaults:

```bash
# apps/builder/.env.local
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_LOG_LEVEL=debug
```

All `import.meta.env.*` reads are routed through `src/config/appConfig.ts`.
Add new variables there (not inline in components).

### Using localStorage overrides for debugging

Open the browser console and set a key with the `cfg:` prefix:

```javascript
localStorage.setItem('cfg:api.baseUrl', 'http://localhost:9999');
location.reload(); // reload to pick up the override

// Inspect all config values with source attribution:
appConfig.all();

// Clear override:
localStorage.removeItem('cfg:api.baseUrl');
```

### Running builder tests

```bash
pnpm --filter builder test           # Run once (CI mode)
pnpm --filter builder test:watch     # Watch mode (development)
```

### Builder command reference

```bash
pnpm --filter builder dev          # Dev server (port 3000, hot reload)
pnpm --filter builder build        # Production build
pnpm --filter builder type-check   # TypeScript type check
```
