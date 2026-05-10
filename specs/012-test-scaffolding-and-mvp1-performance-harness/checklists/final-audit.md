# Final Audit (T036)

## Task-to-evidence map

- Setup/Foundation governance and scaffolding: `apps/backend/tests/README.md`, `apps/backend/tests/layer_policy.py`, `apps/backend/tests/factories/*`, `apps/backend/tests/perf/*`, `apps/backend/tests/conftest.py`, `apps/backend/pyproject.toml`, `apps/backend/pytest.ini`, `docs/development/setup.md`
- US1 evidence: `checklists/us1-evidence.md`
- US2 evidence: `checklists/us2-evidence.md`
- US3 evidence: `checklists/us3-evidence.md`
- Regression and perf verification: `checklists/regression-evidence.md`, `checklists/perf-evidence.md`
- Scope guardrail verification: `checklists/scope-guardrail.md`

## Verification commands matrix

- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest tests/ -q` -> `221 passed, 6 skipped, 2 warnings`
- `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend pytest -m perf tests/perf -q` -> `3 passed, 2 warnings`
- `cd apps/backend && python --version` -> `Python 3.12.10`
- `cd apps/backend && uname -a` -> Linux WSL2 host captured for perf reproducibility
- `cd /home/ubuntu/pf/my-dynamic-dashboard && git diff --name-only` + `git status --short` -> scope guardrail confirmed
