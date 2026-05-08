# Data Model: Saved Queries (MVP 2)

**Spec**: `/specs/004-saved-queries/spec.md`
**Research**: `/specs/004-saved-queries/research.md`
**Date**: 2026-05-08

## Entities

### saved_queries

Represents the persistent library identity and lifecycle state of a saved query.

```sql
CREATE TABLE saved_queries (
  query_id TEXT PRIMARY KEY,                  -- UUID v4, immutable
  workspace_id TEXT NOT NULL,                 -- Workspace scope
  owner_user_id TEXT NOT NULL,                -- Creator/owner user ID
  canonical_name TEXT NOT NULL,               -- Current display name
  current_version_id TEXT NOT NULL,           -- Link to latest version (denormalized for query performance)
  source_query_id TEXT,                       -- If this is a variant, link to source query (NULL for original)
  created_at TIMESTAMP NOT NULL,              -- Query creation time
  updated_at TIMESTAMP NOT NULL,              -- Last updated (latest version timestamp)
  deleted_at TIMESTAMP,                       -- Soft-delete timestamp (NULL if active)
  recoverable_until TIMESTAMP,                -- Grace window expiry (24h after deleted_at)

  FOREIGN KEY (current_version_id) REFERENCES saved_query_versions(version_id),
  FOREIGN KEY (source_query_id) REFERENCES saved_queries(query_id),
  UNIQUE (workspace_id, owner_user_id, canonical_name),

  CHECK (deleted_at IS NULL OR recoverable_until IS NOT NULL),
  CHECK (created_at <= updated_at)
);

-- Indexes for common queries
CREATE INDEX idx_saved_queries_workspace_user ON saved_queries(workspace_id, owner_user_id);
CREATE INDEX idx_saved_queries_deleted_at ON saved_queries(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_saved_queries_recoverable ON saved_queries(recoverable_until) WHERE recoverable_until IS NOT NULL;
```

**Semantics**:

- `query_id`: Globally unique identifier; immutable after creation.
- `workspace_id`, `owner_user_id`: Enforce scope. In MVP 2, each user owns their queries independently (no sharing).
- `canonical_name`: Current name displayed in library. Unique per (workspace, user) pair. Updated when analyst renames via new version.
- `current_version_id`: Denormalized pointer to latest version for fast "what's the current version?" queries. Updated each time a new version is created.
- `source_query_id`: Links variants to their source. NULL for original queries, non-NULL for duplicates/variants. Preserves fork lineage for UI "show me the source" flows.
- `deleted_at`: NULL if active, timestamp if soft-deleted. Used to filter active library.
- `recoverable_until`: Calculated as `deleted_at + 24 hours`. Used to check if restore is still valid. Immutable once set.
- `created_at`, `updated_at`: Audit timestamps. `created_at` never changes; `updated_at` is set to latest version's `created_at`.

**Lifecycle**:

1. Query is created (INSERT) with `deleted_at = NULL`, `recoverable_until = NULL`
2. Analyst may create new versions (does not modify row, inserts new version row)
3. Analyst deletes query (UPDATE): set `deleted_at = NOW()`, `recoverable_until = NOW() + 24h`
4. Within 24h, analyst may restore (UPDATE): set `deleted_at = NULL`, `recoverable_until = NULL`
5. After 24h, query expires and is hard-deleted or archived (future operation)

---

### saved_query_versions

Immutable snapshots of a saved query at a point in time. Each version captures complete builder state and generated SQL.

