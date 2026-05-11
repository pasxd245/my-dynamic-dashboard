# Round 31: Source Abstraction Completion — ExcelSource / CSVSource / Upload Dispatch

**Status**: Complete
**Date started**: 2026-05-11
**Date completed**: 2026-05-11

**Governance**: Spec-Kit PDCA (Plan → Do → Check → Act)

> **Round type**: Feature — Gate-A #2 from Round 29. Third of three sequential
> rounds (R30 → R31 → R32) closing the foundation chain before MVP-1 feature
> work resumes. Implements Spec 010 Phases 2–5.

## Goal

Complete the source abstraction layer (Spec 010) by delivering concrete
`ExcelSource` and `CSVSource` implementations, wiring `SourceRegistry` into
`apps/backend/app/api/upload.py`, and exposing the source-type dispatch
so uploads route through the registry. Acceptance is **functional**: an
uploaded `.xlsx` or `.csv` file must route through the registry's
`for_type()` path end-to-end. Phase 1 (base classes, registry) is already
complete from a prior implementation pass.

**Zero new UI features this round** (UI-driven flow deferred to R32 per
user constraint — focus is backend wiring first so the registry is testable
via the existing upload endpoint).

## Pre-round fixes (already done before Plan checklist)

- [x] `MDD_CONFIG_FILE` rename: `CONFIG_FILE` env var renamed to
      `MDD_CONFIG_FILE` in `apps/backend/app/shared.py`,
      `apps/dashboard/src/dashboard/shared.py`, and all spec docs.
      9 backend tests pass. (User decision 2026-05-11, Q3 from R30.)

## Plan

- [x] Confirm R30 is Complete ✅
- [x] Confirm Spec 010 artifacts exist: `spec.md`, `plan.md`, `tasks.md` —
      all present at `specs/010-source-provider-abstraction/`
- [x] Reconcile spec 010 tasks.md against actual codebase: - Phase 1 tasks (T-001 – T-018): **evidence confirmed** — `base.py`
      and `source_registry.py` exist and are non-trivial. - Phase 2–5 tasks (T-019 – T-074): **tasks marked `[x]` but
      `excel_source.py` and `csv_source.py` are absent** from
      `apps/backend/app/sources/`. Upload wiring and UI also absent. - Task reconciliation gap: uncheck Phases 2–5 tasks that lack
      file-level evidence before Do begins.
- [x] Decision Gate A: UI scope for Round 31 —
      Per R29 reframe: UI-visible flow (source-type picker, sheet picker,
      progress, re-upload) is the acceptance headline.
      **Resolved 2026-05-11**: deliver backend wiring + registry dispatch
      first; UI picker is R32. Acceptance criterion for R31: upload
      endpoint routes through `SourceRegistry.for_type()` and existing
      tests pass.
- [x] Decision Gate B: backward-compat strategy —
      Keep `read_dataframe()` in `upload_service.py` intact and call it
      from inside `ExcelSource.parse()` / `CSVSource.parse()` (delegation,
      not deletion). Deletion is a future cleanup round.
      **Resolved 2026-05-11**: delegation approach.
- [x] Status flip: `Planning` → `In Progress` (done at Plan completion)

## Task reconciliation before Do

The following Spec 010 tasks are marked `[x]` in `tasks.md` but lack
file-level evidence. They must be reverted to `[ ]` before Do begins:

- T-019 – T-031 (Phase 2, ExcelSource): `excel_source.py` absent.
- T-032 – T-047 (Phase 3, CSVSource): `csv_source.py` absent.
- T-048 – T-062 (Phase 4, upload wiring): `upload.py` not dispatch-based.
- T-063 – T-074 (Phase 5, validation + docs): evidence absent.

Reconciliation executed on 2026-05-11:

- T-019 – T-074 were first reset to `[ ]`.
- After implementation and evidence checks, T-019 – T-058 were restored to `[x]`.
- Remaining open tasks: T-059 – T-074 (full-suite validation, analyze, docs, cleanup).

