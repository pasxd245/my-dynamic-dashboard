# Round 27: Spec 013 - Builder (React) Foundation Audit & Config Manager

**Status**: Planning (drafted ahead of Round 26 close — review-only until Round 26 completes)
**Date started**:
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

## Goal

Bring `apps/builder/src/` into a clean, layered structure that mirrors
the backend's Round 23 split (`core/` + `apps/` + `utils/` adapted to
React/TypeScript idioms). Introduce a **frontend `AppConfig` analogue**
so all `import.meta.env.*` reads are routed through one typed module
with explicit precedence (build-time defaults < runtime `/api/config`
endpoint < user-overridden via localStorage). Consolidate state
management (`builderSessionStore` + scattered hooks), retire ad-hoc
`utils` collisions, and align the i18n setup. **Zero new features.**
This is the FE mirror of Round 23 — the user's stated value layer.

## Plan

- [ ] Wait for Round 26 Complete
- [ ] CRG audit: rebuild + run `list_communities_tool` on
      `apps/builder/src/` to surface coupling hot-spots and ad-hoc
      directory collisions
- [ ] Decide target FE layout. Provisional (mirrors backend Round 23):
      `apps/builder/src/
    main.tsx             # entry
    App.tsx              # router shell
    config/
      appConfig.ts       # AppConfig analogue (typed env + runtime cfg)
      fields.ts          # dotted-key constants (Fields equivalent)
      const.ts           # Const equivalent
    api/                 # HTTP clients (existing — review naming)
    components/          # presentational + feature components
      query-builder/
      workflow-shell/
      SavedQuery/
      errors/
      shared/            # reusable UI primitives
    pages/               # route-level components (existing)
    state/               # zustand/jotai stores (existing — consolidate)
    hooks/               # cross-cutting hooks
    i18n/                # locales + config (existing — review)
    utils/               # cross-cutting helpers, no domain logic
    types/               # shared TS types (consolidate scattered defs)
 `
- [ ] Decide config layering for FE. Locked:
      `import.meta.env` (Vite build-time)
      < `/api/v1/config` (runtime fetch on boot)
      < `localStorage` overrides (dev/debug only).
- [ ] Decision Gate: state-management library. Today
      `builderSessionStore.ts` exists (likely zustand). Audit whether
      it's the only store, or if scattered `useState`/`useReducer`
      represent dispersed state that should consolidate.
- [ ] Decision Gate: query state — confirm TanStack Query is the
      canonical server-state layer (per `docs/analysis/04-tech-stack.md`)
      and audit any HTTP calls bypassing it.

**Decision Gates**:

- Gate A (state lib): consolidate to one (zustand) vs. introduce
  redux-toolkit / jotai. Locked: stay on zustand if already present.
- Gate B (TanStack Query coverage): every API client wraps a hook
  (`useWorkspace`, `useSavedQueries`, ...) — no raw `fetch`/`axios`
  outside the query/mutation layer.
- Gate C (CSS strategy): Tailwind (per analysis/04) vs. mixed —
  audit and lock.
- Gate D (i18n scope): is `i18n/` actively used or vestigial?
  If vestigial, remove; if used, document supported locales.

**External references**:

- `i18n-tool/core/src/i18n_tools/shared.py` — same layered config
  precedence pattern, adapted from Python to TypeScript.
- `apps/backend/app/shared.py` (delivered in Round 23) — backend
  `AppConfig`. The FE one mirrors its surface (typed accessors,
  lazy validation) so backend + FE devs share mental model.

## Do

(filled by `/speckit.implement` + agent reconciliation)

Provisional task outline:

1. Apply the directory layout. No file deleted yet — moves only.
2. Create `apps/builder/src/config/appConfig.ts`:
   - `AppConfig` class (or module with closure) exposing typed
     accessors: `apiBaseUrl()`, `featureFlags()`, `logLevel()`,
     `i18nLocale()`, ...
   - Three-layer load: build-time env (`import.meta.env.VITE_*`) +
     runtime fetch from `/api/v1/config` on boot + localStorage
     overrides. Cached after first load.
   - `useAppConfig()` React hook for component access.
3. Create `apps/builder/src/config/fields.ts` and
   `apps/builder/src/config/const.ts`:
   - `Fields.API_BASE_URL`, `Fields.FEATURE_FLAGS`, ... — string
     constants used as keys.
   - `Const.DEFAULT_LOCALE`, `Const.MAX_PREVIEW_ROWS`, ...
4. Replace every `import.meta.env.*` read with `appConfig.<accessor>()`:
   `grep -rn "import.meta.env" apps/builder/src/` returns zero hits
   outside `appConfig.ts`.
5. Audit + consolidate state (Gate A):
   - List every `zustand` store and every `useState` that holds
     non-trivial state (>10 LOC reducer-equivalent).
   - Merge dispersed stores into `state/` modules with clear
     boundaries (per-feature: `workflowShellStore`, `queryBuilderStore`,
     `savedQueryStore`).
6. Audit TanStack Query coverage (Gate B): every `apps/builder/src/api/*`
   module exports query/mutation hooks; no component calls `fetch`
   directly.
7. Retire any duplicated `utils/` collisions surfaced by CRG audit.
8. Audit `i18n/` (Gate D); document or remove.
9. Update [apps/builder/README.md](apps/builder/README.md) with the
   new layout + config-precedence diagram.
10. Add Vitest tests for `appConfig.ts` precedence behavior (the only
    new test surface this round).

Scope OUT:

- New features, new pages, new components.
- CSS framework migration (Tailwind audit only — no rewrite).
- Visual redesign.
- Dashboard (`apps/dashboard/`) — its own round (Round 28).

## Check

- [ ] All builder tests pass (Vitest); existing E2E smokes (if any)
      pass against a freshly built bundle
- [ ] `grep -rn "import.meta.env" apps/builder/src/` returns zero hits
      outside `config/appConfig.ts`
- [ ] `grep -rn "fetch(\|axios" apps/builder/src/components/` returns
      zero hits (all HTTP through the query/mutation layer)
- [ ] Vite dev server starts cleanly; `pnpm --filter builder build`
      produces a bundle with no warnings
- [ ] Manual smoke: upload -> profile -> query -> save -> visualize
      flow works end-to-end against the running backend (this is the
      Round-21 acceptance flow — must still pass)
- [ ] CRG community map shows tighter, name-aligned communities;
      `components/shared/` becomes its own community
- [ ] `/speckit.analyze` -> no CRITICAL findings

## Act

(filled at round close)

**Learnings**:

**Promotions**:

- [ ] -> context/ : "FE AppConfig precedence pattern" — reusable
      in any Vite + React app
- [ ] -> skills/ :

## Questions for user before Round 28

1. Did the consolidated state stores stay readable, or do we need a
   different boundary (e.g. one global store with slices)?
2. Tailwind audit findings — switch to a stricter design-token
   approach (CSS variables / shadcn theme tokens), or leave as-is?
3. i18n scope — confirm the locale set we want to support before
   feature rounds add more strings?
4. Should the runtime `/api/v1/config` endpoint be designed in this
   round or pushed to a backend-side feature round (since it's a new
   API surface)?

**Round transition**:

- On Complete: brainstorm Round 28 (Dashboard / Streamlit foundation).
  Round 28 draft already prepared at `.agents/plan/cycles/Round_28.md`.
