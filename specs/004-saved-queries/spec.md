# Feature Specification: Saved Queries (MVP 2)

**Feature Branch**: `004-saved-queries`
**Created**: 2026-05-08
**Status**: Draft
**Input**: MVP 1 -> MVP 2 transition requirement from `docs/analysis/09-mvp-plan.md` and user description above.

## Business Question _(mandatory for this project)_

> "Given that an analyst already knows how to build and run a correct query,
> can the workspace preserve that query as a reusable, traceable snapshot so
> recurring weekly and monthly analysis no longer has to be rebuilt from
> scratch each time?"

**Decision consumed**: Whether the product can move from MVP 1 exploratory query
execution into MVP 2 repeatable analysis, where recurring business questions are
captured once, reused safely, and inspected later with full context.

**Primary roles**: data analyst (saves, finds, reuses, versions, restores saved
queries), business owner (reviews library context, provenance, and execution
recency before trusting a recurring analysis).

**Constitution alignment**:

- **Principle I (Business-Question-First)**: Saved queries exist to preserve a
  recurring business question, not just a technical SQL string.
- **Principle III (Relationship Rule Before Cross-Table Query)**: Saved query
  snapshots preserve which approved relationships were referenced at save time,
  and loading must revalidate those relationships before reuse.
- **Principle VI (Traceability For Every Claim)**: Every saved query exposes
  author, timestamps, version lineage, SQL snapshot, and execution history.
- **Principle VII (Reproducibility From Raw Inputs)**: A saved query version is
  an immutable snapshot of builder configuration that can be reloaded,
  inspected, and compared over time.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Save a query from the builder (Priority: P1)

An analyst finishes building a correct query and saves it with a clear name,
description, and tags so the configuration can be reused for the next reporting
cycle without rebuilding it manually.

**Why this priority**: This is the core value of the feature. If analysts cannot
preserve query definitions, MVP 2 does not reduce recurring analysis effort.

**Independent Test**: Build a query in the spec 003 builder, save it with name,
description, and tags, refresh the app, and confirm it appears in the library as
an immutable saved version.

**Acceptance Scenarios**:

1. **Given** a valid query configuration in the builder, **When** the analyst
   chooses "Save Query" and supplies a name, description, and optional tags,
   **Then** the system creates a saved query entry and an initial immutable
   version snapshot.
2. **Given** a query has never been saved before, **When** the first save
   succeeds, **Then** the saved query records the author, creation timestamp,
   current SQL snapshot, and execution count context.
3. **Given** a save attempt with a blank name, **When** the analyst submits the
   form, **Then** the system rejects the save with a clear validation message.
4. **Given** a save attempt where the builder configuration is invalid,
   **When** the analyst submits the save, **Then** the system blocks the save and
   shows the validation issues that must be fixed first.

---

### User Story 2 — Browse and search the query library (Priority: P1)

An analyst opens a library of saved queries and quickly finds the right one by
searching basic keywords across the name, description, and tags.

**Why this priority**: Saving has little value if retrieval is slow or unreliable.
The library is the primary surface that turns saved queries into recurring
workflow assets.

**Independent Test**: Save several queries with different names, descriptions,
and tags, then retrieve the correct one using only keyword search and tag-based
filtering.

**Acceptance Scenarios**:

1. **Given** a workspace with multiple saved queries, **When** the analyst opens
   the library, **Then** each query displays its name, description, tags,
   author, created timestamp, last modified timestamp, latest version number,
   and execution count.
2. **Given** a keyword entered in the library search box, **When** the analyst
   searches, **Then** the library returns saved queries whose name,
   description, or tags contain the keyword.
3. **Given** soft-deleted queries exist, **When** the analyst views the default
   library, **Then** deleted queries are excluded from the active list.
4. **Given** the analyst filters by tag, **When** a matching tag is selected,
   **Then** only queries containing that tag are shown.

---

### User Story 3 — Load, inspect, and reuse a saved query (Priority: P1)

An analyst selects a saved query from the library, reviews its original SQL,
version metadata, and execution history, then loads it back into the builder to
run it again or use it as the starting point for a new analysis.

**Why this priority**: Reuse is the business payoff. Analysts need confidence
that the loaded query still means what it meant when it was saved.

