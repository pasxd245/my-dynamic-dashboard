# Round 23: Spec 009 - Structural Audit & Directory Realignment

**Status**: Planning (drafted ahead of Round 22 close — review-only until Round 22 completes)
**Date started**:
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Bring `apps/backend/app/` into the **`core/` + `apps/` + `utils/`** layout
proven in `i18n-tool/core/src/i18n_tools/`, guided by CRG community +
bridge-node analysis. Adopt the i18n-tool config-manager pattern
(`AppConfig` singleton + `RecursiveNamespace` + layered
`.env < default.yaml < CONFIG_FILE` precedence + `Const`/`Fields` constant
classes). Zero behavior change. Delete the unused `init_metadata_db()`
function carried over from Round 22. Resolve the service-layer-rewrite
question carried from Round 22 Q1. Tooling adoption (pyproject.toml,
ruff, commitizen, hatch-vcs) is **OUT** — that's Round 25.

## Plan

- [ ] Wait for Round 22 Complete
- [ ] Read Round 22 Act notes + answers to its end-of-round questions
- [ ] Run `mcp__code-review-graph__build_or_update_graph_tool` on the
      post-Round-22 tree
- [ ] Run `list_communities_tool` + `get_bridge_nodes_tool` +
      `get_hub_nodes_tool` to identify coupling hot-spots
- [ ] Resolve Round 22 Q1 — service rewrite this round, or as Round 22b
- [ ] Resolve Round 22 Q2 — `schemas.py` consolidation in scope or not
- [ ] Capture target layout diff (current vs analysis/09 target) as a
      checklist of moves/renames committed to
      `specs/009-structural-audit-and-realignment/research.md`
- [ ] Confirm Decision Gate: drop `metadata_db.py` entirely (locked: drop
      after confirming no remaining imports)

**Decision Gates**:

- Gate A (Q1 — service rewrite scope): set when Round 22 closes.
- Gate B (Q2 — schemas.py consolidation): set when Round 22 closes.
- Gate C (`metadata_db.py` deletion): drop after `grep -r metadata_db
apps/backend/app/` returns nothing.
- Gate D (config-file location): `apps/backend/app/resources/default.yaml`
  vs. `apps/backend/config/default.yaml`. Locked: in-package
  (`app/resources/`) so it ships with the package and is import-time
  resolvable, matching `i18n-tool/core/src/i18n_tools/resources/default.yaml`.
- Gate E (`RecursiveNamespace` library): use `RecursiveNamespaceV2`
  (the dep i18n-tool uses, `>=0.0.3`) vs. roll our own thin wrapper.
  Locked: use the published lib for parity with i18n-tool.

**External references**:

- `i18n-tool/core/src/i18n_tools/shared.py` — `AppConfig` (singleton,
  lazy path resolution, typed accessors), `load_config(fp)` with
  `@lru_cache` and 3-layer precedence, `Const`/`Fields` classes.
- `i18n-tool/core/src/i18n_tools/utils/env_helper.py` — `EnvVar` helper
  (already lifted in Round 22; this round consolidates all callers).
- `i18n-tool/core/src/i18n_tools/resources/default.yaml` — shape of the
  shipped defaults (sections: `app.*`, `log.*`).
- `i18n-tool/core/src/i18n_tools/` — `core/` (framework primitives) +
  `apps/` (use-cases) + `utils/` (cross-cutting) split. Pattern target.

## Do

(filled by `/speckit.implement` + agent reconciliation)

Provisional task outline:

1. Commit CRG-driven audit report to
   `specs/009-structural-audit-and-realignment/research.md`. Lists every
   file expected to move, rename, or group, with the i18n-tool layout
   as the target reference.

2. **Establish target layout** (mirrors i18n-tool):

   ```
   apps/backend/app/
     __main__.py          # CLI / dev entry point (parity with i18n-tool)
     main.py              # FastAPI app factory
     shared.py            # AppConfig + load_config + Const + Fields + main_func
     resources/
       default.yaml       # shipped defaults
     api/                 # FastAPI routers (request/response only)
       upload.py, relationships.py, queries.py, saved_queries.py, dashboards.py
     apps/                # per-use-case orchestrators (loader + runner pairs)
       upload_app.py
       query_app.py
       export_app.py
     core/                # framework primitives — NO use-case knowledge
       base.py            # AppBase, ServiceBase
       enums.py
       errors.py          # ActionableError + envelope (already exists)
       db.py              # SQLModel engine/session (from Round 22)
       polars_processor.py
       duckdb_executor.py
       sql_translator.py
     models/              # SQLModel tables (from Round 22)
     services/            # business services (existing — reviewed)
     utils/               # cross-cutting — NO domain knowledge
       env_helper.py      # EnvVar (from Round 22)
       decorator.py
       logger.py
   ```

