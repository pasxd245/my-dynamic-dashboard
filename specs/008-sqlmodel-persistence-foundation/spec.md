# Feature Specification: SQLModel Persistence Foundation

**Feature Branch**: `feat/enhance-ui-ux`  
**Created**: 2026-05-10  
**Status**: Draft  
**Input**: User description: "Create a new spec for feature 008 with goal/scope from PDCA Round 22"

## Business Question _(mandatory for this project)_

> "Can we move metadata schema ownership to declarative models with migration governance while preserving all current backend behavior and keeping the current sqlite3 service layer unchanged in this round?"

**Decision consumed**: Whether persistence hardening can be completed as a safe foundation step that enables future schema evolution without changing current runtime behavior.

## Role

**Primary roles**: Backend maintainer (schema governance and operations), analyst user (expects no workflow regressions), release owner (requires deterministic migration safety).

**Surface role**: audit / export

This round is an internal persistence-governance change. Its user-visible output is operational evidence, migration state, and reproducibility documentation rather than a decision-ready analytical surface.

## Required Metric Contracts

- N/A for this round. The feature does not introduce, rename, aggregate, reconcile, or reclassify business metrics.

## Required Relationship Rules

- Preserve existing relationship-rule behavior without semantic change.
- No new cross-table relationship logic, join semantics, or rule evaluation paths are introduced.

## Required Reconciliation

- Reconcile migration-built schema against legacy `metadata_db.py` schema definitions.
- Reconcile startup behavior for fresh, tracked, and untracked legacy databases to a single Alembic-governed head state.
- Reconcile saved-query additive columns previously introduced through `_add_column_if_missing` into the baseline declarative schema.

## Challenge Variants

- Fresh metadata DB bootstrap through `alembic upgrade head`.
- Existing metadata DB without `alembic_version` through auto-stamp then upgrade.
- Metadata DB path redirected through `METADATA_DB_PATH` to challenge path-resolution and isolation assumptions.
- Repeated startup and `upgrade -> downgrade -> upgrade` execution to challenge idempotence assumptions.

## Decision-Readiness Gates

- Gate A: Baseline migration must remain explicit per-model `op.create_table()` lineage.
- Gate B: Existing untracked databases must auto-stamp before upgrade and converge to head in one boot cycle.
- Gate C: Service-layer runtime contract must remain raw `sqlite3`; no ORM session rewrite is permitted in this round.
- Gate D: Full backend regression suite must pass unchanged.

## Traceability Surfaces

- Spec requirements and success criteria in this document.
- Plan requirement matrix in `plan.md`.
- Task-level requirement references in `tasks.md`.
- Verification evidence in `quickstart.md`.
- Runtime and migration evidence in backend tests, Alembic revisions, and startup orchestration code.

## Constitution Alignment

- **Principle I (Business-Question-First)**: Scope directly answers a release-safety question for persistence governance.
- **Principle II (Metric Contract Before Visualization)**: No metric or visualization behavior is introduced or modified.
- **Principle III (Relationship Rule Before Cross-Table Query)**: Existing relationship-rule behavior is preserved; no cross-table semantic changes are introduced.
- **Principle IV (Reconciliation Before Recommendation)**: No recommendation outputs are added.
- **Principle V (Challenge & Sensitivity Before Decision-Ready)**: No decision-ready outputs are added or reclassified.
- **Principle VI (Traceability For Every Claim)**: Migration lineage and schema ownership become explicit and auditable through migration history.
- **Principle VII (Reproducibility From Raw Inputs)**: Metadata schema state becomes reproducible via versioned migrations plus environment-defined database path.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Preserve Existing Behavior While Changing Schema Ownership (Priority: P1)

As a backend maintainer, I need schema ownership migrated from string-based table creation to declarative models and managed migrations so future schema changes are governed without changing current behavior.

**Why this priority**: The round goal is a persistence foundation with zero behavior change; if parity is not preserved, downstream workflow reliability is at risk.

