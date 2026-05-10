# Tasks: Builder (React) Foundation Audit & Config Manager

**Feature**: `013-builder-foundation-audit-config-manager`  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)  
**Created**: 2026-05-11  
**Total tasks**: 38  
**Scope**: `apps/builder/src/**`, `apps/builder/README.md`, `docs/development/setup.md`, spec artifacts

---

## Phase 0 — Research & Audit (Prerequisite for all phases)

_Goal: Surface coupling hotspots, confirm decision gates A–D, establish baseline metrics before a single file is moved._

- [x] T001 Run CRG community audit on `apps/builder/src/`; save JSON output to `specs/013-builder-foundation-audit-config-manager/research.md` section "CRG Findings"

  ```bash
  scripts/crg --lang typescript --output json apps/builder/src/ | tee /tmp/crg-013.json
  ```

  **Accept**: Audit completes without error; at least one community boundary identified.

- [x] T002 Capture baseline Vite build output and bundle size: `cd apps/builder && pnpm build 2>&1 | tee /tmp/build-baseline-013.txt`; record bundle total size in `research.md` section "Build Baseline"  
      **Accept**: Build exits 0, no warnings; baseline KB recorded.

- [x] T003 [P] Gate A — Confirm zustand is the only state library in use: `grep -rn "zustand\|jotai\|recoil\|mobx\|redux" apps/builder/src/ > /tmp/gate-a.txt`; record result in `research.md` section "Gate A: State Library"  
      **Accept**: Only zustand imports found; gate LOCKED: zustand. No competitor library imported.

- [x] T004 [P] Gate B — Audit raw HTTP calls; list all `fetch(` and `axios` usages across `apps/builder/src/`: `grep -rn "fetch(\|axios" apps/builder/src/ > /tmp/gate-b.txt`  
      Record each call site (file, line, function) in `research.md` section "Gate B: HTTP Call Inventory". Classify each as: `api/` module (acceptable) vs. `components/` or `pages/` (violation to fix).  
      **Accept**: Table of call sites created; zero component/page violations confirmed or listed.

- [x] T005 [P] Gate C — Audit CSS strategy: `grep -rn "className\|css\|styled\|emotion\|module.css" apps/builder/src/ | grep -v "tailwind" | head -40 > /tmp/gate-c.txt`; record findings + decision (Tailwind-only confirmed, or mixed) in `research.md` section "Gate C: CSS Strategy"  
      **Accept**: CSS strategy documented; decision recorded (extend Tailwind / retire mixed) — no code change needed this round.

- [x] T006 [P] Gate D — Audit i18n usage: `grep -rn "useTranslation\|i18next\|\.t(\|i18n\." apps/builder/src/ > /tmp/gate-d.txt`; count translation call sites; check `i18n/locales/` for completeness  
      Record in `research.md` section "Gate D: i18n Scope". Decision: Extend (document + test locale switching) OR Retire (remove directory + imports).  
      **Accept**: i18n usage count documented; explicit extend-vs-retire decision recorded.

- [x] T007 Audit state consolidation inventory: list every `useState` in `components/` and `pages/` holding non-local state (>10 LOC reducer-equivalent): `grep -n "useState" apps/builder/src/components/**/*.tsx apps/builder/src/pages/**/*.tsx apps/builder/src/App.tsx 2>/dev/null`  
      Record per-file inventory in `research.md` section "State Consolidation Inventory" with classification: "local UI state" vs. "application state (consolidate)".  
      **Accept**: All useState sites classified; list of consolidation candidates ready.

- [x] T008 Write `specs/013-builder-foundation-audit-config-manager/research.md` consolidating all Phase 0 findings: CRG summary, Build Baseline, Gate A–D decisions, State inventory, API_BASE hardcode inventory  
      **Accept**: `research.md` file exists and all six sections populated.

---

## Phase 1 — Layout Formalization (US1: FR-001, FR-002)

_Goal: Establish canonical directory structure before any new files are authored. Moves only — no deletes._

- [x] T009 [US1] Create missing canonical directories under `apps/builder/src/`: `config/`, `hooks/`, `utils/`, `types/` — each with an empty `index.ts` placeholder

  ```bash
  for d in config hooks utils types; do
    mkdir -p apps/builder/src/$d
    echo "// $d module exports" > apps/builder/src/$d/index.ts
  done
  ```

  **Accept**: `find apps/builder/src -type d | sort` shows all eight target directories.

