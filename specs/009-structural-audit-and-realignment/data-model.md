# Data Model: Structural Audit And Directory Realignment

**Spec**: `/specs/009-structural-audit-and-realignment/spec.md`  
**Research**: `/specs/009-structural-audit-and-realignment/research.md`  
**Date**: 2026-05-10

This data model captures the planning entities and lifecycle rules for Round 23 backend structural realignment.

## Entity: StructuralAuditReport

Review artifact describing the backend’s current coupling, approved move boundaries, and deferred items.

### Fields

- `report_id` (string, required)
- `round_id` (string, required): `Round_23`
- `sources_used` (array of enum, required): `direct_file_read | import_scan | test_evidence | crg_supplement`
- `coverage_notes` (array of string, required)
- `hotspots` (array of string, required)
- `approved_moves` (array of `LayoutMove`, required)
- `deferred_items` (array of string, required)
- `approved_at` (timestamp, optional)

### Validation Rules

- `sources_used` must include at least `direct_file_read` and `import_scan`.
- `deferred_items` must include frontend and tooling adoption.
- `approved_moves` must cover every backend module touched in the round.

## Entity: LayoutMove

One approved file or responsibility move inside `apps/backend/app/`.

### Fields

- `source_path` (string, required)
- `target_path` (string, required)
- `move_type` (enum, required): `move | split | keep | delete | add`
- `responsibility_after_move` (enum, required): `entrypoint | api | app_orchestrator | core_primitive | model | service | utility | resource`
- `behavioral_invariant` (string, required)

### Validation Rules

- `target_path` must remain under `apps/backend/app/`.
- `move_type=delete` is valid only when replacement ownership or verified removal is documented.
- `behavioral_invariant` must state what public behavior remains unchanged.

## Entity: BackendLayoutContract

Target backend package structure and ownership rules.

### Fields

- `root_path` (string, required): `apps/backend/app/`
- `required_top_level_files` (array of string, required)
- `required_top_level_directories` (array of string, required)
- `ownership_rules` (array of `OwnershipRule`, required)
- `entrypoint_contract` (`EntrypointContract`, required)

### Validation Rules

- Required files must include `__main__.py`, `main.py`, `shared.py`.
- Required directories must include `api/`, `apps/`, `core/`, `models/`, `services/`, `utils/`, `resources/`.
- Ownership rules must prevent domain-specific business logic from landing in `core/` or `utils/`.

## Entity: OwnershipRule

Boundary rule for a backend directory.

### Fields

- `scope_name` (enum, required): `api | apps | core | models | services | utils | resources`
- `allowed_content` (array of string, required)
- `forbidden_content` (array of string, required)
- `examples` (array of string, optional)

### Validation Rules

- `core` must not own use-case orchestration.
- `utils` must not own domain-specific business rules.
- `api` must preserve public request/response behavior while delegating orchestration elsewhere.

## Entity: EntrypointContract

Stable startup contract for `__main__.py` and `main.py`.

### Fields

- `main_module_path` (string, required)
- `cli_entrypoint_path` (string, required)
- `app_factory_symbol` (string, required)
- `startup_dependencies` (array of string, required)
- `preserved_behaviors` (array of string, required)

### Validation Rules

- Startup must remain stable under existing backend run/test flows.
- Entry points must resolve configuration through the unified config surface.

## Entity: ApplicationConfigurationContract

Unified configuration surface for the backend.

### Fields

- `manager_name` (string, required): `AppConfig`
- `defaults_path` (string, required): `apps/backend/app/resources/default.yaml`
- `precedence_order` (array of string, required)
- `env_helper_surface` (array of string, required)
- `constant_sets` (array of string, required): `Const`, `Fields`
- `accessors` (array of string, required)

### Validation Rules

- `precedence_order` must equal `.env`, `default.yaml`, `CONFIG_FILE` in ascending precedence.
- Accessor list must cover currently required backend runtime paths and settings.
- Bare `os.getenv` and `os.environ` reads are disallowed in `apps/backend/app/` after migration.

## Entity: ServiceMigrationSlice

One independently verifiable slice of service-layer internal migration.

### Fields

- `service_name` (string, required)
- `current_access_pattern` (enum, required): `sqlite3_raw | mixed | session`
- `target_access_pattern` (enum, required): `sqlite3_raw | mixed | session`
- `public_contract_invariant` (string, required)
- `dependent_routes` (array of string, optional)
- `shim_dependencies` (array of string, optional)
- `verification_checks` (array of string, required)

### Validation Rules

- `public_contract_invariant` must name the behavior preserved during migration.
- A slice cannot remove a shared shim until all `shim_dependencies` are eliminated.

## Entity: SchemaSurfaceModule

Consolidated schema ownership unit replacing monolithic `schemas.py` ownership.

### Fields

- `module_name` (string, required)
- `dto_types` (array of string, required)
- `consumers` (array of string, required)
- `contract_category` (enum, required): `request | response | shared`
- `compatibility_notes` (array of string, optional)

### Validation Rules

- DTO field names and serialized behavior must remain compatible with current API contracts.
- Consumer imports must stay valid through the consolidation transition.

## Entity: MetadataShimRemovalState

State used to govern safe removal of legacy metadata helpers.

### Fields

- `shim_name` (string, required): `init_metadata_db` or `metadata_db.py`
- `remaining_imports` (array of string, required)
- `replacement_paths` (array of string, required)
- `removal_ready` (boolean, required)
- `verification_command` (string, required)

### Validation Rules

- `removal_ready=true` requires `remaining_imports` to be empty.
- `metadata_db.py` may be deleted only after replacement paths are in place and verification passes.

## Relationships

- `StructuralAuditReport` 1:N `LayoutMove`
- `BackendLayoutContract` 1:N `OwnershipRule`
- `BackendLayoutContract` 1:1 `EntrypointContract`
- `ApplicationConfigurationContract` 1:N `ServiceMigrationSlice`
- `SchemaSurfaceModule` N:N `ServiceMigrationSlice`
- `MetadataShimRemovalState` N:1 `ServiceMigrationSlice`

## State Transition Rules

1. Structural convergence:
   - `current_layout` -> `audit_approved` -> `target_layout_present`

2. Configuration convergence:
   - `scattered_env_reads` -> `mixed_access` -> `AppConfig_only`

3. Service migration:
   - `sqlite3_raw` -> `mixed` -> `session_backed`
   - public behavior must remain unchanged at every step

4. Schema consolidation:
   - `monolithic_schemas_py` -> `consolidated_schema_surface`
   - DTO compatibility must hold through the transition

5. Shim removal:
   - `shim_in_use` -> `replacement_in_place` -> `imports_zero` -> `deleted`

## Canonical In-Scope Objects

- Structural audit report
- Backend layout contract
- Application configuration contract
- Service migration slices
- Consolidated schema surface
- Metadata shim removal state

## Canonical Out-Of-Scope Objects

- Builder/frontend layout changes
- Tooling adoption (`pyproject.toml`, Ruff, Commitizen, `hatch-vcs`)
- Intentional API contract redesign
- Relationship-rule semantic changes
