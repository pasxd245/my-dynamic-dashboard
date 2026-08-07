---
type: backend service
title: Backend service
description: FastAPI service composition, persistence boundaries, middleware ordering, configuration, and endpoint ownership for the analytics platform.
tags: [backend, fastapi]
---

# Backend service

The backend starts at `workspace/apps/backend/app/main.py` as `app`. It exposes workspace, upload, dataset, query, relationship, dashboard, and workflow routers. It is the only component that writes backend state; the builder consumes it over HTTP.

## Composition and request handling

`lifespan()` first calls `run_startup_migrations()` and then, if enabled, creates `sweep_loop()` for expired temporary-upload directories. Shutdown cancels and awaits that task. `UnhandledErrorMiddleware` logs uncaught errors and emits `{"detail":"internal_error"}`. It must be added *before* `CORSMiddleware`: Starlette wraps later middleware outside earlier middleware, so CORS decorates this error response. CORS origins come from `CONFIG.settings.backend.cors_allow_origins`; allowed browser methods include GET, POST, PUT, PATCH, and DELETE.

`GET /health` proves DuckDB can open an in-memory connection and returns its version. `scripts/dev/local-up.sh` waits on that endpoint.

## Router ownership

| Router | Primary surface | Canonical details |
| --- | --- | --- |
| `routers/workspaces.py` | Workspace CRUD | [Governance and dashboards](governance-and-dashboards.md) |
| `routers/uploads.py` | Temp CSV/Excel upload and parse | [Datasets](datasets.md) |
| `routers/datasets.py` | Dataset commit, refresh, metadata and row reads | [Datasets](datasets.md) |
| `routers/relationships.py` | Governed dataset edges | [Governance and dashboards](governance-and-dashboards.md) |
| `routers/queries.py` | Saved query CRUD, run, preview, aggregate | [Queries](queries.md) |
| `routers/workflows.py` | Workflow CRUD, run/materialize, output rows | [Workflows](workflows.md) |
| `routers/dashboards.py` | Persisted dashboard CRUD | [Governance and dashboards](governance-and-dashboards.md) |

## Persistence and storage

`app/db_models.py` is the schema of record. It defines `Workspace`, `Dataset`, `Query`, `Dashboard`, `Workflow`, and `Relationship` SQLModel tables, including workspace-scoped uniqueness and foreign-key cascades. `app/db.py` uses SQLite for application metadata. Production calls Alembic `upgrade head`; test setup calls `create_all_for_tests()` and stamps the schema at head. The metadata database is `<data_root>/app.sqlite`.

`app/storage.py` owns locations under the configured data root:

- `uploads_tmp/<temp_id>/original.<ext>` and `meta.json` for temporary uploads;
- `datasets/<workspace_id>/<dataset_id>/original.<ext>`, `parsed.parquet`, and `source.json` for committed datasets;
- `workflows/<workspace_id>/<workflow_id>/output.parquet` for materialized workflows.

The root is `backend.data_dir` or the backend default data directory; tests override it with `storage.set_data_root`. Do not introduce direct path construction in routers when a `storage.py` helper exists.

## Configuration and generated constants

`app/_config` loads rendered backend configuration and supports environment overrides through the settings layer. Shared identifiers, page sizes, error-code strings, and dashboard row cap are rendered from `workspace/config/values.yaml` into `app/_generated/constants.py`. Update values and run `pnpm config:render`; do not hand-edit generated artifacts. See [configuration and operations](../platform/configuration-and-operations.md).

## Validation

- `uv run pytest` from `workspace/apps/backend` runs the hermetic backend suite.
- `tests/conftest.py` assigns a fresh SQLite path and data root per test.
- `tests/test_schema_parity.py` compares test-built schema with migrations.
- `tests/test_conformance.py` and `tests/_conformance.py` validate responses against contract documents.
- Run focused tests named in each domain page before broad backend validation.
