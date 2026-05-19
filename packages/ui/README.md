# `@mdd/ui`

Reusable master-layout kit for the `my-dynamic-dashboard` React apps.
Ships AntD v6 + `react-router-dom@7` + BMS brand tokens, exposed as
TypeScript source — no bundler. Consumers import via `workspace:*`.

## Install

In any workspace package's `package.json`:

```jsonc
{
  "dependencies": {
    "@mdd/ui": "workspace:*",
  },
}
```

Then `pnpm install` at the repo root.

## Subpath imports

```ts
import { MddUIProvider } from '@mdd/ui/Providers';
import { MasterLayout, Sidebar, SidebarMenu } from '@mdd/ui/Components';
import { useNavigationContext, NavigationProvider } from '@mdd/ui/Contexts';
import { themeTokens } from '@mdd/ui/themeTokens';
import { cn } from '@mdd/ui/Utils';
import { STATUS_COLORS, FORMAT_DATE_TYPE } from '@mdd/ui/constants';
import type { NavigationItem, IconProps } from '@mdd/ui/types';
import type { IconProps as IconPropsRe } from '@mdd/ui/Icons';
// import { } from '@mdd/ui/Pages';   // empty in R01, populated in R03
```

## Minimal example

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MddUIProvider } from '@mdd/ui/Providers';
import { MasterLayout } from '@mdd/ui/Components';
import type { NavigationItem } from '@mdd/ui/types';

const nav: NavigationItem[] = [
  { id: 'home', path: '/', title: 'Home', sidebar: true },
  { id: 'reports', path: '/reports', title: 'Reports', sidebar: true },
];

export function App() {
  return (
    <BrowserRouter>
      <MddUIProvider>
        <MasterLayout navigation={nav} title="My App">
          <Routes>
            <Route path="/" element={<div>home</div>} />
            <Route path="/reports" element={<div>reports</div>} />
          </Routes>
        </MasterLayout>
      </MddUIProvider>
    </BrowserRouter>
  );
}
```

## Deferred

- **R02** — `Components/PageCard`, `Components/PageHeader` (promoted from `apps/builder`).
- **R03** — `Components/Button`, `Components/Modal`, `Components/FormField` (zod-aware), `Pages/NotFound`.
