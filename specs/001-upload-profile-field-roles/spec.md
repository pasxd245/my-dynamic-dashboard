# Feature Specification: Upload + Profile + Field Roles (MVP 1)

**Feature Branch**: `001-upload-profile-field-roles`
**Created**: 2026-05-08
**Status**: Draft
**Input**: Pilot scope from `tmp/sdd-setup-plan-speckit-vs-cc-sdd.md` §7 and `tmp/my-dynamic-dashboard-lesson-learn.md` "MVP 1".

## Business Question *(mandatory for this project)*

> "Given the Excel files we just uploaded, what fields can we trust as
> identity, time anchor, measure, dimension, status, and source-of-truth
> outcome — and is the data quality good enough to even attempt a
> business-question analysis on them?"

**Decision consumed**: Whether the workspace is ready to progress to
relationship-rule definition (MVP 2) and metric-contract authoring (MVP 3),
or whether the uploaded data must be cleaned / re-supplied first.

**Primary roles**: data analyst (configures field roles), business owner
(reviews quality summary before committing to analysis).

**Constitution alignment**: Principles I (Business-Question-First),
VI (Traceability), VII (Reproducibility). Establishes the foundation
for II (Metric Contracts) and III (Relationship Rules).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Upload one or more Excel/CSV files and see them parsed (Priority: P1)

An analyst drops a set of business spreadsheets (one or many) into the
workspace and immediately sees: which sheets were detected, which data
range was used per sheet, and the inferred type for every column. They
can confirm, override the data range, or drop a sheet from the workspace.

**Why this priority**: Nothing else works without a parsed, addressable
view of the raw data. This is the foundation of the workspace model.

**Independent Test**: Upload the bundled sample Excel files, observe
that every sheet appears with a chosen data range and column type list,
and that overriding a data range re-parses the sheet without affecting
other sheets.

**Acceptance Scenarios**:

1. **Given** a multi-sheet Excel file, **When** the user uploads it,
   **Then** each sheet appears with a detected header row, data range,
   and per-column inferred type (date / numeric / string / boolean /
   categorical-candidate).
2. **Given** a sheet whose detected header row is wrong, **When** the
   user overrides the header row, **Then** the column list, types, and
   downstream profile are recomputed for that sheet only.
3. **Given** a CSV upload, **When** the system cannot infer encoding
   or delimiter unambiguously, **Then** the user is asked to confirm
   before the file is committed to the workspace.

---

### User Story 2 — See a data-quality profile per column (Priority: P1)

For every committed column the user sees: null %, distinct count,
duplicate signature, min/max for numeric and date columns, top-K
values for categorical-candidates, and explicit quality warnings
(e.g. mixed types, suspicious dates, leading/trailing whitespace,
candidate-key uniqueness).

**Why this priority**: Field-role assignment is unsafe without quality
context — declaring a column "ID" when it has 12% duplicates would
silently break every downstream metric.

**Independent Test**: Upload a file containing a column with known
duplicates and a column with mixed numeric/string values; confirm the
profile reports both issues and that they are visible from the
field-role assignment screen.

**Acceptance Scenarios**:

1. **Given** a column with mixed types, **When** the profile renders,
   **Then** a "mixed type" warning is shown with sample offending values.
2. **Given** a numeric column whose values include a sentinel like
   "N/A", **When** the profile renders, **Then** the sentinel is shown
   as a top non-numeric value, and the column is flagged for review
   before being usable as a measure.
3. **Given** a date column with values outside a plausible window,
   **When** the profile renders, **Then** out-of-range dates are
   surfaced as a quality warning and the column is flagged for review
   before being usable as a time anchor.

---

### User Story 3 — Assign business field roles to columns (Priority: P1)

For each column the user assigns one or more business roles drawn from
a controlled vocabulary: identity key, time anchor, measure, dimension,
status, source-of-truth outcome, plus a confidence / quality note.
The system enforces compatibility: a column cannot be assigned the
"measure" role if its profile reports it is not numeric (or rejects
the assignment with an explicit override + reason).

**Why this priority**: Field roles are the bridge from raw schema to
business meaning. They are the precondition for relationship rules
(MVP 2) and metric contracts (MVP 3). Without them, the system is just
a spreadsheet viewer.

**Independent Test**: Assign roles to every column in the sample
workspace and confirm that (a) incompatible assignments are blocked or
require an explicit override, (b) the assignments persist across
reload, and (c) the workspace exposes a summary of "fields ready to
use as X" for each role.

