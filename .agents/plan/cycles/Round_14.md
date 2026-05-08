# Round 14: MVP 1 Bootstrap (Round 01 DoD)

**Status**: In Progress
**Date started**: 2026-05-08
**Date completed**:
**MVP**: 1
**DoD tasks**: 1.1-1.7

## Goal

Establish runnable backend and builder foundations so MVP 1 work can start on
top of a stable monorepo baseline.

## Plan

- [x] Create FastAPI service with a health endpoint
- [x] Create Vite + React builder app on port 3000
- [x] Add `/api` proxy from builder to backend
- [x] Add docker compose to start both services
- [x] Validate checks and update DoD statuses
- [ ] Commit the round

## Do

- Bootstrapped backend app and dependencies under `apps/backend`.
- Bootstrapped builder app and Vite config under `apps/builder`.
- Added docker compose orchestration for local startup.
- Added `.venv` ignore patterns to avoid committing local Python virtual envs.
- Ran backend route and builder runtime checks; verified `/api` proxy configuration.

## Check

- [x] `/health` returns `{\"status\":\"ok\"}`
- [x] Builder serves hello world at `localhost:3000`
- [x] Vite proxy for `/api` targets backend on `localhost:8000`
- [ ] `docker-compose.yml` starts both services _(blocked in this environment: Docker daemon unavailable)_

## Act

**Learnings**:

- The builder currently builds with a Node version warning (`20.18.0`), but the
  build still succeeds. Upgrading to Node `20.19+` is recommended.
- Compose file is valid (`docker compose config`), but runtime verification
  requires a host with a running Docker daemon.
