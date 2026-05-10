# Backend Test Layers and Governance

## Scope and Guardrail

This test tree is the canonical quality-governance surface for backend verification.
Feature Spec 012 applies a hard guardrail: changes in this round are limited to backend tests, pytest tooling, and backend docs only. No production runtime behavior changes are in scope.

## Canonical Layers

- unit: Pure logic and domain contract checks with no external I/O requirements.
- integration: In-process component interaction checks (app services, metadata wiring, endpoint flows under local test runtime).
- contract: API/shape compatibility checks for request/response interfaces.
- perf: Opt-in MVP-1 performance harness checks. These are excluded from default quality loops unless explicitly selected.

## Failure Interpretation and Triage

- unit failures: likely local logic regressions. Start with the touched module and dependency contracts.
- integration failures: likely component wiring or state-transition regressions. Check fixtures, metadata bootstrap, and endpoint orchestration.
- contract failures: likely interface drift. Reconcile request/response schemas and endpoint behavior compatibility.
- perf failures: likely SLO breach or environment variance. Reproduce with recorded context before classifying as product regression.

## Baseline Inventory (Spec 012)

Current file-to-layer mapping at migration baseline:

- unit:
  - tests/unit/test_source_base.py
  - tests/unit/test_source_registry.py
  - tests/unit/test_layer_attribution.py
  - tests/unit/test_layer_boundaries.py
  - tests/unit/test_factories.py
- integration:
  - Existing tests under tests/integration/test\_\*.py
  - tests/integration/test_layer_boundaries.py
  - tests/integration/test_factory_consumption.py
- contract:
  - Existing tests under tests/contract/test\_\*.py
  - tests/contract/test_layer_attribution.py
  - tests/contract/test_layer_boundaries.py
  - tests/contract/test_factory_consumption.py
- perf:
  - tests/perf/test_upload_perf.py
  - tests/perf/test_preview_perf.py
  - tests/perf/test_export_perf.py

## Layer Attribution Rules

- Every test file must live in exactly one canonical layer directory (`tests/unit`, `tests/integration`, `tests/contract`, `tests/perf`).
- Test files must not be placed directly under `tests/` (except `conftest.py` and helper modules).
- `@pytest.mark.perf` is reserved for files under `tests/perf/` only.
- Cross-layer helper code belongs in `tests/factories/`, `tests/conftest.py`, or explicit support modules.

## Factory Usage Policy

- Shared deterministic factories are exported from `tests/factories`.
- Callers should use explicit overrides instead of mutating returned structures implicitly.
- Factory composition for upload/preview/export workflows lives in `tests/factories/workflows.py`.

## Command Matrix

- default regression:
  - `cd apps/backend && pytest tests/ -q`
- layer-specific runs:
  - `cd apps/backend && pytest tests/unit -q`
  - `cd apps/backend && pytest tests/integration -q`
  - `cd apps/backend && pytest tests/contract -q`
- perf harness (opt-in):
  - `cd apps/backend && pytest -m perf tests/perf -q`