```sql
CREATE TABLE saved_query_versions (
  version_id TEXT PRIMARY KEY,                -- UUID v4, immutable, globally unique
  query_id TEXT NOT NULL,                     -- Link to parent saved query (immutable)
  version_number INTEGER NOT NULL,            -- Auto-increment per query (1, 2, 3, ...)
  parent_version_id TEXT,                     -- Previous version in linear chain (NULL for version 1)
  created_by TEXT NOT NULL,                   -- User ID who created this version
  created_at TIMESTAMP NOT NULL,              -- Version creation timestamp

  name TEXT NOT NULL,                         -- Name of query at this version
  description TEXT,                           -- Description (may be NULL or empty)
  tags_json TEXT NOT NULL,                    -- JSON array: ["tag1", "tag2"] (always valid JSON, may be "[]")
  change_summary TEXT,                        -- User-provided reason for this version (e.g., "Added profit margin filter")

  builder_snapshot_json TEXT NOT NULL,        -- Complete builder state JSON:
                                              -- {
                                              --   "baseTable": { "tableId": "...", "tableName": "..." },
                                              --   "selectedColumns": [{ "columnId": "...", "columnName": "...", "dataType": "..." }],
                                              --   "filters": [{ "columnId": "...", "operator": "=", "values": [...] }],
                                              --   "aggregations": [{ "columnId": "...", "functions": ["SUM", "COUNT"] }],
                                              --   "groupBy": [{ "columnId": "...", "columnName": "..." }],
                                              --   "joins": [{ "relationshipId": "...", "joinType": "INNER", "targetTable": "..." }]
                                              -- }

  sql_snapshot TEXT NOT NULL,                 -- Immutable SQL generated from builder at save time

  validation_state TEXT NOT NULL,             -- Enum: "valid" | "invalid_schema_drift" | "invalid_relationship_downgrade" | "unknown"
                                              -- Indicates if the snapshot is currently valid; set at save time, may become invalid if schema changes

  FOREIGN KEY (query_id) REFERENCES saved_queries(query_id),
  FOREIGN KEY (parent_version_id) REFERENCES saved_query_versions(version_id),
  UNIQUE (query_id, version_number),
  CHECK (version_number >= 1),
  CHECK (parent_version_id IS NULL OR version_number > 1)
);

-- Indexes
CREATE INDEX idx_saved_query_versions_query_id ON saved_query_versions(query_id, version_number DESC);
CREATE INDEX idx_saved_query_versions_created_at ON saved_query_versions(query_id, created_at DESC);
```

**Semantics**:

- `version_id`: Globally unique UUID; immutable. Used in execution history to link runs to exact snapshot.
- `query_id`: Foreign key to parent saved_queries row. Establishes version belongs to this query.
- `version_number`: Sequential per query. Query 1 has versions 1, 2, 3, ... Query 2 has versions 1, 2, 3, ... Auto-increment per query.
- `parent_version_id`: Points to previous version (if any). Forms linear chain: V1 → V2 → V3. NULL for V1. Used to compute "what changed" diffs and preserve temporal causality.
- `created_by`: User ID who triggered this save/update/version creation. Immutable once set.
- `created_at`: Timestamp of version creation. Immutable.
- `name`, `description`, `tags_json`: Metadata snapshot. Metadata updates create new versions (not inline updates).
- `change_summary`: Optional reason provided by user (e.g., "Fixed filter for Q2 2026"). Helps analysts understand why version was created.
- `builder_snapshot_json`: Complete builder DSL serialized as JSON. Immutable. References column and relationship IDs (not names) for traceability.
- `sql_snapshot`: SQL text generated from builder at save time. Immutable. Analyst can inspect original SQL without re-generating.
- `validation_state`: Set to "valid" at save time. May be updated to "invalid\_\*" if schema/relationships change later. Used by load endpoint to warn analysts.

**Constraints**:

- `version_number >= 1`: Cannot be 0 or negative.
- `parent_version_id IS NULL OR version_number > 1`: V1 has no parent; all others must have parent.
- `UNIQUE (query_id, version_number)`: No two versions of same query can have same number.

---

### saved_query_executions

Immutable record of each time a saved query version is executed.

