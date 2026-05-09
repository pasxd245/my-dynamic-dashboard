# Data Model: Builder Experience Hardening + Workflow Shell

**Spec**: `/specs/007-builder-experience-hardening-workflow-shell/spec.md`  
**Research**: `/specs/007-builder-experience-hardening-workflow-shell/research.md`  
**Date**: 2026-05-09

This model defines the state and contract entities for connectivity readiness, explicit active context, workflow-shell progression, and stage-attributed smoke verification.

## Entity: ConnectionStatus

Represents current readiness for builder workflow actions.

### Fields

- `status` (enum, required): `ready | degraded | unavailable`
- `last_checked_at_utc` (timestamp, required)
- `summary` (string, required): user-facing one-line health meaning
- `guidance` (string, required): immediate recovery guidance
- `dependencies` (array, required): dependency-level outcomes
- `degraded_capabilities` (array, optional): blocked capability keys when degraded
- `correlation_id` (string, optional)

### Dependency Entry Fields

- `name` (string, required): e.g., `metadata_db`, `workspace_service`, `query_validation`
- `status` (enum, required): `ok | degraded | failed`
- `detail` (string, optional)

### Validation Rules

- `ready` requires all dependency entries in `ok`.
- `unavailable` requires at least one critical dependency with `failed`.
- `guidance` must be non-empty for all statuses.

## Entity: ActiveWorkspaceContext

Explicitly selected workspace state for builder actions.

### Fields

- `workspace_id` (string, required)
- `workspace_name` (string, required)
- `state` (enum, required): `resolved | unresolved | stale`
- `selected_at_utc` (timestamp, optional)
- `resolved_at_utc` (timestamp, optional)

### Validation Rules

- `workspace_id` must be present for `resolved` and `stale` states.
- Query/saved actions are blocked unless state is `resolved`.

## Entity: ActiveSourceContext

Explicitly selected source under the active workspace.

### Fields

- `source_id` (string, required)
- `source_name` (string, required)
- `workspace_id` (string, required)
- `state` (enum, required): `resolved | unresolved | stale`
- `selected_at_utc` (timestamp, optional)
- `resolved_at_utc` (timestamp, optional)

### Validation Rules

- `workspace_id` must match `ActiveWorkspaceContext.workspace_id` when both are `resolved`.
- Query/saved actions are blocked unless state is `resolved`.

## Entity: WorkflowStage

Represents shell stage, completion signal, and prerequisites.

### Fields

- `stage_key` (enum, required): `upload_source | schema_sheet | query | results_saved`
- `title` (string, required)
- `order_index` (integer, required)
- `status` (enum, required): `locked | ready | in_progress | completed`
- `prerequisites` (array, required): prerequisite keys
- `missing_prerequisites` (array, optional)
- `next_stage_key` (enum, optional)
- `previous_stage_key` (enum, optional)

### Validation Rules

- `order_index` values must be unique and continuous from 1..4.
- `query` and `results_saved` stages require resolved workspace/source context.

## Entity: ActionableError

Standardized error outcome for user-facing builder actions.

### Fields

- `error_code` (string, required)
- `stage` (enum, required): `upload_source | schema_sheet | query | results_saved | global`
- `user_message` (string, required)
- `next_steps` (array of string, required)
- `technical_details` (object, optional)
- `show_technical_by_default` (boolean, required): must be `false`
- `correlation_id` (string, required)
- `occurred_at_utc` (timestamp, required)

### Validation Rules

- `user_message` and at least one `next_steps` entry are mandatory.
- `technical_details` must never replace `user_message` as primary content.

## Entity: BuilderSessionState

Composite shell state rendered in builder header and navigation.

### Fields

- `connection_status` (`ConnectionStatus`, required)
- `active_workspace` (`ActiveWorkspaceContext`, required)
- `active_source` (`ActiveSourceContext`, required)
- `current_stage` (enum, required)
- `stages` (array of `WorkflowStage`, required)

### Validation Rules

- If active workspace or source is `unresolved|stale`, `current_stage=query|results_saved` must expose blocked-actions state.
- State source of truth is backend/session API; frontend cache cannot fabricate fallback IDs.

## Entity: SmokeFlowResult

Stage-by-stage execution result for release smoke validation.

### Fields

- `run_id` (string, required)
- `started_at_utc` (timestamp, required)
- `finished_at_utc` (timestamp, optional)
- `overall_status` (enum, required): `passed | failed`
- `stages` (array, required)
- `first_failed_stage` (enum, optional)

### Stage Result Fields

- `stage_key` (enum, required): `create_workspace | upload_data | validate_query | list_saved_queries`
- `status` (enum, required): `passed | failed | skipped`
- `duration_ms` (integer, required)
- `diagnostic` (string, optional)

### Validation Rules

- On `overall_status=failed`, `first_failed_stage` is required.
- Stages must be recorded in canonical order.

## Relationships

- `BuilderSessionState` 1:1 `ConnectionStatus`
- `BuilderSessionState` 1:1 `ActiveWorkspaceContext`
- `BuilderSessionState` 1:1 `ActiveSourceContext`
- `BuilderSessionState` 1:N `WorkflowStage`
- `ActionableError` N:1 `WorkflowStage` (via `stage`)
- `SmokeFlowResult` 1:N stage results

## State Transition Rules

1. Active context transitions:
   - `unresolved -> resolved` after explicit selection.
   - `resolved -> stale` when workspace/source disappears or mismatches backend truth.
   - `stale -> resolved` only after explicit reselection.

2. Connection transitions:
   - `ready <-> degraded <-> unavailable` via preflight refresh.
   - Transition to `ready` requires all critical dependency checks passing.

3. Action gating:
   - Query validation, query execution, and saved-query operations require:
     - `connection_status.status in {ready, degraded}` with capability not blocked,
     - `active_workspace.state=resolved`,
     - `active_source.state=resolved`.
   - Hidden fallback IDs are prohibited at all gates.

## Cross-Spec Continuity

- Extends specs 001-004 workflows without changing core domain semantics.
- Preserves saved query behavior (spec 004) while adding explicit context and standardized errors.
- Maintains compatibility with builder-to-backend API contracts defined in earlier specs.