**Independent Test**: Load a saved query into the builder, confirm all builder
selections are restored exactly, inspect the SQL snapshot and execution history,
then execute the loaded query successfully.

**Acceptance Scenarios**:

1. **Given** a saved query in the library, **When** the analyst opens its
   details view, **Then** the system shows the saved configuration summary,
   original SQL snapshot, version list, and execution history.
2. **Given** a saved query whose underlying tables and columns are still valid,
   **When** the analyst clicks "Load in Builder", **Then** the builder is
   populated with the exact saved version snapshot.
3. **Given** a saved query referencing a relationship or column that is no
   longer valid, **When** the analyst attempts to load it, **Then** the system
   warns that the snapshot is historically preserved but requires repair before
   execution.
4. **Given** execution history exists for a saved query, **When** the analyst
   reviews the history, **Then** they can see run timestamp, status, row count,
   and execution duration for each recorded run.

---

### User Story 4 — Create variants through duplicate or new version (Priority: P1)

An analyst can either duplicate an existing saved query as a new library entry or
modify an existing saved query by creating a new version, while preserving prior
versions as immutable history.

**Why this priority**: Weekly and monthly analyses often diverge slightly. The
system must support safe variation without destroying provenance.

**Independent Test**: Duplicate a saved query into a new entry, then edit the
original query and confirm a new version is created while older versions remain
inspectable and reloadable.

**Acceptance Scenarios**:

1. **Given** an existing saved query, **When** the analyst selects
   "Duplicate", **Then** the system creates a new saved query entry initialized
   from the selected version snapshot.
2. **Given** an existing saved query, **When** the analyst edits its name,
   description, tags, or builder configuration and saves changes, **Then** the
   system creates a new version rather than overwriting the prior version.
3. **Given** multiple versions exist for a saved query, **When** the analyst
   opens version history, **Then** each version shows its number, creation
   timestamp, author, and change summary.
4. **Given** the analyst wants a materially different analysis,
   **When** they choose "Save as New Variant", **Then** a new saved query entry
   is created with a link back to the source query it was forked from.

---

### User Story 5 — Soft delete and restore within grace period (Priority: P2)

An analyst can remove a saved query from the active library without losing it
immediately, and can restore it within a 24-hour grace window if the deletion
was accidental.

**Why this priority**: Query libraries accumulate operational assets. Deletion
must be reversible long enough to prevent accidental loss without requiring full
retention forever.

**Independent Test**: Soft-delete a saved query, verify it disappears from the
active library, restore it within 24 hours, and verify it returns with version
history intact.

**Acceptance Scenarios**:

1. **Given** an active saved query, **When** the analyst confirms deletion,
   **Then** the query is marked deleted, removed from the active library, and
   assigned a recoverable-until timestamp 24 hours in the future.
2. **Given** a query is within its recovery window, **When** the analyst chooses
   "Undo Delete" or restore, **Then** the query returns to the active library
   with all versions and history preserved.
3. **Given** the 24-hour grace window has passed, **When** the analyst attempts
   restore, **Then** the system refuses restoration and explains that recovery
   has expired.
4. **Given** a deleted query is referenced in a recent execution history view,
   **When** the analyst inspects that history, **Then** the historical record
   remains visible even though the query is deleted from the active library.

### Edge Cases

- Saving a query with the same name as an existing active query in the same
  workspace should not overwrite the prior query; the system must either block
  the duplicate name or require explicit disambiguation.
- Tags with inconsistent casing or surrounding whitespace should be normalized so
  search results stay predictable.
- A saved query may reference tables, columns, or approved relationships that
  changed after the query was saved; the historical version remains viewable, but
  execution must be revalidated before reuse.
- An analyst may attempt to delete a query and immediately create a new query with
  the same name; active-library uniqueness must still behave predictably during
  the recovery window.
- A query with zero recorded executions is still valid library content and must
  not be ranked or displayed as broken solely because it has never run.
- Search is basic keyword matching only; stemming, fuzzy matching, synonyms, and
  relevance ranking beyond simple matching are out of scope.
- Restoring a query after a newer variant has been created must not corrupt the
  version lineage of either entry.
