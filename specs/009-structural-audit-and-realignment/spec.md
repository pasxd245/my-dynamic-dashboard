# Feature Specification: Structural Audit & Directory Realignment

**Feature Branch**: `009-structural-audit-and-realignment`  
**Created**: 2026-05-10  
**Status**: Draft  
**Input**: User description: "Create a new Spec Kit feature spec for PDCA Round 23 structural audit and directory realignment with locked scope for backend layout, config-manager adoption, service-layer rewrite, and schemas consolidation"

## Business Question _(mandatory for this project)_

> "Can we realign `apps/backend/app/` into a clearer `core/` + `apps/` + `utils/` structure, adopt a single backend configuration manager, and absorb the service-layer and schema consolidation work in the same round without changing public backend behavior?"

**Decision consumed**: Whether Round 23 can safely complete the backend structural realignment needed to reduce coupling, remove legacy shims, and prepare the codebase for future delivery without disrupting current API and test behavior.

## Role

**Primary roles**: Backend maintainer (structure, imports, service internals, and config governance), release owner (regression control and migration safety), analyst user (expects unchanged behavior from backend workflows).

**Surface role**: audit / export

This round is primarily an internal structural and operational alignment change. Its visible output is audit evidence that the backend layout, configuration access, and service internals were realigned without changing public contracts.

## Required Metric Contracts

- N/A for this round. No business metric, KPI, or decision surface is added, renamed, or redefined.

## Required Relationship Rules

- Preserve current relationship-rule behavior and API outcomes without semantic change.
- No new relationship-rule lifecycle, matching policy, or cross-table business rule is introduced in this round.

## Required Reconciliation

- Reconcile the current backend layout against the target `core/` + `apps/` + `utils/` layout patterned after `i18n-tool/core/src/i18n_tools/`.
- Reconcile existing scattered environment and default-setting behavior into a single configuration path with precedence `.env < app/resources/default.yaml < MDD_CONFIG_FILE`.
- Reconcile raw `sqlite3` and SQLModel-session service internals one file at a time while preserving public function contracts and API responses.
- Reconcile existing response DTOs and `schemas.py` usage into a consolidated schema surface without API contract regressions.
- Reconcile legacy metadata initialization ownership so deleted metadata shims are no longer imported anywhere in `apps/backend/app/`.

## Challenge Variants

- Structural audit driven by CRG or equivalent community and bridge-node analysis before file moves are finalized.
- Backend startup and runtime behavior challenged before and after directory moves to confirm imports and app entry points remain stable.
- Configuration precedence challenged with `.env` only, packaged defaults only, and `.env` plus `MDD_CONFIG_FILE` override.
- Service files challenged incrementally as internals move from raw `sqlite3` access to SQLModel `Session` usage while external behavior stays fixed.
- Schema consolidation challenged against current API request and response contracts to confirm no regression in serialized outputs.

## Decision-Readiness Gates

- Gate A: CRG or equivalent structural analysis must produce an audit-backed move plan before directory realignment begins.
- Gate B: Target backend layout must converge to `__main__.py`, `main.py`, `shared.py`, `resources/default.yaml`, `api/`, `apps/`, `core/`, `models/`, `services/`, and `utils/` under `apps/backend/app/`.
- Gate C: Configuration access must converge on `AppConfig` accessors or `EnvVar` helpers, with no remaining bare `os.getenv` or `os.environ` reads in `apps/backend/app/`.
- Gate D: `init_metadata_db()` and `metadata_db.py` may be removed only after no remaining imports of deleted metadata shims exist.
- Gate E: Backend tests must continue passing with only necessary internal or import-path adjustments and without intended public behavior changes.

## Traceability Surfaces

- Spec requirements and success criteria in this document.
- Structural audit findings in `research.md` for this feature.
- Plan traceability matrix in `plan.md` and requirement-linked tasks in `tasks.md`.
- Verification evidence in backend tests, config precedence checks, import-removal checks, and round-level audit notes.

## Constitution Alignment

- **Principle I (Business-Question-First)**: Scope answers a maintainability and release-safety question about whether the backend can be structurally realigned without changing user-facing behavior.
- **Principle II (Metric Contract Before Visualization)**: No metric contract or visualization behavior is introduced or modified.
- **Principle III (Relationship Rule Before Cross-Table Query)**: Relationship-rule behavior is preserved; this round changes structure and internal wiring, not business join semantics.
- **Principle IV (Reconciliation Before Recommendation)**: No recommendation outputs are added.
- **Principle V (Challenge & Sensitivity Before Decision-Ready)**: No decision-ready analytical output is introduced or promoted in this round.
- **Principle VI (Traceability For Every Claim)**: The structural audit, move plan, config precedence rules, and metadata-shim removals must be evidenced and reviewable.
- **Principle VII (Reproducibility From Raw Inputs)**: Backend behavior must remain reproducible after layout changes through packaged defaults, explicit config precedence, stable entry points, and passing tests.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Realign Backend Layout Without Breaking Runtime Behavior (Priority: P1)

As a backend maintainer, I need the backend app directory reorganized into a clearer target layout so ownership boundaries are easier to understand and evolve without breaking current backend behavior.

