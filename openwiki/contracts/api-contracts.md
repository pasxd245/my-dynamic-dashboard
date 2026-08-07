---
type: API contract system
title: API contracts
description: The authoritative endpoint-level OpenAPI documents, shared schemas, rationale documents, and implementation validation boundary.
tags: [api, contracts, openapi]
---

# API contracts

`workspace/packages/contracts` is the authoritative HTTP wire-shape source for the builder and backend. Each endpoint has a standalone OpenAPI 3.1 YAML document; paired Markdown explains behavior, errors, examples and rationale. This package intentionally does not generate TypeScript or Python models—both applications hand-align to it.

## Layout and ownership

Resource directories are `workspaces`, `uploads`, `datasets`, `relationships`, `queries`, `dashboards`, and `workflows`. A `<verb>.contract.yaml` owns an endpoint; `_shared/*.yaml` holds reusable schemas referenced with local `$ref`. Examples:

| Need | Contract location | Implementations |
| --- | --- | --- |
| Upload or parse export | `uploads/*.contract.yaml` | `routers/uploads.py`, `uploadsApi.ts`, import wizard |
| Commit/read/refresh a dataset | `datasets/*.contract.yaml` | `routers/datasets.py`, `datasetsApi.ts`, dataset features |
| Query save/run/preview/aggregate | `queries/*.contract.yaml` | `routers/queries.py`, `queriesApi.ts`, query canvas/widgets |
| Workflow operations | `workflows/*.contract.yaml` | `routers/workflows.py`, `workflowsApi.ts`, workflow features |
| Dashboard CRUD | `dashboards/*.contract.yaml` | `routers/dashboards.py`, `dashboardsApi.ts`, dashboard feature |

Shared `query.yaml`, `workflow.yaml`, `dashboard.yaml`, dataset/column schemas, pagination and `api-error.yaml` are high-centrality artifacts. Generated ID patterns and values may mirror configuration, but contract shape remains the endpoint YAML’s responsibility.

## Safe contract change recipe

1. Change or add the endpoint YAML and paired rationale Markdown. Reference a shared schema only when it is genuinely reused.
2. Run `pnpm --filter @mdd/contracts test`; the validator dereferences refs and validates every contract document as OpenAPI 3.1.
3. Update backend Pydantic models and router behavior, then backend conformance tests using `tests/_conformance.py`.
4. Update builder local types, API function, hook/consumer, MSW handler if applicable, and focused UI tests.
5. Run the narrow backend and builder tests, then package-level validation as appropriate.

Do not treat a client type or router model as the contract source. Conversely, the validator does not prove runtime response conformance or sample Markdown validity; tests must cover those boundaries.
