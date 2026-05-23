# Workspace Shell — canonical design intent

**Concept**: top-level application shell that hosts every feature
domain. Round 07's deliverable; this is the first occupant's view.
**Status**: Draft (Round 07 Plan-phase input).
**Round introduced**: [Round_07](../../plan/cycles/Round_07.md).
**Domain folder**: `data-management/` — placed here because Data
Management is the first puller. Promote to `_platform/` (or named at
promotion time) when a second domain consumes the shell. See
[../README.md](../README.md) §"First puller wins".

---

## Reference materials (read-only)

| Source                                                                                                   | What we look at it for                                                                                                   | Adopted?                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tmp/ref-apps/my-dynamic-dashboard-drifted/docs/agents/design/Sample.png`                                | Sidebar + content layout proportions; left-rail icon nav; right-rail rhythm                                              | **Layout**: yes, partially. **Brand palette / typography**: no, deferred                                                                                 |
| `tmp/ref-apps/my-dynamic-dashboard-drifted/docs/agents/design/Styles.css`                                | Brand colours (Blue `#4F45B6`, Dark Blue `#2D3845`, accent palette, `Cairo` / `Poppins` fonts, `border-radius: 15-20px`) | **No** this round. Cited for a future brand-refresh round; current shell uses [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts) as-is. |
| `tmp/ref-apps/my-dynamic-dashboard-drifted/apps/builder/src/components/workflow-shell/WorkflowShell.tsx` | Drifted shell composition; what BIZ-coupling crept in                                                                    | Used as cautionary example for the component contract — not a code template                                                                              |
| [memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md)       | UI/BIZ boundary rule                                                                                                     | **Yes**: the shell primitive in `@mdd/ui` stays router-agnostic, no BIZ peer deps                                                                        |

The drifted brand-palette decision is deliberately deferred. R04
established AntD-default tokens (`colorPrimary: #1677ff`,
`borderRadius: 6`); a brand refresh to the drifted palette would be
its own round with its own pull. R07 ships the shell in R04's
visual language; a future round can re-skin it without restructuring
the shell.

---

## Layout — ASCII intent

Dimensions are approximate; the React implementation will use
flex/grid to fluidly fill the viewport. Numbers in parentheses are
the target widths in pixels at desktop ≥1280px.

```text
┌─────────┬──────────────────────────────────────────────────────────┐
│         │  Data Management                                          │
│   M     │  ───────────────────────────────────────────────────────  │
│   D     │                                                            │
│   D     │  ┌─────────────────────────────────────────────────────┐  │
│         │  │                                                       │ │
│         │  │  (Placeholder content)                                │ │
│ ┌─────┐ │  │                                                       │ │
│ │ ▣   │ │  │  R07 stub: a heading + 3-sentence intent paragraph    │ │
│ │ Dat │ │  │  describing what this page will hold (CSV upload,     │ │
│ └─────┘ │  │  dataset list, schema view). Real Data Management     │ │
│         │  │  features arrive in later rounds, each its own        │ │
│         │  │  design doc + round.                                  │ │
│         │  │                                                       │ │
│         │  └─────────────────────────────────────────────────────┘  │
│         │                                                            │
│         │                                                            │
│         │                                                            │
└─────────┴──────────────────────────────────────────────────────────┘
  ↑ 88px            ↑ fluid (min 800px content area)
  Sidebar          Content area

Active nav-item ─┐
                 └─ "▣ Dat" pill: filled-background + raised text colour
                    (rest of nav-items render as icon-only or text-only
                    glyphs; only the active item gets the pill)
```

### Structural notes

- **Sidebar**: fixed width `88px` (compact-mode default for R07; an
  expanded-mode toggle is **out of scope** — defer to a later round).
- **Top app-bar**: deliberately absent in R07. The drifted iteration
  had search + language switcher + user menu in a top bar; those are
  BIZ concerns (search of what? user of which account?) and stay
  deferred. The content area starts at the top edge with the page
  title.
