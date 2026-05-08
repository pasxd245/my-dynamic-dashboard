# Feature Specification: Production Deployment (MVP 2)

**Feature Branch**: `006-production-deployment`
**Created**: 2026-05-08
**Status**: Draft
**Input**: MVP 2 deployment requirement from `docs/analysis/09-mvp-plan.md`
and user description above.

## Business Question _(mandatory for this project)_

> "Given the MVP 2 system we have built, can we deploy it on a single
> Linux server so that colleagues can rely on it 24/7, recover it within
> 30 minutes after a failure, and audit what happened without needing
> manual babysitting from the developer who built it?"

**Decision consumed**: Whether the system is ready to move from a
developer-operated prototype into an always-on operational service for
weekly and recurring business reporting.

**Primary roles**: DevOps engineer (deploys, monitors, backs up, and
restores the system), technical PM / maintainer (owns configuration and
release rollout), analyst (depends on uptime and auditability for saved
queries and dashboards).

**Constitution alignment**:

- **Principle I (Business-Question-First)**: Deployment exists to support a
  concrete operational decision: whether the system can be trusted as an
  always-on reporting service rather than a developer-only tool.
- **Principle VI (Traceability For Every Claim)**: Operational claims such as
  "service healthy", "query executed", "relationship approved", and
  "backup completed" must be inspectable through structured logs, health
  responses, and deployment records.
- **Principle VII (Reproducibility From Raw Inputs)**: The production stack
  must be reproducible from versioned images, compose configuration,
  environment files, database backups, and restore documentation.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Deploy the full stack and keep it running automatically (Priority: P1)

A DevOps engineer deploys the backend, builder, and dashboard services to a
single Linux host using production Docker artifacts, starts the stack once,
and relies on health checks plus restart policies to keep it running without
manual intervention after routine process failures or host reboots.

**Why this priority**: If the stack cannot be started reproducibly and kept
alive automatically, none of the MVP 2 user-facing features are usable in a
shared environment.

**Independent Test**: Provision a clean Linux host, supply the required
environment file, start the production compose stack, reboot the host, and
confirm all required services return to healthy state without manual steps.

**Acceptance Scenarios**:

1. **Given** a clean Linux machine with Docker CE and the production env file,
   **When** the DevOps engineer starts the production compose stack,
   **Then** the backend, builder, and dashboard services start in the required
   dependency order and expose healthy HTTP responses.
2. **Given** the stack is running, **When** one service process exits
   unexpectedly, **Then** the container platform restarts that service
   automatically and health status returns to healthy without affecting
   persisted data.
3. **Given** the host machine reboots, **When** Docker resumes managed
   services, **Then** the production stack returns to its last intended state
   with all required volumes, network bindings, and environment variables
   intact.

---

### User Story 2 — Observe system health, errors, and audit events in one place (Priority: P1)

A DevOps engineer or maintainer inspects structured local logs and service
health endpoints to understand current status, diagnose incidents, and trace
important business actions such as query executions and relationship-rule
approvals.

**Why this priority**: A production system that cannot explain its own health
or recent critical actions is not safe to operate, especially when the system
must support compliance and troubleshooting.

**Independent Test**: Trigger a normal dashboard refresh, a query execution,
and a relationship approval; then inspect service logs and health endpoints to
confirm that all three actions are visible with timestamps, severity levels,
and identifiers.

**Acceptance Scenarios**:

1. **Given** a healthy system, **When** the operator requests each health
   endpoint, **Then** the response includes service status, version identity,
   and readiness details suitable for liveness and startup checks.
2. **Given** a saved query executes successfully, **When** the operator
   inspects logs, **Then** the execution appears as a structured audit event
   with workspace, query, run identifier, outcome, and timestamp.
3. **Given** a service error occurs during startup or request handling,
   **When** the operator inspects logs, **Then** the error is emitted in
   structured JSON with severity, service name, request context when
   available, and enough detail to localize the failure.

