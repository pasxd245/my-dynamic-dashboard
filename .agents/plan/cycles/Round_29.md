# Round 29: Cross-language constants audit + replacement (focused scope)

**Status**: Review
**Date started**: 2026-05-25
**Date completed**:

## Goal

**Inherits from ← [Round_28](Round_28.md)** — R27 + R28 closed the
config half of the readiness chain (Path C: Pydantic underneath,
AppConfig facade; values.yaml as the central source). R27 shipped
one cross-language constants module (`ID_PATTERNS`) end-to-end as
the PoC; the call-site replacements were deferred to R29.

R29 takes the established pattern and extends it to the highest-
leverage magic-string sites. **Focused scope** (per the user's
"one feature per round" rule): three constant families, not the
full audit. Source-format literals (`"csv"`/`"excel"` at 27+ FE
sites) are explicitly deferred — they're already type-safe via the
existing `SourceFormat` union, so the leverage of central
generation is lower than for the three families R29 picks.

Two complementary moves:

1. **Expand `values.yaml`** with new `constants.*` sections
   (error codes, name lengths).
2. **Render generated constants modules** on both sides
   (`app/_generated/constants.py`, extend
   `src/_generated/constants.ts`) and **replace call sites**.

_Track: 1 (product readiness — POC/MVP foundation). Pulled by
R27's "R29 fills out the rest" follow-up + R28's Feeds-into
checklist. Cross-language single-source-of-truth is the highest-
leverage capability js-tmpl brings to this project; this round
exercises it across BE + FE._

## What is IN scope

- **`values.yaml` expansion** — three new sections under `constants.*`:

  ```yaml
  constants:
    id_patterns:        # R27 (already present)
      workspace: "^ws_[0-9a-f]{8}$"
      ...
    error_codes:        # R29
      not_found: "not_found"
      name_taken: "name_taken"
      non_empty: "non_empty"
    name_lengths:       # R29
      workspace_max: 80
      dataset_max: 120
  ```

  Values match what's already in the codebase — R29 is migration,
  not new shape.

- **BE generated constants module** — `workspace/config/backend/app/_generated/constants.py.hbs`
  renders to `workspace/apps/backend/app/_generated/constants.py`
  (gitignored). Contents: `ID_PATTERNS` dict, `ERROR_CODES` dict,
  `NAME_LENGTHS` dict (or `IntEnum`/`StrEnum` if cleaner).
- **FE generated constants module extended** —
  `workspace/config/builder/src/_generated/constants.ts.hbs` gains
  `ERROR_CODES` + `NAME_LENGTHS` exports alongside the existing
  ID_PATTERNS.
- **Replace call sites**:
  - **BE ID patterns (3 sites)**:
    `app/models/common.py:19`, `app/routers/workspaces.py:49`,
    `app/routers/datasets.py:386`. Each `Field(pattern=r"^ws_..." )`
    / `Path(pattern=...)` / `Query(pattern=...)` becomes
    `Field(pattern=ID_PATTERNS["workspace"])` (string passes through
    Pydantic cleanly).
  - **BE error codes (3 sites)**:
    `app/models/common.py:129/135/141` — the three `ApiErrorXxx`
    classes' `Literal[...]` types and defaults. These can be
    refactored to use a module-level `StrEnum` (Python 3.12+) for
    type safety; the Literal annotations stay as Literal-with-
    string for Pydantic's discriminated union, but the default
    string values reference `ERROR_CODES["not_found"]` etc.
  - **BE name lengths (6 sites)** — 6 `max_length=80` / `=120`
    Pydantic Fields. Each becomes
    `max_length=NAME_LENGTHS["workspace_max"]` (etc.).
  - **FE error-code branches (6 sites)** — `code === 'name_taken'`
    in 6 component/util files become
    `code === ERROR_CODES.NAME_TAKEN`.
  - **FE name-length magic numbers (4 sites)** — `maxLength={80}` /
    `{120}` and one Form rule message become
    `NAME_LENGTHS.WORKSPACE_MAX`, `NAME_LENGTHS.DATASET_MAX`.
- **Tests**:
  - **BE**: extend existing tests (or add minimal unit tests) that
    verify the constants module renders to the expected values
    (smoke import + assert dict contents).
  - **FE**: existing vitest stays green (call-site refactor is
    behavior-equivalent); no new tests required unless something
    surfaces.