- A saved query created from a builder draft that was loaded from an older version
  must still record which source version it came from.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST allow an analyst to save any valid spec 003 query
  configuration as a named saved query with optional description and tags.
- **FR-002**: System MUST store the full builder snapshot for each saved query
  version, including base table, selected columns, filters, aggregations,
  group-by fields, and referenced relationships.
- **FR-003**: System MUST store an immutable SQL snapshot alongside each saved
  query version for inspection and traceability.
- **FR-004**: System MUST scope saved queries to a single user workspace; no
  cross-user or cross-workspace sharing is permitted in MVP 2.
- **FR-005**: System MUST provide a saved-query library listing active queries
  with name, description, tags, author, creation timestamp, last modification
  timestamp, latest version number, and execution count.
- **FR-006**: System MUST support basic keyword search across name,
  description, and tags.
- **FR-007**: System MUST support filtering the active library by tags and by
  active versus deleted state.
- **FR-008**: System MUST allow analysts to open a saved query detail view that
  shows latest version metadata, full version history, original SQL snapshot,
  and execution history.
- **FR-009**: System MUST allow analysts to load a saved query version into the
  spec 003 builder and restore the exact configuration captured in that version.
- **FR-010**: System MUST revalidate a saved query version against current table,
  column, and relationship availability before execution or save-as-update.
- **FR-011**: System MUST allow an analyst to duplicate a saved query into a new
  saved query entry without modifying the source query.
- **FR-012**: System MUST treat edits to a saved query as creation of a new
  immutable version; prior versions MUST remain readable and reloadable.
- **FR-013**: System MUST support "Save as New Variant" to fork an existing
  saved query into a separate library entry with lineage back to its source.
- **FR-014**: System MUST allow updates to descriptive metadata (name,
  description, tags) only by creating a new latest version or clearly recording
  metadata-only revision history; no silent overwrite is permitted.
- **FR-015**: System MUST soft-delete saved queries rather than hard-delete them
  immediately.
- **FR-016**: System MUST assign a 24-hour recovery window to deleted queries and
  allow restoration within that window.
- **FR-017**: System MUST prevent deleted queries from appearing in the active
  library by default while preserving their auditability and recoverability.
- **FR-018**: System MUST preserve author identity, creation/modification
  timestamps, latest execution timestamp, and execution count for each saved
  query.
- **FR-019**: System MUST record execution history per saved query version,
  including run status, row count, execution duration, and timestamp.
- **FR-020**: System MUST expose user-friendly validation messages for save,
  load, versioning, and restore failures; raw stack traces MUST NOT be shown.
- **FR-021**: System MUST preserve historical versions and execution history even
  after soft delete, until the recovery window expires and retention policy is
  applied.
- **FR-022**: System MUST provide sufficient traceability to identify which spec
  003 builder snapshot and which approved relationship context were used for
  each saved version.

### Acceptance Criteria

#### AC-001: Save Query

- [ ] Analyst can save a valid builder configuration with name, description, and tags.
- [ ] First save creates both a saved-query library entry and version `1`.
- [ ] Invalid builder states cannot be saved.
- [ ] Blank or whitespace-only names are rejected with clear feedback.

#### AC-002: Query Library

- [ ] Library lists active saved queries with name, description, tags, author,
      created timestamp, modified timestamp, latest version, and execution count.
- [ ] Default library excludes soft-deleted queries.
- [ ] Library can switch between active and deleted views.
- [ ] Empty library state explains how to create the first saved query.

#### AC-003: Search And Filter

- [ ] Keyword search matches against name, description, and tags.
- [ ] Tag filter narrows results correctly.
- [ ] Search results update consistently when query metadata changes.
- [ ] Search uses basic keyword matching only; no fuzzy or semantic behavior is implied.

#### AC-004: Load And Inspect

- [ ] Analyst can open a saved query details view.
- [ ] Details view shows builder summary, SQL snapshot, version history, and execution history.
- [ ] Loading a valid version restores the exact builder snapshot into spec 003.
- [ ] Invalid current dependencies are surfaced as warnings before execution.

#### AC-005: Duplicate And Variant

