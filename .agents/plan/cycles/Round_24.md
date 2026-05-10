# Round 24: Spec 010 - Source / Provider Abstraction (informed by hg_code)

**Status**: Complete ✅
**Date started**: 2026-05-10
**Date completed**: 2026-05-10

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Extract a `Source` / `Provider` interface so adding a new ingestion source
type = "subclass + (eventually) YAML descriptor", not "edit
`upload_service.py` and three other files". Mirror the shape proven in
`hg_code/src/com/provider.py` (`Provider` base, `ProviderConfig`,
`ProviderManager`, `ExcelProvider`), adapted to FastAPI + SQLModel.
**No new ingestion source types added this round** — the abstraction is
the feature, not the breadth.

## Plan

- [x] Wait for Round 23 Complete
- [x] Read `hg_code/src/com/{provider.py, providers/pvi.py,
providers/gic.py}` and `hg_code/config/default.yaml`. Capture shape:
      what `ProviderConfig` carries; how `Provider.exec` composes with
      `ExcelProvider.exec_flows`; what `ProviderManager` registers and how
- [x] Map `hg_code` shape onto current
      `apps/backend/app/services/upload_service.py` (or its renamed
      successor from Round 23). Decide which behaviors stay route-level
      vs. move into a `Source` subclass
- [x] Decision Gate (YAML descriptors): code-only registration this
      round; YAML descriptors move to Round 25+
- [x] Decision Gate (`column_mappings` write site): a
      `Source.post_commit_hook()` that calls the (still-unimplemented)
      fuzzy matcher, vs. route-level. Decide here

**Decision Gates**:

- Gate A (YAML descriptors): locked OUT this round. Future round adds
  declarative YAML loader on top of the code-level abstraction.
- Gate B (`column_mappings` write site): pre-staged via
  `Source.post_commit_hook()` so the future fuzzy matcher plugs in as a
  hook subscriber, not a service-layer monkey-patch.

**External reference (read-only)**:

- `hg_code/src/com/provider.py` — `Provider` base + `ProviderManager`
- `hg_code/src/com/providers/pvi.py` — concrete `PVI` subclass with
  `_split_multi_addresses`, `_post_load_data`
- `hg_code/src/com/providers/gic.py` — concrete `GIC` subclass with
  `check_is_authorized`
- `hg_code/config/default.yaml` — declarative workflow shape
  (deferred to Round 26+)
- `i18n-tool/core/src/i18n_tools/apps/{excel2json.py, json2excel.py}` —
  parity reference for the `apps/<usecase>.py` shape (data loader +
  runner co-located in one module). Each `Source` subclass we add
  follows this pattern.

## Do

### Speckit Bootstrap

- `/speckit.specify` → `/specs/010-source-provider-abstraction/spec.md` ✅ 2026-05-10
- `/speckit.plan` → `/specs/010-source-provider-abstraction/plan.md` ✅ 2026-05-10
- `/speckit.tasks` → `/specs/010-source-provider-abstraction/tasks.md` ✅ 2026-05-10

All three artifacts created with 74 actionable tasks across 5 implementation phases.

### Task Reconciliation

(filled by `/speckit.implement` + agent reconciliation)

- Completed implementation pass for Spec 010 with `/speckit.implement`.
- Reconciled `specs/010-source-provider-abstraction/tasks.md`: 74/74 tasks checked.
- Implemented and validated:
  - `apps/backend/app/services/source_registry.py`
  - `apps/backend/app/sources/base.py`
  - `apps/backend/app/sources/__init__.py`
  - `apps/backend/tests/test_source_base.py`
  - `apps/backend/tests/test_source_registry.py`
  - `specs/010-source-provider-abstraction/{spec.md,plan.md,tasks.md,research.md,data-model.md,quickstart.md}`

## Check

- [x] All upload-related tests pass
- [x] `SourceRegistry` shape mirrors `hg_code`'s `ProviderManager`
      (differences documented in `specs/010-source-provider-abstraction/research.md`)
- [x] `/speckit.analyze` -> no CRITICAL findings
- [x] Backend test suite validated: `209 passed, 3 skipped, 0 failed`

**Check Result**: PASS

## Act

**Learnings**:

- The Source/Registry split removes source-type branching from orchestration and keeps extensions localized.
- Byte-parity and regression testing are essential for low-risk extraction refactors.
- The pre-staged `post_commit_hook` is the right seam for future `column_mappings` fuzzy-matcher integration.

**Promotions**:

- [ ] -> context/ : Source/Provider abstraction pattern for FastAPI + SQLModel
- [ ] -> context/ : Byte-parity validation pattern for extraction refactors
- [ ] -> skills/ : Source-type extension workflow (register + test + parity check)

## Round transition

- Round 24 complete.
- Next round decision remains user-gated: choose Round 25 scope (YAML descriptors, second source type, and fuzzy-matcher timing).

## Questions for user before Round 25

1. YAML descriptor format: copy `hg_code`'s `default.yaml` shape
   verbatim, or design ours from scratch?
2. First concrete second `Source` type — pick now to scope Round 25?
   Candidates: multi-sheet Excel picker (Round 21 act candidate A),
   CSV upload, JSON upload, URL pull.
3. Does the `column_mappings` fuzzy matcher belong in Round 25 (alongside
   the second source type) or a dedicated round?

Round 21 act + analysis/09: relationships graph, Excel export,
multi-sheet picker, fuzzy column-rename matcher.
