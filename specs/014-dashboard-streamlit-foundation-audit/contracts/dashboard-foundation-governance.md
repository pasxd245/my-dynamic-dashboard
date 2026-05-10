# Contract: Dashboard Streamlit Foundation Governance

**Scope**: `apps/dashboard` refactor/governance surfaces only  
**Spec**: [../spec.md](../spec.md)

## Purpose

Define the implementation contract for dashboard structure, configuration governance, packaging parity, and test layering while preserving existing user-visible behavior.

## Contract Surface A: Structural Layout Governance

- Canonical layout is package-driven under `apps/dashboard/src/dashboard/**` with explicit boundaries:
  - `api/`
  - `core/`
  - `components/`
  - `utils/`
  - config/resources surfaces (for AppConfig and defaults)
- Entry-point import contract:
  - `streamlit_app.py` must resolve dashboard modules through canonical package paths.
  - Legacy ad-hoc import paths are not allowed post-refactor.

## Contract Surface B: Configuration Manager and Environment Policy

- All runtime configuration is resolved through centralized dashboard config-manager modules.
- Direct ad-hoc environment reads (`os.getenv`, `os.environ`) are disallowed in dashboard runtime modules outside approved config surfaces.
- Configuration contract includes:
  - deterministic defaults
  - explicit environment override behavior
  - URL and scalar validation for runtime-critical settings

## Contract Surface C: Packaging and Docker Install Parity

- Dashboard packaging is defined in `apps/dashboard/pyproject.toml`.
- Dashboard Docker image installation uses package metadata flow (editable or wheel install path), not requirements-only flow.
- Tooling governance parity with backend is required for lint/test/release metadata conventions.

## Contract Surface D: Dashboard Test Layering (This Round)

- Canonical layers for this round:
  - `unit`
  - `integration`
- Explicit exclusions for this round:
  - no contract test layer
  - no perf harness layer
- Layer execution commands must be documented for maintainers.

## Contract Surface E: Zero Feature-Addition Guardrail

- Allowed change type:
  - refactor, structure hardening, configuration governance, packaging/tooling alignment, test/doc governance
- Disallowed change type:
  - new dashboard capabilities, charts, panels, interaction flows, or UX features
  - auth/multi-user behavior
  - backend feature changes

## Verification Matrix

- Structural parity and import-path audit: required
- Environment governance scan (`os.getenv`/`os.environ`) with zero violations: required
- Unit + integration dashboard test execution: required
- Docker package-install build path validation: required
- Behavioral parity smoke checks (no user-visible feature additions): required
