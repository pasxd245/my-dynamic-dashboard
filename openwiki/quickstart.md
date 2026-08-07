---
type: wiki quickstart
title: my-dynamic-dashboard code wiki
description: Entry point for understanding and safely changing the CRM-export analytics platform, its applications, contracts, operations, and tests.
tags: [overview, navigation]
---

# my-dynamic-dashboard code wiki

This repository is a CRM-export-to-analytics product: users import CSV/Excel data into workspace-scoped datasets, govern relationships, construct saved queries, materialize workflows, and publish dashboard definitions. Start with [system architecture](architecture/overview.md) for runtime ownership and data flow.

## Main sections

- [Backend service](backend/service.md) — FastAPI composition, persistence, configuration, middleware, and router ownership.
- [Datasets and ingestion](backend/datasets.md) — staging, Parquet, typed commits, refresh and row filtering.
- [Saved queries and execution](backend/queries.md) — query composition, joins, filters, steps, and aggregates.
- [Workflows and materialization](backend/workflows.md) — consolidation and frozen outputs.
- [Governance and dashboards](backend/governance-and-dashboards.md) — workspace, relationship, and dashboard server resources.
- [Builder application](builder/application.md) — route map, providers, HTTP consumption, i18n, and mocks.
- [Data management authoring](builder/data-management.md) and [dataset exploration](builder/dataset-exploration.md) — import/refresh/query authoring versus row/filter/advanced-query UX.
- [Builder dashboards](builder/dashboards.md) — widget behavior and persistence.
- [API contracts](contracts/api-contracts.md) — wire-shape authority and cross-app change sequence.
- [Configuration and local operations](platform/configuration-and-operations.md) and [testing and quality gates](platform/testing-and-quality.md).
- [Shared UI package](ui/package.md) — `@mdd/ui` exports and consumer boundary.

## Task routing

| Engineering intent | Read first | Main source entrypoints | Focused validation |
| --- | --- | --- | --- |
| Add/change an endpoint or shared response | [API contracts](contracts/api-contracts.md) | `workspace/packages/contracts`, backend router, builder API module | `pnpm --filter @mdd/contracts test`, affected pytest/Vitest |
| Change CSV/Excel import or refresh | [Datasets](backend/datasets.md) | `routers/uploads.py`, `routers/datasets.py`, `ingest/*`, wizard | `uv run pytest tests/test_datasets_batch.py`; builder dataset tests |
| Change filters or advanced query text | [Dataset exploration](builder/dataset-exploration.md) | `advanced-query/*`, `filters/*`, `datasetsApi.ts`, backend filter parsing | `pnpm --filter builder test`; focused row/filter pytest |
| Change joins, query steps, preview or aggregate | [Queries](backend/queries.md) | `query_engine.py`, `rows_reader.py`, query canvas/hooks | `uv run pytest tests/test_joins.py tests/test_queries.py`; builder query tests |
| Change workflow run/output behavior | [Workflows](backend/workflows.md) | `routers/workflows.py`, `query_engine.py`, workflow UI | `uv run pytest tests/test_workflows_run.py` |
| Change dashboard widgets | [Builder dashboards](builder/dashboards.md) | `features/dashboard/*`, query aggregate endpoint | dashboard feature and backend dashboard/aggregate tests |
| Change local config/startup/seed values | [Operations](platform/configuration-and-operations.md) | `values.yaml`, templates, render/dev/seed scripts | `pnpm config:render`; targeted app validation |
| Change shared presentation primitives | [Shared UI package](ui/package.md) | `workspace/packages/ui/src`, builder imports | `pnpm --filter @mdd/ui type-check && pnpm --filter @mdd/ui test` |

## First-run commands

```bash
pnpm install
( cd workspace/apps/backend && uv sync --extra test --extra dev )
pnpm dev
# Builder: http://localhost:3000
# Backend health: http://127.0.0.1:8000/health
```

Use `pnpm dev:local:status` to inspect PIDs/ports/logs and `pnpm dev:local:down` to stop the stack. Use `pnpm dev:seed` for the lightweight sales scenario after the backend is ready.

## Backlog

No evidence-blocked substantial components were deferred. The agent operating-system directories are explicitly out of scope under repository ignore rules and are not documented here.
