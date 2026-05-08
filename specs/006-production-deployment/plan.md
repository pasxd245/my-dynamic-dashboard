# Implementation Plan: Production Deployment (MVP 2)

**Branch**: `002-relationship-rules` | **Date**: 2026-05-08 | **Spec**: `/specs/006-production-deployment/spec.md`
**Input**: Feature specification from `/specs/006-production-deployment/spec.md`

## Summary

Harden the existing MVP 2 stack (specs 001-005) for single-host production using deterministic Docker images, production compose topology, strict env/startup validation, structured logging and health probes, backup/restore with retention, disaster-recovery procedures, and operator runbooks. The implementation explicitly avoids product behavior changes beyond operational safety, observability, and recoverability.

## Technical Context

**Language/Version**: Python 3.12 (backend + dashboard runtime), JavaScript/TypeScript (builder build pipeline), YAML/Bash for ops artifacts  
**Primary Dependencies**: FastAPI, Streamlit, Docker CE, Docker Compose, existing monorepo tooling (`pnpm`, `pytest`)  
**Storage**: SQLite metadata DB + Parquet data + persistent volume mounts for runtime logs and backups  
**Testing**: `pytest` contract/integration tests, compose validation, health-probe checks, backup/restore drills, release rollback drill  
**Target Platform**: Single Linux host with Docker CE (WSL2 supported for pre-prod validation)  
**Project Type**: Web application deployment hardening (infra + backend + dashboard + operations docs)  
**Performance Goals**: Meet SC-001 deploy in <60 minutes, SC-003 restore in <30 minutes, SC-005 incident evidence in <5 minutes  
**Constraints**: No Kubernetes/multi-host HA, no managed DB migration, no external log/SIEM platform, no behavior changes outside specs 001-005 dependencies  
**Scale/Scope**: One production host, one operator handoff path, daily backups with 30-day retention

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. Principle I (Business-question-first): PASS. Spec states decision: move from developer-operated prototype to reliable always-on service.
2. Principle II (Metric contract before visualization): PASS. Deployment feature does not introduce new metrics/visual semantics.
3. Principle III (Relationship rule before cross-table query): PASS. Relationship behavior remains governed by spec 002 and only operationally hardened.
4. Principle IV (Reconciliation before recommendation): PASS. No recommendation logic added.
5. Principle V (Challenge/sensitivity before decision-ready): PASS. No challenge posture change; only runtime reliability.
6. Principle VI (Traceability for every claim): PASS WITH REQUIREMENT. Deployment must emit structured operational and business audit events.
7. Principle VII (Reproducibility from raw inputs): PASS WITH REQUIREMENT. Deployment bundle must tie image tags + compose revision + env contract + backup set.

Post-Phase 1 re-check:

- PASS. `research.md`, `data-model.md`, `quickstart.md`, and `contracts/production-deployment.openapi.yaml` preserve deployment-only scope, include traceability/reproducibility controls, and retain dependency boundaries with specs 001-005.

## Project Structure

### Documentation (this feature)

```text
specs/006-production-deployment/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── production-deployment.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── backend/
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── metadata_db.py
│   │   └── services/
│   └── tests/
│       ├── contract/
│       └── integration/
├── builder/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
└── dashboard/
    ├── Dockerfile
    └── streamlit_app.py

docker-compose.yml
docker-compose.prod.yml                 # planned

docs/
└── operations/                         # planned runbooks
    ├── deployment-guide.md
    ├── rollback-runbook.md
    ├── troubleshooting-runbook.md
    └── oncall-playbook.md

specs/001-upload-profile-field-roles/
specs/002-relationship-rules/
specs/003-query-builder-execution/
specs/004-saved-queries/
specs/005-dashboard-visualizations/
```

**Structure Decision**: Keep the existing monorepo service boundaries and add production deployment artifacts at the repo root (`docker-compose.prod.yml`, env contract), service-level runtime updates inside `apps/backend`, `apps/builder`, and `apps/dashboard`, plus operator documentation under `docs/operations/`.

## Phase 0: Research (Completed)

Resolved in `research.md`:

1. Docker image strategy and deterministic layering.
2. Production compose topology and restart/resource policies.
3. Env contract and fail-fast startup validation.
4. Structured logging schema and audit event coverage.
5. Health endpoint semantics and probe cadence.
6. Backup/restore/retention and corrupt artifact handling.
7. Disaster recovery and runbook coverage.
8. Dependency-preserving scope for specs 001-005.

## Phase 1: Design And Contracts (Completed)

