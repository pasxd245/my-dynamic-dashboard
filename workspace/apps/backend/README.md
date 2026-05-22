# backend

FastAPI service for `my-dynamic-dashboard`. Round_01 scope: `/health`
endpoint that opens an in-memory DuckDB and returns its version.

## Develop

```bash
# from workspace/apps/backend
uv sync --extra test --extra dev

# run server
uv run uvicorn app.main:app --reload

# run tests
uv run pytest
```

## Verify

```bash
curl localhost:8000/health
# -> {"status":"ok","duckdb":"v1.1.3"}
```

## Tooling

- Build: `hatchling` + `hatch-vcs` (version from git tag
  `apps/backend/v<semver>`, fallback `0.0.0`).
- Package manager: `uv` — `uv.lock` is committed for reproducible installs.
- Lint: `ruff` (line-length 100, target py312).
- Tests: `pytest` with markers `unit | integration | contract | perf`.
