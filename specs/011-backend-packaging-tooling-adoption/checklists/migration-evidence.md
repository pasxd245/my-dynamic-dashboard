# Migration Evidence - Feature 011 Backend Packaging Tooling Adoption

## Scope Guardrails

- Feature: `011-backend-packaging-tooling-adoption`
- Scope: backend packaging/tooling migration only
- Non-goals enforced:
  - No backend behavior change
  - No backend code moves under `apps/backend/app`

## T002 - Pre-migration dependency and tooling baseline

- Baseline source: `apps/backend/requirements.txt`
- Runtime/dependency snapshot (pre-migration):
  - `fastapi==0.115.12`
  - `uvicorn==0.34.2`
  - `sqlmodel==0.0.22`
  - `sqlalchemy==2.0.38`
  - `alembic==1.14.1`
  - `polars==1.30.0`
  - `openpyxl==3.1.5`
  - `fastexcel==0.11.5`
  - `python-multipart==0.0.20`
  - `pytest==8.3.5`
  - `httpx==0.28.1`
  - `duckdb==1.1.3`
  - `PyYAML>=6.0`
  - `RecursiveNamespaceV2>=0.0.3`
- Pre-migration backend tooling/config files:
  - `apps/backend/pytest.ini`
  - No `apps/backend/pyproject.toml` present before migration
  - No backend `CHANGELOG.md` present before migration

## T003 - Pre-migration behavior baseline command outputs

### Command: backend tests baseline

- Command:
  - `cd apps/backend && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/backend /home/ubuntu/pf/my-dynamic-dashboard/.venv/bin/python -m pytest tests/ -q`
- Output summary:
  - Exit code: `0`
  - Result: `209 passed, 3 skipped, 2 warnings in 41.79s`
  - Warnings: existing Pydantic field-name shadow warnings in `app/schemas.py` for `schema` field names

### Command: backend smoke baseline (module entrypoint)

- Command:
  - `cd apps/backend && timeout 10 /home/ubuntu/pf/my-dynamic-dashboard/.venv/bin/python -m app`
- Output summary:
  - Exit code: `124` (timeout expected for long-running server process)
  - Result: startup reached uvicorn process start + application startup wait with no packaging/import failure before timeout

### Command: backend smoke baseline (uvicorn import check)

- Command:
  - `cd apps/backend && timeout 10 /home/ubuntu/pf/my-dynamic-dashboard/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8011 --workers 1`
- Output summary:
  - Exit code: `124` (timeout expected for long-running server process)
  - Result: startup reached uvicorn process start + application startup wait with no packaging/import failure before timeout

## T004 - Pre-migration install/setup references inventory

- Active install/setup references using `requirements.txt` before migration:
  - `README.md` backend quick start
  - `docs/development/setup.md` backend quick start
  - `apps/backend/Dockerfile` image install path
- Wider reference scan command and results:
  - Command:
    - `rg -n "pip install -r requirements.txt|requirements\\.txt" README.md docs scripts devops .github apps specs`
  - Output summary:
    - Active backend setup/automation references found in:
      - `README.md` backend quick start (`pip install -r requirements.txt`)
      - `docs/development/setup.md` backend quick start (`pip install -r requirements.txt`)
      - `apps/backend/Dockerfile` (`COPY requirements.txt`, `pip install -r /tmp/requirements.txt`)
    - Additional historical/spec references exist outside active setup paths (expected in specs/docs history)

## T013 - Foundational configuration decisions and parity notes

- Locked policy decisions applied in `apps/backend/pyproject.toml`:
  - Build backend: `hatchling` with `hatch-vcs`
  - Version source: VCS tags with `tag-pattern = "apps/backend/v(?P<version>.*)"`
  - Ruff baseline: line length 120, rule families `E`, `F`, `B`, `SIM`, `I`
  - Commitizen baseline: `cz_conventional_commits`, `version_provider = "scm"`, `tag_format = "apps/backend/v$version"`
  - Coverage exclude-lines copied from i18n-tool parity template
- Dependency parity validation:
  - `apps/backend/requirements.txt` entries were migrated into `apps/backend/pyproject.toml` runtime dependencies.
  - Runtime pins preserved for all 14 original backend dependencies.
- Generated artifacts wired:
  - `.gitignore` now includes `apps/backend/app/_version.py`
  - `apps/backend/CHANGELOG.md` created for commitizen changelog target

## T014-T036 - Migration execution evidence

### T014 - Editable install validation (`pip install -e .[dev,test]`)

- Command:
  - `cd apps/backend && python -m pip install -e '.[dev,test]'`
- Result:
  - Exit success
  - Installed package: `my-dynamic-dashboard-backend`
  - Resolved version: `0.0.1.dev73+g8e8311572.d20260510`

### T015 - Runtime install validation (`pip install -e .`)

- Command:
  - `cd apps/backend && python -m pip install -e .`
- Result:
  - Exit success
  - Installed package: `my-dynamic-dashboard-backend`
  - Resolved version: `0.0.1.dev73+g8e8311572.d20260510`

### T016-T018 - Active install path migration

- `apps/backend/Dockerfile` now installs from `pyproject.toml` package context:
  - `COPY pyproject.toml /app/pyproject.toml`
  - `COPY app /app/app`
  - `RUN pip install --no-cache-dir /app`
- `README.md` backend quick-start now uses:
  - `pip install -e .[dev,test]`
