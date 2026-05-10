# Tasks: Test Scaffolding and MVP-1 Performance Harness

**Input**: Design documents from `/specs/012-test-scaffolding-and-mvp1-performance-harness/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: This feature explicitly requires test and verification tasks. Include deterministic evidence for every completed task (files changed, commands run, tests/functions touched).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish backend-only task guardrails, baseline inventory, and execution entrypoints before structural changes.

- [x] T001 Document feature execution scope and zero-production-change constraint in specs/012-test-scaffolding-and-mvp1-performance-harness/tasks.md and specs/012-test-scaffolding-and-mvp1-performance-harness/plan.md
- [x] T002 Create baseline test inventory report with current file-to-layer mapping in apps/backend/tests/README.md (or create if missing) and attach reconciliation notes in specs/012-test-scaffolding-and-mvp1-performance-harness/quickstart.md
- [x] T003 [P] Add/confirm pytest marker declarations for perf profile in apps/backend/pyproject.toml and backend test marker guidance in apps/backend/pytest.ini
- [x] T004 [P] Create deterministic evidence template for PDCA Do completion in specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/evidence-template.md including required fields (task ID, files, functions/tests, command output summary)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Put shared test architecture in place before any user-story specific migration work.

**⚠️ CRITICAL**: No user story implementation starts until this phase is complete.

- [x] T005 Define canonical layer governance and failure interpretation in apps/backend/tests/README.md for `unit`, `integration`, and `contract`
- [x] T006 Build/normalize shared factory package scaffold with explicit exports in apps/backend/tests/factories/**init**.py and apps/backend/tests/factories/base.py
- [x] T007 [P] Consolidate shared pytest fixtures that are cross-layer and deterministic into apps/backend/tests/conftest.py and remove duplicate fixture definitions from layer-local conftest files
- [x] T008 [P] Add lightweight layer attribution checks (file path + marker policy) in apps/backend/tests/unit/test_layer_attribution.py and apps/backend/tests/contract/test_layer_attribution.py
- [x] T009 Define perf harness execution profile, shared timing utility, and result schema in apps/backend/tests/perf/conftest.py and apps/backend/tests/perf/utils.py
- [x] T010 Add backend test command matrix (default, per-layer, perf) and expected evidence artifacts to docs/development/setup.md

**Checkpoint**: Foundation ready; user story work can proceed.

---

## Phase 3: User Story 1 - Enforce Test-Layer Boundaries (Priority: P1) 🎯 MVP

**Goal**: Ensure every backend test belongs to exactly one canonical layer with documented interpretation and deterministic triage scope.

**Independent Test**: Running `cd apps/backend && pytest tests/unit tests/integration tests/contract -q` succeeds and attribution checks prove all migrated tests map to a single layer.

### Tests for User Story 1

- [x] T011 [P] [US1] Add layer-boundary governance tests for unit restrictions in apps/backend/tests/unit/test_layer_boundaries.py
- [x] T012 [P] [US1] Add layer-boundary governance tests for integration restrictions in apps/backend/tests/integration/test_layer_boundaries.py
- [x] T013 [P] [US1] Add layer-boundary governance tests for contract restrictions in apps/backend/tests/contract/test_layer_boundaries.py

### Implementation for User Story 1

- [x] T014 [US1] Reorganize/migrate ambiguous legacy tests into canonical folders under apps/backend/tests/unit, apps/backend/tests/integration, and apps/backend/tests/contract with per-file attribution notes in apps/backend/tests/README.md
- [x] T015 [US1] Update backend test invocation docs and triage guidance for layer-specific runs in apps/backend/tests/README.md and specs/012-test-scaffolding-and-mvp1-performance-harness/quickstart.md
- [x] T016 [US1] Capture US1 reconciliation evidence (migrated files list, executed commands, failing-to-passing proof) in specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/us1-evidence.md

**Checkpoint**: US1 is independently testable and supplies deterministic attribution evidence.

---

## Phase 4: User Story 2 - Standardize Test Data Factories (Priority: P1)

**Goal**: Replace ad-hoc setup with deterministic, reusable hand-rolled factories consumable across all test layers.

**Independent Test**: Representative unit, integration, and contract tests use shared factories from apps/backend/tests/factories with explicit overrides and no duplicated domain setup blocks.

### Tests for User Story 2

- [x] T017 [P] [US2] Add deterministic factory behavior tests for defaults and override semantics in apps/backend/tests/unit/test_factories.py
- [x] T018 [P] [US2] Add cross-layer factory consumption coverage in apps/backend/tests/integration/test_factory_consumption.py
- [x] T019 [P] [US2] Add contract-layer factory consumption coverage in apps/backend/tests/contract/test_factory_consumption.py

### Implementation for User Story 2

- [x] T020 [P] [US2] Implement core domain factory helpers with deterministic defaults and typed override signatures in apps/backend/tests/factories/domain.py
- [x] T021 [P] [US2] Implement workflow-specific factory compositions for upload/preview/export setup in apps/backend/tests/factories/workflows.py
- [x] T022 [US2] Refactor representative tests in apps/backend/tests/unit, apps/backend/tests/integration, and apps/backend/tests/contract to consume shared factories and remove duplicated fixture boilerplate
- [x] T023 [US2] Consolidate fixture composition helpers that wrap factories in apps/backend/tests/conftest.py with explicit scope/lifecycle comments
- [x] T024 [US2] Capture US2 reconciliation evidence (factory APIs, touched tests/functions, duplication removed, executed commands) in specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/us2-evidence.md

**Checkpoint**: US2 is independently testable with deterministic shared factory usage across layers.

---

## Phase 5: User Story 3 - Validate MVP-1 Performance SLOs Early (Priority: P2)

**Goal**: Provide an opt-in pytest perf harness that measures and asserts MVP-1 SLO thresholds for upload, preview, and export flows.

**Independent Test**: Running `cd apps/backend && pytest -m perf tests/perf -q` reports explicit pass/fail for all required scenarios with reproducibility context.

### Tests for User Story 3

- [x] T025 [P] [US3] Add upload 100k-row perf scenario assertion (<30s) in apps/backend/tests/perf/test_upload_perf.py
- [x] T026 [P] [US3] Add preview perf scenario assertion (<5s) in apps/backend/tests/perf/test_preview_perf.py
- [x] T027 [P] [US3] Add export perf scenario assertion (<30s) in apps/backend/tests/perf/test_export_perf.py

### Implementation for User Story 3

- [x] T028 [US3] Implement shared perf run recorder for per-scenario status and environment context in apps/backend/tests/perf/recorder.py
- [x] T029 [US3] Wire perf fixture/harness orchestration and marker behavior in apps/backend/tests/perf/conftest.py and apps/backend/pyproject.toml
- [x] T030 [US3] Add perf harness usage and evidence capture guidance to specs/012-test-scaffolding-and-mvp1-performance-harness/quickstart.md and docs/development/setup.md
- [x] T031 [US3] Capture US3 reconciliation evidence (scenario files, commands, measured thresholds, run context) in specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/us3-evidence.md

**Checkpoint**: US3 is independently testable with explicit SLO pass/fail outputs and reproducibility metadata.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete non-functional cleanup, behavior-preservation proof, and final deterministic verification artifacts.

- [x] T032 Run behavior-preservation regression suite `cd apps/backend && pytest tests/ -q` and capture results in specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/regression-evidence.md
- [x] T033 [P] Run perf harness verification `cd apps/backend && pytest -m perf tests/perf -q` with `python --version` and `uname -a` context in specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/perf-evidence.md
- [x] T034 [P] Validate zero production behavior-change scope by reviewing changed paths and documenting guardrail compliance in specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/scope-guardrail.md
- [x] T035 Update feature changelog/status summary and task traceability matrix in specs/012-test-scaffolding-and-mvp1-performance-harness/plan.md and specs/012-test-scaffolding-and-mvp1-performance-harness/spec.md
- [x] T036 Final deterministic completion audit: map each task to concrete files/tests/functions and verification commands in specs/012-test-scaffolding-and-mvp1-performance-harness/checklists/final-audit.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Starts immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2; can overlap US1 once foundational items complete.
- **Phase 5 (US3)**: Depends on Phase 2 and factory/perf utilities from T009, T020, T021.
- **Phase 6 (Polish)**: Depends on all selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3 after foundational completion.
- **US2 (P1)**: No dependency on US1/US3 after foundational completion; uses shared scaffold from T006/T007.
- **US3 (P2)**: Depends on foundational perf profile and reusable data setup abstractions from US2.

### Within Each User Story

- Write/enable governance tests before migration/refactor steps.
- Implement shared primitives before broad test rewrites.
- Capture reconciliation evidence only after commands/tests succeed.

### Parallel Opportunities

- Phase 1: T003 and T004 can run in parallel.
- Phase 2: T007 and T008 can run in parallel after T005/T006 start.
- US1: T011, T012, T013 can run in parallel.
- US2: T017, T018, T019 and T020, T021 can run in parallel.
- US3: T025, T026, T027 can run in parallel.
- Polish: T033 and T034 can run in parallel after T032.

---

## Parallel Example: User Story 2

```bash
# Parallel governance tests for factory behavior:
Task: "T017 deterministic factory behavior tests in apps/backend/tests/unit/test_factories.py"
Task: "T018 integration factory consumption in apps/backend/tests/integration/test_factory_consumption.py"
Task: "T019 contract factory consumption in apps/backend/tests/contract/test_factory_consumption.py"