```sql
CREATE TABLE saved_query_executions (
  execution_id TEXT PRIMARY KEY,              -- UUID v4, immutable, globally unique
  query_id TEXT NOT NULL,                     -- Link to saved query
  version_id TEXT NOT NULL,                   -- Link to exact version executed (immutable snapshot)
  executed_by TEXT NOT NULL,                  -- User ID who triggered execution
  executed_at TIMESTAMP NOT NULL,             -- Execution start time

  status TEXT NOT NULL,                       -- Enum: "success" | "timeout" | "error" | "cancelled"
  row_count INTEGER,                          -- Final result row count; NULL if status != "success"
  execution_ms INTEGER,                       -- Wall-clock time in milliseconds; NULL if timeout/cancelled/error
  error_message TEXT,                         -- Error detail if status = "error" (NULL otherwise)

  FOREIGN KEY (query_id) REFERENCES saved_queries(query_id),
  FOREIGN KEY (version_id) REFERENCES saved_query_versions(version_id),
  CHECK (status IN ('success', 'timeout', 'error', 'cancelled')),
  CHECK ((status = 'success' AND row_count IS NOT NULL) OR status != 'success'),
  CHECK ((status = 'success' AND execution_ms IS NOT NULL) OR status != 'success')
);

-- Indexes
CREATE INDEX idx_saved_query_executions_query_id ON saved_query_executions(query_id);
CREATE INDEX idx_saved_query_executions_version_id ON saved_query_executions(version_id);
CREATE INDEX idx_saved_query_executions_executed_at ON saved_query_executions(executed_at DESC);
CREATE INDEX idx_saved_query_executions_status ON saved_query_executions(status);
```

**Semantics**:

- `execution_id`: UUID; immutable audit record.
- `query_id`, `version_id`: Immutable links. Preserves which exact version was executed.
- `executed_by`: User who clicked "Execute Query" or triggered API call. Audit trail.
- `executed_at`: Start timestamp. Used for timeline and ordering.
- `status`: One of four outcomes. Supports filtering (show all timeouts, show all errors).
- `row_count`: Final result set size (includes filters, aggregations, GROUP BY). NULL if query failed or timed out.
- `execution_ms`: Wall-clock duration in milliseconds. NULL if not applicable.
- `error_message`: If status = "error", contains error detail (e.g., "Column 'revenue' does not exist"). NULL otherwise.

**Constraints**:

- If status = "success", row_count and execution_ms must be NOT NULL.
- If status != "success", row_count and execution_ms may be NULL.

---

### saved_query_events

Append-only audit log of lifecycle events: delete, restore, duplicate, variant creation.

```sql
CREATE TABLE saved_query_events (
  event_id TEXT PRIMARY KEY,                  -- UUID v4, immutable
  query_id TEXT NOT NULL,                     -- Link to affected query (immutable)
  version_id TEXT,                            -- Link to version (if applicable), NULL for query-level events
  actor_user_id TEXT NOT NULL,                -- User who triggered event
  event_type TEXT NOT NULL,                   -- Enum: "created" | "deleted" | "restored" | "duplicated" | "variant_created" | "version_created" | "metadata_updated"
  event_payload_json TEXT NOT NULL,           -- JSON payload with event-specific details
  created_at TIMESTAMP NOT NULL,              -- Event timestamp (immutable)

  FOREIGN KEY (query_id) REFERENCES saved_queries(query_id),
  FOREIGN KEY (version_id) REFERENCES saved_query_versions(version_id),
  CHECK (event_type IN ('created', 'deleted', 'restored', 'duplicated', 'variant_created', 'version_created', 'metadata_updated'))
);

-- Indexes
CREATE INDEX idx_saved_query_events_query_id ON saved_query_events(query_id);
CREATE INDEX idx_saved_query_events_event_type ON saved_query_events(event_type);
CREATE INDEX idx_saved_query_events_created_at ON saved_query_events(created_at DESC);
```

**Semantics**:

- `event_id`: Immutable audit record identifier.
- `query_id`: Query being audited.
- `version_id`: If event is "version_created", links to new version. NULL for query-level events.
- `actor_user_id`: Who did it.
- `event_type`:
  - `"created"`: Query was first created
  - `"deleted"`: Query was soft-deleted
  - `"restored"`: Query was restored from soft-delete
  - `"duplicated"`: Query was duplicated (payload includes new_query_id)
  - `"variant_created"`: Variant was created from source (payload includes source_query_id, new_query_id)
  - `"version_created"`: New version was created (version_id populated)
  - `"metadata_updated"`: Name/description/tags changed (new version created separately)
