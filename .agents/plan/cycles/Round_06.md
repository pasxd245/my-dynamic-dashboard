# Round 06: Fix `SavedQueryLibraryPage.tsx` typecheck regression

**Status**: Complete
**Date started**: 2026-05-19
**Date completed**: 2026-05-19

## Goal

Close `state.json.openObservations.builderTypecheckPreExistingRegression` by mapping the store's `filters.state === "all"` to `undefined` before passing to `listSavedQueries` / `searchSavedQueries`. Eliminates two TS2345 errors at [SavedQueryLibraryPage.tsx:91](../../../apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx#L91) and [:98](../../../apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx#L98). Other unrelated apps/builder typecheck errors are out of scope per [[round-cadence]] (one feature per round).

## Product-velocity justification

Product round; the velocity justification applies in reverse — meta needs to justify itself against product (per purpose-hierarchy). This is straight product hygiene: a red typecheck on the dashboard's SavedQueryLibrary page blocks any future round in or near that file from running a clean `pnpm tsc --noEmit` as a Check signal.

## Trajectory

### Immutable Intent

Make the typecheck for [SavedQueryLibraryPage.tsx](../../../apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx) green. Do not absorb the other apps/builder TS errors discovered during Check.

### Current Architecture State

- Store [savedQueryStore.ts:9](../../../apps/builder/src/state/savedQueryStore.ts#L9) defines `state: "active" | "deleted" | "all"`.
- API [queryApi.ts:192](../../../apps/builder/src/api/queryApi.ts#L192) (`listSavedQueries`) + [:222](../../../apps/builder/src/api/queryApi.ts#L222) (`searchSavedQueries`) define `state: "active" | "deleted" = "active"` — default param makes call-site type `"active" | "deleted" | undefined`.
- Mismatch: `"all"` from the store has no API counterpart.

### Feedback Scope

- **Local fix** (this round): coerce `"all"` → `undefined` at the call site. Backend's behavior when `state` param is absent is unchanged because `listSavedQueries` / `searchSavedQueries` default to `"active"` internally; "all" thus collapses to "active" for now.
- **Global redesign** (NOT this round): preserving the semantic "all = active AND deleted" requires backend support for `state=all` (or absence of `state` param meaning "all states"). Captured as an open follow-up; needs a product call.

### Allowed Change Boundary

- In-scope: [apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx](../../../apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx) only.
- Read-only context: [savedQueryStore.ts](../../../apps/builder/src/state/savedQueryStore.ts), [queryApi.ts](../../../apps/builder/src/api/queryApi.ts), [SavedQuerySearch.tsx](../../../apps/builder/src/components/SavedQuery/SavedQuerySearch.tsx).

## Plan

- [x] Read store + API signatures to confirm the type mismatch.
- [x] Coerce `filters.state === "all" ? undefined : filters.state` at the single `useEffect` body — apply once, reuse for both API call sites.
- [x] Verify `pnpm tsc --noEmit` no longer reports `SavedQueryLibraryPage.tsx` errors.
- [x] Confirm the broader apps/builder typecheck regressions (in `useSavedQueries.ts`, `useWorkspace.ts`, `appConfig.ts`, test files) are unchanged — those remain out of scope.

## Do

- Single edit at [SavedQueryLibraryPage.tsx:86-103](../../../apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx#L86-L103) — extract `apiState` once, pass to both API calls.
- No store changes, no API changes, no UI changes. Behavior shift: when the user selects "all" in the state filter, the page now sends no `state` URL param, which the backend interprets per `state="active"` default. This is a known semantic regression (see follow-ups); the type fix is the round's goal.

## Check

- [x] `pnpm tsc --noEmit` in `apps/builder` — `SavedQueryLibraryPage.tsx` errors absent.
- [x] No new errors introduced.
- [x] Pre-existing unrelated errors (`useSavedQueries.ts`, `useWorkspace.ts`, `appConfig.ts`, test files) unchanged — confirmed out of scope.
- [x] Lint: `pnpm md:lint` clean (markdown-only side files).
- [x] Critical-security: ✅ — no path-glob hits; no runtime dep adds; no new `child_process`/`eval`/`vm`.

## Act

**Learnings**:

- The state.json description "Round_02 — apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx:98 typechecks red" was line-accurate but undercounted (line 91 had the same bug). Future bugfix-round candidates should explicitly call out "all matching lines in this file" rather than the first line found.
- The fix surface (one call-site coercion) is genuinely 15 min, but the **semantic** question ("all" should mean "both states") is a real design call deferred to a follow-up. The state.json estimate was right for _the typecheck fix_, ambiguous for _the feature_.

**Promotions**:

- [ ] → context/ : none
- [ ] → skills/ : none

## Open follow-ups

- **`filters.state === "all"` is a UI option without a real backend semantic.** Today it silently degrades to "active". Two paths: (a) add a third backend state value `all` returning both active and deleted, or (b) drop "all" from the store enum entirely. Pick one before any user-visible filter docs mention "all".
- **The other apps/builder typecheck errors are unaddressed.** `useSavedQueries.ts`, `useWorkspace.ts:140`, `appConfig.ts:138`, and two test-file `TS6133` warnings remain red. They split cleanly into: API hooks type-misalignment (useSavedQueries / useWorkspace — likely one round), `import.meta.env` typing fix (appConfig — one tiny round), and lint-style unused-var cleanup (test files — trivial). Three future bugfix-round candidates.

## State of the world after this round

- `state.json.openObservations.builderTypecheckPreExistingRegression` → resolved (file-scoped scope only; broader builder typecheck health remains an open item, see Follow-ups).
- First product round of the post-warm-start `cycles/` series outside the @mdd/ui chain — keeps the queue mix from drifting fully meta.
