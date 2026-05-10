# Quickstart: Validate Backend Test Scaffolding and MVP-1 Perf Harness

**Date**: 2026-05-10  
**Spec**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)

## Goal

Verify backend-only test scaffolding and performance-harness readiness with explicit default-suite and opt-in perf-suite expectations.

## Preconditions

- Run commands from repository root unless stated otherwise.
- Python 3.12 environment is available for backend testing.
- Feature 012 changes are present in working tree.

## 1. Validate Test-Layer Layout and Factory Presence

```bash
cd apps/backend
test -d tests/unit && test -d tests/integration && test -d tests/contract
test -d tests/factories
```

Expected result:

- Canonical layer directories exist (`unit`, `integration`, `contract`).
- Shared factory directory exists under `tests/factories`.

## 2. Run Default Pytest Suite (Regression Baseline)

```bash
cd apps/backend
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q
```

Expected result:

- Default backend suite passes.
- Run represents behavior-preservation baseline and must stay green.
- Perf harness tests are not required for this default run expectation.

## 3. Run Focused Layer Checks (Optional but Recommended)

```bash
cd apps/backend
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/unit -q
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/integration -q
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract -q
```

Expected result:

- Each layer can be executed independently for targeted triage.

## 4. Run Opt-In Perf Marker Harness

```bash
cd apps/backend
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest -m perf tests/perf -q
```

Expected result:

- Perf suite runs only when explicitly selected.
- All required scenario assertions pass:
  - upload 100k rows `<30s`
  - preview `<5s`
  - export `<30s`

## 5. Capture Perf Evidence Context

```bash
cd apps/backend
python --version
uname -a
```

Expected result:

- Perf run evidence includes environment context (Python + host profile).

## 6. Confirm Production-Scope Guardrail

```bash
cd /home/ubuntu/pf/my-dynamic-dashboard
git diff --name-only
```

Expected result:

- Changes remain in backend test/tooling/docs scope.
- No unintended production behavior implementation files are modified.

## Failure Handling

If verification fails:

- Treat feature as incomplete.
- Fix taxonomy/factory/perf harness artifacts without introducing production behavior changes.
- Re-run both required suites:
  - default regression: `PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q`
  - opt-in perf gate: `PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest -m perf tests/perf -q`

## Reconciliation Notes (Spec 012)

- Baseline inventory is documented in `apps/backend/tests/README.md`, including migrated legacy root tests now placed in `tests/unit/`.
- Shared deterministic factory APIs are exported from `apps/backend/tests/factories/__init__.py` and consumed by representative tests in all canonical layers.
- Layer attribution and boundary governance checks are codified in:
  - `apps/backend/tests/unit/test_layer_attribution.py`
  - `apps/backend/tests/contract/test_layer_attribution.py`
  - `apps/backend/tests/unit/test_layer_boundaries.py`
  - `apps/backend/tests/integration/test_layer_boundaries.py`
  - `apps/backend/tests/contract/test_layer_boundaries.py`
- Perf harness summaries are written to `apps/backend/tests/perf/artifacts/perf-last-run.json` after `pytest -m perf tests/perf -q`.

## Layer-Specific Triage Commands

```bash
cd apps/backend
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/unit -q
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/integration -q
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract -q
```

Use these focused commands first, then run `PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q` to confirm behavior-preservation baseline.
