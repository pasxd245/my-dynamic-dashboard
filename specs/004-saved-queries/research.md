# Research: Saved Queries (MVP 2)

**Spec**: `/specs/004-saved-queries/spec.md`
**Plan**: `/specs/004-saved-queries/plan.md`
**Date**: 2026-05-08

This document resolves Phase 0 research tasks and provides evidence-based decisions for the design phase.

## R-001: Query Snapshot Versioning Strategy

### Question

How should builder snapshots be serialized, versioned, and linked to preserve query history and support variant lineage?

### Decision

- **Builder snapshot serialization**: Capture full builder DSL as JSON: `{ baseTable, selectedColumns, filters, aggregations, groupBy, joins }` with each element referencing column IDs and relationship rule IDs (not names, to preserve traceability across schema drift).
- **Immutability guarantee**: Once a version is created, builder_snapshot_json and sql_snapshot fields are write-once; they are never modified, copied to new rows only on new version creation.
- **Parent-version linking**: Each version links to its parent via parent_version_id to form a linear chain; variant creation (source_query_id) preserves fork lineage separately.
- **Version numbering**: Auto-increment per query; version N always references versions 1..N-1 for that query; version_id is globally unique UUID for cross-query reference.

### Rationale

- **Why JSON over serialized Python objects**: JSON is human-readable, schema-agnostic, and importable by browser (builder can inspect without server round-trip).
- **Why column IDs not names**: Preserves intent when columns are renamed or reclassified; supports revalidation warning if column is deleted.
- **Why immutable**: Audit compliance (Principle VI) and reproducibility (Principle VII). If a user edits a version, a new version is created instead of overwriting.
- **Why parent-version linking**: Supports "compare across versions" UI and preserves temporal causality; variant (fork) remains separate to avoid confusion with linear version history.

### Alternatives Considered

1. **Mutable versions with edit tracking**: Adds complexity (snapshots at each edit timestamp, reconciling overlapping edits). Rejected because immutable snapshots are simpler for auditing and undo/rollback.
2. **Separate version tree per saved query**: Current design already maintains a linear chain per query with variant forks linked via source_query_id; no need for generalized tree.
3. **Compress snapshots into delta format**: Adds deserialization logic and complicates comparison UI. Rejected; storage cost of full JSON is acceptable for MVP 2 scale (1,000s of queries × ~1KB per snapshot).

---

## R-002: Soft-Delete Recovery Mechanics

### Question

How should soft-delete work? What triggers recovery-window expiry? Can analysts extend recovery if needed?

### Decision

- **Recovery window**: Fixed 24-hour period starting from delete timestamp (deleted_at). Window is NOT refreshed by analyst action; once deleted, countdown is immutable.
- **Expiry mechanism**: A background job (or lazy check during query startup) identifies queries where `NOW() > recoverable_until` and moves them to a final-delete state (hard delete or archive).
- **Analyst restore**: Within 24-hour window, analyst can call DELETE /api/saved-queries/{queryId}/restore to flip deleted_at and recoverable_until back to NULL, returning query to active library.
- **Restore after expiry**: System rejects restore with 409 Conflict and message: "Recovery window has expired. This query was deleted on [date]. Deleted queries are recoverable for 24 hours."
- **Grace period implementation**: No need to extend; if analyst needs more time, they should duplicate the query before deleting, or immediately restore and re-delete.

### Rationale

- **Fixed 24h window**: Aligns with common Slack/Gmail recovery windows. Predictable for users. Long enough for "oops" recovery, short enough to avoid indefinite dataset bloat.
- **No refresh on restore**: If users could extend indefinitely, the recovery-window becomes a permanent retention policy, defeating the soft-delete purpose. MVP 2 keeps it simple.
- **Lazy expiry job**: Reduces need for precise scheduled cleanup in MVP 2; can be added later as a maintenance script.
- **Preservation of audit trail**: Soft-deleted queries remain in audit tables (saved_query_events) and execution history (saved_query_executions) for compliance.

### Alternatives Considered

1. **Configurable recovery window per query**: Users could set 7d, 30d, etc. Rejected; MVP 2 wants uniformity for simpler implementation and UX.
2. **Perpetual soft delete (no expiry)**: Queries never hard-deleted. Rejected; would require unbounded retention policy and could confuse users about finality.
3. **Analyst extends recovery with API call**: Allows unlimited postponement. Rejected; defeats purpose of recovery window; if user wants permanent retention, they should duplicate to new saved query.

---

## R-003: Search and Tagging Normalization

### Question

How should tags be normalized? What does keyword search match against?

### Decision

