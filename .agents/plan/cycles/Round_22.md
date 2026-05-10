# Round 22: Spec 008 - SQLModel + Alembic Persistence Foundation

**Status**: Planning
**Date started**: 2026-05-10
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Migrate persistence schema ownership from raw `CREATE TABLE` strings in
`apps/backend/app/core/metadata_db.py` to SQLModel declarative models with
Alembic-managed migrations. Zero behavior change. Pre-stage the
`column_mappings` table for future fuzzy rename detection. Service layer
stays on raw `sqlite3` this round — schema ownership only.

## Plan

- [ ] Confirm Spec 008 slug: `008-sqlmodel-persistence-foundation`
- [ ] Run `/speckit.specify` -> `/speckit.plan` -> `/speckit.tasks` for Spec 008
- [ ] Verify SQLModel + alembic versions are compatible with
      `fastapi==0.115.12` and the Pydantic v2 pulled by FastAPI
- [ ] Confirm Decision Gate A: Alembic baseline strategy (locked: per-model
      `op.create_table()` so the baseline regenerates from SQLModel metadata)
- [ ] Confirm Decision Gate B: existing-DB stamping (locked: auto-stamp at
      boot if `alembic_version` table is missing)
- [ ] Confirm implementation readiness: 26 tables enumerated against
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

- [ ] `cd apps/backend && pytest tests/` -> 153 passing, **zero changes**
      to test files. Test edits = red flag, Check fails.
- [ ] Baseline parity: rename existing `metadata.db` ->
      `metadata.legacy.db`, run `alembic upgrade head` on a clean file.
      `sqlite3 .schema | sort` diff between new and legacy must be empty
      (modulo `alembic_version` and `column_mappings`).
- [ ] Idempotent: `alembic upgrade head` -> `downgrade base` ->
      `upgrade head` runs clean.
- [ ] Auto-stamp path: app boots cleanly against a copy of an existing dev
      `metadata.db` lacking `alembic_version`.
- [ ] `/speckit.analyze` -> no CRITICAL findings.
- [ ] CRG rebuild -> `apps/backend/app/models/` is its own community with
      low outward coupling (foundation goal: persistence is a leaf).

## Act

(filled at round close)

**Learnings**:

- **Promotions**:

- [ ] -> context/ :
- [ ] -> skills/ :

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
