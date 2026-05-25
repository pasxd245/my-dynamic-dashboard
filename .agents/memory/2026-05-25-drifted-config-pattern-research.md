# Drifted config pattern — research for R27 readiness chain

**Date**: 2026-05-25
**Agent**: claude-opus-4-7
**Confidence**: High (read every relevant file in drifted; cross-checked
with tests + devops/compose; pattern is mature and well-documented in
drifted's own code)
**Status**: Partially Adopted — Path C locked 2026-05-25; R27
shipped the FE half (`.env` render + cross-language constants
PoC + FE config dir skeleton + render harness + husky pre-commit
hook). BE half (AppConfig facade over Pydantic, drifted's three-
layer precedence) ships in R28.

## Problem

R27 opens the readiness chain (config + constants + cleanup) per the
user's "let's not move too fast, build readiness foundation" framing.
The user has the `@nci-gis/js-tmpl` library in hand (their own
authorship) and proposes:

- `workspace/values.yaml` as central source of truth
- `workspace/config/` for per-app templates + optional per-env values dirs
- Generated, gitignored output: BE config (yaml), FE `.env`,
  cross-language constants

Per the project's "Preserve what works" rule (per
[drifted-iteration.md](../context/drifted-iteration.md)), R27 should
explicitly pull from drifted's config pattern rather than re-invent.
This memo captures the deep scan of drifted's approach so the R27
plan can ADOPT / ADAPT / SKIP each piece deliberately.

## Finding — what drifted actually built

### BE side: three-layer YAML + env-var precedence

