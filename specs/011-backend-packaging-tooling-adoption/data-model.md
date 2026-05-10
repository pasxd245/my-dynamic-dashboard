# Data Model: Backend Packaging Tooling Adoption

**Date**: 2026-05-10  
**Spec**: [spec.md](spec.md)  
**Research**: [research.md](research.md)

## Overview

This feature introduces and formalizes configuration contracts rather than domain data tables. The entities below model authoritative packaging metadata, tooling policy, generated version artifact handling, and install workflow migration scope.

## Entity 1: BackendPackagingContract

- Purpose: Single source of truth for backend package metadata and dependency declarations.
- Backing file: `apps/backend/pyproject.toml`.
- Fields:
  - `project.name`: backend package identifier.
  - `project.dynamic`: contains `version`.
  - `project.requires-python`: Python compatibility floor.
  - `project.dependencies`: runtime dependency list migrated from `requirements.txt`.
  - `project.optional-dependencies.dev`: packaging/lint/release tools.
  - `project.optional-dependencies.test`: test and coverage tools.
  - `project.scripts`: backend CLI entrypoint mapping.
- Validation rules:
  - Must include every runtime dependency currently required by backend execution.
  - Must not remove runtime dependency pins/constraints without explicit behavior-change approval.
  - Must remain scoped to `apps/backend` only in this feature.

## Entity 2: BackendVersioningPolicy

- Purpose: Defines how backend version is resolved from VCS tags.
- Backing config:
  - `tool.hatch.version.source = "vcs"`
  - `tool.hatch.version.tag-pattern = "apps/backend/v(?P<version>.*)"`
  - `tool.hatch.version.raw-options.root = ".."`
  - `tool.commitizen.version_provider = "scm"`
  - `tool.commitizen.tag_format = "apps/backend/v$version"`
- Validation rules:
  - Tag format and tag pattern must stay backend-scoped.
  - Version resolution must produce deterministic fallback on trees without matching tags.

## Entity 3: ToolingPolicyContract

- Purpose: Consolidates lint, test, coverage, and changelog policy in project metadata.
- Backing config blocks:
  - `tool.ruff` and `tool.ruff.lint`
  - `tool.pytest.ini_options`
  - `tool.coverage.run`, `tool.coverage.report`
  - `tool.commitizen`
- Required values:
  - Ruff line length: `120`.
  - Ruff rule families: `E`, `F`, `B`, `SIM`, `I`.
  - Pytest discovery compatibility with existing backend tests.
  - Coverage exclusion parity with i18n-tool template block.
  - Commitizen conventional commits + changelog target.
- Validation rules:
  - Policy changes outside locked baseline are out of scope.
  - Migration must not mask existing test/lint failures.

## Entity 4: BackendVersionArtifact

- Purpose: Generated backend version module produced by hatch-vcs build hooks.
- Backing path: `apps/backend/app/_version.py`.
- Lifecycle:
  - Generated during build/version resolution.
  - Treated as generated artifact and excluded from source control.
- Validation rules:
  - Must be ignored by repository tracking.
  - No manual edits are part of this feature.

## Entity 5: BackendInstallWorkflow

- Purpose: Represents active human/automation install paths that must move from requirements file installs to metadata-driven installs.
- Primary touchpoints:
  - Top-level README backend quickstart commands.
  - `docs/development/setup.md` backend setup commands.
  - Backend container/dev workflow checks where dependency install behavior is defined.
- State transitions:
  - `legacy_requirements_path` -> `metadata_extras_path`.
- Validation rules:
  - Active setup instructions must not require `requirements.txt`.
  - Equivalent backend runtime/test behavior must be demonstrably preserved.

## Relationships

- BackendPackagingContract defines dependencies and extras consumed by BackendInstallWorkflow.
- BackendVersioningPolicy and ToolingPolicyContract are subordinate policy blocks inside BackendPackagingContract.
- BackendVersionArtifact is produced by BackendVersioningPolicy configuration.
- BackendInstallWorkflow validates operational use of BackendPackagingContract.

## Invariants

- No code movement under `apps/backend/app`.
- No API/runtime/data behavior changes introduced by this migration.
- `requirements.txt` retirement only occurs after dependency parity is confirmed in project metadata.
