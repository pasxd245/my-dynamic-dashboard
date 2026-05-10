# Quickstart: SQLModel Persistence Foundation

**Spec**: `/specs/008-sqlmodel-persistence-foundation/spec.md`  
**Plan**: `/specs/008-sqlmodel-persistence-foundation/plan.md`  
**Data Model**: `/specs/008-sqlmodel-persistence-foundation/data-model.md`  
**Date**: 2026-05-10

This quickstart validates feature 008 as a persistence-foundation change with strict no-behavior-regression boundaries.

## Prerequisites

1. Backend virtual environment is available and dependencies are installed.
2. A baseline copy of an existing metadata database is available for parity and auto-stamp tests.
3. Alembic config and migration scripts are present under `apps/backend/alembic/`.
4. Existing backend tests are runnable from `apps/backend/`.

## Phase A: Dependency and Wiring Gate

### Goal

Verify dependency and DB wiring foundation is present without changing service behavior.

### Steps

1. Confirm backend requirements include pinned `sqlmodel`, `sqlalchemy`, and `alembic`.
2. Confirm `app/utils/env_helper.py` defines `METADATA_DB_PATH` and typed accessors.
3. Confirm `app/core/db.py` resolves DB path from environment and exposes `get_session`.
4. Confirm service-layer modules still use raw `sqlite3` and existing connection patterns.

### Pass Criteria

- New persistence dependencies install and import cleanly.
- Runtime DB path is configurable through `METADATA_DB_PATH`.
- Existing service-layer data access contract is unchanged.

### Fail Gate

- Service-layer logic is rewritten to ORM sessions in this feature.
- DB path handling remains duplicated and untyped.

## Phase B: Baseline Parity Migration Gate (Round 22 Gate A)

### Goal

Validate baseline migration ownership and parity against legacy schema.

### Steps

1. Initialize migration chain on a fresh metadata DB with `alembic upgrade head`.
2. Verify baseline migration uses explicit per-model `op.create_table()` calls.
3. Compare resulting schema against legacy schema from `metadata_db.py`.
4. Confirm approved differences are only `alembic_version` and `column_mappings`.

### Pass Criteria

- Fresh DB reaches head revision successfully.
- Parity diff shows no unapproved schema drift.
- Legacy saved-query additive columns are present in baseline schema.

### Fail Gate

- Baseline migration depends on pasted raw SQL blobs.
- Parity comparison shows missing or reshaped legacy columns.

## Phase C: Existing-DB Auto-Stamp Gate (Round 22 Gate B)

### Goal

Validate safe boot for existing metadata DB files lacking migration tracking.

### Steps

1. Prepare a copy of legacy metadata DB without `alembic_version`.
2. Boot backend startup sequence with migration orchestration enabled.
3. Confirm startup performs `stamp head` then `upgrade head`.
4. Repeat startup to validate idempotence.

### Pass Criteria

- Existing DB converges to migration-tracked head in one boot cycle.
- Repeated startup causes no destructive or duplicate operations.

### Fail Gate

- Startup fails on legacy DB without migration tracking.
- Manual intervention is required to recover migration state.

## Phase D: New Table and Scope Boundary Gate

### Goal

Validate `column_mappings` addition and strict out-of-scope boundaries.

### Steps

1. Inspect migration `0002` and resulting DB schema for `column_mappings` shape.
2. Validate confidence bounds and FK relationships.
3. Execute backend workflows to confirm no runtime path depends on `column_mappings` yet.
4. Confirm no implementation of fuzzy matcher or schema consolidation is introduced.

### Pass Criteria

- `column_mappings` exists with required fields and constraints.
- Current runtime behavior does not require reads/writes to the table.
- Scope exclusions remain enforced.

### Fail Gate

- `column_mappings` schema diverges from FR-005 contract.
- New runtime behavior is introduced beyond persistence foundation.

## Phase E: Regression and Idempotence Gate

### Goal

Prove no backend behavior regression and migration safety under repeated operations.

### Steps

1. Run existing backend tests unchanged.
2. Run migration sequence: `upgrade head -> downgrade base -> upgrade head`.
3. Run startup against fresh DB and existing stamped DB.
4. Record evidence of stable results.