3. **Adopt the i18n-tool config manager**:
   - Create `apps/backend/app/shared.py` mirroring
     `i18n-tool/core/src/i18n_tools/shared.py`. Exposes:
     - `load_config(fp: Path | None)` with `@lru_cache`, 3-layer
       precedence (`.env < resources/default.yaml < CONFIG_FILE`).
     - `Const` class — string/numeric literals (replace magic strings
       across the codebase).
     - `Fields` class — dotted-key constants
       (`Fields.METADATA_DB_PATH = "env.metadata_db_path"`,
       `Fields.LOG_LEVEL = "log.level"`, …).
     - `AppConfig(home_dir=None)` `@simple_singleton` with typed
       accessors (`metadata_db_path()`, `parquet_dir()`,
       `workspace_storage_dir()`, …) — paths materialized + validated
       lazily.
   - Create `apps/backend/app/resources/default.yaml` with sections
     `app`, `log`, `storage`, `query`, `upload`, `workspace`. Move all
     hard-coded defaults scattered in services into this file.
   - Add `RecursiveNamespaceV2>=0.0.3` to deps (matches i18n-tool).

4. **Replace scattered `os.getenv()` calls**: every service/route reads
   config through `AppConfig` accessors or `EnvVar.get_*` helpers.
   Run `grep -rn "os.getenv\|os.environ" apps/backend/app/` — must
   return zero hits after this round.

5. **Apply directory moves** per the layout in (2). Frontend
   (`apps/builder/src/`) untouched this round — frontend layout is its
   own round candidate. Document the deferral in research.md.

6. **Rename services** where names diverge from the layout vocabulary.
   Mapping committed to `docs/agents/round-23-service-rename-map.md`.

7. **Delete unused `init_metadata_db()`** and any other Round-22
   carry-over shims after `grep -r metadata_db apps/backend/app/`
   returns nothing.

8. (If Q1 = absorb) — convert services from raw `conn.execute()` to
   `Session(...)` calls one file at a time. Public function signatures
   preserved; only internals change. Order: low-risk leaves first
   (`audit_service.py`, `manifest_service.py`), high-traffic last
   (`query_service.py`, `dashboard_service.py`).

9. Update all imports; run tests after each batch of moves.

## Check

- [ ] All 153+ backend tests pass (mechanical import-path updates only;
      no semantic test changes)
- [ ] CRG `list_communities_tool` shows tighter, name-aligned communities
      vs. baseline; cross-community edge count does not increase
- [ ] No file imports from deleted shims:
      `grep -r metadata_db apps/backend/app/` returns nothing
- [ ] No bare env reads:
      `grep -rn "os.getenv\|os.environ" apps/backend/app/` returns nothing
- [ ] `AppConfig` singleton boots cleanly with no `.env`, with `.env`
      only, with `.env` + `CONFIG_FILE`; precedence verified by a unit
      test
- [ ] Layout side-by-side with `i18n-tool/core/src/i18n_tools/`:
      `core/` / `apps/` / `utils/` split is preserved, no domain code
      leaks into `core/` or `utils/`
- [ ] `/speckit.analyze` -> no CRITICAL findings

## Act

(filled at round close)

**Learnings**:

- **Promotions**:

- [ ] -> context/ :
- [ ] -> skills/ :

## Questions for user before Round 24

1. Did the structural reshape surface any abstraction that should change
   shape (e.g. fold two services into one)?
2. Confirm Round 24 still targets `Source/Provider` abstraction, given
   what Round 23 surfaced?
3. Frontend (`apps/builder/src/`) layout audit — its own round, or fold
   into Round 25 / 26?
4. Did `RecursiveNamespaceV2` work out, or do we want a thinner wrapper?

**Round transition**:

- On Complete: brainstorm Round 24 scope using answers above. Round 24
  draft already prepared at `.agents/plan/cycles/Round_24.md`.
  Round 25 (tooling: pyproject.toml + ruff + commitizen + hatch-vcs)
  draft prepared at `.agents/plan/cycles/Round_25.md`.
