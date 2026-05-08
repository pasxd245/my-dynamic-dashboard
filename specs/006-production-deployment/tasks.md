# Tasks: Production Deployment (Spec 006)

**Input**: design documents from `/specs/006-production-deployment/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/production-deployment.openapi.yaml

Tests: Included per user story (contract + integration + operational checks) and ordered before implementation tasks.
Organization: Tasks are grouped by user story so each story is independently implementable and testable.

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare deployment scaffolding, ops scripts, and verification test modules.

- [ ] T001 Create production compose scaffold in docker-compose.prod.yml
- [ ] T002 [P] Create production environment contract scaffold in .env.example
- [ ] T003 [P] Create backup and restore script scaffolds in scripts/ops/backup.sh and scripts/ops/restore.sh
- [ ] T004 [P] Create DR drill script scaffold in scripts/ops/dr-drill.sh
- [ ] T005 [P] Add production deployment contract test scaffold in apps/backend/tests/contract/test_production_deployment_contract.py
- [ ] T006 [P] Add production operational integration test scaffolds in apps/backend/tests/integration/test_production_stack_health.py and apps/backend/tests/integration/test_backup_restore_flow.py
- [ ] T007 [P] Create operations documentation scaffolds in docs/operations/deployment-guide.md, docs/operations/rollback-runbook.md, docs/operations/troubleshooting-runbook.md, and docs/operations/oncall-playbook.md

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Implement shared deployment primitives required by all user stories.

CRITICAL: Complete this phase before user story implementation.

- [ ] T008 Add deployment environment model and required-field validators in apps/backend/app/core/config.py
- [ ] T009 [P] Add production startup validation entrypoint helper in apps/backend/app/core/startup_validation.py
- [ ] T010 [P] Add deployment metadata and backup tables initialization in apps/backend/app/core/metadata_db.py
- [ ] T011 [P] Add shared deployment DTOs (health snapshot, deployment bundle, backup artifact, restore run) in apps/backend/app/schemas.py
- [ ] T012 Implement shared operational error mapping (400/404/409/503) and response helpers in apps/backend/app/main.py
- [ ] T013 [P] Add structured JSON logging formatter and logger wiring for backend runtime in apps/backend/app/core/logging.py
- [ ] T014 [P] Add dashboard structured logging helpers and logger bootstrap in apps/dashboard/app_logging.py
- [ ] T015 Implement startup boot sequence wiring to fail fast on invalid environment in apps/backend/app/main.py and apps/dashboard/streamlit_app.py
- [ ] T016 [P] Add foundational metadata schema verification assertions for deployment tables in apps/backend/tests/integration/test_metadata_schema.py
- [ ] T017 [P] Extend API schema smoke coverage for production deployment contract surface in apps/backend/tests/contract/test_schema_contract_smoke.py

Checkpoint: Foundation complete; user stories can proceed.

---

## Phase 3: User Story 1 - Deploy Full Stack And Keep It Running (Priority: P1) MVP

Goal: Deploy backend, builder, dashboard, and support services on a single Linux host with restart safety and persistent volumes.
Independent Test: Bring up production compose on a clean host, reboot host, and verify all required services return healthy automatically.

### Tests for User Story 1

- [ ] T018 [P] [US1] Add contract test for GET /health readiness/liveness response shape in apps/backend/tests/contract/test_production_deployment_contract.py
- [ ] T019 [P] [US1] Add integration test for production compose service startup order and health convergence in apps/backend/tests/integration/test_production_stack_health.py
- [ ] T020 [P] [US1] Add integration test for container restart-policy behavior after forced process exit in apps/backend/tests/integration/test_production_stack_health.py
- [ ] T021 [P] [US1] Add integration test for post-reboot auto-recovery checklist using compose state assertions in apps/backend/tests/integration/test_production_stack_health.py

### Implementation for User Story 1

- [ ] T022 [US1] Harden backend production image with deterministic dependency layers and runtime command in apps/backend/Dockerfile
- [ ] T023 [US1] Harden builder production image with multi-stage asset build and runtime health probe path in apps/builder/Dockerfile
- [ ] T024 [US1] Harden dashboard production image with pinned dependencies and startup command in apps/dashboard/Dockerfile
- [ ] T025 [US1] Implement production stack topology (backend, builder, dashboard, backup, optional proxy) with dependency conditions in docker-compose.prod.yml
- [ ] T026 [US1] Add restart policies, named volumes, and resource limits for all production services in docker-compose.prod.yml
- [ ] T027 [US1] Add backend /health readiness/liveness endpoint wiring with dependency checks in apps/backend/app/main.py
- [ ] T028 [US1] Add builder HTTP health probe route/configuration in apps/builder/nginx.conf and docker-compose.prod.yml
- [ ] T029 [US1] Add dashboard HTTP health probe route/configuration in apps/dashboard/streamlit_app.py and docker-compose.prod.yml

Checkpoint: US1 is independently functional and satisfies single-host deployment viability.

---

## Phase 4: User Story 2 - Observe Health, Errors, And Audit Events (Priority: P1)

Goal: Provide machine-readable health status and structured operational/business audit logs for incident triage.
Independent Test: Trigger dashboard refresh, query execution, and relationship approval; confirm health endpoints and structured logs capture each event with required fields.

### Tests for User Story 2

- [ ] T030 [P] [US2] Add contract tests for ops endpoints GET /api/v1/ops/deployments/current and POST /api/v1/ops/deployments in apps/backend/tests/contract/test_production_deployment_contract.py
- [ ] T031 [P] [US2] Add integration test for backend structured JSON logging fields and severity filtering in apps/backend/tests/integration/test_production_stack_health.py
- [ ] T032 [P] [US2] Add integration test for dashboard and builder health probes distinguishing started vs ready states in apps/backend/tests/integration/test_production_stack_health.py
- [ ] T033 [P] [US2] Add integration test for audit event emission for query runs and relationship approvals in apps/backend/tests/integration/test_production_stack_health.py

### Implementation for User Story 2

- [ ] T034 [US2] Implement deployment metadata read/write service for current release bundle in apps/backend/app/services/deployment_service.py
- [ ] T035 [US2] Implement ops endpoints for deployment metadata and event recording in apps/backend/app/main.py
- [ ] T036 [US2] Implement audit event emitter for deployment, rollback, backup, restore, query, dashboard, and relationship actions in apps/backend/app/services/audit_service.py
- [ ] T037 [US2] Wire request-scoped correlation IDs and JSON log context enrichment in apps/backend/app/main.py and apps/backend/app/core/logging.py
- [ ] T038 [US2] Add dashboard structured event logging for refresh outcomes and backend connectivity errors in apps/dashboard/streamlit_app.py
- [ ] T039 [US2] Add log rotation and bounded retention policy for local service logs in docker-compose.prod.yml and scripts/ops/logrotate-production.conf

Checkpoint: US2 is independently functional and provides observable health + auditability.

---

## Phase 5: User Story 3 - Recover Quickly With Backups And Restore (Priority: P1)

Goal: Deliver automated daily backups, safe retention, integrity validation, and repeatable restore under 30 minutes.
Independent Test: Run backup, simulate SQLite loss/corruption, restore from latest valid artifact, and validate core flows within RTO.

### Tests for User Story 3

- [ ] T040 [P] [US3] Add contract tests for GET /api/v1/ops/backups, POST /api/v1/ops/backups/run, and POST /api/v1/ops/restore in apps/backend/tests/contract/test_production_deployment_contract.py
- [ ] T041 [P] [US3] Add integration test for UTC backup artifact naming and integrity metadata creation in apps/backend/tests/integration/test_backup_restore_flow.py
- [ ] T042 [P] [US3] Add integration test for 30-day retention pruning that preserves latest valid backup in apps/backend/tests/integration/test_backup_restore_flow.py
- [ ] T043 [P] [US3] Add integration test for restore-from-latest-valid flow recovering service health in apps/backend/tests/integration/test_backup_restore_flow.py
- [ ] T044 [P] [US3] Add integration test for corrupt backup detection and non-destructive restore failure handling in apps/backend/tests/integration/test_backup_restore_flow.py

### Implementation for User Story 3

- [ ] T045 [US3] Implement backup runner script with UTC naming, sqlite integrity check, checksum generation, and status logging in scripts/ops/backup.sh
- [ ] T046 [US3] Implement retention cleanup logic with latest-valid protection in scripts/ops/backup.sh
- [ ] T047 [US3] Implement restore runner script with pre-restore validation, quarantine of invalid artifacts, and rollback-safe replacement in scripts/ops/restore.sh
- [ ] T048 [US3] Add backup service container scheduling and mounted external backup volume configuration in docker-compose.prod.yml
- [ ] T049 [US3] Implement backend backup/restore metadata persistence and API orchestration in apps/backend/app/services/backup_service.py and apps/backend/app/main.py
- [ ] T050 [US3] Add restore outcome and duration tracking with RTO assertion logging in apps/backend/app/services/backup_service.py

Checkpoint: US3 is independently functional and meets recoverability requirements.

---

## Phase 6: User Story 4 - Roll Forward, Roll Back, And Hand Off Operations (Priority: P2)

Goal: Enable safe release upgrades, rapid rollback to known-good bundle, and non-author operator handoff.
Independent Test: Execute upgrade, simulate unhealthy release, roll back with runbook-only steps, and confirm prior version returns healthy with preserved data.

### Tests for User Story 4

- [ ] T051 [P] [US4] Add integration test for deployment bundle registration and release-version traceability in apps/backend/tests/integration/test_production_stack_health.py
- [ ] T052 [P] [US4] Add integration test for rollback execution path restoring known-good images and compose revision in apps/backend/tests/integration/test_backup_restore_flow.py
- [ ] T053 [P] [US4] Add DR drill integration test for end-to-end failover checklist timing and evidence capture in apps/backend/tests/integration/test_backup_restore_flow.py

### Implementation for User Story 4

- [ ] T054 [US4] Implement release deployment script with image pin validation and deployment event emission in scripts/ops/deploy-release.sh
- [ ] T055 [US4] Implement rollback script preserving data and backup artifacts while restoring previous bundle in scripts/ops/rollback-release.sh
- [ ] T056 [US4] Implement DR drill script to automate backup-restore-rollback tabletop evidence collection in scripts/ops/dr-drill.sh
- [ ] T057 [US4] Write deployment guide covering Linux/WSL2 prerequisites, first-time setup, upgrade flow, and validation gates in docs/operations/deployment-guide.md
- [ ] T058 [US4] Write rollback runbook with unhealthy release triage, rollback steps, and post-rollback verification in docs/operations/rollback-runbook.md
- [ ] T059 [US4] Write troubleshooting runbook for health degradation, startup loops, log inspection, and disk-pressure incidents in docs/operations/troubleshooting-runbook.md
- [ ] T060 [US4] Write on-call playbook with escalation matrix, severity levels, and evidence checklist in docs/operations/oncall-playbook.md

Checkpoint: US4 is independently functional and operational handoff is complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

Purpose: Final hardening, end-to-end validation, and documentation alignment.

- [ ] T061 [P] Add end-to-end production readiness regression test suite entrypoint in apps/backend/tests/integration/test_production_readiness_e2e.py
- [ ] T062 Run quickstart validation walkthrough and capture pass/fail evidence updates in specs/006-production-deployment/quickstart.md
- [ ] T063 [P] Add operations command reference and incident evidence checklist to README.md
- [ ] T064 [P] Add compose and env lint checks for production artifacts in scripts/ops/validate-production-config.sh and package.json
- [ ] T065 Validate contract/spec/task traceability mapping for FR-001..FR-027 in specs/006-production-deployment/plan.md and specs/006-production-deployment/tasks.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies.
- Foundational (Phase 2): Depends on Setup; blocks all user story work.
- User Story phases (Phase 3-6): Depend on Phase 2; execute in priority order P1 (US1-US3) then P2 (US4).
- Polish (Phase 7): Depends on completion of target user stories.

### User Story Dependencies

- US1: Can begin after Phase 2.
- US2: Depends on US1 health probes and runtime topology.
- US3: Depends on US1 deployment topology and US2 audit/logging baseline.
- US4: Depends on US1-US3 release metadata, backup/restore, and observability evidence.

### Within-Story Ordering Rules

- Tests/checks first.
- Infrastructure/runtime changes before API wiring.
- API wiring before scripts and runbook integration.
- Tasks marked [P] are parallelizable when no incomplete dependency exists.

---

## Parallel Execution Opportunities

### User Story 1 (US1)

```bash
# Tests in parallel:
T018, T019, T020, T021