**Independent Test**: Start from an existing metadata database, apply migration flow, and verify existing backend tests pass unchanged while schema matches legacy definitions plus approved migration tables.

**Acceptance Scenarios**:

1. **Given** the current metadata schema and runtime behavior, **When** declarative models and baseline migrations are introduced, **Then** all existing metadata tables and parity columns are represented without behavior regression.
2. **Given** legacy columns historically added at startup, **When** parity is validated against the new model-based schema, **Then** those columns are present without requiring runtime mutation logic changes.

---

### User Story 2 - Safe Boot-Time Migration for New and Existing Databases (Priority: P1)

As a release owner, I need application startup to run migrations safely for both fresh and existing databases so rollout is deterministic and idempotent.

**Why this priority**: Startup safety is the operational risk center for this round.

**Independent Test**: Run startup repeatedly on fresh and pre-existing metadata databases (including databases without migration tracking), and verify upgrade behavior is idempotent and stable.

**Acceptance Scenarios**:

1. **Given** a fresh metadata database path, **When** backend startup runs migration bootstrap, **Then** schema is created at head and startup completes successfully.
2. **Given** an existing metadata database without migration tracking, **When** startup performs auto-stamp and upgrade, **Then** migration tracking is initialized and schema advances to head without destructive changes.
3. **Given** a database already at head, **When** startup executes migration commands again, **Then** no schema drift or runtime failure occurs.

---

### User Story 3 - Pre-Stage Future Column Rename Mapping Support (Priority: P2)

As a backend maintainer, I need a dedicated column-mapping persistence table added now so future fuzzy rename detection can be built without another foundational migration round.

**Why this priority**: It reduces future migration risk while staying inside the no-behavior-change boundary.

**Independent Test**: Validate the new column mapping table exists with required keys, nullability, and confidence bounds while no feature currently depends on it.

**Acceptance Scenarios**:

1. **Given** the migration set for this round, **When** schema is inspected, **Then** the new column-mapping table exists with the required column set and relationships.
2. **Given** current application flows, **When** runtime behavior is exercised, **Then** no functional path depends on the new column-mapping table yet.

---

### User Story 4 - Keep Current Service Layer Contract Intact (Priority: P2)

As an engineering lead, I need this round to avoid service-layer rewrites so risk remains bounded to schema ownership and migration orchestration.

**Why this priority**: Keeping the service layer unchanged is a hard scope boundary from Round 22.

**Independent Test**: Review service access paths and execute tests to confirm raw sqlite3 usage remains active and functional.

**Acceptance Scenarios**:

1. **Given** backend services that currently use raw sqlite3, **When** this round is completed, **Then** those services still use raw sqlite3 with no required session-based rewrites.
2. **Given** persistence foundation changes are merged, **When** the codebase is reviewed against round scope, **Then** schema consolidation and fuzzy matching implementation are absent.

### Edge Cases