- **Tag normalization**: Trim leading/trailing whitespace, convert to lowercase, deduplicate during save. Store as JSON array in tags_json column: `["monthly-sales", "finance", "executive"]`.
- **Tag consistency**: On save, verify each tag is 1..50 characters alphanumeric + hyphen/underscore only. Reject tags with special characters or excessive length.
- **Keyword search scope**: Search matches substring case-insensitively across three fields: name, description, tags (space-separated from JSON).
- **Search implementation**: SQL LIKE with wildcards: `WHERE name ILIKE '%keyword%' OR description ILIKE '%keyword%' OR tags_json LIKE '%"keyword"%'`.
- **Tag filter**: Exact match on tags after normalization. If analyst selects tag "sales", return queries whose tags_json contains "sales" (case-insensitive).
- **Empty description handling**: If description is NULL or empty, search ignores it (no match contribution).

### Rationale

- **Lowercase + trim**: Ensures "Sales" and "sales" and " SALES " are treated as same tag. Prevents tag explosion.
- **Alphanumeric + hyphen/underscore**: Familiar tag syntax (like GitHub labels); avoids SQL injection concerns despite parameterized queries.
- **Substring match over fuzzy**: MVP 2 scope (spec requirement: "basic keyword matching only"). Fuzzy/stemming deferred to MVP 3.
- **LIKE on tags_json**: Leverages SQLite LIKE without JSON-specific functions; works on all platforms.

### Alternatives Considered

1. **Separate tags table with many-to-many**: More normalized, but adds JOIN complexity for search. Rejected; JSON array is sufficient for MVP 2 scale and simpler query.
2. **Full-text search (SQLite FTS5)**: More sophisticated. Rejected; MVP 2 requirement is "basic keyword" only; FTS is overkill.
3. **Exact keyword match only**: No substring. Rejected; UX would be poor ("saved-q" would not find "saved-query").

---

## R-004: Revalidation Strategy for Schema Drift

### Question

When a saved query is loaded, how should we detect broken references (deleted columns, downgraded relationships) and warn analysts?

### Decision

- **Revalidation trigger**: When analyst clicks "Load in Builder" or calls POST /api/saved-queries/{queryId}/load, server revalidates the snapshot.
- **Column validity check**: For each column_id in the snapshot, query column_profiles table to confirm the column still exists and has compatible type. If column is deleted or type changed incompatibly, add to warnings.
- **Relationship validity check**: For each relationship_id in the snapshot joins, query relationship_rules and check status is still "approved". If downgraded to "suggested" or "rejected" or deleted, add to warnings.
- **Base table validity check**: Confirm base_table_id still has data and schema; if table is deleted or missing, block load with error (not just warning).
- **Warning payload**: Return JSON array of warnings, each with { "type": "column_deleted" | "column_type_drift" | "relationship_downgraded", "fieldId": "...", "message": "..." }.
- **Analyst response**: If warnings exist, show modal to analyst: "This query has 2 issues. [details]. You can still load and fix, or reload a prior version." Analyst proceeds at own risk.
- **Immutable history**: Historical snapshots remain unmodified even if broken; stored version always reflects original state, not repaired state.

### Rationale

- **Column ID not name**: If column was renamed (ID unchanged), snapshot remains valid. If column was deleted (ID missing), warning is raised.
- **Relationship approval check**: Constitution III requires approved relationships; if relationship is downgraded, warn immediately instead of failing during execution.
- **Base table as hard error**: Query cannot execute without base table; no warning is sufficient.
- **Analyst choice after warning**: UX principle: surface the issue, let analyst decide. They may proceed knowing it's broken, or load a prior version.
- **Preserved history**: Never modify a stored snapshot. Analysts trust that reloading a version 6 months later shows the exact original snapshot.

### Alternatives Considered

1. **Auto-repair snapshot**: Silently remove deleted columns, downgrade broken relationships. Rejected; violates Principle VII (reproducibility). Analysts would not know what was repaired.
2. **Reject load if any warning**: Stricter but UX friction. Rejected; analysts may intentionally load broken queries to inspect them (e.g., for audit). Warnings are sufficient.
3. **No revalidation**: Load snapshot as-is. Rejected; would allow execution of queries with deleted relationships, violating Principle III.

---

## R-005: Execution History Scope and Metadata

### Question

What metadata should be recorded per execution? When? By whom?

### Decision

- **Recorded metadata**: execution_id (UUID), query_id, version_id (immutable link), executed_by (user_id), executed_at (timestamp), status (enum: "success", "timeout", "error", "cancelled"), row_count (int, NULL if error), execution_ms (int, NULL if timeout/error).
- **Recording trigger**: Every time analyst clicks "Execute Query" in the builder UI (after loading a saved query) or calls POST /api/execute with saved query context. Recording is automatic, not opt-in.
- **Status enumeration**:
  - "success": query completed and returned results
  - "timeout": query exceeded 5-second execution timeout (spec 003 constraint)
  - "error": query failed with exception (schema issue, SQL syntax, etc.)
  - "cancelled": analyst stopped execution before completion