- **Stamp** `crud-hygiene.md` and other affected design docs with
  a brief note that constant values are now centralized (cite R29).

## What is OUT of scope

- **Source format literals** (`"csv"` / `"excel"` at 27+ FE sites).
  Already type-safe via `SourceFormat = "excel" | "csv"` union.
  Lower leverage; defer to a future round if drift bites.
- **TanStack query keys** (`['workspaces']`, `['datasets']`). Inline
  but type-locked via `as const`. Defer.
- **AntD message types** (e.g., `"success"`, `"error"`). Component-
  level strings; AntD's typing already keeps them honest.
- **HTTP status codes** (`204`, `409`, etc.). Standardized;
  centralizing adds no leverage.
- **OpenAPI YAML pattern strings**. Per Path C resolution, contracts
  stay hand-authored — they're not generated FROM values.yaml. A
  future round may add a verification test that compares
  OpenAPI YAML strings to values.yaml regex constants if drift bites.
- **Methodology amendments**. Track-2/3 freeze still in effect.
- **R30/R31/R32 items**. Tmp sweep, UX-infra, i18n — separate rounds.

## Plan

- [x] Author Round_29.md (this file) and flip to `In Progress`.
- [x] Add `constants.error_codes` and `constants.name_lengths`
      sections to `workspace/config/values.yaml`. Values match
      what's already inline so no behavior change.
- [x] Create `workspace/config/backend/app/_generated/constants.py.hbs`
      template rendering to
      `workspace/apps/backend/app/_generated/constants.py`. Include
      a `__init__.py` at `app/_generated/` so it's importable.
- [x] Extend
      `workspace/config/builder/src/_generated/constants.ts.hbs`
      with `ERROR_CODES` + `NAME_LENGTHS` exports.
- [x] Run `pnpm config:render`; verify both generated files
      type-check + import cleanly.
- [x] Update `.gitignore` for the new BE generated path.
- [x] Replace BE call sites: 3 ID-pattern usages + 3 error-code
      Literals + 6 name-length Fields.
- [x] Replace FE call sites: 6 error-code branches + 4 name-length
      magic numbers.
- [x] Add minimal BE smoke test verifying the constants module
      loads + matches expected values.
- [x] Run `uv run pytest` (BE), `pnpm type-check` + `pnpm test` +
      `pnpm build` (FE), `pnpm --filter @mdd/contracts test`,
      `pnpm md:lint`, `pnpm format:check`.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to Review.

## Risks / unknowns

- **Pydantic `Literal[...]` types and generated constants don't
  marry cleanly.** Python's `Literal["not_found"]` is a TYPE
  annotation that needs the literal string at parse time — you
  can't `Literal[ERROR_CODES["not_found"]]` because the lookup is
  runtime. **Resolution**: keep `Literal["not_found"]` as the
  type annotation (hardcoded for Pydantic's discriminator
  benefit), use the generated constant for the **default value**
  (`code: Literal["not_found"] = ERROR_CODES["not_found"]`). Both
  point at the same string; one is type, the other is runtime.
  Or simpler: skip refactoring the Literals (they're already
  type-safe and live in one file) and just generate the constants
  for runtime use elsewhere. Lean: skip the Literal refactor —
  the type annotation IS the single source of truth on the BE
  side for the discriminator. R29's audit is satisfied by
  generating the constants module + replacing the dict-literal /
  branch sites; the BE Literal annotations stay as-is and the
  generated `ERROR_CODES` module documents them in one place.
- **Pydantic `Field(pattern=...)` accepts strings cleanly.** Per
  the contract `Field(pattern=ID_PATTERNS["workspace"])` works
  because pattern is just a string the validator compiles to regex
  at field-creation time. Confirmed working pattern.
- **`Path(pattern=...)` and `Query(pattern=...)` (FastAPI):** same
  shape as `Field`; accepts a string at call time. The R26 fix
  (aliasing `FastApiPath` to avoid the pathlib.Path collision)
  stays as-is; we just pass a constant instead of an inline string.
- **Python module import location.** `app/_generated/constants.py`
  needs `app/_generated/__init__.py` (empty file) for the package
  import to work. The .hbs template can ship both.
