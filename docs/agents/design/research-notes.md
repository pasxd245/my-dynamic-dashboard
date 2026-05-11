# UI Stack Research Notes — Ant Design + TanStack

**Audience**: contributors working on `apps/builder/`
**Last updated**: 2026-05-11
**Linked guideline**: [design-guidelines.md](./design-guidelines.md)

Raw research output. Quotes are taken verbatim from the cited sources;
interpretive notes are clearly separated. This document is the long-form
companion to the opinionated guideline.

---

## 1. Ant Design Design Language

### 1.1 Four core design values

Source: <https://ant.design/docs/spec/values>

> "About 80% of external information is obtained through visual channels."
> — Natural

| Value          | Designer view                                                | User view                                        |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| **Natural**    | reduce cognitive load through visual hierarchy, color, icons | reduce user operations through behavior analysis |
| **Certain**    | modular design reduces cooperative entropy                   | maintain consistency across products             |
| **Meaningful** | clear goals, immediate feedback                              | moderate challenge, full devotion                |
| **Growing**    | connect product functions to user needs across scenarios     | design humans + systems as a dynamic group       |

> "Perfection is achieved … when there is nothing left to take away."
> — Certain

### 1.2 Design principles (10)

Listed in the Ant Design spec navigation:

Proximity · Alignment · Contrast · Repetition · Make it Direct ·
Stay on the Page · Keep it Lightweight · Provide an Invitation ·
Use Transition · React Immediately

### 1.3 Layout & spacing scale

Source: <https://ant.design/docs/spec/layout>

> "The base unit of the grid is 8, which not only matches the even
> number of ideas."

Key numbers:

- **Base unit**: 8px
- **Grid**: 24-column
- **Content area**: 1168px (within 1440px design board)
- **Common breakpoints referenced**: 1920, 1440, 1366, 1280

> "All the numbers are multiples of 8 and have a dynamic sense of rhythm."

The spec emphasizes systematic consistency through the 8px base unit
rather than prescribing granular spacing values. In practice the spacing
ramp commonly used is `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` px.

