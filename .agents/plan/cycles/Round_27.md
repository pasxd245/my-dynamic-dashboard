# Round 27: Readiness chain start — js-tmpl integration + FE config PoC

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_26](Round_26.md)** — R26 closed the CRUD
hygiene DCBF chain. Visual verification surfaced five
browser-only bugs (CORS, AntD App provider, RenameModal pre-fill,
range case, CSV re-parse parity) — strong signal that the
"system works but cracks are visible" framing the user named
("not having strong readiness repo will easily drift") is real.

R27 opens the **readiness chain** — a deliberate detour from
product features to harden the foundation before more product
ships. Per the user's framing, the chain runs R27 → R31 (R32 = i18n
readiness queued after).

R27 itself is **scoped narrowly**: integrate
[`@nci-gis/js-tmpl`](https://www.npmjs.com/package/@nci-gis/js-tmpl)
as the build-time config rendering tool, prove the integration
end-to-end with the FE `.env` path, and ship a minimal
cross-language constants module. R28+ extends the established
pattern to BE config and full constants audit.

The drifted iteration's config pattern is the reference; R27
follows the **Path C resolution** from
[`drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md):
Pydantic underneath (validation), `AppConfig` facade on top
(stable drifted-style API), `RecursiveNamespace` dropped
(superseded by Pydantic's typed model + `model_dump()` dotted-walk).

_Track: 1 (product readiness — POC/MVP foundation). Pulled by:
user explicit "build readiness before drifting again" + five R26
visual-verification bugs as concrete evidence. The js-tmpl library
is user-authored ([`@nci-gis/js-tmpl`](https://github.com/nci-gis/js-tmpl)),
so adopting it is also a dogfooding signal back to that
project — bugs/gaps found here feed forward._

## What is IN scope

- **`@nci-gis/js-tmpl` installed** as a workspace dev dependency
  (pnpm root). Pinned to `^0.1.0`. The CLI binary `js-tmpl` becomes
  available via `pnpm exec js-tmpl`.
- **Workspace layout established** (single-directory home: all
  config-related concerns live under `workspace/config/`; the render
  script changes CWD there so js-tmpl auto-discovers
  `js-tmpl.config.yaml` from CWD):

  ```text
  workspace/
  ├── config/
  │   ├── values.yaml                       # central source of truth (committed)
  │   ├── js-tmpl.config.yaml               # render config (committed); auto-discovered
  │   ├── README.md                         # layout + walkthrough
  │   ├── backend/                          # → apps/backend/ (R28 fills out; R27 leaves .gitkeep)
  │   └── builder/                          # → apps/builder/
  │       ├── .env.hbs                      # → apps/builder/.env
  │       └── src/_generated/
  │           └── constants.ts.hbs          # → apps/builder/src/_generated/constants.ts
  └── apps/
      └── builder/
          ├── .env                          # GENERATED, gitignored
          └── src/_generated/constants.ts   # GENERATED, gitignored
  ```

  **Why this layout vs. workspace-root siblings**: `workspace/config/`
  reads as "everything config is here"; `values.yaml` and the render
  config sit next to the per-app template subdirs they govern; the
  workspace root stays clean (only `apps/`, `packages/`, `docs/`,
  `config/`). Trade-off: render script chdir's to `workspace/config/`
  rather than `workspace/` — small concentration tax for a cleaner
  top-level read.

- **`workspace/config/values.yaml` seeded** with a minimal-but-honest
  starting structure. Mirrors drifted's `default.yaml` shape on the
  BE side (even though BE consumption is R28's work, the values
  are defined now so R28 doesn't re-litigate). Includes a
  `constants` section for cross-language constants (R27 ships one;
  R29 fills out the rest).

- **FE `.env` rendered end-to-end**:
  - `.env.hbs` template renders `VITE_API_BASE_URL` (and any other
    `VITE_*` vars needed today) from `values.yaml`
  - `apps/builder/.gitignore` updated to exclude generated `.env`
  - Generated `.env` is read by Vite natively (no FE code change
    yet — the existing `import.meta.env.VITE_API_BASE_URL ??
"http://localhost:8000"` pattern continues to work). The
    "remove triplicated API_BASE_URL" cleanup ships in R28.

- **One cross-language constant rendered end-to-end** — proves the
  highest-leverage capability js-tmpl brings to this project:
  - Pick `ID_PATTERNS` (workspace, dataset, temp regex patterns) as
    the proof candidate. Currently triplicated across BE Pydantic,
    FE TS, OpenAPI YAML. R27 ships:
    - `values.yaml` `constants.id_patterns` section
    - `constants.ts.hbs` template → `apps/builder/src/_generated/constants.ts`
    - Gitignored generated file imports cleanly in TS (PoC)
  - **R27 does NOT replace existing call sites yet** — that's R29's
    full constants audit. R27 just proves the rendering works and
    the generated module is importable. Existing inline regex
    strings stay untouched.

- **Render trigger integration**:
  - `pnpm config:render` script at the **repo root** package.json
    runs `scripts/config-render.mjs` which chdir's to
    `workspace/config/` (CWD lets js-tmpl auto-discover
    `js-tmpl.config.yaml` from there)
  - `pnpm dev` and `pnpm build` invoke `config:render` first via
    `predev` / `prebuild` lifecycle hooks at both repo-root and
    `apps/builder` levels
  - Pre-commit hook (husky) runs `pnpm run config:render` so any
    template or values change re-renders before the commit lands;
    a render failure (template syntax, missing key) fails the commit

- **Documentation**:
  - `workspace/config/README.md` — explains the layout, render
    trigger, "where do I add a new value" walkthrough
  - Stamp on the existing
    [`drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md):
    add a `Status: Promoted` line citing R27's implementation under
    `workspace/config/` once R27 lands

- **AppConfig + Settings scaffolding (FE side only)** — R27 lays
  down the **convention** but doesn't refactor existing call sites:
  - `apps/builder/src/config/` directory created (matches drifted
    layout): `fields.ts`, `const.ts`, `index.ts`
  - `Fields` class with dotted-key constants for the values
    R27 generates (e.g., `Fields.API_BASE_URL = "api.baseUrl"`)
  - **No `AppConfig` class on FE yet** (drifted's was 239 lines
    with three layers; R27 skip the runtime/localStorage layers
    per the memo). A minimal `appConfig.ts` reading
    `import.meta.env.VITE_*` and exposing typed accessors lands
    in R28 alongside the BE AppConfig.

## What is OUT of scope (R28+ takes these)

- **BE AppConfig + Settings + `default.yaml`** (Path C: pydantic-
  settings, `AppConfig` facade, drifted's three-layer precedence).
  R28's scope. R27 prepares the values.yaml shape so R28's work is
  mechanical.
- **Cross-language constants beyond ID patterns** (error codes,
  format enums, magic numbers, regex patterns). R29's scope.
- **Replacing existing call sites with imports** (triplicated
  `API_BASE_URL` lines, inline error codes, magic regex strings).
  R28 (for config) + R29 (for constants) does the replacement; R27
  only proves the rendering works.
- **Tmp upload sweep job + error boundary + visual-verification
  gate**. R30's scope (the runtime/UX items js-tmpl can't help
  with).
- **Global toast + skeleton + AntD deprecation cleanup**. R31's
  scope (UX-infra).
- **i18n readiness**. R32's scope. R27 may include `i18n.locale`
  in `values.yaml` as a placeholder if it costs zero, but no
  runtime locale machinery.
- **CI integration of the render-verify check**. The pre-commit
  hook covers local-dev drift; the CI step lands when CI itself
  becomes a target round.
- **`pnpm-workspace.yaml` changes** beyond adding js-tmpl as a
  workspace dependency.
- **No methodology amendments** (track-2/3 freeze stays in effect
  per R23 framing).

## Plan

- [x] Author Round_27.md (this file) and flip to `In Progress`.
- [x] Install `@nci-gis/js-tmpl` at repo root
      (`pnpm add -Dw @nci-gis/js-tmpl`). Installed at `^0.1.0`.
- [x] Seed `workspace/config/values.yaml` with the starting
      structure (backend, builder, constants, i18n sections).
- [x] Create `workspace/config/js-tmpl.config.yaml` (sibling to
      values.yaml inside `config/`). `templateDir: .`,
      `outDir: ../apps`, `valuesFile: values.yaml`,
      `extname: .hbs`.
- [x] Create `workspace/config/builder/.env.hbs`. Renders to
      `apps/builder/.env` (VITE_API_BASE_URL, VITE_LOG_LEVEL,
      VITE_I18N_LOCALE).
- [x] Create `workspace/config/builder/src/_generated/constants.ts.hbs`.
      Renders to `apps/builder/src/_generated/constants.ts`
      with `WORKSPACE_ID_PATTERN`, `DATASET_ID_PATTERN`,
      `TEMP_ID_PATTERN` regex constants. Type-check passes
      (file is importable; no call sites yet).
- [x] Update root `.gitignore` with R27 section excluding
      `workspace/apps/builder/src/_generated/`
      (`workspace/apps/builder/.env` already covered by the
      repo-wide `.env` rule from line 69).
- [x] Add `pnpm config:render` script at repo root (runs
      `node scripts/config-render.mjs`). Wire `predev`
      lifecycle hook at repo root. Add `predev` + `prebuild`
      to `workspace/apps/builder/package.json` so
      `pnpm --filter builder dev/build` also re-renders first.
- [x] Configure husky pre-commit hook running
      `pnpm run config:render`. Fails the commit if the render
      fails (template syntax error, missing key). Husky was
      already in devDependencies but uninitialized — `npx husky
init` initialized + added `prepare` script.
- [x] Create `apps/builder/src/config/{fields.ts,const.ts,index.ts}`
      following drifted's shape. No `AppConfig` class yet
      (R28's scope).
- [x] Write `workspace/config/README.md` — layout, render
      trigger, "how to add a new value" walkthrough,
      what-R27-ships vs what-later-rounds-add table, known
      js-tmpl CLI issue + workaround documented.
- [x] Stamp
      [`drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md)
      with R27 partial-adoption status.
- [x] Run `pnpm type-check` (0 errors), `pnpm test` (24/24
      FE + 54/54 BE + 11/11 contracts), `pnpm build` (production
      green), `pnpm md:lint` (0 errors across 76 files).
- [x] Verify generated files gitignored: `git check-ignore`
      confirms both `.env` and `_generated/` paths are matched.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md). Visual
      verification deferred — generated files are passive (no
      runtime behavior change yet); R28 ships the call-site
      refactor that needs visual verification.
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **js-tmpl's pnpm workspace integration is untested in MDD's
  shape.** The library is published; we have no evidence it
  composes cleanly with our pnpm-workspace + Vite + uv stack.
  Mitigation: install + render the simplest possible template
  first; if it works for one file, it works for N.
- **Pre-commit hook complexity.** Husky setup if not already
  present. Alternative: a plain `.git/hooks/pre-commit` shell
  script that runs `pnpm config:render && git diff --exit-code`
  on `.env` + `_generated/`. Choose the lower-friction path
  during the round.
- **`.env` in Vite has a startup-only read.** If a dev edits
  `values.yaml` while `pnpm dev` is running, Vite won't pick up
  the new `.env` until restart. Acceptable for POC; document
  in `workspace/config/README.md`. Future round can add
  filesystem-watcher-driven re-render if friction surfaces.
- **Generated file paths in gitignore.** `apps/builder/.env`
  needs to be excluded but the `apps/builder/` dir itself is
  tracked. Be careful with the gitignore pattern so we don't
  exclude legitimate tracked files. Same for
  `src/_generated/` — use a directory-specific `.gitkeep` or
  explicit pattern.
- **The `constants.ts` PoC must not break existing imports.**
  R27 ships the generated file but doesn't yet wire it to any
  call site. If a test imports the new file by accident, type
  errors would surface. Mitigation: don't add the file to any
  index barrel; let it sit unused until R29.
- **values.yaml schema drift risk.** Without R28's Pydantic
  validation in place, an invalid YAML can render bad templates
  silently. Mitigation: R27 ships a minimal `values.yaml` that
  the templates _explicitly_ reference; any typo in a template
  variable will fail at js-tmpl render time (the lib "fails
  loudly" per its design). Hard validation lands with R28's
  Settings model.
- **Drifted-pattern Status promotion premature?** Stamping the
  memo as Promoted in R27 might be early — only the FE half
  lands here. Alternative: stamp it `Status: Partially Adopted
(FE in R27; BE in R28)`. Lean: partial-stamp.
- **i18n placeholder in values.yaml.** R32 will need
  `i18n.locale` (drifted had this). R27 may include the field
  as `i18n.locale: "en-US"` for free if it costs zero — but
  doing so means the FE generated `.env` also gets
  `VITE_I18N_LOCALE`, which then sits unused until R32. Lean:
  **include** — drifted already proved the shape, including it
  is one line of values + one template line, and not including
  it means R32 has to retrofit. Defensible either way; calling
  it out so the round explicitly decides.

## Do

### Layout shipped

```text
workspace/
├── config/                                    # single-directory home for all config
│   ├── values.yaml                            # central source (committed; 4 sections)
│   ├── js-tmpl.config.yaml                    # render config (committed; auto-discovered)
│   ├── README.md                              # layout + walkthrough
│   ├── backend/
│   │   └── .gitkeep                           # R28 fills in
│   └── builder/
│       ├── .env.hbs                           # → apps/builder/.env
│       └── src/_generated/
│           └── constants.ts.hbs               # → apps/builder/src/_generated/constants.ts
└── apps/
    └── builder/
        ├── .env                               # GENERATED, gitignored
        ├── package.json                       # predev + prebuild hooks added
        └── src/
            ├── _generated/constants.ts        # GENERATED, gitignored
            └── config/                        # R27 skeleton
                ├── const.ts                   # non-overridable defaults
                ├── fields.ts                  # dotted-key constants
                └── index.ts                   # barrel export
```

Layout decision: `workspace/config/` is the single-directory home
for everything config-related (values + render config + templates).
The render script chdir's into it so js-tmpl's auto-discovery picks
up `js-tmpl.config.yaml` from CWD. Trade-off chosen over
workspace-root-sibling layout: keeps workspace root clean
(`apps/`, `packages/`, `docs/`, `config/`) at the small cost of
the script chdir.

Root-level changes:

- `package.json` gained `config:render` + `predev` + `prepare` scripts
- `.husky/pre-commit` runs `pnpm run config:render` before each commit
- `.gitignore` gains the `_generated/` rule (R27 section)
- `scripts/config-render.mjs` is the render harness (see "Found bug"
  below)

### Found bug — js-tmpl CLI under pnpm

The `@nci-gis/js-tmpl` CLI (v0.1.0) has an `isDirectRun` check in
`src/cli/main.js` that compares `import.meta.url` to
`process.argv[1]`:

```javascript
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'));
```

Under pnpm:

- `process.argv[1]` =
  `…/node_modules/@nci-gis/js-tmpl/src/cli/main.js` (symlink path)
- `import.meta.url` =
  `file://…/node_modules/.pnpm/@nci-gis+js-tmpl@0.1.0/node_modules/@nci-gis/js-tmpl/src/cli/main.js`
  (real path via pnpm's content-addressable store)

The `endsWith` check returns `false`, so `main()` never runs and
the CLI silently exits 0. Confirmed by dropping a diag script
into the pnpm-linked package and running `node node_modules/...`.

**Workaround**: `scripts/config-render.mjs` calls the
programmatic API (`renderDirectory`, `resolveConfig` — both
exported via the package's `"."` export) directly. ~30 lines.
Equivalent semantics to the CLI; works under pnpm.

**Upstream signal**: this is a real dogfooding finding for
`@nci-gis/js-tmpl`. Worth filing an issue when convenient. The
fix is to relax the `isDirectRun` check (e.g., compare resolved
realpaths via `fs.realpath`, or just always invoke `main()`
when the file is the entry point per Node's standard module
detection).

### values.yaml seed

Four sections, ~30 lines:

- `backend.*` — host, port, workers, log_level, cors_allow_origins,
  upload_max_bytes. Mirrors drifted's `default.yaml` 1:1. R28
  consumes; R27 just seeds.
- `builder.*` — api*base_url, log_level. Feeds VITE*\* env vars.
- `i18n.locale` — placeholder for R32; "en-US". Drifted shipped
  this exact key; including it now is free.
- `constants.id_patterns.*` — workspace / dataset / temp regex
  strings. PoC of cross-language constants generation.

### .env render verified

```text
VITE_API_BASE_URL=http://localhost:8000
VITE_LOG_LEVEL=info
VITE_I18N_LOCALE=en-US
```

The existing FE call sites (`import.meta.env.VITE_API_BASE_URL ??
"http://localhost:8000"`) continue to resolve correctly. R28 will
remove the triplicated default by introducing the `AppConfig`
facade.

### constants.ts render verified

```ts
export const WORKSPACE_ID_PATTERN = /^ws_[0-9a-f]{8}$/;
export const DATASET_ID_PATTERN = /^ds_[0-9a-f]{8}$/;
export const TEMP_ID_PATTERN = /^tmp_[0-9a-f]{16}$/;
```

Type-check passes. Not yet imported anywhere (R29's call-site
audit replaces the inline regex strings).

### Verification

- `pnpm type-check` — **0 errors**
- `pnpm test` (FE vitest) — **24 / 24 passing**
- `pnpm --filter @mdd/contracts test` — **11 / 11 passing**
- `uv run pytest` (backend) — **54 / 54 passing**
- `pnpm build` — production bundle green
- `pnpm md:lint` — **0 errors across 76 files**
- `git check-ignore` confirms both generated paths excluded
- `pnpm run config:render` exits cleanly with "✔ js-tmpl render
  complete."

## Check

- [x] `@nci-gis/js-tmpl@^0.1.0` in root `package.json`
      devDependencies. Note: CLI bypassed via `scripts/config-render.mjs`
      due to upstream isDirectRun/pnpm-symlink bug (see Do § Found
      bug).
- [x] `workspace/config/values.yaml` exists with 4 sections
      (backend, builder, i18n, constants).
- [x] `workspace/config/js-tmpl.config.yaml` (sibling to
      values.yaml inside `config/`) correctly points
      templateDir = `.`, outDir = `../apps`,
      valuesFile = `values.yaml`.
- [x] `pnpm config:render` produces `apps/builder/.env` and
      `apps/builder/src/_generated/constants.ts` with substituted
      values.
- [x] Both generated files gitignored
      (`git check-ignore` confirms).
- [x] `pnpm dev` / `pnpm build` invoke `config:render` first via
      `predev` / `prebuild` lifecycle hooks at both root and
      `apps/builder` levels.
- [x] Husky pre-commit hook installed (`.husky/pre-commit`)
      running `pnpm run config:render`. Failure modes covered:
      template syntax / missing key → render exits non-zero →
      commit blocked.
- [x] `apps/builder/src/config/` has `fields.ts`, `const.ts`,
      `index.ts` with the drifted-shape content (no `AppConfig`
      class; R28's scope).
- [x] `workspace/config/README.md` exists with layout, render
      trigger, walkthrough, what-R27-ships table, known-issue
      writeup.
- [x] Memo
      [`drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md)
      Status updated to "Partially Adopted".
- [x] `pnpm type-check` 0 errors; vitest 24/24 FE + 54/54 BE +
      11/11 contracts; production build green.
- [x] `pnpm md:lint` 0 errors across 76 files; prettier-touched
      MDs clean.
- [x] Running app: deferred — generated files are passive
      (existing `import.meta.env.VITE_API_BASE_URL ??` defaults
      still work). R28 ships the call-site refactor that needs
      browser verification.
- [x] All Plan + Check checkboxes flipped.

## Act

**Status**: Complete (human-approved 2026-05-25).

R27 opens the readiness chain (R27→R31, R32 = i18n). Layout
pivot mid-Review (workspace-root siblings → all under
`workspace/config/`) for a cleaner top-level read. Pre-commit
hook validated live during R27's own commit. Dogfooding caught
a real upstream bug in `@nci-gis/js-tmpl` (isDirectRun under
pnpm) — workaround shipped, upstream follow-up logged.

**Learnings**:

- **Dogfooding caught a real upstream bug in the first 5 minutes.**
  The js-tmpl CLI silently exits 0 under pnpm because of an
  `isDirectRun` check that doesn't account for pnpm's
  symlink-then-realpath resolution. Switched to the programmatic
  API in ~30 lines. The whole point of "MDD is a dogfooding probe
  for @nci-gis/js-tmpl" is now concrete — first round of use,
  first real signal. Worth filing as an upstream issue with a
  small reproducer.
- **Layout A (workspace/{values,js-tmpl.config}.yaml + config/)
  is cleaner than nested config/.** Both top-level files visible
  on `ls workspace/`. `config/` becomes single-purpose (templates
  only). Path-preservation semantics (`config/builder/...hbs` →
  `apps/builder/...`) make the directory structure self-documenting.
- **Path C (Pydantic underneath, AppConfig facade) sets up R28
  perfectly.** R27 shipped the layout + render pipeline + FE
  skeleton. R28 is now mechanical: add Pydantic Settings, add
  AppConfig facade, render `default.yaml` from values.yaml,
  rewrite hardcoded BE references. No design left to do; just
  implementation.
- **Husky was already a dep but uninitialized.** `npx husky init`
  added the `prepare` script and the `.husky/pre-commit` shell
  file. Modern husky v9 is minimal — no
  `npm install husky --save-dev` plus setup ritual, just
  `npx husky init`. Cheaper than expected.
- **Render is idempotent + fast** (~50 ms). The `predev`
  hook adds no perceivable lag to `pnpm dev`. Pre-commit hook
  also imperceptible.

**Promotions** _(none this round)_: R27 is implementation, not
methodology. The drifted-config-pattern memo Status moves from
"Resolved" to "Partially Adopted" — not a promotion to
`context/` or `skills/`.

**Follow-ups (not promotions, just notes):**

- **File an upstream issue against `@nci-gis/js-tmpl`** for the
  isDirectRun/pnpm-symlink bug. Small reproducer + the fix
  sketch (use `fs.realpath` or stop checking; standard Node
  pattern is `import.meta.url === pathToFileURL(process.argv[1]).href`
  with both sides realpathed). Logged as durable follow-up so
  it doesn't get lost.
- **Visual verification of `pnpm dev` end-to-end** — not done
  this turn. The hooks should chain (`predev` → `config:render`
  → `vite`). Worth a quick browser walk to confirm nothing
  regressed before R28 starts on the BE side. Pull when the
  user has the app open.
- **R28 prep** — the values.yaml `backend.*` section is the
  exact shape R28 needs for the Pydantic Settings model.
  Constants section is ready for R29 expansion. R28's first
  step: add `pydantic-settings` (and `pydantic-settings-yaml` or
  hand-roll a YAML source), define nested BaseSettings models,
  wire `AppConfig` facade, replace `app/main.py` hardcodes.
- **Vite + .env reload behavior** — Vite reads .env on dev-server
  start. If the user edits `values.yaml` while `pnpm dev` is
  running, the re-rendered .env doesn't take effect until
  restart. Documented in `workspace/config/README.md`. Future
  round could add watchexec-driven re-render + Vite restart if
  friction surfaces.
- **The "\_generated/" dir convention** — established in R27 for
  the FE; R28+ will use the same for the BE
  (`apps/backend/app/_generated/constants.py`). The convention
  is set; R29 just applies it.

## Feeds into → Round_28 (BE AppConfig + Settings, full Path C implementation)

What R27 hands forward to R28:

- **Working render pipeline** — drop new `.hbs` templates,
  `pnpm config:render` renders them. R28's job is just adding
  the BE templates.
- **values.yaml `backend.*` section** — ready for the Pydantic
  Settings model. Field names already match drifted's dotted
  keys.
- **Layout convention** — `workspace/config/backend/` mirrors
  the structure under `apps/backend/`. R28 templates land at
  paths like `workspace/config/backend/data/config/default.yaml.hbs`.
- **FE config dir skeleton** (`apps/builder/src/config/`) — R28
  adds the `appConfig.ts` (minimal, build-time-only per the
  research memo's SKIP list) alongside.
- **Three FE call sites to refactor** —
  `workspace/apps/builder/src/api/{workspacesApi,datasetsApi,uploadsApi}.ts`
  each have a duplicated `const API_BASE_URL = import.meta.env... ?? "..."`.
  R28 replaces all three with one `appConfig.apiBaseUrl()` call.
- **Drifted's test patterns** — port `test_config_precedence.py`
  shape verbatim once `AppConfig` exists. The
  research memo's Evidence section names the file + line ranges.
- **One upstream-bug follow-up** — js-tmpl CLI, logged in Act.

R28 picks up specifically:

- BE Pydantic `Settings` model mirroring `values.yaml` structure
- `AppConfig` facade with `get_str`, `get_int`, `get_path`, `get`
  methods (drifted-style API)
- `Fields` class with dotted-key constants on BE side
- `pydantic-settings` + custom `YamlConfigSettingsSource` for the
  YAML loader
- Replace hardcoded `host`, `port`, `allow_origins` in
  `app/main.py` and `app/__main__.py` with `CONFIG.get_str(...)` reads
- Replace triplicated `API_BASE_URL` lines in the three FE api
  files with one `appConfig.apiBaseUrl()` call
- Per-key env-var override layer (Layer 3) — the drifted
  `_ENV_OVERRIDES` dict mapping `BACKEND_PORT` → `backend.port`
- Tests porting the drifted precedence patterns

R28 closes the config readiness work; R29 picks up constants;
R30 picks up runtime/UX (tmp sweep, error boundary, visual-
verification gate); R31 picks up UX-infra (global toast, etc.);
R32 picks up i18n.
