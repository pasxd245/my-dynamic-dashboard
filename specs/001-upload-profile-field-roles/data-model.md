# Data Model: Upload + Profile + Field Roles (MVP 1)

## Entity: Workspace

- Purpose: Single-user container for uploaded sources, inferred schema, profiles, roles, and manifest history.
- Fields:
  - id (UUID, PK)
  - name (string, required)
  - status (enum: draft | ready_for_mvp2)
  - manifest_version (integer, required)
  - content_hash (string, sha256)
  - created_at (timestamp)
  - updated_at (timestamp)
- Validation:
  - `status=ready_for_mvp2` allowed only if readiness criteria pass (FR-009).

## Entity: SourceFile

- Purpose: Track uploaded `.xlsx`/`.csv` files and reproducibility hash state.
- Fields:
  - id (UUID, PK)
  - workspace_id (UUID, FK -> Workspace)
  - filename_original (string)
  - extension (enum: xlsx | csv)
  - content_hash (string, sha256)
  - encoding_detected (string, nullable)
  - parse_status (enum: pending | parsed | rejected)
  - reject_reason (string, nullable)
  - uploaded_at (timestamp)
- Validation:
  - Encrypted Excel files are rejected with `parse_status=rejected` and reason (FR-012).

## Entity: Sheet

- Purpose: Represent an addressable tabular range for each source sheet (or CSV logical sheet).
- Fields:
  - id (UUID, PK)
  - source_file_id (UUID, FK -> SourceFile)
  - sheet_name (string)
  - header_row_detected (integer)
  - header_row_effective (integer)
  - data_range_detected (string, A1 notation)
  - data_range_effective (string, A1 notation)
  - multi_range_warning (boolean)
  - committed_at (timestamp)
- Validation:
  - `header_row_effective` and `data_range_effective` are required before profile/role operations.

## Entity: Column

- Purpose: Represent typed schema units eligible for profile and role assignment.
- Fields:
  - id (UUID, PK)
  - sheet_id (UUID, FK -> Sheet)
  - name (string)
  - ordinal (integer)
  - inferred_type (enum: date | numeric | integer | string | boolean | categorical-candidate)
  - effective_type (same enum)
  - type_override_reason (string, nullable)
  - is_all_null (boolean)
- Validation:
  - `effective_type` defaults to `inferred_type` unless override exists.

## Entity: ColumnProfile

- Purpose: Store per-column quality profile and warnings for role enforcement.
- Fields:
  - id (UUID, PK)
  - column_id (UUID, FK -> Column)
  - null_ratio (float 0..1)
  - distinct_count (integer)
  - uniqueness_ratio (float 0..1)
  - duplicate_signature (string/json)
  - numeric_min (number, nullable)
  - numeric_max (number, nullable)
  - date_min (timestamp, nullable)
  - date_max (timestamp, nullable)
  - top_k_values_json (json)
  - warnings_json (json array)
  - sampled (boolean)
  - sample_size (integer, nullable)
  - sample_seed (integer, nullable)
  - computed_at (timestamp)
- Validation:
  - `sample_size` and `sample_seed` required when `sampled=true` (FR-013).

## Entity: RoleAssignment

- Purpose: Link columns to business roles with compatibility enforcement and auditable overrides.
- Fields:
  - id (UUID, PK)
  - column_id (UUID, FK -> Column)
  - role (enum: identity_key | time_anchor | measure | dimension | status | source_of_truth_outcome)
  - accepted (boolean)
  - override_used (boolean)
  - override_reason (string, nullable)
  - assigned_by (string/user-id placeholder)
  - assigned_at (timestamp)
- Validation:
  - `time_anchor`: requires effective type `date`; no override allowed.
  - `measure`: numeric/integer preferred; override allowed with required reason.
  - `identity_key`: uniqueness >= 0.99 preferred; override allowed with required reason.

## Entity: OverrideLog

- Purpose: Full traceability for all user/system overrides.
- Fields:
  - id (UUID, PK)
  - workspace_id (UUID, FK -> Workspace)
  - target_kind (enum: sheet_header | sheet_range | column_type | role_assignment)
  - target_id (UUID/string)
  - old_value_json (json)
  - new_value_json (json)
  - reason (string)
  - actor (string)
  - created_at (timestamp)

## Entity: ManifestSnapshot

- Purpose: Reproducibility document checkpoint used for export/import.
- Fields:
  - id (UUID, PK)
  - workspace_id (UUID, FK -> Workspace)
  - manifest_version (integer)
  - manifest_json (json)
  - manifest_hash (string)
  - exported_at (timestamp)
- Validation:
  - Import path must verify source hashes before reconstructing state (FR-008).

## Relationships

- Workspace 1..N SourceFile
- SourceFile 1..N Sheet
- Sheet 1..N Column
- Column 1..N ColumnProfile (versioned snapshots; latest active)
- Column 1..N RoleAssignment
- Workspace 1..N OverrideLog
- Workspace 1..N ManifestSnapshot

## State Transitions

1. Workspace `draft` -> upload sources -> source parse states (`parsed` or `rejected`).
2. Parsed sheets become committed after header/range resolution.
3. Profiles computed -> columns become role-eligible (subject to warnings).
4. Role assignments applied with compatibility checks/override logs.
5. Readiness evaluator checks required role coverage + unresolved critical warnings.
6. Workspace status transitions `draft -> ready_for_mvp2` when FR-009 is satisfied.
7. Manifest export snapshots current state; import reconstructs only when hash checks pass.
