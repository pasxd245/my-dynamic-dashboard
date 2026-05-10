# Feature Specification: Builder (React) Foundation Audit & Config Manager

**Feature Branch**: `013-builder-foundation-audit-config-manager`  
**Created**: 2026-05-11  
**Status**: Completed (Round 27)  
**Input**: User description: "Bring `apps/builder/src/` into a clean, layered structure that mirrors the backend's Round 23 split (`core/` + `apps/` + `utils/` adapted to React/TypeScript idioms). Introduce a **frontend `AppConfig` analogue** so all `import.meta.env.*` reads are routed through one typed module with explicit precedence (build-time defaults < runtime `/api/config` endpoint < user-overridden via localStorage). Consolidate state management (`builderSessionStore` + scattered hooks), retire ad-hoc `utils` collisions, and align the i18n setup. **Zero new features.** This is the FE mirror of Round 23 — the user's stated value layer."

## Business Question _(mandatory for this project)_

> "Can the frontend builder achieve sustainable code organization and configuration management before MVP-1 feature rounds, so that builder feature development is faster, maintainability improves, and runtime environment handling becomes predictable and testable?"

**Decision consumed**: Whether the React frontend codebase is ready for feature-focused development with minimal coupling, predictable config resolution, and clean state management boundaries — aligned with backend Round 23 foundation work.

## Role

**Primary roles**: Frontend architect (source layout ownership), frontend maintainer (state and config governance), builder feature lead (velocity and feature velocity coordination).

**Surface role**: internal codebase organization and configuration governance.

This feature is an internal code organization and runtime configuration enhancement. Production API behavior, data semantics, and user-facing workflows are unchanged.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Formalize Frontend Directory Layout (Priority: P1)

As a frontend maintainer, I need the React builder source to be organized into clear, purpose-driven layers so I can quickly locate components, hooks, state, and configuration without coupling across boundaries.

**Why this priority**: Without clear layering, feature additions and bug fixes become harder to scope and test; merged PRs often create new coupling rather than reducing it.

**Independent Test**: Verify that `apps/builder/src/` is organized into the target layout with clear directory roles and documented purpose for each.

**Acceptance Scenarios**:

1. **Given** a frontend developer joining the team, **When** they need to add a new component or hook, **Then** the directory structure and README clearly indicate where to place it without ambiguity.
2. **Given** a maintenance task to reduce bundle size, **When** the developer scans `apps/builder/src/utils/`, **Then** they find only cross-cutting utilities with no domain-specific logic duplicated from `state/` or `api/`.
3. **Given** a refactor to migrate a component from class to functional form, **When** the developer searches for related state and hooks, **Then** they find them colocated in either the component directory or a documented feature-level state module.

---

### User Story 2 - Centralize Configuration Management (Priority: P1)

As a frontend developer, I need all runtime configuration (API base URL, feature flags, log level, i18n locale) to be resolved through one typed module so I can reason about precedence, test different environments, and inject overrides without searching the codebase for scattered `import.meta.env` reads.

**Why this priority**: Environment variable reads scattered across components make testing brittle, environment promotions risky, and feature flagging unpredictable.

**Independent Test**: Verify that a centralized `appConfig.ts` module exists and all runtime configuration reads route through it with explicit three-layer precedence.

**Acceptance Scenarios**:

1. **Given** a component that needs the API base URL, **When** the developer calls `appConfig.apiBaseUrl()`, **Then** it returns the correct value after resolving build-time env, runtime `/api/config` response, and localStorage overrides in precedence order.
2. **Given** a test that needs to mock the API endpoint, **When** the test sets a localStorage override before component render, **Then** the component receives the overridden value without modifying production code.
3. **Given** a deployment to staging vs. production, **When** the app boots, **Then** it resolves config correctly by reading the build-time env (if present), then fetching runtime config from `/api/v1/config` (if available), and finally applying any stored user overrides.
4. **Given** a developer debugging an issue in the browser console, **When** they call `appConfig.all()` to inspect current configuration, **Then** they see all resolved values with source attribution (build-time | runtime | localStorage override).

---

### User Story 3 - Consolidate State Management (Priority: P1)

