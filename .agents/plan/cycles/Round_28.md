# Round 28: BE AppConfig + Settings (Path C implementation)

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_27](Round_27.md)** — R27 shipped the
js-tmpl render pipeline, the `workspace/config/` single-directory
home, FE `.env` rendering, and one cross-language constants module
end-to-end. The BE side was prepared via `workspace/config/values.yaml`
`backend.*` section (mirrors drifted's `default.yaml` shape) but not
yet consumed.

R28 implements the **Path C resolution** from
[`drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md):
Pydantic underneath (validation at load time), `AppConfig` facade on
top (stable drifted-style API), drifted's three-layer precedence
(packaged defaults → file override via `MDD_CONFIG_FILE` → per-key
env-var overrides).

Two halves, one feature:

1. **BE half (the bulk)**: render `default.yaml` from `values.yaml`;
   add `Settings` + `AppConfig` + `Fields` + `Const` modules; replace
   the four BE hardcoded values (`host`, `port`, `allow_origins`,
   `upload_max_bytes`); port drifted's precedence tests.
2. **FE half (small)**: add a minimal `appConfig.ts` wrapping
   `import.meta.env.VITE_*`; replace the three duplicated
   `API_BASE_URL` lines across the api clients with one
   `appConfig.apiBaseUrl()` call.

_Track: 1 (product readiness — POC/MVP foundation). Pulled by R27's
chain declaration. Drifted-pattern reference: drifted's
`apps/backend/app/shared.py` (`AppConfig`, `Fields`, `Const`,
layered `load_config()`), `apps/backend/app/resources/default.yaml`
(packaged baseline), `apps/backend/tests/integration/test_config_precedence.py`
(test patterns). All cited in the research memo's Evidence section._

## What is IN scope

- **`pydantic-settings` dep** added to backend `pyproject.toml` (+ a
  custom `YamlConfigSettingsSource` subclass — ~20 lines, hand-rolled
  instead of pulling a third-party YAML source plugin). Stays
  consistent with drifted's "no unnecessary deps" rule.
- **BE template** at `workspace/config/backend/data/config/default.yaml.hbs`
  rendering to `workspace/apps/backend/data/config/default.yaml`
  (gitignored). Content: the `backend.*` section of `values.yaml`,
  flattened into the same YAML shape drifted shipped at
  `app/resources/default.yaml`.
- **BE Pydantic models** in
  `workspace/apps/backend/app/_config/` (new directory):
  - `BackendSettings(BaseModel)` — `host`, `port`, `workers`,
    `log_level`, `cors_allow_origins`, `upload_max_bytes`
  - `Settings(BaseSettings)` — nested with `backend: BackendSettings`,
    plus `model_config` declaring the YAML source + env precedence
  - All `extra='forbid'` per the R16 conformance discipline
- **`AppConfig` facade** in `app/_config/app_config.py`:
  - `__init__(settings: Settings)` stores both the typed model and
    `settings.model_dump()` for dotted-key access
  - `.get(dotted_key, default)` — dotted-walk on the dumped dict
  - `.get_str(key, default)`, `.get_int(key, default)`,
    `.get_path(key, default)` — typed accessors
  - `.settings` property exposes the typed Pydantic instance for
    callers who prefer IDE autocomplete
  - Module-level singleton `CONFIG = AppConfig(Settings())` resolved
    at import time
- **`Fields` class** in `app/_config/fields.py` with dotted-key
  constants: `BACKEND_HOST = "backend.host"`, `BACKEND_PORT =
"backend.port"`, etc. Used at call sites to avoid magic strings.
- **`Const` class** in `app/_config/const.py` with non-overridable
  app-level constants: `APP_NAME = "my-dynamic-dashboard-backend"`,
  log format strings if any, etc. Minimal for now.
- **`__init__.py`** re-exports `CONFIG`, `Settings`, `Fields`,
  `Const`, `AppConfig` from the `_config` package.
- **Replace four BE hardcodes**:
  - `app/main.py:25` `allow_origins=["http://localhost:3000"]` →
    `allow_origins=CONFIG.settings.backend.cors_allow_origins`
  - `app/main.py:30` `allow_methods=["GET", "POST", "PATCH", "DELETE"]`
    — leave as-is for R28 (still hardcoded; future round adds an
    HTTP-methods config section if needed)
  - `app/__main__.py:5` `host="0.0.0.0", port=8000` →
    `CONFIG.settings.backend.host, CONFIG.settings.backend.port`
  - `app/routers/uploads.py:40` `MAX_UPLOAD_BYTES = 100 * 1024 * 1024`
    → `CONFIG.settings.backend.upload_max_bytes` (the module-level
    constant becomes a `CONFIG`-derived lookup; touching the
    minimum number of lines)
- **Three-layer precedence implementation** (drifted's exact shape):
  - Layer 1: rendered `default.yaml` (from values.yaml via js-tmpl)
  - Layer 2: optional `MDD_CONFIG_FILE=<path>` env-var override yaml
  - Layer 3: per-key env-var overrides via `_ENV_OVERRIDES` dict
    (e.g., `BACKEND_PORT` → `backend.port`)
  - All three plumbed through `pydantic-settings`'s
    `settings_customise_sources()` classmethod hook
- **FE half**:
  - New `workspace/apps/builder/src/config/appConfig.ts` (~30 lines)
    — singleton with typed accessors. Build-time-only layer (per
    R23-research SKIP list: no runtime fetch, no localStorage).
    Reads `import.meta.env.VITE_*`, falls back to `Const`.
  - Update `workspace/apps/builder/src/config/index.ts` to export
    `appConfig`, `useAppConfig` (or skip the hook per the memo SKIP).
  - Replace three triplicated lines in
    `workspace/apps/builder/src/api/{workspacesApi,datasetsApi,uploadsApi}.ts`:
    each has `const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";`
    → `import { appConfig } from "../features/.../config";` + use
    `appConfig.apiBaseUrl()` at call sites.
- **BE tests** (port drifted's precedence patterns):
  - `tests/test_app_config_precedence.py` (new): defaults-only,
    env-override-wins, config-file-override-wins, env-beats-file
  - `tests/test_app_config.py` (new): the AppConfig facade's
    accessors (`get`, `get_str`, `get_int`, dotted-walk)
  - Existing tests stay green (the hardcoded values become
    config-derived but with same defaults)
- **Stamp**
  [`drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md):
  upgrade Status from "Partially Adopted" to "Adopted" (both halves
  now landed).

## What is OUT of scope

- **Constants/enums audit** (error codes, format enums, magic
  numbers). R29's scope.
- **Tmp upload sweep / error boundary / visual-verification gate**.
  R30's scope.
- **UX-infra**. R31's scope.
- **i18n locale machinery**. R32's scope (values.yaml `i18n.locale`
  remains a placeholder; R28 just makes it readable via `CONFIG`).
- **`recursivenamespace` dep**. Per Path C the typed Pydantic model
  IS the dotted-attribute mechanism; no third-party namespace wrapper.
- **FE runtime config fetch (Layer 2)** and **localStorage Layer 3**.
  Per research memo SKIP list — drifted complexity not needed for POC.
- **`appConfig.all()` source-attribution debug method**. Per SKIP
  list.
- **`useAppConfig()` React hook**. Per SKIP list (no async init
  needed without runtime fetch).
- **Cross-language constants beyond the R27 ID_PATTERNS PoC**. R29.
- **`DeploymentEnvironment.validate()` strict checks**. Per DEFER
  list in the memo.
- **Replacing `allow_methods` hardcode**. The list is HTTP-protocol-
  level rather than deployment-config; leave for a future round if
  a real reason emerges.

## Plan

- [x] Author Round_28.md (this file) and flip to `In Progress`.
- [x] Add `pydantic-settings` to backend `pyproject.toml`; `uv sync`.
- [x] Create `workspace/apps/backend/app/_config/` package:
      `__init__.py`, `const.py`, `fields.py`, `app_config.py`,
      `settings.py` (Pydantic models + custom YAML source).
- [x] Create `workspace/config/backend/data/config/default.yaml.hbs`;
      run `pnpm config:render`; verify
      `workspace/apps/backend/data/config/default.yaml` renders with
      the expected fields.
- [x] Verify Pydantic Settings loads the rendered YAML cleanly via a
      smoke import.
- [x] Replace the four BE hardcodes in `app/main.py`,
      `app/__main__.py`, `app/routers/uploads.py`. Confirm imports +
      structure don't break.
- [x] Add `tests/test_app_config_precedence.py` and
      `tests/test_app_config.py`. Run `uv run pytest` — all green.
- [x] FE: add `workspace/apps/builder/src/config/appConfig.ts`.
- [x] FE: replace 3 `API_BASE_URL` triplications with
      `appConfig.apiBaseUrl()`. Run type-check + vitest.
- [x] Stamp `drifted-config-pattern-research.md` Status: Adopted.
- [x] Run `pnpm md:lint`, `pnpm format:check`, `pnpm build` (FE),
      `uv run pytest` (BE), `pnpm --filter @mdd/contracts test`.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to Review.

## Risks / unknowns

- **`pydantic-settings` YAML source.** The library doesn't ship YAML
  loading natively (it's TOML + .env + secret files OOTB). A custom
  source subclass is ~20 lines. Reference: pydantic-settings docs
  on `settings_customise_sources()`.
- **Singleton load timing.** Drifted's `CONFIG = AppConfig()` resolves
  at module import. If `default.yaml` doesn't exist at import time
  (fresh clone, never rendered), the singleton fails. Mitigations:
  (a) graceful fallback to Pydantic defaults if file missing,
  (b) ensure `pnpm install` postinstall renders before any Python
  imports. **Lean a**: don't make the Python side depend on a Node
  toolchain step having run. Settings model has sensible defaults
  even when YAML is absent.
- **Test isolation.** Drifted's tests use `monkeypatch` + cache_clear
  on `load_config`. With `pydantic-settings`, the equivalent is to
  re-instantiate `Settings()` per test (or use a fixture that
  monkeypatches env vars + reloads). Reference drifted's
  `test_config_precedence.py` patterns.
- **`uv sync` triggers vs not.** Adding to `pyproject.toml` requires
  `uv sync` to install. Document in R28 Do so future readers know
  to re-sync.
- **R28 stamps `drifted-config-pattern-research.md` → Adopted.**
  Both halves of Path C land in R28; the memo is fully realized.
  Cross-link from R29 forward as a methodology reference rather
  than an in-flight design.
- **`upload_max_bytes` value lookup pattern.** Drifted's helpers
  return path/str/int; for a constant that gets looked up
  per-request, the cheapest pattern is to read once at module
  import via `MAX_UPLOAD_BYTES = CONFIG.settings.backend.upload_max_bytes`.
  Same semantics as the current hardcode, just config-derived.
- **CORS `allow_origins` is a list of strings.** YAML lists become
  Python `list[str]` via pydantic-settings — no special handling.
  Worth a behavior test (request from disallowed origin gets
  blocked) but probably stretch goal.

## Do

### BE config layer (`app/_config/`)

New package at
[`workspace/apps/backend/app/_config/`](../../../workspace/apps/backend/app/_config/):

- **`const.py`** — `Const.APP_NAME` (minimal; future rounds extend)
- **`fields.py`** — `Fields` class with 6 dotted-key constants
  (`BACKEND_HOST`, `BACKEND_PORT`, `BACKEND_WORKERS`,
  `BACKEND_LOG_LEVEL`, `BACKEND_CORS_ALLOW_ORIGINS`,
  `BACKEND_UPLOAD_MAX_BYTES`)
- **`settings.py`** — `BackendSettings(BaseModel)` + `Settings(BaseSettings)`
  with `extra="forbid"` per R16 conformance; custom
  `_YamlConfigSettingsSource` (~25 lines) plugging YAML into
  pydantic-settings' source chain; `build_settings()` factory that
  re-reads `MDD_CONFIG_FILE` each call for test isolation
- **`app_config.py`** — `AppConfig` facade exposing
  `.get(dotted_key, default)`, `.get_str`, `.get_int`, `.get_path`,
  and `.settings` for typed access; module-level singleton
  `CONFIG = AppConfig(build_settings())`
- **`__init__.py`** — barrel: `CONFIG`, `AppConfig`,
  `BackendSettings`, `Const`, `Fields`, `Settings`, `build_settings`

### BE template + rendered Layer-1 yaml

`workspace/config/backend/data/config/default.yaml.hbs` renders to
`workspace/apps/backend/data/config/default.yaml` (gitignored).
Output shape matches drifted's `default.yaml` exactly so the
runtime-config-loading semantics are 1:1.

### Three-layer precedence implemented

Layer 1 (default.yaml) + Layer 2 (`MDD_CONFIG_FILE`) wired via
custom YAML sources; Layer 3 (per-key env vars) via
pydantic-settings' built-in `env_prefix="MDD_"` +
`env_nested_delimiter="__"`. Composed in
`settings_customise_sources()` so init/env/yaml-layer-2/yaml-layer-1/dotenv
/secrets fall in the right precedence.

### Four BE hardcodes replaced

- `app/main.py:25` — `allow_origins=["http://localhost:3000"]` →
  `allow_origins=CONFIG.settings.backend.cors_allow_origins`
- `app/__main__.py:5` — `host="0.0.0.0", port=8000` →
  `host=CONFIG.settings.backend.host, port=CONFIG.settings.backend.port`
- `app/routers/uploads.py:40` — `MAX_UPLOAD_BYTES = 100 * 1024 * 1024`
  → `MAX_UPLOAD_BYTES = CONFIG.settings.backend.upload_max_bytes`
- `allow_methods` stays inline (protocol-level, not deployment-config)
  per R28 OUT-of-scope

### Drifted-pattern precedence tests ported

Two new BE test files:

- **`tests/test_app_config.py`** — 7 tests for the AppConfig facade:
  dotted-key access via `.get`/`.get_str`/`.get_int`, list-field
  handling, default-on-unknown-key, typed access via `.settings`,
  `build_settings()` produces fresh instances, `AppConfig`
  constructible from `build_settings()`.
- **`tests/test_app_config_precedence.py`** — 6 tests porting
  drifted's `test_config_precedence.py` patterns: Layer 1 defaults
  only, Layer 3 env-override wins, Layer 2 CONFIG_FILE-override
  wins, env beats CONFIG_FILE, Pydantic validation catches invalid
  port at load time, CORS list renders from YAML.

Test count: 54 → 67 (13 added).

### FE half — appConfig facade + 3 call-site refactor

- **`workspace/apps/builder/src/config/appConfig.ts`** (~50 lines)
  — minimal singleton reading `import.meta.env.VITE_*` with `Const`
  fallback. Three typed accessors: `apiBaseUrl()`, `logLevel()`,
  `i18nLocale()`. No runtime fetch, no localStorage (per memo SKIP).
- **`workspace/apps/builder/src/config/index.ts`** — barrel now
  exports `appConfig`.
- **Three call-site refactors**:
  - `api/workspacesApi.ts`: `const API_BASE_URL = appConfig.apiBaseUrl()` (was triplicated)
  - `api/datasetsApi.ts`: same
  - `api/uploadsApi.ts`: same

### Test infra fix

R28 surfaced that `pytest` was running from system Python (not
.venv). Symptom: `ModuleNotFoundError: No module named
'pydantic_settings'` despite the dep being installed in .venv.
Root cause: `pytest` wasn't installed in .venv because
`pyproject.toml`'s `[project.optional-dependencies] test`
extra wasn't sync'd. Fix: ran `uv sync --extra test` once, which
installed pytest + httpx + coverage into .venv. Subsequent
`uv run pytest` invocations use the .venv pytest, which finds
pydantic-settings. Worth a sentence in the BE README at some
point.

### Verification

- `uv run pytest` — **67 / 67 BE tests passing** (was 54; 13 new
  config tests added)
- `pnpm type-check` (FE) — **0 errors**
- `pnpm test` (FE vitest) — **24 / 24 passing**
- `pnpm build` (FE) — production bundle green
- `pnpm --filter @mdd/contracts test` — **11 / 11 passing**
- `pnpm md:lint` — **0 errors across 77 files**
- `pnpm config:render` produces fresh `default.yaml`, `.env`,
  `_generated/constants.ts` (all three gitignored)
- Smoke import verified: `CONFIG.get_str(Fields.BACKEND_HOST)`
  returns the rendered value (`0.0.0.0`)

## Check

- [x] `workspace/apps/backend/app/_config/` package exists with
      Settings + AppConfig + Fields + Const.
- [x] `workspace/config/backend/data/config/default.yaml.hbs`
      renders to `workspace/apps/backend/data/config/default.yaml`.
- [x] `MDD_CONFIG_FILE=path/to/override.yaml` overrides defaults.
- [x] `BACKEND_PORT=9090` env-var overrides both defaults and
      CONFIG_FILE.
- [x] `app/main.py` reads CORS from `CONFIG.settings.backend.cors_allow_origins`.
- [x] `app/__main__.py` reads host/port from CONFIG.
- [x] `app/routers/uploads.py` MAX_UPLOAD_BYTES reads from CONFIG.
- [x] `tests/test_app_config_precedence.py` + `tests/test_app_config.py`
      pass (all 4 layer-cases + facade-API tests).
- [x] Existing BE pytest suite (54/54 before R28) still passes.
- [x] FE `appConfig.ts` exists with typed accessors; index barrel
      updated.
- [x] Three FE api files have one `appConfig.apiBaseUrl()` call
      instead of triplicated env reads.
- [x] FE type-check 0 errors; vitest 24/24.
- [x] `drifted-config-pattern-research.md` Status: Adopted.
- [x] `pnpm md:lint` 0 errors; `pnpm format:check` clean.
- [x] All Plan + Check checkboxes flipped before Status flips to
      Review.

## Act

**Status**: Complete (human-approved 2026-05-25).

R28 closes the config half of the readiness chain. Path C fully
realized — drifted-config-pattern-research memo Status now
"Adopted". BE config layer + 4 hardcode replacements + 13 new
tests; FE appConfig + 3 call-site refactor. Test-infra bug
surfaced and fixed (pytest needed `uv sync --extra test` to land
in .venv). Pre-commit hook validated live during R28's own
commit.

**Learnings**:

- **Path C was the right call.** Pydantic validation caught a real
  bad value at test time (`MDD_BACKEND__PORT=not-a-number` →
  `ValidationError` at load, not silent fallback). The facade kept
  call-site syntax drifted-faithful (`CONFIG.get_str(Fields.X)`).
  Migration story stays intact.
- **R27 set R28 up to be mechanical.** Every value R28 consumed
  was already in `workspace/config/values.yaml`'s `backend.*`
  section. Every name R28 needed was already in `Fields`. The
  template path matched. Adding pydantic-settings + writing
  `AppConfig` was rote translation.
- **Hidden bug surfaced: pytest was running from system Python.**
  Looked green before R28 because the BE didn't import any deps
  outside system Python's site-packages. R28 added pydantic-
  settings (only in .venv); test collection broke; symptom was
  "`ModuleNotFoundError: No module named 'pydantic_settings'`"
  despite the dep being verifiably installed. Root cause:
  `pyproject.toml` `[test]` extras hadn't been sync'd. Fix:
  `uv sync --extra test`. Future contributors will hit the same
  shape; worth documenting in a BE setup README at some point.
- **The `_YamlConfigSource` subclass is ~25 lines.** Cheaper than
  pulling `pydantic-settings-yaml` as a third-party dep. Stays
  consistent with drifted's "no unnecessary deps" rule.
- **`upload_max_bytes` simple migration pattern worked.** The
  module-level constant becomes `CONFIG.settings.backend.upload_max_bytes`
  at import time; per-request reads stay zero-cost (no function
  call). Same shape for any future "read once, use many" config
  value.

**Promotions** _(none this round)_: R28 finishes the Path C
implementation. The
[`drifted-config-pattern-research.md`](../../memory/2026-05-25-drifted-config-pattern-research.md)
memo Status moves from "Partially Adopted" → "Adopted" — not a
`context/` or `skills/` promotion.

**Follow-ups (not promotions, just notes):**

- **R29 prep**: the `Fields` class on BE side now has 6 dotted-key
  constants. R29 expands it to cover error codes, name lengths,
  source-format literals, etc. — and adds the FE equivalent.
- **`_config/` import-time singleton dependency on rendered yaml**.
  `CONFIG = AppConfig(build_settings())` runs at module import; if
  `default.yaml` is missing (fresh clone, never rendered), Pydantic
  falls back to BaseModel defaults (graceful, intentional). Worth
  noting in a future BE README + flagging if any contributor's
  fresh-clone experience surfaces issues.
- **Pytest extras setup gotcha.** Document in BE README:
  `uv sync --extra test` is required once for the .venv to have
  pytest. Maybe a `bootstrap` script that always runs
  `--extra test`.
- **The R27 upstream-js-tmpl-bug follow-up still open.** Not
  R28's job; carries forward.
- **Visual verification of `pnpm dev` end-to-end with R28's
  config-derived BE** — type-check + tests + smoke import prove
  the wiring; a browser walk to confirm the API still responds
  (no CORS regression from the new yaml-driven origins) hasn't
  been done this turn. Pull as a small post-R28 task whenever
  the user has the app open.

## Feeds into → Round_29 (Constants/enums audit + replace inline magic strings)

What R28 hands forward to R29:

- **Established pattern**: `Fields` class with dotted-key constants;
  per-language generated files via js-tmpl (R27 ID_PATTERNS PoC);
  `values.yaml` `constants.*` section as the single source.
- **BE `Fields` class** ready to extend with error codes, name
  lengths, source-format literals.
- **FE `Fields` + `appConfig`** ready to be joined by a parallel
  `constants/` import that R29 will land.
- **Existing magic-string sites to refactor** (audit findings from
  R23 research):
  - Error codes (`'not_found'`, `'name_taken'`, `'non_empty'`) at
    5+ FE branch sites
  - Source-format literals (`"csv"`/`"excel"`) at 27 FE sites,
    1+ BE site
  - ID regex patterns triplicated (BE Pydantic / FE TS / OpenAPI
    YAML) — R27 has the FE generated module; R29 lands the BE one
    and OpenAPI shared schemas stay hand-authored
  - Magic numbers (workspace max 80, dataset max 120, upload max
    100MB, etc.) — some now in values.yaml (`backend.upload_max_bytes`)
    but most still inline
- **The `_generated/` convention** — R27 set it up for FE; R29
  extends to BE (`app/_generated/constants.py`).

R30 then picks up runtime/UX hygiene (tmp sweep, error boundary,
visual-verification gate); R31 picks up UX-infra; R32 picks up
i18n (consuming the locale placeholder already wired through R27's
`VITE_I18N_LOCALE` + R28's `appConfig.i18nLocale()`).

R29 picks up specifically:

- Audit inline magic strings across BE + FE: error codes
  (`name_taken`, `not_found`, `non_empty`), source-format literals
  (`"csv"`/`"excel"` at 27+ sites), name-length bounds (80, 120),
  AntD message types, query-key strings
- Add `constants.error_codes`, `constants.name_lengths`,
  `constants.source_formats` (etc.) sections to `values.yaml`
- Add per-language constants templates (BE `.py.hbs`, FE `.ts.hbs`)
- Replace inline usages with imports from `_generated/constants.{py,ts}`
- The R27 PoC (`ID_PATTERNS`) becomes the template for the rest