---

### User Story 3 — Recover data and service quickly after a failure (Priority: P1)

A DevOps engineer restores the SQLite metadata database and attached runtime
state from the most recent valid backup, restarts the stack, and returns the
system to service within the agreed recovery target.

**Why this priority**: The business context explicitly requires the system to
be recoverable and auditable. Daily backups without a proven restore path do
not satisfy that requirement.

**Independent Test**: Take a running deployment, create a fresh backup,
simulate database loss or corruption, perform the documented restore
procedure, and verify the system returns to service in under 30 minutes with
saved queries, dashboards, and audit history preserved up to the last valid
backup.

**Acceptance Scenarios**:

1. **Given** the daily backup job has produced a valid artifact, **When** the
   primary SQLite file is lost or corrupted, **Then** the operator can restore
   from the latest valid backup and bring the application back to healthy
   state within 30 minutes.
2. **Given** a 30-day backup retention window, **When** the backup directory
   exceeds the retention policy, **Then** backups older than 30 days are
   removed without deleting the latest valid restore point.
3. **Given** a backup artifact is corrupt or incomplete, **When** a restore is
   attempted, **Then** the procedure detects the failure, preserves the broken
   artifact for forensics, and allows rollback to the previous valid backup.

---

### User Story 4 — Roll forward, roll back, and hand off operations safely (Priority: P2)

A maintainer deploys a new application version, validates health and logs,
rolls back quickly if the release is unhealthy, and uses the runbook plus
on-call playbook to handle predictable incidents without relying on tribal
knowledge.

**Why this priority**: The final MVP 2 feature should leave the system in a
state that another operator can run safely, not just the original builder.

**Independent Test**: Perform a documented release upgrade, verify service
health, simulate a failed release, execute the rollback procedure, and confirm
the prior version resumes service using the published runbook only.

**Acceptance Scenarios**:

1. **Given** a new image set is ready, **When** the maintainer performs the
   deployment procedure, **Then** the stack upgrades in a documented order and
   emits a deployment record that identifies the release version.
2. **Given** a deployment causes unhealthy containers or repeated startup
   failures, **When** the maintainer executes the rollback steps, **Then** the
   previous known-good version is restored with preserved data volumes and
   configuration.
3. **Given** an operator who did not author the system is on call, **When** a
   common incident occurs, **Then** the troubleshooting runbook and on-call
   playbook provide enough guidance to diagnose severity, gather evidence, and
   either recover service or escalate.

### Edge Cases

- The backend reports healthy TCP availability but cannot access the SQLite
  database or required data directories; readiness must fail even if process
  startup succeeded.
- The dashboard or builder starts before the backend is ready; startup probes
  must prevent them from advertising healthy service prematurely.
- The host disk approaches exhaustion because logs or backups are growing too
  quickly; operators must have a visible way to detect this before writes fail.
- A restart loop occurs because configuration is invalid; startup validation
  must fail fast with explicit operator-facing log output.
- A restore is performed from backup, but the running application version is
  newer than the backed-up schema; the procedure must document compatibility
  checks and rollback expectations.
- The backup volume is unavailable or mounted read-only at the scheduled run
  time; the failure must be logged and surfaced as an actionable alert signal.
- Local time or cron scheduling drifts on the server; backup artifacts must
  still carry a clear UTC timestamp so operators can identify the latest valid
  restore point.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide production Docker images for the backend,
  builder, and dashboard surfaces, with each image versioned and runnable as a
  standalone container.
- **FR-002**: Backend and dashboard images MUST use `python:3.12-slim` as the
  runtime base image for MVP 2.
- **FR-003**: Each production image MUST declare its startup command,
  entrypoint behavior, working directory, required mounted volumes, and
  externally exposed port.
- **FR-004**: Docker images MUST be structured so that dependency layers are
  separated from application source layers to support reproducible rebuilds and
  efficient release updates.
