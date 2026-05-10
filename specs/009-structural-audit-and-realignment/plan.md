# Implementation Plan: Structural Audit And Directory Realignment

**Branch**: `feat/enhance-ui-ux` | **Date**: 2026-05-10 | **Spec**: `/specs/009-structural-audit-and-realignment/spec.md`
**Input**: Feature specification from `/specs/009-structural-audit-and-realignment/spec.md`

## Summary

Realign `apps/backend/app/` around a clearer `core/` + `apps/` + `utils/` ownership model, adopt a single `AppConfig`-based configuration path with shipped defaults, absorb the service-layer rewrite and `schemas.py` consolidation into the same round, and remove legacy metadata shims without changing public backend behavior or breaking the existing backend test suite. Frontend and tooling adoption remain explicitly out of scope.

## Technical Context

**Language/Version**: Python 3.12 runtime target for backend services  
**Primary Dependencies**: FastAPI `0.115.12`, SQLModel `0.0.22`, SQLAlchemy `2.0.38`, Alembic `1.14.1`, Polars `1.30.0`, DuckDB `1.1.3`, `RecursiveNamespaceV2>=0.0.3` (new), existing backend utility stack  
**Storage**: SQLite metadata database, Parquet data files, packaged YAML defaults under `apps/backend/app/resources/default.yaml`  
**Testing**: `pytest` backend suite under `apps/backend/tests`, import-path and config precedence checks, targeted API contract verification  
**Target Platform**: Linux local development and Linux container runtime
**Project Type**: Backend web-service structural realignment and configuration-governance change  
**Performance Goals**: Preserve current startup and request behavior; any added config/bootstrap work must stay bounded to startup and remain operationally negligible relative to existing backend boot  
**Constraints**: Zero intentional API regression, preserve public function signatures where service internals move, preserve relationship-rule behavior, no frontend layout changes, no tooling migration, remove bare env reads and metadata shims from `apps/backend/app/`  
**Scale/Scope**: Entire backend application package under `apps/backend/app/`, including entry points, configuration access, service internals, schema surface, and import graph hygiene

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. Principle I (Business-question-first): PASS. This round answers whether the backend can be structurally realigned and simplified without disrupting release behavior.
2. Principle II (Metric contract before visualization): PASS. No metric contract or visualization semantics change.
3. Principle III (Relationship rule before cross-table query): PASS. Relationship-rule semantics remain unchanged even if internal modules move.
4. Principle IV (Reconciliation before recommendation): PASS. No recommendation or reconciliation behavior is introduced.
5. Principle V (Challenge and sensitivity before decision-ready): PASS. No decision-ready analytical surface changes are in scope.
6. Principle VI (Traceability for every claim): PASS WITH REQUIREMENT. The structural audit, move plan, env-read removal, schema consolidation boundaries, and metadata shim removal must be evidenced in research, contracts, and tests.
7. Principle VII (Reproducibility from raw inputs): PASS WITH REQUIREMENT. The backend must remain reproducible from packaged defaults plus explicit overrides, with stable entry points and testable import/layout convergence.

Post-Phase 1 re-check:

- PASS. `research.md`, `data-model.md`, `contracts/backend-structural-alignment.contract.yaml`, and `quickstart.md` preserve the spec’s locked scope, define clear verification boundaries, and keep public behavior and tests as non-negotiable invariants.

## Project Structure

### Documentation (this feature)

```text
specs/009-structural-audit-and-realignment/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── backend-structural-alignment.contract.yaml
├── checklists/
└── tasks.md
```

### Source Code (repository root)

```text
apps/
└── backend/
    ├── app/
    │   ├── main.py
    │   ├── schemas.py
    │   ├── core/
    │   │   ├── config.py
    │   │   ├── db.py
    │   │   ├── logging.py
    │   │   ├── metadata_db.py
    │   │   ├── metadata_migrations.py
    │   │   └── startup_validation.py
    │   ├── models/
    │   │   ├── workspace.py
    │   │   ├── source.py
    │   │   ├── legacy_files.py
    │   │   ├── relationship.py
    │   │   ├── saved_query.py
    │   │   ├── dashboard.py
    │   │   ├── deployment.py
    │   │   └── column_mappings.py
    │   ├── services/
    │   │   ├── audit_service.py
    │   │   ├── backup_service.py
    │   │   ├── dashboard_service.py
    │   │   ├── deployment_service.py
    │   │   ├── manifest_service.py
    │   │   ├── panel_executor_service.py
    │   │   ├── query_service.py
    │   │   ├── relationship_service.py
    │   │   └── ...
    │   └── utils/
    │       └── env_helper.py
    ├── requirements.txt
    └── tests/
        ├── contract/
        └── integration/
```

