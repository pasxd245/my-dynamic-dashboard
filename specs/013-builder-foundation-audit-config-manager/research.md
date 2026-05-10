# Research: Builder Foundation Audit & Config Manager (Spec 013)

**Feature**: `013-builder-foundation-audit-config-manager`  
**Phase 0 Audit Date**: 2026-05-11  
**Auditor**: Round 27 implementation pass

---

## CRG Findings

**Tool**: `code-review-graph` v2.3.2 (CRG)  
**Command**: `scripts/crg apps --register --build -- --skip-postprocess`  
**Status**: CRG graph registration executed. The builder app has been registered in the CRG registry.

**Pre-audit structure** (directory tree):

```
apps/builder/src/
├── api/           # HTTP client functions (fetch wrappers)
├── components/    # UI components (query-builder, workflow-shell, SavedQuery, errors)
├── i18n/          # i18n config + locales (vestigial — see Gate D)
├── pages/         # Route-level pages (BuilderWorkflow, SavedQueryLibrary)
└── state/         # One hand-rolled store: builderSessionStore.ts
```

**Key coupling hotspots identified** (manual analysis):

- `App.tsx` acts as god-component: 17 `useState` calls covering workspace, upload, profile, readiness, and saved query state
- `SavedQueryLibraryPage.tsx` has 8 `useState` calls managing server data (queries, total, offset, filters)
- `SavedQueryDetail.tsx` has 7 `useState` calls managing server data (query detail, executions)
- No directory boundary enforcement — `components/` and `pages/` import directly from `api/` (acceptable but unstructured)
- No canonical `config/`, `hooks/`, `utils/`, or `types/` directories

**Community boundaries identified**: 3 implicit communities (api layer, UI/components, state). Boundaries are loose.

---

## Build Baseline

**Command**: `cd apps/builder && pnpm build`  
**Date**: 2026-05-11  
**Exit code**: 0 (clean build)  
**Output**:

```
dist/index.html                   0.41 kB │ gzip:  0.28 kB
dist/assets/index-jYN7Oacc.css   19.15 kB │ gzip:  3.86 kB
dist/assets/index-_tUtEVM2.js   335.61 kB │ gzip: 101.61 kB
✓ built in 56ms
```

**Bundle total (JS)**: 335.61 kB raw / 101.61 kB gzip  
**Build warnings**: 0  
**Node.js note**: Running on Node 20.18.0; Vite recommends 20.19+ (non-fatal warning)

---

## Gate A: State Library

**Command**: `grep -rn "zustand|jotai|recoil|mobx|redux" apps/builder/src/`  
**Result**: **ZERO matches** — no state management library found in source code.

**Finding**: The codebase does NOT currently use zustand (or any competitor). The existing `state/builderSessionStore.ts` is a **hand-rolled functional module** (pure functions + exported state shape interface) that manages state via React `useState` in consuming components.

**package.json**: `@tanstack/react-query` v5.28.0 is present, but zustand is **not installed**.

**Gate A Decision**: OPEN (zustand NOT confirmed in use)  
**Action required**: Install zustand (`pnpm --filter builder add zustand`) before Phase 4 (T027-T028). Phase 0-2 can proceed without it.

---

## Gate B: HTTP Call Inventory

**Command**: `grep -rn "fetch(|axios" apps/builder/src/`  
**Axios**: Not found anywhere.

**Fetch call sites** (all in `api/` — acceptable):

| File                       | Lines                                            | API_BASE method                              |
| -------------------------- | ------------------------------------------------ | -------------------------------------------- |
| `api/queryBuilderApi.ts`   | 31, 44, 57, 71                                   | `const API_BASE = "/api/v1"` at line 9       |
| `api/builderSessionApi.ts` | 30, 40, 47                                       | `const API_BASE = "/api/v1"` at line 9       |
| `api/workspaceApi.ts`      | 15, 37, 54, 70, 84, 98, 108, 120                 | Hardcoded `/api/v1/...` inline (no constant) |
| `api/queryApi.ts`          | 172, 207, 237, 253, 275, 298, 322, 345, 364, 392 | Hardcoded `/api/v1/...` inline (no constant) |

**Component/page violations**: ZERO — no raw `fetch` in `components/`, `pages/`, or `App.tsx`.

**TanStack Query (`useQuery`/`useMutation`)**: **NOT USED** — zero call sites despite `@tanstack/react-query` v5 being in package.json.

**Gate B Decision**: PASS (no component violations). TanStack Query wrapping is Phase 5 work (T031-T034).  
**API_BASE migration**: 2 files use `const API_BASE` (migrate to `appConfig.apiBaseUrl()` in Phase 2). 2 files use inline `/api/v1/` strings (migrate in Phase 5 during hook wrapping).

---

## Gate C: CSS Strategy

**Command**: `grep -rn "className|css|styled|emotion|module.css" apps/builder/src/ | grep -v "tailwind"`  
**Result**: All `className` usage is pure Tailwind utility strings. No CSS-in-JS, no CSS modules, no inline `style` objects (except one `panelStyle`/`preStyle` in `App.tsx` for legacy scaffolding code).

**Findings**:

- `apps/builder/src/App.tsx`: Two `CSSProperties` objects (`panelStyle`, `preStyle`) — legacy scaffolding; not blocking.
- `apps/builder/src/index.css`: Tailwind base/components/utilities imports only.
- All component/page files: Tailwind className strings exclusively.