As a frontend developer, I need all state (workflow session state, query builder state, saved query state, etc.) to be managed through a single store library and pattern so I can trace state transitions, test state changes, and avoid ad-hoc `useState` fragments that duplicate logic.

**Why this priority**: Scattered state management (mix of `useState`, custom hooks, and isolated zustand stores) makes debugging stateful features slow and increases the risk of state-consistency bugs.

**Independent Test**: Verify that core application state is consolidated under `state/` with consistent patterns and no duplicated state logic across components or hooks.

**Acceptance Scenarios**:

1. **Given** a new feature that needs to track user workflow progress, **When** the developer creates state, **Then** it follows the existing store pattern (zustand if adopted, or documented alternative) and lives under `state/` with clear ownership boundaries.
2. **Given** an existing scattered `useState` hook that manages application state (not local UI state), **When** this feature audits the codebase, **Then** it consolidates that state into the canonical store under `state/`.
3. **Given** a need to persist workflow state across page refreshes, **When** the state store is created, **Then** it includes an explicit hydration layer that can restore state from sessionStorage / localStorage with clear semantics about what persists and what resets.

---

### User Story 4 - Establish Layered API Client Pattern (Priority: P2)

As a frontend developer, I need every HTTP call to the backend to be wrapped in a TanStack Query hook so I can manage cache, retry logic, error handling, and offline behavior consistently.

**Why this priority**: Raw `fetch` or `axios` calls scattered across components make error handling inconsistent and make it harder to test components in isolation.

**Independent Test**: Verify that all HTTP communication is wrapped in query/mutation hooks and that no component makes direct `fetch` or `axios` calls.

**Acceptance Scenarios**:

1. **Given** a component that needs to fetch saved queries, **When** the developer examines the component code, **Then** they see only a `useSavedQueries()` hook call, not raw `fetch` or `axios`.
2. **Given** an API response error, **When** the query hook processes the response, **Then** it routes through a centralized error handler that applies consistent retry logic and user feedback.

---

### User Story 5 - Document and Rationalize i18n Setup (Priority: P2)

As a frontend maintainer, I need the i18n setup to be documented and intentionally scoped so I can understand what locales are supported, verify strings are properly translated, and decide whether to extend or retire i18n support.

**Why this priority**: Vestigial i18n infrastructure clutters the codebase; active i18n needs clear governance to avoid translation gaps.

**Independent Test**: Verify that `i18n/` setup is audited, documented, and either consolidated or removed.

**Acceptance Scenarios**:

1. **Given** a new feature that introduces user-facing strings, **When** the developer searches for i18n documentation, **Then** they find explicit guidance on whether to use i18n or hard-code English strings.
2. **Given** an audit of supported locales, **When** the feature round completes, **Then** translation coverage is documented and decision (extend vs. retire) is recorded.

### Edge Cases

