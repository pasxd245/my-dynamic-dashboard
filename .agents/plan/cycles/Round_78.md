# Round 78: Persistence foundation — migrations (SQLModel + SQLAlchemy + Alembic)

**Status**: ✅ Complete (human-signed-off 2026-06-16) — migrations foundation shipped
**Date started**: 2026-06-16
**Date completed**: 2026-06-16
**Flow**: **D → B** (non-feature infra/refactor; `flow-selector` is **N/A** — its 5
conditions are all UI/UX/contract-shape, and this round has **no UI surface and no
contract re-open**; recorded in the Do log). The substantive gates are **Design** (the
migration strategy — now closed, see [persistence.md](../../context/persistence.md)) +
**Backend** (implement + tests). No F1/F2/Contract phases.

## Goal

The MVP main-stream is ~complete (R77 closed). The backend persists metadata in SQLite via
a **hand-bootstrapped schema** — [db.py](../../../workspace/apps/backend/app/db.py) creates
tables with `CREATE TABLE IF NOT EXISTS` and evolves them with a manual
`_add_missing_columns` ALTER (the R76 `source_id`) plus `_backfill_duplicate_names`. Its own
comment says _"No migrations framework yet; revisit when a schema-change round arrives."_
That round is now: the data model is stable, and the roadmap ahead is **schema-heavy** (the
canvas may persist layout; workflow, consumer-save, and dashboard each add tables — and
consumer-save is **real user data you cannot drop-and-recreate**).

R78 pulls in a **migrations foundation** — `sqlmodel` + `sqlalchemy` + `alembic` — so that
**every future schema change is a versioned migration, not a direct edit to `_SCHEMA`**. It
establishes the *capability*: SQLModel models that are the **schema of record**, an Alembic
baseline that reproduces today's schema exactly, existing dev DBs adopted **without data
loss**, and `alembic upgrade` on startup replacing the hand-bootstrap.

**This is migration-FIRST by deliberate sequencing** (the agreed post-MVP roadmap, Option B):
the migration value activates at the *next* schema change, so the foundation must precede the
feature themes — not trail them ([round-roadmap-deferrals](../../memory/2026-05-22-round-roadmap-deferrals.md);
the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium) — brake to do
the foundation right before accelerating into features).

_Track: 1 (infrastructure). Pulled by ← the post-MVP roadmap decision (persistence foundation
first). It re-opens **no** wire contract and touches **no** FE: a backend-internal persistence
refactor only._

## Judgment calls

### Ratified at the Plan gate (2026-06-16)

| #   | Question        | Resolution                                                                                                                                                                                                                                                                                                                                                |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-0 | **Round topic** | **Adopt a migrations foundation** (ratified) — `sqlmodel` + `sqlalchemy` + `alembic`; SQLModel models become the schema of record, an Alembic baseline reproduces today's schema, and `alembic upgrade` on startup replaces the hand-bootstrapped `_SCHEMA` / `_add_missing_columns`. Future schema changes are new revisions, never `_SCHEMA` edits.        |
| J-1 | **Distill the MECHANISM, not the schema** | **Ratified.** The drifted ref app (`tmp/ref-apps/my-dynamic-dashboard-drifted/apps/backend`) already has the full stack, but its **schema drifted heavily** (`saved_queries`/`query_id`/`config_hash`/version+event+execution tables; `relationship_rules` with column-id FKs + `overlap_pct`) — it is **not** a superset of our 4 contract-backed tables. Adopt its **mechanism** (the clean `alembic/env.py`, `alembic.ini`, model wiring); author models that **mirror mainstream's current schema exactly** ([drifted-shell-distillation](../../memory/2026-05-23-drifted-shell-distillation.md)). |
| J-2 | **Scope = foundation only; defer the ORM data-access port** | **Ratified.** R78 delivers the migration *capability*. The **71 raw-SQL data-access sites** across 5 files (`con.execute`) stay on `sqlite3` this round — porting them to the ORM is a large, regression-prone change **not required** for migrations. It is **deferred/incremental** (done as feature rounds touch each router). Thin round, clean revert seam ([round-roadmap-deferrals](../../memory/2026-05-22-round-roadmap-deferrals.md)). |

### Resolved at the Design gate (2026-06-16) — full strategy in [persistence.md](../../context/persistence.md)

