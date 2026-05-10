# Implementation Plan: Dashboard Streamlit Foundation Audit

**Branch**: `feat/enhance-ui-ux` | **Date**: 2026-05-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-dashboard-streamlit-foundation-audit/spec.md` and Round 28 planning context

## Summary

Bring `apps/dashboard/` to backend-grade structural and configuration governance without changing user-visible behavior: adopt a canonical dashboard package layout, centralize all configuration reads via a dashboard config-manager pattern, migrate dashboard packaging/build flow to pyproject parity, and establish unit/integration-only test layering for this round. Scope remains dashboard-only refactor/governance with zero production feature additions.

## Technical Context

**Language/Version**: Python 3.12 + Streamlit runtime  
**Primary Dependencies**: Streamlit, requests, pandas, plotly, python-dateutil, packaging; pyproject tooling parity with hatchling/hatch-vcs, ruff, commitizen  
**Storage**: N/A for new persistence; dashboard consumes backend API responses only  
**Testing**: pytest with explicit dashboard `unit` and `integration` layers (no `contract` or `perf` in this round)  
**Target Platform**: Linux local development, CI runner, and Docker container runtime  
**Project Type**: Internal dashboard architecture/configuration governance refactor  
**Performance Goals**: Preserve current dashboard startup and interaction behavior; no regression gates added in this round  
**Constraints**: Dashboard-only scope, zero feature additions, zero auth/multi-user expansion, no shared Python package extraction this round  
**Scale/Scope**: `apps/dashboard/**`, `specs/014-dashboard-streamlit-foundation-audit/**`, and dashboard-related documentation updates only

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. **Principle I (Business-question-first)**: PASS. Feature serves maintainability/readiness decision for MVP-1 dashboard evolution.
2. **Principle II (Metric contract before visualization)**: PASS. No new KPI/visualization behavior is introduced.
3. **Principle III (Relationship rule before cross-table query)**: PASS. No relationship-rule semantics are changed.
4. **Principle IV (Reconciliation before recommendation)**: PASS WITH REQUIREMENT. Behavioral equivalence evidence is required pre/post refactor.
5. **Principle V (Challenge & sensitivity before decision-ready)**: PASS. No decision-readiness semantics are added or altered.
6. **Principle VI (Traceability for every claim)**: PASS WITH REQUIREMENT. Structural/config/env-governance outcomes must map to explicit files and checks.
7. **Principle VII (Reproducibility from raw inputs)**: PASS WITH REQUIREMENT. Setup/test/build verification commands must be documented and repeatable.

Post-Phase 1 re-check:

1. **Principle I**: PASS. Artifacts remain dashboard-only refactor/governance focused.
2. **Principle II**: PASS. No new metric contract surface introduced.
3. **Principle III**: PASS. Relationship-rule behavior remains unchanged.
4. **Principle IV**: PASS. Quickstart and contract include parity verification requirements.
5. **Principle V**: PASS. No sensitive/recommendation surface changes.
6. **Principle VI**: PASS. Plan, research, data model, quickstart, and contract provide concrete traceability surfaces.
7. **Principle VII**: PASS. Documented commands provide reproducible governance checks and install/test/build paths.

## Project Structure

### Documentation (this feature)

```text
specs/014-dashboard-streamlit-foundation-audit/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dashboard-foundation-governance.md
├── checklists/
└── tasks.md
```

### Source Code (repository root)

```text
apps/dashboard/
├── streamlit_app.py                     # Entry point (retained)
├── pyproject.toml                       # Added for packaging/tooling parity
├── Dockerfile                           # Install path migrated to pyproject package flow
├── src/dashboard/
│   ├── shared.py                        # Dashboard AppConfig/config-manager surface
│   ├── resources/
│   │   └── default.yaml                 # Centralized defaults
│   ├── api/
│   │   └── backend_client.py            # Canonical backend API client layer
│   ├── core/
│   │   ├── base.py
│   │   └── errors.py
│   ├── components/
│   │   ├── dashboard_header.py
│   │   ├── parameter_panel.py
│   │   ├── query_panel.py
│   │   └── export_controls.py
│   └── utils/
│       ├── env_helper.py
│       └── logger.py
└── tests/
    ├── unit/
    └── integration/

docs/development/setup.md                # Dashboard command matrix and migration notes
```

**Structure Decision**: Keep all implementation confined to dashboard package refactor/governance and associated dashboard docs. No backend runtime behavior or frontend builder feature surfaces are modified.

## Requirement Mapping Matrix

| Requirement | Data Layer                           | Metric Contract | Relationship Rule | Surface Role         | Gate                                                                 | Test / Evidence                                          |
| ----------- | ------------------------------------ | --------------- | ----------------- | -------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| FR-001      | N/A (package governance)             | N/A             | N/A               | Dashboard maintainer | canonical package tree exists and passes layout governance test      | `test_module_layout.py` + directory inventory            |
| FR-002      | N/A                                  | N/A             | N/A               | Dashboard maintainer | entrypoint uses only canonical `dashboard.*` imports                 | `test_streamlit_entrypoint_imports.py`                   |
| FR-003      | DashboardAppConfig model             | N/A             | N/A               | Dashboard maintainer | config-manager path is sole runtime config entry point               | `test_app_config.py` + code review                       |
| FR-004      | DashboardEnvPolicy (governance rule) | N/A             | N/A               | Dashboard maintainer | zero ad-hoc env reads outside approved helper                        | `test_env_policy_scan.py` + `rg` governance scan         |
| FR-005      | `default.yaml` resource              | N/A             | N/A               | Dashboard maintainer | defaults and env overrides correctly resolve through config-manager  | `test_app_config.py` precedence tests                    |
| FR-006      | DashboardPackagingContract           | N/A             | N/A               | Release owner        | `pip install -e .[dev,test]` succeeds from pyproject                 | `test_packaging_contract.py` + install evidence          |
| FR-007      | Docker install path                  | N/A             | N/A               | Release owner        | Docker install uses package path; no legacy requirements-only flow   | `test_docker_install_contract.py` + Dockerfile diff      |
| FR-008      | DashboardTestLayer                   | N/A             | N/A               | Dashboard maintainer | unit and integration layers run independently and pass               | `pytest tests/unit -q` and `pytest tests/integration -q` |
| FR-009      | N/A (explicit exclusion)             | N/A             | N/A               | Dashboard maintainer | no contract or perf test files exist in scope                        | directory audit + docs                                   |
| FR-010      | N/A                                  | N/A             | N/A               | Dashboard maintainer | README and setup docs contain full layout/config/test command matrix | docs content review                                      |
| FR-011      | N/A (behavior baseline)              | N/A             | N/A               | Release owner        | smoke parity checks pass before and after; no net-new UX behavior    | `run_smoke_startup_checks()` + reconciliation ledger     |
| NFR-001     | N/A                                  | N/A             | N/A               | Dashboard maintainer | governance checks are repeatable locally and in CI                   | test suite execution + governance scan commands          |
| NFR-002     | N/A                                  | N/A             | N/A               | Release owner        | setup path is reproducible from documented commands                  | quickstart + setup docs                                  |
| NFR-003     | N/A                                  | N/A             | N/A               | Release owner        | changed files confined to `apps/dashboard/` and docs                 | `git diff --name-only` scope audit                       |
| SC-001      | DashboardAppConfig                   | N/A             | N/A               | Dashboard maintainer | 100% of runtime env values go through config manager                 | `test_app_config.py` + env policy scan                   |
| SC-002      | DashboardEnvPolicy                   | N/A             | N/A               | Dashboard maintainer | governance scan reports zero violations                              | `test_env_policy_scan.py` + `rg` scan output             |
| SC-003      | DashboardTestLayer                   | N/A             | N/A               | Dashboard maintainer | unit and integration test commands run and pass                      | test matrix execution output                             |
| SC-004      | DashboardPackagingContract           | N/A             | N/A               | Release owner        | pyproject install and Docker build complete                          | `test_packaging_contract.py` + Dockerfile evidence       |
| SC-005      | N/A (behavior baseline)              | N/A             | N/A               | Release owner        | dashboard smoke parity equivalent pre/post                           | smoke observations in reconciliation ledger              |

## Phase Outputs

### Phase 0: Research

- Resolved config centralization strategy and env-governance policy.
- Locked dashboard-only scope guardrails and no-feature-addition contract.
- Defined packaging/test layering decisions for implementation readiness.

### Phase 1: Design & Contracts

- Authored data model for config/governance/test-layer entities.
- Authored maintainer-facing governance contract for structure/config/tooling behavior.
- Authored quickstart verification with reproducible commands and acceptance expectations.

## Complexity Tracking

No constitution violations accepted for this feature. All planned complexity is limited to dashboard refactor/governance surfaces with explicit zero-feature-addition guardrails.
