# Reconciliation Ledger: Spec 014 Dashboard Streamlit Foundation Audit

## Run Metadata

- Date: 2026-05-11
- Branch: 014-dashboard-streamlit-foundation-audit
- Scope guardrail: dashboard-only structural/config/tooling governance changes

## Completed Task Evidence

- T001: `apps/dashboard/src/dashboard/__init__.py` and `apps/dashboard/src/dashboard/resources/__init__.py` exist with dashboard package/resource namespace surface.
- T002: `apps/dashboard/pytest.ini`, `apps/dashboard/tests/unit/__init__.py`, and `apps/dashboard/tests/integration/__init__.py` exist.
- T003: `apps/dashboard/tests/conftest.py` provides dashboard test path bootstrap fixture shell.
- T004: Reconciliation ledger exists at this file path.
- T005: `specs/014-dashboard-streamlit-foundation-audit/quickstart.md` includes dashboard command anchors for install, tests, env scan, smoke, Docker, and scope checks.
- T006: Shared package exports exist in `apps/dashboard/src/dashboard/api/__init__.py`, `apps/dashboard/src/dashboard/core/__init__.py`, `apps/dashboard/src/dashboard/components/__init__.py`, and `apps/dashboard/src/dashboard/utils/__init__.py`.
- T007: Foundational primitives exist in `apps/dashboard/src/dashboard/core/base.py` and `apps/dashboard/src/dashboard/core/errors.py`.
- T008: Baseline backend client contract shell is implemented in `apps/dashboard/src/dashboard/api/backend_client.py`.
- T009: Environment helper is implemented in `apps/dashboard/src/dashboard/utils/env_helper.py`.
- T010: Shared logger helper is implemented in `apps/dashboard/src/dashboard/utils/logger.py`.
- T011: Foundational completion evidence is recorded in this ledger.
- T014: Canonical API module is present at `apps/dashboard/src/dashboard/api/backend_client.py`.
- T015: Canonical component modules are present at `apps/dashboard/src/dashboard/components/dashboard_header.py`, `apps/dashboard/src/dashboard/components/parameter_panel.py`, `apps/dashboard/src/dashboard/components/query_panel.py`, and `apps/dashboard/src/dashboard/components/export_controls.py`.
- T016: Canonical chart renderer is present at `apps/dashboard/src/dashboard/components/chart_viewer.py`.
- T017: Entrypoint imports in `apps/dashboard/streamlit_app.py` resolve through `dashboard.*` package paths.
- T019: US1 structural parity evidence and blockers are recorded in this ledger.
- T020: Config precedence tests added in `apps/dashboard/tests/unit/test_app_config.py` and passing.
- T021: Env governance integration test added in `apps/dashboard/tests/integration/test_env_policy_scan.py` and passing.
- T022: Centralized app config and accessors are implemented in `apps/dashboard/src/dashboard/shared.py`.
- T023: Deterministic default config exists in `apps/dashboard/src/dashboard/resources/default.yaml`.
- T024: Approved env read path exists in `apps/dashboard/src/dashboard/utils/env_helper.py`.
- T025: Backend client config usage is routed via `DashboardAppConfig` in `apps/dashboard/src/dashboard/api/backend_client.py`.
- T026: Entrypoint runtime config reads in `apps/dashboard/streamlit_app.py` route via `get_app_config()`.
- T027: Component-level config access uses `DashboardAppConfig` path in canonical `parameter_panel.py`, `query_panel.py`, and `export_controls.py`.
- T028: Environment-policy scan and config parity notes are recorded in this ledger, including current violations.
- T029: Packaging contract unit test added in `apps/dashboard/tests/unit/test_packaging_contract.py` and passing.
- T030: Docker install-flow integration test added in `apps/dashboard/tests/integration/test_docker_install_contract.py` and passing.
- T031: Dashboard packaging/tooling contract added in `apps/dashboard/pyproject.toml`.
- T032: Docker install flow migrated to editable package install in `apps/dashboard/Dockerfile`.
- T033: `apps/dashboard/requirements.txt` now includes scoped fallback/migration note.
- T034: Dashboard command/config/layout reference added in `apps/dashboard/README.md`.
- T035: Dashboard pyproject and layer command matrix added in `docs/development/setup.md`.
- T036: Package-install evidence recorded (`pip install -e .[dev,test]` succeeded); Docker install-path contract verified via integration test in this environment.
- T037: Command matrix executed and output captured:
  - `cd apps/dashboard && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/dashboard pytest tests/unit -q` -> `5 passed`
  - `cd apps/dashboard && PYTHONPATH=/home/ubuntu/pf/my-dynamic-dashboard/apps/dashboard pytest tests/integration -q` -> `3 passed`

