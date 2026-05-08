# Data Model: Production Deployment (MVP 2)

**Spec**: `/specs/006-production-deployment/spec.md`  
**Research**: `/specs/006-production-deployment/research.md`  
**Date**: 2026-05-08

This model defines deployment-domain entities and artifacts required to operate specs 001-005 safely in single-host production.

## Entity: DeploymentBundle

Represents a versioned release package used for deployment and rollback.

### Fields

- `bundle_id` (string, immutable): unique bundle identifier (for example, release timestamp + short SHA)
- `release_version` (string, required): operator-facing release label
- `backend_image` (string, required): pinned backend image tag/digest
- `builder_image` (string, required): pinned builder image tag/digest
- `dashboard_image` (string, required): pinned dashboard image tag/digest
- `compose_revision` (string, required): revision hash/version for `docker-compose.prod.yml`
- `env_contract_version` (string, required): version identifier for `.env.example` schema
- `created_at_utc` (timestamp, required)
- `created_by` (string, required): operator ID
- `status` (enum, required): `draft | validated | deployed | rolled_back | superseded`

### Validation Rules

- image references must be immutable (tag policy + optional digest lock)
- `status` transitions must follow lifecycle below
- `compose_revision` and `env_contract_version` must be present before `validated`

### State Transitions

`draft -> validated -> deployed -> superseded`

`deployed -> rolled_back` (for failed release)

## Entity: ServiceContainerSnapshot

Runtime snapshot for each managed service (`backend`, `builder`, `dashboard`, `backup`, optional `proxy`).

### Fields

- `snapshot_id` (string, immutable)
- `bundle_id` (string, required): associated `DeploymentBundle`
- `service_name` (enum, required)
- `container_id` (string, required)
- `health_status` (enum, required): `starting | healthy | degraded | unhealthy`
- `restart_count` (integer, required)
- `cpu_limit` (string, required)
- `memory_limit_mb` (integer, required)
- `started_at_utc` (timestamp, required)
- `checked_at_utc` (timestamp, required)

### Validation Rules

- `restart_count >= 0`
- `checked_at_utc >= started_at_utc`
- `memory_limit_mb > 0`

## Entity: EnvironmentContract

Defines required runtime configuration keys and validation behavior.

### Fields

- `contract_version` (string, immutable)
- `keys` (array, required): key definitions
- `keys[].name` (string, required)
- `keys[].required` (boolean, required)
- `keys[].default_value` (string, optional, non-secret only)
- `keys[].validation_rule` (string, required)
- `keys[].restart_required` (boolean, required)
- `keys[].sensitivity` (enum, required): `secret | non_secret`
- `generated_from` (string, required): `.env.example` revision

### Validation Rules

- required keys cannot have empty runtime values
- secret keys cannot ship with real defaults in source control
- validation rules must be machine-checkable in startup validators

## Entity: HealthCheckSnapshot

Machine-readable result of a service health probe.

### Fields

- `health_snapshot_id` (string, immutable)
- `service_name` (enum, required)
- `version` (string, required)
- `status` (enum, required): `healthy | degraded | not_ready`
- `http_status` (integer, required): 200 or 503 for readiness semantics
- `dependency_checks` (object, required): service-specific checks
- `checked_at_utc` (timestamp, required)

### Validation Rules

- `http_status = 200` only when dependency checks pass
- `status = not_ready` must map to non-200 readiness response

## Entity: AuditEvent

Structured operational or business action evidence.

### Fields

- `event_id` (string, immutable)
- `event_type` (enum, required):
  - business events: query execution, saved query action, dashboard refresh, relationship approval
  - ops events: deployment start/finish, rollback start/finish, backup start/success/fail/prune, restore start/validate/success/fail
- `service` (string, required)
- `severity` (enum, required): `DEBUG | INFO | WARN | ERROR`
- `message` (string, required)
- `workspace_id` (string, optional)
- `query_id` (string, optional)
- `dashboard_id` (string, optional)
- `relationship_id` (string, optional)
- `run_id` (string, optional)
- `correlation_id` (string, optional)
- `timestamp_utc` (timestamp, required)

### Validation Rules

- `event_type`, `service`, `severity`, `timestamp_utc` required for every event
- severity level must respect configured minimum log level filtering

## Entity: BackupArtifact

Represents a backup file and verification metadata.

### Fields

- `backup_id` (string, immutable)
- `artifact_name` (string, required): UTC timestamped file name
- `artifact_path` (string, required)
- `created_at_utc` (timestamp, required)
- `sqlite_integrity_ok` (boolean, required)
- `size_bytes` (integer, required)
- `checksum` (string, required)
- `retention_expires_at_utc` (timestamp, required)
- `is_latest_valid` (boolean, required)
- `status` (enum, required): `created | validated | failed | retained | pruned`

### Validation Rules

- `size_bytes > 0` for successful artifacts
- `is_latest_valid = true` implies `status` in `{validated, retained}`
- retention cleanup must not prune current `is_latest_valid = true` artifact

## Entity: RestoreRun

Captures a recovery operation from selected backup artifact.

### Fields

- `restore_run_id` (string, immutable)
- `requested_at_utc` (timestamp, required)
- `started_at_utc` (timestamp, required)
- `finished_at_utc` (timestamp, optional)
- `requested_by` (string, required)
- `selected_backup_id` (string, required)
- `validation_result` (enum, required): `passed | failed`
- `outcome` (enum, required): `success | failed | rolled_back`
- `duration_seconds` (integer, optional)
- `notes` (string, optional)

### Validation Rules

- `duration_seconds <= 1800` for successful RTO target compliance
- `finished_at_utc` required when outcome is terminal
- failed validation cannot proceed to replacement step

## Entity: OperationalRunbook

Published operator procedure artifact.

### Fields

- `runbook_id` (string, immutable)
- `runbook_type` (enum, required): `deployment | rollback | troubleshooting | oncall`
- `document_path` (string, required)
- `version` (string, required)
- `last_reviewed_at_utc` (timestamp, required)
- `owner` (string, required)

### Validation Rules

- runbook type must be unique per active version
- `document_path` must resolve to versioned docs location

## Relationships

- DeploymentBundle 1:N ServiceContainerSnapshot
- DeploymentBundle 1:N AuditEvent (deployment/rollback scope)
- EnvironmentContract 1:N DeploymentBundle (by reference version)
- BackupArtifact 1:N RestoreRun (historical usage)
- RestoreRun 1:N AuditEvent (restore lifecycle)
- OperationalRunbook N:1 DeploymentBundle (used during release operations)

## Cross-Spec Continuity Requirements (001-005)

- Backup/restore must preserve SQLite metadata used by:
  - spec 001 upload manifests and column-role assignments
  - spec 002 relationship lifecycle and approvals
  - spec 003 query definitions and run history
  - spec 004 saved query versions and snapshots
  - spec 005 dashboard composition and run records
- Deployment entities do not alter business schema semantics from those specs.