- **Row count**: Captured only on "success" status; NULL otherwise. Represents final result set row count (not data read, but rows returned to analyst).
- **Execution duration**: Wall-clock time from query start to finish (includes prep, execution, result serialization). In milliseconds.
- **No PII**: executed_by is user_id (opaque), not email or name, for privacy.
- **History immutability**: Once recorded, execution entry is never modified or deleted (even if query is soft-deleted, execution history remains in DB for audit).

### Rationale

- **Why immutable history**: Audit trail must be tamper-proof. Analysts trust execution history for reproducibility claims.
- **Version-specific recording**: Links execution to exact snapshot used, not just query_id. If query has 5 versions and each is executed, history shows which version produced which result.
- **Status enum**: Finite set of outcomes supports filtering (show all timeouts, show all errors) and analytics. Beats free-form text.
- **Execution_ms precision**: Milliseconds are sufficient for MVP 2 analytics and SQL tuning; nanosecond precision is overkill.
- **Row count only on success**: Row count for error/timeout states is undefined or misleading; NULL is clearer than 0 or -1.

### Alternatives Considered

1. **Record query text alongside version_id**: Redundant; query text is already in saved_query_versions.sql_snapshot. Rejected.
2. **Record input parameter values**: Spec 003 does not support parameterized queries (analysts build UI, not write SQL). No parameters to record. N/A.
3. **Record result size in bytes**: More detailed but adds storage overhead. Row count is sufficient for MVP 2. Rejected.
4. **Capture individual column stats**: Overly detailed. Rejected; can be added in MVP 3 if needed.

---

## R-006: API Error Semantics and Validation

### Question

What HTTP status codes should be used? What validation rules apply to save/update requests?

### Decision

#### Save Request Validation (FR-001)

- **HTTP 201 Created** on success; location header points to new query resource.
- **HTTP 400 Bad Request** if:
  - `name` is blank, NULL, or only whitespace: message "Name is required"
  - `name` exceeds 255 characters: message "Name must be ≤ 255 characters"
  - `description` exceeds 2000 characters: message "Description must be ≤ 2000 characters"
  - `tags` array contains invalid tags (non-alphanumeric, too long, too many tags): message "Tags must be alphanumeric with hyphen/underscore, ≤ 50 chars each, max 20 tags"
  - `builderSnapshot` is NULL or structurally invalid: message "Invalid builder snapshot"
  - `sqlSnapshot` is NULL or empty: message "SQL snapshot is required"
- **HTTP 409 Conflict** if:
  - A query with the same name already exists in this workspace by this user: message "A query named '{name}' already exists in this workspace. Please use a different name or duplicate the existing query."
- **HTTP 422 Unprocessable Entity** if:
  - Builder snapshot references non-existent relationship IDs or deleted columns: message "Builder snapshot references unavailable relationships or columns. Please rebuild the query."

#### Load Request (FR-009)

- **HTTP 200 OK** on success; response includes builderSnapshot, sqlSnapshot, warnings array, validationState.
- **HTTP 404 Not Found** if query or version does not exist.
- **HTTP 410 Gone** if query is soft-deleted and outside recovery window.

#### Update / New Version (FR-012)

- **HTTP 201 Created** on success.
- **HTTP 400** on validation failure (same as save).
- **HTTP 404** if query not found.
- **HTTP 409** if name conflict with other active queries (but same name is allowed for new version of same query).

#### Delete / Restore (FR-015, FR-016)

- **DELETE HTTP 200 OK** on soft-delete success; response includes `{ deletedAt, recoverableUntil }`.
- **DELETE HTTP 404** if query not found.
- **POST restore HTTP 200 OK** on success.
- **POST restore HTTP 404** if query not found.
- **POST restore HTTP 409 Conflict** if recovery window expired; message "Recovery window has expired. Query was deleted on [date]. Deleted queries are recoverable for 24 hours."

#### List / Search (FR-005, FR-006)

- **HTTP 200 OK** on success; response includes `{ items: [...], total, nextOffset }`.
- **HTTP 400** if query params are malformed (invalid pagination, invalid state enum).

### Rationale

- **201 vs 200**: HTTP convention: POST that creates resource returns 201; GET/PATCH return 200.
- **400 vs 409 vs 422**: 400 is input validation; 409 is conflict (duplicate name); 422 is structural (snapshot references invalid data).
- **HTTP 410 Gone**: Deleted queries outside recovery are "gone" (404 means never existed, 410 means existed but is gone).
- **Structured error payloads**: All errors include `{ "error": "...", "code": "DUPLICATE_NAME" | "INVALID_SNAPSHOT" | ... }` so UI can localize messages.

### Alternatives Considered

