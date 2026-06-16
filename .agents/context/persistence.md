# Persistence & Migrations — architecture note

> How the backend's SQLite metadata schema is **created and evolved**.
> Authored at the [Round 78](../plan/cycles/Round_78.md) Design gate as
> the migration-foundation strategy the Backend gate implements against.
> This is a **non-UI architecture note** — it lives in `context/` per the
> [design README](../design/README.md) rule ("architecture for non-UI
> concerns belongs alongside its concept, not in `design/`").

_Track: 1 (infrastructure). Pulled by: the post-MVP roadmap decision
(persistence foundation first) — see
[round-roadmap-deferrals](../memory/2026-05-22-round-roadmap-deferrals.md)._

---

## The boundary: SQLite metadata vs DuckDB analytics

Two engines, one governed by this note:

| Engine     | Stores                                                  | Under Alembic? |
| ---------- | ------------------------------------------------------- | -------------- |
| **SQLite** (`<data_root>/app.sqlite`) | the **metadata** — workspaces, datasets, queries, relationships | **Yes** (this note) |
| **DuckDB** | dataset **rows / preview** (the analytics engine)       | **No** — not metadata; untouched by R78 |

Alembic governs `app.sqlite` **only**. DuckDB rows/preview are an
analytics concern and stay exactly as they are.

---

## Today (pre-R78): hand-bootstrapped schema

[db.py](../../workspace/apps/backend/app/db.py) creates the schema on
every startup via the FastAPI lifespan:

1. `con.executescript(_SCHEMA)` — `CREATE TABLE IF NOT EXISTS` for the 4
   tables + their non-unique/unique inline indexes.
2. `_add_missing_columns(con)` — a hand ALTER for `queries.source_id`
   (R76), since `CREATE … IF NOT EXISTS` never alters an existing table.
3. `_backfill_duplicate_names(con)` — a **data** heal that suffixes
   duplicate names `(2)`, `(3)`, … so R25's unique indexes can be built.
4. `con.executescript(_R25_UNIQUE_INDEXES)` — the workspace/dataset
   name-uniqueness indexes (created **after** the back-fill).

Its own comment says _"No migrations framework yet; revisit when a
schema-change round arrives."_ That round is R78. The roadmap ahead is
schema-heavy (canvas layout, workflow, **consumer-save = real user data
you cannot drop-and-recreate**, dashboard), so the schema must evolve
through **versioned migrations**, not hand edits to `_SCHEMA`.

---

## Target (R78): SQLModel models + Alembic

### Schema of record = SQLModel models (J-0, J-1)

Four `SQLModel` table models — `Workspace`, `Dataset`, `Query`,
`Relationship` — become the **single source of truth** for the schema.
They mirror **mainstream's current 4 tables exactly** (J-1: distill the
*mechanism* from the drifted ref app — its clean `env.py` / `alembic.ini`
/ model wiring — **not** its heavily-drifted schema of `saved_queries` /
`relationship_rules` / version+event+audit tables).

Each model must reproduce, in `SQLModel.metadata`, every constraint the
hand-built `_SCHEMA` carries:

| Concern                | How it's modeled                                                                 |
| ---------------------- | -------------------------------------------------------------------------------- |
| TEXT primary keys      | `id: str = Field(primary_key=True)` (no autoincrement)                           |
| FK + `ON DELETE CASCADE` | `sa_column=Column(..., ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)` |
| `CHECK` constraints    | `__table_args__ = (CheckConstraint("length(name) BETWEEN 1 AND 80"), …)`         |
| `source_id` (R76)      | `source_id: str \| None` — nullable, additive (folds into the baseline)          |
| Non-unique indexes     | `Index("idx_datasets_workspace_id", "workspace_id")` in `__table_args__`         |
| Unique indexes (R25/R69/R70) | `Index("idx_…_unique", …, unique=True)` in `__table_args__`                 |

The full column inventory is the 4 tables exactly as in
[db.py](../../workspace/apps/backend/app/db.py) `_SCHEMA` +
`_R25_UNIQUE_INDEXES` (workspaces, datasets, queries incl. `source_id`,
relationships).

### Alembic wiring (mechanism distilled from the drifted app, J-1)

- `alembic.ini` + `alembic/env.py` with `target_metadata =
  SQLModel.metadata` and the URL resolved to **mainstream's**
  `app.sqlite` via `app.db.get_db_path()` (so the test/seed data-root
  override flows through — not the drifted app's `metadata_db_path()`).
- `render_as_batch=True` in `env.py` **now**, so *future* migrations can
  do SQLite `ALTER COLUMN` (SQLite has no native one). The baseline
  itself is pure `CREATE`, so it's unaffected.
- One baseline revision `0001_baseline` reproducing today's schema (see
  parity, below).

### The invariant — refined: structural/behavioral parity, not byte text