- New layout is defined but old files remain, creating duplicate code paths and coupling.
- `AppConfig` module is created but some components still read `import.meta.env` directly; governance must fail until all reads are centralized.
- State stores are partially consolidated; some feature state lives in isolated zustand stores and some in scattered `useState` hooks, preventing a single source of truth.
- API layer has query hooks for some endpoints but others still use raw `fetch`; inconsistent error handling and retry logic result.
- i18n is documented as active but no translations exist; strings are missing or locale switching breaks the app.
- Production behavior or API contracts change during reorganization; this feature must be rejected because behavior change is out of scope.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The React builder source MUST be reorganized into the canonical layout with clear directory roles: `config/`, `api/`, `components/`, `pages/`, `state/`, `hooks/`, `utils/`, and `types/` (with `i18n/` present only when Gate D outcome is active-i18n).
- **FR-002**: Each directory under `apps/builder/src/` MUST have a documented purpose and boundary in `apps/builder/README.md` so new contributors can make placement decisions without ambiguity.
- **FR-003**: A centralized `AppConfig` module MUST exist at `apps/builder/src/config/appConfig.ts` that exposes typed accessors for all runtime configuration (API base URL, feature flags, log level, i18n locale, etc.).
- **FR-004**: AppConfig MUST implement three-layer precedence: build-time `import.meta.env.VITE_*` (lowest) < runtime `/api/v1/config` endpoint (middle) < localStorage overrides (highest).
- **FR-005**: AppConfig MUST provide a `useAppConfig()` React hook for component access and an `appConfig.all()` method for debugging.
- **FR-006**: All `import.meta.env.*` reads outside `config/appConfig.ts` MUST return zero grep hits (governance enforced by check phase).
- **FR-007**: A `Fields.ts` module MUST exist at `apps/builder/src/config/fields.ts` defining string constants for dotted-key config accessors (e.g., `Fields.API_BASE_URL`).
- **FR-008**: A `Const.ts` module MUST exist at `apps/builder/src/config/const.ts` defining application-wide constants (default locale, max preview rows, etc.).
- **FR-009**: All application state MUST be consolidated under `apps/builder/src/state/` using a single store library (zustand confirmed by Gate A) with clear feature-level module boundaries (e.g., `workflowShellStore.ts`, `queryBuilderStore.ts`, `savedQueryStore.ts`).
- **FR-010**: State modules MUST define explicit initialization, hydration (from sessionStorage/localStorage if needed), and cleanup semantics in their documentation.
- **FR-011**: All HTTP communication MUST be wrapped in TanStack Query hooks under `apps/builder/src/api/` with no raw `fetch` or `axios` calls in components.
- **FR-012**: Every API module under `apps/builder/src/api/` MUST export query and mutation hooks (e.g., `useWorkspace`, `useSavedQueries`) with consistent error handling and retry logic.
- **FR-013**: The i18n setup MUST be audited and documented: supported locales, translation completeness, and a decision (extend vs. retire) MUST be recorded in `apps/builder/README.md`.
- **FR-014**: If i18n is deemed vestigial, the `i18n/` directory MUST be removed and all imports retired.
- **FR-015**: If i18n is deemed active, translation files MUST be complete and locale switching MUST be tested before accept.
- **FR-016**: No duplicate utilities or helpers MUST exist across `utils/` modules; CRG audit MUST surface and retire collisions.
- **FR-017**: All builder tests (Vitest) MUST pass with no runtime behavior change and no backend API contract change.
- **FR-018**: AppConfig MUST be tested with unit tests covering all three precedence layers and error cases (missing env, failed `/api/config` fetch, corrupt localStorage).

### Non-Functional Requirements

- **NFR-001**: Vite dev server (`pnpm --filter builder dev`) MUST start cleanly with no warnings.
- **NFR-002**: Vite build (`pnpm --filter builder build`) MUST produce a bundle with no warnings.
- **NFR-003**: Component reorganization MUST not increase bundle size; if bundle size increases, refactoring must reduce it back to baseline.
- **NFR-004**: No refactoring MUST alter HTTP request/response contracts; the backend `/api` surface remains unchanged.

## Non-Goals

- Introduce new builder product features, endpoints, or workflows.
- Redesign UI components or visual styling.
- Migrate from React to another frontend framework.
- Migrate from zustand to a different state management library (unless Gate A explicitly decides otherwise).
- Migrate from TanStack Query to a different server-state library.
- Migrate CSS from Tailwind to another framework (CSS audit only — no rewrite).
- Optimize runtime performance as a primary goal (performance is a side effect of cleaner structure, not a target).
- Add new backend endpoints; if `/api/v1/config` does not exist, create placeholder stubs or fetch from `/api/config` (existing).

## Constraints

- Zero production behavior change is mandatory.
- The spec scope is limited to frontend code organization, configuration management, state consolidation, and i18n rationalization.
- Directory layout must mirror backend Round 23 structure (adapted to React/TypeScript idioms).
- AppConfig precedence layers are fixed: build-time env < runtime config < localStorage override.
- State management library is locked to zustand if it is already in use (Gate A confirms).
- All existing tests (Vitest, E2E) must pass without modification to production code.

## Required Metric Contracts

- Contract status: Not applicable for business KPI definition.
- Rationale: this feature organizes internal code structure and configuration governance rather than introducing new user-facing metrics or business behavior.
- Guardrail: Any new user-facing KPI definition discovered during implementation is out of scope and requires a separate specification.

## Required Relationship Rules

- Contract status: Not applicable for this feature.
- Rationale: no new cross-table relationship rule behavior is introduced; this is a frontend-only refactor.
- Guardrail: Any relationship-rule change discovered during implementation is out of scope.

