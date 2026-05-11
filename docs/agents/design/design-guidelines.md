# Design Guidelines — `apps/builder/`

**Stack**: React 19 · Vite · Tailwind CSS · Ant Design v6 · TanStack
(Table / Query / Form) · Custom brand tokens from
`docs/agents/design/Styles.css`.

**Audience**: anyone implementing a feature in `apps/builder/`. Read this
first; consult [research-notes.md](./research-notes.md) for sources,
quotes, and deeper context.

**Updated**: 2026-05-11 (Round 34 finalization pass).

> **Operating principle**: the standard applies by default. Every
> primitive, token, and CSS class listed below ships with sensible
> brand-matched defaults. Reach for a custom value only when a
> documented design constraint requires it, and then document the
> deviation in the relevant Round file or PR.

---

## 1. Tokens (source of truth)

| File                                                                                  | Role                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`apps/builder/src/theme/antdTheme.ts`](../../../apps/builder/src/theme/antdTheme.ts) | AntD `ConfigProvider` config — every AntD component reads from here |
| [`apps/builder/src/index.css`](../../../apps/builder/src/index.css) (`:root`)         | CSS custom properties — every non-AntD surface reads from here      |
| [`docs/agents/design/Styles.css`](./Styles.css)                                       | Extracted spec from the Figma source — both files above mirror this |

