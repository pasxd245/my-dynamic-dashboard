# Round 01: Ship `@mdd/ui` reusable master-layout package

**Status**: Planning
**Date started**: 2026-05-18
**Date completed**: —

**Master plan**: [docs/agents/plan/packages-ui.plan.md](../../../docs/agents/plan/packages-ui.plan.md)
**Workflow**: [docs/agents/workflows/packages-ui.workflow.md](../../../docs/agents/workflows/packages-ui.workflow.md)

## Goal

Stand up `packages/ui/` as the `@mdd/ui` workspace package — a reusable **MasterLayout + Provider + Sidebar/SidebarMenu** kit aligned to this repo's stack (React 19 · Vite · AntD v6 · `react-router-dom@7` · TanStack Query · BMS brand tokens). This round **publishes the package only** — `apps/builder` is left untouched; migration is Round 02.

## Trajectory

- **Immutable intent**: ship the package surface area listed under "Subpath exports" below. Anything else is out of scope.
- **Architecture state**: `apps/builder` is the only React app in the repo today (AntD v6 + `react-router-dom@7` + Vite/TS, no build step between workspace packages — Vite consumes TS source directly). `apps/dashboard` / `apps/backend` are Python and untouched.
- **Allowed change boundary**: `packages/ui/**` only. Read-only-for-context: [apps/builder/src/theme/antdTheme.ts](../../../apps/builder/src/theme/antdTheme.ts), [apps/builder/src/components/ui/AppShell.tsx](../../../apps/builder/src/components/ui/AppShell.tsx), [apps/builder/src/components/ui/PageHeader.tsx](../../../apps/builder/src/components/ui/PageHeader.tsx), [apps/builder/src/components/layout/PageCard.tsx](../../../apps/builder/src/components/layout/PageCard.tsx), [pnpm-workspace.yaml](../../../pnpm-workspace.yaml), root `package.json`. Outside-boundary writes are a gate.

## Subpath exports (frozen)

```jsonc
{
  ".": "./src/index.ts",
  "./Components": "./src/Components/index.ts",
  "./Providers": "./src/Providers/index.ts",
  "./Contexts": "./src/Contexts/index.ts",
  "./Pages": "./src/Pages/index.ts",
  "./Icons": "./src/Icons/index.ts",
  "./Utils": "./src/Utils/index.ts",
  "./constants": "./src/constants/index.ts",
  "./types": "./src/types/index.ts",
  "./themeTokens": "./src/themeTokens.ts",
}
```

`Components` surface for this round: `MasterLayout`, `Sidebar`, `SidebarMenu`, `SidebarMenuItem`. `PageCard` / `PageHeader` are **deferred to Round 02** when `apps/builder` migrates and we can generalise them in-context.

## Invariants

- `apps/builder` keeps building, type-checking, testing, and rendering every route unchanged (this round does not touch it).
- `pnpm install` at the repo root resolves `@mdd/ui` via the existing `packages/*` workspace glob — no `pnpm-workspace.yaml` edit.
- `themeTokens.ts` is a verbatim copy of the tokens currently in [apps/builder/src/theme/antdTheme.ts](../../../apps/builder/src/theme/antdTheme.ts) — same `BRAND`, `RADIUS`, `CONTROL`, `FONT_FAMILY`, `SHADOW`, all component overrides. No new hex literals introduced. (Round 02 will flip builder to import from `@mdd/ui/themeTokens` and delete the local copy.)
- No `@tanstack/react-router` import anywhere under `packages/ui/`.
- `packages/ui` ships **as TS source** — no bundler: `"types": "./src/index.ts"`, `tsc --noEmit` for the type-check gate. Vite in `apps/builder` consumes the source directly via `workspace:*`.
- No hex literals in `MasterLayout` / `Sidebar` — colors come from `theme.useToken()` or AntD's built-in dark theme.

## Plan

### Phase 1 — Scaffold `@mdd/ui` package + shared primitives

**Files** (all new):

- `packages/ui/package.json`
- `packages/ui/tsconfig.json`
- `packages/ui/README.md`
- `packages/ui/src/index.ts`
- `packages/ui/src/types/index.ts`
- `packages/ui/src/constants/index.ts`
- `packages/ui/src/Utils/classNames.ts`
- `packages/ui/src/Utils/index.ts`
- `packages/ui/src/Icons/index.ts` (re-exports `IconProps` type only — no logo asset; consumers pass their own `Logo`)
- `packages/ui/src/themeTokens.ts` (verbatim copy of `apps/builder/src/theme/antdTheme.ts`, default + named export)