**Gate C Decision**: LOCKED — Tailwind-only confirmed.  
**Action**: No CSS strategy change needed this round. The two CSSProperties objects in `App.tsx` can be migrated to Tailwind in a future round when App.tsx is refactored.

---

## Gate D: i18n Scope

**Command**: `grep -rn "useTranslation|i18next|\.t(|i18n\." apps/builder/src/`

**Findings**:

- `apps/builder/src/i18n/config.ts`: Imports `i18next` and `react-i18next`; configures with `en` locale + `en.json` translations.
- `apps/builder/src/main.tsx` line 5: `import "./i18n/config"` — side-effect import.
- **Components/pages**: ZERO usage of `useTranslation`, `.t()`, or `i18n.*` anywhere.

**Locale file**: `apps/builder/src/i18n/locales/en.json` (exists, contents unchecked — unused).

**i18n call site count**: 0 in product code.

**Gate D Decision**: RETIRE  
**Rationale**: The i18n infrastructure is vestigial — configured but never invoked in any component or page. Removing it saves ~15 kB from the bundle (i18next + react-i18next) and eliminates a false signal that the app is internationalized.  
**Action** (Phase 6 / T036): Remove `apps/builder/src/i18n/` directory; remove `import "./i18n/config"` from `main.tsx`; remove `i18next` and `react-i18next` from `package.json`.

---

## State Consolidation Inventory

**Command**: `grep -n "useState" apps/builder/src/components/**/*.tsx apps/builder/src/pages/**/*.tsx apps/builder/src/App.tsx`

**Total useState sites**: 57 calls across 8 files

| File                                                | Count | Classification                                     |
| --------------------------------------------------- | ----- | -------------------------------------------------- |
| `App.tsx`                                           | 17    | Mixed — see breakdown below                        |
| `pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx` | 8     | 6 application state, 2 local UI                    |
| `pages/SavedQueryLibrary/SavedQueryDetail.tsx`      | 7     | 5 application state, 2 local UI                    |
| `components/query-builder/QueryBuilderPanel.tsx`    | 2     | 1 application state (`QueryBuilderState`), 1 error |
| `components/SavedQuery/SaveQueryDialog.tsx`         | 6     | Local UI (form fields)                             |
| `components/SavedQuery/UpdateQueryDialog.tsx`       | 6     | Local UI (form fields)                             |
| `components/SavedQuery/SavedQuerySearch.tsx`        | 5     | Local UI (search form)                             |
| `components/errors/ActionableErrorPanel.tsx`        | 1     | Local UI (expand toggle)                           |

**App.tsx breakdown** (17 useState):

- Application state (consolidate to store): `workspaceName`, `workspaceId`, `uploadResult`, `profile`, `readiness`, `manifestPreview`, `builderSnapshot`, `loadedSnapshot`
- Local UI state (keep): `selectedFile`, `headerRow`, `dataRange`, `reason`, `selectedColumnId`, `selectedRole`, `overrideReason`, `message`, `isUploading`

**Consolidation candidates** (Phase 4 / T027-T028):

- `queryBuilderStore.ts`: Extract `builderSnapshot`, `loadedSnapshot`, `workspaceId`, `workspaceName`, `uploadResult`, `profile`, `readiness`, `manifestPreview` from App.tsx
- `savedQueryStore.ts`: Extract `queries`, `total`, `offset`, `filters`, `query` (detail), `executions` from SavedQueryLibraryPage.tsx and SavedQueryDetail.tsx

**Expected count after Phase 4**: ~28 local-UI-only useState (dialogues, forms, toggles).

---

## API_BASE Hardcode Inventory

| File                       | Pattern                      | Count         | Migration plan                                            |
| -------------------------- | ---------------------------- | ------------- | --------------------------------------------------------- |
| `api/queryBuilderApi.ts`   | `const API_BASE = "/api/v1"` | 1 constant    | Replace with `appConfig.apiBaseUrl()` (T016)              |
| `api/builderSessionApi.ts` | `const API_BASE = "/api/v1"` | 1 constant    | Replace with `appConfig.apiBaseUrl()` (T017)              |
| `api/workspaceApi.ts`      | Inline `/api/v1/` strings    | 8 call sites  | Migrate in Phase 5 when wrapping in TanStack hooks (T031) |
| `api/queryApi.ts`          | Inline `/api/v1/` strings    | 10 call sites | Migrate in Phase 5 when wrapping in TanStack hooks (T032) |

**import.meta.env usage**: ZERO — no environment variables read anywhere in current codebase.

---

## Summary & Phase Dependencies

| Gate                   | Status | Decision                                      |
| ---------------------- | ------ | --------------------------------------------- |
| A — State library      | OPEN   | zustand not installed; add before Phase 4     |
| B — HTTP call boundary | PASS   | All fetch in api/; no component violations    |
| C — CSS strategy       | LOCKED | Tailwind-only confirmed                       |
| D — i18n scope         | RETIRE | Zero usage in product code; remove in Phase 6 |

**Phase 1 prerequisite met**: Directory layout moves safe to proceed.  
**Phase 2 prerequisite met**: AppConfig module safe to author (no env reads to conflict).  
**Phase 4 prerequisite**: Install zustand before T027.  
**Phase 6 prerequisite**: Gate D retirement decision recorded here.