- **FR-005**: System MUST provide a `docker-compose.prod.yml` stack definition
  for single-server deployment that includes service dependencies, restart
  policies, persistent volumes, health checks, and explicit resource limits.
- **FR-006**: The production compose stack MUST support backend, builder,
  dashboard, backup, and any required reverse-proxy or support services needed
  for single-host runtime operation.
- **FR-007**: System MUST read all production configuration from environment
  variables or mounted files; secrets and credentials MUST NOT be hardcoded in
  images, compose manifests, or source-controlled runtime defaults.
- **FR-008**: System MUST ship a complete `.env.example` file documenting every
  required and optional environment variable, default-safe example values, and
  whether a restart is required after change.
- **FR-009**: System MUST validate required environment configuration at
  startup and refuse to advertise readiness when mandatory values are missing,
  malformed, or inconsistent.
- **FR-010**: Backend MUST expose a liveness and readiness-compatible HTTP
  health endpoint at `/health` that returns machine-readable service status.
- **FR-011**: Builder and dashboard surfaces MUST expose HTTP health endpoints
  or equivalent HTTP probe paths that can be used by Docker health checks.
- **FR-012**: Health checks MUST distinguish between process started, service
  ready, and service degraded states so containers do not appear healthy before
  dependencies are usable.
- **FR-013**: Health probes MUST run at least every 5 minutes during steady
  state and more frequently during startup until readiness is achieved.
- **FR-014**: System MUST emit structured JSON logs for backend and dashboard
  request handling, startup, errors, and operational tasks.
- **FR-015**: Structured logs MUST support the severity levels `DEBUG`,
  `INFO`, `WARN`, and `ERROR`, with configured minimum log level controlled by
  environment variable.
- **FR-016**: System MUST preserve an audit trail for at least query
  executions, saved-query runs, dashboard refreshes, relationship approvals,
  deployment actions, backup outcomes, restore actions, and operator-triggered
  rollbacks.
- **FR-017**: Log storage on the single server MUST support local rotation and
  bounded retention so application logs do not consume unbounded disk space.
- **FR-018**: System MUST provide a daily automated backup of the SQLite
  metadata database to an external mounted volume with UTC timestamped backup
  filenames.
- **FR-019**: Backup retention MUST preserve 30 days of daily restore points
  and MUST never delete the most recent valid backup during retention cleanup.
- **FR-020**: System MUST provide a documented restore procedure that verifies
  backup integrity before replacement of the active database and records the
  restore outcome in operator-visible logs.
- **FR-021**: System MUST provide a documented rollback procedure that returns
  the stack to the previous known-good release without deleting current backup
  artifacts.
- **FR-022**: Production deployment documentation MUST include installation
  prerequisites for WSL2 and Linux Docker CE environments, first-time setup,
  upgrade flow, rollback flow, backup verification, and incident triage.
- **FR-023**: The backend runtime MUST tune SQLite access for concurrent web
  requests using a connection-management approach appropriate for FastAPI on a
  single-server SQLite deployment.
- **FR-024**: The backend deployment MUST define an explicit worker-count
  strategy so production concurrency is intentional rather than relying on
  implicit defaults.
- **FR-025**: The dashboard deployment MUST define memory and CPU limits that
  protect the host from one service exhausting all resources during a heavy
  report run.
- **FR-026**: The production stack MUST persist all data required for service
  continuity across container restarts, including metadata, local logs when
  configured for file retention, and backup artifacts.
- **FR-027**: Monitoring guidance MUST identify the key metrics and operator
  checks required to judge whether the service is healthy, degraded, or at
  risk of failure on a single host.
- **FR-028**: Monitoring guidance MUST define basic alert thresholds or manual
  trigger conditions for repeated container restarts, failed backups, failed
  health checks, high disk usage, and sustained error-rate spikes.
