# Round 01: Backend skeleton — FastAPI + DuckDB boot

**Status**: Complete
**Date started**: 2026-05-22
**Date completed**: 2026-05-22

## Goal

Stand up the product's data spine: a FastAPI service at
`workspace/apps/backend` with a single `/health` endpoint that opens a
DuckDB connection and returns `{ "status": "ok", "duckdb": "<version>" }`.
This is the smallest verifiable foundation that everything else in the
product (ingest, profiler, query, UI) will hang off.

_Track: 1 (product). Pulled by: empty `workspace/` after the three-track
restructure; product cannot start without a backend boot._

## Plan

- [x] Create `workspace/apps/backend/` with `pyproject.toml`
      (Python 3.12, deps: `fastapi`, `uvicorn`, `duckdb` only — defer
      polars/alembic/sqlmodel until pulled).
- [x] Add `app/main.py` exposing `GET /health` that returns
      `{"status": "ok", "duckdb": duckdb.__version__}` (via
      `duckdb.connect(":memory:").execute("SELECT version()")`).
- [x] Add `app/__main__.py` so `python -m app` runs uvicorn.
- [x] Add `tests/test_health.py` (pytest + FastAPI `TestClient`)
      verifying 200 + response shape.
- [x] ~~Add `pytest.ini` with `testpaths = tests`.~~ Put pytest config
      in `pyproject.toml` under `[tool.pytest.ini_options]` instead —
      cleaner, single source of truth.
- [x] Update root `pnpm-workspace.yaml` — already covers
      `workspace/apps/*` and `workspace/packages/*`; no change needed.
- [x] Add `workspace/apps/backend/README.md` with `uv sync` / `uv run`
      commands (updated mid-round when uv replaced pip).

## Risks / unknowns

- ~~**Python tooling choice (uv vs pip vs hatch).**~~ **Decided: same as
  drifted repo — `hatchling` + `hatch-vcs` build, ruff lint, pytest
  with `unit/integration/contract/perf` markers.** Deps stay minimal
  (`fastapi`, `uvicorn`, `duckdb` only); polars/sqlmodel/alembic
  deferred until pulled.
- **No Alembic / no DB schema yet.** Intentional — `/health` opens an
  in-memory DuckDB (`duckdb.connect(":memory:")`) just to prove the
  driver loads. File-backed DB is a future round.
- **Port collision.** Default uvicorn port 8000; verify nothing else
  in the dev env binds it.

## Do

- Scaffolded `workspace/apps/backend/` with `app/{__init__,main,__main__}.py`,
  `tests/test_health.py`, `pyproject.toml` (hatchling + hatch-vcs, ruff,
  pytest markers — mirroring the drifted backend's tooling shape).
- `/health` opens an in-memory DuckDB and returns
  `{"status":"ok","duckdb":"<version>"}`.
- **Tooling decision (mid-round):** adopted `uv` as the package
  manager instead of plain `pip`. `pyproject.toml` is unchanged
  (uv-compatible by default); `uv sync --extra test --extra dev`
  generated `uv.lock` (committed) at `workspace/apps/backend/uv.lock`.
  README updated to use `uv sync` / `uv run`.
- Verified locally:
  - `uv sync --extra test --extra dev` → resolved + installed.
  - `uv run pytest -v` → 1 passed in 0.66s.
  - `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000` →
    `curl localhost:8000/health` returned `200` with
    `{"status":"ok","duckdb":"v1.1.3"}`.

## Check

- [x] `uv sync --extra test --extra dev` succeeds and produces
      `workspace/apps/backend/uv.lock`.
- [x] `uv run uvicorn app.main:app` boots without error.
- [x] `curl localhost:8000/health` returns 200 with
      `{"status":"ok","duckdb":"v1.1.3"}`.
- [x] `uv run pytest` passes (1/1).
- [x] Repo-wide markdownlint passes
      (`npx markdownlint-cli2` clean: 25 files, 0 errors).
      _Note:_ root `package.json` does not yet wire a `md:lint` script
      (drifted repo did). Adding it is a small track-2 follow-up — defer
      until pulled by a CI round.

## Act

**Status**: Complete (human-approved 2026-05-22). Per
[governance.md](../../context/governance.md), only humans move a round
to Complete.

**Learnings**:

- Adopting `uv` mid-round was friction-free: the `hatchling`-based
  `pyproject.toml` needed no changes; `uv sync` produced a lockfile and
  venv in one step. Going forward, all Python apps in `workspace/apps/`
  should default to uv unless a reason emerges otherwise.
- Root `package.json` is currently bare (only a placeholder `test`).
  The drifted repo's `md:lint`, `format`, `dev:*` scripts are _not_
  inherited — they need explicit pull-in by a future round.
- `hatch-vcs` `raw-options.root` for a nested workspace package is
  `"../../.."` (three levels up from `workspace/apps/backend/` to repo
  root). Worth remembering for the next Python app.

**Promotions** _(decision: none this round)_:

- → `context/` : none — product code, no broadly-applicable rule
  validated yet. The uv-tooling memory may promote after a second
  Python app validates the pattern.
- → `skills/` : none — `scaffold-fastapi-app-uv` skill could be useful
  when a 2nd Python service appears; not pulled yet.

**Memories captured (in `.agents/memory/`):**

- [2026-05-22-python-tooling-uv.md](../../memory/2026-05-22-python-tooling-uv.md)
  — uv is the default Python package manager for this repo.
- [2026-05-22-round-roadmap-deferrals.md](../../memory/2026-05-22-round-roadmap-deferrals.md)
  — Streamlit deferred indefinitely; docs-graph deferred pending
  track-classification; `@mdd/ui` BIZ-adjacent peer deps permanently
  excluded.

**Follow-ups (not promotions, just notes for the backlog):**

- Track-2 pull-in: wire `md:lint` / `format` scripts into root
  `package.json` when first CI round runs.
- Track-2 pull-in: husky pre-commit running `uv run ruff` on staged
  Python files (only after a Python file is actually edited outside
  Round_01).

## Feeds into → Round 02

What R01 hands to R02:

- **Workspace pattern** at `workspace/apps/<name>/` is proven; R02
  mirrors it at `workspace/packages/<name>/`.
- **Per-package tooling discipline** (each package owns its
  `pyproject.toml` / `package.json`, lockfile, scripts) is the model
  R02 follows for the `@mdd/ui` `package.json`.
- **Verification habit** (each round ships with a runnable check —
  for R01 it was `curl /health` + `pytest`; for R02 it will be
  `pnpm --filter @mdd/ui type-check` + vitest snapshot).
- **Build-first discipline** validated: R01 shipped the smallest
  thing that proves the spine works (`/health` returning duckdb
  version). R02 inherits the same restraint — empty
  `Components/Icons/Utils` shells + `themeTokens` + `AntdConfig`
  only, nothing speculative.
