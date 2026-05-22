# builder

The product builder app for `my-dynamic-dashboard`. Round 03 scope:
minimal Vite + React 19 + antd skeleton, consuming `@mdd/ui` for
the theme + provider stack.

## Develop

```bash
# from repo root
pnpm install
pnpm --filter builder dev          # vite on :3000
pnpm --filter builder type-check
pnpm --filter builder test
pnpm --filter builder build        # vite build → dist/
```

## Consumption pattern

`@mdd/ui` owns look-and-feel; this app owns BIZ. The entry point wraps
the tree once:

```tsx
import { AntdConfig } from "@mdd/ui";

createRoot(document.getElementById("root")!).render(
  <AntdConfig>
    <App />
  </AntdConfig>,
);
```

Inside `<AntdConfig>`, every antd component picks up our theme tokens.
No further setup needed.

## Tooling

- **Vite 6** + `@vitejs/plugin-react` (React 19)
- **TypeScript** strict mode, source-only consumption of `@mdd/ui`
  (no build step in the package)
- **Vitest 3** + `@testing-library/react` + `happy-dom` for component
  tests
