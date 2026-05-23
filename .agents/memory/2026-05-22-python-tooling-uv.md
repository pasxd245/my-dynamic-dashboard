# Python tooling — default to uv (not plain pip or poetry)

**Date**: 2026-05-22
**Agent**: claude-opus-4-7
**Confidence**: High
**Status**: New

## Problem

Round_01 backend skeleton needed a Python package-manager choice. The
drifted iteration used plain `pip install -e` with `hatch` for builds,
no lockfile. That setup gives non-reproducible installs across machines
and CI, and the resolver is slow.

## Finding

`uv` (verified 0.10.3) composes cleanly on top of the same
`hatchling` + `hatch-vcs` `pyproject.toml` the drifted repo used —
**zero pyproject changes were needed**. `uv sync --extra <group>`
resolves + installs + creates `.venv/` in one step and produces a
commitable `uv.lock`. End-to-end verified in Round_01:

- `uv sync --extra test --extra dev` → clean install
- `uv run pytest` → 1/1 pass
- `uv run uvicorn app.main:app` + `curl /health` → 200 OK with
  `{"status":"ok","duckdb":"v1.1.3"}`

## Evidence

- Files: [workspace/apps/backend/pyproject.toml](../../workspace/apps/backend/pyproject.toml),
  [workspace/apps/backend/uv.lock](../../workspace/apps/backend/uv.lock)
- Round: [.agents/plan/cycles/Round_01.md](../plan/cycles/Round_01.md)
- Drifted reference: prior backend `pyproject.toml`, reached through
  [drifted-iteration.md](../context/drifted-iteration.md) governance
  (same build-system, no lockfile)

## Recommendation

**Do**:

- Default to `uv` for every new Python app under `workspace/apps/`
- Commit `uv.lock` next to each app's `pyproject.toml`
- Document developer commands as `uv sync` / `uv run pytest` /
  `uv run uvicorn ...` — never `pip install -e` in READMEs
- Keep `hatchling` + `hatch-vcs` as build-system; uv composes with them

**Don't**:

- Silently fall back to plain pip if a CI image lacks uv — surface it
  as a deliberate exception in a future round
- Use poetry — the build-system here is hatch

## Promotion Candidate?

- [x] `context/` — stable tooling pattern, applies to every Python app
      in this repo; promote after second Python app validates the
      pattern
- [ ] `skills/` — possibly a `scaffold-fastapi-app-uv` skill if a
      second Python service appears; defer until pulled
- [ ] Not yet