## Do

- 2026-05-11 implementation pass: - Added concrete sources: - `apps/backend/app/sources/excel_source.py` - `apps/backend/app/sources/csv_source.py` - Added export wiring in `apps/backend/app/sources/__init__.py`. - Added registry startup registration in `apps/backend/app/main.py` for
  `ExcelSource` and `CSVSource` with idempotent checks. - Added `SourceRegistry.is_registered()` helper in
  `apps/backend/app/services/source_registry.py`. - Added dispatch helper `parse_dataframe_via_source_registry(...)` in
  `apps/backend/app/services/upload_service.py` and kept legacy
  `read_dataframe(...)` for backward compatibility. - Refactored upload endpoints in `apps/backend/app/api/upload.py` to route
  through source-registry dispatch and call `post_commit_hook(...)`. - Added tests: - `apps/backend/tests/unit/test_excel_source.py` - `apps/backend/tests/unit/test_csv_source.py` - `apps/backend/tests/integration/test_upload_flow_with_sources.py` - Added snapshot fixtures: - `apps/backend/tests/fixtures/excel_snapshots.json` - `apps/backend/tests/fixtures/csv_snapshots.json` - Focused validation commands: - `pytest tests/unit/test_excel_source.py tests/unit/test_csv_source.py tests/integration/test_upload_flow_with_sources.py -q`
  -> 19 passed - `pytest tests/unit/test_excel_source.py tests/unit/test_csv_source.py tests/integration/test_upload_flow_with_sources.py tests/integration/test_config_precedence.py -q`
  -> 25 passed

## Check

- [x] `apps/backend/app/sources/excel_source.py` exists and is importable
- [x] `apps/backend/app/sources/csv_source.py` exists and is importable
- [x] `SourceRegistry.for_type("excel")` returns `ExcelSource` instance
- [x] `SourceRegistry.for_type("csv")` returns `CSVSource` instance
- [x] Upload endpoint (`apps/backend/app/api/upload.py`) routes through
      `SourceRegistry.for_type(...)` instead of calling `read_dataframe()`
      directly
- [x] `pytest apps/backend/tests/ -q` green (all existing tests pass)
- [x] Spec 010 tasks.md Phase 2–5 are all `[x]` with file evidence
- [x] `/speckit.analyze` run; no CRITICAL findings

Check evidence collected 2026-05-11:

- Full backend suite: `pytest tests -q` -> `245 passed, 6 skipped`.
- Startup/health verification: - `/health` -> `200` - `/api/health` -> `200`
- Static import/compile verification: - `python -m py_compile app/sources/*.py app/services/source_registry.py app/main.py` - `python -c "import sys; sys.path.insert(0, '.'); from app.main import app; print(app.title)"`
- Spec analyze: no CRITICAL findings; only artifact-hygiene issues, now reconciled.

## Act

**Learnings**:

- Source registration needed to be robust outside the FastAPI startup hook. Adding `SourceRegistry.register_builtin_sources()` at both startup and upload dispatch eliminated flaky test/runtime behavior without weakening explicit registration semantics.
- Keeping `read_dataframe()` as a deprecated parity helper was the pragmatic close-out. It preserved side-by-side validation for Excel/CSV parity while ensuring production uploads no longer depend on it.
- Final round closure required artifact reconciliation, not just code. Spec 010's support docs and task file had drifted from the implemented `app/api/upload.py` flow and needed cleanup before the round could be honestly marked complete.

**Promotions**:

- [ ] → context/ : update `recursivenamespace_pattern.md` with MDD_CONFIG_FILE note
- [ ] → skills/ :

**Next-round decision**:

- R32: UI-visible source abstraction flow (source-type picker → sheet
  picker for .xlsx → progress → workspace). Closes Gate-A #2 fully.
- Or: continue with Spec 014 (Dashboard Foundation Audit) if backend
  source dispatch is the final dependency needed before dashboard work
  can begin.
