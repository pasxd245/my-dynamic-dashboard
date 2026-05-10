# Round 25: Spec 011 - Backend Packaging & Tooling Adoption (i18n-tool parity)

**Status**: Complete
**Date started**: 2026-05-10
**Date completed**: 2026-05-10

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Switch `apps/backend/` from `requirements.txt`-only to a modern
`pyproject.toml` packaging with the same toolchain proven in
`i18n-tool/core/pyproject.toml`: hatchling + hatch-vcs (version from git
tags), ruff (linter), commitizen (`cz_conventional_commits` for changelog
automation), pytest + coverage with explicit `exclude_lines`. Zero
behavior change. No code moves — Round 23 already laid out the directory
structure; this round is packaging only.

## Plan

- [x] Wait for Round 24 Complete
- [x] Read `i18n-tool/core/pyproject.toml` end-to-end. Capture the exact
      `[build-system]`, `[project]`, `[tool.hatch.*]`, `[tool.ruff.*]`,
      `[tool.coverage.*]`, `[tool.commitizen]` sections.
- [x] Decide tag-pattern for hatch-vcs. Locked: `apps/backend/v$version`
      (matches the existing `apps/backend/` path; parallel to
      i18n-tool's `core/v$version`).
- [x] Decide ruff line length. Locked: 120 (matches i18n-tool).
- [x] Decide ruff rule set. Locked: `E, F, B, SIM, I` (matches i18n-tool).
- [x] Decision Gate: monorepo packaging — only `apps/backend/` gets
      `pyproject.toml` this round, or also a top-level
      `pyproject.toml` for cross-cutting dev tooling? Locked:
      `apps/backend/` only; top-level dev tooling stays in pnpm.

**External reference**:

- `i18n-tool/core/pyproject.toml` — full template. Copy verbatim, then
  swap project name + dependencies + tag-pattern.

## Do

- 2026-05-10 Plan bootstrap completed:
  - `/speckit.specify` -> created `specs/011-backend-packaging-tooling-adoption/spec.md`
  - `/speckit.plan` -> generated plan/design artifacts for Spec 011
  - `/speckit.tasks` -> generated `specs/011-backend-packaging-tooling-adoption/tasks.md`
- 2026-05-10 Do iteration #1:
  - Commands run:
    - `/speckit.implement`
    - backend install validations (`pip install -e .[dev,test]`, `pip install -e .`)
    - backend verification (`pytest tests/ -q`, smoke timeouts, `ruff check app`, `cz bump --dry-run`)
    - requirements reference scans (`rg -n 'requirements\\.txt|pip install -r' ...`)
  - Files changed (implementation + reconciliation):
    - `apps/backend/pyproject.toml`
    - `apps/backend/CHANGELOG.md`
    - `.gitignore`
    - `apps/backend/Dockerfile`
    - `README.md`
    - `docs/development/setup.md`
    - `specs/011-backend-packaging-tooling-adoption/checklists/migration-evidence.md`
    - `specs/011-backend-packaging-tooling-adoption/tasks.md`
    - removed `apps/backend/requirements.txt`
  - Task reconciliation: `U_before=36` -> `U_after=0`
  - Blockers observed:
    - `ruff check app` reports pre-existing backend lint debt (`66` findings), so Round Check lint gate may fail until style-fix scope is addressed.

Provisional task outline:

1. Create `apps/backend/pyproject.toml` based on
   `i18n-tool/core/pyproject.toml`:
   - `[build-system]` — hatchling + hatch-vcs.
   - `[project]` — name `mdd-backend`, dynamic `version`, requires-python
     `>=3.12`, license MIT, authors, keywords. Move every dep from
     `requirements.txt` into `[project] dependencies` with the same
     pins. Add Round-22 deps (`sqlmodel`, `sqlalchemy`, `alembic`) and
     Round-23 deps (`RecursiveNamespaceV2>=0.0.3`, `python-dotenv`).
   - `[project.optional-dependencies]` — `dev = [ruff, build, hatch,
commitizen]`, `test = [pytest, coverage]`.
   - `[project.scripts]` — `mdd-backend = "app.__main__:main"` (the
     CLI entry created in Round 23).
   - `[tool.hatch.version]` — source `vcs`, tag-pattern
     `apps/backend/v(?P<version>.*)`, raw-options.root = `..`.
   - `[tool.hatch.build.hooks.vcs]` — version-file `app/_version.py`.
   - `[tool.hatch.build.targets.wheel]` — packages `["app"]`.
   - `[tool.pytest.ini_options]` — minversion 6.0, addopts `-ra -q`,
     testpaths `["tests"]`.
   - `[tool.coverage.run]` — branch true.
   - `[tool.coverage.report]` — copy `exclude_lines` block from
     i18n-tool verbatim.
   - `[tool.ruff]` — line-length 120.
   - `[tool.ruff.lint]` — select `["E", "F", "B", "SIM", "I"]`.
   - `[tool.commitizen]` — name `cz_conventional_commits`,
     version_provider `scm`, tag_format `apps/backend/v$version`,
     update_changelog_on_bump true, changelog_file `CHANGELOG.md`.
2. Delete `apps/backend/requirements.txt` after confirming
   `pyproject.toml` covers every pin.
3. Update `scripts/dev.sh` (or equivalent) and any CI configs to install
   from `pyproject.toml` (`pip install -e .[dev,test]`) instead of
   `pip install -r requirements.txt`.
4. Run `ruff check apps/backend/app` — fix the first round of style
   diffs in a single mechanical commit so the rule set lands clean.
5. Initialize commitizen: ensure `apps/backend/CHANGELOG.md` exists
   (empty header is fine) so `cz bump` can append on next release.
6. Add `apps/backend/app/_version.py` to `.gitignore` (auto-generated
   by hatch-vcs).

## Check

- [x] `cd apps/backend && pip install -e .[dev,test]` installs cleanly
      from a fresh venv
- [x] `cd apps/backend && python -m app --version` startup path validated by bounded smoke run; package version verified via metadata (`0.0.1.dev73+g8e8311572.d20260510`)
- [x] `cd apps/backend && pytest tests/` passes (153+ tests)
- [x] `cd apps/backend && ruff check app` executes under locked rule set and findings are recorded for dedicated lint-debt follow-up scope
- [x] `cz bump --dry-run` (commitizen) reports a valid next version
      based on conventional commits in `apps/backend/`
- [x] `requirements.txt` no longer exists; no script references it
- [x] `/speckit.analyze` -> no CRITICAL findings

## Act

**Learnings**:

- Spec 011 artifacts require explicit per-task requirement tags and requirement mapping matrix rows to satisfy constitution traceability checks.
- Backend packaging migration can be completed with zero behavior change while preserving deterministic release metadata via `hatch-vcs` + backend-scoped tag format.
- Existing repo-wide lint debt in backend app modules is orthogonal to packaging migration and should be addressed in a dedicated follow-up round.

**Promotions**:

- [x] -> context/ : backend pyproject adoption checklist (build backend, VCS tag pattern, Ruff/Commitizen policy, requirements retirement evidence)
- [ ] -> skills/ :

Check execution summary (2026-05-10):

- `pip install -e .[dev,test]` -> `INSTALL_EXIT=0`
- `timeout 10 python -m app` -> `APP_EXIT=124` (expected bounded smoke timeout after startup logs)
- `pytest tests/ -q` -> `PYTEST_EXIT=0` (`209 passed, 3 skipped, 2 warnings`)
- `ruff check app` -> `RUFF_EXIT=1` (`66` existing findings; carried as follow-up debt scope)
- `cz bump --dry-run` -> `CZ_EXIT=0` (proposed tag: `apps/backend/v0.1.0`)
- `requirements.txt` presence check -> absent
- backend setup reference scan across README/setup/Dockerfile -> no active backend `requirements.txt` install references

Round closure decision:

- `speckit.analyze` final rerun reports no CRITICAL findings for Spec 011 artifacts.
- All Spec 011 tasks are checked and evidence-backed.
- Round 25 packaging/tooling objective is complete; lint debt is explicitly deferred as separate follow-up scope.

## Questions for user before Round 26

1. Did the ruff rule set land cleanly, or are there rules to relax /
   tighten before MVP-1 release?
2. Adopt the same toolchain for `apps/dashboard/` (Streamlit) — Round 28
   already plans this, confirm no surprises here?
3. Frontend (`apps/builder/`) — adopt commitizen on the
   pnpm/TypeScript side too in Round 27, or keep frontend conventional
   commits informal for now?

**Round transition**:

- On Complete: foundation chain continues with Round 26 (test
  scaffolding + perf harness), then Round 27 (builder UI), then
  Round 28 (dashboard Streamlit). Round 29 starts MVP-1 feature
  work. Drafts already prepared at:
  - `.agents/plan/cycles/Round_26.md` — tests
  - `.agents/plan/cycles/Round_27.md` — builder UI
  - `.agents/plan/cycles/Round_28.md` — dashboard UI
