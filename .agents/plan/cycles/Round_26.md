# Round 26: Spec 012 - Test Scaffolding & MVP-1 Performance Harness

**Status**: Planning (drafted ahead of Round 25 close — review-only until Round 25 completes)
**Date started**:
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Pay test-infrastructure debt before MVP-1 feature rounds pile on more
tests against ad-hoc patterns. Formalize the unit/integration/contract
split, introduce a fixture/factory pattern, and establish the
performance-benchmark harness that gates MVP-1 success criteria from
`docs/analysis/09-mvp-plan.md` (upload 100k rows, query <5s, export
without crash). Zero behavior change in production code.

## Plan

- [ ] Wait for Round 25 Complete
- [ ] Audit current `apps/backend/tests/`: count tests by directory, by
      pattern, by import surface. Identify ad-hoc fixtures duplicated
      across files (Round 21 already pulled some into
      `apps/backend/tests/conftest.py` — confirm coverage).
- [ ] Decide test-layer vocabulary. Locked: three layers —
      `tests/unit/` (pure functions, no I/O),
      `tests/integration/` (in-process, real DB + FS),
      `tests/contract/` (HTTP request/response shape per spec).
- [ ] Decide factory library. Locked: hand-rolled factories under
      `tests/factories/` (one module per domain). Avoids `factory-boy`
      dep; simple `make_workspace(...)`, `make_source(...)` helpers.
- [ ] Decide perf-harness home. Locked: `apps/backend/tests/perf/`
      with `pytest-benchmark` (added to `[project.optional-dependencies]
    test` in Round 25's pyproject.toml).

**Decision Gates**:

- Gate A (test-layer vocabulary): unit / integration / contract.
- Gate B (factory pattern): hand-rolled, not a dep.
- Gate C (perf harness): `pytest-benchmark` under `tests/perf/`.
- Gate D (perf SLOs from analysis/09): upload 100k rows < 30s,
  preview query < 5s, full query export < 30s on dev hardware
  (WSL2). Confirm with user.

## Do

(filled by `/speckit.implement` + agent reconciliation)

Provisional task outline:

1. Reorganize `apps/backend/tests/` into the three-layer split:
   - Move existing `tests/contract/*` (already exists per Spec 007).
   - Move existing `tests/integration/*` as-is.
   - Create `tests/unit/` and migrate truly unit-level tests
     (pure-function tests scattered in integration today).
2. Create `tests/factories/` with one module per domain
   (`workspace.py`, `source.py`, `relationship.py`, `saved_query.py`):
   - Each exports `make_<entity>(**overrides) -> SQLModel` returning
     an unsaved instance.
   - `seed_<entity>(session, **overrides)` returning a persisted
     instance.
   - Composable: `make_source(workspace=make_workspace())`.
3. Consolidate `conftest.py` fixtures:
   - `db_session`: in-memory SQLite + Alembic upgrade per test.
   - `client`: FastAPI TestClient bound to the in-memory DB.
   - `seeded_workspace`, `seeded_source`, ... call factories.
   - Replace the ad-hoc `seed_source_activate` helper added in Round 21.
4. Document the test-layer contract in `apps/backend/tests/README.md`:
   - When to write a unit vs integration vs contract test.
   - How to use factories.
   - How to write a perf benchmark.
5. Create `apps/backend/tests/perf/` with `pytest-benchmark`:
   - `test_upload_100k_rows.py` — generate 100k-row CSV, upload,
     assert duration < 30s.
   - `test_query_preview_under_5s.py` — preview query against a
     seeded 100k-row workspace, assert < 5s.
   - `test_export_under_30s.py` — full Excel export, assert < 30s
     and file size sane.
   - Mark as `@pytest.mark.perf`; not run in default `pytest`
     invocation (opt-in via `pytest -m perf`).
6. Add `pytest-benchmark` to dev/test extras in `pyproject.toml`
   (Round 25 already migrated to pyproject; this is a small append).
7. Convert at least 5 representative tests from each existing layer
   to use factories — proves the pattern. Bulk migration is OUT (do it
   lazily as features touch each test file).

## Check

- [ ] Default `pytest tests/` -> all 153+ tests pass after the
      reorganize (path-only changes; no semantic test changes)
- [ ] `pytest -m perf tests/perf/` passes against the target SLOs on
      dev hardware
- [ ] `tests/README.md` exists and the three-layer split is enforceable
      by directory: a contract test in `tests/integration/` is a
      review-time red flag
- [ ] At least 5 tests per layer demonstrably use a factory; CI / lint
      doesn't enforce yet but pattern is documented
- [ ] `/speckit.analyze` -> no CRITICAL findings

## Act

(filled at round close)

**Learnings**:

- **Promotions**:

- [ ] -> context/ : "test-layer vocabulary + factory pattern" if it
      generalizes (likely yes — re-usable across `apps/dashboard/`)
- [ ] -> skills/ :

## Questions for user before Round 27

1. Did the perf SLOs match real dev hardware, or do they need to be
   relaxed before we gate MVP-1 on them?
2. Adopt the same three-layer test split for `apps/dashboard/` in
   Round 28? Or keep dashboard testing at Streamlit's lighter cadence?
3. Frontend (`apps/builder/`) test patterns are TypeScript / Vitest —
   align Round 27 to a parallel three-layer split (unit / component /
   e2e), or let it evolve organically?

**Round transition**:

- On Complete: brainstorm Round 27 (Builder UI foundation). Round 27
  draft already prepared at `.agents/plan/cycles/Round_27.md`.