| #   | Question                                          | Resolution                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **Baseline + existing-DB adoption (no data loss)** | **Resolved.** One `0001_baseline` revision reproducing today's schema. The startup **adopter** branches: fresh DB (no tables) → `upgrade head`; **pre-Alembic** DB (tables, no `alembic_version`) → **heal-then-stamp** (run the idempotent legacy heal once → `stamp 0001_baseline` → `upgrade head`); versioned DB → `upgrade head`. **Heal-then-stamp, not bare stamp** — a bare stamp would silently mis-label a pre-R25/R76 DB that's missing `source_id`/unique indexes; the heal lifts any old DB *to* baseline shape first. The heal is retained **only as a one-time adoption bridge** (clean deletion seam), so J-2's "retire the hand-bootstrap" holds for the steady-state path. Driven via Alembic's Python API (`command.stamp`/`upgrade`), URL = `get_db_path()`. |
| J-4 | **Test hermeticity + the startup hook**            | **Resolved.** The standard split: **tests** build schema via `SQLModel.metadata.create_all()` (fast, no Alembic) through a new `db.create_all_for_tests()` (fresh engine from the *current* `get_db_path()` so the per-test override still applies); **production / `pnpm dev:seed`** run the adopter (`alembic upgrade head`). Hook point: the [main.py](../../../workspace/apps/backend/app/main.py) `lifespan` (adopter replaces `bootstrap_schema()`); [conftest.py](../../../workspace/apps/backend/tests/conftest.py) + `reset_db_for_tests` call `create_all_for_tests()`. **Doc home: `.agents/context/persistence.md`** (non-UI architecture → `context/`, not `design/`). |

**Invariant — refined at the Design gate (behaviour-preserving):** R78 changes **how the
schema is created/evolved**, not **what it is**. The plan said "byte-for-byte"; the Design gate
refines this to **structural/behavioral equivalence** — SQLAlchemy-generated DDL is never
character-identical to the hand-written SQL (constraint auto-naming, whitespace, clause order),
so the **binding parity guard is a structural test** (`PRAGMA table_info` / `foreign_key_list` /
`index_list` + the `CHECK` clauses, `DB_legacy` vs `create_all()`), with `--autogenerate` as the
drafting aid only. The wire contract, the FE, and the DuckDB analytics engine (rows/preview) are
**untouched** ([be-round-conformance-pattern](../../memory/2026-05-24-be-round-conformance-pattern.md)).

## Plan (by gate)

1. **Plan gate** — ratify J-0/J-1/J-2; record J-3/J-4 held open. Commit the ratified round
   file (Plan seam). _(This step.)_
2. **Design gate — author the migration strategy:** the SQLModel models mirroring the current
   schema (J-1), the baseline migration + existing-DB stamp/upgrade adopter (J-3), the
   test-hermeticity split + startup hook (J-4), and the explicit statement that **no wire
   contract / FE / schema-shape changes** (model-confidence valve → **confirm**, not re-open).
   Update the persistence/architecture doc home. Run `flow-selector` (expected minimal chain).
3. **Design-gate verification** — `plan:lint` / `markdown-check-link` / `markdownlint`;
   `gate-walker`; `flow-selector`. (`design:lint` / `design:tokens` apply only if a design-doc
   surface is touched; `ui-design` is **N/A** — no UI surface.)
4. **Backend gate** — add deps via `uv` ([python-tooling-uv](../../memory/2026-05-22-python-tooling-uv.md));
   author the models + `alembic/` (env, ini, baseline) + the startup adopter; retire
   `_SCHEMA`/`_add_missing_columns`/`_backfill_duplicate_names` into the baseline; adapt the
   test setup. **pytest stays 193/193**; **OpenAPI 24/24** and dual conformance **unchanged**
   (confirm — the contract is not re-opened). Per-gate commit (revert seam).

## Acceptance criteria

+ [x] **J-0, J-1, J-2 ratified**; **J-3, J-4 held open** → resolved at the Design gate.
+ [x] **`sqlmodel` + `sqlalchemy` + `alembic` added** to the backend (via `uv`); SQLModel
      models for the **4 current tables** (`workspaces`, `datasets`, `queries`,
      `relationships`) mirror the contract-backed schema **exactly** — columns, dtypes, FKs,
      `ON DELETE CASCADE`, `CHECK`s, and the R25/R76 unique indexes + `source_id`.
