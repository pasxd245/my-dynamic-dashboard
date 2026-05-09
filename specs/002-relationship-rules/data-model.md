# Data Model: Relationship Rules (Spec 002)

## Scope

- This feature replaces the legacy `relationships` stub table with governed relationship rule storage and immutable audit history.
- New entities are workspace-scoped and reference existing `columns` metadata.

## New Table: relationship_rules

```sql
CREATE TABLE IF NOT EXISTS relationship_rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  from_column_id TEXT NOT NULL REFERENCES columns(id),
  to_column_id TEXT NOT NULL REFERENCES columns(id),
  join_type TEXT NOT NULL,
  rel_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested',
  overlap_pct REAL,
  cardinality TEXT,
  low_overlap_acknowledged INTEGER NOT NULL DEFAULT 0,
  override_reason TEXT,
  actor TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Field constraints and semantics:

- `join_type`: enum-like text value in `inner|left|right|full`.
- `rel_type`: enum-like text value in `exact_key|normalized_key|date_window`.
- `status`: lifecycle value in `suggested|reviewed|approved|rejected`.
- `overlap_pct`: decimal ratio in `[0.0, 1.0]`; computed on create/edit.
- `cardinality`: enum-like text value in `1:1|1:N|N:1|N:N`.
- `low_overlap_acknowledged`: boolean integer (`0|1`) required for low-confidence warnings.
- `override_reason`: required for approval when `overlap_pct < 0.05`.

Recommended indexes:

- `idx_relationship_rules_workspace` on `(workspace_id)` for list operations.
- `idx_relationship_rules_status` on `(workspace_id, status)` for filtered readiness queries.
- `idx_relationship_rules_columns` on `(from_column_id, to_column_id)` for duplicate rule checks.

## New Table: relationship_audit

```sql
CREATE TABLE IF NOT EXISTS relationship_audit (
  id TEXT PRIMARY KEY,
  relationship_id TEXT NOT NULL REFERENCES relationship_rules(id),
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  actor TEXT,
  timestamp TEXT NOT NULL
);
```

Field constraints and semantics:

- `action`: enum-like text value in `created|reviewed|approved|rejected|edited|deleted`.
- `old_status`: nullable to support first creation event.
- `new_status`: lifecycle state after the action.
- `reason`: reviewer or system reason, required where policy enforces it.
- Table is append-only in application logic.

Recommended indexes:

- `idx_relationship_audit_relationship` on `(relationship_id, timestamp)` for timeline fetch.

## Legacy Stub Replacement

Legacy table to remove:

```sql
relationships(
  id,
  from_table_id,
  from_column,
  to_table_id,
  to_column,
  join_type,
  is_broken,
  created_at
)
```

Replacement policy:

- Drop `relationships` in migration after confirming no production dependency in feature 001 flows.
- Create `relationship_rules` and `relationship_audit` in the same migration path.
- Recreate/adjust indexes formerly tied to `relationships`.

## Migration Notes

- Migration order:
- 1. Create new tables and indexes if missing.
- 1. Optionally backfill from legacy `relationships` into `relationship_rules` with default `rel_type='exact_key'`, `status='suggested'`, and null overlap/cardinality.
- 1. Insert corresponding `relationship_audit` `created` events for backfilled rows.
- 1. Drop `relationships` after backfill validation.

- Backward compatibility:
- Existing endpoints do not rely on the stub `relationships`; feature 002 introduces the canonical API surface.

- Data integrity checks post-migration:
- Foreign keys resolve for all `from_column_id` and `to_column_id`.
- `status` values are valid lifecycle states.
- Audit rows exist for every created relationship.

## Lifecycle Rules (Application-Level)

- Create: new row starts as `suggested`; emit `relationship_audit(action='created', new_status='suggested')`.
- Review flow:
- `suggested -> reviewed`
- `reviewed -> approved|rejected`
- Edits reset status to `suggested` and emit `edited` audit event.
- Deletes remove active rule row and emit terminal `deleted` audit event before removal.

## Broken Rule Detection Inputs

- A rule is marked broken in list/get responses when:
- `from_column_id` or `to_column_id` no longer exists.
- Current `columns.effective_type` is incompatible with stored relationship assumptions.
- Broken-state is computed from current metadata and surfaced as derived output in API responses.
