# Phase 0 Research: Upload + Profile + Field Roles (MVP 1)

## Decision 1: Keep Polars as the unified parser/profile engine for MVP 1

- Decision: Use Polars for CSV/XLSX ingestion and profile computation in backend services; keep FastAPI as orchestration/API layer.
- Rationale: Polars is already in the backend dependency set and provides efficient columnar profiling, typed columns, and fast aggregation for null/distinct/range/top-K metrics required by FR-004.
- Alternatives considered:
  - Pandas for ingestion/profile: rejected due to weaker performance characteristics on large datasets and less alignment with current backend architecture.
  - DuckDB-only parsing path: rejected for now because worksheet/header-range override flow is easier to model in a Python dataframe-first service layer before persisting to Parquet.

## Decision 2: Manifest reproducibility uses deterministic JSON + SHA-256 file hashes

- Decision: Represent manifest as a versioned JSON document with deterministic key ordering and SHA-256 hashes for source file content and canonical workspace payload sections.
- Rationale: Deterministic serialization + cryptographic hash matching directly supports Constitution VII and FR-008 requirements for byte-identical reconstruction checks and mismatch reporting.
- Alternatives considered:
  - SQLite backup as manifest artifact: rejected because it is less portable and opaque for review/audit.
  - MD5 hashes: rejected due to weaker collision resistance and unnecessary governance risk.

## Decision 3: Role compatibility matrix with hard and soft constraints

- Decision: Enforce compatibility in backend with explicit rule classes:
  - Hard constraint: `time anchor` requires effective date type, no override path.
  - Soft constraint: `measure` expects numeric type, override allowed with reason/timestamp.
  - Soft constraint: `identity key` expects >=99% uniqueness, override allowed with reason/timestamp.
- Rationale: Matches FR-006 and provides a clear, auditable contract for builder behavior while preventing client-side bypass.
- Alternatives considered:
  - Client-only validation: rejected because it is bypassable and weak for traceability.
  - All-hard constraints: rejected because business workflows require documented exceptions.

## Decision 4: Oversized file profiling is sampled and explicitly labeled

- Decision: For files beyond configured thresholds (size/row count), compute profile on deterministic sample (`sample_size`, `sample_seed`) and persist sampling metadata in profile + manifest.
- Rationale: Aligns with FR-013 and keeps profiling latency bounded while preserving reproducibility via stable seed/sample declarations.
- Alternatives considered:
  - Full-scan profiling for all files: rejected due to latency risk for >1M rows.
  - Pure random sampling without persisted seed: rejected because it breaks reproducibility.

## Decision 5: Contract-first REST API between builder and backend

- Decision: Define MVP 1 interface in `contracts/upload-profile-roles.openapi.yaml` and implement server-side request/response schemas from that contract.
- Rationale: Supports implementation sequencing, keeps backend/frontend coupling explicit, and provides a stable basis for Phase 2 tasks.
- Alternatives considered:
  - Implicit contract via ad hoc JSON responses: rejected due to integration drift risk.
  - GraphQL endpoint for MVP 1: rejected as unnecessary complexity for current backend stack.

## Decision 6: Readiness indicator remains exploration/workbench only

- Decision: Compute readiness as FR-009 requires, but expose it with surface role metadata (`exploration`/`analysis_workbench`) and no recommendation language.
- Rationale: Preserves constitution principles IV and V while still giving actionable progress visibility for MVP 1 completion.
- Alternatives considered:
  - Decision-ready labeling in MVP 1: rejected by constitution gates and feature scope.
