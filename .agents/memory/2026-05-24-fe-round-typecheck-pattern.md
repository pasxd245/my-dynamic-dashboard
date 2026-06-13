# FE round — hand-aligned TS types + fetch-mock test pattern

**Date**: 2026-05-24
**Agent**: claude-opus-4-7
**Confidence**: Medium-high (third instance of the 4-round
methodology; mirrors R16's BE-side pattern)
**Status**: Promoted
**Promoted to**: `../context/_archive/contract-driven-feature.md`
([Round_18](../plan/cycles/Round_18.md), 2026-05-24)

## Problem

R15 introduced the 4-round-per-feature methodology (Design →
Contract → BE → FE). R16 implemented the BE side and captured the
"hand-aligned Pydantic + OpenAPI conformance helper" pattern. The
question this memo answers: **what does the F-step look like in
code?** How are TS types kept honest against the YAML, where do
mocks live, and how does the wizard's local state stay legible?

## Finding

The FE-side mirror is structurally simpler than the BE side — the
TypeScript compiler is the conformance net for shape; tests are
the conformance net for wire behaviour.

**Three layers**:

```text
features/data-management/datasets/
├── types.ts                   ← hand-aligned to *.contract.yaml
├── hooks.ts                   ← TanStack Query around api/* clients
├── upload/state.ts            ← reducer for the wizard
└── upload/Upload<Step>Step.tsx ← step components, dispatch-driven

api/
├── uploadsApi.ts              ← fetch clients (no Content-Type on multipart)
└── datasetsApi.ts             ← fetch clients

tests/
├── datasets.test.tsx          ← integration with fetch mocks
└── wizard-reducer.test.ts     ← pure-function unit tests for the reducer
```

**Hand-written types over codegen — for now.** The contract count
is 6 endpoints + 6 shared schemas. Three layers (BE Pydantic, FE
TS, conformance helper) all do hand-alignment. This is acceptable
under the Evolution Rule's "default = don't add" guard. When the
first real drift surfaces (a contract update lands and one of the
three layers misses it), promote codegen — until then, hand
alignment is the discipline.

**Multipart `fetch`: do not set `Content-Type`.** The browser
sets it for `FormData` bodies with the multipart boundary. Setting
it manually breaks the upload silently. Document this in the API
client and verify in tests by inspecting the recorded `init.body`.

**Reducer over Zustand for single-page wizard state.** The wizard
lives on one page; state never crosses route boundaries. A typed
`useReducer` with a discriminated `WizardAction` union is the
right shape — TypeScript catches missing cases, the state shape
is obvious from the reducer, and tests are pure-function unit
tests. Reach for a store (Zustand / Redux / Jotai) only when state
needs to survive route navigation or be shared across siblings.

**URL params over reducer for entry state.** The workspace
pre-fill from `?workspace=<ws_id>` is owned by `useSearchParams`,
not the reducer. The reducer mirrors it via a one-time
`useEffect` so the form sees the value, but URL changes drive the
truth. This separation lets the workspaces-page handoff work
without lifting the reducer to the URL or sharing state across
pages.

**Test selector strategy: query-by-role + data-component for
nested AntD widgets.** AntD's nested DOM (Select dropdowns,
Checkbox-inside-Table cells) is brittle under jsdom/happy-dom.
For interaction tests:

- Use `findByText` / `findByRole` for direct user-visible affordances.
- Use `data-component="<name>"` on wrappers (a `<div>` if AntD
  strips it from the widget) when a stable hook is needed.
- For tables of checkboxes, fall back to
  `container.querySelectorAll('input[type="checkbox"]')` — the
  count + order is stable and the markup isn't.
- Skip dropdown-interaction tests when an alternative entry exists
  (e.g., the workspace can be pre-filled via URL).

**Fetch-mock pattern matches R13 routing test.** A single
`installFetch(handler)` helper, a route-table inside the handler,
`afterEach` cleanup via `vi.unstubAllGlobals()`. No MSW yet — the
3-instance Evolution Rule threshold isn't met, and MSW is a
separate track-2 round when the FE demands an offline demo path.

## Evidence

- **R17 round file**:
  [.agents/plan/cycles/Round_17.md](../plan/cycles/Round_17.md).
- **Hand-aligned types**:
  [`src/features/data-management/datasets/types.ts`](../../workspace/apps/builder/src/features/data-management/datasets/types.ts)
  — mirror of the 6 R15 contracts; closed `Dtype` /
  `SourceFormat` literal unions; `TempUploadResponse` as a
  discriminated union on `sourceFormat`.