# Parallel factory implementation tracks:
Task: "T020 core domain factories in apps/backend/tests/factories/domain.py"
Task: "T021 workflow compositions in apps/backend/tests/factories/workflows.py"
```

---

## Implementation Strategy

### MVP First (US1 + US2 for governance baseline)

1. Complete Phase 1 and Phase 2.
2. Deliver US1 (layer boundaries).
3. Deliver US2 (shared factories).
4. Validate with default suite (`pytest tests/ -q`) and reconciliation evidence.

### Incremental Delivery

1. Foundation complete (Phases 1-2).
2. Deliver US1 and validate independently.
3. Deliver US2 and validate independently.
4. Deliver US3 perf harness and validate with opt-in marker run.
5. Complete cross-cutting verification and final audit artifacts.

### Parallel Team Strategy

1. Team aligns on foundational tasks and evidence templates.
2. After Phase 2:
   - Developer A: US1 boundary migration + governance tests.
   - Developer B: US2 factory implementation + fixture consolidation.
   - Developer C: US3 perf scenarios + recorder harness.
3. Converge on Polish phase with shared verification evidence.

---

## Notes

- Zero production behavior change is a hard gate for completion.
- Keep all scope within backend tests/tooling/docs surfaces.
- Every completed task must leave deterministic reconciliation evidence (files/tests/functions + command outcomes).
- Perf harness remains opt-in and must not destabilize default pytest workflow.
- Use explicit file paths in PDCA Do updates so completion can be marked deterministically.