+ [x] **Alembic wired**: `env.py` (target = `SQLModel.metadata`, URL = mainstream's data-root
      `app.sqlite`), `alembic.ini`, and a **baseline migration** that reproduces today's schema
      (verified by a **structural parity test** vs the frozen legacy schema — the refined form of
      "zero diff"; see the Design-gate invariant note).
+ [x] **Existing dev DBs adopt the baseline without data loss** (heal-then-stamp, not re-created;
      test `test_existing_db_adopted_without_data_loss`); **fresh DBs upgrade to head**;
      **startup runs the adopter** in the lifespan, replacing `bootstrap_schema()`.
+ [x] **Tests stay green + hermetic**: pytest **196/196** (193 unchanged + 3 new parity/adoption);
      the test schema setup uses `create_all()` (no per-test Alembic), `reset_db_for_tests` adapted.
+ [x] **Contract / FE UNCHANGED** (model-confidence valve → confirm): **no FE diff**; conformance
      tests (among the 196) pass against the same contracts; DuckDB rows/preview engine untouched.
      _(OpenAPI 24/24 + FE 31/31 dual-conformance re-confirm belongs to human sign-off / CI.)_
+ [x] **The ad-hoc schema logic is retired** into the baseline — future schema changes are
      **new Alembic revisions**, never `_SCHEMA` edits (legacy heal kept only as adoption bridge).
+ [ ] Gates green: `plan:lint` 0, `markdown-check-link` 0 broken, `markdownlint` 0;
      `gate-walker` confirms each gate exit; `flow-selector` run + recorded.
+ [ ] Each gate **committed separately** (revert seams). **Complete = human-signed-off** (a
      fresh DB and an existing seeded DB both come up on Alembic with data intact, `pnpm dev:seed`
      still works, pytest green).

## What is OUT of scope

+ **The raw-SQL → ORM data-access port** (the 71 `con.execute` sites across `queries.py` /
  `datasets.py` / `workspaces.py` / `relationships.py` / `db.py`) → **deferred/incremental**,
  done as feature rounds touch each router. R78 needs only the metadata + migrations, not the
  query-layer rewrite.
+ **Any SCHEMA change / new table** → belongs to the feature themes (canvas / workflow /
  consumer-save / dashboard), **each shipping its schema as its own Alembic migration**. R78
  reproduces the *current* schema only.
+ **Adopting the drifted app's schema/models** (`saved_queries`, `relationship_rules`,
  version/event/audit tables) → it drifted; not our model. We distill mechanism only (J-1).
+ **Non-SQLite backends** (Postgres, etc.), async ORM, connection-pool redesign, multi-DB →
  SQLite (`app.sqlite`) stays; only the create/evolve mechanism changes.
+ **The `datasetId → sourceId` rename cleanup** (a named R76/R77 deferral) → still its own
  round, though it now becomes a clean Alembic migration once R78 lands.

## Risks / unknowns

+ **Baseline ≠ existing schema (silent divergence).** If the baseline migration's `CREATE`
  differs even slightly from the hand-built `_SCHEMA`, *stamped* DBs diverge from *fresh* ones.
  _Mitigation: author the baseline via `--autogenerate` against a fresh `bootstrap_schema()` DB
  and assert a **zero** subsequent autogenerate diff; a test pins metadata == current schema._
+ **Existing-DB adoption clobbers data.** A naive `upgrade head` on a populated DB fails or
  drops. _Mitigation: the startup adopter stamps the baseline when tables exist but
  `alembic_version` does not; only then upgrades. Tested against a seeded `app.sqlite`._
+ **Test-suite slowdown / non-hermeticity** if Alembic runs per test. _Mitigation: tests
  `create_all()` from metadata; production migrates (J-4)._
+ **SQLite ≠ DuckDB conflation.** Metadata lives in SQLite (`app.sqlite`); DuckDB is the
  **analytics** engine for dataset rows/preview and is **not** under Alembic. _Mitigation: the
  design states the boundary explicitly; Alembic governs `app.sqlite` only._
+ **SQLite ALTER limitations under Alembic** (no native `ALTER COLUMN`; batch mode needed for
  later migrations). _Mitigation: configure `render_as_batch=True` in `env.py` now so future
  revisions work; the baseline itself is pure `CREATE`._

## Do

### Plan-gate ratification (2026-06-16)

+ **J-0 → adopt a migrations foundation** — SQLModel/SQLAlchemy/Alembic; models as schema of
  record; `alembic upgrade` replaces the hand-bootstrap; future changes are revisions.