- `event_payload_json`: Event-specific data. Examples:

  ```json
  { "type": "created", "name": "Monthly Sales Report" }
  { "type": "deleted", "recoverable_until": "2026-05-09T12:34:56Z" }
  { "type": "restored", "restored_at": "2026-05-08T10:00:00Z" }
  { "type": "duplicated", "source_version_id": "...", "new_query_id": "..." }
  { "type": "version_created", "version_number": 3, "parent_version_id": "..." }
  ```

---

## State Machine

### saved_queries Lifecycle

```
┌─────────┐
│ created │  (initial state, deleted_at = NULL)
└────┬────┘
     │
     ├─────────────────────────────────────────────┐
     │ (analyst creates new version)                │
     │ (analyst modifies name/description/tags)    │
     │ (analyst duplicates or creates variant)     │
     │ (executions recorded)                        │
     └────────────────────────────────────────────┐│
     │                                             ││
     ▼                                             ││
┌─────────────────┐  DELETE  ┌───────────────┐   ││
│ active / latest ├───────────► soft-deleted │   ││
└────────┬────────┘           └──────┬────────┘   ││
         │                            │            ││
         ▲────────────┐  RESTORE ◄────┘            ││
         │            │         │ (within 24h)    ││
         │            │         │                 ││
         │     ┌──────┴──────────┘                 ││
         │     │ (after 24h)                      ││
         │     ▼                                   ││
         │  ┌──────────┐                          ││
         │  │ expired  │ (hard-delete or archive) ││
         │  └──────────┘                          ││
         │                                        ││
         └────────────────────────────────────────┘│
                 └──────────────────────────────────┘
```

### saved_query_versions Lifecycle

Versions are **immutable after creation**. Once created, they never change. New versions are created by save/edit/duplicate operations.

```
Version 1 ← Version 2 ← Version 3 ← ...
(initial)    (edited)    (edited)
```

Each version has `validation_state`:

- `"valid"`: Snapshot is valid; all columns/relationships current
- `"invalid_schema_drift"`: Column was deleted or type changed
- `"invalid_relationship_downgrade"`: Referenced relationship is no longer approved
- `"unknown"`: Never revalidated (future state if we defer validation)

Validation state may transition from "valid" → "invalid\_\*" if schema changes, but the version itself is never modified.

---

## Relationships

### saved_queries → saved_query_versions

- One-to-many: A saved query has many versions (at least one)
- Immutable: Versions cannot be deleted or moved between queries
- Denormalization: saved_queries.current_version_id points to latest for fast lookups

### saved_query_versions → saved_query_versions (parent-child)

- Linked-list: Each version (except V1) points to parent via parent_version_id
- Forms temporal chain for version history UI and diff computation

### saved_queries → saved_queries (variant lineage)

- source_query_id points to parent query if this is a variant
- Enables "show me queries forked from this source" UI

### saved_query_executions → saved_queries + saved_query_versions

- Immutable links to query and exact version executed
- Decouples query versioning from execution recording

### saved_query_events

- Append-only audit trail
- Links to query and optionally version
- Never modified or deleted

---

## Unique Constraints

| Table                  | Constraint                                             | Purpose                                                                                    |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `saved_queries`        | `UNIQUE (workspace_id, owner_user_id, canonical_name)` | No duplicate names per user per workspace; enables direct lookup and prevents UX confusion |
| `saved_query_versions` | `UNIQUE (query_id, version_number)`                    | No two versions of same query share a version number; maintains monotonic numbering        |

---

## Indexes

Designed for common query patterns:

