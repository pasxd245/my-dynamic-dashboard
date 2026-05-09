# Research: Production Deployment (MVP 2)

**Spec**: `/specs/006-production-deployment/spec.md`  
**Plan**: `/specs/006-production-deployment/plan.md`  
**Date**: 2026-05-08

This research resolves Phase 0 technical unknowns for single-host production deployment, with scope limited to deployment hardening of specs 001-005 behavior.

## 1. Docker Image And Build Strategy

### Decision

Use per-service production Dockerfiles with deterministic layering and pinned base/runtime dependencies:

- Backend image: `python:3.12-slim`, multi-layer install from pinned `requirements.txt`, non-root runtime user.
- Dashboard image: `python:3.12-slim`, dedicated requirements layer for Streamlit app, non-root runtime user.
- Builder image: multi-stage (`node` build stage + lightweight static server runtime stage), immutable compiled assets.

### Rationale

- Aligns directly with FR-001 through FR-004 and base-image constraint FR-002.
- Layer separation keeps rebuilds fast and reproducible.
- Non-root runtime improves safety with minimal complexity.

### Alternatives Considered

- Single monolithic image for all services: rejected due to poor isolation and larger blast radius.
- Distroless-only runtime images in MVP 2: rejected for operational debugging friction.
- Runtime asset build for builder: rejected due to startup time and non-deterministic runtime dependency resolution.

## 2. Production Compose Topology

### Decision

Use `devops/compose.prod.yml` as the canonical single-host stack with services:

- `backend` (FastAPI)
- `builder` (compiled static UI service)
- `dashboard` (Streamlit)
- `backup` (scheduled backup/retention runner)
- `proxy` optional but supported for unified ingress

All long-running services define:

- `restart: unless-stopped`
- explicit CPU/memory limits
- named volumes for data/logs/backups
- health checks with startup and steady-state cadence
- dependency gating (`depends_on` with health conditions where supported)

### Rationale

- Satisfies FR-005, FR-006, FR-025, FR-026.
- Matches single Linux host scope while preserving clear operational boundaries.

### Alternatives Considered

- Host cron for backup outside compose: rejected as default because it splits operational ownership.
- `restart: always`: rejected to preserve operator stop intent during incident handling.

## 3. Environment Contract And Startup Validation

### Decision

Centralize production configuration in a checked-in `.env.example` contract and runtime `.env` injection via compose, with strict startup validators in backend and dashboard entrypoints.

Validation checks:

- required variables present
- integer ports and worker counts valid
- writable paths for data/log outputs
- backup retention positive integer
- log level in `{DEBUG, INFO, WARN, ERROR}`
- backend/dashboard URL consistency

Validation failure logs structured `ERROR` and exits non-zero before readiness.

### Rationale

- Meets FR-007 through FR-009 and AC-003.
- Prevents restart loops caused by silent config drift.

### Alternatives Considered

- Best-effort startup with warnings: rejected; violates fail-fast requirement.
- Hardcoded defaults for missing secrets: rejected for security and traceability reasons.

## 4. Structured Logging And Audit Preservation

### Decision

Standardize JSON logs across backend and dashboard with shared fields:

- `timestamp_utc`
- `service`
- `level`
- `event_type`
- `message`
- `request_id`/`run_id` where available
- domain IDs (`workspace_id`, `query_id`, `dashboard_id`, `relationship_id`) when relevant

Implement local log rotation with bounded retention and size limits.

Audit-critical events from specs 001-005 plus deployment/backup/restore actions are emitted as structured events and remain recoverable through SQLite restore + retained logs.

### Rationale

- Satisfies FR-014 through FR-017 and FR-016 dependencies across specs 001-005.
- Enables incident diagnosis without external log platforms.

### Alternatives Considered

- Plain text logs with grep parsing: rejected for inconsistent machine readability.
- External ELK/OpenSearch stack in MVP 2: rejected as out of scope.

## 5. Health Check Model

### Decision

Expose service-specific HTTP probe endpoints:

- Backend: `/health` (liveness + readiness details, 200/503)
- Builder: `/health` (serving readiness)
- Dashboard: `/health` (process + backend target config readiness)

Probe policy:

- startup: frequent checks (e.g., 10-15s)
- steady state: at least every 5 minutes
- non-ready dependencies return 503

### Rationale

- Meets FR-010 through FR-013 and AC-002/AC-004.
- Distinguishes started vs usable service state.

### Alternatives Considered

- TCP-only checks: rejected because they do not verify dependency readiness.
- Single global orchestrator check endpoint: rejected; per-service signals are required for triage.

## 6. Backup, Restore, And Retention

### Decision

Implement compose-managed daily backup runner for SQLite metadata with:

- UTC timestamped artifact naming
- integrity check before marking success
- 30-day retention with latest-valid-backup protection
- explicit failure logging and non-destructive behavior

Restore runbook enforces:

1. isolate/stop impacted services
2. validate selected artifact
3. preserve current broken DB snapshot
4. restore validated artifact
5. restart stack and verify critical flows
6. record restore event and outcome

### Rationale

- Meets FR-018 through FR-021 and AC-007 through AC-009.
- Supports stated RTO target under 30 minutes.

### Alternatives Considered

- Filesystem-only snapshot without SQLite integrity validation: rejected due to corrupt backup risk.
- Backup retention by simple `find -mtime`: rejected unless guarded by latest-valid preservation.

## 7. Disaster Recovery And Operations Runbooks

### Decision

Publish four operator documents for MVP 2:

- deployment guide
- rollback runbook
- troubleshooting runbook
- on-call playbook

Include concrete trigger thresholds for restarts, failed backups, health degradation, disk pressure, and sustained errors.

### Rationale

- Meets FR-022, FR-028, AC-012.
- Enables safe handoff to non-author operators.

### Alternatives Considered

- Lightweight README-only ops notes: rejected because it does not provide incident-grade decision flow.

## 8. Cross-Spec Dependency Preservation (001-005)

### Decision

Deployment feature may add observability and operational controls only; it does not alter business semantics of upload, relationship governance, query execution, saved query versioning, or dashboard logic.

### Rationale

- Satisfies FR-030 and constitution principles around traceability/reproducibility.

### Alternatives Considered

- Opportunistic behavior refactors during deployment hardening: rejected to avoid cross-feature regressions.

## 9. Concurrency And Worker Strategy For SQLite

### Decision

Backend runs explicit worker count from env (default conservative), with SQLite connection strategy tuned for single-host FastAPI workload:

- bounded worker count documented by host-size profile
- DB pragmas and timeout settings defined centrally
- startup check verifies DB lock/write path viability

### Rationale

- Meets FR-023 and FR-024 while avoiding over-aggressive parallelism on SQLite.

### Alternatives Considered

- Auto worker count from CPU cores without cap: rejected due to lock contention risk.
- Deferring worker strategy to runtime defaults: rejected by FR-024.

## Final Research Outcome

All planning unknowns are resolved for Phase 1 design. The selected approach remains within single-host Docker CE scope and maintains compatibility with specs 001-005.