- [x] T010 [P] [US1] Consolidate scattered TypeScript type definitions into `apps/builder/src/types/`: move any standalone `*.types.ts` or interface-only files not already in `api/`; update all import paths  
      **Accept**: `grep -rn "from.*\.\..*types\|from.*types\/" apps/builder/src/` shows only `types/` imports; Vite build passes.

- [x] T011 [US1] Run `pnpm --filter builder build` after directory moves to confirm no circular import introduced and no warning added vs. Phase 0 baseline  
      **Accept**: Build exits 0; no new warnings vs. baseline; bundle size unchanged.

---

## Phase 2 — AppConfig Module (US2: FR-003 – FR-008)

_Goal: Author centralized config governance. All hardcoded `API_BASE` and any future env reads route through typed accessors._

- [x] T012 [US2] Create `apps/builder/src/config/fields.ts` with `Fields` constant object containing dotted-key strings for every config accessor: `API_BASE_URL`, `FEATURE_FLAGS`, `LOG_LEVEL`, `I18N_LOCALE`  
      **Accept**: File exists; TypeScript `as const` type is inferred; `Fields.API_BASE_URL === 'api.baseUrl'`; no build errors.

- [x] T013 [US2] Create `apps/builder/src/config/const.ts` with `Const` object defining application-wide defaults: `DEFAULT_LOCALE` ('en-US'), `MAX_PREVIEW_ROWS` (10000), `API_BASE` ('/api/v1'), `LOG_LEVEL` ('info')  
      **Accept**: File exists; all constants exported with `as const`; no build errors.

- [x] T014 [US2] Create `apps/builder/src/config/appConfig.ts` implementing three-layer precedence config module:
  - Layer 1 (lowest): build-time `import.meta.env.VITE_*` keys mapped via `Fields`
  - Layer 2 (middle): runtime fetch from `/api/v1/config` on `AppConfig.init()` (with 3-second timeout; graceful fallback to build-time values if fetch fails)
  - Layer 3 (highest): `localStorage` key-value overrides (prefix: `cfg:`)
  - Export `appConfig` singleton, `AppConfig` class, and `useAppConfig()` React hook
  - Implement `appConfig.all()` returning `{ key, value, source: 'build-time' | 'runtime' | 'localStorage' }[]`

  **Accept**: File compiles; `appConfig.apiBaseUrl()` returns `Const.API_BASE` when no env var set; Vitest tests (T023–T026) pass.

- [x] T015 [US2] Create `apps/builder/src/config/index.ts` exporting `AppConfig`, `appConfig`, `useAppConfig`, `Fields`, `Const` as named exports  
      **Accept**: `import { appConfig, Fields, Const } from '../config'` resolves without error.

- [x] T016 [US2] Update `apps/builder/src/api/queryBuilderApi.ts`: replace `const API_BASE = "/api/v1"` with `import { appConfig } from '../config'` and use `appConfig.apiBaseUrl()` at call sites  
      **Accept**: Hardcoded `API_BASE` constant removed from file; build passes; existing fetch calls unchanged.

- [x] T017 [US2] Update `apps/builder/src/api/builderSessionApi.ts`: same migration as T016 — replace local `API_BASE` with `appConfig.apiBaseUrl()`  
      **Accept**: Hardcoded constant removed; build passes.

- [x] T018 [US2] Verify zero `import.meta.env` reads outside `config/appConfig.ts`: `grep -rn "import.meta.env" apps/builder/src/ | grep -v "config/appConfig.ts"` → expect zero output  
      Also verify zero remaining `const API_BASE` hardcoded strings: `grep -rn "const API_BASE" apps/builder/src/`  
      **Accept**: Both greps return empty. Evidence recorded in `checklists/` file.

- [x] T019 [US2] Update `apps/builder/src/main.tsx` to call `await AppConfig.init()` before rendering the React root, so runtime config is resolved before any component mounts  
      **Accept**: `main.tsx` initializes AppConfig asynchronously; app boots without console errors; build passes.

---

## Phase 3 — AppConfig Tests (US2: FR-018)

_Goal: Vitest coverage for all three precedence layers and error cases._

