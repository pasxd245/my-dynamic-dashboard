# Round 78: Persistence foundation — migrations (SQLModel + SQLAlchemy + Alembic)

**Status**: In Progress (Plan gate — J-0/J-1/J-2 ratified; Design next)
**Date started**: 2026-06-16
**Flow**: TBD — set at the Design gate (`flow-selector`). Infra/refactor round with **no
contract or FE change**; the substantive gates are **Design** (the migration strategy) +
**Backend** (implement + tests). Expected a minimal **D → B** chain (not a feature flow).

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

### Deferred to the Design gate — resolved with the closed design (J-3, J-4)

| #   | Question                                          | Held open for the Design pass                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-3 | **Baseline + existing-DB adoption (no data loss)** | The central design problem: the baseline migration must reproduce the **exact** current schema (4 tables + the R76 `source_id` column + R25 unique indexes + the name-uniqueness/`CHECK`/cascade rules), and **existing dev DBs** (already bootstrapped, no `alembic_version`) must be **stamped at baseline** — not re-`CREATE`d (which would fail "table exists"). Lean: a startup adopter — `alembic_version` absent + a known table present → `stamp base` then `upgrade head`; fresh DB → `upgrade head`. Generate the baseline by autogenerate against a fresh hand-bootstrapped DB and assert zero diff. |
| J-4 | **Test hermeticity + the startup hook**            | The 193 pytest are hermetic + fast (per-test `reset_db_for_tests`). Running Alembic per test would be slow. Lean: **tests build schema from `SQLModel.metadata.create_all()`** (fast, no migrations); **production runs `alembic upgrade head`** on startup — the standard split. Where the upgrade hooks (the `lifespan` in [main.py](../../../workspace/apps/backend/app/main.py), replacing `bootstrap_schema()`), and how `reset_db_for_tests` adapts. Plus the doc home for the persistence/architecture note. |

**Invariant (the refactor must be behaviour-preserving):** R78 changes **how the schema is
created/evolved**, not **what it is**. The 4 tables, their columns, FKs, `ON DELETE CASCADE`,
`CHECK`s, and unique indexes are reproduced byte-for-byte; the wire contract, the FE, and the
DuckDB analytics engine (rows/preview) are **untouched** ([be-round-conformance-pattern](../../memory/2026-05-24-be-round-conformance-pattern.md)).

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

+ [ ] **J-0, J-1, J-2 ratified**; **J-3, J-4 held open** → resolved at the Design gate.
+ [ ] **`sqlmodel` + `sqlalchemy` + `alembic` added** to the backend (via `uv`); SQLModel
      models for the **4 current tables** (`workspaces`, `datasets`, `queries`,
      `relationships`) mirror the contract-backed schema **exactly** — columns, dtypes, FKs,
      `ON DELETE CASCADE`, `CHECK`s, and the R25/R76 unique indexes + `source_id`.
+ [ ] **Alembic wired**: `env.py` (target = `SQLModel.metadata`, URL = mainstream's data-root
      `app.sqlite`), `alembic.ini`, and a **baseline migration** that reproduces today's schema
      (verified by **zero autogenerate diff** vs a fresh hand-bootstrapped DB).
+ [ ] **Existing dev DBs adopt the baseline without data loss** (stamped, not re-created);
      **fresh DBs upgrade to head**; **startup runs `alembic upgrade head`**, replacing
      `bootstrap_schema()`.
+ [ ] **Tests stay green + hermetic**: pytest **193/193** unchanged; the test schema setup
      uses `metadata.create_all()` (no per-test Alembic), `reset_db_for_tests` adapted.
+ [ ] **Contract / FE UNCHANGED** (model-confidence valve → confirm): **OpenAPI 24/24**, dual
      conformance unaffected (FE 31/31 + BE 193/193 against the same contracts); **no FE diff**;
      DuckDB rows/preview engine untouched.
+ [ ] **The ad-hoc schema logic is retired** into the baseline — future schema changes are
      **new Alembic revisions**, never `_SCHEMA` edits.
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
+ **Invariant:** behaviour-preserving — the schema's *shape* is byte-for-byte unchanged; only
  its create/evolve mechanism changes. No contract, no FE, no DuckDB-engine change.

## Check

+ [ ] **J-0, J-1, J-2 ratified** (Plan gate); **J-3, J-4 held open** → Design gate.
+ [ ] _Design gate — pending._
+ [ ] _Backend gate — pending._
+ [ ] _Gates green (plan:lint / markdown-check-link / markdownlint / gate-walker /
      flow-selector) — pending._
+ [ ] **Human sign-off** — fresh + existing seeded DBs both come up on Alembic with data
      intact; `pnpm dev:seed` works; pytest 193/193 (Complete = signed-off, not gates-green).

## Act

_Pending — filled at round close._ The intended outcome: the backend evolves its schema
through **versioned Alembic migrations** instead of hand edits, with SQLModel models as the
schema of record — the foundation every subsequent feature theme (canvas, workflow,
consumer-save, dashboard) rides, each shipping its schema as its own migration. The raw-SQL →
ORM data-access port and all schema *changes* are consciously deferred (this round changes the
*mechanism*, not the *model*).

## Feeds into → the feature themes, each carrying its own migrations

With migrations in place, the roadmap resumes on the feature side — **canvas for the builder**
(its proper round, not MVP-rushed), then **(maybe) workflow / complex query**, **save data for
the consumer**, and **dashboard** — each now shipping schema changes as Alembic revisions. The
**raw-SQL → ORM data-access port** proceeds incrementally as those rounds touch each router;
the **`datasetId → sourceId` rename cleanup** becomes a clean migration. Standing triggers
(composite keys, self-joins, cross-workspace joins, `is_empty` predicates) remain deferred.
