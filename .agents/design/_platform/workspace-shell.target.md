# Workspace Shell — TARGET shape (destination, not current state)

> ⚠️ **TARGET-NOT-CURRENT.** This doc sketches the destination the
> shell evolves toward across R11–R14+. It is **not** the canonical
> design contract — that role belongs to
> [workspace-shell.md](./workspace-shell.md). When the destination
> matches reality, fold relevant material back into the canonical doc
> and delete this file. Until then, every surface below is aspirational.

**Concept**: full workspace-shell system at the level the drifted
iteration eventually landed on (post-R35), stripped of BIZ leaks.
**Status**: Target horizon (created R10, hardened R11).
**Rounds touched**: [Round_10](../../plan/cycles/Round_10.md) (created
with sketched contracts) → [Round_11](../../plan/cycles/Round_11.md)
(prop signatures hardened, sub-menu shape decided, paired Fold/Unfold
direction fixed). R12 implements against this hardened target as
"master-layout chrome system" (one cohesive feature).
**Origin**: dialectical negation of drifted shell — see
[shell distillation memo](../../memory/2026-05-23-drifted-shell-distillation.md)
for the verdict-tagged pull-list this target draws from. Drifted
governance hub:
[context/drifted-iteration.md](../../context/drifted-iteration.md).

---

## Why a target doc exists for this concept

Three rounds (R07/R08/R09) walked toward an undeclared horizon. Each
landed a single decision (stub, icon, collapse) without a system-level
target visible. The drifted iteration shows the cost of this exact
pattern: R33 hand-rolled a sidebar that R35 retired — two rounds
wasted because no destination was sketched first.

This file is the horizon. Future rounds (R11+) pull one named entry
from the "Named pulls" section below as their scope. The point is
**not** to commit to this exact shape — it's to make the shape
_visible_ so each round knows whether it's walking toward or away
from it.

---

## Surfaces — layer / reuse / purity declaration

Per the canonical-doc template established R10. Surfaces marked
**(future)** do not exist yet; the row records the intended layer
and purity so future rounds can implement against the schema.

| Surface                          | Layer               | Reusability         | Purity                 | Allowed peer deps                         |
| -------------------------------- | ------------------- | ------------------- | ---------------------- | ----------------------------------------- |
| `WorkspaceShell` (exists)        | `@mdd/ui`           | shared cross-domain | plain-UI               | react, react-dom, antd, @ant-design/icons |
| `PageCard` (future)              | `@mdd/ui`           | shared cross-domain | plain-UI               | react, react-dom, antd                    |
| `PageHeader` (future)            | `@mdd/ui`           | shared cross-domain | plain-UI (data-shaped) | react, react-dom, antd                    |
| `WorkflowShell` (deferred)       | `@mdd/ui`           | shared cross-domain | plain-UI               | react, react-dom, antd                    |
| `NAV_GROUPS` data (future shape) | `apps/builder/src/` | builder-only        | data constant          | none                                      |
| `routeMeta` resolver (future)    | `apps/builder/src/` | builder-only        | glue (router-aware)    | react-router-dom                          |
| `AppLayout` host (exists)        | `apps/builder/src/` | builder-only        | glue (router-aware)    | react, react-router-dom                   |

**Boundary rule restated**: nothing in the `@mdd/ui` rows above may
import `react-router-dom`, `@tanstack/react-query`, `zod`, or any
domain-specific library. Per
[memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md).

---

## Layout — ASCII target (full system)

Dimensions approximate; the React implementation uses flex/grid to
fluidly fill the viewport. Numbers in parentheses are target widths
in pixels at desktop ≥1280px.

```text
┌─────────┬────────────────────────────────────────────────────────────────┐
│  ☰      │  Data Management                       [search] [user] [bell]  │  ← AppShell header slot (56-64px)
│         │ ────────────────────────────────────────────────────────────── │
│  ▣      │  Home ▸ Data Management ▸ Datasets                              │  ← PageHeader.breadcrumb
│  Data   │  Datasets                                                       │  ← PageHeader.title
│         │  Manage imported sources, schemas, profiles.                    │  ← PageHeader.subtitle
│  ▦      │                                                                  │
│  Misc   │  ┌──────────────────────────────────────────────────────────┐  │
│         │  │  PageCard                                                │  │
│         │  │  ─────────────────────────────────────────────────────── │  │
│         │  │                                                          │  │
│         │  │  .page-section: Source                                   │  │
│         │  │  …                                                       │  │
│         │  │                                                          │  │
│         │  │  .page-section: Schema                                   │  │
│         │  │  …                                                       │  │
│         │  │                                                          │  │
│         │  └──────────────────────────────────────────────────────────┘  │
│         │                                                                  │
└─────────┴────────────────────────────────────────────────────────────────┘
  88px           top bar (header slot) + content region with PageCard
  sidebar
  (existing)
```

