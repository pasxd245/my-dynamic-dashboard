# Round 24: Spec 010 - Source / Provider Abstraction (informed by hg_code)

**Status**: Planning (drafted ahead of Round 23 close — review-only until Round 23 completes)
**Date started**:
**Date completed**:

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

- [ ] Wait for Round 23 Complete
- [ ] Read `hg_code/src/com/{provider.py, providers/pvi.py,
    providers/gic.py}` and `hg_code/config/default.yaml`. Capture shape:
      what `ProviderConfig` carries; how `Provider.exec` composes with
      `ExcelProvider.exec_flows`; what `ProviderManager` registers and how
- [ ] Map `hg_code` shape onto current
      `apps/backend/app/services/upload_service.py` (or its renamed
      successor from Round 23). Decide which behaviors stay route-level
      vs. move into a `Source` subclass
- [ ] Decision Gate (YAML descriptors): code-only registration this
      round; YAML descriptors move to Round 25+
- [ ] Decision Gate (`column_mappings` write site): a
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

(filled by `/speckit.implement` + agent reconciliation)

Provisional task outline:

1. New module `apps/backend/app/services/sources/`:
   - `base.py` — `Source` (abstract: `ingest`, `inspect`, `commit`,
     `post_commit_hook`), `SourceConfig` (Pydantic).
   - `registry.py` — `SourceRegistry` (parallel to `hg_code`'s
     `ProviderManager`).
   - `excel.py` — current Excel ingestion logic moved here as
     `ExcelSource(Source)`.
2. **Wire `SourceConfig` into the Round-23 `AppConfig`** — each `Source`
   reads its config sub-namespace through `cfg.sources.<kind>`,
   loaded by the same `load_config()`. Add a `sources:` section to
   `apps/backend/app/resources/default.yaml` with one entry per
   registered source kind. Mirrors how `hg_code/config/default.yaml`
   registers per-vendor providers.
3. Wire `SourceRegistry` into FastAPI app state at boot. Register
   `ExcelSource` for the `xlsx`, `xls` extensions.
4. Update upload routes to dispatch through `SourceRegistry.get(kind)`
   instead of hard-coding Excel. Public route signatures unchanged.
5. Pre-stage hook: `Source.post_commit_hooks: list[Callable]` — empty
   default. The future fuzzy matcher and audit emitters register here.
6. Existing tests pass after import path updates only.

## Check

- [ ] All upload-related tests pass (import-path updates only)
- [ ] `SourceRegistry` shape mirrors `hg_code`'s `ProviderManager`
      (review side-by-side; document divergences in
      `specs/010-source-provider-abstraction/research.md`)
- [ ] CRG: `apps/backend/app/services/sources/` is its own community,
      one inbound bridge from upload routes
- [ ] `/speckit.analyze` -> no CRITICAL findings

## Act

(filled at round close)

**Learnings**:

- **Promotions**:

- [ ] -> context/ : pattern note "Source/Provider abstraction in
      FastAPI + SQLModel" if it generalizes
- [ ] -> skills/ :

## Questions for user before Round 25

1. YAML descriptor format: copy `hg_code`'s `default.yaml` shape
   verbatim, or design ours from scratch?
2. First concrete second `Source` type — pick now to scope Round 25?
   Candidates: multi-sheet Excel picker (Round 21 act candidate A),
   CSV upload, JSON upload, URL pull.
3. Does the `column_mappings` fuzzy matcher belong in Round 25 (alongside
   the second source type) or a dedicated round?

**Round transition**:

- On Complete: foundation chain (22-24) is closed. Brainstorm next
  feature round (Round 25) using questions above. Likely candidates from
  Round 21 act + analysis/09: relationships graph, Excel export,
  multi-sheet picker, fuzzy column-rename matcher.
