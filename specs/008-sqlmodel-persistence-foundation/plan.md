# Implementation Plan: SQLModel Persistence Foundation

**Branch**: `feat/enhance-ui-ux` | **Date**: 2026-05-10 | **Spec**: `/specs/008-sqlmodel-persistence-foundation/spec.md`
**Input**: Feature specification from `/specs/008-sqlmodel-persistence-foundation/spec.md`

## Summary

Establish SQLModel plus Alembic as the metadata schema ownership layer while preserving current backend behavior and keeping service-layer sqlite3 access unchanged. The plan is constrained by Round 22 locked gates: baseline migration uses per-model `op.create_table()` operations, existing databases are auto-stamped before upgrade when migration state is absent, and service-layer rewrite remains out of scope. The authoritative legacy table inventory and count are recorded in `data-model.md`.

## Technical Context

**Language/Version**: Python 3.12 runtime target for backend services  
**Primary Dependencies**: FastAPI `0.115.12`, SQLModel (new, pinned), SQLAlchemy (new, pinned), Alembic (new, pinned), Polars `1.30.0`, DuckDB `1.1.3`  
**Storage**: SQLite metadata database (`metadata.db`, env-overridable via `METADATA_DB_PATH`) plus existing Parquet data files  
**Testing**: `pytest` (existing backend suite under `apps/backend/tests`)  
**Target Platform**: Linux container and local Linux development
**Project Type**: Backend web-service persistence foundation change  
**Performance Goals**: No startup regression beyond migration/bootstrap overhead; repeated startup remains idempotent for fresh and existing databases  
**Constraints**: Zero behavior regression, no service rewrite to ORM sessions, no schema reshaping beyond parity plus `column_mappings`, backward-safe startup for pre-existing DB files  
**Scale/Scope**: 26 legacy metadata tables moved to declarative ownership, plus 1 new `column_mappings` table and migration tracking state

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. Principle I (Business-question-first): PASS. The feature answers a release safety question about schema governance without changing analyst workflows.
2. Principle II (Metric contract before visualization): PASS. No metric contract or visualization behavior changes are introduced.
3. Principle III (Relationship rule before cross-table query): PASS. Relationship-rule behavior remains unchanged; this is persistence governance only.
4. Principle IV (Reconciliation before recommendation): PASS. No recommendation outputs or reconciliation semantics are added.
5. Principle V (Challenge and sensitivity before decision-ready): PASS. No decision-ready promotion or sensitivity labeling changes are in scope.
6. Principle VI (Traceability for every claim): PASS WITH REQUIREMENT. Migration lineage, baseline parity proof, and startup auto-stamp decisions must be documented and testable.
7. Principle VII (Reproducibility from raw inputs): PASS WITH REQUIREMENT. Schema state must be reproducible through versioned migrations and environment-driven DB path resolution.

Post-Phase 1 re-check:

- PASS. `research.md`, `data-model.md`, `contracts/persistence-bootstrap.contract.yaml`, and `quickstart.md` define migration governance, startup sequencing, and reproducible verification steps with explicit in-scope and out-of-scope boundaries.

## Project Structure

### Documentation (this feature)

```text
specs/008-sqlmodel-persistence-foundation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── persistence-bootstrap.contract.yaml
└── tasks.md
```

### Source Code (repository root)

```text
apps/
└── backend/
    ├── app/
    │   ├── core/
    │   │   ├── metadata_db.py
    │   │   └── db.py                    # new in this feature
    │   ├── models/                      # new in this feature
    │   │   ├── workspace.py
    │   │   ├── source.py
    │   │   ├── legacy_files.py
    │   │   ├── relationship.py
    │   │   ├── saved_query.py
    │   │   ├── dashboard.py
    │   │   ├── deployment.py
    │   │   └── column_mappings.py
    │   ├── services/
    │   ├── utils/
    │   │   └── env_helper.py            # new in this feature
    │   └── main.py
    ├── alembic/                         # new in this feature
    │   ├── env.py
    │   ├── script.py.mako
    │   └── versions/
    │       ├── 0001_baseline.py
    │       └── 0002_column_mappings.py
    ├── alembic.ini                      # new in this feature
    ├── requirements.txt
    └── tests/
        ├── contract/
        └── integration/
```

