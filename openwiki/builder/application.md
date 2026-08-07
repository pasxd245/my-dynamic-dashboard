---
type: frontend application
title: Builder application
description: React application composition, route ownership, provider ordering, API-client boundaries, cache policy, localization, and optional mocks.
tags: [frontend, react, builder]
---

# Builder application

The builder is the Vite/React application in `workspace/apps/builder`. `src/main.tsx` is its composition root. It renders data-management authoring and dashboard views against the backend API, with an opt-in MSW path for offline development.

## Provider and route composition

`main.tsx` initializes i18n before mounting, imports React Flow base CSS globally, and composes this order: `StrictMode` → `QueryClientProvider` → `LocaleAwareAntd` → `AppErrorBoundary` → `BrowserRouter` → `AppLayout` → routes. `LocaleAwareAntd` maps i18next language to Ant Design locale and wraps global toast configuration. Keep the error boundary inside Ant Design providers so its fallback inherits theme tokens.

React Query defaults to a one-minute stale time and disables window-focus refetch. Feature hooks own query keys and invalidation around mutations; API modules own fetch and typed error conversion. `datasetsApi.ts` illustrates the split: it serializes request/query shapes, converts typed API envelopes to `ApiErrorThrown`, and leaves cache lifecycle to hooks.

| Route family | Feature | Canonical page |
| --- | --- | --- |
| `/data-management/workspaces` | workspace list and selection | [Data management](data-management.md) |
| `/data-management/datasets/*` | datasets, upload, refresh, detail | [Data management](data-management.md), [exploration](dataset-exploration.md) |
| `/data-management/workspaces/:id/relationships` | relationship governance | [Data management](data-management.md) |
| `/data-management/queries/*` | query list, canvas, detail | [Data management](data-management.md) |
| `/data-management/workflows/*` | workflow list, form, detail | [Data management](data-management.md) |
| `/settings/dashboard`, `/dashboards/:workspaceId/:slug` | dashboard configuration and view | [Dashboards](dashboards.md) |

`/` and the data-management group redirect to workspaces; unmatched routes render `NotFoundPage`.

## Configuration and mocking

`src/config` reads rendered Vite environment configuration. `workspace/config/values.yaml` controls `builder.api_base_url` and mock enablement; rendering creates the ignored `.env`. In development only, `VITE_MOCKS === '1'` dynamically imports `mocks/start` before rendering. Production builds cannot reach this branch because `import.meta.env.DEV` is false.

## Validation

`pnpm --filter builder type-check` checks TypeScript; `pnpm --filter builder test` runs Vitest with browser-like setup from `tests/setup.ts`. `tests/routing.test.tsx`, `i18n.test.tsx`, `locale-switcher.test.tsx`, and `app-error-boundary.test.tsx` are focused composition checks. Feature behavior is covered on its domain page.
