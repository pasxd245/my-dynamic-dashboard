# Research: SQLModel Persistence Foundation

**Spec**: `/specs/008-sqlmodel-persistence-foundation/spec.md`  
**Plan**: `/specs/008-sqlmodel-persistence-foundation/plan.md`  
**Date**: 2026-05-10

This research resolves Phase 0 decisions for persistence-governance hardening while preserving current backend behavior.

## 1. SQLModel + Alembic Dependency Baseline

### Decision

Pin and adopt the following backend persistence dependencies:

- `sqlmodel` (declarative model layer)
- `sqlalchemy` (engine/metadata compatibility layer)
- `alembic` (migration governance)

Maintain existing FastAPI stack behavior while introducing these as additive foundation tooling.

### Rationale

- Meets FR-001 and establishes versioned schema ownership.
- Aligns to Round 22 objective: persistence governance first, behavior unchanged.
- Preserves compatibility posture with current FastAPI and pytest workflow.

### Alternatives considered

- Keep raw SQL string ownership only: rejected because migration traceability and reproducibility remain weak.
- Adopt a different migration stack: rejected because SQLModel and Alembic are standard and directly compatible with SQLAlchemy metadata targeting.

## 2. Baseline Migration Strategy (Round 22 Gate A)

### Decision

Implement baseline migration with explicit per-model `op.create_table()` operations generated from declarative model ownership, rather than copying raw SQL blobs from `metadata_db.py`.

### Rationale

- Directly enforces Round 22 Gate A lock.
- Keeps baseline regenerable from model metadata and auditable in migration history.
- Avoids drift caused by duplicated SQL string maintenance.

### Alternatives considered

- Raw SQL paste into baseline migration: rejected because it weakens model-to-migration traceability.
- Reflection-driven runtime table creation: rejected because governance requires explicit versioned migrations.

## 3. Existing Database Bootstrap Strategy (Round 22 Gate B)

### Decision

At startup, if metadata DB exists but has no `alembic_version`, run `alembic stamp head` before `alembic upgrade head`, then continue boot.

### Rationale

- Satisfies FR-012 and SC-004 for existing DB safety.
- Prevents destructive or duplicated baseline re-creation against already-populated schemas.
- Produces deterministic one-boot convergence to migration-tracked state.

### Alternatives considered

- Always run `upgrade head` without stamp: rejected because legacy DBs without version table may fail or be mutated unsafely.
- Force manual operator stamp: rejected due to operational risk and rollout fragility.

## 4. Declarative Model Partitioning and Parity

### Decision

Use per-domain model modules under `apps/backend/app/models/`:

- `workspace.py`
- `source.py`
- `legacy_files.py`
- `relationship.py`
- `saved_query.py`
- `dashboard.py`
- `deployment.py`
- `column_mappings.py`

Map all 26 legacy metadata tables in `metadata_db.py` into these modules, including formerly late-added saved-query columns as baseline fields.

### Rationale

- Meets FR-002 and FR-004 while staying close to existing domain boundaries.
- Keeps migration ownership explicit and maintainable.
- Prevents startup schema patch logic from remaining a hidden parity mechanism.

### Alternatives considered

- Single `models.py` file: rejected for long-term maintainability and reviewability.
- Immediate table reshaping while migrating: rejected by FR-019 and zero-behavior-change boundary.

## 5. `column_mappings` Foundation Table

### Decision

Add `column_mappings` in a dedicated follow-up migration with contract fields:

- `id` primary key
- `workspace_id` required FK
- `source_file_id` nullable FK
- `from_column_name`
- `to_column_name`
- `from_version`
- `to_version`
- `confidence` bounded to 0.0..1.0
- `accepted_by`
- `created_at`

No production workflow writes or reads this table in this round.

### Rationale

- Satisfies FR-003 and FR-005.
- Pre-stages future fuzzy rename work without reopening foundation migrations.
- Preserves strict scope control for this round.

### Alternatives considered

- Defer table entirely: rejected because future work would require another schema-foundation change.
- Implement fuzzy matcher now: rejected by FR-018 and risk containment goals.

## 6. Service-Layer Hold (Round 22 Gate C)

### Decision

Keep current service-layer data access on raw `sqlite3` connections and `conn.execute()` patterns in this feature.

### Rationale

- Enforces FR-015 and FR-016 plus Round 22 Gate C lock.
- Isolates risk to schema governance and startup orchestration.
- Preserves behavioral contract for existing endpoints and tests.

### Alternatives considered

- Partial service conversion to ORM sessions: rejected because mixed access refactor increases regression risk in this foundation round.

## 7. Runtime Environment Contract

### Decision

Introduce typed environment helper support with `METADATA_DB_PATH` as the authoritative runtime override for metadata DB location, consumed by new DB core wiring.

### Rationale

- Satisfies FR-006 and FR-007.
- Improves reproducibility across local, test, and container contexts.
- Pre-stages broader config hygiene without changing functional service flows.

### Alternatives considered

- Continue direct `os.getenv` usage at call sites: rejected due to duplicated configuration logic and lower governance clarity.

## Final Research Outcome

All planning clarifications are resolved. The selected design preserves existing behavior while introducing auditable, reproducible schema governance aligned with Round 22 locks:

1. Baseline uses per-model `op.create_table()`.
2. Existing DBs auto-stamp before upgrade.
3. Service-layer rewrite remains out of scope.