**Files** (per drifted's layout):

| File                                      | Lines | Purpose                                                        |
| ----------------------------------------- | ----- | -------------------------------------------------------------- |
| `apps/backend/app/resources/default.yaml` | 19    | Layer-1 packaged defaults                                      |
| `apps/backend/app/shared.py`              | 219   | `AppConfig`, `Fields`, `Const`, layered `load_config()`        |
| `apps/backend/app/core/config.py`         | 96    | `repo_root()`, `data_dir()`, `DeploymentEnvironment` dataclass |
| `apps/backend/app/utils/env_helper.py`    | 18    | `read_path_env(name, default)` helper                          |

**Three-layer precedence** (low → high), implemented in
`shared.py:load_config()`:

```python
# Layer 1: packaged defaults
_deep_merge(values, _load_yaml(DEFAULT_CONFIG_PATH))

# Layer 2: operator config file (MDD_CONFIG_FILE env var path)
if config_path is not None:
    _deep_merge(values, _load_yaml(config_path))

# Layer 3: individual env-var overrides (per dotted key)
for dotted_key, env_name in _ENV_OVERRIDES.items():
    raw = os.getenv(env_name, "").strip()
    if raw:
        _set_dotted_value(values, dotted_key, raw)
```

**Key surfaces**:

- `_ENV_OVERRIDES` dict maps dotted-keys → env-var names
  (e.g., `"backend.port": "BACKEND_PORT"`). 11 entries in drifted.
- `Fields` class holds dotted-key constants used everywhere
  (`Fields.BACKEND_PORT = "backend.port"`). Prevents magic strings
  at call sites.
- `Const` class for app-level constants (`Const.APP_NAME`).
- `AppConfig` wraps the merged values with typed accessors:
  `get_str(key, default)`, `get_int(key, default)`, `get_path(key, default)`,
  plus per-field convenience methods (`backend_host()`, `backend_port()`).
- Module singleton: `CONFIG = AppConfig()` resolved at import time.
- `load_config()` is `@lru_cache`d + decorated with
  `@rns.rns()` to return a `RecursiveNamespace` (allows
  `cfg.backend.port` access in addition to `cfg.get("backend.port")`).
- Bootstrap singletons exposed as module attrs:
  `DB_PATH`, `PARQUET_ROOT` (resolved via
  `_resolve_bootstrap_paths(CONFIG)`).

**Dependencies added**: `recursivenamespace`, `pyyaml`.

**Tests cover**:

- Defaults-only behavior
- Env var override beats default
- `CONFIG_FILE` override beats default
- Env var override beats `CONFIG_FILE`
- `RecursiveNamespace` dotted-attr access works alongside `.get()`

Files: `apps/backend/tests/integration/test_config_precedence.py`,
`apps/backend/tests/unit/test_shared_config_namespace.py`,
`apps/backend/tests/contract/test_app_config_contract.py`.

### FE side: three-layer (build-time / runtime / localStorage)

**Files**:

| File                                   | Lines | Purpose                                                            |
| -------------------------------------- | ----- | ------------------------------------------------------------------ |
| `apps/builder/src/config/appConfig.ts` | 239   | `AppConfig` class singleton, three-layer resolver, React hook      |
| `apps/builder/src/config/const.ts`     | 11    | Default values (`Const.API_BASE`, `Const.DEFAULT_LOCALE`, etc.)    |
| `apps/builder/src/config/fields.ts`    | 12    | Dotted-key constants (`Fields.API_BASE_URL`, `Fields.I18N_LOCALE`) |
| `apps/builder/src/config/index.ts`     | 5     | Barrel export                                                      |

**Three-layer precedence** (high → low, opposite of BE):

1. **localStorage** (prefix `cfg:<dotted-key>`) — operator/dev override
2. **Runtime fetch** `/api/v1/config` (with 3000 ms abort timeout) —
   server-pushed config
3. **Build-time** `VITE_*` env vars — baked at build

**Init flow**:

```ts
// main.tsx
await AppConfig.init();          // fetch runtime config, set _initialized
createRoot(rootElement).render(<App />);
```

`AppConfig.init()` is idempotent (checks `_initialized` flag), gracefully
falls back to build-time values on fetch failure / timeout (silent
catch — drifted's choice).

**Surfaces**:

- `appConfig.apiBaseUrl()` / `.logLevel()` / `.i18nLocale()` — typed
  per-field accessors
- `appConfig.all()` — debug method returning ConfigEntry[] with source
  attribution per key (`build-time` | `runtime` | `localStorage`)
- `useAppConfig()` React hook — forces re-render on init completion

**Already had i18n locale hooks** (relevant to R32):

- `Const.DEFAULT_LOCALE = "en-US"`
- `Fields.I18N_LOCALE = "i18n.locale"`
- `VITE_I18N_LOCALE` env var read
- `RuntimeConfig.i18nLocale` field on the fetched runtime payload
- `appConfig.i18nLocale()` accessor

### Devops / compose

`devops/compose.yaml` shows the env-var path in use:

```yaml
dashboard:
  environment:
    DASHBOARD_API_BASE_URL: http://backend:8000
```

i.e., the operator-override path in drifted goes through env vars, not
through a CONFIG_FILE yaml in production. The MDD_CONFIG_FILE Layer 2
exists as an escape hatch for ops debugging.

## Evidence — concrete code references

All paths relative to `tmp/ref-apps/my-dynamic-dashboard-drifted/`.
Per the
[drifted-iteration citation discipline](../context/drifted-iteration.md#citation-discipline),
these are code spans, not links.

- `apps/backend/app/shared.py` lines 33-49 — `Const` + `Fields` classes
- `apps/backend/app/shared.py` lines 51-95 — `AppConfig` class with
  typed getters
- `apps/backend/app/shared.py` lines 139-166 — `load_config()` with
  layered merge
- `apps/backend/app/shared.py` lines 198-204 — module-level singleton
  and bootstrap paths
- `apps/backend/app/resources/default.yaml` — full Layer-1 example
- `apps/backend/tests/integration/test_config_precedence.py` lines
  36-80 — full precedence test patterns (defaults / env-override /
  file-override / env-beats-file)
- `apps/builder/src/config/appConfig.ts` lines 36-71 — singleton +
  init lifecycle
- `apps/builder/src/config/appConfig.ts` lines 117-132 — `_resolve()`
  three-layer walk
- `apps/builder/src/config/appConfig.ts` lines 133-150 — build-time
  env var reader (the `VITE_*` mapping)
- `apps/builder/src/config/appConfig.ts` lines 219-239 —
  `useAppConfig()` React hook

## Recommendation — ADOPT / ADAPT / SKIP / DEFER

The 16 dimensions of drifted's config approach, classified for R27 use.

### ADOPT (use as-is, port verbatim)

1. **Three-layer BE precedence** (defaults → file override → env vars).
   Battle-tested in drifted, covered by tests, matches the conventional
   shape ops engineers expect.
2. **`Fields` class with dotted-key constants** on BOTH BE and FE. Stops
   magic-string bleed at call sites. Pairs naturally with the constants
   readiness work (R29).
3. **`Const` class for app-level constants** that aren't user-overridable
   (e.g., `APP_NAME`, hard-coded defaults). Different surface from
   `Fields` (overridable config) — keep them separated.
4. **Typed accessors** (`get_str`, `get_int`, `get_path` on BE;
   `apiBaseUrl()`, `logLevel()` on FE). Avoids stringly-typed reads
   spreading through call sites.
5. **`_ENV_OVERRIDES` dict mapping dotted-key → env-var name**. Concrete
   shape for the per-key env-override layer.
6. **Module-level singleton at import time** (`CONFIG = AppConfig()`).
   Simpler than dependency injection; matches FastAPI's natural
   module-globals pattern.
7. **YAML format for BE config**. Confirms the user's preference; better
   than INI for nested + lists.
8. **Test patterns for precedence**. Drifted's
   `test_config_precedence.py` is a clean template for R28+ tests.

### ADAPT (port but modify for MDD's reality)

1. **`default.yaml` location**. Drifted's lives at
   `apps/backend/app/resources/default.yaml` (hand-authored, committed
   in source). R27 evolution: render it from `workspace/values.yaml`
   via js-tmpl, output to `apps/backend/data/config/default.yaml`
   (gitignored). The shape stays the same; the source moves up one
   layer.
2. **Build-time `VITE_*` env vars** (FE Layer 1). Same idea, but the
   `.env` file gets generated from `workspace/values.yaml` via
   js-tmpl, not hand-edited. The FE's `_readBuildTimeEnv()` reader
   stays as drifted shipped it.
3. **`RecursiveNamespace` access**. Drifted uses a third-party lib
   (`recursivenamespace`) for `cfg.backend.port` dotted-attr access.
   For R27 lean: keep `.get_str(Fields.BACKEND_PORT)` style; only
   add `RecursiveNamespace` if call sites get noisy. Defer the dep
   until friction shows.

### SKIP (drifted complexity not justified for MDD POC)

1. **FE runtime `/api/v1/config` fetch** (Layer 2). Drifted's
   backend served a config endpoint; the FE fetched it on init with
   abort-on-timeout. For MDD POC: no operator need to push runtime
   config changes without redeploy. Skip — saves complexity, can
   re-add later if real ops need surfaces.
2. **FE localStorage Layer 3** (`cfg:<key>` overrides). Convenient for
   dev debugging but adds a third surface. Skip for POC; the
   DevTools console + a refresh covers the same need.
3. **`appConfig.all()` source-attribution debug method**. Nice
   diagnostic but only matters when Layers 2 and 3 exist. Skip in
   lockstep with the layers it serves.
4. **`useAppConfig()` React hook re-render on init**. Becomes
   unnecessary if `AppConfig` is fully resolved at import time
   (which it is, without runtime fetch). Skip.

### DEFER (good idea, wrong round)

1. **`DeploymentEnvironment` dataclass + `validate()` errors**. Drifted
   has a separate `DeploymentEnvironment.validate()` returning a
   list of error strings (e.g., "BACKEND_HOST must be non-empty",
   "BACKEND_PORT out of range"). Worth adding when production-ish
   validation matters. Defer to a later round — POC doesn't need
   strict deployment validation yet.

## What R27 adds on top of drifted's pattern (the js-tmpl layer)

Drifted stopped at the YAML-config + env-var layer. R27 adds the
**templating layer above it**:

```text
                  workspace/values.yaml           ← single source (committed)
                          │
                          ▼  js-tmpl render
                  ┌───────┴────────┐
                  │                │
                  ▼                ▼
       BE: data/config/      FE: .env
            default.yaml          + src/_generated/constants.ts
                  │                │
                  ▼                ▼
        BE shared.py reads   Vite reads .env;
        (Layer 1 baseline);  TS imports constants
        env-vars override
        (Layer 3)
```

This is the new layer drifted didn't have. js-tmpl renders the
**inputs** to drifted's proven pattern; drifted's pattern handles
**reading + precedence** at runtime.

## Cross-language constants — additional R27 leverage

The triplicated regex patterns (BE Pydantic, FE TS, OpenAPI YAML)
have NO equivalent in drifted (drifted didn't have OpenAPI-driven
DCBF). R27's constants slot is new ground:

```text
workspace/values.yaml             ← single source
  constants:
    id_patterns:
      workspace: "^ws_[0-9a-f]{8}$"
      dataset:   "^ds_[0-9a-f]{8}$"
      temp:      "^tmp_[0-9a-f]{16}$"
    error_codes:
      not_found
      name_taken
      non_empty
    name_length:
      workspace_max: 80
      dataset_max:   120
      upload_max_bytes: 104857600
  ↓ js-tmpl render
  ↓
apps/backend/app/_generated/constants.py    (gitignored)
apps/builder/src/_generated/constants.ts    (gitignored)
```

**Boundary** (locked per the user's "leave contracts hand-authored"
direction): OpenAPI YAML stays the DCBF authority and is NOT
generated. Constants flow ONE direction: values → BE/FE modules. The
contract-level regex strings in the YAMLs stay hand-edited; the
generated constants reference the same shapes but are independent
artifacts. Drift detection here is a follow-up if a YAML/values
divergence ever surfaces (the kind of thing R29's tests can guard).

## Final resolution — Path C (locked 2026-05-25)

User picked the **facade-over-Pydantic** path after probing the
`get("a.b.c", default)` question. Reasoning recorded for future
agents reading this memo:

- **Pydantic** does the load + validation work (catches YAML typos
  at boot, not at silent-default fallback). Pydantic is already in
  the project (contract layer), so one ecosystem covers wire types
  and config.
- **AppConfig** is the **stable public facade**, drifted-style API:
  `CONFIG.get_str(Fields.X)`, `CONFIG.get_int(Fields.X)`,
  `CONFIG.get("a.b.c", default)`. All call sites flow through it.
- **Migration safety**: if Pydantic-settings ever becomes the
  wrong tool, swap the inner lib and call sites stay untouched.
- **RecursiveNamespace is dropped** (originally chosen in decision
  1, superseded by Path C): Pydantic's typed model + AppConfig's
  dotted-key walker via `model_dump()` solves the same ergonomic
  problem more powerfully. Carrying both would be redundant deps.

Locked sub-decisions:

- **`pydantic-settings`** (not plain `pydantic`) — gives native env
  var loading + `.env` support; matches drifted's three-layer
  precedence semantics (defaults → file override → env vars) with
  built-in source ordering. The YAML loader is a small custom
  `YamlConfigSettingsSource` subclass (~20 lines).
- **Nested Settings model** (not flat): `Settings(backend:
BackendSettings, dashboard: DashboardSettings, ...)`. Mirrors
  YAML structure 1:1; makes `cfg.backend.port` AND
  `cfg.get("backend.port")` work consistently.

Implementation sketch:

```python
# Pydantic does validation; AppConfig provides the stable API
class BackendSettings(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_allow_origins: list[str] = ["http://localhost:3000"]
    # ...

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        yaml_file=DEFAULT_CONFIG_PATH,
        env_prefix="MDD_",
        env_nested_delimiter="__",
    )
    backend: BackendSettings = BackendSettings()
    # ...

class AppConfig:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._dict = settings.model_dump()

    def get(self, dotted_key: str, default=None):
        current = self._dict
        for part in dotted_key.split("."):
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return default
        return current

    def get_str(self, key: str, default: str = "") -> str:
        val = self.get(key, default)
        return str(val) if val is not None else default

    def get_int(self, key: str, default: int = 0) -> int: ...

    @property
    def settings(self) -> Settings:
        return self._settings  # typed access for callers who want it

CONFIG = AppConfig(Settings())  # module singleton
```

This supersedes the **ADAPT item 3** (`RecursiveNamespace`) and
the **DEFER item 1** (Pydantic-based validation) from the lists
above — both are now resolved in favor of Path C.

## Original open decisions (resolved)

Before R27 drafts, please confirm or redirect:

1. **`RecursiveNamespace` (BE)** — adopt drifted's third-party dep
   (`pip install recursivenamespace`) for `cfg.backend.port` dotted
   access, OR keep `.get_str(Fields.X)`-only access? **Lean: defer the
   dep** until call sites get noisy; the `.get_str()` style is fine for
   POC.
2. **FE Layer 2 + 3 (runtime fetch + localStorage)** — confirm SKIP for
   POC? Or include from R27 because they'll be needed soon? **Lean: skip
   for POC**; reintroduce only when a real ops surface needs them.
3. **`useAppConfig()` React hook** — if we skip the runtime fetch,
   `AppConfig` is fully resolved at import time and no re-render is
   needed. Can we drop the hook entirely and use the module-singleton
   directly? **Lean: yes, drop**.
4. **R27 PoC scope** — three candidates from previous round:
   - **a. FE `.env`** only (smallest, proves js-tmpl integration)
   - **b. BE `default.yaml`** only (proves cross-app rendering)
   - **c. Cross-language constants** (highest leverage, demonstrates
     the unique R27 capability)
     **Lean: a + c minimal** — `.env` proves Vite integration; one small
     constants module per side (e.g., `ID_PATTERNS`) proves cross-language
     rendering. R28 then ports the full BE config; R29 fills out the
     remaining constants.
5. **`recursivenamespace` notwithstanding, do you want full type-checking
   of the merged config?** Pydantic v2 has `BaseSettings` that can read
   YAML + env vars natively and produce typed Settings classes. Drifted
   used `AppConfig` (hand-rolled). Modern Python: `pydantic-settings`.
   **Lean: stay with the hand-rolled pattern** to match drifted (which
   we know works) — but worth surfacing because `pydantic-settings` is
   the canonical modern choice and reduces hand-rolled glue.
6. **Where does the j-tmpl render get invoked?** Three options:
   - **a. `pnpm postinstall` hook** — render after every install
   - **b. Build/dev scripts** — `pnpm dev` and `pnpm build` first run
     render
   - **c. Pre-commit hook** — render + verify-no-diff on `values.yaml`
     changes
     **Lean: b + c** (already discussed and confirmed); the dev/build
     integration covers daily flow, the pre-commit hook prevents drift.

## Promotion Candidate?

- [ ] `context/` — possibly, after R27 ships and the pattern proves
      itself in MDD. Two-instance evidence (drifted + MDD) starts the
      Evolution-Rule clock.
- [ ] `skills/` — far off; the "config pattern" isn't itself a
      reusable procedure beyond this research note.
- [x] Not yet — this is research feeding R27's plan. Promotion (if
      any) lives in R27's Act or a successor round.

## Cross-links

- [drifted-iteration.md](../context/drifted-iteration.md) — hub +
  citation discipline
- [round-roadmap-deferrals.md](2026-05-22-round-roadmap-deferrals.md)
  — what drifted built that we permanently skip (no overlap with this
  config pattern)
- [ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md)
  — the founding "ADOPT/ADAPT/SKIP/DEFER" lesson methodology this memo
  applies
- [drifted-shell-distillation.md](2026-05-23-drifted-shell-distillation.md)
  — the previous deep-mining memo (precedent for this one's shape)