# Service image hardening in parallel:
T022, T023, T024
```

### User Story 2 (US2)

```bash
# Observability tests in parallel:
T030, T031, T032, T033

# Logging + audit implementations in parallel after service scaffolding:
T036, T037, T038, T039
```

### User Story 3 (US3)

```bash
# Backup/restore tests in parallel:
T040, T041, T042, T043, T044

# Ops scripting split in parallel:
T045, T046, T047
```

### User Story 4 (US4)

```bash
# Roll-forward/rollback/DR checks in parallel:
T051, T052, T053

# Runbook docs in parallel:
T057, T058, T059, T060
```

---

## Implementation Strategy

### MVP First (P1 Stories)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1: deploy + auto-recovery).
4. Complete Phase 4 (US2: health + logs + audit).
5. Complete Phase 5 (US3: backup + restore).
6. Validate quickstart gates A-D before moving to P2.

### Incremental Delivery

1. Deliver US1 as first deployable production baseline.
2. Add US2 observability to make incidents diagnosable.
3. Add US3 recoverability to satisfy RTO/retention obligations.
4. Add US4 runbook-driven release/rollback handoff.
5. Finish with Phase 7 polish and readiness regression.

### Task Count Summary

- Total tasks: 65
- Setup: 7
- Foundational: 10
- US1: 12
- US2: 10
- US3: 11
- US4: 10
- Polish: 5

Ready for implementation: Yes (phases, dependencies, independent test criteria, and parallelization are fully specified).
