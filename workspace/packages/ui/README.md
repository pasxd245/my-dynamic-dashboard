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
  `ConfigProvider` wired to our tokens, plus `<ThemeStyle />` which
  injects a global `body { font-family: ... }` rule derived from
  `themeTokens.token.fontFamily`. `<AntdConfig>` renders
  `<ThemeStyle />` internally, so wrapping once gives consumers
  consistent typography across **both** antd components and raw
  HTML. Future error boundaries land here too.
- Generic look-and-feel primitives (when pulled by a real consumer):
  buttons, layouts, empty states — components with **zero domain
  knowledge**.
- Icons that are part of the visual system, not feature-specific.

**Example of what's in scope:** `<AntdConfig>` wraps the app tree
and applies our theme to every antd component (and a global body
font via the bundled `<ThemeStyle />`). Pure look-and-feel, no
product knowledge.

**Standalone `<ThemeStyle />`** is exported separately for cases
where you want the global font without `ConfigProvider` (e.g., an
isolated component test):

```tsx
import { ThemeStyle } from '@mdd/ui/Providers';
render(
  <>
    <ThemeStyle />
    <SomeHeading />
  </>,
);
```

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
- Tests: vitest with `happy-dom` + `@testing-library/react` —
  themeTokens shape snapshot plus `<ThemeStyle />` render test.