- [ ] Duplicate creates a new saved-query entry from an existing version snapshot.
- [ ] Save-as-new-variant creates a new entry linked to the source query.
- [ ] Duplicate and variant creation do not alter source query history.
- [ ] New entries are editable independently after creation.

#### AC-006: Versioning

- [ ] Editing an existing saved query produces a new immutable version.
- [ ] Older versions remain viewable and loadable.
- [ ] Version history shows number, author, timestamp, and change summary.
- [ ] Latest version is clearly marked in the library and details view.

#### AC-007: Delete And Restore

- [ ] Delete is soft-delete only.
- [ ] Deleted queries are recoverable for 24 hours.
- [ ] Restore returns the query to the active library with versions intact.
- [ ] Restore is blocked after the grace window expires.

#### AC-008: Execution Context

- [ ] Query details show latest execution timestamp and cumulative execution count.
- [ ] Execution history shows status, row count, duration, and timestamp for each run.
- [ ] History remains visible for soft-deleted queries during the recovery window.
- [ ] Execution history stays associated with the exact saved version used.

#### AC-009: Traceability And Governance

- [ ] Every saved version records author and timestamps.
- [ ] Every saved version preserves SQL and builder snapshot.
- [ ] Relationship context used by the snapshot is inspectable.
- [ ] Saved queries support reproducibility review without requiring the analyst to rebuild from memory.

#### AC-010: Error Handling

- [ ] Duplicate-name conflicts produce clear, actionable feedback.
- [ ] Load failures caused by schema drift identify the broken dependency.
- [ ] Restore failures explain whether the query is missing, expired, or not recoverable.
- [ ] Validation and API failures are shown as user-facing messages, not stack traces.

### Data Model Changes

Saved queries extend the metadata store introduced in MVP 1 / spec 003. The data
model separates stable library identity from immutable version snapshots and
recorded executions.

#### Table: `saved_queries`

```sql
CREATE TABLE saved_queries (
  query_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  current_version_id TEXT NOT NULL,
  source_query_id TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  deleted_at TIMESTAMP,
  recoverable_until TIMESTAMP,
  UNIQUE (workspace_id, owner_user_id, canonical_name)
);
```

#### Table: `saved_query_versions`

```sql
CREATE TABLE saved_query_versions (
  version_id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  parent_version_id TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tags_json TEXT NOT NULL,
  change_summary TEXT,
  builder_snapshot_json TEXT NOT NULL,
  sql_snapshot TEXT NOT NULL,
  validation_state TEXT NOT NULL,
  FOREIGN KEY (query_id) REFERENCES saved_queries(query_id),
  FOREIGN KEY (parent_version_id) REFERENCES saved_query_versions(version_id),
  UNIQUE (query_id, version_number)
);
```

#### Table: `saved_query_executions`

```sql
CREATE TABLE saved_query_executions (
  execution_id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  executed_by TEXT NOT NULL,
  executed_at TIMESTAMP NOT NULL,
  status TEXT NOT NULL,
  row_count INTEGER,
  execution_ms INTEGER,
  FOREIGN KEY (query_id) REFERENCES saved_queries(query_id),
  FOREIGN KEY (version_id) REFERENCES saved_query_versions(version_id)
);
```

#### Table: `saved_query_events`

```sql
CREATE TABLE saved_query_events (
  event_id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL,
  version_id TEXT,
  actor_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_payload_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (query_id) REFERENCES saved_queries(query_id),
  FOREIGN KEY (version_id) REFERENCES saved_query_versions(version_id)
);
```

**Schema intent**:

- `saved_queries` represents the library entry and current lifecycle state.
- `saved_query_versions` preserves immutable snapshots for each save/edit.
- `saved_query_executions` preserves run history by exact version.
- `saved_query_events` captures delete, restore, duplicate, and variant lineage for
  auditability.

### API Endpoints

All endpoints extend the spec 003 query-builder surface and operate within the
current user workspace.

#### Create / Save

- **POST /api/saved-queries**
  - Input: `{ name, description, tags, builderSnapshot, sqlSnapshot }`
  - Output: `{ queryId, versionId, versionNumber, createdAt }`
  - Creates a new saved-query entry with initial version.

#### Read / Detail

