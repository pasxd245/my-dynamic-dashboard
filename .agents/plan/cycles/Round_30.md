# Round 30: Project Configuration Enhancement — RecursiveNamespaceV2 Adoption

**Status**: Complete
**Date started**: 2026-05-11
**Date completed**: 2026-05-11

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Round type**: Remediation (Decision Gate A from Round 29 — Dim 6
> pattern-adherence failure #1). First of three sequential rounds
> (R30 → R31 → R32) that close the foundation chain's pattern gaps
> and the analysis/09 demo loop before MVP-1 feature work resumes.

## Goal

Adopt `RecursiveNamespaceV2>=0.0.3` for real across `apps/backend`
and `apps/dashboard`. The dependency was declared in Round 23 (spec
009 FR-007) but never imported — current `AppConfig` is a flat
`@dataclass(frozen=True)` wrapping a `dict[str, Any]`, which is
neither the reference pattern nor a wrapper of the library. The
original intent — confirmed with the user 2026-05-11 — was to
_wrap the library_, mirroring i18n-tool's
`self.cfg: RecursiveNamespace` shape
(`tmp/apps/i18n-tool/core/src/i18n_tools/shared.py:76-122`).

This round restores the reference pattern, restructures YAML to
nested keys, migrates call sites, updates tests, and realigns the
specs that currently mis-describe the implementation. **Zero new
features.**

## Plan

- [x] Wait for Round 29 Complete
- [x] Confirm Round 29 evaluation findings are merged into
      `Round_29.md` Check section (specifically the Dim-6 Gate-A
      finding and the locked R30-R32 sequence)
- [x] Lock target `AppConfig` shape (see "Reference pattern" below)
- [x] Decision Gate A: dotted-key migration strategy — - Option 1 (full): convert all `Fields.*` constants to dotted
      keys (`"backend.host"`, `"metadata.db_path"`, ...) and
      restructure `default.yaml` to fully nested. - Option 2 (lean): keep flat keys in YAML; use
      `RecursiveNamespace` only for the _behavior_
      (`get_or_else`, attribute traversal), not the schema. - Resolved 2026-05-11: **Option 1**. - Recommended: **Option 1** — half-adopting the library
      defeats the purpose. i18n-tool uses fully nested
      (`"app.name"`, `"log.level"`); match that.
- [x] Decision Gate B: dashboard shared-py extraction trigger —
      Round 28 explicitly deferred `packages/shared-py/` (Gate A
      there). Round 30 doubles the copy/paste surface
      (backend+dashboard both wrap the library). Re-evaluate
      whether to extract NOW, or accept one more round of
      duplication. - Resolved 2026-05-11: defer again for this round. - Recommended: **defer again**. Extraction is a monorepo
      tooling concern (uv workspaces, dual-install in CI);
      wait for a third Python app or for a real pain signal.

## Reference pattern (i18n-tool)

`tmp/apps/i18n-tool/core/src/i18n_tools/shared.py`:

- Module-level `load_config(fp)` decorated with `@lru_cache` and
  `@rns.rns()` — returns a `RecursiveNamespace` directly from
  merged YAML/env dicts.
- `AppConfig` decorated with `@simple_singleton`, holds
  `self.cfg: RecursiveNamespace`, exposes `.get(key, default)`
  that delegates to `self.cfg.get_or_else(key, or_else=default)`.
- `Fields.*` constants use dotted keys (e.g.
  `APP_NAME = "app.name"`, `LOG_LEVEL = "log.level"`).
- Precedence: `.env` < default `config.yaml` < custom config (if
  provided).

## Do

(filled by `/speckit.implement` + agent reconciliation)

- 2026-05-11 Plan transition:
  - Decision Gate A resolved to full dotted-key migration.
  - Decision Gate B resolved to defer shared-py extraction again for this round.
  - Status flipped from `Planning` to `In Progress`.
- 2026-05-11 implementation pass:
  - Backend `apps/backend/app/shared.py` now imports and wraps `RecursiveNamespace`, uses dotted `Fields`, resolves nested YAML, and preserves the public `AppConfig.get/get_str/get_int/get_path` surface.
  - Backend defaults migrated to nested YAML in `apps/backend/app/resources/default.yaml`.
  - Added backend focused tests in `apps/backend/tests/unit/test_shared_config_namespace.py` and `apps/backend/tests/contract/test_app_config_contract.py`; updated `apps/backend/tests/integration/test_config_precedence.py` for dotted-key precedence.
  - Dashboard `apps/dashboard/src/dashboard/shared.py` now wraps `RecursiveNamespace` while preserving existing attribute-style config accessors used by Streamlit and the API client.
  - Dashboard defaults migrated to nested YAML in `apps/dashboard/src/dashboard/resources/default.yaml`.
  - Updated `apps/dashboard/tests/unit/test_app_config.py` for dotted-key access and namespace traversal; added `RecursiveNamespaceV2>=0.0.3` to `apps/dashboard/pyproject.toml`.
- 2026-05-11 focused validation:
  - Backend: `pytest tests/integration/test_config_precedence.py tests/unit/test_shared_config_namespace.py tests/contract/test_app_config_contract.py -q` -> `9 passed` in `apps/backend/.venv-feature011-runtime`.
  - Dashboard: `PYTHONPATH=apps/dashboard/src pytest apps/dashboard/tests/unit/test_app_config.py -q` -> `3 passed` using the same runtime env.
  - Spec evidence updated in `specs/009-structural-audit-and-realignment/spec.md` and `specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md`.

### Backend scope

- Rewrite `apps/backend/app/shared.py:32-131`:
  - Replace `@dataclass(frozen=True) AppConfig(values: dict)` with
    a singleton class holding `self.cfg: RecursiveNamespace`.
  - Module-level `load_config(fp: Path | None = None) ->
RecursiveNamespace` with `@lru_cache` + `@rns.rns()`
    decorators, mirroring i18n-tool's precedence
    (packaged `default.yaml` < `CONFIG_FILE` yaml < env vars).
  - `AppConfig.get(key, default=None, show_log=False)` delegates
    to `self.cfg.get_or_else(...)`.
  - Keep convenience accessors (`get_path`, `get_int`, `get_str`)
    as thin wrappers over `get(...)`.
- Convert `Fields.*` to dotted keys
  (`apps/backend/app/shared.py:36-47`):
  - `METADATA_DB_PATH` → `"metadata.db_path"`
  - `BACKEND_HOST` → `"backend.host"`, etc.
- Restructure `apps/backend/app/resources/default.yaml` to fully
  nested keys matching the new `Fields`.
- Keep `_ENV_OVERRIDES` mapping (it's the precedence override
  contract), but ensure values flow through the namespace.

### Dashboard scope

- Mirror in `apps/dashboard/src/dashboard/shared.py:15-116`.
  Current implementation is `DashboardAppConfig.from_sources()` —
  refactor to the same singleton + RecursiveNamespace shape.
- Restructure `apps/dashboard/src/dashboard/resources/default.yaml`
  (if present; create otherwise).

### Call-site migration

- Backend: any reader using flat keys from `_ENV_OVERRIDES`
  (`apps/backend/app/shared.py:17-29`) — should keep working since
  we keep the `.get(key, default)` API; only the keys change from
  flat to dotted.
- Dashboard call sites:
  - `apps/dashboard/streamlit_app.py`
  - `apps/dashboard/src/dashboard/__init__.py`
  - `apps/dashboard/src/dashboard/api/backend_client.py`
  - `apps/dashboard/src/dashboard/components/export_controls.py`
  - `apps/dashboard/src/dashboard/components/query_panel.py`
  - `apps/dashboard/src/dashboard/components/parameter_panel.py`

### Tests

- Update `apps/dashboard/tests/unit/test_app_config.py` to assert
  dotted-key access and `RecursiveNamespace` attribute traversal.
- Add a backend unit test verifying `from recursivenamespace import
RecursiveNamespace` is the underlying type and that precedence
  still resolves correctly.
- Add a contract test in
  `apps/backend/tests/contract/` covering the
  `AppConfig.get(key, default)` API surface.

### Spec realignment

- Update FR-007 in
  `specs/009-structural-audit-and-realignment/spec.md:152` to
  accurately describe the wrap-the-library approach (not the
  prior "thin wrapper" misinterpretation).
- Update the deps section of
  `specs/011-backend-packaging-tooling-adoption/plan.md:13` if
  the version pin changes.
- Update
  `specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md`
  to reflect that `from recursivenamespace import RecursiveNamespace`
  now appears in code.

## Check

- [x] `grep -rn "from recursivenamespace" apps/` returns ≥1 hit
      in **each** of `apps/backend/` and `apps/dashboard/`
- [x] Backend `AppConfig.get("metadata.db_path")` and dashboard
      namespace access (`cfg.api.base_url`) resolve expected values
      in focused tests
- [x] Both app `pyproject.toml` package builds still complete cleanly
- [x] `pytest apps/backend apps/dashboard` green
- [x] Spec FR-007 text matches the implementation (no drift)
- [x] `/speckit.analyze` → N/A for this remediation round (no Round-30 spec bundle)

## Act

(filled at round close)

**Learnings**:

- Attribute traversal now exists in both Python apps, but most production call sites still rely on stable accessor methods. That made the migration low-risk while restoring the intended library-backed shape.
- Deferring shared-py extraction remained the right call for this round. The duplication stayed confined to two small config modules and did not justify introducing new monorepo packaging complexity mid-remediation.
- The dotted-key migration exposed one practical constraint: cross-app verification must run backend and dashboard pytest suites separately because both use `integration/` test package names and collide during combined collection.

**Promotions**:

- [ ] -> context/ : `recursivenamespace_pattern.md` (anchor for
      future rounds that touch config)
- [ ] -> skills/ :

**Next-round decision**:

- Proceed to Round 31 as already locked in Round 29: complete the UI-driven source abstraction with concrete `ExcelSource` / `CSVSource` implementations and upload-path dispatch through `SourceRegistry`.
- Keep shared-py extraction deferred unless Round 31 materially expands cross-app config duplication.

## Questions for user before Round 31

1. Did the dotted-key restructure feel right, or do we want a
   different schema (e.g. only nest one level deep)?
   **Answer (2026-05-11)**: It's good. No change required.
2. Did the shared-py extraction pain hit hard enough to bump
   `packages/shared-py/` to Round 31, or stay deferred until
   pain demands it?
   **Answer (2026-05-11)**: Stay deferred. No change.
3. Should the `CONFIG_FILE` env var be renamed to something
   prefixed (e.g. `MDD_CONFIG_FILE`) to avoid collisions with
   other tools' env-var conventions?
   **Answer (2026-05-11)**: Yes — rename to `MDD_CONFIG_FILE`. Implemented in Round 31 Plan.

**Round transition**:

- On Complete: Round 31 begins — **Source Abstraction Completion
  (UI-driven)**. Per Round 29 reframe (2026-05-11): the brainstorm
  starts from upload UX (source-type picker, multi-sheet picker,
  per-source error UI, progress feedback, re-upload flow), then
  back-designs the `Source` ABC + `SourceRegistry` shape to fit,
  then implements `ExcelSource` / `CSVSource` and refactors
  `apps/backend/app/api/upload.py` to dispatch via
  `SourceRegistry.for_type(...)`. Acceptance is **UI-visible**:
  user uploads .xlsx via UI → sheet picker → progress → workspace;
  same for .csv. Registry coverage is a side effect, not the
  headline. Round 31 closes Gate-A #2 from Round 29.