- **FE TS regex objects vs strings.** R27's
  `WORKSPACE_ID_PATTERN = /^ws_[0-9a-f]{8}$/;` is a RegExp object.
  No FE call sites currently use this regex inline (the FE doesn't
  validate IDs locally — it trusts the wire). R29 doesn't need to
  refactor FE ID-pattern call sites; the constants module exists
  for future code that needs them.
- **Markdownlint `+`-prefix gotcha**. Same R07-R28 carry-over.
  Lint after every MD edit.
- **R29 mid-round surprises.** Audit numbers are based on grep;
  actual replacement may surface edge cases (e.g., the regex
  appearing in test fixtures or comments where centralization
  doesn't help). Surface in Do as found.

## Do

### Audit snapshot

Pre-implementation grep counts (matches R28 Feeds-into estimates):

| Category     | BE sites                                                                             | FE sites                                     |
| ------------ | ------------------------------------------------------------------------------------ | -------------------------------------------- |
| ID patterns  | 3 (`models/common.py:19`, `routers/workspaces.py:49`, `routers/datasets.py:386+389`) | 0 (R27 already generated; no inline callers) |
| Error codes  | 3 (`models/common.py:135/141/147` Literal-default pairs)                             | 6 branch sites                               |
| Name lengths | 6 Pydantic Fields (3 in models/common.py, 2 in routers/workspaces.py, 1 router-Body) | 4 (3 maxLength props + 1 Form-rule message)  |

Source-format literals (`"csv"` / `"excel"` at 27+ FE sites)
deferred per OUT-of-scope — already type-safe via `SourceFormat`
union.

### values.yaml expansion

Two new sections under `constants.*`: `error_codes` (3 keys) +
`name_lengths` (2 keys). Values mirror existing inline strings;
R29 is migration, not new shape.

### Generated modules

- **BE**: new `workspace/config/backend/app/_generated/`
  templates render to `workspace/apps/backend/app/_generated/`
  (gitignored):
  - `__init__.py.hbs` (package marker — empty docstring file)
  - `constants.py.hbs` rendering `ID_PATTERNS`, `ERROR_CODES`,
    `NAME_LENGTHS` as typed `dict[str, str|int]` constants
- **FE**: extended
  `workspace/config/builder/src/_generated/constants.ts.hbs`
  with `ERROR_CODES` + `NAME_LENGTHS` `as const` objects (plus
  exported `ErrorCode` union type derived via `keyof`)

### BE call-site replacements

- `app/models/common.py`:
  - `WsId`, `DsId`, `TempId` type aliases — `Field(pattern=ID_PATTERNS["workspace"])` etc.
  - `Workspace.name`, `Dataset.name` — `max_length=NAME_LENGTHS["workspace_max"|"dataset_max"]`
  - `ApiErrorNotFound`, `ApiErrorNameTaken`, `ApiErrorNonEmpty`
    — `Literal["..."]` annotations stay hand-authored (Pydantic
    needs literal-type for discriminator); default values
    reference `ERROR_CODES["..."]`
- `app/routers/workspaces.py`:
  - `WsIdPath` — `Path(pattern=ID_PATTERNS["workspace"])`
  - `CreateWorkspace`, `RenameWorkspaceBody` — `max_length=NAME_LENGTHS["workspace_max"]`
- `app/routers/datasets.py`:
  - `DsIdPath` — `FastApiPath(pattern=ID_PATTERNS["dataset"])`
  - `RenameDatasetBody` — `max_length=NAME_LENGTHS["dataset_max"]`
  - `list_datasets` `workspace_id` Query — `Query(pattern=ID_PATTERNS["workspace"])`

### FE call-site replacements

- `features/data-management/_shared/types.ts`:
  - `isApiError()` narrowing — uses `ERROR_CODES.NOT_FOUND` etc.
- `features/data-management/_shared/RenameModal.tsx`:
  - `nameTaken` check — uses `ERROR_CODES.NAME_TAKEN`
- `features/data-management/workspaces/WorkspacesPage.tsx`:
  - `nameTaken` flag — uses `ERROR_CODES.NAME_TAKEN`
  - `onError` race-condition swap — uses `ERROR_CODES.NON_EMPTY`
  - Create-form rule + RenameModal `maxLength` — uses
    `NAME_LENGTHS.WORKSPACE_MAX`
- `features/data-management/datasets/upload/UploadConfirmStep.tsx`:
  - Two commit-error branch sites — use `ERROR_CODES.NAME_TAKEN`
  - Inline dataset-name `maxLength` prop — uses `NAME_LENGTHS.DATASET_MAX`
- `features/data-management/datasets/DatasetsPage.tsx`:
  - RenameModal `maxLength` — uses `NAME_LENGTHS.DATASET_MAX`

### Tests

- **BE new**: `tests/test_generated_constants.py` — 4 smoke
  tests verifying the rendered module imports, has the expected
  keys, values match the hand-authored Pydantic/Literal sites,
  and patterns compile as valid Python regex.
- **No FE test changes** — call-site refactor is behavior-
  equivalent; existing vitest 24/24 still passes.

### Verification

- `uv run pytest` — **71 / 71 BE tests passing** (was 67; +4
  generated-constants smoke tests)
- `pnpm type-check` (FE) — **0 errors**
- `pnpm test` (FE vitest) — **24 / 24 passing**
- `pnpm build` (FE) — production bundle green
- `pnpm --filter @mdd/contracts test` — **11 / 11 passing**
- `pnpm md:lint` — **0 errors across 78 files**
- `pnpm config:render` produces `default.yaml`, `.env`,
  `_generated/constants.ts`, `_generated/constants.py`,
  `_generated/__init__.py` (all 5 gitignored)

## Check

- [x] `workspace/config/values.yaml` has `constants.error_codes`
      and `constants.name_lengths` sections.
- [x] `workspace/apps/backend/app/_generated/constants.py` renders
      and imports cleanly; values match `values.yaml`.
- [x] `workspace/apps/builder/src/_generated/constants.ts` gains
      `ERROR_CODES` + `NAME_LENGTHS` exports; type-check clean.
- [x] BE call-site replacements applied (3 ID patterns + 6
      name-length fields).
- [x] FE call-site replacements applied (6 error-code branches +
      4 name-length magic numbers).
- [x] `app/_generated/` is gitignored (matches the convention).
- [x] BE smoke test for the generated module passes.
- [x] All existing tests stay green: BE pytest, FE vitest,
      contracts.
- [x] `pnpm type-check` 0 errors; `pnpm build` green.
- [x] `pnpm md:lint` 0 errors; `pnpm format:check` clean.
- [x] All Plan + Check checkboxes flipped before Status flips to
      Review.

## Act

**Status**: Review (work done; awaiting human approval per
[governance.md](../../context/governance.md)).

**Learnings**:

- **Pydantic `Literal` annotations + generated constants are
  semi-coupled.** The `Literal["not_found"]` TYPE annotation
  must be a literal at parse time — can't be a runtime lookup.
  But the DEFAULT VALUE can reference `ERROR_CODES["not_found"]`
  cleanly. Net result: the type still hand-authors the string
  (one repetition), the default flows from the central source.
  Acceptable trade-off — Pydantic's discriminator needs the
  Literal-type for narrowing.
- **`Field(pattern=...)` + `Path(pattern=...)` + `Query(pattern=...)`
  accept runtime strings cleanly.** Pydantic compiles to regex at
  field-creation time; passing `ID_PATTERNS["workspace"]` works
  identically to passing the literal. The class-attribute syntax
  evaluates the lookup at class-definition time, so the field's
  pattern is fixed by the time any validation runs.
- **The TS `as const` + `keyof` pattern is the right shape for
  generated enums.** `ERROR_CODES = { NOT_FOUND: "not_found", ... } as const`
  paired with `type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]`
  gives type-narrowing union (the same `"not_found" | "name_taken" | "non_empty"`)
  for free — no separate type declaration to drift. R32's i18n
  work can mirror this exact shape for locale enums.
- **15 sites refactored, behavior-equivalent.** Type-check + the
  full 67-test BE suite + 24-test FE suite all stayed green
  without modification. Confidence the refactor is purely
  structural.
- **Cross-language single-source-of-truth pays off here.** Three
  call-sites of `^ws_[0-9a-f]{8}$` on BE collapsed to one
  `ID_PATTERNS["workspace"]` lookup; same regex now in
  `values.yaml` (committed) and `_generated/constants.{py,ts}`
  (rendered, gitignored). Pre-commit hook re-renders on every
  commit so the rendered files stay current.
- **The R27 PoC template scaled perfectly.** R29 just expanded
  the existing `constants.ts.hbs` template with 2 more `as const`
  blocks and added the BE Python counterpart. Same render
  pipeline, no infrastructure changes.

**Promotions** _(none this round)_: implementation work. The
constants pattern (values.yaml → `_generated/constants.{py,ts}`
→ call-site imports) is now established on both sides; R32 + any
future "centralize this" round inherits it.

**Follow-ups (not promotions, just notes):**

- **Source-format literals (27+ FE sites)** still inline. Lowest-
  priority of the magic-string families (already type-safe via
  `SourceFormat` union). Pull in a future round if drift bites.
- **OpenAPI YAML pattern strings still hand-authored** per Path
  C resolution. A verification test comparing OpenAPI YAML regex
  strings to `values.yaml` constants would catch drift if it
  ever happens; deferred until concrete signal.
- **TanStack query keys still inline** (`['workspaces']`,
  `['datasets']`). Type-safe via `as const`, low-leverage; defer.
- **AntD `<Alert message=>` deprecation warnings** still
  repo-wide (R21 carry-over). R31's UX-infra cleanup round.
- **The "\_generated/" convention is now established on both
  sides** (BE `app/_generated/`, FE `src/_generated/`). Both
  gitignored. R32's i18n locale resources land in the same
  shape.
- **Visual verification of R28+R29's running app** — type-check,
  tests, and builds all green; CORS still works (R28's wiring);
  generated constants haven't been browser-tested explicitly
  but the call-site refactor is behavior-equivalent. Pull a
  visual walk as a small post-R29 task whenever convenient.

## Feeds into → Round_30 (Tmp upload sweep + error boundary + visual-verification gate)

What R29 hands forward:

- **Two extended `_generated/` modules**: `app/_generated/constants.py`
  (new) + `src/_generated/constants.ts` (extended). 15 call-site
  refactors landed. Single source of truth proven across BE +
  FE.
- **`workspace/config/values.yaml` expanded** with two new
  sections (`error_codes`, `name_lengths`); the schema is now
  ready for R30+ to add their own sections if needed
  (e.g., `tmp_upload.ttl_hours`).
- **71 BE tests** (was 67; +4 generated-constants smoke tests).
  Coverage net for the readiness chain stays tight.
- **Three deferred items** named in Follow-ups (source formats,
  OpenAPI verification, query keys). None blocking.

R30 picks up the runtime/UX hygiene items js-tmpl can't help
with: tmp upload sweep (24h TTL job documented since R16,
never built — stale dirs on disk right now), error boundary on
the FE (errors → white screen today), and a visual-verification
discipline gate (codify the "run the app before Review" step that
R26 made obvious). R31 picks up UX-infra (global toast, skeletons,
AntD deprecation cleanup). R32 picks up i18n readiness
(consuming the locale placeholder R27 seeded, R28's
`appConfig.i18nLocale()`, and the constants pattern R29 proved
out).

R30 picks up specifically:

- **Two new generated modules**: BE `app/_generated/constants.py`
  and FE `src/_generated/constants.ts` (extended). Pattern proven
  on both sides.
- **15 call-site replacements** across BE + FE (3+6 BE, 6+4 FE).
  All behavior-equivalent; type-check + tests prove no regression.
- **Source-format literals deferred** — 27+ FE sites still inline.
  Future round can pull if drift bites.
- **OpenAPI YAML still hand-authored** — per Path C; a verification
  test could be added if values.yaml ↔ OpenAPI regex drift becomes
  a real risk.

R30 picks up the runtime/UX hygiene items (tmp upload sweep,
error boundary, visual-verification gate) — the runtime items
js-tmpl can't help with. R31 picks up UX-infra (global toast
config, skeletons, AntD deprecation cleanup). R32 picks up i18n
readiness (consumes the values.yaml `i18n.locale` already wired
through R27's `VITE_I18N_LOCALE` + R28's `appConfig.i18nLocale()`).