- **GET /api/saved-queries/{queryId}**
  - Output: `{ query, latestVersion, versions, executionSummary, deletionState }`
  - Returns library metadata, latest version, version history summary, and delete state.

- **GET /api/saved-queries/{queryId}/versions/{versionId}**
  - Output: `{ version, sqlSnapshot, builderSnapshot, validationState }`
  - Returns a specific immutable version snapshot.

#### Update / New Version

- **POST /api/saved-queries/{queryId}/versions**
  - Input: `{ name, description, tags, builderSnapshot, sqlSnapshot, changeSummary }`
  - Output: `{ queryId, versionId, versionNumber, createdAt }`
  - Creates a new version for an existing saved query.

#### Duplicate / Variant

- **POST /api/saved-queries/{queryId}/duplicate**
  - Input: `{ sourceVersionId, name, description, tags }`
  - Output: `{ queryId, versionId, versionNumber }`
  - Creates a new saved-query entry from an existing snapshot.

- **POST /api/saved-queries/{queryId}/variants**
  - Input: `{ sourceVersionId, name, description, tags }`
  - Output: `{ queryId, versionId, sourceQueryId }`
  - Creates a new variant entry while preserving lineage to the source query.

#### List / Search

- **GET /api/saved-queries**
  - Query params: `state=active|deleted`, `tag=...`, `limit=...`, `offset=...`
  - Output: `{ items: [...], total }`
  - Lists saved queries in the active or deleted library.

- **GET /api/saved-queries/search**
  - Query params: `q=keyword`, `state=active|deleted`, `tag=...`
  - Output: `{ items: [...], total }`
  - Performs basic keyword search across name, description, and tags.

#### Load / Revalidate

- **POST /api/saved-queries/{queryId}/load**
  - Input: `{ versionId }`
  - Output: `{ builderSnapshot, sqlSnapshot, validationState, warnings }`
  - Returns a saved version snapshot for spec 003 builder hydration and current revalidation.

#### Delete / Restore

- **DELETE /api/saved-queries/{queryId}**
  - Output: `{ deletedAt, recoverableUntil }`
  - Soft-deletes the saved query and removes it from the active library.

- **POST /api/saved-queries/{queryId}/restore**
  - Output: `{ restored: true, restoredAt }`
  - Restores a saved query within the 24-hour grace window.

#### Execution History

- **GET /api/saved-queries/{queryId}/executions**
  - Output: `{ items: [{ executionId, versionId, status, rowCount, executionMs, executedAt }] }`
  - Returns historical runs for the saved query, newest first.

### UI Component Structure

The UI extends the spec 003 builder with a saved-query library surface and
version-aware detail flows.

#### Library View

- **SavedQueryLibraryPage**: top-level page for active and deleted query views.
- **SavedQuerySearchBar**: keyword search and tag filter controls.
- **SavedQueryList**: paginated library results with key metadata columns.
- **SavedQueryListItem**: row/card showing name, description, tags, author,
  version, timestamps, and execution count.

#### Detail And Inspection

- **SavedQueryDetailPanel**: metadata summary, version summary, delete state,
  and main actions.
- **SavedQueryVersionTimeline**: immutable version list with timestamps,
  authors, and change summaries.
- **SavedQuerySqlInspector**: read-only SQL snapshot for selected version.
- **SavedQueryExecutionHistoryTable**: run history with status, row count,
  duration, and timestamp.

#### Builder Integration

- **SaveQueryDialog**: first save and save-as-new-variant modal.
- **UpdateSavedQueryDialog**: creates a new version from current builder state.
- **LoadSavedQueryFlow**: loads selected version into spec 003 builder with
  revalidation warnings.
- **DeleteRestoreControls**: delete confirmation, undo affordance, and deleted-state messaging.

### UI Flows

#### Load Flow

1. Analyst opens library.
2. Analyst selects a saved query.
3. System shows details, SQL, versions, and execution history.
4. Analyst chooses a version and clicks "Load in Builder".
5. System revalidates against current spec 003 dependencies.
6. Builder opens with restored snapshot and any warnings surfaced.

#### Edit Flow