+ **J-1 → distill the mechanism, not the schema** — the drifted app's schema drifted heavily;
  reuse its `env.py`/wiring, author models mirroring mainstream's current 4 tables exactly.
+ **J-2 → foundation only; defer the 71-site ORM data-access port** — not required for
  migrations; incremental as features touch each router. Thin round, revert seam.
+ **J-3 → baseline + existing-DB stamp/upgrade adoption** held open for Design.
+ **J-4 → test hermeticity (`create_all` for tests, migrate in prod) + startup hook** held
  open for Design.
+ **Invariant:** behaviour-preserving — the schema's *shape* is unchanged; only
  its create/evolve mechanism changes. No contract, no FE, no DuckDB-engine change.

### Design-gate close (2026-06-16)

+ **Strategy authored** → [persistence.md](../../context/persistence.md): the 4 SQLModel
  models (schema of record), Alembic wiring (`env.py`/`ini`, `render_as_batch=True`,
  `target = SQLModel.metadata`, URL = `get_db_path()`), the `0001_baseline` revision, the
  heal-then-stamp adopter (J-3), and the `create_all` (tests) / `upgrade head` (prod) split (J-4).
+ **J-3, J-4 resolved** (see the table above); the "byte-for-byte" invariant refined to
  **structural/behavioral parity** with a structural introspection test as the binding guard.
+ **Flow selector — N/A (recorded, not run).** Per [flow-selector](../../skills/flow-selector/SKILL.md)
  ("not a feature round → skip the selector") and [gate-walker](../../skills/gate-walker/SKILL.md)
  ("not a feature round → gates don't apply"): R78 has **no UI surface** and **no contract
  re-open**, so all five 2-of-5 conditions (interactive states, new interaction pattern,
  user-error risk, contract-shape-depends-on-UI, UX confidence) are vacuously **no**. Chain is
  **DCFBI-family minus FE/Contract = D → B** (Design → Backend), no F1/F2/Contract phase.
+ **Design model check** (gate-walker forcing-function): **noun-vs-mode → neither** — R78
  introduces **no new noun and no new surface**; it re-homes the *mechanism* that maintains the
  existing schema. **discovered-vs-imposed → discovered** — the models/baseline are *mirrored
  from* the existing hand-built `_SCHEMA` (J-1), not an imposed new model; the drifted app's
  schema is explicitly **not** adopted.
+ **Gates green at Design close:** `plan:lint` 0, `markdownlint` 0, `markdown-check-link` 0
  broken (run below). `ui-design` / `design:lint` / `design:tokens` **N/A** — no UI/design-doc
  surface (the deliverable is a `context/` architecture note).

### Backend-gate implementation (2026-06-16)

+ **Deps added via `uv`**: `sqlmodel>=0.0.38`, `alembic>=1.18.4` (pulls `sqlalchemy==2.0.51`).
+ **Models** → [app/db_models.py](../../../workspace/apps/backend/app/db_models.py): the 4
  tables as schema of record; explicit `sa_column=Column(Text/Integer, …)` so SQLite emits
  `TEXT`/`INTEGER` (a bare `str` renders `VARCHAR`); CHECK text copied verbatim from `_SCHEMA`.
+ **Alembic wired** → `alembic.ini` + [env.py](../../../workspace/apps/backend/alembic/env.py)
  (`target = SQLModel.metadata`, URL from `get_db_path()`, `render_as_batch=True`) + autogenerated,
  reviewed [0001_baseline](../../../workspace/apps/backend/alembic/versions/0001_baseline.py)
  (all 4 tables incl. CHECKs + FK CASCADE + R25/R69/R70 indexes).
+ **Adopter + test split** → [db.py](../../../workspace/apps/backend/app/db.py): `run_startup_migrations()`
  (heal-then-stamp → upgrade) in the [main.py](../../../workspace/apps/backend/app/main.py)
  lifespan; `create_all_for_tests()` in [conftest.py](../../../workspace/apps/backend/tests/conftest.py).
  Hand-bootstrap retired; legacy heal kept only as a labeled one-time adoption bridge.