**Rule of one shell**: exactly one `<WorkspaceShell>` per app, hosted
by `AppLayout`. No second sidebar/header/chrome anywhere in the route
tree.

**Rule of one card**: exactly one `<PageCard>` per route. Stacked
regions inside use `.page-section` siblings, not nested cards.

Both rules cited from distillation entry B. Failure mode if violated:
the drifted iteration's R33 hand-rolled sidebar lived alongside the
real one for two rounds before R35 retired it — visible
fragmentation in the running app.

---

## Component contracts (hardened in R11 — R12 implements these)

### Nav data shapes (builder-owned)

```ts
// One flat or one grouped item — both shapes live in apps/builder/src/
type NavItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  route: string;
};

type NavGroup = {
  key: string;
  label: ReactNode;
  icon: ReactNode;
  items: NavItem[];
  defaultExpanded?: boolean; // controls initial expand state
};
```

Behaviour: clicking a `NavGroup` header toggles expand/collapse
inline (no navigation). Clicking a child `NavItem` navigates via
the builder's `onSelect`. Parents do not navigate in R12 —
deferred (per "Default = don't add"); if a future round needs
parent-routes, add an optional `route?: string` then.

### `WorkspaceShell` (existing in `@mdd/ui`; R12 evolves it)

```ts
type WorkspaceShellProps =
  | (WorkspaceShellBaseProps & { items: NavItem[]; groups?: never })
  | (WorkspaceShellBaseProps & { items?: never; groups: NavGroup[] });

type WorkspaceShellBaseProps = {
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  header?: ReactNode; // top-bar centre/right slot (R12: empty placeholder)
  title?: ReactNode; // shortcut for header when no custom slot
  brand?: ReactNode; // sidebar brand mark override
  buildVersion?: string; // sidebar footer
  children: ReactNode;
};
```

- **Discriminated union (`items` XOR `groups`)** — same shell renders
  flat OR grouped nav. R12 ships with `groups` because Data
  Management now has a Workspaces sub-item.
- **`header` / `title` precedence** is enforced at compile time by
  the union, not runtime warnings (distillation T — REJECT runtime
  collision warnings).
- **R07–R09 props survive unchanged**; new props are additive.

### `PageCard` (new in R12, `@mdd/ui`)

```ts
type PageCardProps = {
  children: ReactNode;
  variant?: 'default' | 'flush';
};
```

- **R12 ships `default` only.** Renders a white-surface card with
  card-radius, soft shadow, comfortable padding. `flush` is declared
  in the signature but **defers until a real consumer asks for it**
  (per "Default = don't add" / drifted's `variant="flush"` had no
  consumer at extraction time).
- No router awareness; no data fetching; no BIZ libs.
- Every route renders inside one (Rule of one card).

### `PageHeader` (new in R12, `@mdd/ui`)

```ts
type BreadcrumbItem = {
  label: ReactNode;
  route?: string; // omit for current page (non-clickable)
};

type PageHeaderProps = {
  breadcrumb: BreadcrumbItem[];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode; // right-aligned action buttons
};
```

- Consumes a `BreadcrumbItem[]` shape that the **builder** computes
  via a `routeMeta` resolver (also new in R12, builder-side, owns
  `useLocation`). The primitive itself never imports
  `react-router-dom`.
- Renders above PageCard, inside the content region of
  WorkspaceShell.

### Top-bar slots (`header` prop of WorkspaceShell)

R12 ships a placeholder header slot — left section holds the
collapse toggle (Fold/Unfold icon); right section is `header` /
`title` content from the builder. **BIZ contents** (search box,
user menu, notification bell) are slot-shaped but unfilled — each
fills in a future round as a real product pull arrives. Per the
permanent R07/R10 deferral.

### Collapsed-sidebar behaviour (flyout-on-hover, AntD-native)

When `<WorkspaceShell collapsed>` is true (sidebar = 64px wide),
follow the **AntD-native flyout pattern** — pair `<Menu
inlineCollapsed>` with `<SubMenu>`. Research-confirmed convention;
matches Linear / Slack / VS Code / Material Design rail behaviour:

- **Brand mark stays visible** as the icon-only badge (the "MDD"
  text label hides).
- **Parent group header** renders as icon-only in the rail. Sub-items
  are **not** stacked beneath it in the rail. Hover (or `:focus-within`
  for keyboard) opens a **flyout panel to the right** containing the
  sub-items with full labels and an uppercase group-name header
  strip. AntD's `Menu` provides this out of the box.