**Acceptance Scenarios**:

1. **Given** a numeric column with <1% nulls, **When** the user
   assigns the "measure" role, **Then** the assignment is accepted
   and the column appears in the "available measures" summary.
2. **Given** a string column with 12% duplicate values, **When** the
   user assigns the "identity key" role, **Then** the assignment is
   refused unless the user supplies an explicit override reason that
   is recorded with the assignment.
3. **Given** the user assigns "time anchor" to a column whose profile
   reports it is not a date, **When** they confirm, **Then** the
   assignment is refused (no override path — time-anchor type is a
   hard constraint).
4. **Given** a workspace where every required role (at least one
   identity key, one time anchor, one measure, one source-of-truth
   outcome) has been assigned, **When** the user views the workspace
   summary, **Then** an "MVP 1 complete" indicator is shown, and the
   workspace is marked ready for MVP 2.

---

### User Story 4 — Reproducible workspace manifest (Priority: P2)

Every upload, override, profile run, and role assignment is recorded
into a workspace manifest with file hashes, schema version, and rule
version. The user can export the manifest and re-import it on a fresh
copy of the same files to reproduce the workspace state exactly.

**Why this priority**: Required by Constitution VII (Reproducibility).
Lower priority than P1 only because the first three stories deliver
visible analyst value while this story enables governance — but it
must ship in MVP 1, not deferred.

**Independent Test**: Build a workspace, export the manifest, wipe the
workspace, re-import the manifest with the same source files, confirm
identical schema + roles + profile outputs.

**Acceptance Scenarios**:

1. **Given** a built workspace, **When** the user exports the manifest,
   **Then** the manifest file lists each source file with a content
   hash, each sheet's data range, each column's inferred type and
   assigned roles, and the profile summary.
2. **Given** an exported manifest and the original source files,
   **When** the user re-imports the manifest, **Then** the
   reconstructed workspace is byte-identical in schema, profile,
   and role assignments to the original.
3. **Given** an exported manifest and a *modified* source file,
   **When** the user re-imports, **Then** the system blocks
   reproduction and reports which file's hash changed.

### Edge Cases

- Excel files with multiple non-contiguous data ranges per sheet —
  MVP 1 handles only one data range per sheet; additional ranges are
  surfaced as a warning, not parsed.
- Files >100 MB or >1 M rows — MVP 1 streams the parse; profiling for
  oversized files is sampled with the sample size recorded in the
  manifest.
- Encrypted / password-protected Excel files — rejected at upload with
  a clear error.
- Columns where 100% of values are null after the detected data range
  — listed but excluded from role-eligible summaries.
- Unicode / mixed-encoding CSVs — encoding detection is best-effort;
  ambiguous cases require user confirmation (see Story 1.3).
- Workspace with zero columns assigned to a required role — the
  "MVP 1 complete" indicator stays off; the system surfaces which
  required roles are missing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept uploads of one or more `.xlsx` and
  `.csv` files into a single workspace.
- **FR-002**: System MUST detect, per Excel sheet, the header row and
  the contiguous data range, and allow the user to override both.
- **FR-003**: System MUST infer a column type from the controlled
  set { date, numeric, integer, string, boolean, categorical-candidate }
  and allow per-column type override with the override recorded.
- **FR-004**: System MUST compute and display, per column, a quality
  profile including null %, distinct count, duplicate signature, value
  range for numeric/date types, top-K values for categorical-candidates,
  and a list of detected quality warnings.
- **FR-005**: System MUST allow assigning one or more business roles to
  each column from the controlled vocabulary { identity key, time anchor,
  measure, dimension, status, source-of-truth outcome }.
- **FR-006**: System MUST enforce role compatibility: time anchor MUST
  be a date column (no override); measure SHOULD be numeric (override
  permitted with recorded reason); identity key SHOULD have ≥99%
  uniqueness (override permitted with recorded reason).
- **FR-007**: System MUST persist the workspace state (sources, sheets,
  columns, types, profile, roles, overrides) into a workspace manifest
  with content hashes for every source file.
- **FR-008**: System MUST be able to export the workspace manifest and
  re-import it; reproduction MUST produce identical schema, profile, and
  role state from the same source files; modified source files MUST
  block reproduction with a hash-diff report.