**Structure Decision**: Keep existing monorepo boundaries and modify only backend persistence ownership layers plus operational startup/migration flow. UI and service business behavior stay unchanged.

## Phase 0: Research (Completed)

Resolved in `research.md`:

1. Dependency compatibility and pinning strategy for SQLModel/SQLAlchemy/Alembic.
2. Baseline migration strategy locked to per-model `op.create_table()` operations.
3. Existing-database startup strategy locked to auto-stamp-before-upgrade.
4. Declarative model module partitioning and parity mapping for 26 legacy tables.
5. `column_mappings` shape, validation bounds, and future-use posture.
6. Service-layer hold boundary and anti-scope controls.

## Phase 1: Design And Contracts (Completed)

1. `data-model.md`: defines migration governance entities, parity model groups, `column_mappings`, and startup migration state transitions.
2. `contracts/persistence-bootstrap.contract.yaml`: defines environment, startup sequencing, and migration operation contracts.
3. `quickstart.md`: defines verification gates for parity, idempotence, auto-stamp, and no-behavior-change checks.
4. Agent context updated in `.github/copilot-instructions.md` to reference this plan.

## Phase 2: Implementation Plan (Execution-Ready)

### Track 1: Dependency and Runtime Foundation

1. Pin `sqlmodel`, `sqlalchemy`, and `alembic` in backend requirements (FR-001).
2. Add typed environment helper with `METADATA_DB_PATH` constant and readers (FR-006).
3. Introduce `app/core/db.py` with engine/session factory and `get_session` dependency for future phases without changing current service call paths (FR-007, FR-015, FR-016).

**Gate A (Foundation Ready)**

- Backend imports and startup wiring compile with new dependencies.
- Existing sqlite3-based services remain functionally unchanged.

### Track 2: Declarative Model Ownership And Parity

1. Create `app/models/` module set for legacy domains listed in Round 22 plan (FR-002).
2. Encode parity columns and constraints, including columns previously added through `_add_column_if_missing` startup patching (FR-004).
3. Add `column_mappings` model with required fields, FK links, nullability, and confidence bound contract (FR-003, FR-005).

**Gate B (Schema Parity)**

- Declarative metadata fully represents legacy schema contract.
- Only approved additions are `alembic_version` and `column_mappings`.

### Track 3: Alembic Governance And Startup Orchestration

1. Initialize Alembic under `apps/backend/alembic` with `SQLModel.metadata` target (FR-008).
2. Implement `0001` baseline using per-model `op.create_table()` operations (Round 22 Gate A, FR-009).
3. Implement `0002` migration for `column_mappings` (FR-009).
4. Replace runtime reliance on `init_metadata_db()` in normal startup path with migration-driven boot (`upgrade head`) while leaving legacy function defined for rollback safety (FR-010, FR-011).
5. Add existing-DB auto-stamp path when migration tracking is missing before upgrade (Round 22 Gate B, FR-012).

**Gate C (Migration Safety)**

- Fresh DB boot creates schema at head successfully.
- Existing DB without migration tracking is stamped and upgraded in one boot.
- Upgrade and repeated startup remain idempotent.

### Track 4: Documentation and Verification Evidence

1. Update backend operational docs with migration bootstrap, reset flow, and `METADATA_DB_PATH` usage (FR-013).
2. Execute unchanged backend tests and record parity/idempotence evidence (FR-014, SC-001, SC-003).
3. Execute schema diff and auto-stamp verification workflows (SC-002, SC-004, SC-005).

**Gate D (Release Confidence)**

- All legacy tests pass unchanged.
- Evidence confirms no service-layer behavior regression.

## Requirement Traceability Matrix

