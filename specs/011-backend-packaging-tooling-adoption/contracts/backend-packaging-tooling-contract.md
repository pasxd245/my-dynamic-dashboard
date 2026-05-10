# Contract: Backend Packaging and Tooling Workflow

**Scope**: `apps/backend` only  
**Spec**: [../spec.md](../spec.md)

## Purpose

Define the externally consumed contract for maintainers and automation after migration from `requirements.txt` to `pyproject.toml`.

## Contract Surface A: Installation Interface

- Command contract:
  - `cd apps/backend && pip install -e .[dev,test]`
- Behavioral guarantees:
  - Installs runtime + developer + test tooling from project metadata.
  - Does not require `requirements.txt` for normal development/test setup.
- Compatibility note:
  - Existing runtime and test behavior must remain unchanged.

## Contract Surface B: Build and Version Interface

- Build backend contract:
  - `build-system.requires` includes hatchling + hatch-vcs.
- Version contract:
  - Version source is VCS-derived.
  - Tag namespace and format are backend-scoped (`apps/backend/v$version`).
  - Local fallback version remains valid when matching tags are absent.

## Contract Surface C: Quality Tooling Interface

- Lint contract:
  - Ruff line length `120`.
  - Ruff rule families `E`, `F`, `B`, `SIM`, `I`.
- Test contract:
  - Pytest discovery remains compatible with backend test layout (`tests`, `test_*.py`).
- Coverage contract:
  - Coverage run/report config is defined in `pyproject.toml`.
  - Exclusion policy remains parity-aligned with i18n-tool template baseline.
- Changelog/versioning contract:
  - Commitizen uses conventional commits with `version_provider = scm`.
  - Changelog target exists and is writable by bump workflow.

## Contract Surface D: Artifact Hygiene Interface

- Generated file contract:
  - `apps/backend/app/_version.py` is treated as generated output.
  - Repository tracking excludes generated version file noise.

## Out of Scope Contract

- No API endpoint contract changes.
- No backend module path changes.
- No data-model behavior changes.
- No cross-application packaging migration outside `apps/backend`.

## Verification Matrix

- Install from metadata only: required.
- Backend tests parity: required.
- Ruff/pytest/coverage/commitizen commands resolve from metadata config: required.
- Requirements-file dependency path retired: required.
