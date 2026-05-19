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
import {
  MasterLayout,
  Sidebar,
  SidebarMenu,
  PageCard,
  PageHeader,
  Button,
} from '@mdd/ui/Components';
import { useNavigationContext, NavigationProvider } from '@mdd/ui/Contexts';
import { themeTokens } from '@mdd/ui/themeTokens';
import { cn } from '@mdd/ui/Utils';
import { STATUS_COLORS, FORMAT_DATE_TYPE } from '@mdd/ui/constants';
import type { NavigationItem, IconProps } from '@mdd/ui/types';
import type { IconProps as IconPropsRe } from '@mdd/ui/Icons';
// import { } from '@mdd/ui/Pages';   // empty in R01, populated in R03
```

`Button` (R07) is a no-op wrapper around antd's `Button`; brand
defaults flow through `MddUIProvider`'s `ConfigProvider`. The wrapper
is exposed so consumers don't reach into `antd` directly.

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

## Two ways to feed nav (R03+)

Flat (R01):

```tsx
import type { NavigationItem } from '@mdd/ui/types';

const nav: NavigationItem[] = [
  { id: 'home', path: '/', title: 'Home', sidebar: true },
  { id: 'reports', path: '/reports', title: 'Reports', sidebar: true },
];

<MasterLayout navigation={nav} title="My App">
  …
</MasterLayout>;
```

Grouped (R03):

```tsx
import type { NavigationGroup } from '@mdd/ui/types';

const groups: NavigationGroup[] = [
  {
    id: 'data',
    title: 'Data Management',
    items: [
      { id: 'upload', path: '/', title: 'Upload', sidebar: true },
      { id: 'queries', path: '/queries', title: 'Saved Queries', sidebar: true },
    ],
  },
  {
    id: 'workflow',
    title: 'Workflow',
    items: [{ id: 'builder', path: '/workflow', title: 'Builder', sidebar: true }],
  },
];

<MasterLayout navGroups={groups} title="My App">
  …
</MasterLayout>;
```

`navigation` and `navGroups` are mutually exclusive — supply exactly one (enforced via discriminated union at compile time).

## Custom header / brand slots (R03+)

`title?: ReactNode` is fine for a plain heading. Pass `header?: ReactNode` for a fully-custom top bar (search, locale switcher, notifications, avatar — whatever). When both are supplied, `header` wins (with a dev-mode `console.warn`).

```tsx
<MasterLayout
  navGroups={groups}
  header={
    <>
      <Input.Search style={{ flex: 1, maxWidth: 360 }} />
      <Space>
        <Button>EN</Button>
        <Badge count={0} showZero={false}>
          <Button shape="circle" icon={<BellOutlined />} />
        </Badge>
        <Avatar>AD</Avatar>
      </Space>
    </>
  }
  brand={<MyBrandMark />} // alternative to Logo: FC<IconProps>
>
  <Routes>…</Routes>
</MasterLayout>
```

`Logo` (R01) and `brand` (R03) are the two ways to fill the sidebar's brand slot. When both are supplied, `brand` wins (with a dev-mode `console.warn`).

## PageCard / PageHeader CSS contract (carried from R04)

`PageCard` and `PageHeader` were promoted from `apps/builder` verbatim in R04, including their CSS dependencies. They rely on the consumer providing:

- The `.page-card` (+ `.page-card--flush`) classes — `PageCard` is just a `<section>` carrying these.
- CSS custom properties on `:root`: `--color-white`, `--surface-line`, `--radius-xl`, `--shadow-card`, `--color-gray-4`.

Tightening this to `theme.useToken()` (so consumers don't need to ship matching CSS) is a planned future refactor round.

## Deferred

- **R05** — `apps/builder` `AppShell` → `MasterLayout` swap (consumes R03's extended API).
- **R06** — `Components/Button`, `Components/Modal`, `Components/FormField` (zod-aware), `Pages/NotFound`.