- Existing metadata database file is present but lacks migration tracking state.
- Existing metadata database includes parity columns previously added through startup patch logic.
- Migration commands are run multiple times in succession across startup cycles.
- Migration rollback and re-apply sequence is executed in the same environment.
- Metadata database path is redirected through environment configuration.
- `column_mappings` row contains nullable `source_file_id` but still requires valid workspace linkage.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Backend dependency definitions MUST pin declarative-model and migration tooling packages: `sqlmodel`, `sqlalchemy`, and `alembic`.
- **FR-002**: The backend MUST introduce a model module namespace under `apps/backend/app/models/` covering existing metadata domain tables for workspace, source, legacy files, relationship, saved query, dashboard, and deployment.
- **FR-003**: The backend MUST include a `column_mappings` domain model in the same model namespace.
- **FR-004**: Model-managed schema MUST preserve parity with the legacy metadata schema, including columns previously added by runtime patch logic. The authoritative parity column inventory is recorded in `data-model.md`.
- **FR-005**: The `column_mappings` table MUST include: `id` (primary key), `workspace_id` (foreign key to workspaces), `source_file_id` (nullable foreign key to source files), `from_column_name`, `to_column_name`, `from_version`, `to_version`, `confidence` (bounded to 0..1), `accepted_by`, and `created_at`.
- **FR-006**: Backend utilities MUST provide environment-variable helper support and constants including `METADATA_DB_PATH` at `apps/backend/app/utils/env_helper.py`.
- **FR-007**: Backend core database wiring MUST provide engine/session initialization at `apps/backend/app/core/db.py`, sourcing metadata database location from environment configuration, and export a reusable `get_session` dependency.
- **FR-008**: Migration tooling MUST be initialized under `apps/backend/alembic/` and use the shared model metadata as the migration target.
- **FR-009**: A baseline migration MUST create existing metadata tables through explicit migration operations, and a migration MUST add `column_mappings`.
- **FR-010**: Backend startup lifecycle MUST replace active reliance on `init_metadata_db()` with migration upgrade to head.
- **FR-011**: Legacy initialization function `init_metadata_db()` MUST remain present but unused in normal startup path to preserve rollback safety.
- **FR-012**: Startup flow MUST auto-stamp existing metadata databases that lack migration tracking and then run upgrade to head.
- **FR-013**: Backend documentation MUST describe metadata reset flow and `METADATA_DB_PATH` usage.
- **FR-014**: Existing backend tests MUST run unchanged and pass under the new persistence foundation.
- **FR-015**: Service-layer data access MUST remain raw sqlite3 in this round.
- **FR-016**: This round MUST exclude service-layer rewrite to declarative sessions.
- **FR-017**: This round MUST exclude Pydantic schema consolidation.
- **FR-018**: This round MUST exclude fuzzy matcher implementation.
- **FR-019**: This round MUST exclude schema reshaping beyond legacy parity plus `column_mappings` addition.

### Key Entities _(include if feature involves data)_

- **Metadata Domain Model Set**: Declarative ownership of existing metadata tables currently created from SQL strings.
- **Column Mapping Record**: A future-facing mapping row that links workspace/source lineage between prior and current column names with confidence and acceptance attribution.
- **Migration Baseline**: Versioned migration state that establishes parity schema as an auditable starting point.
- **Migration Tracking State**: Database migration version marker used for safe startup orchestration and idempotent upgrades.
- **Environment Configuration Contract**: Runtime configuration source that resolves metadata database location via `METADATA_DB_PATH`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Existing backend automated tests pass without modification and without additional expected failures versus the pre-change baseline.
- **SC-002**: Schema comparison between legacy metadata setup and migrated metadata setup shows parity for all legacy tables/columns, with only `alembic_version` and `column_mappings` as approved additions.
- **SC-003**: Migration flow completes successfully for upgrade -> downgrade -> upgrade sequences with no manual repair steps.
- **SC-004**: For an existing metadata database lacking migration tracking, startup auto-stamps and upgrades to head successfully in a single boot cycle.
- **SC-005**: Service-layer runtime behavior remains unchanged for existing metadata operations across core backend workflows, and no SQLModel session is activated in any request handler or startup path in this round.

## Assumptions

- Round 22 scope is intentionally foundation-only: schema ownership and migration governance without behavior expansion.
- Existing metadata table semantics and service-layer interfaces remain the contract of record.
- Migration history and startup orchestration are the required traceability mechanism for persistence claims in this round.
- `column_mappings` is pre-staged storage only and is not read by production workflows in this round.
- Documentation updates are limited to backend persistence setup/reset guidance and environment configuration.

## Traceability

- **PDCA Round Source**: Round 22 goal and boundaries are treated as controlling input for this feature.
- **Requirement Coverage**: FR-001 through FR-013 map to in-scope implementation commitments, FR-014 through FR-015 map to acceptance constraints, and FR-016 through FR-019 map to explicit exclusions.
- **Verification Intent**: SC-001 through SC-005 mirror Round 22 check intent for regression safety, schema parity, migration idempotence, and auto-stamp behavior.
