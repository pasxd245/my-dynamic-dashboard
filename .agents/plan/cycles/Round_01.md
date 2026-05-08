# Round 01: Project Scaffolding

**Status**: Planning
**Date started**:
**Date completed**:
**MVP**: 1
**DoD tasks**: 1.1–1.7

## Goal

Bootstrap the monorepo so both backend and builder run locally with a
single command. This is the foundation everything else builds on.

## Plan

- [ ] Initialise pnpm workspace with `apps/backend` and `apps/builder`
- [ ] Create FastAPI skeleton with `/health` endpoint and CORS middleware
- [ ] Create React + Vite + TanStack Router skeleton rendering a hello page
- [ ] Configure Vite proxy so `/api` routes hit `localhost:8000`
- [ ] Write `docker-compose.yml` that starts both services
- [ ] Ensure `.gitignore` covers `data/`, `node_modules/`, `venv/`, `__pycache__/`
- [ ] Verify everything boots with `pnpm dev` / `docker compose up`

## Do

_Progress log — update as work proceeds._

## Check

- [ ] `curl localhost:8000/health` returns `{"status":"ok"}`
- [ ] `localhost:3000` renders the builder hello page
- [ ] `/api/v1/health` proxied from builder to backend
- [ ] `docker compose up` starts both without errors
- [ ] User confirms project boots cleanly

## Act

## **Learnings**

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