**Structure Decision**: Keep the monorepo and backend package boundaries intact, but converge `apps/backend/app/` toward the target layout defined in the spec by adding explicit entry-point, config, and ownership modules (`__main__.py`, `shared.py`, `resources/default.yaml`, `api/`, `apps/`) and re-homing current code into those boundaries without changing public API behavior.

## Phase 0: Research (Completed)

Resolved in `research.md`:

1. Structural audit method and evidence source, including the CRG limitation around backend model visibility.
2. Target backend layout and move boundaries for `core/`, `apps/`, `utils/`, `api/`, `models/`, and entry-point files.
3. Configuration manager adoption strategy using `AppConfig`, `Const`, `Fields`, `EnvVar`, packaged defaults, and layered precedence.
4. Service-layer rewrite boundary and sequencing inside the same round while preserving public behavior.
5. `schemas.py` consolidation strategy that preserves request and response payload contracts.
6. Metadata shim removal criteria and import-cleanliness verification.

## Phase 1: Design And Contracts (Completed)

1. `data-model.md`: defines the structural audit entities, layout contract, unified configuration contract, service migration slices, schema consolidation surface, and metadata shim removal state.
2. `contracts/backend-structural-alignment.contract.yaml`: defines required inputs, invariants, precedence rules, migration/removal sequencing, and verification evidence.
3. `quickstart.md`: defines execution-ready validation gates for audit evidence, layout convergence, config precedence, import cleanup, schema compatibility, and regression safety.
4. Agent context updated in `.github/copilot-instructions.md` to reference this plan.

## Phase 2: Implementation Plan (Execution-Ready)

### Track 1: Audit And Ownership Mapping

1. Produce the approved structural audit for `apps/backend/app/`, using direct file/import evidence as the primary source and CRG output as supplemental where graph coverage is reliable (FR-001).
2. Record the current-to-target layout mapping, including which files move, split, stay in place, or are deleted (FR-002, FR-018).
3. Freeze explicit out-of-scope boundaries for frontend layout and tooling adoption in the round artifacts (FR-003, FR-019).

**Gate A (Audit Approved)**

- The round has a reviewable move plan covering every touched backend module.
- The plan names all additions to the target layout and all deferred frontend/tooling items.

### Track 2: Config Manager Convergence

1. Add `shared.py` and `resources/default.yaml` to establish the shipped config surface (FR-004, FR-005, FR-006).
2. Introduce `RecursiveNamespaceV2`, `AppConfig`, `Const`, `Fields`, and align `EnvVar` helpers with the new access path (FR-007, FR-008).
3. Remove bare `os.getenv` and `os.environ` reads from `apps/backend/app/`, replacing them with `AppConfig` accessors or `EnvVar` helpers (FR-009).
4. Preserve stable backend entry points while routing startup through the new config surface (FR-017).

**Gate B (Configuration Unified)**

- Configuration precedence behaves as `.env < app/resources/default.yaml < CONFIG_FILE`.
- No bare env reads remain in `apps/backend/app/`.
- Startup and runtime still resolve the same effective operational values.

### Track 3: Directory Realignment And Service Absorption

1. Create the missing target structure under `apps/backend/app/`: `__main__.py`, `shared.py`, `resources/default.yaml`, `api/`, and `apps/` while preserving `core/`, `models/`, `services/`, and `utils/` responsibilities (FR-002, FR-018).
2. Move API-facing request/response handling into `api/` and orchestrator logic into `apps/`, leaving framework primitives in `core/` and cross-cutting helpers in `utils/` (FR-002, FR-018).
3. Absorb the service-layer rewrite by migrating service internals from raw `sqlite3` access toward SQLModel `Session` usage one file at a time, without changing public function signatures or route behavior (FR-010, FR-012).
4. Preserve current relationship-rule behavior and endpoint outputs throughout the move sequence (FR-012).

**Gate C (Layout And Service Convergence)**

- The backend tree matches the required target layout.
- Touched services preserve their external contracts while internal data access may change.
- Public runtime behavior remains unchanged under the updated import graph.

### Track 4: Schema Consolidation And Shim Removal

1. Consolidate `schemas.py` into the approved schema surface, splitting or regrouping DTO definitions as needed while preserving request/response payload shapes and imports consumed by the API layer (FR-011, FR-012).
2. Remove `init_metadata_db()` and then delete `metadata_db.py` once no remaining imports or references depend on deleted shims (FR-013, FR-014, FR-015).
3. Update imports and tests only as needed for path moves or internal refactors, without redefining expected public behavior (FR-016).