## Required Reconciliation

- Reconciliation status: Applicable for code organization evidence.
- Requirement: baseline and post-change code artifacts must reconcile that directory structure is cleaner, coupling is reduced, and configuration governance is tightened — while production behavior remains identical.
- Evidence surface: implementation artifacts under `apps/builder/src/`, bundle analysis, test results, and Round verification materials.

## Challenge Variants

- Variant A (multi-environment config): build-time env, runtime `/api/v1/config` response, and localStorage override all defined; verify correct precedence is applied.
- Variant B (missing runtime config): `/api/v1/config` endpoint is unavailable or times out; verify app boots cleanly with build-time defaults.
- Variant C (state persistence): workflow state is refreshed across page reloads; verify sessionStorage/localStorage hydration works correctly.
- Variant D (scattered state consolidation): existing code has isolated `useState` hooks managing non-trivial state; verify consolidation does not change component behavior.
- Variant E (i18n active): locales are actively used in the app; verify all strings are translated and locale switching works.
- Variant F (i18n vestigial): i18n is defined but unused; verify removal does not break the app.

## Decision-Readiness Gates

- **Gate A (state lib confirmation)**: Audit `apps/builder/src/` and confirm zustand is the canonical store library or decide on an alternative (jotai, redux-toolkit, etc.). Decision locked for this round.
- **Gate B (TanStack Query coverage)**: Verify every `/api/*` module exports hooks and no component makes raw `fetch`/`axios` calls. Decision: 100% coverage required before accept.
- **Gate C (Tailwind CSS audit)**: Audit styling strategy (pure Tailwind vs. mixed CSS-in-JS vs. design tokens). Document findings and decision (no migration required this round).
- **Gate D (i18n scope)**: Audit whether `i18n/` is actively used or vestigial. Decision: extend support with translations, or retire and remove the directory.

## Key Entities _(include if feature involves data)_

- **AppConfig Module**: Typed configuration accessor with three-layer precedence (build-time env < runtime config < localStorage override).
- **Config Fields**: Dotted-key constants for configuration keys (e.g., `API_BASE_URL`, `FEATURE_FLAGS`).
- **Config Constants**: Application-wide default values (e.g., default locale, max preview rows).
- **State Store**: Consolidated application state under `state/` with feature-level modules and explicit boundaries.
- **Query/Mutation Hook**: TanStack Query-based HTTP client wrapper with consistent error handling.
- **Directory Layout**: Organized `apps/builder/src/` with clear roles for `config/`, `api/`, `components/`, `pages/`, `state/`, `hooks/`, `i18n/`, `utils/`, `types/`.

## Acceptance Criteria Summary

✅ **All requirements (FR-001 through FR-018, NFR-001 through NFR-004) are satisfied.**

✅ **Check phase validations pass**:

- Directory structure aligns with target layout.
- All `import.meta.env` reads outside `config/appConfig.ts` return zero grep hits.
- All HTTP calls are wrapped in TanStack Query hooks.
- AppConfig correctly resolves precedence across all three layers.
- All existing tests pass; bundle size is not increased.
- i18n scope is documented and either consolidated or removed.

✅ **Decision gates are resolved**:

- Gate A: state lib confirmed (zustand).
- Gate B: 100% TanStack Query coverage verified.
- Gate C: Tailwind audit completed; decision documented.
- Gate D: i18n scope decided and implemented.

✅ **Round 21 end-to-end acceptance flow still passes**: upload → profile → query → save → visualize works against the running backend without behavior change.

✅ **No production behavior change**: API contracts, data semantics, and user workflows are identical.

---

## Reference Links

- [Round_27.md](../../.agents/plan/cycles/Round_27.md) — PDCA round plan and decision gates.
- [Backend AppConfig (Round 23)](../../../apps/backend/app/shared.py) — reference implementation; FE mirrors this pattern.
- [Tech Stack Direction](../../../docs/analysis/04-tech-stack.md) — locked decisions on React, TanStack Query, zustand, Tailwind.
- [MVP-1 Plan](../../../docs/analysis/09-mvp-plan.md) — context on MVP-1 scope and timeline.
- [Spec-Kit Constitution](.specify/memory/constitution.md) — Spec-Kit governance and review gates.
