# Regression Gates Checklist (Spec 009)

## Runtime And Contract Gates

- [x] Backend entrypoint imports remain valid (`app.main`, `app.__main__`).
- [x] Public route initialization remains behavior-preserving.
- [x] Existing backend tests continue to pass after each slice.

## Config And Shim Grep Gates

- [x] `rg "os\.getenv|os\.environ" apps/backend/app` returns expected result for current slice.
- [x] `rg "metadata_db|init_metadata_db" apps/backend/app` trend is captured and reduced per plan.

## Verification Commands

```bash
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest apps/backend/tests/integration/test_backend_layout_realignment.py -q
```

```bash
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest apps/backend/tests/integration/test_config_precedence.py -q
```

```bash
PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest apps/backend/tests/integration/test_service_rewrite_regression.py -q
```

## Current Slice Evidence

- Focused layout regression check passed on 2026-05-10: `2 passed` in `test_backend_layout_realignment.py`.
- Current env-read grep still finds transitional usage in `app/__main__.py`, `app/core/config.py`, and `app/utils/env_helper.py`; this is expected until US2 tasks land.
- Current metadata-shim grep still finds `metadata_db` and `init_metadata_db` references in `main.py`, `core/metadata_db.py`, and several services; this is expected until US3/US4 tasks land.
