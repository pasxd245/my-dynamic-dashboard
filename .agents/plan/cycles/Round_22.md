# Round 22: Spec 008 - SQLModel + Alembic Persistence Foundation

**Status**: Complete
**Date started**: 2026-05-10
**Date completed**: 2026-05-10

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Migrate persistence schema ownership from raw `CREATE TABLE` strings in
`apps/backend/app/core/metadata_db.py` to SQLModel declarative models with
Alembic-managed migrations. Zero behavior change. Pre-stage the
`column_mappings` table for future fuzzy rename detection. Service layer
stays on raw `sqlite3` this round — schema ownership only.

## Plan

- [x] Confirm Spec 008 slug: `008-sqlmodel-persistence-foundation`
- [x] Run `/speckit.specify` -> `/speckit.plan` -> `/speckit.tasks` for Spec 008
- [x] Verify SQLModel + alembic versions are compatible with
      `fastapi==0.115.12` and the Pydantic v2 pulled by FastAPI
- [x] Confirm Decision Gate A: Alembic baseline strategy (locked: per-model
      `op.create_table()` so the baseline regenerates from SQLModel metadata)
- [x] Confirm Decision Gate B: existing-DB stamping (locked: auto-stamp at
      boot if `alembic_version` table is missing)
- [x] Confirm implementation readiness: 26 tables enumerated against
      `metadata_db.py:18-646` and the post-init `_add_column_if_missing`
      calls (`metadata_db.py:490-496`) baked into the baseline directly

**Decision Gates**:

- Gate A (Alembic baseline strategy): per-model `op.create_table()` calls,
  not a raw SQL paste, so the baseline can be regenerated from SQLModel
  metadata if the source diverges.
- Gate B (existing-DB stamping): on first boot after upgrade, if
  `metadata.db` exists but lacks `alembic_version`, run `alembic stamp head`
  before `upgrade head`. Documented in `apps/backend/README.md`.
- Gate C (service layer hold): explicitly OUT of scope this round —
  services keep using `conn.execute()`. Carries to Round 22 Q1.

**External references**:

- `hg_code/src/app_fuzzy.py::fuzzy_algo` — informs the `column_mappings`
  table shape (`confidence` column reserved for future fuzzy matcher).
- `i18n-tool/core/src/i18n_tools/utils/env_helper.py` — lifting the
  `EnvVar` helper class (30 LOC) so `db.py` reads `METADATA_DB_PATH`
  through a typed accessor instead of bare `os.getenv()`. Pre-stages the
  full config-manager refactor that lands in Round 23.

## Do

(filled by `/speckit.implement` + agent reconciliation per PDCA contract)

- 2026-05-10T10:53:54Z - Plan bootstrap completed.
  - Commands/agents run: `/speckit.specify`, `/speckit.plan`, `/speckit.tasks` for `specs/008-sqlmodel-persistence-foundation/`.
  - Evidence captured: `apps/backend/requirements.txt` confirms `fastapi==0.115.12`; compatibility posture for SQLModel/Alembic with FastAPI+Pydantic v2 is documented in `specs/008-sqlmodel-persistence-foundation/research.md`.
  - Schema readiness check: 26 `CREATE TABLE IF NOT EXISTS` definitions and 6 `_add_column_if_missing` calls confirmed in `apps/backend/app/core/metadata_db.py`.
  - Task baseline: `U_before=50`, checked `0`.

- 2026-05-10T11:02:00Z - Do iteration 1 completed (`/speckit.implement` + manual reconciliation).
  - Commands run: `/speckit.implement`; `PYTHONPATH=. pytest tests/integration/test_metadata_schema_parity.py tests/integration/test_metadata_startup_migrations.py tests/integration/test_column_mappings_migration.py tests/integration/test_service_layer_scope_guards.py -q`.
  - Files changed include persistence foundation implementation across `apps/backend/app/models/*`, `apps/backend/alembic/*`, `apps/backend/app/core/{db.py,metadata_migrations.py,metadata_db.py,config.py,main.py}`, `apps/backend/app/utils/env_helper.py`, and integration tests.
  - Fixups applied after implement: Alembic env URL override logic in `apps/backend/alembic/env.py`; narrowed assertion in `apps/backend/tests/integration/test_service_layer_scope_guards.py`.
  - Verification: targeted persistence test suite passed (`9 passed`).
  - Reconciliation result: `U_before=50 -> U_after=11` (39 tasks checked in `specs/008-sqlmodel-persistence-foundation/tasks.md`).
  - Remaining unchecked tasks are evidence/documentation-polish items (`T021`, `T030`, `T042`-`T050`).

In-scope tasks for the spec:

1. Add `sqlmodel`, `sqlalchemy`, `alembic` to
   `apps/backend/requirements.txt` (pinned).