- **FR-029**: The deployment bundle MUST maintain traceability between running
  container version, image tag, compose configuration revision, environment
  file version, and backup set used for recovery.
- **FR-030**: The deployment feature MUST introduce no product-level behavior
  changes to specs 001-005 beyond what is required for safe operations,
  observability, and recoverability.

### Acceptance Criteria

- **AC-001**: A clean single-server deployment can be started from the
  production compose file and environment file without editing image contents.
- **AC-002**: Backend, builder, and dashboard services each report healthy
  HTTP status through their documented probe endpoints after startup.
- **AC-003**: Invalid or missing required environment variables cause startup
  validation failure and prevent the service from reaching ready state.
- **AC-004**: A stopped or crashed service container is restarted
  automatically according to the documented restart policy.
- **AC-005**: Structured logs can be filtered by service, severity, and event
  type and include auditable records for query runs and relationship
  approvals.
- **AC-006**: Local log rotation prevents unbounded file growth while
  preserving recent incident evidence.
- **AC-007**: A daily SQLite backup is written to the external backup volume
  and retention cleanup preserves the latest 30 daily restore points.
- **AC-008**: A documented restore drill from a valid backup returns the
  system to healthy state in under 30 minutes.
- **AC-009**: A failed restore from a corrupt backup is detected explicitly and
  does not destroy the previously running database state.
- **AC-010**: Operators can identify the deployed application version,
  configuration version, and most recent successful backup from local runtime
  evidence.
- **AC-011**: Resource limits prevent one service from consuming the entire
  host during normal or degraded operation.
- **AC-012**: The deployment guide, rollback runbook, troubleshooting runbook,
  and on-call playbook are sufficient for another operator to deploy, inspect,
  recover, and roll back the system.

### Dependencies

- **Spec 001 — Upload + Profile + Field Roles**: Production deployment must
  preserve workspace manifests, file metadata, and reproducibility artifacts
  created by the core ingestion workflow.
- **Spec 002 — Relationship Rules**: Relationship lifecycle events and
  approvals must remain durable and observable in audit logs and restored
  backups.
- **Spec 003 — Query Builder & Execution**: Query execution endpoints and run
  history form a primary operational workload and must be covered by health,
  logging, and audit requirements.
- **Spec 004 — Saved Queries**: Saved-query definitions and versions are part
  of the SQLite metadata that must survive restart, backup, and restore.
- **Spec 005 — Dashboard & Visualizations**: The shared dashboard surface is a
  production-facing runtime and must participate in health checks, resource
  controls, and observability.

### Out of Scope (MVP 2)

- Kubernetes, swarm orchestration, or multi-host high availability.
- Managed database services or replacement of SQLite with PostgreSQL.
- External secret-manager products, cloud key vaults, or managed parameter
  stores.
- External centralized log aggregation, SIEM integration, or hosted metrics
  backends.
- Auto-scaling, blue/green deployment orchestration, or zero-downtime release
  guarantees.
- Cross-region disaster recovery or off-site object-storage replication.
- User-facing feature additions unrelated to deployment safety,
  observability, or recoverability.

### Key Entities

- **Deployment Bundle**: The versioned operational package consisting of
  compose manifests, image tags, environment-file schema, mounted volumes, and
  operator documentation required to run the system.
- **Service Container**: A single runtime service instance for backend,
  builder, dashboard, backup, or supporting infrastructure with health status,
  logs, restart state, and resource limits.
- **Environment Contract**: The complete set of environment variables,
  required secrets, defaults, validation rules, and restart requirements for a
  deployment.
- **Health Check Snapshot**: A machine-readable statement of liveness,
  readiness, dependency status, version identity, and failure detail for a
  running service.
- **Audit Event**: A durable record of a material operational or business
  action such as query execution, relationship approval, backup, restore, or
  deployment.
- **Backup Artifact**: A timestamped SQLite backup file plus integrity and
  retention metadata stored on the external backup volume.