- **Right rail** (drifted Sample had Server Status / Contacts /
  Messages / Activity): **out of scope**. Single-column content
  area for R07; right-rail composition is a per-page decision in
  later rounds.
- **Workspace picker**: **out of scope**. R07 ships an implicit
  single "default" workspace context; a picker arrives when a
  second workspace pull is real. See
  [memory/2026-05-22-round-roadmap-deferrals.md](../../memory/2026-05-22-round-roadmap-deferrals.md).

---

## Token map

All tokens cite
[workspace/packages/ui/src/themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts)
or the AntD seed-token system. Nothing here introduces a new token.

| Surface                              | Source                                                                          | Value (informational)  |
| ------------------------------------ | ------------------------------------------------------------------------------- | ---------------------- |
| Sidebar background                   | AntD seed `colorBgContainer` (derived from `colorBgBase`)                       | `#ffffff`              |
| Sidebar right border                 | AntD seed `colorBorderSecondary`                                                | derived                |
| Active nav-item background           | AntD seed `colorPrimary` (10% alpha tint via `colorPrimaryBg`)                  | derived from `#1677ff` |
| Active nav-item text/icon            | AntD seed `colorPrimary`                                                        | `#1677ff`              |
| Idle nav-item icon/text              | AntD seed `colorTextSecondary`                                                  | derived                |
| Content area background              | AntD seed `colorBgLayout`                                                       | derived                |
| Page title text                      | AntD seed `colorTextHeading`                                                    | derived                |
| Body text                            | AntD seed `colorText`                                                           | `#000000`              |
| Border radius (nav-item pill, cards) | `borderRadius: 6`                                                               | `6px`                  |
| Font                                 | `fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` | system stack           |

If R07 implementation finds that AntD's `<Layout.Sider>` does not
expose a clean styling hook for one of these surfaces, document the
deviation in the round's Do phase and update this table; do not
introduce ad-hoc hex values.

---

## Icons

Each nav-item carries an icon from
[`@ant-design/icons@^6.0.0`](https://ant.design/components/icon) (a
peer dependency of `@mdd/ui`). The icon is the entire visual content
when the sidebar is in any future collapsed mode, so the choice
should be recognisable at small size.

**Authority**: AntD icon names below resolve to the exported React
components in `@ant-design/icons`. The SVG path data lives in
[`@ant-design/icons-svg`](https://www.npmjs.com/package/@ant-design/icons-svg)
(transitive dep). Versions are pinned via `pnpm-lock.yaml`.

| Nav-item key      | AntD icon          | Rationale                                                                                                                                  | Round added |
| ----------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `data-management` | `DatabaseOutlined` | Represents the underlying DuckDB store; signals "data work, not chrome." Outlined weight matches AntD's default nav-item icon idiom (1em). | R08         |

When a future round adds a nav-item, it adds a row here in the same
round, citing the round id in the last column. The `.preview.html`
freezes the rendered SVG markup for the chosen icon — see
[../README.md §"When to add structure"](../README.md) for the
preview drift caveat.

---

## Behaviour — nav-item states

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Hover: pointer enter
    Hover --> Idle: pointer leave
    Hover --> ActivePending: click
    ActivePending --> Active: route resolves
    Active --> Hover: pointer enter (already active)
    Active --> [*]: route changes away
    note right of Active
        Pill background, raised
        text colour, no underline.
        Only one item Active at
        a time.
    end note
```

### Interaction notes

- **Click** on a nav-item triggers `onSelect(key)` callback exposed
  by `<WorkspaceShell>`. The shell does not navigate itself — the
  consuming app (builder) wires the callback to its router.
- **Keyboard**: Tab moves focus through items; Enter / Space
  activates. Focus ring uses AntD's default outline (no custom
  treatment in R07).
- **Active item is driven by prop**, not internal state. The
  consumer passes `activeKey="data-management"` based on the
  current route. This keeps the shell stateless about routing.
- **Hover affordance**: subtle background tint (`colorFillTertiary`
  or similar) — gentle, not pill-strength. Distinguishable from
  Active.

---

## Component contract — `<WorkspaceShell>` in `@mdd/ui`

Per
[memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md):
**router-agnostic, no BIZ peer deps**. Peer deps stay `react`,
`react-dom`, `antd`, `@ant-design/icons` only.

### Proposed signature

```typescript
type NavItem = {
  key: string;
  label: string;
  icon?: ReactNode;
};

type WorkspaceShellProps = {
  items: NavItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  children: ReactNode;
};

export function WorkspaceShell(props: WorkspaceShellProps): JSX.Element;
```

### Positive usage example (builder)

```tsx
import { WorkspaceShell } from '@mdd/ui';
import { useNavigate, useLocation } from 'react-router-dom';

const items = [{ key: 'data-management', label: 'Data Management', icon: <DatabaseOutlined /> }];

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeKey = pathname.startsWith('/data-management') ? 'data-management' : '';

  return (
    <WorkspaceShell items={items} activeKey={activeKey} onSelect={(key) => navigate(`/${key}`)}>
      {children}
    </WorkspaceShell>
  );
}
```

`react-router-dom` lives in `apps/builder/package.json`. **Never** in
`workspace/packages/ui/package.json`. The drifted iteration leaked
`react-router-dom` into `@mdd/ui` as a peer dep — that was the BIZ
entanglement that motivated the build-first lesson.

### Negative example (rejected)

```tsx
// ❌ Do not do this — couples @mdd/ui to a specific router
import { useNavigate } from 'react-router-dom'; // ← in @mdd/ui!

