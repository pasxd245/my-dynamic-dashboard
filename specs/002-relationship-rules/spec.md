# Feature Specification: Relationship Rules

**Feature Branch**: `002-relationship-rules`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "Define governed relationship rules between uploaded tables with validation, lifecycle review, and audit traceability"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Define Relationship Rules (Priority: P1)

An analyst defines a relationship between two uploaded sheets by selecting a source column and target column, selecting relationship type and join type, and receiving immediate validation for overlap and cardinality.

**Why this priority**: Cross-table analysis cannot proceed without explicit, validated relationships.

**Independent Test**: Can be fully tested by creating a workspace with two uploaded sheets, selecting columns, creating a relationship, and verifying computed overlap/cardinality plus initial `suggested` status.

**Acceptance Scenarios**:

1. **Given** a workspace with two profiled sheets and selectable columns, **When** the analyst creates a relationship rule, **Then** the system stores the rule with selected join settings, computed overlap percentage, computed cardinality, and status `suggested`.
2. **Given** a newly created relationship rule, **When** overlap is below 80%, **Then** the system presents a warning that must be acknowledged before the rule can be saved for review.
3. **Given** a relationship candidate where either selected column no longer exists, **When** creation is attempted, **Then** the system blocks creation and returns a clear validation error.

---

### User Story 2 - Review And Approve Relationship Rules (Priority: P1)

An analyst reviews a suggested relationship and marks it as approved or rejected, with governance controls for low-confidence relationships.

**Why this priority**: Approved relationships are a quality gate for metric and query trust; review controls prevent unsafe joins from entering decision outputs.

**Independent Test**: Can be fully tested by taking a `suggested` relationship through `reviewed` to `approved` or `rejected`, verifying required reasons, and confirming only approved relationships are usable downstream.

**Acceptance Scenarios**:

1. **Given** a `suggested` relationship with overlap at or above 5%, **When** an analyst reviews and approves it, **Then** the status changes through the defined lifecycle and an audit record is created with actor, reason, and timestamp.
2. **Given** a `suggested` relationship with overlap below 5%, **When** an analyst attempts approval without an override reason, **Then** approval is blocked.
3. **Given** a `suggested` relationship with overlap below 5%, **When** an analyst provides an explicit override reason and approves it, **Then** approval succeeds and the override reason is stored and audited.
4. **Given** any relationship not in `approved` status, **When** metric or query contexts request eligible relationships, **Then** the relationship is excluded.

---

### User Story 3 - Monitor Workspace Relationships (Priority: P2)

An analyst views all relationships in a workspace with lifecycle status, overlap, cardinality, and broken-state flags to understand readiness.

**Why this priority**: Visibility into relationship health and governance status reduces analysis risk and speeds troubleshooting.

**Independent Test**: Can be fully tested by listing workspace relationships after create/review operations and validating returned status, stats, and broken indicators under schema changes.

**Acceptance Scenarios**:

1. **Given** a workspace with multiple relationship rules, **When** the analyst opens the relationship list, **Then** each rule shows status, overlap percentage, cardinality, join type, relationship type, and last update metadata.
2. **Given** a stored relationship where a referenced column was removed or changed incompatibly, **When** schema metadata refreshes, **Then** the relationship is marked broken and surfaced in listings.
3. **Given** broken relationships exist, **When** the analyst filters to decision-ready relationships, **Then** broken or non-approved relationships are excluded.

---

### User Story 4 - Edit Or Delete Relationship Rules (Priority: P2)

An analyst updates or removes an existing relationship rule while preserving governance controls and traceability.

**Why this priority**: Relationship rules evolve as source data changes; safe edit/delete flows are required to keep configuration current without bypassing review.

**Independent Test**: Can be fully tested by editing one approved relationship and verifying reset to `suggested`, then deleting another and confirming it is removed from active listings while audit history remains available.

**Acceptance Scenarios**:

1. **Given** an existing relationship in any status, **When** the analyst edits join columns, relationship type, or join type, **Then** the system recalculates overlap/cardinality and resets status to `suggested` for re-review.
2. **Given** an existing relationship, **When** the analyst deletes it, **Then** the relationship is no longer available for query/metric use.
3. **Given** an edited or deleted relationship, **When** history is inspected, **Then** audit events capture what changed, who acted, why, and when.

