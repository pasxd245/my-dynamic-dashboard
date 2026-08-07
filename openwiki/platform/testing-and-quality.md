---
type: quality system
title: Testing and quality gates
description: Test layers, hermetic backend fixtures, contract conformance, frontend feature tests, package checks, and focused validation commands.
tags: [testing, quality, validation]
---

# Testing and quality gates

Validation is distributed across the backend, builder, contracts, UI package and repository tooling. Prefer focused behavioral suites before broad package runs.

## Backend

Backend tests use pytest and `TestClient`. The autouse fixture in `workspace/apps/backend/tests/conftest.py` points SQLite and the data root at fresh `tmp_path` locations, builds models directly with `SQLModel.metadata`, and stamps Alembic head. This makes tests hermetic and fast while `test_schema_parity.py` checks the model-built schema against migrations.

`tests/_conformance.py` validates endpoint responses against the standalone contract YAML. Tests are grouped around behavior: upload/commit/refresh/row filtering, relationships/joins/composition, query execution/aggregation, dashboard CRUD, workflow materialization, configuration precedence, generated constants, migration parity, and temp sweeping.

Run from `workspace/apps/backend`:

```bash
uv run pytest tests/test_queries.py
uv run pytest tests/test_datasets_batch.py
uv run pytest
```

Use the first form for an affected domain; use the whole suite only when a shared execution/persistence/config surface changed.

## Builder and packages

Builder runs Vitest with Testing Library and happy-dom. Root `tests/` covers user-visible pages and interactions; feature-local tests cover pure dashboard behavior. Contract tests validate every OpenAPI file and dereferenced ref. UI package tests protect exported components/providers/tokens.

```bash
pnpm --filter builder type-check
pnpm --filter builder test
pnpm --filter @mdd/contracts test
pnpm --filter @mdd/ui type-check
pnpm --filter @mdd/ui test
```

## Repository gates

Root scripts include `pnpm md:lint`, `pnpm format:check`, `pnpm design:lint`, `pnpm design:tokens`, and `pnpm plan:lint`. Formatting targets Markdown; run the narrow relevant command rather than blindly applying format writes. `config:render` is a prerequisite whenever shared template values or rendered constants change.

A useful change sequence is: contract validator when wire shape changed; focused backend test; focused builder test; type check; then broad package/repository gates conditioned on changed shared surfaces.