The token tables (CSS var ↔ AntD seed token ↔ hex) live in
[research-notes § 3.3](./research-notes.md#33-antd-configprovider-mapping).

**Rule**: in new code, use a token. Never hard-code hex values; never
duplicate radii / shadows / font-family literally.

### 1.1 Primary tokens at a glance

| Need                                    | AntD token                                                  | CSS var                         |
| --------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| Brand primary                           | `colorPrimary` (#4F45B6)                                    | `--color-blue`                  |
| Dark ink                                | `colorTextBase` (#2D3845)                                   | `--color-dark-blue`             |
| Surface                                 | `colorBgBase` (#FFFFFF)                                     | `--color-white`                 |
| Page background                         | `colorBgLayout` (#F5F4F8)                                   | `--upload-warm`                 |
| Surface border                          | `colorBorder` (#E4DEEF)                                     | `--surface-line`                |
| Status success / warning / error / info | `colorSuccess/Warning/Error/Info`                           | `--color-green/yellow/red/cyan` |
| Small / default / card radius           | `borderRadiusSM`/`borderRadius`/`borderRadiusLG` (10/10/20) | `--radius-sm/md/lg/xl`          |
| Card shadow                             | `boxShadow`                                                 | inline (see `.page-card`)       |
| Brand shadow                            | `boxShadowSecondary`                                        | `--shadow-card`                 |

### 1.2 Motion tokens

`motionDurationFast: 120ms`, `Mid: 180ms`, `Slow: 240ms`. Use these for
hover / focus / transition timings rather than ad-hoc `0.15s`.

---

## 2. Sizing — locked

Three tiers only. Pick one per surface, do not invent intermediates.

| Tier        | px     | AntD token          | When                                                  |
| ----------- | ------ | ------------------- | ----------------------------------------------------- |
| Small       | 32     | `controlHeightSM`   | dense lists, table action buttons, secondary controls |
| **Default** | **40** | **`controlHeight`** | **primary inputs / selects / buttons (most code)**    |
| Hero        | 48     | `controlHeightLG`   | landing CTAs, prominent submit                        |

Non-AntD elements are pinned to **40 px** by tag-level rules in
[`index.css`](../../../apps/builder/src/index.css). Do not introduce a
36-px or 44-px button.

Spacing is on the 8 px grid (`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`).
Prefer Tailwind spacing utilities or the `.stack-N` helpers (see § 3.3)
over inline `style` numbers.

---

## 3. Layout — canonical primitives

### 3.1 `<PageCard>` — every route lives in one

[`apps/builder/src/components/layout/PageCard.tsx`](../../../apps/builder/src/components/layout/PageCard.tsx)

```tsx
import { PageCard } from "./components/layout";

<Route path="/saved-queries" element={
  <PageCard>
    <SavedQueryLibraryPage workspaceId={...} />
  </PageCard>
} />
```

- Renders a `<section>` with the `.page-card` master CSS class
  (white surface, `--radius-xl` corners, `--surface-line` border, soft
  card shadow, comfortable padding).
- `variant="flush"` removes padding + clips overflow when the page
  draws its own internal layout (used by the guided-upload two-pane
  surface).

**Rule of one card**: don't nest PageCards. Don't add a second wrapper
inside a route component — the chrome belongs to the route shell.

### 3.2 `WorkflowShell` — workflow routes

[`apps/builder/src/components/workflow-shell/WorkflowShell.tsx`](../../../apps/builder/src/components/workflow-shell/WorkflowShell.tsx)

A specialized PageCard that adds stage navigation, active-context bar,
connection status, and prerequisite callouts. Renders with the same
`.page-card` class for visual parity. Use for any `/workflow/*` route.

### 3.3 `.page-section` — interior regions

A card holding multiple stacked regions uses `.page-section` siblings:

```tsx
<PageCard>
  <section className="page-section">
    <h2 className="page-section__title">Source</h2>…
  </section>
  <section className="page-section">…</section>
</PageCard>
```

`.page-section + .page-section` carries a `1rem` top margin
automatically; alternatively use a `.stack-4` wrapper for the same
rhythm without the bordered look.

### 3.4 Vertical rhythm — `.stack-N`

`.stack-2 / .stack-3 / .stack-4 / .stack-6 / .stack-8` apply
`margin-top` between siblings (0.5 / 0.75 / 1 / 1.5 / 2 rem). Aligns
with the 8 px grid and replaces ad-hoc Tailwind `space-y-*`.

### 3.5 App shell

The sidebar + top bar + breadcrumb header are owned by
[`App.tsx`](../../../apps/builder/src/App.tsx). New nav items go into
the existing "Query Management" / "Workflow Management" groups; the
collapsed icon rail mirrors the expanded nav — keep both in sync.

---

## 4. Component picking — AntD vs TanStack vs custom

```
Need a …                       → Use
──────────────────────────────────────────────────────────────
Button, Tag, Tooltip, Modal,   → AntD
  Alert, Empty, Spin, Pagination,
  Drawer, Popover, Steps, Tabs,
  Card, Breadcrumb, Badge
Form layout + inputs           → AntD Form + Input/Select/Radio
                                   (TanStack Form only if validation
                                   logic gets complex — see § 5)
Server data fetching/caching   → TanStack Query (useQuery / useMutation)
Table / data grid              → TanStack Table  ← important
Custom non-list interactions   → custom React (e.g. feedback layer)
Icon                           → lucide-react OR @ant-design/icons
                                   (pick one per visual cluster; do
                                    not mix in the same control row)
```

### 4.1 Why TanStack Table, not AntD Table

- Server-paginated, server-sorted data (`manualPagination: true`)
- Custom row styling (deleted rows, hover, route-on-click)
- Cells composed of AntD primitives (`Tag`, `Tooltip`, `Button`)
- Bundle parsimony — AntD Table is heavy

See [research-notes § 2.1–2.3](./research-notes.md#21-table--100-headless).

---

## 5. Forms

**Pick AntD Form alone** unless you have a concrete reason to add
TanStack Form. Most forms here are short (3–6 fields, simple
validation), and AntD Form + native `useState`/`useEffect` keeps reads
short. Canonical implementations:

- [`SaveQueryDialog.tsx`](../../../apps/builder/src/components/SavedQuery/SaveQueryDialog.tsx)
- [`UpdateQueryDialog.tsx`](../../../apps/builder/src/components/SavedQuery/UpdateQueryDialog.tsx)
- [`SavedQuerySearch.tsx`](../../../apps/builder/src/components/SavedQuery/SavedQuerySearch.tsx)

Adopt TanStack Form only when one of these is true:

- Async validation with debouncing
- Many fields with cross-field dependencies
- The same form needs to run on multiple UI libraries (we don't)

If you do, keep AntD `Form.Item` for layout/label/error display and
let TanStack Form own the state — see
[research-notes § 2.5](./research-notes.md#25-tanstack-form--headless-form-state).

---

## 6. Tables

Canonical implementation:
[`SavedQueryLibraryPage.tsx`](../../../apps/builder/src/pages/SavedQueryLibrary/SavedQueryLibraryPage.tsx).

Pattern:

1. `useReactTable({ data, columns, manualPagination: true, ... })`
2. Render with `flexRender` inside the `.dt-table` classes in
   [`index.css`](../../../apps/builder/src/index.css).
3. Compose cells from AntD primitives:
   - `Tag` for chip-style values
   - `Tooltip` for overflow / "+N more"
   - `Button type="link"` for inline row actions
4. Pagination uses AntD `Pagination` placed beside the table
   (`current = floor(offset / limit) + 1`).

Don't:

- Render a raw `<table>` without the `.dt-table` classes.
- Wrap `<table>` in AntD `Table` (that's two table layers).
- Re-implement pagination math; use AntD `Pagination`.

For server state, prefer TanStack Query (`useQuery` / `useMutation`)
over raw `fetch + useState + useEffect`. Existing code under
`apps/builder/src/state/` predates the Query adoption; new screens
should use Query.

---

## 7. Visual feedback

| Feedback               | Use                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| Loading inside a panel | AntD `<Spin spinning>`                                                                             |
| Full-screen / blocking | Custom `LoadingMask scope="screen"` (Round 33 component)                                           |
| Ephemeral toast        | Custom `ToastStack` (Round 33) — migration to AntD `message`/`notification` is in the backlog      |
| Inline validation      | AntD `Form.Item` `validateStatus` / `help`                                                         |
| Empty state            | AntD `<Empty>`                                                                                     |
| Action error           | AntD `<Alert type="error" description={…}>` (use `description`, not the deprecated `message` prop) |
| Modal                  | AntD `<Modal destroyOnHidden …>` (use `destroyOnHidden`, not the deprecated `destroyOnClose`)      |

---

## 8. Do / Don't

### Do

- **DO** use `ConfigProvider` theme tokens (or CSS vars) — never hard-code hex values.
- **DO** put every route inside `<PageCard>` (query routes) or `WorkflowShell` (workflow routes). Pick one.
- **DO** use `<PageCard variant="flush">` for pages that draw to the card edge.
- **DO** wrap TanStack table cells in AntD primitives (`Tag`, `Tooltip`, `Button`).
- **DO** use TanStack Query for any server data new screens read or write.
- **DO** size all controls to **32 / 40 / 48** px.
- **DO** stay on the 8 px spacing grid — use Tailwind spacing utilities or `.stack-N` helpers.
- **DO** use the `Alert description={…}` API in AntD v6.

### Don't

- **DON'T** hand-roll table markup — go through `.dt-table` + TanStack.
- **DON'T** double-wrap (no AntD `Table` wrapping TanStack rows, no PageCard inside a route component when the route already wraps it).
- **DON'T** set `box-shadow` per-button — the brand shadow lives in `boxShadowSecondary` / `--shadow-card`, primary/default/danger button shadows are explicitly set to `none` in the theme.
- **DON'T** add inline `style={{ background: '#4F45B6' }}` — use `var(--color-blue)` or an AntD primitive.
- **DON'T** introduce another control-height tier (no 36-px, 44-px, 56-px buttons).
- **DON'T** introduce a new page-card wrapper — extend `PageCard` or open a guideline change instead.
- **DON'T** mix lucide and `@ant-design/icons` inside the same row/cluster of controls.

---

## 9. Open questions / forward work

Some decisions are deliberately deferred. When you hit one, flag it in
the next round-planning doc rather than improvising.

1. **Icon library policy.** Both `lucide-react` and `@ant-design/icons`
   are installed. Current convention is "lucide for Round 33 sidebar /
   top-bar leftovers, ant-design icons inside AntD components." Worth
   formalizing.
2. **Dark mode.** `Styles.css` already has dark surfaces
   (`#261E35`, `#2E293E`, `#1E192A`); AntD ships `darkAlgorithm`. Not
   wired yet.
3. **Density / compact mode.** AntD `compactAlgorithm` is available but
   not enabled.
4. **Mobile breakpoints.** Round 33 added "wraps on narrow widths" but
   no breakpoint table; AntD references 1280 / 1366 / 1440 / 1920
   desktop widths. No mobile spec yet.
5. **Accessibility checklist.** AntD components are mostly accessible
   out of the box; the custom feedback layer (toast, loading mask,
   upload stage sidebar) needs a focused audit.
6. **Zero-runtime mode.** AntD v6+ supports `theme: { zeroRuntime: true }`
   for static style extraction. Would need pre-compiled CSS import.
7. **Migration of the Round 33 custom feedback layer** to AntD
   `Spin fullscreen` + `message`/`notification` + `Steps` is open — was
   intentionally scoped out of Round 34 to avoid regression on tested
   surfaces.

---

## 10. References

- [research-notes.md](./research-notes.md) — long-form research with citations.
- [`Styles.css`](./Styles.css) — extracted style spec from the design source (Figma).
- [`Styles.png`](./Styles.png), [`Sample.png`](./Sample.png) — visual references.
- [`apps/builder/src/theme/antdTheme.ts`](../../../apps/builder/src/theme/antdTheme.ts) — AntD `ConfigProvider` token mapping.
- [`apps/builder/src/index.css`](../../../apps/builder/src/index.css) — CSS variables, control sizing, master styles (`.page-card`, `.page-section`, `.dt-table`, `.stack-N`).
- [`apps/builder/src/components/layout/PageCard.tsx`](../../../apps/builder/src/components/layout/PageCard.tsx) — canonical route wrapper.
- Round 33 close: [.agents/plan/cycles/Round_33.md](../../../.agents/plan/cycles/Round_33.md)
- Round 34 (in progress): [.agents/plan/cycles/Round_34.md](../../../.agents/plan/cycles/Round_34.md)
