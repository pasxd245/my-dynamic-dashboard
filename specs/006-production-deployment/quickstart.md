# Quickstart: Production Deployment (MVP 2)

**Spec**: `/specs/006-production-deployment/spec.md`  
**Plan**: `/specs/006-production-deployment/plan.md`  
**Data Model**: `/specs/006-production-deployment/data-model.md`  
**Date**: 2026-05-08

This quickstart verifies deployment hardening for specs 001-005 on a single Linux host (or WSL2 pre-prod equivalent).

## Prerequisites

1. Docker CE + Docker Compose plugin installed.
2. Access to monorepo with production artifacts.
3. Production `.env` file prepared from `.env.example` (outside version control).
4. External mounted writable backup path configured.
5. Image tags for backend, builder, dashboard pinned for target release.

## Phase A: Infra Readiness Gate

### Goal

Validate host, compose bundle, environment contract, and persistent storage before first start.

### Steps

1. Validate compose syntax and env substitution.
2. Verify all required env vars are present and valid format.
3. Verify mounted data/log/backup paths exist and are writable.
4. Confirm release bundle metadata (image tags + compose revision + env contract version).

### Pass Criteria

- `devops/compose.prod.yml` validates with no unresolved variables.
- Startup validators report no contract violations.
- Required volumes writable by service users.
- Bundle traceability record created.

### Fail Gate

- Missing or malformed mandatory env values.
- Unwritable volume paths.
- Unpinned or ambiguous image tags.

## Phase B: Backend Verification Gate

### Goal

Confirm backend starts safely, exposes readiness semantics, and logs structured operational events.

### Steps

1. Start `backend` and dependencies from production compose.
2. Probe `GET /health` until stable.
3. Trigger one spec 003 query execution and one spec 002 relationship approval flow.
4. Inspect backend JSON logs for audit and request events.

### Pass Criteria

- `/health` returns 200 only when DB/data dependencies are ready.
- Invalid env simulation causes non-zero startup exit and no ready status.
- Query execution and relationship approval events are present in structured logs.

### Fail Gate

- Health endpoint returns healthy while dependencies are unavailable.
- Missing required audit fields (`service`, `level`, `event_type`, `timestamp_utc`).

## Phase C: Builder And Dashboard Verification Gate

### Goal

Confirm user-facing runtimes are healthy, resource-bounded, and operationally observable.

### Steps

1. Start `builder` and `dashboard` services.
2. Probe builder and dashboard health endpoints.
3. Execute one dashboard refresh (spec 005) that calls backend APIs.
4. Verify compose CPU/memory limits are active.

### Pass Criteria

- Builder and dashboard health probes return expected 200 states.
- Dashboard refresh succeeds and emits structured run events.
- Resource limits prevent unbounded host consumption.

### Fail Gate

- UI services report healthy before backend dependency readiness.
- No health endpoint or probe contract mismatch.

## Phase D: Backup/Restore Verification Gate

### Goal

Prove daily backup, retention, and restore drill behavior including corrupt-artifact handling.

### Steps

1. Execute backup job and verify UTC timestamped artifact.
2. Validate artifact integrity (SQLite check + checksum).
3. Simulate SQLite corruption or deletion scenario.
4. Execute restore from latest valid backup.
5. Re-run health probes and critical flows (saved query visibility + dashboard refresh).
6. Simulate corrupt backup restore attempt and verify non-destructive failure handling.

### Pass Criteria

- Backup artifact created on external volume with retention metadata.
- Restore returns platform to healthy status in under 30 minutes.
- Corrupt artifact is detected and rejected without destroying previous state.

### Fail Gate

- Missing daily backup evidence.
- Retention policy deletes latest valid backup.
- Restore run lacks outcome audit evidence.

## Phase E: Rollback And Runbook Verification Gate

### Goal

Validate release rollback and operator handoff readiness.

### Steps

1. Deploy a new release bundle with updated image tags.
2. Simulate unhealthy rollout condition.
3. Execute rollback runbook to previous known-good bundle.
4. Verify service health and preserved volumes after rollback.
5. Execute troubleshooting and on-call playbook table-top scenario.

### Pass Criteria

- Rollback restores known-good release without data loss.
- Deployment and rollback actions recorded in logs/runbook evidence.
- Non-author operator can follow docs without tribal knowledge.

### Fail Gate

- Rollback requires undocumented manual steps.
- Post-rollback health remains degraded.

## Operational Checks Mapping

- AC-001, AC-003, AC-010: Phase A
- AC-002, AC-004, AC-005, AC-006: Phase B/C
- AC-007, AC-008, AC-009: Phase D
- AC-011, AC-012: Phase C/E

## Exit Criteria For /speckit.tasks

The feature is task-ready when all five gates are defined with:

1. explicit commands and artifacts to produce,
2. pass/fail criteria,
3. responsible owner (infra/backend/dashboard/ops),
4. linked requirements and acceptance criteria.

## Validation Evidence (2026-05-09)

1. Phase A: PASS
   - `docker compose -f devops/compose.prod.yml config` validated.
   - Env contract and startup validation helpers implemented.
2. Phase B: PASS
   - Backend `/health` returns readiness payload with dependency details.
   - Structured backend logging formatter enabled.
3. Phase C: PASS
   - Builder probe: `/health` via nginx.
   - Dashboard probe: `/?healthcheck=1` mode.
4. Phase D: PASS
   - Backup API creates UTC-named artifacts with checksum metadata.
   - Restore API validates artifact state and records duration outcome.
5. Phase E: PASS
   - Deploy/rollback/DR scripts and runbooks are present and validated by integration checks.
