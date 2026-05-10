# Feature Specification: Backend Packaging Tooling Adoption

**Feature Branch**: `011-backend-packaging-tooling-adoption`  
**Created**: 2026-05-10  
**Status**: Draft  
**Input**: User description: "Round 25 backend packaging migration in apps/backend from requirements.txt to pyproject.toml with hatchling+hatch-vcs, ruff, commitizen, pytest/coverage parity with i18n-tool core template, zero behavior change and no code moves"

## Business Question _(mandatory for this project)_

> "Can the backend adopt a standardized Python packaging and quality-tooling baseline so releases are versioned from tags, development setup is reproducible, and existing runtime/test behavior remains unchanged?"

**Decision consumed**: Whether `apps/backend` can move from `requirements.txt` to a `pyproject.toml`-based workflow with the Round 25 locked tooling set and parity guardrails, without changing business behavior.

## Role

**Primary roles**: Backend maintainer (packaging and toolchain ownership), release owner (versioning and changelog reliability), CI/operator maintainer (installation and test workflow continuity).

**Surface role**: internal platform quality and release readiness.

This feature is an internal enablement change. End-user backend behavior, API behavior, and data behavior must remain unchanged.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Install Backend Consistently From Project Metadata (Priority: P1)

As a backend maintainer, I need to install the backend and its development/test tooling from one authoritative project definition so onboarding and CI setup are consistent.

**Why this priority**: Packaging metadata is the foundation of the round. If installation is not consistent, downstream quality and release steps cannot be trusted.

**Independent Test**: In a fresh environment under `apps/backend`, perform editable install with dev/test extras and verify installation succeeds without `requirements.txt`.

**Acceptance Scenarios**:

1. **Given** a clean Python environment, **When** the backend is installed from project metadata with dev/test extras, **Then** installation completes successfully with all required runtime and test dependencies.
2. **Given** the new packaging baseline, **When** developers set up `apps/backend`, **Then** they do not need `requirements.txt` for normal development and testing workflows.

---

### User Story 2 - Keep Existing Backend Behavior Stable (Priority: P1)

As a release owner, I need packaging migration to avoid runtime or functional regressions so the round can ship safely.

**Why this priority**: Round 25 is explicitly constrained to zero behavior change and no structural refactor.

**Independent Test**: Run existing backend tests and backend command-level smoke checks before and after migration and verify equivalent results.

**Acceptance Scenarios**:

1. **Given** existing backend tests, **When** they are executed after packaging migration, **Then** pass/fail behavior remains consistent with pre-migration baseline.
2. **Given** existing backend CLI/service behavior, **When** packaging migration is complete, **Then** no user-visible behavior changes are introduced.

---

### User Story 3 - Standardize Versioning, Linting, and Changelog Workflow (Priority: P2)

As a release maintainer, I need tag-based version resolution, linting standards, and conventional commit-based changelog support to align backend release workflows with the proven reference template.

**Why this priority**: These controls reduce release risk and improve consistency, but depend on successful packaging migration.

**Independent Test**: Verify version metadata resolves from repository tags, lint checks run with agreed rules, and commitizen dry-run can compute a valid next version.

**Acceptance Scenarios**:

1. **Given** repository history and tags, **When** backend version metadata is resolved, **Then** it follows the backend tag format and produces a deterministic version string.
2. **Given** backend source files, **When** lint checks are run, **Then** rules and line-length policy match the Round 25 locked baseline.
3. **Given** conventional commits, **When** changelog/version bump is simulated, **Then** the workflow can determine the next version without manual version edits.

### Edge Cases

- Repository state has no matching backend tags yet; version resolution still returns a valid development version string.
- Development setup scripts or CI jobs still reference `requirements.txt`; migration must update all active references.
- Coverage configuration parity excludes lines that differ from prior backend defaults; migration must preserve meaningful test reporting.
- Auto-generated backend version file appears during build operations; repository cleanliness and ignore rules must remain stable.
- Lint baseline introduces findings in untouched backend files; migration must not mask failures and must keep rule selection explicit.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The backend MUST define packaging metadata in `apps/backend/pyproject.toml` as the single authoritative dependency and tool configuration source for the backend package.
- **FR-002**: The backend packaging setup MUST use hatchling as build backend and hatch-vcs for git-tag-derived versioning.
- **FR-003**: The backend version tag pattern MUST follow `apps/backend/v$version` semantics for backend-specific version resolution.
- **FR-004**: Runtime dependencies currently required by backend execution MUST be represented in the new packaging metadata so runtime behavior remains unchanged.
- **FR-005**: Development and test dependency groups MUST be defined so maintainers can install linting, build, changelog, test, and coverage tooling from project metadata.
- **FR-006**: Backend linting policy MUST be configured with Ruff, line length 120, and rule families `E`, `F`, `B`, `SIM`, and `I`.
- **FR-007**: Commitizen MUST be configured for conventional commits with SCM-backed version provider and backend-scoped tag format.
- **FR-008**: Pytest and coverage configuration MUST be defined in project metadata with parity to the i18n-tool core template for coverage exclusion behavior.
- **FR-009**: Existing backend test discovery scope and command behavior MUST remain compatible with current backend test layout.
- **FR-010**: `apps/backend/requirements.txt` MUST be removed once packaging metadata fully covers backend runtime/development/test dependency needs.
- **FR-011**: Active development or CI installation workflows for backend MUST be updated to install from `pyproject.toml` extras rather than `requirements.txt`.
- **FR-012**: The migration MUST preserve the existing backend package/module layout; no code moves or directory restructuring are allowed in this feature.
- **FR-013**: The migration MUST preserve public backend runtime and API behavior; any behavior-affecting changes are out of scope.
- **FR-014**: The backend version file generated by hatch-vcs MUST be treated as generated artifact and ignored by source control.
- **FR-015**: A backend changelog file MUST exist so commitizen bump workflows have a valid target.

