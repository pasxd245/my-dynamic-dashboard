# Data Model: Test Scaffolding and MVP-1 Performance Harness

**Date**: 2026-05-10  
**Spec**: [spec.md](spec.md)  
**Research**: [research.md](research.md)

## Overview

This feature defines quality-governance entities for backend testing and performance validation. It does not introduce new production runtime data models.

## Entity 1: TestLayerDefinition

- Purpose: Canonical classification contract for backend tests.
- Backing surface: `apps/backend/tests/` directory structure + test-layer documentation.
- Fields:
  - `layer_name`: one of `unit`, `integration`, `contract`.
  - `scope_definition`: what behavior the layer is allowed to validate.
  - `allowed_dependencies`: infrastructure and fixture limits per layer.
  - `failure_interpretation`: expected triage meaning when failures occur.
  - `ownership_intent`: maintainer/release responsibilities.
- Validation rules:
  - Each test file is attributable to exactly one layer.
  - Layer names are fixed and cannot be renamed in this round.

## Entity 2: FactoryBlueprint

- Purpose: Reusable deterministic test-data construction contract.
- Backing surface: `apps/backend/tests/factories/` modules.
- Fields:
  - `factory_name`: helper identity (for example `make_workspace`).
  - `deterministic_defaults`: fixed default values for stable runs.
  - `override_fields`: explicit kwargs/override map accepted by the helper.
  - `composition_rules`: allowed nested factory composition patterns.
  - `target_layers`: layers expected to consume the helper.
- Validation rules:
  - Defaults must not be time-random unless explicitly injected by caller.
  - Overrides must be explicit and readable in test call sites.

## Entity 3: PerfScenarioDefinition

- Purpose: Declares each MVP-1 critical-flow performance check.
- Backing surface: `apps/backend/tests/perf/test_*.py`.
- Fields:
  - `scenario_id`: `upload_100k`, `preview`, or `export`.
  - `workload_shape`: representative data/flow setup.
  - `target_seconds`: threshold (`30`, `5`, `30` respectively).
  - `measurement_method`: monotonic timing or benchmark measurement strategy.
  - `pass_condition`: assertion expression for threshold conformance.
- Validation rules:
  - Every required MVP-1 scenario must be represented.
  - Thresholds are fixed for this feature round and cannot be relaxed silently.

## Entity 4: PerformanceHarnessRun

- Purpose: Single execution evidence record for perf validation.
- Backing surface: pytest output and optional benchmark artifact logs.
- Fields:
  - `run_timestamp`
  - `environment_context` (machine profile, Python version, dataset shape)
  - `scenario_results` (per scenario elapsed + pass/fail)
  - `overall_status`
- Validation rules:
  - Run is incomplete if any required scenario is missing.
  - Pass/fail must be explicit per scenario and for overall status.

## Entity 5: PytestExecutionProfile

- Purpose: Contract for default and opt-in suite behavior.
- Backing surface: backend pytest configuration and command documentation.
- Fields:
  - `profile_name`: `default` or `perf`.
  - `selector`: marker/path rules.
  - `included_layers`
  - `expected_use`: CI/local feedback vs release/perf gate.
- Validation rules:
  - Default profile must remain stable and exclude perf-only checks.
  - Perf profile must be opt-in and reproducible with explicit invocation.

## Relationships

- `TestLayerDefinition` governs where tests reside and how failures are interpreted.
- `FactoryBlueprint` is consumed by tests across layer definitions.
- `PerfScenarioDefinition` instances are executed under `PytestExecutionProfile(profile_name=perf)`.
- `PerformanceHarnessRun` captures the results of executing perf scenarios.

## Invariants

- Production behavior remains unchanged; no feature edits under runtime business logic paths are required by this model.
- Test-layer vocabulary is fixed to `unit`, `integration`, `contract`.
- Perf checks are opt-in and do not block default local test loop unless explicitly requested.