| Requirement | Data Layer                                                        | Metric Contract                                 | Relationship Rule                            | Surface Role                     | Gate           | Test                                                           |
| ----------- | ----------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------- | -------------------------------- | -------------- | -------------------------------------------------------------- | --------------------------------------- |
| FR-001      | Backend dependency definitions in `apps/backend/requirements.txt` | N/A                                             | N/A                                          | audit / export                   | Gate A         | Backend import/install validation + full backend pytest        |
| FR-002      | SQLModel modules under `apps/backend/app/models/`                 | N/A                                             | Preserve existing semantics only             | audit / export                   | Gate B         | Schema parity integration tests                                |
| FR-003      | `column_mappings` SQLModel module                                 | N/A                                             | N/A                                          | audit / export                   | Gate B         | Column-mapping migration shape tests                           |
| FR-004      | Declarative parity models + baseline migration                    | N/A                                             | Preserve existing semantics only             | audit / export                   | Gate B         | Legacy-vs-migrated schema parity checks                        |
| FR-005      | `column_mappings` migration schema                                | N/A                                             | N/A                                          | audit / export                   | Gate B         | FK/constraint validation in migration tests                    |
| FR-006      | `METADATA_DB_PATH` env handling                                   | N/A                                             | N/A                                          | audit / export                   | Gate A         | Env-helper tests/usage examples + startup path verification    |
| FR-007      | `app/core/db.py` engine/session foundation                        | N/A                                             | N/A                                          | audit / export                   | Gate C         | Scope-guard tests confirming no runtime session migration      |
| FR-008      | Alembic config, env, and metadata target                          | N/A                                             | N/A                                          | audit / export                   | Gate C         | Alembic upgrade/current commands + migration tests             |
| FR-009      | `0001_baseline` and `0002_column_mappings` revisions              | N/A                                             | Preserve existing semantics only             | audit / export                   | Gate B, Gate C | Parity check + upgrade/downgrade/upgrade cycle                 |
| FR-010      | Startup migration orchestration in `main.py`                      | N/A                                             | N/A                                          | audit / export                   | Gate C         | Fresh DB startup migration test                                |
| FR-011      | Legacy initializer retained as rollback-only path                 | N/A                                             | N/A                                          | audit / export                   | Gate C         | Scope-guard code inspection + full pytest                      |
| FR-012      | Auto-stamp existing untracked DBs                                 | N/A                                             | N/A                                          | audit / export                   | Gate B         | Existing DB auto-stamp integration test                        |
| FR-013      | Backend/operator documentation                                    | N/A                                             | N/A                                          | audit / export                   | Gate D         | Docs review in `quickstart.md` and `docs/development/setup.md` |
| FR-014      | Existing backend tests remain unchanged and passing               | N/A                                             | N/A                                          | audit / export                   | Gate D         | `PYTHONPATH=. pytest tests/ -q`                                |
| FR-015      | Raw `sqlite3` service-layer contract preserved                    | N/A                                             | Preserve existing relationship behavior only | audit / export                   | Gate C         | Service-layer scope-guard tests                                |
| FR-016      | ORM session rewrite excluded                                      | N/A                                             | N/A                                          | audit / export                   | Gate C         | Scope-guard tests + handler inspection                         |
| FR-017      | Pydantic schema consolidation excluded                            | N/A                                             | N/A                                          | audit / export                   | Gate C         | Scope verification in tests/docs                               |
| FR-018      | Fuzzy matcher implementation excluded                             | N/A                                             | N/A                                          | audit / export                   | Gate C         | Scope verification in tests/docs                               |
| FR-019      | No schema reshape beyond parity plus `column_mappings`            | Declarative parity schema + additive table only | N/A                                          | Preserve existing semantics only | audit / export | Gate B                                                         | Schema parity diff and migration review |

## Verification Matrix

1. Parity verification: legacy schema vs. migration-built schema diff, allowing only approved additions.
2. Startup migration verification: fresh DB, existing DB without migration state, repeated startup idempotence.
3. Regression verification: unchanged backend tests pass under new persistence foundation.
4. Scope verification: service-layer sqlite3 paths unchanged; no schema consolidation or fuzzy matcher behavior added.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