1. Analyst loads a saved query into the builder.
2. Analyst changes query logic or metadata.
3. Analyst chooses either "Update Saved Query" or "Save as New Variant".
4. System creates a new immutable version or a new saved-query entry.
5. Library and detail views reflect the new latest version without removing prior history.

#### Delete Flow

1. Analyst confirms delete from library or detail view.
2. System marks query deleted and hides it from active library.
3. UI shows recovery window and restore affordance.
4. Restore succeeds only within 24 hours.

### Error Scenarios

- **Name conflict**: Creating or restoring a query that would collide with an
  active query name must fail with a clear instruction to rename or resolve the conflict.
- **Schema drift**: Loading a saved query whose tables, columns, or relationships no
  longer validate must show the broken dependency and block execution until repaired.
- **Expired restore**: Restore after the 24-hour window must fail with an explicit
  expired-recovery message.
- **Deleted-source variant**: Creating a variant from a deleted source query must be
  blocked unless the selected source version is still recoverable and readable.
- **Version race**: If the current latest version changes while the analyst is saving,
  the system must refuse silent overwrite and require a retry from the latest state.
- **Empty search result**: Search returning zero matches must show a clear empty state,
  not a generic error.

## Dependencies

- **Hard dependency on spec 003 (Query Builder & Execution)**: Saved queries store and
  reload spec 003 builder snapshots; this feature cannot deliver value before spec 003 exists.
- **Indirect dependency on spec 002 (Relationship Rules)**: Saved snapshots can include
  governed joins, so load and execution revalidation must respect current approved relationships.
- **Indirect dependency on spec 001 (Upload + Profile + Field Roles)**: Saved queries rely
  on stable uploaded table and column metadata as the underlying queryable surface.

## Constraints

- Saved queries are user-scoped and workspace-scoped only.
- Configurations are immutable snapshots; edits create new versions.
- Delete is soft-delete only with 24-hour recovery.
- Search is basic keyword matching only; full-text search is out of scope.
- Cross-user sharing, permissions, and public query libraries are out of scope.
- Scheduled execution, dashboards, and charting are not part of this feature; they consume saved queries later.

## Out of Scope (MVP 2 slice)

- Cross-user sharing or collaborative editing.
- Query approval workflow beyond single-user provenance.
- Parameterized saved queries or runtime prompt inputs.
- Automatic refresh scheduling, subscriptions, or email delivery.
- Full-text or semantic search.
- Query-level access control beyond workspace ownership.

## Key Entities

- **Saved Query**: A library entry representing a recurring business question for one user in one workspace.
- **Saved Query Version**: An immutable snapshot of builder configuration, SQL, metadata, and validation state.
- **Saved Query Execution**: A historical record of running a specific saved query version.
- **Saved Query Event**: An audit record for duplicate, variant, delete, restore, and version lifecycle actions.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An analyst can save a valid recurring query from the builder in under 60 seconds after finishing query construction.
- **SC-002**: An analyst can find and load a previously saved weekly or monthly query from the library in under 2 minutes without rebuilding it manually.
- **SC-003**: For recurring analyses covered by saved queries, analyst prep time drops from roughly 30 minutes to 5 minutes or less.
- **SC-004**: 100% of saved query versions expose author, timestamps, SQL snapshot, and execution-history context.
- **SC-005**: 100% of edits to saved queries preserve prior versions instead of overwriting them.
- **SC-006**: Accidental deletion of an active saved query can be reversed within the 24-hour grace period without loss of history.

## Assumptions

- Workspace identity and current user identity are already available from the MVP 1 metadata context.
- Spec 003 already provides a canonical builder snapshot structure that can be stored and replayed.
- A single user is the only actor mutating saved queries in a workspace during MVP 2.
- Execution history for saved queries is derived from query executions already tracked by the query engine or extended alongside this feature.
- Basic keyword search over saved-query metadata is sufficient for the first production-ready release.

## Traceability Surfaces _(mandatory for this project)_

- Saved query library — displays author, timestamps, latest version, and execution count for each active entry.
- Saved query detail panel — displays version lineage, SQL snapshot, execution history, and deletion state.
- Load-in-builder flow — shows current validation warnings when historical snapshots no longer match current schema or relationship state.
- Restore and delete events — preserve auditable lifecycle context during the 24-hour recovery window.
