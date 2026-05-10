# Perf Evidence (T033)

## Commands

- `cd apps/backend && python --version`
- `cd apps/backend && uname -a`
- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest -m perf tests/perf -q`

## Result

- Python: `3.12.10`
- Host: Linux WSL2 kernel `6.6.114.1-microsoft-standard-WSL2` on `x86_64`
- Perf suite: `3 passed, 2 warnings in 0.12s`
