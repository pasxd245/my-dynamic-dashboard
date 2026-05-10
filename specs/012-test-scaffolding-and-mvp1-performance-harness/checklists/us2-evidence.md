# US2 Evidence - Shared Factories

## Factory APIs implemented

- apps/backend/tests/factories/base.py
- apps/backend/tests/factories/domain.py
- apps/backend/tests/factories/workflows.py
- apps/backend/tests/factories/**init**.py

## Representative test consumption

- apps/backend/tests/unit/test_factories.py
- apps/backend/tests/integration/test_factory_consumption.py
- apps/backend/tests/contract/test_factory_consumption.py

## Duplication removed

- Shared setup for workspace/source/query payload now routes through centralized factory helpers in `tests/factories` and composed fixtures in `tests/conftest.py`.
- Prior duplicated root-level source tests were moved to unit-layer canonical location.

## Commands executed

- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q`
- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/unit -q`
- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/integration -q`
- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/contract -q`
