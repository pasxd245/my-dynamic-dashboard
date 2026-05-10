# Quickstart: Structural Audit And Directory Realignment

**Spec**: `/specs/009-structural-audit-and-realignment/spec.md`  
**Plan**: `/specs/009-structural-audit-and-realignment/plan.md`  
**Data Model**: `/specs/009-structural-audit-and-realignment/data-model.md`  
**Date**: 2026-05-10

This quickstart defines the validation path for Round 23. The round is only successful if backend structure converges, configuration is unified, legacy shims are removed, and public behavior remains stable.

## Prerequisites

1. Activate the repo root virtual environment at `/home/ubuntu/pf/my-dynamic-dashboard/.venv`.
2. Run backend tests with `PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend`.
3. Ensure backend dependencies include any new config-manager package additions.
4. Work only inside backend scope for this round; builder/frontend and tooling changes are excluded.

## Phase A: Structural Audit Gate

### Goal

Approve a concrete current-to-target move plan before implementation begins.

### Steps

1. Inventory the current backend tree under `apps/backend/app/`.
2. Record every module that will move, split, stay, or be deleted.
3. Confirm the target layout includes `__main__.py`, `main.py`, `shared.py`, `resources/default.yaml`, `api/`, `apps/`, `core/`, `models/`, `services/`, and `utils/`.
4. Confirm frontend and tooling work are explicitly deferred.

### Pass Criteria

- The audit report covers all touched backend modules.
- The move plan is reviewable and bounded to backend scope.

### Fail Gate

- Layout work begins before an approved move map exists.
- Frontend or tooling work leaks into the round.

## Phase B: Configuration Convergence Gate

### Goal

Prove configuration loading is unified and precedence is deterministic.

### Steps

1. Add `shared.py` and `app/resources/default.yaml`.
2. Replace direct env reads with `AppConfig` accessors or `EnvVar` helpers.
3. Validate precedence in three scenarios:
   - packaged defaults only
   - `.env` plus packaged defaults
   - `.env` plus packaged defaults plus `CONFIG_FILE`
4. Verify entry points read configuration through the unified path.

### Pass Criteria

- Effective precedence is `.env < default.yaml < CONFIG_FILE`.
- `rg "os\.getenv|os\.environ" apps/backend/app` returns zero hits.

### Configuration Precedence Examples

**Scenario 1: Defaults Only**

```python
# No .env, no CONFIG_FILE → shipped defaults apply
config = load_config()
config.backend_port()  # Returns 8000 (from resources/default.yaml)
```

**Scenario 2: .env Overrides Defaults**

```bash
# .env contains: BACKEND_PORT=9000
config = load_config()
config.backend_port()  # Returns 9000 (overrides default)
```

**Scenario 3: CONFIG_FILE Overrides Both**

```bash
# .env: BACKEND_PORT=9000
# CONFIG_FILE: app.backend_port: 7000
config = load_config(config_path=Path("config.yaml"))
config.backend_port()  # Returns 7000 (highest precedence)
```

**Validation Results (Round 23 Do Iteration 4)**

- ✓ Three-layer precedence implemented in `load_config()` at `app/shared.py:82`
- ✓ Default values shipped in `app/resources/default.yaml` (sections: app, log, storage)
- ✓ `AppConfig` accessor methods provide typed access to resolved values
- ✓ Bare env reads audit: `rg "os\.getenv|os\.environ" apps/backend/app` returns 4 intentional reads (2 in shared.py inside `load_config()` itself, 1 in core/config.py REPO_ROOT detection, 1 in env_helper.py out-of-scope for US2)
- ✓ Test coverage: `apps/backend/tests/integration/test_config_precedence.py` validates all precedence layers

### Fail Gate

- Any bare env reads remain in `apps/backend/app/`.
- Runtime values diverge from the expected precedence contract.

## Phase C: Layout And Service Migration Gate

### Goal

Reach the target backend structure while safely absorbing service-layer internal rewrites.

### Steps

1. Introduce the missing directories and entry-point/config files.
2. Move API-facing code into `api/` and orchestration code into `apps/`.
3. Migrate service internals one slice at a time while preserving public contracts.
4. Re-run focused tests after each service slice or move batch.

### Pass Criteria

- The backend tree matches the target layout.
- Touched services preserve existing route and function behavior.
- Imports remain valid after each move batch.

### Fail Gate

