# US3 Evidence - Perf Harness

## Scenario files

- apps/backend/tests/perf/test_upload_perf.py
- apps/backend/tests/perf/test_preview_perf.py
- apps/backend/tests/perf/test_export_perf.py

## Harness plumbing

- apps/backend/tests/perf/conftest.py
- apps/backend/tests/perf/utils.py
- apps/backend/tests/perf/recorder.py

## Thresholds

- upload_100k < 30s
- preview < 5s
- export < 30s

## Commands executed

- `cd apps/backend && python --version`
- `cd apps/backend && uname -a`
- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest -m perf tests/perf -q`

## Measured results

- Environment:
  - `Python 3.12.10`
  - `Linux ... WSL2 ... x86_64`
- Perf run outcome: `3 passed, 2 warnings in 0.12s`.