- **FR-009**: System MUST surface a workspace-level readiness indicator
  for MVP 1, computed as: ≥1 identity key, ≥1 time anchor, ≥1 measure,
  and ≥1 source-of-truth outcome assigned, AND no unresolved CRITICAL
  quality warnings on those columns.
- **FR-010**: System MUST record every override (header row, data
  range, column type, role compatibility) with its reason and a
  timestamp, and surface them in the manifest.
- **FR-011**: System MUST surface every visible field-role summary
  with traceability back to source file + sheet + column + override
  history (Constitution VI).
- **FR-012**: System MUST refuse encrypted Excel files at upload with a
  human-readable error.
- **FR-013**: For files exceeding the configured size threshold, system
  MUST sample for profiling, record the sample size and seed in the
  manifest, and visibly mark profile values as "sampled".

### Out of Scope (MVP 1)

- Defining relationships across files (deferred to MVP 2).
- Defining metrics / metric contracts (deferred to MVP 3).
- Reconciliation, challenge runs, dashboards, exports beyond the
  workspace manifest (deferred to MVP 4 / 5 / output surfaces).

### Key Entities

- **Workspace**: A user-scoped container holding sources, schema,
  profile, and role assignments. Has a manifest version and a content
  hash of the union of source-file hashes.
- **Source File**: An uploaded `.xlsx` / `.csv` with a content hash,
  upload timestamp, original filename, and detected encoding.
- **Sheet**: A logical sheet within a source file with a detected
  (and optionally overridden) header row and data range.
- **Column**: Belongs to a sheet, has an inferred type, optional
  type override, a quality profile, and zero or more business roles.
- **Profile**: Per-column quality summary (nulls, distinct, top-K,
  range, warnings) with the sample size used.
- **Role Assignment**: Links a column to a business role with optional
  override reason and timestamp.
- **Manifest**: A reproducibility document binding source-file hashes,
  per-sheet ranges, per-column types and overrides, profile summary,
  and role assignments at a versioned point in time.

## Decision-Readiness Gates *(mandatory for this project)*

MVP 1 surfaces are **exploration** and **analysis workbench** roles
only. No surface in this feature may carry recommendation language.

| Gate                    | MVP 1 posture                                                    |
| ----------------------- | ---------------------------------------------------------------- |
| Data quality            | Required for "MVP 1 complete" indicator; CRITICAL warnings block |
| Relationship confidence | N/A in MVP 1 (no cross-table queries yet)                        |
| Metric contract         | N/A in MVP 1 (no metrics yet)                                    |
| Reconciliation residual | N/A in MVP 1                                                     |
| Challenge stability     | N/A in MVP 1                                                     |
| Output readiness        | Only "exploration" and "analysis workbench" surfaces permitted   |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An analyst can upload, profile, and fully role-assign a
  3-file / 8-sheet sample workspace in under 10 minutes without
  consulting documentation.
- **SC-002**: 100% of columns surfaced in the "available measures" /
  "available time anchors" / "available identity keys" / "available
  source-of-truth" summaries pass their role-compatibility constraints
  (no false-positives in the readiness indicator).
- **SC-003**: For the bundled sample workspace, exporting the manifest
  and re-importing on a fresh install reproduces schema, profile, and
  role state with zero diffs.
- **SC-004**: 0 visible field-role summaries lack a traceability link
  back to source file + sheet + column.
- **SC-005**: Upload of an encrypted or malformed file produces a
  human-readable error within 5 seconds and never leaves a partial
  workspace behind.

## Assumptions

- Users have local copies of the Excel/CSV files they intend to
  analyse; cloud-source ingestion is out of scope.
- Each workspace is single-user in MVP 1; multi-user concurrency is
  deferred.
- Persistence backend is SQLite for MVP 1, with the schema designed so
  PostgreSQL is a non-breaking upgrade path (per `tmp/overview.md` §5).
- Excel files generally have one logical data range per sheet;
  multi-range sheets are surfaced as warnings, not parsed.
- The sample size threshold for "sampled profile" is configurable but
  defaults to a value that keeps profile latency under a few seconds
  on the bundled sample workspace.
- DuckDB is used for any tabular profiling SQL during MVP 1, even though
  no cross-table queries are exposed to the user yet.

## Traceability Surfaces *(mandatory for this project)*

- Workspace summary screen — links each role-eligible column back to
  source file, sheet, header row, data range, type override (if any),
  and profile warnings.
- Manifest export — full lineage at point in time.
- Override log — every header / range / type / role override visible
  with reason and timestamp.