- **Restore Run**: An operator-executed recovery event that records chosen
  backup artifact, validation result, start time, finish time, and service
  outcome.
- **Operational Runbook**: The published deployment, rollback,
  troubleshooting, and on-call procedures used to operate the stack safely.

## Operational Deployment Scope

The production deployment target is a single Linux server operated with Docker
CE and Docker Compose. WSL2 remains a supported development and pre-production
validation environment, but the production architecture is single-host and
does not assume cluster orchestration.

### Required Runtime Services

1. **Backend API service**: FastAPI application serving upload, relationship,
   query, saved-query, and health endpoints.
2. **Builder UI service**: Browser-facing builder application served as a
   long-running production container.
3. **Dashboard service**: Streamlit application for manager-facing reporting
   and dashboard refresh workflows.
4. **Backup service or scheduled backup task**: Daily SQLite backup runner
   writing to an external mounted volume.
5. **Optional reverse proxy**: Single-host ingress service when required to
   terminate HTTP routing cleanly across backend, builder, and dashboard.

### Production Compose Expectations

- The compose file for production is `docker-compose.prod.yml`.
- Services must declare dependency ordering so UI services do not present as
  healthy before backend readiness is established.
- Every long-running service must define restart policy, resource limits,
  persistent volume mounts, and a Docker health check.
- Production compose must separate mutable data volumes from image contents.
- Container names, network aliases, and mounted paths must be stable enough to
  support the published runbook and restore steps.

## Docker Image Specifications

### Backend Image

- **Base image**: `python:3.12-slim`
- **Required layers**:
  1. OS and system package layer for Python runtime prerequisites
  2. Python dependency layer built from pinned application requirements
  3. Application source layer for FastAPI service code
  4. Runtime configuration layer defining working directory, non-secret
     defaults, port exposure, and entrypoint
- **Entrypoint contract**: Starts the FastAPI production server, performs
  startup configuration validation, and exits non-zero on invalid
  configuration.

### Dashboard Image

- **Base image**: `python:3.12-slim`
- **Required layers**:
  1. OS and Python runtime prerequisites
  2. Python dependency layer for Streamlit and dashboard dependencies
  3. Application source layer for the dashboard app
  4. Runtime configuration layer defining working directory, probe path, and
     entrypoint
- **Entrypoint contract**: Starts the Streamlit production process, binds the
  configured port and host, and fails fast when required backend connectivity
  configuration is absent.

### Builder Image

- **Base image expectation**: Production builder image may use a multi-stage
  build with a Node-based build stage and a lightweight runtime stage that
  serves the compiled builder assets.
- **Required layers**:
  1. Frontend dependency install layer
  2. Static asset build layer
  3. Runtime serving layer with exposed HTTP port and health endpoint
- **Entrypoint contract**: Serves compiled builder assets and reports HTTP
  health without depending on a development server.

## Environment Configuration Strategy

- A checked-in `.env.example` documents every environment key required for
  production, including service ports, data paths, log levels, backup paths,
  retention values, worker settings, and public URL settings.
- Real deployment secrets are supplied through a local `.env` file or mounted
  environment file outside version control.
- Environment variables are injected into containers by the production compose
  file rather than baked into images.
- Startup validation must confirm:
  - required variables are present
  - port values are valid integers
  - filesystem paths are writable when required
  - backup retention is a positive integer
  - log level is one of the supported severity values
  - service URLs and hostnames are internally consistent
- Validation failures must be written to structured logs and terminate startup
  before the container reaches ready state.

## Health Checks & Expected Responses

### Backend

- **Endpoint**: `/health`
- **Purpose**: Liveness and readiness probe for FastAPI runtime and its local
  dependencies
- **Expected healthy response**:
  - HTTP `200`
  - JSON body containing at minimum: service name, version, overall status,
    database accessibility, data-path accessibility, and current timestamp
- **Expected degraded or not-ready behavior**:
  - HTTP `503` when required dependencies such as SQLite access or mandatory
    data directories are unavailable

