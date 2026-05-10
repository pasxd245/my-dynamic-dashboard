# Dashboard App

Streamlit dashboard client for my-dynamic-dashboard.

## Structure

- `streamlit_app.py`: Streamlit entrypoint.
- `src/dashboard/api/`: Backend HTTP client layer.
- `src/dashboard/components/`: UI component modules.
- `src/dashboard/core/`: Shared core primitives and typed errors.
- `src/dashboard/utils/`: Environment and logging helpers.
- `src/dashboard/shared.py`: Centralized config manager.
- `src/dashboard/resources/default.yaml`: Deterministic defaults.
- `tests/unit/`: Unit-layer tests.
- `tests/integration/`: Integration-layer tests.

## Configuration Precedence

Runtime config is resolved through `dashboard.shared.DashboardAppConfig`:

1. `src/dashboard/resources/default.yaml`
2. Approved environment overrides via `dashboard.utils.env_helper`

Direct environment reads outside the approved helper are not allowed.

## Local Commands

```bash
cd apps/dashboard

# Editable install from pyproject
pip install -e .[dev,test]

# Layered tests
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/dashboard pytest tests/unit -q
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/dashboard pytest tests/integration -q

# Environment access governance scan
rg -n "os\.getenv|os\.environ" apps/dashboard

# Run app
streamlit run streamlit_app.py
```
