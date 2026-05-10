# Round 25: Spec 011 - Backend Packaging & Tooling Adoption (i18n-tool parity)

**Status**: Planning (drafted ahead of Round 24 close — review-only until Round 24 completes)
**Date started**:
**Date completed**:

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

- [ ] Wait for Round 24 Complete
- [ ] Read `i18n-tool/core/pyproject.toml` end-to-end. Capture the exact
      `[build-system]`, `[project]`, `[tool.hatch.*]`, `[tool.ruff.*]`,
      `[tool.coverage.*]`, `[tool.commitizen]` sections.
- [ ] Decide tag-pattern for hatch-vcs. Locked: `apps/backend/v$version`
      (matches the existing `apps/backend/` path; parallel to
      i18n-tool's `core/v$version`).
- [ ] Decide ruff line length. Locked: 120 (matches i18n-tool).
- [ ] Decide ruff rule set. Locked: `E, F, B, SIM, I` (matches i18n-tool).
- [ ] Decision Gate: monorepo packaging — only `apps/backend/` gets
      `pyproject.toml` this round, or also a top-level
      `pyproject.toml` for cross-cutting dev tooling? Locked:
      `apps/backend/` only; top-level dev tooling stays in pnpm.

**External reference**:

- `i18n-tool/core/pyproject.toml` — full template. Copy verbatim, then
  swap project name + dependencies + tag-pattern.

## Do

(filled by `/speckit.implement` + agent reconciliation)

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

- [ ] `cd apps/backend && pip install -e .[dev,test]` installs cleanly
      from a fresh venv
- [ ] `cd apps/backend && python -m app --version` prints the git-tag-
      derived version (or `0.0.0+local` on a tagless dev tree)
- [ ] `cd apps/backend && pytest tests/` passes (153+ tests)
- [ ] `cd apps/backend && ruff check app` returns zero issues after
      the style-fix commit
- [ ] `cz bump --dry-run` (commitizen) reports a valid next version
      based on conventional commits in `apps/backend/`
- [ ] `requirements.txt` no longer exists; no script references it
- [ ] `/speckit.analyze` -> no CRITICAL findings

## Act

(filled at round close)

**Learnings**:

- **Promotions**:

- [ ] -> context/ : "pyproject.toml + hatch-vcs + ruff + commitizen
      template lifted from i18n-tool" if it generalizes to other
      Python apps in the monorepo
- [ ] -> skills/ :

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
