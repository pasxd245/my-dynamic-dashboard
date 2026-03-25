# Requirements Analysis

## Functional Requirements

### Immediate requirements

- Accept one or more Excel uploads.
- Read sheet structure, columns, and inferred data types.
- Store raw data in a form that can handle 100k+ rows efficiently.
- Define relationships between uploaded tables.
- Run joins and aggregations outside Excel.
- Export result datasets back to Excel for pivot tables and charts.

### Near-term requirements

- Persist schema metadata for each upload.
- Suggest possible relationships from column names, types, uniqueness, and value overlap.
- Let users choose a base table and related tables for a report.
- Generate repeatable weekly and monthly summary outputs.

### Longer-term requirements

- Support a UI for relationship management.
- Support dynamic report building without hand-writing SQL.
- Save reusable report definitions.
- Add dashboard views on top of the same data model.

## Non-Functional Requirements

- Must perform reliably on datasets larger than Excel handles comfortably.
- Must be simple enough for incremental delivery by a small team or solo builder.
- Must preserve a path back to Excel while the new system matures.
- Must keep relationship logic explicit rather than buried in ad-hoc workbook steps.

## Key Domain Assumptions

- Reporting is weekly and monthly rather than real-time.
- Users can tolerate batch processing.
- Data arrives primarily through export files, not continuous event streams.
- Single-user or small-team use is a reasonable initial assumption.

## Critical Design Decisions

### Relationship definition

Relationships are central and cannot be treated as a static hardcoded mapping forever.

Minimum acceptable approach:

- store relationship metadata explicitly
- allow joins to change per report

### Output mode

The first release should optimize for Excel-compatible outputs, not replace Excel entirely.

### Schema flexibility

The system should handle changing file structures, but that does not require full generic BI tooling on day one.

## Risks

- Type inference from Excel can be noisy.
- Relationship suggestions can be wrong.
- Dynamic join generation can become confusing if the model is not explicit.
- A visual relationship builder may add significant UI complexity too early.

## Acceptance Lens

An MVP is successful if it can:

1. ingest several Excel files
2. define relationships between them
3. execute large joins and aggregations quickly
4. export a smaller result file that is easy to use in Excel
