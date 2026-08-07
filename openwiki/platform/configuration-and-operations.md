---
type: operational platform
title: Configuration and local operations
description: Rendered configuration, shared generated constants, local process lifecycle, readiness, logs, and deterministic development seed data.
tags: [operations, configuration, development]
---

# Configuration and local operations

This repository uses a configuration-rendering layer and root scripts to operate a local backend-plus-builder stack. `workspace/config/values.yaml` is the editable shared-value source; generated app outputs are ignored and should be refreshed through `pnpm config:render`.

## Rendering and value ownership

`scripts/config-render.mjs` changes into `workspace/config`, resolves `js-tmpl.config.yaml`, and calls `renderDirectory()` programmatically. The wrapper exists because the dependency’s CLI direct-run check is unreliable under pnpm symlinks. Templates under `workspace/config/templates` render beneath `workspace/apps` according to `outDir`.

Values include backend listener/CORS/upload and storage configuration, temp sweep controls, builder API URL/mock flag, i18n default, identifier regexes, error codes, name/page-size vocabulary, and dashboard max rows. Generated constants provide a cross-language alignment point, but Pydantic literals and TypeScript discriminated unions remain hand-authored. Change a shared value in `values.yaml`, render, and validate all consuming behavior.

## Local lifecycle

`pnpm dev` calls `scripts/dev/local-up.sh`. The script refuses existing PID files or occupied ports, launches `uv run uvicorn app.main:app` on `127.0.0.1:8000` and `pnpm --filter builder dev` on port 3000, records PIDs under `tmp/dev/pid`, writes logs under `tmp/dev/log`, and waits for backend `/health` and builder root readiness. Use `pnpm dev:local:status` for PID/port/log information and `pnpm dev:local:down` to stop both and clean orphaned state.

Install prerequisites with `pnpm install` and, from `workspace/apps/backend`, `uv sync --extra test --extra dev`.

## Seed data

`pnpm dev:seed` calls `scripts/dev/seed.py --light`; `pnpm dev:seed:full` uses larger deterministic fact volumes. The script uses stdlib HTTP against the backend and creates/reuses a sales workspace, datasets, governed relationships and base queries. Its default behavior converges: workspace/name and relationship pair are reused, datasets are reused because committed content is immutable, and queries are updated by name. Use `--reset` when changing source content or volume because an existing dataset retains its original rows.

The seed scenario includes regions → customers → orders and products → orders, plus generated orders/telesale tables and edge cases. It is operational test data, not a substitute for focused test fixtures.

## Validation

- `pnpm config:render` refreshes outputs.
- `pnpm --filter builder build` validates a production bundle after frontend/config changes.
- Use `pnpm md:lint`, `pnpm format:check`, `pnpm design:lint`, and `pnpm design:tokens` for repository quality checks where relevant.
- Do not read or commit runtime `.env` files; edit safe template/value inputs instead.