- [x] T020 [US2] Create `apps/builder/src/config/__tests__/appConfig.test.ts` — test build-time env precedence: mock `import.meta.env.VITE_API_BASE_URL`; verify `appConfig.apiBaseUrl()` returns the mocked value when no runtime or localStorage override is set  
      **Accept**: `pnpm --filter builder test config/__tests__/appConfig.test.ts` passes.

- [x] T021 [P] [US2] Add runtime `/api/v1/config` fetch test to `appConfig.test.ts`: mock `fetch` to return `{ apiBaseUrl: 'https://staging.example.com/api/v1' }`; verify runtime value overrides build-time env  
      **Accept**: Test passes; precedence order confirmed (runtime > build-time).

- [x] T022 [P] [US2] Add runtime fetch failure test to `appConfig.test.ts`: mock `fetch` to reject (network error); verify app falls back to build-time env value without throwing  
      **Accept**: Test passes; graceful fallback confirmed.

- [x] T023 [P] [US2] Add localStorage override test to `appConfig.test.ts`: set `localStorage.setItem('cfg:api.baseUrl', 'http://localhost:9999')` before `AppConfig.init()`; verify `appConfig.apiBaseUrl()` returns the override (highest precedence)  
      **Accept**: Test passes; localStorage > runtime > build-time confirmed.

- [x] T024 [P] [US2] Add `appConfig.all()` debug surface test to `appConfig.test.ts`: after mixed setup (build-time env + runtime fetch + localStorage override), verify each entry in `appConfig.all()` reports correct `source` attribution  
      **Accept**: Test passes; `source` field is `'localStorage'` for overridden key, `'runtime'` for runtime-only key, `'build-time'` for fallback key.

- [x] T025 [US2] Run full AppConfig test suite and record pass count: `pnpm --filter builder test --run config/__tests__/appConfig.test.ts`  
      **Accept**: All tests pass (minimum 8 test cases covering layers 1–3 and error cases).

---

## Phase 4 — State Consolidation (US3: FR-009, FR-010)

_Goal: All non-local application state lives in `state/` zustand modules with documented hydration semantics._

- [x] T026 [US3] Audit `apps/builder/src/state/builderSessionStore.ts`: verify it covers workflow stage state (active stage, session state, isRefreshing); document hydration from `localStorage` key `builder.workflow.active_stage` in store JSDoc header  
      **Accept**: Store has JSDoc describing init/hydration/cleanup; no change to runtime behavior.

- [ ] T027 [US3] Create `apps/builder/src/state/queryBuilderStore.ts`: extract query-builder application state from `App.tsx` (builder snapshot, column states, etc.) into a zustand store with explicit `init()`, `reset()`, and hydration rules  
      **Accept**: Store compiles; `App.tsx` reduced by at least the extracted state; all Vitest tests pass.

- [ ] T028 [US3] Create `apps/builder/src/state/savedQueryStore.ts`: extract saved-query application state from `SavedQueryLibraryPage.tsx` (offset, selected query, tag filter) into zustand store with init/cleanup semantics  
      **Accept**: Store compiles; `SavedQueryLibraryPage.tsx` reduced; page renders correctly; all tests pass.

- [x] T029 [US3] Update `apps/builder/src/state/index.ts` to export all three stores: `builderSessionStore`, `queryBuilderStore`, `savedQueryStore`  
      **Accept**: `import { useQueryBuilderStore } from '../state'` resolves; no circular imports; build passes.

- [ ] T030 [US3] Verify state consolidation: `grep -rn "useState" apps/builder/src/components/ apps/builder/src/pages/ apps/builder/src/App.tsx | wc -l` — expected count is significantly lower than Phase 0 baseline (only local UI state remains)  
      Record before/after counts in checklist evidence.  
      **Accept**: Count reduced; all remaining `useState` sites are verifiable local-UI-state (button hover, dialog open, etc.).

---

## Phase 5 — API Layer (US4: FR-011, FR-012)

_Goal: All HTTP communication through TanStack Query hooks. Zero raw `fetch` in components or pages._

- [x] T031 [US4] Create `apps/builder/src/api/hooks/useWorkspace.ts` wrapping `workspaceApi.ts` functions in TanStack Query `useQuery`/`useMutation` hooks: `useWorkspaces`, `useUploadSource`, `useWorkspaceProfile`, `useReadiness`, `useExportManifest`, `useImportManifest`  
      **Accept**: All hooks exported; query keys defined; error handling consistent; build passes.