### Builder

- **Endpoint**: `/health` or equivalent static HTTP probe path
- **Purpose**: Confirms the builder runtime is serving traffic
- **Expected healthy response**:
  - HTTP `200`
  - lightweight body indicating service identity and version

### Dashboard

- **Endpoint**: `/health` or equivalent HTTP probe path served by the
  dashboard container
- **Purpose**: Confirms the Streamlit service is running and has the minimum
  required backend connectivity configuration
- **Expected healthy response**:
  - HTTP `200`
  - body or JSON payload with service identity, version, and backend target
    status when available
- **Expected degraded or not-ready behavior**:
  - HTTP `503` when mandatory backend target configuration is invalid or the
    dashboard is still initializing

### Probe Policy

- **Startup readiness probes**: Frequent checks during container startup until
  dependencies are reachable and startup validation completes.
- **Liveness probes**: Ongoing checks at 5-minute intervals during steady
  state.
- **Failure posture**: Repeated failed liveness checks trigger container
  restart according to restart policy; failed readiness prevents the service
  from being considered healthy.

## Logging, Audit, Monitoring & Alerting

### Structured Logging

- All backend and dashboard runtime logs must be emitted as structured JSON.
- Each log event must include timestamp, service name, severity, message, and
  correlation identifiers when a request or background job is involved.
- Request or job-scoped logs should include workspace identifier, query or
  dashboard identifier when available, and outcome status.

### Audit Trail Preservation

The following events are audit-critical and must be preserved in local runtime
evidence and restored with the SQLite metadata state when applicable:

1. Query execution requested, succeeded, failed, and exported
2. Saved-query creation, update, validation, and execution
3. Dashboard refresh triggered, succeeded, failed, and exported
4. Relationship review and approval actions
5. Deployment start, deployment finish, rollback start, rollback finish
6. Backup started, succeeded, failed, pruned
7. Restore started, validated, succeeded, failed

### Monitoring Guidance

Operators must monitor at minimum:

1. Container health state and restart count
2. Recent `ERROR` and `WARN` log volume per service
3. Last successful backup timestamp and backup duration
4. Free disk space on data and backup volumes
5. HTTP health endpoint status for backend, builder, and dashboard
6. Dashboard refresh failure count and query execution failure count

### Basic Alerting / Escalation Triggers

- More than 3 restarts for the same service within 15 minutes
- Any failed daily backup or missing backup within the expected 24-hour window
- Any health endpoint returning non-healthy status for more than 10 minutes
- Disk usage above 85% on the data or backup volume
- Sustained `ERROR` log spike above normal baseline for 15 minutes

These alerts may be implemented initially through local log analysis,
operator scripts, cron-driven checks, or documented manual review steps; no
external alerting platform is required for MVP 2.

## Backup & Restore Procedures

### Backup Policy

- Frequency: daily automated backup
- Source: SQLite metadata database and any required sidecar metadata needed for
  workspace continuity
- Destination: external mounted backup volume, separate from the primary data
  path
- Naming: UTC timestamped backup artifacts to support deterministic restore
  ordering
- Retention: 30 daily restore points minimum

### Restore Procedure Requirements

1. Stop or isolate the affected application services.
2. Identify the latest valid backup artifact.
3. Validate the selected backup before replacing the active database.
4. Preserve the failed database state for forensic analysis when possible.
5. Restore the validated backup artifact to the active data location.
6. Restart the production stack.
7. Verify `/health` responses, recent logs, and critical user flows.
8. Record the restore event, chosen artifact, and outcome.

### Restore Verification

After restore, operators must confirm at minimum:

- backend health reports ready
- dashboard can load and reach backend
- saved queries remain visible
- at least one dashboard refresh can complete
- relationship-rule history remains present
- the restored deployment version and backup timestamp are recorded in the
  incident notes