1. **Use only 200 OK with error in response body**: Non-standard; HTTP semantics would be lost.
2. **Return 400 for deleted query outside recovery**: 410 is more specific and allows UI to differentiate "oops" from "expired".
3. **Silently auto-extend recovery on restore**: Rejected; violates immutable recovery window decision.

---

## R-007: Dependency on Spec 003

### Question

What does spec 004 assume from spec 003? What are the integration points?

### Decision

- **Dependency assumption**: Spec 003 (query-builder-execution) is complete and deployed. Spec 004 consumes:
  - Builder DSL: table/column/filter/aggregation/join selection model
  - Approved relationships: spec 003 loads relationships from spec 002 and only allows approved ones in joins
  - SQL generation: spec 003 generates SQL from builder configuration; spec 004 snapshots both builder config and generated SQL
  - Execution engine: spec 003 executor handles DuckDB queries; spec 004 only records execution metadata
  - Lineage metadata: spec 003 provides table/column/relationship traceability; spec 004 preserves it in snapshots
- **Integration points**:
  1. **Save from builder**: Builder toolbar has "Save Query" button that calls POST /api/saved-queries with current builder state
  2. **Load into builder**: Saved-query library has "Load in Builder" button that calls POST /api/saved-queries/{queryId}/load and hydrates builder
  3. **Revalidate on load**: Load endpoint checks current spec 002 relationship status and spec 001 column validity, warns if broken
  4. **Record executions**: After spec 003 execution completes, POST /api/saved-queries/{queryId}/executions records result
- **Schema shared**: Both specs use same SQLite metadata DB; spec 004 adds new tables, does not modify spec 003 tables.

### Rationale

- **Why snapshot both builder + SQL**: Builder config is reproducible/inspectable by analyst; SQL is for auditing and export. Both are immutable snapshots.
- **Why revalidate on load**: Constitution III requires checking relationship approval status before execution. If relationship was downgraded after query was saved, analyst should know.
- **Why record executions separately**: Decouples saved-query versioning from spec 003 execution engine. Execution records are read-only audit trail.

---

## R-008: Data Retention and Cleanup Policy

### Question

How long are saved queries, versions, and execution history retained?

### Decision

- **Active saved queries**: Indefinite retention. Users own their library; no automatic cleanup.
- **Deleted saved queries**: Retained for 24 hours within recovery window, then cleaned up (hard delete or archive). Cleanup can be manual via admin job in MVP 2; automatic in MVP 3.
- **Version history**: Retained indefinitely once created. No automatic pruning; users can manually archive old versions if needed (future feature).
- **Execution history**: Retained indefinite. MVP 2 scope; retention policy deferred to MVP 3 (could implement per-workspace max-history-age or max-rows).
- **Audit events**: Retained indefinite per immutability guarantee. Never deleted, even for deleted queries.
- **Implementation**: No cleanup job in MVP 2; manual or deferred to MVP 3.

### Rationale

- **Indefinite active**: Users expect their library to persist.
- **24h grace + cleanup**: Matches soft-delete recovery window decision.
- **Version history indefinite**: Supports reproducibility audit; users can compare queries over months/years.
- **Execution history indefinite**: Audit trail for compliance. Row count growth manageable at MVP 2 scale.
- **Audit events indefinite**: Constitution VI (traceability) requires immutable audit trail; never pruned.

### Alternatives Considered

1. **Auto-archive after N months**: Adds complexity (separate archive storage). Rejected; MVP 2 scale allows indefinite retention.
2. **User-configurable retention per query**: Adds complexity. Rejected; MVP 2 keeps uniform policy.

---

## Summary

| Research Task        | Decision                                                                                       | Evidence                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Versioning strategy  | Immutable snapshots + parent linking + variant forks                                           | Audit compliance (VI), reproducibility (VII), simpler than delta format                                 |
| Soft-delete recovery | Fixed 24-hour window, no extension, no refresh                                                 | Common UX pattern, prevents indefinite retention, simple implementation                                 |
| Tag normalization    | Lowercase, trim, alphanumeric+hyphen/underscore, deduplicate                                   | Prevents tag explosion, prevents injection, familiar syntax                                             |
| Keyword search       | Substring match on name/description/tags, case-insensitive                                     | MVP 2 scope (basic keyword only), LIKE query simple and performant                                      |
| Revalidation         | Check column existence, relationship approval status, base table present; warn on schema drift | Constitution III (approved relationships only), Constitution VII (reproducibility), immutable snapshots |
| Execution history    | Immutable record per version with status, row count, duration                                  | Audit trail, traceability, decoupled from spec 003 execution engine                                     |
| Error semantics      | 201 Created, 400 validation, 409 conflict, 422 unprocessable, 410 gone                         | HTTP conventions, structured error payloads for localized UI messages                                   |
| Data retention       | Indefinite active queries, 24h deleted queries, indefinite versions/executions/audit           | Audit compliance, user expectations, MVP 2 scope                                                        |
