# US1 Evidence - Layer Boundaries

## Migrated files

- apps/backend/tests/test_source_base.py -> apps/backend/tests/unit/test_source_base.py
- apps/backend/tests/test_source_registry.py -> apps/backend/tests/unit/test_source_registry.py

## Governance and attribution tests added

- apps/backend/tests/unit/test_layer_attribution.py
- apps/backend/tests/contract/test_layer_attribution.py
- apps/backend/tests/unit/test_layer_boundaries.py
- apps/backend/tests/integration/test_layer_boundaries.py
- apps/backend/tests/contract/test_layer_boundaries.py

## Commands executed

- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q`

## Failing-to-passing proof

- First run failure (introduced by new attribution checks):
  - `tests/contract/test_layer_attribution.py::test_contract_tests_do_not_use_perf_marker`
  - `tests/unit/test_layer_attribution.py::test_perf_marker_is_reserved_for_perf_directory`
- Fix applied: marker-token string split in both attribution tests to avoid false-positive self-matching.
- Re-run result: `221 passed, 6 skipped, 2 warnings in 35.48s`.
