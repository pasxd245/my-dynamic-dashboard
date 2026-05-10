# Builder Frontend

The `apps/builder` application is the React + TypeScript frontend for the dynamic dashboard builder.

---

## Directory Layout (`src/`)

| Directory     | Purpose                                              | Placement rules                                                                                     |
| ------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `config/`     | Application configuration (AppConfig, Fields, Const) | All `import.meta.env.*` reads, runtime config, and app-wide constants                               |
| `api/`        | HTTP client functions + TanStack Query hooks         | Plain fetch wrappers (functions) and hooks wrapping them; no business logic                         |
| `api/hooks/`  | TanStack Query `useQuery`/`useMutation` hooks        | One file per domain: `useWorkspace`, `useSavedQueries`, `useQueryBuilder`, `useBuilderSession`      |
| `components/` | Presentational and feature components                | Subdirectories by feature: `query-builder/`, `workflow-shell/`, `SavedQuery/`, `errors/`, `shared/` |
| `pages/`      | Route-level components                               | One directory per page route (`BuilderWorkflowPage`, `SavedQueryLibrary/`)                          |
| `state/`      | Application state stores                             | Zustand stores per domain; no global god-store                                                      |
| `hooks/`      | Cross-cutting React hooks                            | Hooks shared across features; no domain-specific logic                                              |
| `utils/`      | Cross-cutting helpers                                | Pure functions with no domain logic, no side effects                                                |
| `types/`      | Shared TypeScript type definitions                   | Types shared across modules; API-specific types stay in `api/`                                      |

### Entry points

```
src/
  main.tsx        — app bootstrap (AppConfig.init() → ReactDOM.createRoot)
  App.tsx         — router shell + top-level layout
  index.css       — Tailwind base/components/utilities
```

---

## Configuration Precedence

All configuration is routed through `src/config/appConfig.ts`. Three-layer precedence (lowest → highest):

```
Layer 1 — build-time env      (VITE_API_BASE_URL, VITE_LOG_LEVEL, ...)
    ↓
Layer 2 — runtime /api/v1/config    (fetched asynchronously on boot)
    ↓
Layer 3 — localStorage overrides    (prefix "cfg:" — dev/debug only)
```

### Accessing config in components

```typescript
import { appConfig } from './config';

// Direct access (reactive if called per render)
const baseUrl = appConfig.apiBaseUrl();

// Or via React hook (triggers re-render when init() completes)
import { useAppConfig } from './config';
const cfg = useAppConfig();
```

### Debug: inspect all config values

Open the browser console:

```javascript
appConfig.all();
// → [{ key: 'api.baseUrl', value: '/api/v1', source: 'build-time' }, ...]
```

### Debug: override a value via localStorage

```javascript
localStorage.setItem('cfg:api.baseUrl', 'http://localhost:9999');
location.reload();
```

---

## State Management

State is organized into domain stores in `src/state/`:

| Store                           | File                     | Domain                                              |
| ------------------------------- | ------------------------ | --------------------------------------------------- |
| `builderSessionStore`           | `builderSessionStore.ts` | Workflow stage, session state, connection readiness |
| `queryBuilderStore` _(planned)_ | `queryBuilderStore.ts`   | Builder snapshot, column state                      |
| `savedQueryStore` _(planned)_   | `savedQueryStore.ts`     | Saved query list + pagination                       |

**Hydration**: `builderSessionStore` reads `sessionStorage["builder.workflow.active_stage"]` on boot; falls back to `"upload_source"` if absent.

**useState rule**: Only use local `useState` for ephemeral UI state (form inputs, modal open/close, tooltips). Application state goes in a store.

---

## API Layer

All HTTP communication uses TanStack Query v5:

- **Reads** (`useQuery`): `useWorkspaceProfile`, `useSavedQueries`, `useBuilderSessionState`, ...
- **Writes** (`useMutation`): `useCreateSavedQuery`, `useUploadSource`, `useSetActiveContext`, ...

Hooks are in `src/api/hooks/`. Never call `fetch()` directly from a component or page.

---

## Localization

**Decision (Spec 013, Gate D — 2026-05-11): RETIRED**

The `i18next`/`react-i18next` infrastructure was vestigial — configured but never
invoked in any component or page (zero `useTranslation()` / `.t()` call sites).
The `src/i18n/` directory has been removed.

When multi-locale support is needed in a future round:

1. Re-add `i18next` and `react-i18next` as dependencies
2. Create `src/i18n/` with locale files
3. Call `await i18n.init()` in `main.tsx` (after `AppConfig.init()`)
4. Use `useTranslation()` in components

**Supported locales**: None (English-only; hardcoded strings in components).

---

## Commands

```bash
# Development
pnpm --filter builder dev              # Start Vite dev server (port 3000)

# Build
pnpm --filter builder build            # Production build
pnpm --filter builder type-check       # TypeScript type check (no emit)

# Tests
pnpm --filter builder test             # Run Vitest once
pnpm --filter builder test:watch       # Run Vitest in watch mode
```

---

## Environment Variables

| Variable            | Default                           | Description                                      |
| ------------------- | --------------------------------- | ------------------------------------------------ |
| `VITE_API_BASE_URL` | `/api/v1` (from `Const.API_BASE`) | Override backend API base URL at build time      |
| `VITE_LOG_LEVEL`    | `info`                            | Log level (`debug`, `info`, `warn`, `error`)     |
| `VITE_I18N_LOCALE`  | `en-US`                           | Default locale (unused until i18n is re-enabled) |