- `docs/development/setup.md` backend quick-start now uses:
  - `pip install -e .[dev,test]`

### T019-T020 - Legacy requirements retirement

- `apps/backend/requirements.txt` removed from repository.
- Active backend setup paths now use `pyproject.toml`-based install commands.

### T021 - Post-migration backend test suite

- Command:
  - `cd apps/backend && python -m pytest tests/ -q`
- Result:
  - Exit code: `0`
  - Result: `209 passed, 3 skipped, 2 warnings in 34.54s`
  - Warnings: existing Pydantic schema-field shadow warnings (same as baseline)

### T022 - Post-migration smoke checks

- Commands:
  - `cd apps/backend && timeout 10 python -m app`
  - `cd apps/backend && timeout 10 python -m uvicorn app.main:app --host 127.0.0.1 --port 8011 --workers 1`
- Result summary:
  - `APP_EXIT=124` and `UVI_EXIT=124` (expected timeout for long-running server process)
  - Startup reached server process start and application startup phase before timeout

### T023 - Before/after behavior comparison

- Baseline tests (pre-migration): `209 passed, 3 skipped, 2 warnings`
- Post-migration tests: `209 passed, 3 skipped, 2 warnings`
- Baseline/post smoke behavior: both reached startup and timed out intentionally after 10 seconds.
- Conclusion: no observed behavior regression attributable to packaging migration.

### T024 - Pytest behavior reconciliation

- `apps/backend/pytest.ini` and `apps/backend/pyproject.toml` align on discovery primitives:
  - `testpaths = tests`
  - `python_files = test_*.py`

### T025 - Zero backend code-move audit

- Command:
  - `git diff --name-status`
- Result summary:
  - No rename/move entries (`R*`) observed.
  - Changed files are packaging/docs/config artifacts; backend code under `apps/backend/app` was not moved.

### T026 - Zero behavior-change attestation

- SC-002 evidence: identical test outcomes pre/post migration.
- SC-007 evidence: no backend app file moves detected.
- Additional smoke evidence confirms unchanged startup execution path.

### T027 - Version resolution check

- Command:
  - `python - <<'PY' ... importlib.metadata.version('my-dynamic-dashboard-backend') ... PY`
- Result:
  - `VERSION_RESOLVED=0.0.1.dev73+g8e8311572.d20260510`

### T028 - Ruff check execution

- Command:
  - `cd apps/backend && ruff check app`
- Result:
  - Exit code: `1`
  - Findings: `66` current lint violations reported in existing backend app sources.

### T029 - Commitizen dry-run

- Command:
  - `cd apps/backend && cz bump --dry-run`
- Result:
  - Exit code: `0`
  - Computed bump: `0.0.0 -> 0.1.0`
  - Proposed tag: `apps/backend/v0.1.0`

### T030-T032 - Tooling policy verification

- Tag/version policy present and aligned:
  - `tool.hatch.version.tag-pattern = "apps/backend/v(?P<version>.*)"`
  - `tool.commitizen.tag_format = "apps/backend/v$version"`
  - `tool.commitizen.version_provider = "scm"`
- Ruff policy aligned:
  - `tool.ruff.line-length = 120`
  - `tool.ruff.lint.select = ["E", "F", "B", "SIM", "I"]`
- Coverage/changelog policy aligned:
  - `tool.coverage.report.exclude_lines` parity block present
  - `apps/backend/CHANGELOG.md` exists
  - `tool.commitizen.changelog_file = "CHANGELOG.md"`

### T033 - Backend release-tooling maintainer notes

- Added `Backend Release Tooling (Spec 011)` section in `docs/development/setup.md` with:
  - version resolution command
  - lint command
  - commitizen dry-run command
  - backend tag format note

### T034 - Repo-wide requirements reference scan

- Command:
  - `rg -n 'requirements\.txt|pip install -r' README.md docs devops scripts .github apps`
- Residual findings summary:
  - Remaining references are non-backend setup paths (e.g., dashboard Dockerfile and historical docs/spec references).
  - Active backend setup references in README/setup/Dockerfile were migrated.

### T035 - Requirements-to-evidence traceability

| Requirement / Criterion | Evidence section                                 |
| ----------------------- | ------------------------------------------------ |
| FR-001, FR-002, FR-003  | T013, T030-T032                                  |
| FR-004, FR-005          | T013, T014, T015                                 |
| FR-006, FR-007, FR-008  | T013, T028, T029, T030-T032                      |
| FR-009                  | T021, T024                                       |
| FR-010, FR-011          | T016-T020, T034                                  |
| FR-012                  | T025                                             |
| FR-013                  | T021-T023, T026                                  |
| FR-014, FR-015          | T013, T011/T012 artifacts                        |
| SC-001                  | T014                                             |
| SC-002                  | T021, T023                                       |
| SC-003                  | T019-T020, T034                                  |
| SC-004                  | T028 (currently failing with existing lint debt) |
| SC-005                  | T027                                             |
| SC-006                  | T029                                             |
| SC-007                  | T025                                             |

### T036 - Feature completion validation

- Packaging migration implementation tasks were executed and evidence-captured.
- All backend install-path migration outcomes are complete.
- Validation highlights one open acceptance risk:
  - Ruff zero-issues quality gate is not yet met (`RUFF_EXIT=1`, 66 findings).
- Round can proceed to Check with this explicit risk recorded.