- **Multipart client**:
  [`src/api/uploadsApi.ts`](../../workspace/apps/builder/src/api/uploadsApi.ts)
  — `createTemp` deliberately omits the `Content-Type` header.
- **Wizard reducer**:
  [`src/features/data-management/datasets/upload/state.ts`](../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts)
  — typed action union, per-sheet state map (CSV uses
  `CSV_SHEET_KEY = ""` sentinel).
- **Reducer tests**:
  [`tests/wizard-reducer.test.ts`](../../workspace/apps/builder/tests/wizard-reducer.test.ts)
  — 5 pure-function tests covering CSV seeding, Excel sheet
  selection, parse status transitions, override / exclusion
  tracking, step index.
- **Integration tests**:
  [`tests/datasets.test.tsx`](../../workspace/apps/builder/tests/datasets.test.tsx)
  — 6 fetch-mocked tests covering Datasets table, workspace
  handoff, CSV wizard end-to-end, Excel parse trigger.
- **Test count growth**: builder went from 8 → 19 passing. Total
  across all packages: 88 (was 46 before R16 + 23 from R16 +
  19 from R17 — minus the R13 4 that became R16 5).

## Recommendation

**Do**:

- **One `types.ts` per feature, mirroring the YAML closely.**
  Closed unions for `Dtype` / `SourceFormat`; discriminated
  unions for response shapes (`TempUploadCsv | TempUploadExcel`).
- **Use `useReducer` for single-page wizard state.** Discriminated
  action union; reducer pure; per-step components consume
  `(state, dispatch)` props. No mutation library, no extra
  framework.
- **Pre-fill from `useSearchParams`, not reducer init.** When
  the page can be entered with state (a filtered link, a deep
  link from another route), let the URL drive and the reducer
  mirror via `useEffect`.
- **For multipart fetch, do not set `Content-Type`.** Add a
  comment in the API client and a test that checks the mock's
  recorded init does not contain an explicit Content-Type for
  the multipart route.
- **Reducer unit tests + integration fetch-mock tests.** Reducer
  tests are fast and exhaustive; integration tests cover the
  user-visible happy path. Avoid AntD interaction tests for
  things the reducer can be tested for directly.

**Don't**:

- **Don't reach for MSW at first FE round.** Direct
  `vi.stubGlobal("fetch", …)` matches the R13 pattern, is local
  to the test file, and avoids a new dev dependency. MSW lands
  in its own track-2 round.
- **Don't promote types to `@mdd/contracts` until a second
  consumer exists.** R17 ships TS types in the feature folder.
  Move to a shared export when a CLI / server / mock consumer
  surfaces.
- **Don't try to test AntD dropdown interactions in jsdom.** They
  rely on positioning + portal rendering that the test
  environment handles inconsistently. If the value can be set
  via URL or a different affordance, prefer that path.
- **Don't conflate the workspaces page with the datasets page.**
  Workspace cards link to the filtered Datasets URL; the
  Datasets page reads the filter from the URL. No shared
  in-memory state — the URL is the contract between them.
- **Don't add codegen tooling on the first FE round.** Three
  layers of hand-alignment is fine for 6 contracts; codegen
  proves itself when drift bites.

## Open questions for future rounds

- **Wizard mid-step resume.** The reducer-driven step state
  resets on page refresh. Should we URL-sync the step? Lean: no
  until users hit it; the typical happy path is sub-minute and
  refresh is a "start over" signal.
- **Per-sheet parse re-fire on tab switch.** Currently the
  wizard fires all selected sheet parses on the Sheet → Metadata
  transition in one batch. If the user adds a sheet later and
  comes back, do we re-fire only for the new sheet? Lean: yes,
  add a `PARSE_SHEET_REFRESH` action when this surfaces in
  user testing.
- **Conformance for outgoing FE requests.** R17 hand-aligns
  request shapes; nothing validates the FE-emitted body against
  the YAML request schema. Lean: add only if a real drift bites
  (the BE's Pydantic rejects on shape mismatch — that's a
  validator-of-last-resort that catches drift in CI).
- **Promoting the methodology to `context/`.** R15 + R16 + R17
  now exists as three concrete instances. R17's Act decides.

## Promotion Candidate?

- [x] `context/` — promoted in [Round_18](../plan/cycles/Round_18.md)
      to `../context/_archive/contract-driven-feature.md`
      after R17 supplied the third instance. Bundled with the
      contract-round and BE-round memos under the single DCBF
      rule.
- [ ] `skills/` — still possibly, once `context/` settles and
      the pattern proves itself on a non-toy second feature
      (analytics queries, dashboards). Several rounds out.

See also: [[2026-05-24-contract-round-methodology]] · [[2026-05-24-be-round-conformance-pattern]].