> **Plan wording was "byte-for-byte."** The Design gate refines this:
> SQLAlchemy-generated DDL will **never** be character-identical to the
> hand-written SQL (constraint auto-naming, whitespace, clause order all
> differ). The real, testable invariant is **structural and behavioral
> equivalence** — same tables, columns, types, nullability, PK, FK +
> cascade, CHECK semantics, and indexes — such that the wire contract
> behaves identically. (A human-facing flag at the gate commit.)

**Verification (the binding guard against silent divergence):** a test
builds `DB_legacy` from a frozen copy of the retired `bootstrap_schema()`
SQL and `DB_models` from `SQLModel.metadata.create_all()`, then asserts
equality of the normalized schema introspection for all 4 tables —
`PRAGMA table_info`, `PRAGMA foreign_key_list`, `PRAGMA index_list` /
`index_info`, and the CHECK clauses from `sqlite_master`. `--autogenerate`
is used only as the **drafting aid** for the baseline; the structural test
is what *pins models == today's schema*.

---

## Existing-DB adoption — no data loss (J-3)

The central problem: existing dev DBs are already bootstrapped and have
**no `alembic_version` table**. A naive `upgrade head` would try to
`CREATE` tables that already exist and fail. The startup **adopter**
(replacing `bootstrap_schema()` in the
[lifespan](../../workspace/apps/backend/app/main.py)) branches on the DB's
state:

| DB state on startup                               | Action                                                       |
| ------------------------------------------------- | ------------------------------------------------------------ |
| **Fresh** (no tables)                             | `alembic upgrade head` — creates everything from the migrations |
| **Pre-Alembic** (tables present, no `alembic_version`) | **heal-then-stamp**: run the idempotent legacy heal once (add missing columns + back-fill dup names + unique indexes — all `IF NOT EXISTS`), then `alembic stamp 0001_baseline`, then `upgrade head` |
| **Versioned** (`alembic_version` present)         | `alembic upgrade head` — the normal steady-state path        |

**Why heal-then-stamp, not bare stamp:** stamping declares "the baseline
schema is already applied." That's only *true* if the existing DB really
is at baseline shape. A DB predating R25/R76 (missing `source_id` or the
unique indexes) would be **silently mis-stamped**. Running the legacy
heal first brings any old DB *up to* baseline shape before we stamp it —
cheap insurance against divergence. The heal code is retained **only as
this one-time adoption bridge** (labeled as such; a clean deletion seam
once all dev DBs carry `alembic_version`), not as steady-state logic — so
J-2's "retire the hand-bootstrap" still holds for the normal path.

The adopter drives Alembic via its **Python API** — `alembic.config.Config`
with `command.stamp` / `command.upgrade` — and sets `sqlalchemy.url` to the
resolved `get_db_path()` (no shelling out).

---

## Test hermeticity + the startup split (J-4)

The 193 pytest are hermetic and fast (per-test `tmp_path` data-root +
`reset_db_for_tests`). Running Alembic per test would be slow and is
unnecessary — so we take the **standard split**:

| Context        | Schema built by                          | Why                                  |
| -------------- | ---------------------------------------- | ------------------------------------ |
| **Tests**      | `SQLModel.metadata.create_all(engine)`   | Fast, no migration machinery; the structural-parity test guarantees this equals the migrated schema |
| **Production / `pnpm dev:seed`** | `alembic upgrade head` (via the adopter) | Real schema evolution path           |

Concrete changes:

- [conftest.py](../../workspace/apps/backend/tests/conftest.py) and
  `reset_db_for_tests` call a new `db.create_all_for_tests()` (builds a
  fresh engine from the *current* `get_db_path()` so the per-test
  override still applies, then `metadata.create_all()`), replacing
  `bootstrap_schema()`. The `DELETE FROM …` reset ordering (children
  before parents) is unchanged.
- [main.py](../../workspace/apps/backend/app/main.py) lifespan calls the
  **adopter** instead of `bootstrap_schema()`.
- FK cascade enforcement still needs `PRAGMA foreign_keys = ON` per
  connection — `get_conn()` already sets it; unchanged.

---

## Out of scope (reproduced here from the round for the durable record)

- **The raw-SQL → ORM data-access port** (the 71 `con.execute` sites
  across the routers) — deferred/incremental, done as feature rounds
  touch each router. R78 needs only metadata + migrations.
- **Any schema change / new table** — belongs to the feature themes
  (canvas / workflow / consumer-save / dashboard), each shipping its
  schema as its **own** Alembic revision.
- **The drifted app's schema/models** — distilled for mechanism only.
- **Non-SQLite backends, async ORM, connection pooling** — out.
- **`datasetId → sourceId` rename cleanup** — still its own round, now a
  clean Alembic migration once R78 lands.

_Conformance pattern (behaviour-preserving BE refactor):
[be-round-conformance-pattern](../memory/2026-05-24-be-round-conformance-pattern.md).
The brake-to-do-the-foundation-right rationale:
[purpose § Dynamic equilibrium](purpose.md#dynamic-equilibrium)._