- **Flat top-level items** (no sub-menu) render as icon-only in the
  rail with native `title` tooltip on hover. No flyout; the item is
  itself the navigation target.
- **Sub-items inside the flyout** render full-width with their icon
  and label. Active-state highlight survives.
- **`buildVersion` footer** centres and hides the "build" label,
  keeping just the version number.

**Why flyout instead of flat-icon-stack** (R11 research): stacking
parent + child icons in the rail is confusing — two icons per section
with no relationship cue. The flyout preserves grouping semantics,
scales cleanly to 5+ groups, and is AntD's documented behaviour for
`inlineCollapsed=true`. R12 gets it free by using `<Menu mode="inline"
inlineCollapsed={collapsed}>` rather than rolling custom CSS.

### Fold/Unfold direction (paired hamburger)

R09 lean'd against paired icons; R11 reverses that for the master
layout because affordance gain is real once the sidebar carries
grouped sub-menus. **Direction convention**:

- `MenuFoldOutlined` (arrow pointing inward) renders when **sidebar
  is expanded** — meaning "click me to fold it away."
- `MenuUnfoldOutlined` (arrow pointing outward) renders when
  **sidebar is collapsed** — meaning "click me to unfold."

Matches AntD's own paired-icon convention.

---

## Named pulls (chain set in R11)

R11's design phase set the chain. R10's earlier suggestive sketch
is superseded by this concrete plan.

| Pull                                                                                                                                                                  | Distillation entries                      | Round | Status                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| **Master-layout chrome system** — `PageCard` + `PageHeader` + `NAV_GROUPS` (groups variant) + paired Fold/Unfold + top-bar header slot + builder `routeMeta` resolver | D + E + I + J                             | R12   | Designed in R11 (this doc). Triggers build-first promotion to `context/` (2nd shell consumer + 3rd `@mdd/ui` primitive). |
| **Workspaces feature** — `/data-management/workspaces` sub-route, card grid, Workspace data model, TanStack Query first use, `GET /workspaces` backend stub           | (entry N: DEFER → ADOPT-VIA-ROUND in R13) | R13   | Designed in R11 ([workspaces.md](../data-management/workspaces/workspaces.md)).                                                                        |
| 8px spacing grid + `.stack-N` helpers + sizing tier lock (32/40/48) + motion tokens                                                                                   | F + G + H                                 | R14+  | Token-layer round. Defer until a visible need (likely first feature that introduces inconsistent spacing).               |
| AntD-wrapper testing pattern → `context/`                                                                                                                             | K                                         | R12+  | Auto-promotion trigger: 3rd instance of the AntD-wrapper testing lesson. Not a feature round.                            |
| `WorkflowShell` specialised PageCard                                                                                                                                  | M (DEFER)                                 | R∞    | Trigger: first `/workflow/*` route lands. Far off.                                                                       |

R12 implements against the hardened contracts above; R13
implements against `workspaces.md`. Further pulls revisit this
table when their triggers fire.

---

## Out of scope for the target horizon

Surfaces deliberately _not_ sketched here, with their distillation
verdicts:

- **Brand palette refresh** (distillation L) — DEFER. Stakeholder
  decision, not an agent-method one. The target uses R04 AntD-default
  tokens; a future brand round re-skins without restructuring.
- **`WorkflowShell` specialised PageCard** (distillation M) — DEFER.
  Trigger: first `/workflow/*` route in product. The row appears in
  the surface table to record the intended layer/purity if/when
  pulled.
- **TanStack Query / Table** (distillation N) — DEFER. Trigger: first
  feature reading server data with pagination, sorting, or caching.
  Likely couples with R11's first real DM feature, not with the shell.
- **Tailwind + CSS layer order** (distillation O) — DEFER. We have no
  Tailwind today. If introduced, layer-order discipline is adopted
  in the same round to avoid the drifted R35-iteration-11 defect.
- **Dark mode + density + zero-runtime** (distillation P) — DEFER.
  No current product pull.

---

## Lifecycle — when this doc retires

Per the README amendment shipped in R10, target docs are **strictly
for the destination**, never amended to track current state. The
canonical [workspace-shell.md](./workspace-shell.md) is amended in
place as rounds land; this file stays fixed (or is superseded with a
redirect stub) so future-self can see the original horizon.

**Retirement trigger**: when the last ADOPT-VIA-ROUND entry in the
distillation memo has landed (or been re-cut as DEFER/REJECT), this
file folds relevant material into `workspace-shell.md` and the
file is deleted in the same round.

**Retirement is an explicit per-round decision**, not an automatic
sweep.