+ **Parity guard** → [test_schema_parity.py](../../../workspace/apps/backend/tests/test_schema_parity.py):
  pins **legacy `_SCHEMA` == `create_all()` == `alembic upgrade head`** (columns / FK+`ON DELETE` /
  indexes / CHECK clauses) + an existing-DB-adopted-without-data-loss test. One documented
  behavior-equivalent quirk normalized: inline `id TEXT PRIMARY KEY` reports `notnull=0`, SQLAlchemy
  emits explicit `NOT NULL` (`notnull=1`) — confirms the Design-gate "structural, not byte-for-byte" call.
+ **Green**: pytest **196/196** (193 + 3 new); `ruff` clean; real fresh-DB boot verified outside
  pytest (4 tables + `alembic_version` @ `0001_baseline`). Contract untouched (no FE/contract diff;
  conformance tests among the 196 pass).

## Check

+ [x] **J-0, J-1, J-2 ratified** (Plan gate); **J-3, J-4 resolved** (Design gate).
+ [x] **Design gate closed** — strategy in [persistence.md](../../context/persistence.md);
      flow = D → B (selector N/A, recorded); model check recorded; design-gate gates green.
+ [x] **Backend gate closed** — models + Alembic + adopter implemented; pytest 196/196; ruff
      clean; parity + no-data-loss guards green; fresh-DB boot verified. Per-gate commit (seam).
+ [x] **Gates green**: `plan:lint` 0, `markdown-check-link` 0 broken, `markdownlint` 0
      (Design + Backend commits); `flow-selector` N/A (recorded); model check recorded.
+ [x] **Human sign-off (2026-06-16)** — ran `pnpm dev` → `pnpm dev:seed` against an isolated
      `data-test/` root: **fresh DB came up on Alembic and the seed data renders** (scenario 1
      verified live — real engine + CORS + UI). Existing-DB adoption-without-loss (scenario 2)
      is covered by the green `test_existing_db_adopted_without_data_loss` test; the real pre-R78
      `data/` was left **untouched** (still un-stamped, data intact) by using the isolated root.
      pytest 196/196. Complete = signed-off.

## Act

**Shipped.** The backend now evolves its schema through **versioned Alembic migrations** with
SQLModel models as the schema of record, replacing the hand-bootstrapped `_SCHEMA` /
`_add_missing_columns` / `_backfill` that ran on every boot. The `0001_baseline` reproduces
today's 4-table schema (verified by the structural-parity test pinning legacy == `create_all()`
== `alembic upgrade head`); the lifespan adopter brings fresh DBs to head and adopts existing
dev DBs without data loss (heal-then-stamp). Tests build via `create_all()` (fast/hermetic);
production migrates. pytest **196/196**, no FE/contract change, DuckDB engine untouched.

**Lessons / deltas worth carrying forward:**

+ **"Byte-for-byte" was the wrong invariant; structural/behavioral parity is the right one.**
  SQLAlchemy-generated DDL is never character-identical to hand SQL — the binding guard is a
  structural introspection test, not an autogenerate-zero-diff. (Confirmed concretely: the inline
  `id TEXT PRIMARY KEY` `notnull=0` vs SQLAlchemy's explicit `NOT NULL` quirk — behavior-equivalent,
  normalized in the test.) → candidate memory.
+ **Seed (demo fixtures, I-verify, goes *through* the API) and Alembic data-migrations (real-data
  transforms, run everywhere) are orthogonal** — do not fold seed into migrations. The genuine
  data-migration fit is the deferred `datasetId → sourceId` backfill, not fixtures.
+ **The data root (not the `.sqlite` file) is the isolation/backup unit** — `app.sqlite` + parquet
  + `uploads_tmp/` move together via `MDD_BACKEND__DATA_DIR`; the adopter mutates in place, so
  verify on a copy. (Used for this round's sign-off via an isolated `data-test/` root.)

**Deferred (unchanged):** the raw-SQL → ORM data-access port (incremental as feature rounds touch
each router); all schema *changes* (each ships as its own migration); the `datasetId → sourceId`
rename (now a clean Alembic migration).

## Feeds into → the feature themes, each carrying its own migrations

With migrations in place, the roadmap resumes on the feature side — **canvas for the builder**
(its proper round, not MVP-rushed), then **(maybe) workflow / complex query**, **save data for
the consumer**, and **dashboard** — each now shipping schema changes as Alembic revisions. The
**raw-SQL → ORM data-access port** proceeds incrementally as those rounds touch each router;
the **`datasetId → sourceId` rename cleanup** becomes a clean migration. Standing triggers
(composite keys, self-joins, cross-workspace joins, `is_empty` predicates) remain deferred.