## Disaster Recovery Scenarios

### Scenario 1 — Single Container Crash

- Expected response: restart policy restores the container automatically.
- Recovery target: no operator action for isolated transient crashes.

### Scenario 2 — Host Reboot

- Expected response: Docker resumes intended services and health checks confirm
  readiness.
- Recovery target: service restored through automated startup, followed by
  operator validation.

### Scenario 3 — SQLite Corruption or Accidental Deletion

- Expected response: restore from latest valid backup and verify service
  health.
- Recovery target: less than 30 minutes from incident declaration to healthy
  service.

### Scenario 4 — Broken Release

- Expected response: roll back to previous known-good images and compose
  revision while preserving persistent volumes.
- Recovery target: prior service restored without requiring data re-entry.

### Scenario 5 — Disk Pressure from Logs or Backups

- Expected response: detect via monitoring threshold, prune according to
  retention policy, and document emergency cleanup steps.
- Recovery target: prevent service outage before writes fail.

## Deployment Checklist

Before go-live, the operator checklist must confirm all of the following:

1. Docker CE and Compose are installed on the target Linux host.
2. The production environment file is present outside version control.
3. Required external volumes for data and backups are mounted and writable.
4. Production image tags are pinned and documented for the release.
5. `docker-compose.prod.yml` validates successfully.
6. Backend, builder, and dashboard services pass startup and liveness probes.
7. Structured JSON logs are visible for each service.
8. Audit-critical events can be located in runtime evidence.
9. A test backup has completed successfully.
10. A restore drill has been executed and timed.
11. Rollback steps have been rehearsed against the previous known-good release.
12. Deployment guide, troubleshooting runbook, rollback procedure, and on-call
    playbook are published and accessible to operators.

## Decision-Readiness Gates _(mandatory for this project)_

This feature is an **audit / export** and **analysis workbench support**
surface, not a decision metric surface. Its job is to keep the governed system
available and inspectable.

| Gate                         | Deployment posture                                                                                               |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Data quality gate            | Not created by this feature; deployment must preserve data artifacts and fail safely when storage is unavailable |
| Relationship confidence gate | Relationship approvals remain durable and auditable through backup, restore, and logs                            |
| Metric contract gate         | Deployment must not bypass saved-query or dashboard trust labeling                                               |
| Reconciliation residual gate | No recommendation logic introduced; restore and rollback must preserve existing readiness posture                |
| Challenge stability gate     | Not altered by this feature; operational tooling must preserve reproducible runs                                 |
| Output readiness gate        | Production runtime may host decision-ready surfaces only if upstream gates remain satisfied                      |

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A trained operator can deploy the production stack on a clean
  single Linux host in under 60 minutes using only the deployment guide.
- **SC-002**: After an unplanned application-process failure, the affected
  service returns to healthy state automatically without manual intervention.
- **SC-003**: The system can be restored from the latest valid backup and made
  healthy again in under 30 minutes.
- **SC-004**: 100% of daily backup windows either complete successfully or
  produce an operator-visible failure signal within the same day.
- **SC-005**: Operators can identify the release version, backup freshness, and
  current service health within 5 minutes of beginning an incident review.
- **SC-006**: Audit-critical actions remain traceable across restart and
  restore events for the retained local-history window.

## Assumptions

- Production deployment targets a single Linux server; no multi-host failover
  is required for MVP 2.
- Docker CE is the supported runtime on Linux hosts and WSL2 development
  machines; Docker Desktop-specific behavior is out of scope.
- SQLite remains the only metadata database in MVP 2, so backup and restore
  procedures are designed around file-based recovery.
- A local `.env` file is acceptable for MVP 2 secret injection so long as it
  stays outside version control and is documented clearly.
- Local log files and Docker logs are sufficient for MVP 2 observability; no
  external aggregation stack is required.
- Production readiness for this feature depends on specs 001-005 being
  functionally complete before deployment hardening begins.
