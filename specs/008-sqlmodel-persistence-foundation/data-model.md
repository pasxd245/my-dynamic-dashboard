# Data Model: SQLModel Persistence Foundation

**Spec**: `/specs/008-sqlmodel-persistence-foundation/spec.md`  
**Research**: `/specs/008-sqlmodel-persistence-foundation/research.md`  
**Date**: 2026-05-10

This data model captures persistence-governance entities and migration lifecycle rules for feature 008.

## Entity: MetadataModelGroup

Represents grouped declarative ownership of legacy metadata tables.

### Fields

- `group_name` (enum, required): `workspace | source | legacy_files | relationship | saved_query | dashboard | deployment | column_mappings`
- `module_path` (string, required)
- `table_names` (array of string, required)
- `scope_type` (enum, required): `legacy_parity | new_foundation`

### Validation Rules

- `legacy_parity` groups must map only to pre-existing tables from `metadata_db.py`.
- `new_foundation` is allowed only for `column_mappings` in this round.

## Entity: LegacyMetadataTableContract

Represents parity contract for one legacy table now owned by declarative models.

### Fields

- `table_name` (string, required)
- `columns` (array, required)
- `primary_key` (array of string, required)
- `foreign_keys` (array, optional)
- `indexes` (array, optional)
- `legacy_source` (string, required): path and section for original SQL definition

### Validation Rules

- The set of `table_name` values must equal the 26-table legacy baseline.
- Saved-query additive columns previously introduced via startup patch logic must be represented in baseline columns.

## Entity: ColumnDefinition

Column-level parity and migration contract.

### Fields

- `name` (string, required)
- `type` (string, required)
- `nullable` (boolean, required)
- `default_expression` (string, optional)
- `check_constraint` (string, optional)
- `is_indexed` (boolean, required)

### Validation Rules

- Type and nullability must preserve legacy behavior unless explicitly approved (`column_mappings` only).
- Check constraints must be preserved or formally documented as equivalent.

## Entity: ColumnMappingRecord

Future-facing rename lineage record.

### Fields

- `id` (string, required, primary key)
- `workspace_id` (string, required, FK -> `workspaces.id`)
- `source_file_id` (string, nullable, FK -> `source_files.id`)
- `from_column_name` (string, required)
- `to_column_name` (string, required)
- `from_version` (integer, required)
- `to_version` (integer, required)
- `confidence` (float, required)
- `accepted_by` (string, nullable)
- `created_at` (timestamp, required)

### Validation Rules

- `confidence` must be within inclusive bounds `0.0 <= confidence <= 1.0`.
- `to_version` must be greater than or equal to `from_version`.
- `source_file_id` may be null, but `workspace_id` is always required.

## Entity: MigrationRevision

Versioned migration unit managed by Alembic.

### Fields

- `revision_id` (string, required)
- `down_revision` (string or null, required)
- `title` (string, required)
- `operation_type` (enum, required): `baseline_create | additive_table`
- `tables_touched` (array of string, required)

### Validation Rules

- Initial baseline revision must contain per-model `op.create_table()` operations only.
- `0002_column_mappings` must only add the new table and required indexes/constraints.

## Entity: MigrationTrackingState

Represents runtime migration-state posture for a metadata DB file.

### Fields

- `db_path` (string, required)
- `db_exists` (boolean, required)
- `has_alembic_version_table` (boolean, required)
- `current_revision` (string, nullable)
- `target_revision` (string, required)
- `startup_action` (enum, required): `upgrade_only | stamp_then_upgrade | no_op`

### Validation Rules

- `startup_action=stamp_then_upgrade` is valid only when `db_exists=true` and `has_alembic_version_table=false`.
- `startup_action=upgrade_only` is used for fresh DB or tracked DB upgrades.

## Entity: StartupMigrationRun

Single startup orchestration attempt for migration convergence.

### Fields

- `run_id` (string, required)
- `started_at_utc` (timestamp, required)
- `finished_at_utc` (timestamp, optional)
- `detected_state` (`MigrationTrackingState`, required)
- `steps` (array, required)
- `outcome` (enum, required): `success | failure`
- `failure_reason` (string, optional)

### Step Entry Fields

- `name` (enum, required): `detect_state | stamp_head | upgrade_head`
- `status` (enum, required): `passed | skipped | failed`
- `detail` (string, optional)

### Validation Rules

- `stamp_head` step must be `passed` only when startup action is `stamp_then_upgrade`.
- On `outcome=failure`, `failure_reason` is required.

## Relationships

- `MetadataModelGroup` 1:N `LegacyMetadataTableContract`
- `LegacyMetadataTableContract` 1:N `ColumnDefinition`
- `MigrationRevision` N:N `LegacyMetadataTableContract` (by `tables_touched`)
- `MigrationTrackingState` 1:N `StartupMigrationRun`
- `ColumnMappingRecord` N:1 `LegacyMetadataTableContract` (`source_files`, `workspaces`)

## State Transition Rules

1. Startup migration state transitions:
   - `db_exists=false` -> `upgrade_only` -> success creates schema at head.
   - `db_exists=true && has_alembic_version_table=false` -> `stamp_then_upgrade` -> migration tracked at head.
   - `db_exists=true && has_alembic_version_table=true` -> `upgrade_only` (idempotent when already at head).

2. Governance transitions:
   - Legacy schema ownership: `raw_sql_owned` -> `declarative_owned` after baseline migration lands.
   - Runtime init path: `init_metadata_db primary` -> `migration bootstrap primary` while legacy initializer remains available for rollback.

3. Scope guard transitions:
   - Service data access remains `sqlite3_raw` throughout this feature.
   - Any transition to ORM session-backed services is deferred to a future feature.

## Canonical Legacy Table Set

Parity baseline in scope for declarative ownership:

- `workspaces`
- `source_files`
- `sheets`
- `columns`
- `column_profiles`
- `role_assignments`
- `override_logs`
- `manifest_snapshots`
- `files`
- `file_schemas`
- `relationship_rules`
- `relationship_audit`
- `saved_queries`
- `query_execution_log`
- `dashboards`
- `dashboard_panels`
- `dashboard_runs`
- `dashboard_run_panels`
- `dashboard_run_events`
- `deployment_bundles`
- `backup_artifacts`
- `deployment_events`
- `restore_runs`
- `saved_query_versions`
- `saved_query_events`
- `saved_query_executions`

Approved additions for this feature only:

- `alembic_version`
- `column_mappings`