## Non-Goals

- Introduce new backend features, endpoint behavior, or data-model changes.
- Refactor backend architecture, service boundaries, or directory structure.
- Migrate packaging/tooling for other applications in the monorepo during this feature.
- Expand or tighten lint/test policy beyond the Round 25 locked baseline.
- Redesign CI strategy beyond necessary installation-command updates for packaging migration.

## Constraints

- Scope is restricted to `apps/backend` packaging and tooling adoption.
- Migration must maintain zero intentional behavior change.
- No backend code moves are permitted.
- Tooling baseline is locked to hatchling + hatch-vcs, Ruff, Commitizen, and pytest/coverage parity with i18n-tool core template.
- The feature must remain compatible with repository governance and existing Spec Kit flow.

## Required Metric Contracts

- Contract status: Not applicable for this feature.
- Rationale: this round does not define or change business metrics, KPI formulas, or visualization semantics. It changes packaging/tooling only.
- Guardrail: Any metric contract change discovered during implementation is out of scope and must trigger a new feature spec.

## Required Relationship Rules

- Contract status: Not applicable for this feature.
- Rationale: no relationship inference, join cardinality behavior, or cross-table rule logic is modified.
- Guardrail: Any relationship-rule adjustment is out of scope and must be handled in a dedicated relationship feature round.

## Required Reconciliation

- Reconciliation status: Applicable for migration evidence only.
- Requirement: pre/post checks must reconcile parity for install/test/smoke outcomes.
- Evidence surface: `specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md` with before/after command outputs and final traceability matrix.

## Challenge Variants

- Variant A (tagless repository state): version resolution must still produce a valid fallback local/dev version.
- Variant B (existing lint debt): Ruff command must execute under locked rules and report deterministic findings.
- Variant C (long-running smoke commands): startup checks are validated via bounded timeout and startup-log assertions.

## Decision-Readiness Gates

- Gate 1: packaging baseline gate
  - `apps/backend/pyproject.toml` exists and covers runtime + dev/test tooling configuration.
- Gate 2: behavior parity gate
  - backend tests and smoke checks remain parity-consistent pre/post migration.
- Gate 3: release workflow gate
  - version resolution and commitizen dry-run are successful with backend tag format.
- Gate 4: traceability gate
  - requirements-to-evidence mapping is complete in migration evidence.

## Key Entities _(include if feature involves data)_

- **Backend Packaging Contract**: Declares backend package metadata, dependencies, version source, and extras used by maintainers and automation.
- **Tooling Policy Contract**: Declares lint, test, coverage, and conventional commit/changelog rules that backend workflows must follow.
- **Backend Version Artifact**: Generated version file produced from VCS-derived backend version metadata.
- **Backend Install Workflow**: Human/automation setup path that installs backend runtime and optional dev/test capabilities from project metadata.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In a clean environment, backend editable installation with dev/test extras succeeds using only project metadata.
- **SC-002**: Existing backend test suite execution remains stable with no net regression attributable to packaging/tooling migration.
- **SC-003**: `requirements.txt` is fully retired from active backend setup and automation paths.
- **SC-004**: Backend lint checks execute with the locked rule set and line-length policy.
- **SC-005**: Backend version resolution produces a valid version from backend-scoped tags or a valid local development fallback when tags are absent.
- **SC-006**: Conventional commit bump simulation reports a valid next version and changelog target without manual version file edits.
- **SC-007**: Post-migration file movement count inside `apps/backend/app` is zero for this feature.

## Assumptions

- The i18n-tool core template is the source of truth for expected packaging/tooling parity in this round.
- Backend dependency pins and compatibility constraints remain valid when moved into project metadata.
- Existing backend tests are sufficiently representative to detect unintended behavior changes from packaging migration.
- Repository release practices can support backend-scoped version tags.

## Traceability

- **PDCA Round Source**: `.agents/plan/cycles/Round_25.md` is the primary scope authority.
- **Locked Decisions Applied**: backend-only adoption scope, tag pattern policy, Ruff policy, and no-code-move/no-behavior-change constraints.
- **Verification Intent**: installation, lint, tests, version resolution, changelog simulation, and setup-path cleanup provide acceptance evidence for planning and implementation.