1. `data-model.md`: deployment-domain entities (`DeploymentBundle`, `HealthCheckSnapshot`, `BackupArtifact`, `RestoreRun`, `OperationalRunbook`, etc.) and relationships.
2. `contracts/production-deployment.openapi.yaml`: operational API contract for health, deployment metadata, backup, and restore.
3. `quickstart.md`: execution-ready verification flow with explicit infra/backend/dashboard/backup/rollback gates.
4. Agent context updated in `.github/copilot-instructions.md` to point to this plan.

## Phase 2: Implementation Plan (Execution-Ready)

### Track 1: Infra And Image Hardening

1. Create/adjust production Dockerfiles for backend, builder, dashboard to satisfy FR-001 through FR-004.
2. Add `docker-compose.prod.yml` with service topology, persistent volumes, health checks, restart policies, limits (FR-005, FR-006, FR-025, FR-026).
3. Add traceable deployment metadata process (bundle ID, compose revision, image tags, env version) (FR-029).

**Gate A (Infra Ready)**

- Compose validates with pinned image tags and required mounts.
- Service definitions include restart/resource/health for all required containers.

### Track 2: Backend Operational Hardening

1. Implement startup env validation and fail-fast behavior in backend config/bootstrap (FR-007 through FR-009).
2. Ensure `/health` liveness/readiness semantics include dependency checks and version identity (FR-010, FR-012, FR-013).
3. Standardize structured JSON logs and audit events for query runs/relationship approvals/deployment events/backup/restore (FR-014 through FR-017, FR-016).
4. Define explicit worker-count and SQLite concurrency strategy via env + runtime config (FR-023, FR-024).

**Gate B (Backend Ready)**

- Invalid config prevents readiness.
- Health endpoint correctly reports 200 vs 503 based on dependency readiness.
- Required audit events are queryable from local evidence.

### Track 3: Builder And Dashboard Production Runtime

1. Ensure builder runtime serves compiled assets with health probe endpoint (FR-011).
2. Ensure dashboard runtime has health probe endpoint and backend-target validation (FR-011, FR-012).
3. Add/verify resource protections and startup ordering with backend readiness dependency.

**Gate C (UI Runtime Ready)**

- Builder and dashboard health probes stable in compose startup/restart scenarios.
- Dashboard refresh and saved-query flows (specs 004-005) remain functional without semantic change (FR-030).

### Track 4: Backup, Restore, And DR Automation

1. Implement scheduled backup runner in compose stack, UTC artifact naming, integrity validation, 30-day retention with latest-valid protection (FR-018, FR-019).
2. Implement/standardize restore workflow with pre-restore validation and non-destructive corrupt artifact handling (FR-020).
3. Add rollback-safe release handling preserving backups and volumes (FR-021).

**Gate D (Recovery Ready)**

- Daily backup evidence exists and retention logic is safe.
- Restore drill completes under 30 minutes with critical flow validation.
- Corrupt backup attempt fails safely with forensic preservation.

### Track 5: Operations Documentation And Handoff

1. Publish deployment guide (Linux + WSL2 validation), upgrade flow, rollback flow, backup verification, and incident triage (FR-022).
2. Publish troubleshooting runbook and on-call playbook with alert thresholds/triggers (FR-028).
3. Map operator checks for health, restarts, backup freshness, disk pressure, and error spikes (FR-027).

**Gate E (Ops Handoff Ready)**

- Non-author operator can deploy, diagnose, recover, and roll back using docs only (AC-012).
- Operational triggers and escalation paths are explicit and testable.

## Requirement Traceability (Plan-Level)

- FR-001 to FR-006: Track 1
- FR-007 to FR-013: Track 2 and Track 3
- FR-014 to FR-017: Track 2
- FR-018 to FR-021: Track 4
- FR-022, FR-027, FR-028: Track 5
- FR-023, FR-024: Track 2
- FR-025, FR-026: Track 1 and Track 3
- FR-029: Track 1
- FR-030: Gate enforcement across Track 2/3 verification against specs 001-005 behavior

## Verification Matrix (Infra/Backend/Dashboard)

1. Infra verification: compose validation, restart policies, resource limits, volume persistence.
2. Backend verification: startup validation failure posture, `/health` readiness semantics, structured audit events.
3. Dashboard verification: builder/dashboard probes, refresh flow continuity, dependency ordering.
4. Recovery verification: backup success/failure signals, restore drill, rollback drill.
5. Ops verification: runbook-only execution by secondary operator.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