| Table                    | Index                                 | Purpose                                                                                                                                   |
| ------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `saved_queries`          | `idx_saved_queries_workspace_user`    | List all queries for user in workspace: `SELECT * FROM saved_queries WHERE workspace_id = ? AND owner_user_id = ? AND deleted_at IS NULL` |
| `saved_queries`          | `idx_saved_queries_deleted_at`        | Find soft-deleted queries for cleanup: `SELECT * FROM saved_queries WHERE deleted_at IS NOT NULL AND recoverable_until < NOW()`           |
| `saved_query_versions`   | `idx_saved_query_versions_query_id`   | Fetch version history: `SELECT * FROM ... WHERE query_id = ? ORDER BY version_number DESC`                                                |
| `saved_query_executions` | `idx_saved_query_executions_query_id` | Fetch execution history: `SELECT * FROM ... WHERE query_id = ? ORDER BY executed_at DESC`                                                 |
| `saved_query_executions` | `idx_saved_query_executions_status`   | Find failed executions: `SELECT * FROM ... WHERE status = 'error'`                                                                        |

---

## Validation Rules

### saved_queries

- `query_id`: Must be valid UUID v4
- `workspace_id`: Must be non-empty string
- `owner_user_id`: Must be non-empty string
- `canonical_name`: Must be 1..255 characters, non-empty after trim
- `current_version_id`: Must reference existing version in same query
- `source_query_id`: If not NULL, must reference different query (no self-reference)
- `created_at`, `updated_at`, `deleted_at`, `recoverable_until`: Valid timestamps; `created_at <= updated_at`
- Constraint: `(deleted_at IS NULL AND recoverable_until IS NULL) OR (deleted_at IS NOT NULL AND recoverable_until IS NOT NULL)`

### saved_query_versions

- `version_id`: Valid UUID v4
- `query_id`: Must reference existing saved_queries row
- `version_number`: Positive integer >= 1
- `parent_version_id`: If not NULL, must reference version with `version_number = current_version_number - 1` in same query
- `name`: 1..255 characters, non-empty after trim
- `description`: 0..2000 characters (may be NULL or empty)
- `tags_json`: Must be valid JSON array of 0..20 tags, each 1..50 chars, alphanumeric + hyphen/underscore, lowercase
- `builder_snapshot_json`: Must be valid JSON; must contain required fields (baseTable, selectedColumns, filters, aggregations, groupBy, joins)
- `sql_snapshot`: Non-empty SQL text
- `validation_state`: One of { "valid", "invalid_schema_drift", "invalid_relationship_downgrade", "unknown" }

### saved_query_executions

- `execution_id`, `query_id`, `version_id`: Valid UUIDs; must reference existing rows
- `executed_by`: Non-empty user ID
- `executed_at`: Valid timestamp, not in future
- `status`: One of { "success", "timeout", "error", "cancelled" }
- `row_count`: Non-negative integer if status = "success"; NULL otherwise
- `execution_ms`: Non-negative integer if status = "success"; NULL otherwise
- `error_message`: Non-empty if status = "error"; NULL otherwise

### saved_query_events

- `event_id`: Valid UUID v4
- `query_id`, `version_id`: Valid UUIDs or NULL; must reference existing rows
- `actor_user_id`: Non-empty
- `event_type`: One of { "created", "deleted", "restored", "duplicated", "variant_created", "version_created", "metadata_updated" }
- `event_payload_json`: Valid JSON object
- `created_at`: Valid timestamp, not in future

---

## Migration Path

From existing spec 003 database:

1. Create four new tables: `saved_queries`, `saved_query_versions`, `saved_query_executions`, `saved_query_events`
2. No modifications to existing spec 001, 002, 003 tables
3. Create indexes
4. No data seeding required; tables start empty
5. First save in builder creates initial row in `saved_queries` + `saved_query_versions`

---

## Notes

- All tables use SQLite `AUTOINCREMENT` for integer primary keys (none exist here; all use UUID).
- All string fields use UTF-8 encoding (default for SQLite).
- All timestamps use UTC (`TIMESTAMP` type; application converts to UTC before storing).
- Foreign keys enabled in SQLite via `PRAGMA foreign_keys = ON` in connection setup.
- No soft-delete column on versions/executions; they are immutable and never deleted.
- JSON fields use standard JSON format; no special JSON encoding required.
