# Data Model: Dashboard Streamlit Foundation Audit

**Date**: 2026-05-11  
**Spec**: [spec.md](spec.md)  
**Research**: [research.md](research.md)

## Overview

This feature defines governance and structural entities for dashboard configuration, packaging, and test organization. It does not introduce new product/domain data entities or user-facing dashboard features.

## Entity 1: DashboardAppConfig

- Purpose: Centralized runtime configuration contract for dashboard behavior.
- Backing surface: `apps/dashboard/src/dashboard/shared.py` and `apps/dashboard/src/dashboard/resources/default.yaml`.
- Fields:
  - `api_base_url`
  - `api_timeout_seconds`
  - `api_retries`
  - `log_level`
  - `smoke_mode_enabled`
  - `strict_validation_enabled`
  - `refresh_cadence_default`
- Validation rules:
  - Values must resolve through the config-manager path only.
  - URL-bearing fields must pass scheme/host validation where required.
  - Defaults are defined in versioned resources, not scattered literals.

## Entity 2: DashboardEnvPolicy

- Purpose: Governance policy for environment access in dashboard runtime code.
- Backing surface: dashboard policy checks and code scan commands.
- Fields:
  - `policy_id`: `dashboard-no-adhoc-env-access`
  - `forbidden_patterns`: `os.getenv`, `os.environ`
  - `allowed_access_surface`: config-manager modules only
  - `enforcement_command`: ripgrep-based zero-hit check
- Validation rules:
  - Runtime modules outside approved config surfaces must have zero forbidden pattern matches.
  - Any violation fails governance checks.

## Entity 3: DashboardModuleLayout

- Purpose: Canonical package layout for dashboard maintainability.
- Backing surface: `apps/dashboard/src/dashboard/**` package structure.
- Fields:
  - `config_layer`: shared config/env/resources modules
  - `api_layer`: backend client calls
  - `core_layer`: foundational primitives/errors
  - `components_layer`: Streamlit rendering modules
  - `utils_layer`: cross-cutting helpers (logger/env helpers)
  - `entrypoint`: top-level Streamlit app import path
- Validation rules:
  - Entry point imports resolve through canonical layout.
  - Legacy/duplicate module paths are removed or redirected.

## Entity 4: DashboardTestLayer

- Purpose: Test taxonomy for this feature round.
- Backing surface: `apps/dashboard/tests/unit` and `apps/dashboard/tests/integration`.
- Fields:
  - `layer_name`: `unit` or `integration`
  - `layer_scope`: pure helpers/config logic vs integrated API/client behavior
  - `execution_command`: layer-specific pytest command
- Validation rules:
  - Dashboard tests are attributable to unit or integration only.
  - No contract/perf suite is introduced in this round.

## Entity 5: DashboardPackagingContract

- Purpose: Packaging/build governance for dashboard installation paths.
- Backing surface: `apps/dashboard/pyproject.toml`, `apps/dashboard/Dockerfile`.
- Fields:
  - `project_name`
  - `dependency_set`
  - `optional_dev_test_groups`
  - `tag_pattern`
  - `docker_install_mode`
- Validation rules:
  - Package install path is pyproject-driven.
  - Docker image build uses package install flow, not requirements-only flow.

## Relationships

- `DashboardAppConfig` enforces runtime settings consumed by API and component layers.
- `DashboardEnvPolicy` governs how `DashboardAppConfig` acquires environment-backed values.
- `DashboardModuleLayout` hosts `DashboardAppConfig` and all feature modules under explicit boundaries.
- `DashboardTestLayer` validates layout/config behavior without introducing new product behavior.
- `DashboardPackagingContract` ensures reproducible local/container installation of the refactored dashboard.

## Invariants

- Zero net-new dashboard user-facing features are permitted in this feature.
- Scope remains dashboard-only refactor/governance surfaces.
- Behavioral parity with existing dashboard workflows is required pre/post refactor.