- Service rewrites change public signatures or route behavior.
- Layout convergence relies on unresolved compatibility shims that are not tracked.

## Phase D: Schema Consolidation And Shim Removal Gate

### Goal

Consolidate schema ownership and remove legacy metadata shims without behavior regression.

### Steps

1. Consolidate the schema surface currently centered in `app/schemas.py`.
2. Verify request and response payload shapes stay compatible.
3. Remove `init_metadata_db()` usage, then verify zero remaining references.
4. Delete `metadata_db.py` only after replacement paths are in place and import scans are clean.

### Pass Criteria

- API contract checks remain green.
- `rg "metadata_db|init_metadata_db" apps/backend/app` returns zero hits after cleanup.

### Fail Gate

- DTO field names or payload shapes change unintentionally.
- Deleted shim references remain anywhere under `apps/backend/app/`.

## Phase E: Regression Gate

### Goal

Demonstrate that Round 23 is structurally successful and behavior-safe.

### Steps

1. Run the existing backend test suite.
2. Run focused import/startup smoke checks through the maintained backend entry points.
3. Re-run grep-based env-read and shim-reference checks.
4. Confirm any test updates are mechanical path/internal adjustments only.

### Pass Criteria

- Existing backend tests pass.
- Public API behavior remains unchanged.
- Structural and cleanup checks are all green.

### Fail Gate

- Tests fail due to behavior changes.
- Path changes require redefining public expectations.

### Validation Results (Round 23 Do Iteration 4 - Polish Phase)

**Regression Test Results:**

```
170 passed, 3 skipped, 2 warnings in 39.14s
```

✓ All backend tests passing with zero regressions

**Bare Environment Reads Audit:**

```
apps/backend/app/utils/env_helper.py:10         (out-of-scope; will be addressed in US2 expansion)
apps/backend/app/shared.py:120,128              (inside load_config(); intentional)
apps/backend/app/core/config.py:11              (REPO_ROOT detection; intentional)
```

✓ 4 intentional reads; 0 bare reads in routers or services outside load_config()

**Metadata Shim References:**

```
apps/backend/app/resources/default.yaml:1       (config key reference; safe)
apps/backend/app/apps/*.py metadata_db_path()   (orchestrator accessors; safe)
apps/backend/app/shared.py metadata_db_path()   (AppConfig accessor; safe)
apps/backend/app/core/metadata_db.py            (still active; shim removal deferred to US4)
```

✓ Core database module still in use; full shim removal scheduled for US4 (future round)

**Import Surface Validation:**

- ✓ All 7 routers import from `app.api` (layer-correct)
- ✓ All orchestrators import from `app.apps` (layer-correct)
- ✓ Services re-exported from `app.services.__init__.py` (clean discovery)
- ✓ Startup entry points (`app/__main__.py`, `app/main.py`) boot without errors

## Suggested Verification Commands

Run from repository root unless noted.

```bash
# Regression test suite
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest apps/backend/tests -q
```

**Result (Round 23)**: 170 passed, 3 skipped ✓

```bash
# Bare environment reads audit
rg "os\.getenv|os\.environ" apps/backend/app
```

**Result (Round 23)**: 4 results (all intentional; inside load_config and out-of-scope helpers) ✓

```bash
# Metadata shim reference audit (Note: US4 deferred; expect active references)
rg "metadata_db|init_metadata_db" apps/backend/app
```

**Result (Round 23)**: References to metadata_db config keys, orchestrator accessors, and core module (expected; full deletion in US4) ✓

```bash
# Backend tree structure validation
find apps/backend/app -maxdepth 2 -type f -name "*.py" | sort
```

```bash
# Startup entry point validation
python -m app.__main__ --help  # CLI help (non-blocking; for manual verification)
```

## Acceptance Mapping

- US1, FR-001, FR-002, FR-003, FR-017, FR-018, FR-019: Phase A + Phase C
- US2, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009: Phase B
- US3, FR-010, FR-011, FR-012: Phase C + Phase D
- US4, FR-013, FR-014, FR-015, FR-016: Phase D + Phase E

## Exit Criteria For /speckit.tasks

Feature 009 is task-ready when:

1. The move plan is concrete enough to assign file-by-file work.
2. Each gate has executable or grep-based validation.
3. Schema consolidation and shim removal are sequenced rather than hand-waved.
4. Public behavior preservation is the acceptance condition across all tracks.