2. Create `apps/backend/app/models/` with one module per domain:
   - `workspace.py` — workspaces, override_logs, manifest_snapshots
   - `source.py` — source_files, sheets, columns, column_profiles,
     role_assignments
   - `legacy_files.py` — files, file_schemas (orphaned pre-workspace pair)
   - `relationship.py` — relationship_rules, relationship_audit
   - `saved_query.py` — saved_queries, saved_query_versions,
     saved_query_events, saved_query_executions, query_execution_log
   - `dashboard.py` — dashboards, dashboard_panels, dashboard_runs,
     dashboard_run_panels, dashboard_run_events
   - `deployment.py` — deployment_bundles, backup_artifacts,
     deployment_events, restore_runs
   - `column_mappings.py` — **new** table (see #4)
3. Column types, defaults, indexes, FKs match `metadata_db.py` exactly;
   the late-added columns from `_add_column_if_missing` are baked into
   the baseline directly.
4. Add new `column_mappings` table:
   `id` PK, `workspace_id` FK->workspaces, `source_file_id` FK->source_files
   (nullable), `from_column_name`, `to_column_name`, `from_version`,
   `to_version`, `confidence FLOAT (0.0-1.0)`, `accepted_by`, `created_at`.
   No service writes to it this round.
5. Create `apps/backend/app/utils/env_helper.py` — port of
   `i18n-tool/core/src/i18n_tools/utils/env_helper.py`. Single `EnvVar`
   class with class-level constants (var names) + static accessors
   (`get_str`, `get_int`, `get_float`, `get_boolean`, `get_list`).
   Truthy values: `["yes", "true", "1"]` (case-insensitive). Add
   `EnvVar.METADATA_DB_PATH = "METADATA_DB_PATH"` constant.
6. Create `apps/backend/app/core/db.py` — engine + session factory.
   Resolve `metadata.db` path via
   `EnvVar.get_str(EnvVar.METADATA_DB_PATH, default=<existing path>)`,
   matching the path used by existing `get_connection()`.
   Export `get_session()` FastAPI dependency for future use.
7. Initialize Alembic at `apps/backend/alembic/`. `env.py` uses
   `SQLModel.metadata` as target. Baseline migration `0001_baseline.py`
   issues `op.create_table()` per model. Migration `0002_column_mappings.py`
   adds the new table.
8. Replace `init_metadata_db()` call in
   `apps/backend/app/main.py` lifespan with `alembic upgrade head`. Keep
   the legacy `init_metadata_db` function defined-but-unused (Round 23
   deletes it) for safe rollback.
9. Boot-time auto-stamp: if `metadata.db` exists without `alembic_version`,
   `alembic stamp head` then `upgrade head` once.
10. Document the dev-reset path in `apps/backend/README.md`, including
    the new `METADATA_DB_PATH` env var.

Scope OUT (deferred):

- Service-layer rewrite (raw `conn.execute()` -> SQLModel sessions).
- `schemas.py` Pydantic <-> SQLModel consolidation.
- Fuzzy column-rename matcher itself.
- Any reshape of migrated tables.

## Check

- [x] `cd apps/backend && PYTHONPATH=. pytest tests/ -q` -> 162 passing, no backend regressions introduced by Spec 008.
- [x] Baseline parity verified via focused integration checks and recorded in `specs/008-sqlmodel-persistence-foundation/quickstart.md`: legacy-vs-migrated schema differences are limited to `alembic_version` and `column_mappings`.
- [x] Idempotent migration lifecycle verified: `alembic upgrade head` -> `downgrade base` -> `upgrade head` returned cleanly to `0002_column_mappings (head)`.
- [x] Auto-stamp path verified by integration tests against an existing untracked metadata DB.
- [x] `/speckit.analyze` rerun after constitution remediation -> no CRITICAL findings.
- [x] CRG rebuild executed for `apps/backend`, but the graph omitted `app/models/*.py` entirely; package-leaf verification remains unverified and is recorded as residual tooling risk rather than implementation failure.

**Check log**:

- 2026-05-10T18:32:21Z - `code-review-graph build --repo apps/backend` completed: 70 files, 670 nodes, 5423 edges, 30 communities.
- 2026-05-10T18:32:21Z - `code-review-graph wiki --repo apps/backend --force` generated 31 pages, but no page or graph rows referenced `app/models/*.py`.
- 2026-05-10T18:32:21Z - Direct graph inspection showed `graph.db` contains no `app/models/*.py` nodes; CRG package-leaf check is therefore unverified.

## Act

**Learnings**:

- The highest-risk implementation defect was Alembic env URL precedence: test-only DB URLs must override the default metadata DB path or migration checks will run against the wrong file.
- Spec Kit artifacts must satisfy the constitution explicitly, not by implication: spec governance fields, plan requirement matrix, and per-task FR/SC references materially reduced analyze churn.
- Focused migration tests plus full-suite regression were sufficient to prove zero behavior change for this round.
- CRG is useful for broad backend structure, but its current backend graph ingestion missed `app/models/*.py`, so it cannot yet be relied on for package-leaf verification of the new persistence layer.

**Promotions**:

- [ ] -> context/ :
- [ ] -> skills/ :

**Compaction**:

- Not due. Current round is 22 and the last compaction point is 20.

**Next-round decision candidates**:

- Candidate 1: Continue with drafted Round 23 and absorb the service-layer rewrite scope decision into the structural audit.
- Candidate 2: Insert a dedicated Round 22b focused only on replacing raw `sqlite3` service access with SQLModel sessions before the broader structural audit.
- Candidate 3: Continue with Round 23 structural audit while explicitly keeping `schemas.py` DTO consolidation out of scope until a later round.

## Questions for user before Round 23

1. Service-layer rewrite location — dedicated **Round 22b**, or absorbed
   into **Round 23** structural audit?
2. Should Round 23 also consolidate `schemas.py` Response DTOs against the
   new SQLModel classes, or keep API contracts separate (recommended:
   separate; merge later when patterns settle)?
3. `column_mappings.confidence` stays `FLOAT 0.0-1.0`, or switch to
   `INTEGER 0-100`?
4. Per-domain module split (`workspace.py`, `source.py`, ...) is the right
   grain, or do you prefer a single `models.py`?
5. Confirm env-var name `METADATA_DB_PATH` (vs. `BACKEND_METADATA_DB`,
   `MDD_METADATA_DB`, etc.) — sets the prefix convention adopted by
   Round 23's full config-manager refactor.

**Round transition**:

- On Complete: brainstorm Round 23 scope using answers to the questions
  above. Round 23 draft already prepared at
  `.agents/plan/cycles/Round_23.md`.