The overview spec (<https://ant.design/docs/spec/overview>) does not
itself list spacing numbers; the layout spec is the canonical source.

### 1.4 Token architecture (v5/v6)

Source: <https://ant.design/docs/react/customize-theme>

> "Map Tokens are derived from Seed Tokens, and Alias Tokens are derived
> from Map Tokens."

Three layers:

1. **Seed tokens** — origin values: `colorPrimary`, `borderRadius`,
   `fontSize`, `fontFamily`, `controlHeight`, …
2. **Map tokens** — derived from seeds via algorithms (e.g. color
   gradients, size scales)
3. **Alias tokens** — derived from map tokens, used by components

Core seed tokens worth knowing:

- `colorPrimary` — brand color; auto-generates related hues
- `colorBgBase` — background derivation origin
- `colorTextBase` — text color derivation origin
- `borderRadius` — base; generates `borderRadiusSM`, `borderRadiusLG`
- `fontSize` — base; derives heading/component sizes
- `fontFamily` — system font stack
- `controlHeight` — button/input baseline (AntD default: **32**)

### 1.5 Algorithm system

> `algorithm: [darkAlgorithm, compactAlgorithm]` creates dark + compact
> themes simultaneously.

- `theme.defaultAlgorithm` — standard light
- `theme.darkAlgorithm` — dark mode palette
- `theme.compactAlgorithm` — reduced sizing

Algorithms compose, so multiple modes can run at once.

### 1.6 ConfigProvider API

Source: <https://ant.design/components/config-provider>

Placement (at app root):

```tsx
<ConfigProvider theme={{ token: { colorPrimary: '#1890ff' } }}>
  <App />
</ConfigProvider>
```

Component-level overrides via `theme.components`:

```tsx
theme: {
  components: {
    Button: { token: { colorPrimary: '#ff0000' }, algorithm: true }
  }
}
```

Other features mentioned in the doc:

- `csp={{ nonce: 'YourNonceCode' }}` for Content Security Policy
- `prefixCls` (default `ant`) — used by `.ant-*` class scoping
- `useToken()` hook for reading current tokens at runtime
- **v6+ zero-runtime mode** via `theme: { zeroRuntime: true }` — static
  style generation, pre-compiled CSS, no runtime injection

---

## 2. TanStack Philosophy

### 2.1 Table — "100% headless"

Source: <https://tanstack.com/table/latest>

> "TanStack Table is a headless UI library — it provides the logic,
> state, processing and API for UI elements while explicitly **not**
> providing markup, styles, or pre-built implementations."

What it provides:

- Data-processing, state management, business logic
- Functions, state utilities, event listeners
- Core capabilities: sorting, filtering, grouping, pagination,
  virtualization, column visibility, row selection

What it does NOT provide:

- Markup or DOM structure
- Styling or theming
- Pre-built, styled components

> "Full control over markup and styles" while supporting "all styling
> patterns (CSS, CSS-in-JS, UI libraries, etc)."

### 2.2 Why this composes well with AntD

AntD ships ready-to-use components with "little setup required" but
opinionated markup. TanStack Table inverts that — minimal abstraction,
maximum control. The two compose cleanly when:

- **TanStack** owns table state (sort, page, filter, selection)
- **AntD** components render inside cells/headers for visual chrome
  (`Tag`, `Tooltip`, `Button`, `Pagination`)

This is the pattern we adopted on `/saved-queries`. See
[design-guidelines.md § Tables](./design-guidelines.md#tables) for the
opinionated do/don't.

### 2.3 Minimal Table setup

Source: <https://tanstack.com/table/latest/docs/guide/tables>

> "To create a table instance, 2 `options` are required: `columns` and
> `data`."

```ts
const table = useReactTable({ columns, data });
```

> "data needs a 'stable' reference (especially in React) in order to
> prevent infinite re-renders."

Use `useState`, `useMemo`, or externally-managed data.

> "Column definitions are where we will tell TanStack Table how each
> column should access and/or transform row data with either an
> `accessorKey` or `accessorFn`."

In this repo, see
[`SavedQueryLibraryPage.tsx`](../../apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx)
for the working pattern: `useReactTable` + `getCoreRowModel` +
`getSortedRowModel` + `flexRender`, with `manualPagination: true` because
the data is server-paginated.

### 2.4 TanStack Query — server state

Source: <https://tanstack.com/query>

> Server state is "persisted remotely in a location you may not control
> or own" and "can potentially become out of date in your applications
> if you're not careful."

Core hooks:

- **`useQuery`** — fetch + cache server data; auto loading/error/success
- **`useMutation`** — POST/PUT/DELETE
- **`useQueryClient`** — programmatic cache access for invalidation

Query keys (e.g. `['repoData']`) drive automatic deduplication, caching,
and invalidation.

| Concept    | Meaning                                                  |
| ---------- | -------------------------------------------------------- |
| Stale time | duration before cached data is marked as needing refresh |
| Cache time | how long unused data lives in memory before GC           |

Replaces the manual `useEffect + useState + fetch` pattern for server
data.

### 2.5 TanStack Form — headless form state

Source: <https://tanstack.com/form>

> "Headless solution, meaning it manages form state independently from
> UI rendering."

- Foundation: `useForm` hook (React) / `createForm` (Vue/Solid)
- Field-level validation: `onChange`, `onChangeAsync` +
  `onChangeAsyncDebounceMs`
- Error state tied to touch/blur events
- No built-in components — bring your own UI

> Enables "seamless integration with existing UI libraries like Ant
> Design."

---

## 3. This repo's design tokens

### 3.1 Source palette (from `docs/agents/design/Styles.css`)

| Token     | Hex       | Role                |
| --------- | --------- | ------------------- |
| Blue      | `#4F45B6` | brand primary       |
| Yellow    | `#F8C140` | warning             |
| Red       | `#F84040` | error               |
| Green     | `#86F552` | success             |
| Cyan      | `#64C4F7` | info                |
| Orange    | `#F58869` | accent              |
| Black     | `#252525` | text on light       |
| Dark Blue | `#2D3845` | secondary ink       |
| Gray 1    | `#F5EFFC` | lavender bg         |
| Gray 2    | `#ECEEFB` | lavender surface    |
| Gray 3    | `#D1D1D1` | neutral line        |
| Gray 4    | `#A098AE` | muted ink           |
| Dark Bg   | `#261E35` | dark mode bg        |
| Dark 1    | `#2E293E` | dark mode surface 1 |
| Dark 2    | `#1E192A` | dark mode surface 2 |

Radius scale: **5 · 10 · 15 · 20** px.
Brand shadow: `0 20px 50px rgba(191, 21, 108, 0.05)` (soft pink halo).
Fonts: **Cairo** (display) + **Poppins** (body/UI).

### 3.2 CSS-variable mirror in `apps/builder/src/index.css`

See [index.css:7–47](../../apps/builder/src/index.css#L7-L47). Every
hex above is exposed as a CSS custom property
(`--color-blue`, `--color-gray-1`, …) plus radius (`--radius-sm` …
`--radius-xl`) and `--shadow-card`. Legacy aliases
(`--upload-ink`, `--upload-accent`, …) point back to the same values.

### 3.3 AntD ConfigProvider mapping

(`apps/builder/src/theme/antdTheme.ts`)

| AntD seed token      | Value                                  | Source                                 |
| -------------------- | -------------------------------------- | -------------------------------------- |
| `colorPrimary`       | `#4F45B6`                              | Styles.css blue                        |
| `colorInfo`          | `#64C4F7`                              | Styles.css cyan                        |
| `colorSuccess`       | `#86F552`                              | Styles.css green                       |
| `colorWarning`       | `#F8C140`                              | Styles.css yellow                      |
| `colorError`         | `#F84040`                              | Styles.css red                         |
| `colorTextBase`      | `#2D3845`                              | dark blue ink                          |
| `colorBgBase`        | `#FFFFFF`                              | white                                  |
| `colorBorder`        | `#E4DEEF`                              | matches `--surface-line`               |
| `borderRadiusXS`     | 5                                      | Styles.css 5                           |
| `borderRadiusSM`     | 10                                     | Styles.css 10                          |
| `borderRadius`       | 10                                     | Styles.css 10 (default)                |
| `borderRadiusLG`     | 20                                     | Styles.css 20                          |
| `fontFamily`         | `'Cairo', 'Poppins', …`                | Styles.css                             |
| `fontSize`           | 14                                     | body baseline                          |
| `controlHeightSM`    | 32                                     | small/compact                          |
| `controlHeight`      | 40                                     | **default — matches Round 33 buttons** |
| `controlHeightLG`    | 48                                     | hero/CTA                               |
| `boxShadow`          | `0 6px 16px rgba(55, 49, 95, 0.06)`    | card                                   |
| `boxShadowSecondary` | `0 20px 50px rgba(191, 21, 108, 0.05)` | brand                                  |

Per-component overrides (`components.X.…`):

- **Button** — `borderRadius: 20`, `fontWeight: 600`,
  `primaryShadow: "none"`, `defaultShadow: "none"` (kill the loud halo)
- **Input** — `borderRadius: 10`, `paddingBlock: 8`
- **Select** — `borderRadius: 10`, `multipleItemHeight: 24`
- **Pagination** — `itemActiveBg: "#FFFFFF"`, `borderRadius: 10`
- **Modal / Card** — `borderRadiusLG: 20`
- **Form** — `itemMarginBottom: 16`, `verticalLabelPadding: "0 0 4px"`
- **Radio** — `borderRadius: 10`

---

## 4. Control sizing standard

| Variant | Height                   | Use                                 |
| ------- | ------------------------ | ----------------------------------- |
| Small   | 32px (`controlHeightSM`) | compact lists, table action buttons |
| Default | 40px (`controlHeight`)   | primary inputs/selects/buttons      |
| Hero    | 48px (`controlHeightLG`) | landing CTAs, prominent submit      |

Non-AntD elements (see [index.css:75–113](../../apps/builder/src/index.css#L75-L113))
are written to match the **default** 40px:

```css
input:not([class*='ant-']),
select:not([class*='ant-']),
textarea:not([class*='ant-']) {
  min-height: 2.5rem; /* 40px */
}

button:not([class*='ant-']) {
  height: 2.5rem; /* 40px */
}
```

### 4.1 The `:not([class*="ant-"])` scoping pattern

Reason: the global element resets in `index.css` apply Round 33's blue
primary-pill defaults. Without scoping, those leak onto every AntD
button/input. The `:not([class*="ant-"])` selector excludes elements
that have any `ant-*` class — i.e. every AntD primitive — so AntD
components keep their own theme tokens while legacy raw `<button>` /
`<input>` elements still get the blue pill.

Specificity math:

- Tailwind preflight: `button { background-color: transparent }` = 0,0,1
- Our default: `button:not([class*="ant-"]) { … }` = 0,1,1 → wins
- AntD class: `.ant-btn { … }` = 0,1,0 → AntD is excluded by `:not()`,
  not by specificity
- Tailwind utility: `.bg-white` = 0,1,0 → wins on properties it declares

---

## 5. Layout primitives in this repo

### 5.1 WorkflowShell — workflow routes card

`apps/builder/src/components/workflow-shell/WorkflowShell.tsx` wraps
all `/workflow/*` routes in a `<section>` with:

```css
rounded-lg border border-slate-200 bg-white p-4 space-y-4
```

Contains stage navigation buttons + active-context bar + connection
status + prerequisite callouts above the routed stage content.

### 5.2 `pageCardStyle` — query-management routes card

`apps/builder/src/App.tsx` defines `pageCardStyle` and wraps each of
`/`, `/saved-queries`, and `/saved-queries/:queryId` in the same
white-card surface so all routes render at the same visual level.

```ts
const pageCardStyle: React.CSSProperties = {
  border: '1px solid #e8e2f5',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--color-white)',
  padding: '1rem 1.1rem 1.25rem',
  boxShadow: '0 6px 16px rgba(55, 49, 95, 0.06)',
};
```

### 5.3 App shell

`App.tsx` provides:

- Left sidebar (`<aside>`) — collapsible, with grouped nav
  ("Query Management" / "Workflow Management") and a collapsed icon
  rail when toggled.
- Top bar — search pill (`Input`-styled), language dropdown,
  notification button, user avatar block.
- Content area — breadcrumb header + routed content inside
  `pageCardStyle` (query routes) or `WorkflowShell` (workflow routes).

### 5.4 Round 33 feedback layer

Custom — not AntD:

- `LoadingMask` (container/screen scope) — `apps/builder/src/components/feedback/LoadingMask.tsx`
- `ToastStack` — `apps/builder/src/components/feedback/ToastStack.tsx`
- `UploadStageSidebar` — `apps/builder/src/components/upload-flow/UploadStageSidebar.tsx`

These were intentionally **not** swapped to AntD in Round 34 to avoid
churn on freshly-shipped, tested code. They can be migrated to AntD
`Spin` + `message`/`notification` + `Steps` in a future round.

---

## 6. Open questions

| Topic                       | Status         | Note                                                                                               |
| --------------------------- | -------------- | -------------------------------------------------------------------------------------------------- |
| Icon library                | Mixed          | `lucide-react` in `App.tsx`, `@ant-design/icons` available; no rule yet.                           |
| Dark mode                   | Not started    | AntD `darkAlgorithm` exists; `Styles.css` already has dark surfaces.                               |
| Mobile breakpoints          | Implicit       | Round 33 only handled "wraps on narrow widths"; no explicit breakpoint table.                      |
| Accessibility checklist     | Not formalized | AntD components are mostly accessible; custom feedback layer (toast, loading mask) needs an audit. |
| Animation policy            | None           | AntD principle "Use Transition" is implicit; no shared timing/easing tokens documented.            |
| Density (compact algorithm) | Not used       | AntD `compactAlgorithm` is available but not enabled.                                              |
| Zero-runtime mode           | Not used       | AntD v6+ supports `zeroRuntime: true`; would require importing pre-compiled CSS.                   |

---

## Sources

- [Ant Design — Design Values](https://ant.design/docs/spec/values) — Ant Group, retrieved 2026-05-11. Primary. Four-value design language.
- [Ant Design — Spec Overview](https://ant.design/docs/spec/overview) — Ant Group, retrieved 2026-05-11. Primary. Pointer to layout/font specs.
- [Ant Design — Layout Spec](https://ant.design/docs/spec/layout) — Ant Group, retrieved 2026-05-11. Primary. 8px grid + 24-column.
- [Ant Design — Customize Theme](https://ant.design/docs/react/customize-theme) — Ant Group, retrieved 2026-05-11. Primary. Token architecture + algorithms.
- [Ant Design — ConfigProvider](https://ant.design/components/config-provider) — Ant Group, retrieved 2026-05-11. Primary. Provider API.
- [TanStack Table — Overview](https://tanstack.com/table/latest) — TanStack, retrieved 2026-05-11. Primary. Headless philosophy.
- [TanStack Table — Tables Guide](https://tanstack.com/table/latest/docs/guide/tables) — TanStack, retrieved 2026-05-11. Primary. Setup pattern.
- [TanStack Query](https://tanstack.com/query) — TanStack, retrieved 2026-05-11. Primary. Server state concepts.
- [TanStack Form](https://tanstack.com/form) — TanStack, retrieved 2026-05-11. Primary. Headless form state.
- [`docs/agents/design/Styles.css`](./Styles.css) — local. Source palette + radius scale.
- [`apps/builder/src/index.css`](../../apps/builder/src/index.css) — local. CSS-variable mirror + control sizing.
- [`apps/builder/src/theme/antdTheme.ts`](../../apps/builder/src/theme/antdTheme.ts) — local. Token mapping.