**Why this priority**: The round exists to reduce structural drift and coupling. If the layout cannot be realigned safely, the round fails its primary purpose.

**Independent Test**: Compare the post-change backend tree against the target layout, run the backend application and tests, and verify imports, entry points, and public behavior still work.

**Acceptance Scenarios**:

1. **Given** the current `apps/backend/app/` layout, **When** Round 23 completes, **Then** the backend app directory contains `__main__.py`, `main.py`, `shared.py`, `resources/default.yaml`, `api/`, `apps/`, `core/`, `models/`, `services/`, and `utils/` with responsibilities aligned to that structure.
2. **Given** existing backend routes and workflows, **When** imports and files are realigned into the target structure, **Then** runtime behavior and public API contracts remain unchanged.

---

### User Story 2 - Unify Backend Configuration Access (Priority: P1)

As a backend maintainer, I need all backend configuration to resolve through one configuration manager so defaults, overrides, and environment access are predictable and reviewable.

**Why this priority**: Config sprawl and scattered environment reads are a direct source of drift and inconsistent runtime behavior.

**Independent Test**: Run the backend with packaged defaults only, with `.env` overrides, and with a custom `MDD_CONFIG_FILE`, then confirm resolved values follow the required precedence and no direct bare env reads remain in `apps/backend/app/`.

**Acceptance Scenarios**:

1. **Given** no custom config file, **When** the backend resolves configuration, **Then** values are loaded from `.env` and `app/resources/default.yaml` with packaged defaults available in the application package.
2. **Given** `.env`, packaged defaults, and a `MDD_CONFIG_FILE` override are all present, **When** configuration is loaded, **Then** precedence resolves as `.env < default.yaml < MDD_CONFIG_FILE`.
3. **Given** backend code under `apps/backend/app/`, **When** the round is complete, **Then** direct `os.getenv` and `os.environ` reads are absent and configuration is accessed through `AppConfig` accessors or `EnvVar` helpers.

---

### User Story 3 - Absorb Service And Schema Consolidation Safely (Priority: P2)

As a release owner, I need the service-layer rewrite and schema consolidation absorbed into this round in a controlled way so the repository does not carry another transitional architecture round.

**Why this priority**: The scope was explicitly locked to absorb this work in Round 23, but it must remain bounded by no-regression expectations.

**Independent Test**: Migrate service internals incrementally, validate unchanged public service contracts and API responses after each slice, and confirm schema consolidation does not change external response shapes.

**Acceptance Scenarios**:

1. **Given** backend services that currently rely on raw `sqlite3` internals, **When** service files are migrated one at a time, **Then** their public contracts remain stable while internals may use SQLModel `Session` access.
2. **Given** existing response DTOs and schema definitions, **When** schema consolidation is completed, **Then** response payload shape and API contract behavior remain unchanged.

---

### User Story 4 - Remove Legacy Metadata Shims Cleanly (Priority: P2)

As a backend maintainer, I need unused metadata initialization shims removed so the backend no longer depends on transitional persistence code from the previous round.

**Why this priority**: Legacy shims hide architectural ownership and create false rollback paths once the structural realignment is complete.

**Independent Test**: Remove `init_metadata_db()` and `metadata_db.py`, verify no imports remain, and rerun backend tests to confirm no behavior regression.

**Acceptance Scenarios**:

1. **Given** the legacy metadata shim files and imports, **When** Round 23 completes, **Then** `init_metadata_db()` is deleted, `metadata_db.py` is removed, and no remaining imports reference deleted metadata shims.
2. **Given** the post-realignment backend, **When** automated tests run, **Then** they pass without requiring behavior-changing test rewrites.

### Edge Cases