**Gate D (Compatibility And Cleanup)**

- No imports under `apps/backend/app/` reference deleted metadata shims.
- API request/response contract verification stays green after schema consolidation.
- Existing backend tests continue passing without semantic expectation changes.

## Requirement Traceability Matrix

| Requirement | Data Layer                                                              | Metric Contract | Relationship Rule                                 | Surface Role   | Gate           | Test                                                                                        |
| ----------- | ----------------------------------------------------------------------- | --------------- | ------------------------------------------------- | -------------- | -------------- | ------------------------------------------------------------------------------------------- |
| FR-001      | Structural audit artifact for `apps/backend/app/` ownership map         | N/A             | Preserve existing semantics                       | audit / export | Gate A         | Audit checklist + import graph evidence                                                     |
| FR-002      | Backend layout contract under `apps/backend/app/`                       | N/A             | Preserve existing semantics                       | audit / export | Gate A, Gate C | Tree/layout verification + startup smoke                                                    |
| FR-003      | No frontend source movement in this feature                             | N/A             | N/A                                               | audit / export | Gate A         | Diff review scoped to backend only                                                          |
| FR-004      | `AppConfig` singleton and `shared.py` surface                           | N/A             | N/A                                               | audit / export | Gate B         | Config loading tests + runtime smoke                                                        |
| FR-005      | Layered config precedence via `.env`, defaults, `CONFIG_FILE`           | N/A             | N/A                                               | audit / export | Gate B         | Config precedence tests                                                                     |
| FR-006      | Packaged defaults at `app/resources/default.yaml`                       | N/A             | N/A                                               | audit / export | Gate B         | Default-config resolution test                                                              |
| FR-007      | `RecursiveNamespaceV2` config object behavior                           | N/A             | N/A                                               | audit / export | Gate B         | Config object initialization tests                                                          |
| FR-008      | `Const` and `Fields` constants replace scattered strings                | N/A             | N/A                                               | audit / export | Gate B         | Static usage sweep + focused unit checks                                                    |
| FR-009      | Bare env reads removed from `apps/backend/app/`                         | N/A             | N/A                                               | audit / export | Gate B         | Search for bare `os.getenv` and `os.environ` in `apps/backend/app` and confirm zero hits    |
| FR-010      | Service internals migrate slice-by-slice toward SQLModel `Session`      | N/A             | Preserve existing relationship and query behavior | audit / export | Gate C         | Focused service regression tests + API smoke                                                |
| FR-011      | Consolidated schema surface replacing monolithic `schemas.py` ownership | N/A             | Preserve existing semantics                       | audit / export | Gate D         | API contract tests + import verification                                                    |
| FR-012      | Public backend behavior unchanged                                       | N/A             | Preserve existing semantics                       | audit / export | Gate C, Gate D | Existing backend test suite + endpoint smoke                                                |
| FR-013      | `init_metadata_db()` removed                                            | N/A             | N/A                                               | audit / export | Gate D         | Grep/import verification + tests                                                            |
| FR-014      | `metadata_db.py` deleted after dependency removal                       | N/A             | N/A                                               | audit / export | Gate D         | Grep/import verification + tests                                                            |
| FR-015      | No remaining references to deleted metadata shims                       | N/A             | N/A                                               | audit / export | Gate D         | Search for `metadata_db` and `init_metadata_db` in `apps/backend/app` and confirm zero hits |
| FR-016      | Existing backend tests keep passing                                     | N/A             | Preserve existing semantics                       | audit / export | Gate D         | `PYTHONPATH=apps/backend pytest apps/backend/tests -q`                                      |
| FR-017      | Stable `__main__.py` and `main.py` entry-point behavior                 | N/A             | N/A                                               | audit / export | Gate B         | Backend startup smoke + import checks                                                       |
| FR-018      | `core/`, `apps/`, and `utils/` ownership boundaries are enforced        | N/A             | Preserve existing semantics                       | audit / export | Gate A, Gate C | Structural audit review + module placement checks                                           |
| FR-019      | Tooling adoption stays out of scope                                     | N/A             | N/A                                               | audit / export | Gate A         | Diff review scoped away from tooling changes                                                |

## Verification Matrix

1. Structural verification: approved audit report, current-to-target move map, and backend tree convergence.
2. Configuration verification: packaged defaults, `.env`, and `CONFIG_FILE` precedence checks plus zero remaining bare env reads.
3. Behavior verification: existing backend tests plus targeted API contract checks stay green.
4. Cleanup verification: zero remaining metadata shim imports and successful deletion sequencing.
5. Scope verification: frontend and tooling changes remain excluded from the round.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |
