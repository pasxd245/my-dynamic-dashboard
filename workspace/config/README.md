# `workspace/config/` — js-tmpl template root

> Build-time config rendering: turns `workspace/values.yaml` +
> `*.hbs` templates into generated, gitignored config files under
> `workspace/apps/<app>/...`.
>
> Round of origin: [R27](../../.agents/plan/cycles/Round_27.md).
> Reference pattern: [drifted-config-pattern-research memo](../../.agents/memory/2026-05-25-drifted-config-pattern-research.md).

---

## What this directory holds

```text
workspace/
└── config/                              # YOU ARE HERE — all config under one roof
    ├── values.yaml                      # central source of truth (committed)
    ├── js-tmpl.config.yaml              # render config (committed; auto-discovered)
    ├── README.md                        # this file
    ├── backend/                         # → apps/backend/ (R28 fills in)
    │   └── .gitkeep
    └── builder/                         # → apps/builder/
        ├── .env.hbs                     # → apps/builder/.env
        └── src/_generated/
            └── constants.ts.hbs         # → apps/builder/src/_generated/constants.ts
```

`js-tmpl` walks `templateDir` (= `.` from this directory)
breadth-first and emits each `<name>.<ext>.hbs` as `<name>.<ext>`
in `outDir` (= `../apps/`), preserving the directory structure
underneath. So a file at
`workspace/config/builder/src/_generated/constants.ts.hbs` lands
at `workspace/apps/builder/src/_generated/constants.ts`.
Non-`.hbs` files in this directory (`values.yaml`,
`js-tmpl.config.yaml`, this README) are skipped by the scanner.

## How to render

From the **repo root**:

```bash
pnpm config:render
```

The script (`scripts/config-render.mjs`) `chdir`s into `workspace/`,
loads the auto-discovered `js-tmpl.config.yaml`, reads `values.yaml`,
and renders every `.hbs` into the corresponding output path.

`pnpm dev` and `pnpm build` invoke `config:render` first via `predev`
/ `prebuild` lifecycle hooks, so generated files are always fresh
when the running app starts.

A husky pre-commit hook runs `pnpm config:render` before each commit
— a template-syntax or missing-key error fails the commit.

## How to add a new value

1. **Edit `workspace/config/values.yaml`** — add or change the value
   under the correct section. Nested objects are fine; YAML lists
   become real arrays in the rendered output.
2. **Edit or add a template** under `workspace/config/<app>/...` —
   reference the value with Handlebars syntax: `{{section.key}}`. For
   nested: `{{constants.id_patterns.workspace}}`.
3. **Run `pnpm config:render`** — verify the generated file at
   `workspace/apps/<app>/<corresponding path>` looks right.
4. **Commit `values.yaml` + the new/changed `.hbs`** — the generated
   output is gitignored and never committed.

## What R27 ships, what later rounds add

| Round | Adds                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| R27   | js-tmpl integration; `apps/builder/.env`; one cross-language constants module (`ID_PATTERNS`); FE config dir skeleton                 |
| R28   | BE `default.yaml` rendered to `apps/backend/data/config/`; `AppConfig` facade over Pydantic; replace BE hardcodes + 3 FE API_BASE_URL |
| R29   | Cross-language constants audit (error codes, name lengths, format enums); replace inline magic strings repo-wide                      |
| R30   | Tmp upload sweep job + error boundary + visual-verification gate                                                                      |
| R31   | UX-infra: global toast config, skeletons, AntD deprecation cleanup                                                                    |
| R32   | i18n readiness — consumes the `i18n.locale` placeholder R27 seeded                                                                    |

## Why this layout vs alternatives

See the drifted-config research memo § "Final resolution — Path C"
for the full ADOPT / ADAPT / SKIP / DEFER analysis. Short version:

- **Pydantic underneath** for validation at load time (catches YAML
  typos at boot, not at silent-default fallback). Lands in R28 on
  the BE side.
- **`AppConfig` facade on top** for a stable drifted-style API
  (`CONFIG.get_str(Fields.X)`). Migration-safe — swap inner lib
  later if needed.
- **`RecursiveNamespace` dropped** — Pydantic's typed model +
  `model_dump()` dotted-walk supersedes it.
- **Layout: all under `workspace/config/`** — `values.yaml`,
  `js-tmpl.config.yaml`, and per-app templates all under a single
  directory; cleaner-than-split-between-root-and-subdir and matches
  how `workspace/config/` reads at a glance ("everything config is
  here"). Render script changes CWD into `workspace/config/`;
  `js-tmpl.config.yaml` is auto-discovered there.

## Known issue

The `js-tmpl` CLI (v0.1.0) has an `isDirectRun` check in `src/cli/main.js`
that compares `import.meta.url` to `process.argv[1]`. Under pnpm, the
symlink-resolved path in `import.meta.url` (via `.pnpm/...`) doesn't
match the `process.argv[1]` symlink path, so the CLI silently exits
0 instead of rendering. Our `scripts/config-render.mjs` works around
this by using the programmatic API (`renderDirectory`, `resolveConfig`)
directly. Real dogfooding signal back to
[`@nci-gis/js-tmpl`](https://github.com/nci-gis/js-tmpl) — log as an
upstream issue when convenient.