## Foundational Completion Evidence (T011)

- Foundational scaffolding and governance primitives (T001-T010) are present under `apps/dashboard/src/dashboard/**`, `apps/dashboard/tests/**`, and `apps/dashboard/pytest.ini`.

## US1 Structural Parity Evidence (T019)

- Canonical package modules exist under `apps/dashboard/src/dashboard/api/**` and `apps/dashboard/src/dashboard/components/**`.
- Entrypoint `apps/dashboard/streamlit_app.py` imports canonical `dashboard.*` paths.
- Legacy duplicate surfaces were removed from `apps/dashboard/src/api/**` and `apps/dashboard/src/components/**`.
- Structural governance and entrypoint import tests now enforce this contract:
  - `tests/unit/test_module_layout.py`
  - `tests/integration/test_streamlit_entrypoint_imports.py`

## US2 Config and Env Governance Evidence (T028)

- `apps/dashboard/src/dashboard/shared.py` implements `DashboardAppConfig`, default resource loading, env override precedence, and singleton accessors.
- `apps/dashboard/src/dashboard/resources/default.yaml` provides deterministic defaults.
- Component/API/entrypoint modules route runtime config through `get_app_config()`.
- Environment scan command output (runtime-scoped):
  - `cd /home/ubuntu/pf/my-dynamic-dashboard && rg -n "os\.getenv|os\.environ" apps/dashboard/streamlit_app.py apps/dashboard/app_logging.py apps/dashboard/src/dashboard`
  - Match set:
    - `apps/dashboard/src/dashboard/utils/env_helper.py:14` (approved helper surface only)

## US3 Packaging and Build Evidence (T036)

- Editable install evidence:
  - `cd apps/dashboard && pip install -e .[dev,test]` completed successfully with `my-dynamic-dashboard-dashboard` metadata built from `pyproject.toml`.
- Docker install flow evidence:
  - `apps/dashboard/Dockerfile` now installs via `pip install --no-cache-dir -e /app`.
  - `tests/integration/test_docker_install_contract.py` passes and enforces no `requirements.txt`-driven install path.
  - Direct image build command attempted: `docker build -f apps/dashboard/Dockerfile . -t mdd-dashboard:spec014`.
  - Environment limitation: Docker daemon unavailable (`/var/run/docker.sock` missing), so static contract test is the verification source for this run.

## Cross-Cutting Polish Evidence (T037-T040)

- T037 evidence captured (unit/integration commands executed; both pass).
- T038 completed: runtime-scoped env-governance scan is clean outside the approved helper.
- T039 smoke walkthrough completed:
  - `python -c` invocation of `run_smoke_startup_checks()` returned all checks `True` for default and query-param input cases.
  - Observed Streamlit warning in bare mode (`missing ScriptRunContext`), expected for non-Streamlit-runner smoke execution.
- T040 changed-file audit command run:
  - `cd /home/ubuntu/pf/my-dynamic-dashboard && git diff --name-only`
  - Feature-delivery paths are dashboard + docs/spec surfaces, with expected governance/meta updates from Spec-Kit orchestration (`.agents/...`, `.github/copilot-instructions.md`, `.specify/feature.json`).
  - No production backend runtime files changed as part of this round.

## Remaining Blockers

None.