export function WorkspaceShell({ items }: { items: NavItem[] }) {
  const navigate = useNavigate(); // ← shell decides routing
  // ...
}
```

If `WorkspaceShell` imports anything from `react-router-dom`,
`@tanstack/react-query`, `zod`, or any feature-state library, the
boundary is broken. Reject the change.

---

## Scope boundary — R07

### IN scope

- `<WorkspaceShell>` primitive in `@mdd/ui` per the contract above.
- Builder layout component wiring the shell to `react-router-dom`.
- One route `/data-management` rendering a placeholder page (heading
  with a 3-sentence intent paragraph; no real features).
- Root route `/` redirects to `/data-management` (only nav item, no
  ambiguity).
- This design doc + the `.preview.html` brainstorming aid.

### OUT of scope (deferred to later rounds, each its own pull)

- **Sidebar expand/collapse toggle** — R07 ships compact-only.
- **Top app-bar** (search, language, notifications, user menu) — BIZ
  concerns; defer until each pull is real.
- **Right rail** — single-column content area for R07.
- **Workspace picker / multi-workspace switching** — implicit
  single "default" workspace context only; picker waits for a real
  second workspace.
- **Actual Data Management features** (CSV upload, dataset list,
  schema view, profiling) — each its own round.
- **Brand refresh** to the drifted palette (`#4F45B6` purple etc.)
  — current shell uses R04's AntD-default tokens. Brand refresh is
  a separate, future round with its own design doc.
- **Accessibility audit** — basic keyboard + focus-ring behaviour
  is in scope; full a11y pass (ARIA roles, screen reader, contrast
  audit) is a separate round when pulled.
- **Responsive / mobile** — desktop ≥1280px is the target this
  round. Narrower viewports are deferred.

---

## Open questions for HIxAI review

1. **Sidebar width**: 88px feels right for icon + short label below
   icon. Confirm or propose alternative.
2. **Active-item treatment**: pill background, or left-edge accent
   bar, or both? Sample preview shows pill; left-bar is a common
   alternative.
3. **Where does the app brand mark go** (top-left of sidebar)?
   Confirm "MDD" text mark for now (the preview shows three letters
   stacked); a logo is deferred.
4. **Route base for Data Management** — `/data-management` (clear,
   slug-cased) or `/data` (terse)? Preview uses
   `/data-management` to match the domain folder name. Confirm.