- CRG or equivalent structural analysis identifies a move that conflicts with preserving existing import stability.
- A service file can migrate its internals to SQLModel `Session` usage only partially in this round and must coexist with adjacent services that still use prior access patterns.
- Consolidating `schemas.py` reveals duplicate DTO names or overlapping responsibilities while public response shapes must stay unchanged.
- Packaged defaults exist but `.env` or `MDD_CONFIG_FILE` is missing, malformed, or only partially populated.
- A moved module still has stale imports from deleted metadata shims or stale references to old package paths.
- A bare environment read is hidden behind a helper or indirect import and must still be eliminated by end-of-round verification.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The round MUST begin with a structural audit of `apps/backend/app/` informed by CRG or equivalent community-analysis evidence, and that audit MUST define the approved move and rename plan.
- **FR-002**: The backend app layout MUST converge on a target structure containing `__main__.py`, `main.py`, `shared.py`, `resources/default.yaml`, `api/`, `apps/`, `core/`, `models/`, `services/`, and `utils/` under `apps/backend/app/`.
- **FR-003**: The round MUST keep builder and other frontend layout changes out of scope.
- **FR-004**: The backend MUST adopt an `AppConfig` singleton configuration manager with parity to the referenced i18n-tool pattern, including lazy access to resolved settings needed by current backend workflows.
- **FR-005**: Backend configuration loading MUST use layered precedence of `.env < app/resources/default.yaml < MDD_CONFIG_FILE`.
- **FR-006**: The backend MUST adopt an in-package default configuration file at `apps/backend/app/resources/default.yaml` as the shipped default configuration source.
- **FR-007**: The backend MUST wrap the published `RecursiveNamespaceV2` library directly for configuration object behavior, with `AppConfig` delegating config reads to the library rather than reimplementing namespace behavior in a custom dict wrapper.
- **FR-008**: The backend MUST define and use `Const` and `Fields` constant sets sufficient to replace scattered magic strings for configuration access in this round.
- **FR-009**: All bare `os.getenv` and `os.environ` reads in `apps/backend/app/` MUST be replaced by `AppConfig` accessors or `EnvVar` helpers by the end of the round.
- **FR-010**: Service-layer rewrite is in scope for this round, and backend service internals MAY migrate from raw `sqlite3` access to SQLModel `Session` usage one file at a time while preserving public function signatures and behavior.
- **FR-011**: `schemas.py` and response DTO consolidation is in scope for this round and MUST preserve existing API request and response contracts.
- **FR-012**: The round MUST preserve public backend behavior, and structural or internal changes MUST NOT introduce intentional API contract regressions.
- **FR-013**: The backend MUST remove the unused `init_metadata_db()` function during this round.
- **FR-014**: The backend MUST delete `metadata_db.py` after all imports and references to deleted metadata shims are removed.
- **FR-015**: No remaining imports in `apps/backend/app/` MAY reference deleted metadata shims at the end of the round.
- **FR-016**: Existing backend tests MUST continue passing with only necessary import-path or internal adjustments and without changes that redefine expected public behavior.
- **FR-017**: The round MUST retain backend entry-point behavior through the realigned `__main__.py` and `main.py` structure so application startup remains stable after moves.
- **FR-018**: Shared structural responsibilities MUST align with the target layout: `core/` contains framework primitives without use-case knowledge, `apps/` contains per-use-case orchestrators, and `utils/` contains cross-cutting utilities without domain-specific business logic.
- **FR-019**: Tooling adoption such as `pyproject.toml`, Ruff, Commitizen, and `hatch-vcs` MUST remain out of scope for this feature.

### Key Entities _(include if feature involves data)_

- **Structural Audit Report**: Review artifact that captures current coupling hot spots, approved move boundaries, and the target directory alignment for backend modules.
- **Backend Layout Contract**: The required module and directory structure for `apps/backend/app/`, including entry points, config surface, and ownership boundaries for `api`, `apps`, `core`, `models`, `services`, and `utils`.
- **Application Configuration Contract**: Unified configuration surface composed from environment variables, packaged defaults, and optional custom config overrides, exposed through `AppConfig`, `Const`, `Fields`, and `EnvVar` access paths.
- **Service Contract**: Existing public function signatures and route-level behavior that must remain stable while service internals are rewritten incrementally.
- **Schema Surface**: Consolidated request and response DTO definitions that preserve current external API behavior.
- **Metadata Shim Removal State**: Verification state showing legacy metadata initialization helpers and imports have been fully removed from the backend app.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The structural audit produces an approved move plan covering all backend modules affected by Round 23 before directory realignment begins.
- **SC-002**: The backend app tree matches the target layout at round completion, with all required top-level files and directories present under `apps/backend/app/`.
- **SC-003**: Configuration precedence behaves consistently across three scenarios: packaged defaults only, `.env` plus defaults, and `.env` plus defaults plus `MDD_CONFIG_FILE`, with the highest-precedence source winning in each case.
- **SC-004**: End-of-round verification finds zero remaining bare `os.getenv` or `os.environ` reads in `apps/backend/app/`.
- **SC-005**: End-of-round verification finds zero remaining imports or references to deleted metadata shims in `apps/backend/app/`.
- **SC-006**: Existing backend automated tests pass after the realignment with no intended public behavior regressions.
- **SC-007**: API contract verification confirms schema consolidation does not change expected request or response shapes for covered backend endpoints.

## Assumptions

- Round 23 scope is explicitly locked to absorb both the service-layer rewrite and schema consolidation work rather than deferring them to a separate transition round.
- Structural analysis may be performed with CRG tooling or an equivalent community-analysis method if the same audit intent is preserved.
- Builder and other frontend layout changes remain deferred to a future round even if backend naming alignment highlights similar issues there.
- Necessary test edits are limited to import-path or internal adjustments required by structural moves and do not redefine expected external behavior.
- The i18n-tool layout and config-manager pattern are reference inputs for structure and precedence behavior, not a reason to change business semantics.

## Traceability

- **PDCA Round Source**: Round 23 draft in `.agents/plan/cycles/Round_23.md` is the controlling scope input for this feature.
- **Requirement Coverage**: FR-001 through FR-009 define the structural audit and config-manager alignment; FR-010 through FR-012 define absorbed service and schema scope with no-regression constraints; FR-013 through FR-019 define legacy cleanup, verification boundaries, and exclusions.
- **Verification Intent**: SC-001 through SC-007 define the audit, layout, config, shim-removal, test, and API-contract evidence needed before proceeding to planning and implementation.