- [x] T032 [US4] Create `apps/builder/src/api/hooks/useSavedQueries.ts` wrapping `queryApi.ts` in TanStack Query hooks: `useSavedQueries`, `useSavedQueryDetail`, `useCreateSavedQuery`, `useUpdateSavedQuery`, `useDeleteSavedQuery`, `useExecuteSavedQuery`, `useExecutionHistory`  
      **Accept**: All hooks exported; build passes.

- [x] T033 [US4] Create `apps/builder/src/api/hooks/useQueryBuilder.ts` wrapping `queryBuilderApi.ts`: `useValidateQuery`, `usePreviewQuery`, `useExecuteQuery`, `useExportQuery`  
      **Accept**: All hooks exported; build passes.

- [x] T034 [US4] Create `apps/builder/src/api/hooks/useBuilderSession.ts` wrapping `builderSessionApi.ts`: `useBuilderPreflight`, `useBuilderSessionState`, `useActiveContext`  
      **Accept**: All hooks exported; build passes.

- [x] T035 [US4] Verify Gate B closure: `grep -rn "fetch(" apps/builder/src/components/ apps/builder/src/pages/ apps/builder/src/App.tsx` → expect zero hits  
      Record result in `checklists/` evidence file.  
      **Accept**: Zero raw `fetch` calls in component/page layer.

---

## Phase 6 — i18n Rationalization (US5: FR-013 – FR-015)

_Goal: i18n scope decided and executed per Gate D._

- [x] T036 [US5] Based on Gate D findings (T006): if i18n is vestigial (zero `t()` call sites in components), remove `apps/builder/src/i18n/` directory and all imports; run `grep -rn "i18n\|i18next" apps/builder/src/` to confirm zero hits  
      If i18n is active: complete translations for all existing `t()` call sites and add locale-switching test.  
      **Accept**: Gate D decision executed; no broken imports; build passes.

- [x] T037 [US5] Record i18n decision, supported locales (or "retired"), and rationale in `apps/builder/README.md` section "Localization"  
      **Accept**: README section exists with decision, date, and justification.

---

## Phase 7 — Utils Rationalization & Verification

_Goal: Retire utility collisions surfaced by CRG; confirm full governance gates pass._

- [ ] T038 [P] Based on CRG findings (T001): retire duplicated utilities identified in Phase 0 — move survivors to `apps/builder/src/utils/`; update all import paths; run build after each move  
      **Accept**: `grep -rn "from.*components.*util\|from.*pages.*util" apps/builder/src/` returns zero hits; no utility logic duplicated across directories.

- [x] T039 Run full Vitest suite: `pnpm --filter builder test --run`  
      **Accept**: All pre-existing tests pass; zero test regressions; new AppConfig tests included.

- [x] T040 Run Vite production build and compare bundle size to Phase 0 baseline (T002): `pnpm --filter builder build`  
      **Accept**: Build exits 0; no warnings; bundle size ≤ baseline (NFR-003); output recorded in checklist.

- [ ] T041 Run CRG community re-audit: `scripts/crg --lang typescript --output json apps/builder/src/`  
      Compare community structure to Phase 0 baseline (T001) — communities should be tighter (fewer cross-cutting imports); `components/` should not import from `state/` directly without going through hooks.  
      **Accept**: Community coupling score improved or stable vs. baseline.

---

## Phase 8 — Documentation & Contracts (FR-002, FR-010, FR-013)

_Goal: New contributor can locate any file and understand config precedence without asking._

- [x] T042 Create or update `apps/builder/README.md` with directory layout guide:
  - Table of all eight `src/` directories (config, api, components, pages, state, hooks, utils, types) with single-sentence purpose + placement rules
  - Config precedence diagram (ASCII or Mermaid): build-time env → runtime /api/v1/config → localStorage
  - Localization section (from T037)
  - State management section: zustand stores, hydration rules

  **Accept**: README exists; all eight directories documented; config precedence diagram present.

- [x] T043 Update `docs/development/setup.md` with frontend config section:
  - How to set `VITE_*` env variables for local dev
  - How to use localStorage overrides for debugging (`localStorage.setItem('cfg:api.baseUrl', '...')`)
  - How to run builder tests (`pnpm --filter builder test --run`)
  - How to inspect current config: `appConfig.all()` in browser console

  **Accept**: Section exists in setup.md; commands are copy-pasteable and correct.