**Delete** `packages/ui/.gitkeep`.

**`package.json` shape**:

```jsonc
{
  "name": "@mdd/ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    /* the 10 subpaths above */
  },
  "scripts": {
    "type-check": "tsc --noEmit",
    "test": "vitest run",
  },
  "peerDependencies": {
    "react": "^19",
    "react-dom": "^19",
    "antd": "^6",
    "@ant-design/icons": "^6",
    "react-router-dom": "^7",
    "@tanstack/react-query": "^5",
  },
  "dependencies": { "clsx": "^2.1.1" },
  "devDependencies": {
    "@testing-library/react": "^16",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "antd": "^6",
    "happy-dom": "^20",
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "typescript": "^5",
    "vitest": "^4",
  },
}
```

(Dev-deps versions track `apps/builder/package.json` exactly so resolutions don't fork.)

**`tsconfig.json` shape**:

```jsonc
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
  },
  "include": ["src"],
}
```

No `extends` — the repo has no root tsconfig.

**`src/index.ts` shape**:

```ts
export * as Components from './Components/index.ts';
export * as Contexts from './Contexts/index.ts';
export * as Providers from './Providers/index.ts';
export * as Pages from './Pages/index.ts';
export * as Icons from './Icons/index.ts';
export * as Utils from './Utils/index.ts';
export * as constants from './constants/index.ts';
export * as types from './types/index.ts';
export { themeTokens } from './themeTokens.ts';
```

**`src/types/index.ts` content** (full definitions, used by R01 components):

```ts
import type { FC } from 'react';

export type IconProps = {
  className?: string;
  color?: string;
  height?: number | string;
  variant?: string;
  viewBox?: string;
  width?: number | string;
};

export type NavigationItem = {
  id: string;
  path: string;
  title: string;
  children?: NavigationItem[];
  condition?: boolean;
  disabled?: boolean;
  icon?: FC<IconProps>;
  parentId?: string;
  permission?: string;
  sidebar?: boolean;
};

export type Tab = { id: string; path: string; title: string };

export type AppError = {
  code: string;
  details: { field: string; message: string }[];
  error: string;
  message: string;
  status?: number;
  traceId?: string;
};

export type StatusColors = Record<string, string>;

export type ColumnVisibility = {
  key: string;
  label: string;
  value: boolean;
  disabled?: boolean;
};
```

**`src/constants/index.ts` content**:

```ts
import type { StatusColors } from '../types/index.ts';

export const STATUS_COLORS: StatusColors = {
  PENDING: '#FACC15',
  SCHEDULED: '#60A5FA',
  SKIPPED: '#9CA3AF',
  IN_PROGRESS: '#FB923C',
  COMPLETED: '#34D399',
  FAILED: '#F87171',
  ACTIVE: '#34D399',
};

export const FORMAT_DATE_TYPE = {
  MONTH_DAY: 'MMM DD',
  MONTH_DAY_YEAR: 'MMM DD, YYYY',
} as const;
export type FormatDateType = (typeof FORMAT_DATE_TYPE)[keyof typeof FORMAT_DATE_TYPE];

export const QUICK_DAY_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
] as const;
```

**`src/Utils/classNames.ts` content**:

```ts
import clsx, { type ClassValue } from 'clsx';
export type { ClassValue };
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
export default cn;
```

**`src/Utils/index.ts`**: `export { cn } from './classNames.ts';`.

**`src/Icons/index.ts`**: `export type { IconProps } from '../types/index.ts';` — type-only re-export. No SVG components.

**`src/themeTokens.ts`**: open [apps/builder/src/theme/antdTheme.ts](../../../apps/builder/src/theme/antdTheme.ts), copy its `antdTheme` constant and the `BRAND`/`RADIUS`/`CONTROL`/`FONT_FAMILY`/`SHADOW` locals verbatim, rename the export to `themeTokens`, and add `export default themeTokens;`. Keep every comment.

**`README.md`**: 40–60 lines — install snippet (`workspace:*`), the 10 subpath imports, a minimal `<MddUIProvider>` + `<MasterLayout>` example for `react-router-dom@7`, "deferred" list (`PageCard`, `PageHeader` → R02; `NotFound`, `FormField`, `Modal`, `Button` → R03).

**Gate**:

- `pnpm install` at repo root succeeds and `pnpm -r ls` lists `@mdd/ui`.
- `pnpm --filter @mdd/ui type-check` green.
- `grep -rn "@tanstack/react-router" packages/ui/src/` returns nothing.
- `grep -rn "#" packages/ui/src/themeTokens.ts | wc -l` matches the hex-literal count from `apps/builder/src/theme/antdTheme.ts` (sanity-check for "verbatim copy").

### Phase 2 — `MddUIProvider` + `NavigationContext`

**Files** (all new):

- `packages/ui/src/Contexts/NavigationContext/index.tsx`
- `packages/ui/src/Contexts/index.ts`
- `packages/ui/src/Providers/MddUIProvider/index.tsx`
- `packages/ui/src/Providers/index.ts`

**`Contexts/NavigationContext/index.tsx` spec**:

```ts
export type NavigationDataContextType = {
  currentPageTitle: string;
  currentPageUrl: string;
  sidebarOpen: boolean;
  disabledPaths?: string[];
};
type UpdateKey = keyof NavigationDataContextType;
export type NavigationContextType = {
  data: NavigationDataContextType;
  updateData<K extends UpdateKey>(key: K, value: NavigationDataContextType[K]): void;
};
export const INITIAL_DATA: NavigationDataContextType = {
  currentPageTitle: '',
  currentPageUrl: '',
  sidebarOpen: true,
};

export const NavigationContext = createContext<NavigationContextType>({
  data: INITIAL_DATA,
  updateData: () => { /* noop default */ },
});
export const useNavigationContext = (): NavigationContextType => useContext(NavigationContext);

export type NavigationProviderProps = PropsWithChildren<{
  initial?: Partial<NavigationDataContextType>;
}>;

export const NavigationProvider: FC<NavigationProviderProps> = ({ initial, children }) => {
  const [data, setData] = useState<NavigationDataContextType>({ ...INITIAL_DATA, ...initial });
  const value = useMemo<NavigationContextType>(() => ({
    data,
    updateData: (key, val) => setData(prev => ({ ...prev, [key]: val })),
  }), [data]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
```

**`Contexts/index.ts`**:

```ts
export {
  NavigationContext,
  NavigationProvider,
  useNavigationContext,
  INITIAL_DATA,
} from './NavigationContext/index.tsx';
export type {
  NavigationContextType,
  NavigationDataContextType,
  NavigationProviderProps,
} from './NavigationContext/index.tsx';
```

**`Providers/MddUIProvider/index.tsx` spec**:

```ts
import { ConfigProvider, type ThemeConfig } from 'antd';
import type { Locale } from 'antd/es/locale/index.js';
import type { FC, PropsWithChildren } from 'react';
import { NavigationProvider, type NavigationDataContextType } from '../../Contexts/NavigationContext/index.tsx';
import { themeTokens as defaultTokens } from '../../themeTokens.ts';

export type MddUIProviderProps = PropsWithChildren<{
  theme?: ThemeConfig;
  locale?: Locale;
  initialNavigation?: Partial<NavigationDataContextType>;
}>;

function mergeTheme(override?: ThemeConfig): ThemeConfig {
  if (!override) return defaultTokens;
  return {
    ...defaultTokens,
    ...override,
    token: { ...defaultTokens.token, ...override.token },
    components: { ...defaultTokens.components, ...override.components },
  };
}

export const MddUIProvider: FC<MddUIProviderProps> = ({ theme, locale, initialNavigation, children }) => (
  <ConfigProvider theme={mergeTheme(theme)} locale={locale}>
    <NavigationProvider initial={initialNavigation}>{children}</NavigationProvider>
  </ConfigProvider>
);

export default MddUIProvider;
```

**`Providers/index.ts`**: `export { MddUIProvider, default as MddUIProviderDefault } from './MddUIProvider/index.tsx'; export type { MddUIProviderProps } from './MddUIProvider/index.tsx';`.

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.
- One vitest unit at `packages/ui/src/Contexts/NavigationContext/__tests__/NavigationContext.test.tsx`: render a probe under `<MddUIProvider>`, assert `useNavigationContext().data` equals `INITIAL_DATA`, then call `updateData('sidebarOpen', false)` and assert the re-render shows `sidebarOpen: false`.

### Phase 3 — `MasterLayout` + `Sidebar` + `SidebarMenu`

**Files** (all new):

- `packages/ui/src/Components/MasterLayout/index.tsx`
- `packages/ui/src/Components/Sidebar/index.tsx`
- `packages/ui/src/Components/SidebarMenu/index.tsx`
- `packages/ui/src/Components/SidebarMenu/SidebarMenuItem.tsx`
- `packages/ui/src/Components/index.ts`
- `packages/ui/src/Pages/index.ts` (empty barrel `export {};` — keeps the subpath export shape stable so R03 can add `NotFound` without surface-area churn)

**`MasterLayout/index.tsx` spec**:

Props:

```ts
export type MasterLayoutProps = {
  navigation: NavigationItem[];
  title?: ReactNode;
  Logo?: FC<IconProps>;
  buildVersion?: string;
  children: ReactNode;
};
```

Render tree:

```tsx
<Layout style={{ minHeight: '100vh' }}>
  <Sidebar navigation={navigation} Logo={Logo} buildVersion={buildVersion} />
  <Layout>
    <Layout.Header
      style={
        {
          /* token-driven, see below */
        }
      }
    >
      <AntdButton
        type="text"
        icon={expanded ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
        onClick={() => updateData('sidebarOpen', !expanded)}
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        style={{ fontSize: 18, width: 48, height: 48 }}
      />
      <span style={{ fontSize: 16, fontWeight: 600, color: token.colorTextBase }}>{title}</span>
    </Layout.Header>
    <Layout.Content style={{ padding: 24, background: token.colorBgLayout }}>
      {children}
    </Layout.Content>
  </Layout>
</Layout>
```

Where `expanded = useNavigationContext().data.sidebarOpen`, `updateData = useNavigationContext().updateData`, and `token = theme.useToken().token` (from the AntD `theme` namespace). Header inline style:

```ts
{
  background: token.colorBgContainer,
  borderBottom: `1px solid ${token.colorBorder}`,
  padding: '0 24px 0 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}
```

**No hex literals.**

**`Sidebar/index.tsx` spec**:

Props:

```ts
export type SidebarProps = {
  navigation: NavigationItem[];
  Logo?: FC<IconProps>;
  buildVersion?: string;
};
```

Behavior:

- Reads `expanded` from `NavigationContext`; flips it via the Sider's `onCollapse`.
- Renders `<Layout.Sider theme="dark" collapsible collapsed={!expanded} onCollapse={c => updateData('sidebarOpen', !c)} trigger={null} width={210} collapsedWidth={56} style={{ minHeight: '100vh' }}>`. The `theme="dark"` token applies AntD's dark sider background — **no hex literal**.
- Inside the Sider, top slot: a centered logo container (`display: flex; alignItems: center; justifyContent: center; padding: '16px 8px'; minHeight: 56`). If `Logo` prop is provided, render it via `createElement(Logo, expanded ? { width: 94, height: 24 } : { width: 36, height: 20 })`. If not provided, render nothing (slot stays the same height to avoid layout shift).
- Below the logo: `<SidebarMenu items={navigation} expanded={expanded} />`.
- Optional footer: when `expanded && buildVersion`, render an absolutely-positioned `<div>` at `bottom: 48, left: 0, right: 0` with `color: 'rgba(255,255,255,0.5)'` (acceptable rgba — sider is dark-themed and rgba conveys opacity over the dark background, not a brand color), `fontSize: 11, textAlign: 'center'`.

**`SidebarMenu/index.tsx` spec**:

Props:

```ts
export type SidebarMenuProps = {
  items: NavigationItem[];
  expanded?: boolean; // default true
};
```

Helpers (define inside the file, not exported):

```ts
function pathPrefix(pathname: string): string {
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return '/';
  if (segs.length === 1) return `/${segs[0]}`;
  return `/${segs[0]}/${segs[1]}`;
}

function isActive(itemPath: string, currentPrefix: string): boolean {
  if (itemPath === '/') return currentPrefix === '/';
  return itemPath === currentPrefix || itemPath.startsWith(`${currentPrefix}/`);
}
```

Body:

- `const pathname = useLocation().pathname;` (from `react-router-dom`).
- `const navigate = useNavigate();` (from `react-router-dom`).
- `const currentPrefix = pathPrefix(pathname);`
- `const visibleItems = items.filter(i => i.sidebar !== false);`
- Build `antdItems` via `useMemo(() => visibleItems.map(item => ({ key: item.path, icon: item.icon ? createElement(item.icon) : undefined, label: item.title, disabled: item.disabled })), [visibleItems]);`.
- `const selectedKey = visibleItems.find(i => isActive(i.path, currentPrefix))?.path;`
- Render:

  ```tsx
  <Menu
    mode="inline"
    theme="dark"
    inlineCollapsed={!expanded}
    selectedKeys={selectedKey ? [selectedKey] : []}
    items={antdItems}
    style={{ borderInlineEnd: 'none', background: 'transparent' }}
    onClick={({ key }) => navigate(key as string)}
  />
  ```

**`SidebarMenu/SidebarMenuItem.tsx` spec** (alternative item renderer using `<Link>`; included in the barrel for future use, not consumed by `SidebarMenu` in this round):

Props:

```ts
export type SidebarMenuItemProps = {
  link: string;
  current?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
};
```

Behavior: a clickable item using `<Link to={link}>` from `react-router-dom`; renders an inner `<span>` with class names from `cn('mdd-sbm-item', current && 'mdd-sbm-item--current', disabled && 'mdd-sbm-item--disabled', !expanded && 'mdd-sbm-item--collapsed')` plus inline styles for padding (`8px 12px`), `borderRadius: 6`, `display: 'flex', alignItems: 'center', gap: 8`, `cursor: disabled ? 'not-allowed' : 'pointer'`, `opacity: disabled ? 0.45 : 1`, `whiteSpace: 'nowrap'`, `overflow: 'hidden'`. Renders `icon` (if any) in a flex-shrink-0 wrapper, and `children` (item label) only when `expanded`. When `disabled`, returns the inner span without the `<Link>` wrapper.

**`Components/index.ts`**:

```ts
export { MasterLayout, default as MasterLayoutDefault } from './MasterLayout/index.tsx';
export type { MasterLayoutProps } from './MasterLayout/index.tsx';

export { Sidebar, default as SidebarDefault } from './Sidebar/index.tsx';
export type { SidebarProps } from './Sidebar/index.tsx';

export { SidebarMenu, default as SidebarMenuDefault } from './SidebarMenu/index.tsx';
export type { SidebarMenuProps } from './SidebarMenu/index.tsx';

export {
  SidebarMenuItem,
  default as SidebarMenuItemDefault,
} from './SidebarMenu/SidebarMenuItem.tsx';
export type { SidebarMenuItemProps } from './SidebarMenu/SidebarMenuItem.tsx';
```

**Gate**:

- `pnpm --filter @mdd/ui type-check` green.
- One vitest smoke at `packages/ui/src/Components/MasterLayout/__tests__/MasterLayout.test.tsx` (happy-dom): wrap `<MasterLayout navigation={[{id:'a',path:'/a',title:'A',sidebar:true},{id:'b',path:'/b',title:'B',sidebar:true}]} title="Test">…body…</MasterLayout>` in `<MemoryRouter initialEntries={['/a']}>` + `<MddUIProvider>`. Assert (a) the Sider, Header (with title "Test"), and Content (with body) are all in the DOM; (b) the menu item for `/a` carries the `ant-menu-item-selected` class; (c) clicking the header collapse button changes the Sider's `aria-expanded` or computed width.
- `grep -rn "@tanstack/react-router\|#111827\|#F3F4F6\|#DBE0E5\|#0A0A0A\|#FFFFFF" packages/ui/src/Components/ packages/ui/src/Sidebar/ 2>/dev/null` returns nothing.

### Phase 4 — README + close-out

**Files**:

- `packages/ui/README.md` — fill in: install via `workspace:*`, the 10 subpath imports, a copy-pasteable `<MddUIProvider>` + `<MasterLayout>` example for a `react-router-dom@7` app, the "deferred" list (R02: `PageCard`, `PageHeader`; R03: `NotFound`, `FormField`, `Modal`, `Button`).
- This round file — flip `Status: Complete`, fill `Do`, tick `Check`, write `Act`.

**Gate**:

- `pnpm md:lint` passes for `packages/ui/README.md`.
- The README's import examples compile when pasted into a scratch `.tsx` (manual paste-check, or codify as a tiny vitest typecheck snippet at `packages/ui/src/__tests__/readme-examples.test.tsx`).

## Do

_(progress log — updated as each phase lands)_

## Check

- [ ] Phase 1 gate
- [ ] Phase 2 gate
- [ ] Phase 3 gate
- [ ] Phase 4 gate
- [ ] No outside-boundary edits (`git diff --name-only main...HEAD` stays inside `packages/ui/**` plus this round file)
- [ ] `apps/builder` is byte-identical pre/post Round 01

## Act

**Learnings**: —

**Promotions**:

- [ ] → context/ : (none expected; this is a product package, not governed agent infra)
- [ ] → skills/ : —

## Round chain (for context, not part of this round's scope)

- **Round 02** — Migrate `apps/builder` onto `@mdd/ui`: swap local `AppShell` → `MasterLayout`, fold local `antdTheme.ts` into a re-export of `@mdd/ui/themeTokens`, delete the dup primitives. Promote `PageCard` + `PageHeader` upward as part of that round.
- **Round 03 (optional)** — Add the remaining components a builder route actually asks for (`NotFound`, `FormField`, `Modal`, `Button`) on demand.
