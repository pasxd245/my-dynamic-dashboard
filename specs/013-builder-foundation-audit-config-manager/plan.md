# Implementation Plan: Builder (React) Foundation Audit & Config Manager

**Branch**: `feat/013-builder-foundation-audit-config-manager` | **Date**: 2026-05-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-builder-foundation-audit-config-manager/spec.md` and Round 27 planning context

## Summary

Bring `apps/builder/src/` into a clean, layered structure that mirrors the backend's Round 23 split (`core/` + `apps/` + `utils/` adapted to React/TypeScript idioms). Introduce a **frontend `AppConfig` analogue** that centralizes all runtime configuration with explicit three-layer precedence (build-time env < runtime `/api/config` endpoint < localStorage overrides). Consolidate fragmented state management, retire ad-hoc utilities, and rationalize the i18n setup. Zero new product features—this is purely internal code organization and configuration governance to enable faster feature development in subsequent MVP-1 rounds.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18.x, Vite 5.x  
**Primary Dependencies**:

- State management: zustand (confirmed via Gate A audit)
- Server-state: TanStack Query v5 (confirmed per tech-stack.md)
- Styling: Tailwind CSS (per analysis/04)
- Build tool: Vite with VITE\_\* environment variables
- Testing: Vitest (in-process)

**Frontend Runtime Configuration Sources**:

1. Build-time: `import.meta.env.VITE_*` (lowest precedence)
2. Runtime: `/api/v1/config` endpoint fetch on app boot (middle precedence)
3. Dev/Debug: localStorage key-based overrides (highest precedence)

**Storage**: localStorage for optional dev/debug config overrides; sessionStorage for temporary state hydration if needed  
**Target Platform**: Browser; dev server (Vite), production build (static SPA)  
**Testing**: Vitest; E2E smoke tests (pre-existing Round 21 flow validation)  
**Project Type**: Frontend internal code organization and configuration governance refactor  
**Performance Goals**: No bundle size regression; dev server startup unchanged; build time unchanged  
**Constraints**:

- Zero production behavior change
- No new HTTP endpoints (backend may need to provide `/api/v1/config` or fallback to `/api/config`)
- All existing Vitest tests must pass without modification to production code
- Frontend E2E smoke (Round 21 flow) must still pass

**Scale/Scope**: Frontend code organization (`apps/builder/src/**`), configuration module authoring, state consolidation, utilities rationalization, and documentation updates only

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Pre-Phase 0 gate review:

1. **Principle I (Business-question-first)**: PASS. Feature directly enables sustained frontend feature velocity and maintainability as a prerequisite for MVP-1 rounds; it answers "is the FE codebase ready for rapid feature development?"
2. **Principle II (Metric contract before visualization)**: PASS. No new user-facing KPI or metric visualization is introduced; this is code organization and configuration governance only.
3. **Principle III (Relationship rule before cross-table query)**: PASS. No new relationship-rule behavior or data semantics are added; frontend-only refactor.
4. **Principle IV (Reconciliation before recommendation)**: PASS. No new recommendation surfaces introduced; code organization enables existing Round 21 workflows to stay intact.
5. **Principle V (Challenge & sensitivity before decision-ready)**: PASS. No new sensitive business gates introduced.
6. **Principle VI (Traceability for every claim)**: PASS WITH REQUIREMENT. All directory placements, state module boundaries, config layer precedence, and utility deprecations must map to concrete files and grep/CRG audit results.
7. **Principle VII (Reproducibility from raw inputs)**: PASS WITH REQUIREMENT. Directory layout, AppConfig tests, and state consolidation must be reproducible from CRG audit findings and explicit refactoring commands.

Post-Phase 1 re-check:

1. **Principle I**: PASS. Artifacts remain frontend code organization and configuration governance only.
2. **Principle II**: PASS. No KPI/metric-contract surface was introduced.
3. **Principle III**: PASS. No relationship data semantics changed.
4. **Principle IV**: PASS. No recommendation behavior introduced.
5. **Principle V**: PASS. Challenge labeling is unchanged and out of scope.
6. **Principle VI**: PASS. Contracts + quickstart specify exact verification commands (grep checks, CRG audit, state consolidation inventory).
7. **Principle VII**: PASS. Verification paths define deterministic Vite build, Vitest suite run, and E2E smoke test execution expectations.

## Project Structure

### Documentation (this feature)

```text
specs/013-builder-foundation-audit-config-manager/
├── plan.md                            # This file
├── research.md                        # Tech decisions, CRG findings, i18n scope conclusion
├── data-model.md                      # AppConfig schema, state store shapes, config precedence
├── quickstart.md                      # Step-by-step refactoring guide + command reference
├── contracts/
│   ├── frontend-appconfig-contract.md # AppConfig module interface and three-layer precedence
│   ├── frontend-state-consolidation-contract.md  # State store boundary rules
│   └── frontend-api-layer-contract.md # TanStack Query hook coverage requirements
└── checklists/                        # Task acceptance evidence (populated during Do phase)
```

### Source Code (repository root)

```text
apps/builder/src/
├── main.tsx                           # Entry point (unchanged)
├── App.tsx                            # Router shell (unchanged)
├── config/                            # NEW: Configuration governance layer
│   ├── appConfig.ts                   # Centralized config module (three-layer precedence)
│   ├── fields.ts                      # Dotted-key constants (e.g., Fields.API_BASE_URL)
│   ├── const.ts                       # Application-wide defaults (e.g., Const.DEFAULT_LOCALE)
│   ├── index.ts                       # Config module exports
│   └── __tests__/                     # AppConfig unit tests (precedence behavior)
├── api/                               # HTTP client layer (existing — audit + wrap in hooks)
│   ├── useWorkspace.ts                # TanStack Query hooks
│   ├── useSavedQueries.ts
│   ├── useQueryBuilder.ts
│   └── ... (all existing raw fetch → hooks refactor)
├── components/                        # Presentational + feature components (existing — validate)
│   ├── query-builder/
│   ├── workflow-shell/
│   ├── SavedQuery/
│   ├── errors/
│   └── shared/                        # Reusable UI primitives
├── pages/                             # Route-level components (existing)
├── state/                             # Centralized state management (existing — consolidate)
│   ├── workflowShellStore.ts          # Zustand store modules
│   ├── queryBuilderStore.ts
│   ├── savedQueryStore.ts
│   └── index.ts                       # State module exports
├── hooks/                             # Cross-cutting custom hooks (existing)
├── i18n/                              # Localization (existing — audit + decide)
│   ├── config.ts
│   ├── locales/
│   └── ... (decision: extend with translations vs. remove)
├── utils/                             # Cross-cutting helpers (existing — retire collisions)
│   └── ... (utilities with no domain-specific logic)
└── types/                             # Shared TypeScript types (consolidate scattered defs)
    └── ... (existing types organized)

docs/
└── development/setup.md               # Frontend test execution + config precedence diagram

apps/builder/
└── README.md                          # NEW/UPDATED: Directory layout guide + config precedence documentation
```

**Structure Decision**: Minimize new files (`config/` modules + AppConfig tests); maximum refactoring via moves and consolidation under existing `state/`, `api/`, `hooks/` directories. Zero production code changes to components or runtime behavior.

## Design Approach

### 1. Directory Layout Formalization

Reorganize `apps/builder/src/` to mirror backend Round 23 structure (adapted for React/TypeScript):

| Directory     | Role                                          | Current State        | Refactoring Action                    |
| ------------- | --------------------------------------------- | -------------------- | ------------------------------------- |
| `config/`     | Configuration governance + runtime precedence | NEW                  | Create; author appConfig/fields/const |
| `api/`        | HTTP client wrappers (TanStack Query)         | Exists; audit needed | Wrap all fetch/axios in hooks         |
| `components/` | Presentational + feature components           | Exists; no changes   | Validate no scattered state           |
| `pages/`      | Route-level components                        | Exists; no changes   | No changes required                   |
| `state/`      | Centralized zustand stores                    | Exists; fragmented   | Consolidate isolated stores           |
| `hooks/`      | Cross-cutting custom React hooks              | Exists; no changes   | Document purpose; no changes          |
| `i18n/`       | Localization config + translation files       | Exists; audit needed | Extend + document OR retire           |
| `utils/`      | Cross-cutting helpers (no domain logic)       | Exists; collisions   | Retire ad-hoc duplicates              |
| `types/`      | Shared TypeScript type definitions            | Scattered            | Consolidate under `types/`            |

### 2. Configuration Centralization (AppConfig Module)

**Three-layer precedence** (immutable order):

1. **Build-time** (`import.meta.env.VITE_*`) — lowest priority, fallback
2. **Runtime** (`/api/v1/config` or `/api/config`) — fetch on app boot, middle priority
3. **localStorage** — dev/debug overrides only, highest priority

**AppConfig Module (`config/appConfig.ts`)**:

```typescript
// Pseudo-structure
export class AppConfig {
  // Accessors for each config key
  apiBaseUrl(): string;
  featureFlags(): Record<string, boolean>;
  logLevel(): 'debug' | 'info' | 'warn' | 'error';
  i18nLocale(): string;

  // Debugging surface
  all(): Record<string, unknown>; // Return current state with source attribution

  // Initialization (called at app boot)
  static async init(): Promise<AppConfig>;
}

// React hook for component access
export function useAppConfig(): AppConfig;

// Direct module access (for non-component code)
export const appConfig: AppConfig;
```

**Fields module (`config/fields.ts`)**:

```typescript
export const Fields = {
  API_BASE_URL: 'api.baseUrl',
  FEATURE_FLAGS: 'features.flags',
  LOG_LEVEL: 'log.level',
  I18N_LOCALE: 'i18n.locale',
  // ... (all config keys as dotted strings)
} as const;
```

**Const module (`config/const.ts`)**:

```typescript
export const Const = {
  DEFAULT_LOCALE: 'en-US',
  MAX_PREVIEW_ROWS: 10000,
  // ... (application-wide defaults)
} as const;
```

### 3. State Consolidation (Gate A)

**Decision**: Consolidate to single store library (zustand confirmed).

**Action**:

- Audit all existing zustand stores and isolated `useState` hooks
- Merge dispersed state into feature-level modules under `state/`:
  - `workflowShellStore.ts` — workflow session state, breadcrumb nav, etc.
  - `queryBuilderStore.ts` — query DSL state, preview results, etc.
  - `savedQueryStore.ts` — saved query metadata, favorites, etc.
- Each store defines:
  - **Initialization**: default state shape
  - **Hydration**: rules for loading from sessionStorage/localStorage (if any)
  - **Cleanup**: state reset on logout/session close
  - **Documentation**: exported hooks and state shape type definitions

### 4. API Layer Consolidation (Gate B)

**Decision**: Confirm TanStack Query is canonical server-state layer; wrap all HTTP in hooks.

**Action**:

- Audit all raw `fetch()` and `axios()` calls in components
- Wrap in TanStack Query `useQuery` / `useMutation` hooks under `api/`:
  - `useWorkspace()` — fetch workspace metadata
  - `useSavedQueries()` — list/search saved queries
  - `useQueryBuilder()` — execute adhoc queries
  - Etc.
- All hooks inherit consistent error handling + retry logic from shared mutation/query config
- Validation: `grep -rn "fetch(\|axios" apps/builder/src/components/` returns zero hits

### 5. i18n Audit & Rationalization (Gate D)

**Action**: Audit whether `i18n/` is actively used or vestigial.

- Survey all `.tsx` files for `i18n.t()` calls or i18n imports
- Check translation file completeness (are translations for all supported locales present?)
- Decide: Extend with full translations + test locale switching, OR remove directory entirely
- **Outcome decision**: Record in `apps/builder/README.md` and architecture docs

### 6. Utilities Rationalization (CRG Audit)

**Action**: Run CRG audit to surface ad-hoc utilities + naming collisions.

- Map communities under `apps/builder/src/`
- Identify utilities duplicated across `utils/`, `components/`, or `hooks/`
- Retire collisions; consolidate under single `utils/` or `hooks/` ownership
- Document remaining utilities in `apps/builder/README.md`

## Decision Gates (from Round 27)

| Gate  | Decision                                            | Lock Status         | Verification                                                              |
| ----- | --------------------------------------------------- | ------------------- | ------------------------------------------------------------------------- |
| **A** | State management library (zustand vs. alternatives) | **LOCKED: zustand** | Audit `apps/builder/src/state/` confirms zustand is primary store library |
| **B** | TanStack Query coverage (100% HTTP wrapped)         | Decision pending    | `grep -rn "fetch(\|axios" apps/builder/src/components/` → zero hits       |
| **C** | CSS strategy (Tailwind vs. mixed)                   | Decision pending    | Audit findings + decision recorded in spec/research.md                    |
| **D** | i18n scope (extend vs. retire)                      | Decision pending    | Survey i18n usage; decision + migration plan recorded                     |

## CRG Audit Strategy (Phase 1)

**Objective**: Surface coupling hot-spots and ad-hoc directory collisions in `apps/builder/src/`.

**Workflow**:

1. Run CRG `list_communities_tool` on `apps/builder/src/`:

   ```bash
   crg --lang typescript --output json apps/builder/src/ | jq .communities
   ```

2. Analyze community boundaries:
   - Identify tightly-coupled clusters (likely feature-level components + state + hooks)
   - Identify loose utilities (should be under `utils/` or `hooks/`, not scattered)
   - Identify cross-cutting concerns (shared UI, config, types)
3. Extract findings:
   - List of duplicated utilities (naming collisions)
   - Proposed consolidations (e.g., "move `components/utils/formatter.ts` to `utils/formatter.ts`")
   - Community structure (how feature areas should be co-located)
4. Generate target layout based on community insights
5. Document recommendations in `research.md`

## Risk Mitigation

| Risk                                                  | Likelihood | Impact | Mitigation                                                 |
| ----------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------- |
| AppConfig fetch from `/api/v1/config` fails on boot   | Medium     | High   | Graceful fallback to build-time env; retry logic; timeout  |
| Directory refactor introduces circular imports        | Medium     | High   | Re-lint TypeScript at each refactor step; Vite build check |
| State consolidation breaks component behavior         | Medium     | High   | Full Vitest + E2E smoke test suite before accept           |
| i18n removal leaves broken imports                    | Low        | Medium | Grep audit before removal; automated import cleanup        |
| Utilities consolidation misses edge cases             | Low        | Medium | CRG audit + manual code review; sample conversion tests    |
| TanStack Query wrapping introduces network regression | Low        | High   | Performance baseline before/after; query config tuning     |

## Validation Approach

### Phase 0: Research & Audit

**Research deliverables**:

- CRG community audit results + recommendations
- AppConfig design (schema, precedence flowchart, error-handling spec)
- State consolidation inventory (list of stores, isolation boundaries)
- API layer audit (raw fetch calls, proposed hooks)
- i18n survey (usage + translation completeness)
- Utilities consolidation plan (collisions + targets)

**Validation gates**:

- ✓ CRG audit surfaces no CRITICAL coupling issues
- ✓ AppConfig three-layer precedence design is testable and clear
- ✓ State store boundaries are well-defined and non-overlapping
- ✓ All HTTP calls can be wrapped in TanStack Query hooks without refactoring components
- ✓ i18n scope decision is documented and justified

### Phase 1: Design & Contracts

**Deliverables**:

- `data-model.md`: AppConfig schema, state store shapes, config precedence diagram
- `contracts/`:
  - `frontend-appconfig-contract.md` — AppConfig module interface + precedence rules
  - `frontend-state-consolidation-contract.md` — State store boundary rules
  - `frontend-api-layer-contract.md` — TanStack Query hook coverage requirements
- Updated `apps/builder/README.md` with directory layout guide + config precedence diagram
- `quickstart.md` — Step-by-step refactoring commands

**Validation gates**:

- ✓ AppConfig tests written and passing (precedence, fallback, error cases)
- ✓ Directory structure matches backend Round 23 pattern (adapted to React)
- ✓ All decision gates (A, B, C, D) are documented with rationale

### Phase 2: Implementation Check

**Check criteria**:

1. **Directory Layout Audit**:

   ```bash
   find apps/builder/src -type d | sort  # Verify expected structure
   grep -rn "import.meta.env" apps/builder/src/ | grep -v "config/appConfig.ts"  # Zero hits
   ```

2. **AppConfig Tests**:

   ```bash
   cd apps/builder && pnpm test config/appConfig.ts
   # Verify: build-time env read, runtime `/api/config` fetch + fallback, localStorage override, useAppConfig() hook
   ```

3. **State Consolidation**:

   ```bash
   grep -rn "useState\|useReducer" apps/builder/src/components/ | wc -l  # Only local UI state
   grep -rn "zustand" apps/builder/src/state/index.ts  # All stores exported from state/
   ```

4. **API Layer Coverage**:

   ```bash
   grep -rn "fetch(\|axios" apps/builder/src/components/  # Zero hits
   grep -rn "useQuery\|useMutation" apps/builder/src/api/  # All endpoints wrapped
   ```

5. **Build & Bundle**:

   ```bash
   cd apps/builder && pnpm build
   # Verify: no warnings, bundle size unchanged (vs. baseline)
   ```

6. **Vitest Suite**:

   ```bash
   cd apps/builder && pnpm test --run
   # All tests pass without production code changes
   ```

7. **E2E Smoke** (Round 21 flow):

   ```bash
   # Upload → Profile → Query → Save → Visualize against running backend
   # Expected: flow still works end-to-end
   ```

8. **CRG Community Re-audit**:

   ```bash
   crg --lang typescript --output json apps/builder/src/ | jq .communities
   # Verify: communities are tighter, fewer cross-cutting imports
   ```

## Dependencies & Blockers

### Backend Dependencies

- **Backend API**: Confirm `/api/v1/config` endpoint will be available (or specify fallback to `/api/config`)
- **Backend AppConfig**: Specification of response shape for `/api/v1/config` (see `contracts/frontend-appconfig-contract.md`)
- **Backend Deployment**: AppConfig must be accessible at runtime (config should not require admin access)

### Frontend Internal

- **Vite Configuration**: Ensure `import.meta.env` variables are properly forwarded (check `vite.config.ts` for `define` or `.env` files)
- **TypeScript Configuration**: Ensure `tsconfig.json` allows `import.meta.env` syntax without errors
- **Testing Library**: Vitest must be configured for mocking `localStorage` and `fetch` during AppConfig tests

### Documentation

- Backend API documentation for `/api/v1/config` endpoint (shape, HTTP status codes, error responses)
- Update frontend setup guide (`docs/development/setup.md`) with AppConfig initialization steps

## Requirement Mapping Matrix

| Requirement | Scope                                                   | Gate                                  | Test / Evidence                                |
| ----------- | ------------------------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| FR-001      | Directory layout formalization                          | Directory structure audit             | `apps/builder/README.md` + layout validation   |
| FR-002      | Documented directory boundaries                         | Documentation + grep checks           | `apps/builder/README.md` directory guide       |
| FR-003      | AppConfig module creation                               | Module exists + tests pass            | `config/appConfig.ts` + unit tests             |
| FR-004      | Three-layer precedence (build < runtime < localStorage) | Unit tests for each layer             | AppConfig Vitest suite (precedence scenarios)  |
| FR-005      | useAppConfig() hook + all() method                      | React hook + debugging API            | AppConfig tests + component integration tests  |
| FR-006      | Zero import.meta.env reads outside config/              | Grep audit                            | `grep -rn "import.meta.env" apps/builder/src/` |
| FR-007      | Fields.ts module (dotted-key constants)                 | Module exists + exported              | `config/fields.ts` in codebase                 |
| FR-008      | Const.ts module (defaults)                              | Module exists + exported              | `config/const.ts` in codebase                  |
| FR-009      | Consolidated state under state/                         | Zustand stores in `state/` modules    | State store inventory + consolidation audit    |
| FR-010      | State hydration/cleanup docs                            | Documented in store module headers    | Store module JSDoc + README                    |
| FR-011      | All HTTP wrapped in TanStack Query                      | Hook coverage audit                   | `grep -rn "fetch(\|axios"` in components = 0   |
| FR-012      | Query/mutation hook exports                             | All endpoints have `useX` hooks       | API module audit + component survey            |
| FR-013      | i18n audit + documented decision                        | Decision recorded + migration plan    | `research.md` + `apps/builder/README.md`       |
| FR-014      | i18n removal (if vestigial)                             | Conditional: directory removed if so  | Directory audit post-decision                  |
| FR-015      | i18n translations (if active)                           | Conditional: translation completeness | Locale switching test (if extended)            |
| FR-016      | No duplicate utilities                                  | CRG audit + manual consolidation      | Utilities before/after comparison              |
| FR-017      | All Vitest tests pass                                   | Default test suite regression         | `pnpm test --run` → all pass                   |
| FR-018      | AppConfig unit tests                                    | Precedence + error case coverage      | `config/__tests__/appConfig.test.ts`           |

## Complexity Tracking

**No constitution violations are accepted.** Feature complexity is constrained to code organization, configuration consolidation, and state refactoring—with zero production behavior change. Any attempt to introduce new features, modify API contracts, or change runtime behavior will halt the feature round.

## Status Summary (2026-05-11)

- **Execution status**: Completed (Round 27 closed)
- **Plan status**: Implemented and validated; all tasks in tasks.md are checked (44/44)
- **Blockers**: None for Round 27 closure
- **Next phase**: Brainstorm and define Round 28 scope

## Traceability Update

- **Plan artifacts**: `specs/013-builder-foundation-audit-config-manager/{spec,plan,tasks,research}.md` + `checklists/round-27-check.md`
- **Evidence surface**: Implementation artifacts under `apps/builder/src/{config,state,api}/`; test results; bundle analysis
- **Verification commands**: See Phase 2 Check section above; all commands are reproducible from repo root
- **Task mapping**: Tasks will be generated in Phase 1 (see `speckit.tasks` workflow); each task maps to a requirement and validation gate above

## Constitution Traceability Matrix (Round 27 closure)

Required by constitution: each requirement is mapped to data layer, metric contract,
relationship rule, surface role, decision gate, and validating test/evidence.
`N/A` denotes intentionally not applicable to this frontend-only structural round.

| Req     | Data Layer                                   | Metric Contract                                    | Relationship Rule                                 | Surface Role                | Gate                   | Test / Evidence                                                  |
| ------- | -------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- | --------------------------- | ---------------------- | ---------------------------------------------------------------- |
| FR-001  | Frontend source tree (`apps/builder/src`)    | Directory canonicalization complete                | No cross-layer import violations                  | Builder FE maintainers      | Gate A/B/C/D pre-audit | T009-T011 + build output                                         |
| FR-002  | Docs (`apps/builder/README.md`)              | Directory table present                            | Placement rules explicit per directory            | Contributors/onboarders     | Docs gate              | T042                                                             |
| FR-003  | Runtime config model (`config/appConfig.ts`) | Typed accessor coverage                            | Single access path for runtime config             | FE app bootstrap            | Config gate            | T014                                                             |
| FR-004  | Build env + runtime endpoint + localStorage  | Precedence verified (L1<L2<L3)                     | Override ordering deterministic                   | FE runtime config consumers | Config gate            | T021-T024                                                        |
| FR-005  | Config API surface                           | Hook + debug surface available                     | Hook/use API consistent across components         | FE components               | Config gate            | T014 + T024                                                      |
| FR-006  | Frontend code search scope                   | Zero non-appConfig env reads                       | Env reads centralized                             | FE maintainers              | Governance gate        | T018 + checklist grep                                            |
| FR-007  | Config key constants (`Fields`)              | Keys defined + typed                               | Key naming stable across modules                  | FE config authors           | Config gate            | T012                                                             |
| FR-008  | App constants (`Const`)                      | Defaults centralized                               | Constant source of truth                          | FE config authors           | Config gate            | T013                                                             |
| FR-009  | State modules (`state/`)                     | Application state moved from component-local state | Store boundaries by feature                       | FE state owners             | Gate A                 | T026-T030                                                        |
| FR-010  | Store hydration docs                         | Init/hydrate/reset semantics documented            | Lifecycle explicit per store                      | FE state owners             | State gate             | T026 + T027 + T028 + README                                      |
| FR-011  | API layer + hooks                            | No raw HTTP in components/pages                    | UI -> hooks -> api call path                      | FE feature components       | Gate B                 | T031-T035 + grep                                                 |
| FR-012  | API hook exports                             | Hook coverage across api domains                   | Query/mutation pattern consistency                | FE api clients              | Gate B                 | T031-T034                                                        |
| FR-013  | Localization docs                            | Decision recorded with rationale                   | i18n lifecycle explicit (active/retired)          | FE maintainers              | Gate D                 | T037                                                             |
| FR-014  | i18n source tree                             | Vestigial i18n removed if unused                   | No orphaned imports                               | FE maintainers              | Gate D                 | T036                                                             |
| FR-015  | i18n runtime behavior                        | N/A for retire path in this round                  | N/A (future re-enable path documented)            | FE maintainers              | Gate D                 | T037 (retire rationale)                                          |
| FR-016  | Utility modules                              | No duplicated util imports/patterns                | Utils isolated from pages/components feature code | FE maintainers              | CRG gate               | T038 + grep evidence                                             |
| FR-017  | Runtime behavior parity                      | Tests/build/smoke all pass                         | No backend contract drift via FE refactor         | FE + QA                     | Check gate             | T039 + T040 + stub smoke                                         |
| FR-018  | AppConfig test surface                       | Unit tests cover precedence/failure cases          | Config behavior deterministic                     | FE config owners            | Test gate              | T020-T025                                                        |
| NFR-001 | Dev server startup                           | Startup succeeds without blocking errors           | N/A                                               | FE dev workflow             | Check gate             | `pnpm --filter builder dev` smoke (documented in check evidence) |
| NFR-002 | Build pipeline                               | Production build passes cleanly                    | N/A                                               | FE release pipeline         | Check gate             | T040                                                             |
| NFR-003 | Bundle artifact                              | Bundle <= baseline after refactor                  | N/A                                               | FE release pipeline         | Check gate             | T002 + T040                                                      |
| NFR-004 | API contract usage                           | No request/response shape changes introduced       | FE requests preserve existing backend API surface | FE API clients              | Check gate             | T035 + unchanged backend contracts                               |
| SC-001  | Decision resolution artifacts                | Gates A-D closed with evidence                     | Decisions applied consistently                    | FE maintainers              | Gate closure           | research.md + checklist                                          |
| SC-002  | Workflow smoke path                          | Upload->profile->query->save flow still passes     | End-to-end user path intact                       | Product acceptance          | Check gate             | `pnpm dev:builder:smoke:stub` passed                             |
| SC-003  | Zero-behavior-change constraint              | Structural-only refactor confirmed by tests/smoke  | N/A                                               | Product reliability         | Check gate             | T039/T040 + smoke + no backend changes                           |