- [x] T044 Record Round 27 check evidence in `specs/013-builder-foundation-audit-config-manager/checklists/round-27-check.md`:
  - import.meta.env grep result (zero hits outside config/)
  - fetch( grep result in components/ (zero hits)
  - build warnings count (zero)
  - bundle size before/after
  - Vitest pass count
  - CRG community comparison (Phase 0 vs. Phase 7)

  **Accept**: All six evidence entries populated.

---

## Dependencies (Phase Order)

```
Phase 0 (T001–T008)           ← Must complete first; all phases depend on audit findings
  ↓
Phase 1 (T009–T011)           ← Directory layout formalization (prerequisite for all moves)
  ↓ (parallel)
Phase 2 (T012–T019)           Phase 4 (T026–T030)         Phase 5 (T031–T035)
Config module + migration     State consolidation          API layer (TanStack Query)
  ↓
Phase 3 (T020–T025)           Phase 6 (T036–T037)
AppConfig tests               i18n rationalization
  ↓ (all parallel tracks merge)
Phase 7 (T038–T041)           ← Integration validation + CRG re-audit
  ↓
Phase 8 (T042–T044)           ← Documentation (can overlap with Phase 7)
```

---

## Parallel Execution Groups (within a phase)

**Phase 0** (all independent, run simultaneously):

- T003 (Gate A), T004 (Gate B), T005 (Gate C), T006 (Gate D) can all run in parallel

**Phase 3** (independent test cases):

- T021, T022, T023, T024 can be authored in parallel (all add to same test file)

**Phase 4** (independent stores):

- T027 and T028 can be authored in parallel

**Phase 5** (independent hook modules):

- T031, T032, T033, T034 can be authored in parallel

---

## Implementation Strategy

**MVP scope (US1 + US2 only)**: T001–T008 → T009–T011 → T012–T025  
Delivers: canonical directory layout + centralized AppConfig with full test coverage + zero scattered env reads.  
This alone satisfies P1 priorities and unblocks subsequent feature rounds.

**Full scope**: Add T026–T044 in subsequent Do sessions if time allows, or break into Round 28a sub-round.

---

## Acceptance Checklist Summary

| Requirement                           | Task(s)         | Verification Command                                     |
| ------------------------------------- | --------------- | -------------------------------------------------------- |
| FR-001 Directory layout               | T009–T011       | `find apps/builder/src -type d \| sort`                  |
| FR-002 Documented boundaries          | T042            | README section present                                   |
| FR-003 AppConfig module               | T014            | File exists + compiles                                   |
| FR-004 Three-layer precedence         | T014, T020–T024 | Vitest suite passes                                      |
| FR-005 useAppConfig() + all()         | T014, T024      | Test cases T024 passes                                   |
| FR-006 Zero env reads outside config/ | T018            | `grep -rn "import.meta.env" src/ \| grep -v config/` = 0 |
| FR-007 Fields.ts                      | T012            | File exists + exported                                   |
| FR-008 Const.ts                       | T013            | File exists + exported                                   |
| FR-009 State under state/             | T026–T029       | All stores in state/                                     |
| FR-010 Store hydration docs           | T026, T029      | JSDoc in each store file                                 |
| FR-011 HTTP via TanStack Query        | T031–T034       | Hooks exist for all endpoints                            |
| FR-012 Hook exports                   | T031–T034       | All hooks exported from api/                             |
| FR-013 i18n audited                   | T036–T037       | Decision in README                                       |
| FR-014/015 i18n outcome               | T036            | Executed per Gate D                                      |
| FR-016 No utility collisions          | T038            | `grep -rn "from.*components.*util"` = 0                  |
| FR-017 All tests pass                 | T039            | `pnpm test --run` green                                  |
| FR-018 AppConfig tests                | T020–T025       | 8+ test cases passing                                    |
| NFR-001 Dev server clean              | T040            | `pnpm dev` no warnings                                   |
| NFR-002 Build clean                   | T040            | `pnpm build` no warnings                                 |
| NFR-003 Bundle size                   | T040            | ≤ Phase 0 baseline                                       |
| NFR-004 No contract changes           | T035            | Zero HTTP contract changes                               |