### Edge Cases

- Selected columns have different data types but can still be compared after supported normalization; unsupported comparisons must fail with a clear reason.
- One or both columns are mostly null, causing overlap or cardinality signals to be weak; the system must still compute and display confidence signals.
- Duplicate-heavy columns can produce misleading many-to-many patterns; cardinality output must reflect this and not infer one-to-one.
- Relationship approval is attempted after schema drift occurs between review steps; approval must fail or require re-validation on current metadata.
- Rapid repeated edits occur on the same rule; latest saved definition is authoritative and each edit remains auditable.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST allow analysts to create a relationship rule between two columns within the same workspace by selecting source column, target column, join type, and relationship type.
- **FR-002**: The system MUST support relationship types `exact_key`, `normalized_key`, and `date_window` as explicit rule metadata.
- **FR-003**: The system MUST support lifecycle statuses `suggested`, `reviewed`, `approved`, and `rejected` for each relationship rule.
- **FR-004**: Newly created relationship rules MUST start in `suggested` status.
- **FR-005**: The system MUST compute and store overlap percentage as the share of distinct comparable values in the source column found in the target column, using profile-derived values when sufficient and direct data scan when profile-derived values are insufficient.
- **FR-006**: The system MUST compute and store relationship cardinality (`1:1`, `1:N`, `N:1`, `N:N`) based on uniqueness ratios of both participating columns.
- **FR-007**: The system MUST require explicit acknowledgement when overlap is below 80% before a relationship can proceed in the review workflow.
- **FR-008**: The system MUST block approval when overlap is below 5% unless an override reason is provided.
- **FR-009**: The system MUST store override reason text on approvals that bypass the 5% overlap threshold and include that reason in audit history.
- **FR-010**: Only relationships in `approved` status MUST be eligible for query and metric evaluation contexts.
- **FR-011**: The system MUST allow analysts to mark a relationship as `reviewed`, then `approved` or `rejected`, and MUST record actor identity, reason, and timestamp for each review action.
- **FR-012**: The system MUST provide a workspace relationship listing that includes status, overlap percentage, cardinality, relationship type, join type, broken flag, actor, and updated timestamp.
- **FR-013**: The system MUST automatically mark a relationship as broken when either referenced column no longer exists or when schema changes invalidate compatibility with the stored relationship definition.
- **FR-014**: When a relationship is edited, the system MUST recompute overlap/cardinality and reset status to `suggested` before it can be approved again.
- **FR-015**: The system MUST allow deletion of a relationship rule from active use while retaining traceability records for prior governance actions.
- **FR-016**: Every status transition and governance decision (including approve, reject, edit reset, delete) MUST produce an immutable audit event with action, prior status, new status, reason, actor, and timestamp.

### Key Entities _(include if feature involves data)_

- **relationship_rule**: Represents a governed join definition between two columns in a workspace. Key attributes: id, workspace_id, from_column_id, to_column_id, join_type, rel_type, status, overlap_pct, cardinality, override_reason, actor, created_at, updated_at.
- **relationship_audit**: Represents immutable governance history for relationship lifecycle and decisions. Key attributes: id, relationship_id, action, old_status, new_status, reason, actor, timestamp.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Analyst can define, review, and approve a relationship for a 2-table workspace in under 3 minutes.
- **SC-002**: Overlap computation completes in under 5 seconds for tables up to 100k rows.
- **SC-003**: Broken relationships are detected automatically when source schema changes.
- **SC-004**: 100% of approved relationships have a traceable audit trail.

## Assumptions

- MVP scope is single-user workspace governance; concurrent multi-analyst conflict handling is out of scope.
- Relationship suggestions generated by AI or heuristics are out of scope; relationships are explicitly user-defined in this feature.
- Fuzzy-match validation and advanced date-window tolerance tuning are deferred to a later phase; this phase captures and governs the rule type metadata.
- Existing upload, profile, and role metadata from feature 001 is available and trusted as input for relationship validation.
- Only workspace-local relationships are in scope; cross-workspace joins are out of scope.
- Approved relationships are prerequisites for downstream metric/query eligibility per constitution quality gates.
