# @mdd/ui

Look-and-feel package for `my-dynamic-dashboard`. **Owns nothing BIZ.**

This package exists so the builder app (and any future UI surface)
imports a consistent theme + provider stack without re-implementing it.
It was scaffolded **before** any feature code by design — see
[2026-05-22-ui-boundary-build-first.md](../../../.agents/memory/2026-05-22-ui-boundary-build-first.md)
for the lesson behind that choice.

## What belongs here (UI duty)

- Theme tokens ([src/themeTokens.ts](src/themeTokens.ts)): colors,
  spacing, radii, typography.
- Provider wrappers ([src/Providers/](src/Providers/)): the antd
  `ConfigProvider` wired to our tokens; future error boundaries.
- Generic look-and-feel primitives (when pulled by a real consumer):
  buttons, layouts, empty states — components with **zero domain
  knowledge**.
- Icons that are part of the visual system, not feature-specific.

**Example of what's in scope:** `<AntdConfig>` wraps the app tree and
applies our theme to every antd component. Pure look-and-feel, no
product knowledge.

## What does NOT belong here (BIZ duty)

- Feature components — `SchemaProfiler`, `FileUpload`, `DataTable`
  bound to CRM fields, query builders. These encode product knowledge
  and go in `apps/builder/src/features/`.
- Routing, data-fetching, validation libraries — `react-router-dom`,
  `@tanstack/react-query`, `zod`. Kept out of peer deps on purpose.
- `Pages/` and `Contexts/` from the drifted iteration's `@mdd/ui` —
  those carried BIZ leak. In this iteration they live in the builder.

**Example of what's out of scope:** a `<CRMSourceUploader>` that reads
schema from a CRM export file encodes domain knowledge about CRM source
structure. It belongs in `apps/builder/src/features/upload/`, not here.

## Develop

```bash
# from repo root
pnpm install                          # links the workspace
pnpm --filter @mdd/ui type-check      # tsc --noEmit
pnpm --filter @mdd/ui test            # vitest run
```

## Tooling

- Source-only exports (`./src/*.ts(x)`); no build step. Consumers
  (Vite-based for now) transpile on demand.
- Peer deps: `react`, `react-dom`, `antd`, `@ant-design/icons` only.
- Tests: vitest snapshot of `themeTokens` shape — exercises the import
  graph without rendering.