### Pass Criteria

- Existing test suite passes unchanged.
- Upgrade/downgrade/upgrade chain succeeds without manual repair.
- Startup remains deterministic for fresh and existing DB paths.

### Fail Gate

- Tests require feature-specific modifications to pass.
- Migration cycle fails or produces inconsistent schema state.

## Suggested Verification Commands

Run from repository root unless otherwise noted.

```bash
cd apps/backend
pytest tests/
```

```bash
cd apps/backend
alembic upgrade head
alembic downgrade base
alembic upgrade head
```

```bash
cd apps/backend
METADATA_DB_PATH=/tmp/metadata-existing.db alembic current
```

## Verification Evidence

Executed on 2026-05-10 against the current feature implementation with no service-layer ORM rewrite.

### US1 parity evidence

- Focused verification suite: `pytest apps/backend/tests/integration/test_metadata_schema_parity.py apps/backend/tests/integration/test_metadata_startup_migrations.py apps/backend/tests/integration/test_column_mappings_migration.py apps/backend/tests/integration/test_service_layer_scope_guards.py -q`
  - Result: `9 passed, 4 warnings in 2.96s`
- Isolated legacy-vs-migrated schema comparison summary:
  - `legacy_tables=26`
  - `migrated_tables=28`
  - `table_additions=['alembic_version', 'column_mappings']`
  - `missing_tables=[]`
  - `column_mismatches=[]`
  - `allowed_additions_only=True`
- Saved-query additive parity remains covered by the baseline schema assertions in `test_metadata_schema_parity.py`.

### US2 startup auto-stamp and idempotence evidence

- Startup migration integration coverage passed in the focused verification suite above.
- Isolated startup outcome summary:
  - Fresh DB first startup: `upgrade_only` -> `0002_column_mappings`
  - Fresh DB second startup: `upgrade_only` -> `0002_column_mappings`
  - Existing untracked DB first startup: `stamp_then_upgrade` -> `0002_column_mappings`
  - Existing untracked DB second startup: `upgrade_only` -> `0002_column_mappings`
  - Existing untracked DB final revision: `0002_column_mappings`
- Migration idempotence cycle command:
  - `alembic upgrade head && alembic current && alembic downgrade base && alembic current && alembic upgrade head && alembic current`
  - Result: reached `0002_column_mappings (head)` before downgrade and again after re-upgrade with no manual repair.

### US3 foundation-only boundary evidence

- `column_mappings` remains additive-only and out of current runtime flows.
- Focused verification suite includes the shape/constraint and no-runtime-dependency assertions in `test_column_mappings_migration.py`.

### US4 service-layer unchanged evidence

- The focused verification suite includes `test_service_layer_scope_guards.py` and passed unchanged.
- Guard assertions confirm:
  - backend service sources still contain raw `sqlite3` usage
  - `app.main` does not require `Depends(get_session`
  - `app.main` does not import or construct SQLModel `Session`
- Scope exclusions remain enforced for this round: no ORM service rewrite, no Pydantic schema consolidation, no fuzzy matcher runtime logic, and no schema reshape beyond legacy parity plus `column_mappings`.

### Full backend regression evidence

- Full backend suite command: `PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest apps/backend/tests -q`
- Result: `162 passed, 4 warnings in 40.79s`
- Warnings observed were pre-existing shape/deprecation warnings in `app/schemas.py` and FastAPI startup-event usage; no new failures were introduced by feature 008.

## Acceptance Mapping

- US1, FR-002, FR-004, FR-009: Phase B
- US2, FR-010, FR-011, FR-012: Phase C
- US3, FR-003, FR-005: Phase D
- US4, FR-015, FR-016: Phase A + D
- FR-001, FR-006, FR-007, FR-013, FR-014, FR-017, FR-018, FR-019: Phase A + E and scope checks

## Exit Criteria For /speckit.tasks

Feature 008 is task-ready when each gate includes:

1. explicit artifacts to touch,
2. deterministic pass/fail evidence,
3. requirement traceability,
4. enforced Round 22 lock decisions.
