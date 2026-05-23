# Workspace Shell — TARGET shape (destination, not current state)

> ⚠️ **TARGET-NOT-CURRENT.** This doc sketches the destination the
> shell evolves toward across R11–R14+. It is **not** the canonical
> design contract — that role belongs to
> [workspace-shell.md](./workspace-shell.md). When the destination
> matches reality, fold relevant material back into the canonical doc
> and delete this file. Until then, every surface below is aspirational.

**Concept**: full workspace-shell system at the level the drifted
iteration eventually landed on (post-R35), stripped of BIZ leaks.
**Status**: Target horizon (created R10).
**Round introduced**: [Round_10](../../plan/cycles/Round_10.md).
**Origin**: dialectical negation of drifted shell — see
[.agents/memory/2026-05-23-drifted-shell-distillation.md](../../memory/2026-05-23-drifted-shell-distillation.md)
for the verdict-tagged pull-list this target draws from.

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

## Component contracts (target signatures — not yet implemented)

### `WorkspaceShell` (existing, future shape)

```ts
type WorkspaceShellProps =
  | (WorkspaceShellBaseProps & { items: NavItem[]; groups?: never })
  | (WorkspaceShellBaseProps & { items?: never; groups: NavGroup[] });

type WorkspaceShellBaseProps = {
  activeKey: string;
  onSelect: (key: string) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  header?: ReactNode; // top bar slot
  title?: ReactNode; // shortcut for header when no custom slot
  brand?: ReactNode; // brand mark override
  buildVersion?: string; // sidebar footer
  children: ReactNode;
};
```

- Discriminated union (`items` XOR `groups`) lets the same shell
  render flat or grouped navigation without two components. Source:
  distillation C.
- `header` / `title` precedence collision is caught at compile time
  by the union, not by runtime warnings (distillation T —
  REJECT runtime collision warnings).
- Existing R07–R09 props (`activeKey`, `onSelect`, `collapsed`,
  `onToggleCollapse`) survive unchanged. New props are additive.

### `PageCard` (future — R11 candidate)

```ts
type PageCardProps = {
  children: ReactNode;
  variant?: 'default' | 'flush';
};
```

- Every route renders its content inside one. `variant="flush"`
  drops padding + clips overflow for pages drawing to the card edge
  (e.g., a future guided-upload two-pane surface).
- No router awareness; no data fetching. Pure look-and-feel.

### `PageHeader` (future — R12 candidate)

```ts
type PageHeaderProps = {
  breadcrumb: BreadcrumbItem[]; // data, not router-coupled
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode; // right-aligned action buttons
};
```

- Consumes a `BreadcrumbItem[]` shape that the **builder** computes
  from `useLocation()` via a `routeMeta` resolver. The primitive
  itself never imports `react-router-dom`.

---

## Named pulls (R11–R14+ sketch)

Suggestive priority. Final order is set by each round's Plan-phase
Q&A. Pulls cite the distillation memo entry they implement.

| Pull                                              | Distillation entry | Round candidate | Notes                                                                                        |
| ------------------------------------------------- | ------------------ | --------------- | -------------------------------------------------------------------------------------------- |
| First real Data Management feature OR `PageCard`  | D                  | R11             | If a real feature pulls first, `PageCard` rides along as its host. Both ship in one round.   |
| `PageHeader` + first builder `routeMeta` resolver | E                  | R12             | Pairs with the first PageCard consumer; the breadcrumb data has a real source.               |
| Sizing tier lock (32/40/48) + motion tokens       | F + H              | R13             | Token-layer round; updates `themeTokens.ts` and design docs. Tiny, can bundle if both small. |
| 8px spacing grid + `.stack-N` helpers             | G                  | R13 or R14      | Couples naturally with F; ship together or split.                                            |
| Paired Fold/Unfold hamburger icons                | I                  | R14 polish      | R09 lean'd against; this is the deferred polish round.                                       |
| `NAV_GROUPS` data shape (flat → grouped)          | J                  | R14+            | Trigger: second feature domain arrives. Also triggers build-first promotion to `context/`.   |
| AntD-wrapper testing pattern → `context/`         | K                  | R12+            | Third instance of the lesson triggers promotion. Not a feature round — a promotion round.    |

R11's first task is to pick from this table (or override with a
real product pull not on it). The point is **not** to lock the
order — it's to make the menu visible.

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
sweep — same lifecycle discipline as the `.preview.html` files.
