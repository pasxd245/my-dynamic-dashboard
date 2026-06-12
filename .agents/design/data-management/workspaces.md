# Workspaces — feature design

**Concept**: a Workspace is a logical container for related data
(CSV imports, schemas, saved queries, dashboards). The Workspaces
page at `/data-management/workspaces` lists all workspaces the user
has created as a card grid; R13 ships read-only + create-stub.
**Status**: Accepted (R11 design; shipped R13; extended R23).
**Round introduced**: [Round_11](../../plan/cycles/Round_11.md);
implemented in R13 per the
[shell target's named-pulls table](workspace-shell.target.md).
**Sibling docs**:
[workspace-shell.target.md](workspace-shell.target.md) (the chrome
this feature lives inside),
[crud-hygiene.md](crud-hygiene.md) (rename + delete affordances on
the Workspace card — R23 closes the R∞-deferred CRUD gap below)
and [workspace-shell.preview.html](_archive/workspace-shell.preview.html)
(visual preview that renders this feature as content).

---

## Surfaces — layer / reuse / purity declaration

| Surface                                       | Layer                                                           | Reusability         | Purity             | Allowed peer deps                         |
| --------------------------------------------- | --------------------------------------------------------------- | ------------------- | ------------------ | ----------------------------------------- |
| `WorkspaceCard` component                     | `@mdd/ui`                                                       | shared cross-domain | plain-UI           | react, react-dom, antd, @ant-design/icons |
| `WorkspaceCardGrid` (or AntD `<Row>`/`<Col>`) | `apps/builder/src/features/data-management/workspaces`          | feature             | feature            | react, antd                               |
| `WorkspacesPage` route component              | `apps/builder/src/features/data-management/workspaces`          | feature             | feature            | react, antd, @tanstack/react-query        |
| `useWorkspacesQuery` hook                     | `apps/builder/src/features/data-management/workspaces`          | feature             | glue (server-data) | @tanstack/react-query                     |
| `workspacesApi` client                        | `apps/builder/src/api/`                                         | builder-only        | glue               | (fetch — no extra peer dep)               |
| `GET /workspaces` backend route               | `apps/backend/`                                                 | backend             | feature            | (FastAPI — backend native)                |
| `Workspace` type                              | `apps/builder/src/features/data-management/workspaces/types.ts` | feature             | data type          | none                                      |

**Boundary check**: only `WorkspaceCard` lives in `@mdd/ui` —
strict plain-UI primitive with no domain knowledge of "workspace."
It takes generic props (title, subtitle, footer slots) and is
**not** named or shaped after the domain. All BIZ logic (data
shape, fetching, navigation) lives in the builder feature folder.

Per
[memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md):
the UI primitive is generic; the feature folder is BIZ.

> **Open question for HIxAI**: should `WorkspaceCard` be a generic
> `ListCard` primitive instead (since "workspace" is BIZ-domain
> language)? **Lean: yes, name it generically once it has a name.**
> Pending the HIxAI Q&A; R13 commits the name.

---

## Layout — ASCII intent

The page renders inside the master-layout chrome
([workspace-shell.target.md](workspace-shell.target.md)) — sidebar
shows "Data Management" expanded with "Workspaces" sub-item
active; PageHeader shows breadcrumb + title + Create action;
PageCard wraps the card grid.

### Populated state (≥1 workspace)

```text
                                                  ┌── PageHeader.actions ──┐
Home ▸ Data Management ▸ Workspaces                              [+ Create] │
Workspaces                                                                  │
Manage logical containers for your data and reports.            ────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                 │
│  ────────────────────────────────────────────────────────────────────── │
│                                                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐              │
│  │ ▣  Marketing   │  │ ▣  Sales Ops   │  │ ▣  Finance     │   ...        │
│  │                │  │                │  │                │              │
│  │ Created        │  │ Created        │  │ Created        │              │
│  │ 2026-05-21     │  │ 2026-05-18     │  │ 2026-05-10     │              │
│  └────────────────┘  └────────────────┘  └────────────────┘              │
│                                                                           │
│  ┌────────────────┐  ┌────────────────┐                                  │
│  │ ▣  R&D         │  │ ▣  Customer    │                                  │
│  │                │  │    Success     │                                  │
│  │ Created        │  │ Created        │                                  │
│  │ 2026-04-30     │  │ 2026-04-22     │                                  │
│  └────────────────┘  └────────────────┘                                  │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

Cards: AntD `<Card>` with hoverable + clickable; click navigates to
`/data-management/workspaces/<id>` (route stub in R13; the
workspace detail page is a future round). Grid: AntD `<Row>` +
`<Col>` responsive (3 cols at ≥1280px, 2 at ≥768px, 1 at smaller).

### Empty state (zero workspaces)

```text
Home ▸ Data Management ▸ Workspaces
Workspaces
Manage logical containers for your data and reports.

┌──────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                 │
│                                                                           │
│                                                                           │
│                                   ▣                                       │
│                       (Empty illustration / icon)                         │
│                                                                           │
│                   No workspaces yet                                       │
│                   Create your first workspace to get started.             │
│                                                                           │
│                       ┌─────────────────────────┐                         │
│                       │  + Create your first    │                         │
│                       │      workspace          │                         │
│                       └─────────────────────────┘                         │
│                                                                           │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

Uses AntD `<Empty>` primitive with a primary `<Button>` action
centred below. CTA copy: "Create your first workspace."

---

## Token map

The Workspaces page is composed entirely of AntD primitives
(`<Card>`, `<Row>`/`<Col>`, `<Empty>`, `<Modal>`, `<Button>`) styled by
the AntD `<ConfigProvider>` tokens derived from the six seeds in
[`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts)
(the source of truth — R66). No new token is introduced; values are
informational (resolved via `theme.getDesignToken()`, antd 6.x).

| Surface                              | AntD token             | Value (informational) |
| ------------------------------------ | ---------------------- | --------------------- |
| Page background                      | `colorBgLayout`        | `#f5f5f5`             |
| Page card background                 | `colorBgBase`          | derived               |
| Card border / divider                | `colorBorderSecondary` | `#f0f0f0`             |
| Card hover background                | `colorPrimaryBg`       | `#e6f4ff`             |
| Card title text                      | `colorText`            | derived               |
| "Created …" subtitle text            | `colorTextSecondary`   | derived               |
| Empty-state caption text             | `colorTextTertiary`    | derived               |
| Create / primary action button       | `colorPrimary`         | `#1677ff`             |
| Border radius (cards, modal, button) | `borderRadius`         | `6`                   |
| Font family                          | `fontFamily`           | system stack          |

No new token is introduced. Identifier parity against the live AntD
registry is enforced by
[`design-token-parity.mjs`](../../../scripts/design-token-parity.mjs).

---

## Acceptance criteria (Design gate exit)

Testable criteria the R13 implementation satisfies, each mapping to at
least one automated test. Numbered `C1`–`C6` for suite reference. These
describe the **shipped** read + create-stub scope; rename / delete are
[crud-hygiene.md](crud-hygiene.md)'s criteria, not restated here.

**User journey** — as a user I open Workspaces to see every container I
have created and to create a new one, so I can organise my datasets.

1. **List** _(FE component)_ — the populated state renders one
   `WorkspaceCard` per workspace returned by `useWorkspacesQuery()`,
   each showing the name and the created date.
2. **Empty state** _(FE component)_ — zero workspaces renders the AntD
   `<Empty>` with the "No workspaces yet" message and a primary
   "Create your first workspace" button.
3. **Create** _(FE + BE)_ — the PageHeader `[+ Create]` action and the
   empty-state CTA both open a modal with a single name `<Input>`;
   submitting calls `POST /workspaces`, invalidates `['workspaces']`,
   and the new card appears without a manual reload.
4. **Navigation** _(FE)_ — clicking a card navigates to the
   workspace-filtered datasets view
   (`/data-management/datasets?workspace=<id>`). _Flag: the R13 layout
   note above still reads "navigates to `/workspaces/<id>` (route stub)";
   that line is superseded by [datasets.md](datasets.md)'s R14 Q11
   decision (no detail route — cards link to the filtered list, shipped
   R17). Documented, not silently rewritten._
5. **Grid responsiveness** _(FE)_ — the card grid renders 3 columns at
   ≥1280px, 2 at ≥768px, and 1 below, via AntD `<Row>`/`<Col>`.
6. **Backend list** _(pytest / integration)_ — `GET /workspaces`
   returns the workspace list; each `Workspace` carries
   `{ id matching ^ws_[0-9a-f]{8}$, name (1–80 chars), createdAt
   (ISO-8601 UTC) }`.

---

## Workspace data model

R13 ships:

```ts
type Workspace = {
  id: string; // `ws_<8 lowercase hex>` — backend-generated (pattern ^ws_[0-9a-f]{8}$; see workspace.yaml)
  name: string; // user-supplied, required, 1-80 chars
  createdAt: string; // ISO-8601 UTC timestamp from backend
};
```

**Decision rationale** (HIxAI Q1, locked R11): minimal but
date-aware. `name` is the only field the user must enter;
`createdAt` enables sorting ("most recently created first") without
a re-arch. Three fields total — small schema delta if R14+ adds
`description`, `ownerId`, etc.

**Deferred fields**: `description`, `ownerId`, `updatedAt`,
`metadata`. Each lands when a UI surface needs it (per "Default =
don't add"). Not pre-baked.

---

## Read/write boundary (R13 scope)

R13 ships **read + create-stub**:

- **Read**: list all workspaces (`GET /workspaces`) — full scope.
- **Create-stub**: a "Create your first workspace" button (empty
  state) and a `[+ Create]` action in PageHeader (populated state).
  Click opens an AntD `<Modal>` with a single `<Input>` for name +
  `Cancel` / `Create` buttons. On submit, `POST /workspaces` (also
  backend stub — appends to in-memory array, returns the created
  workspace). The UI invalidates the workspaces query, the new
  card appears.

**Deferred to R14+**:

- Workspace detail page (`/data-management/workspaces/<id>`)
- Edit name / rename
- Delete (with confirmation)
- Real persistence (R13's in-memory array dies on backend restart;
  R14+ adds DuckDB or other persistence)
- Validation beyond "non-empty name"
- Sorting / filtering UI controls (always-sorted-desc-by-createdAt
  in R13; UI controls land when a user has 20+ workspaces)
- Multi-user concerns (`ownerId`, sharing, permissions)

---

## State management — TanStack Query in R13

R13 introduces **TanStack Query** (`@tanstack/react-query`) for
server data. Distillation entry N's trigger condition fires:
"first feature reading server data."

- `useWorkspacesQuery()` — `useQuery({ queryKey: ['workspaces'], queryFn: workspacesApi.list })`
- `useCreateWorkspaceMutation()` — `useMutation({ mutationFn: workspacesApi.create, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces'] }) })`

**Setup in R13** (one-time, lands with this feature):

- `QueryClientProvider` wired in `main.tsx`, above `BrowserRouter`.
- Default query options: `staleTime: 60_000` (1 min), no automatic
  refetch on window focus (avoid surprise for our small dataset).
- DevTools optional — defer until a real debugging need.

**R12 does not introduce Query**. R12 is chrome-only. Query lands
when its first consumer (this feature) lands.

---

## Backend endpoint shape

R13 ships **real backend endpoints**, hardcoded stubs (in-memory
array):

```python
# apps/backend/app/routers/workspaces.py
@router.get("/workspaces")
def list_workspaces() -> list[Workspace]:
    return _WORKSPACES  # module-level list

@router.post("/workspaces", status_code=201)
def create_workspace(body: CreateWorkspace) -> Workspace:
    ws = Workspace(id=f"ws_{secrets.token_hex(4)}", name=body.name, createdAt=now_utc())
    _WORKSPACES.append(ws)
    return ws
```

- Routes mount under the existing FastAPI app (next to `/health`
  from R02).
- In-memory storage (`_WORKSPACES = []`) — **dies on backend
  restart**. R14+ swaps in real persistence (DuckDB? SQLite?
  decision deferred until R14 round opens).
- `Workspace` Pydantic model mirrors the TypeScript type.
- CORS already configured (R02); no new infra.

**Decision rationale** (HIxAI Q3, locked R11): real endpoint stub
exercises the end-to-end product surface (FastAPI → fetch →
TanStack Query → React render) — first time we test that the
UI/BIZ boundary holds under real HTTP. In-memory storage means
the round stays small (no migration / DB / persistence concerns);
just enough realism to validate the integration.

---

## Sub-menu and navigation

R12 ships grouped NAV_GROUPS (per the target doc); R13 wires the
specific group structure:

```ts
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'data-management',
    label: 'Data Management',
    icon: <DatabaseOutlined />,
    defaultExpanded: true, // expanded by default so Workspaces is visible
    items: [
      { key: 'workspaces', label: 'Workspaces', route: '/data-management/workspaces' },
      // future: { key: 'datasets', label: 'Datasets', route: ... },
      // future: { key: 'schemas', label: 'Schemas', route: ... },
    ],
  },
];
```

Active state: when route is `/data-management/workspaces`, the
parent "Data Management" group is highlighted as the active section
AND the "Workspaces" child is highlighted as the active page.

Redirect: `/` redirects to `/data-management/workspaces` (R07's
redirect updates from `/data-management` to the deeper sub-route).
`/data-management` (no sub-segment) also redirects to
`/data-management/workspaces` until other sub-items exist.

---

## Lifecycle

This doc:

- **Amended in place** during R13 if implementation surfaces a
  decision not pre-baked here (e.g., the precise `WorkspaceCard`
  prop API).
- **Superseded** (with a redirect stub) when the data model grows
  beyond 3-fields and warrants `workspaces-v2.md` — likely R14+ if
  `description` or `ownerId` enters.
- **Folded back** into a `data-management/` overview doc if a
  parallel `datasets.md` or `schemas.md` design arrives and the
  three together cohere as one cross-feature design.

R13's Act section confirms which lifecycle event applies.

---

## Out of scope (deferred with named triggers)

- **Workspace detail page** (`/data-management/workspaces/<id>`).
  Trigger: when a user-action inside a workspace needs a URL (CSV
  upload, query saving). R14+.
- **Edit / delete / rename**. Trigger: user friction with
  mis-named workspaces, or compliance requirement. R14+.
- **Real persistence** (DuckDB / SQLite). Trigger: in-memory state
  dies during R13's own dev-loop and that becomes annoying. Most
  likely R14.
- **Workspace sharing / multi-user**. Trigger: real second user.
  Far off; current product is single-user.
- **Search / filter / sort controls**. Trigger: user has 20+
  workspaces. Unlikely R14.
- **Workspace templates / starter data**. Trigger: onboarding
  research surfaces a need. R∞.
- **Brand palette refresh, top-bar BIZ contents** — still deferred
  from R07/R10.

---

## Open questions answered in R11

| Q                      | Decision                                               | Source                                       |
| ---------------------- | ------------------------------------------------------ | -------------------------------------------- |
| Workspace data model   | `{ id, name, createdAt }`                              | R11 HIxAI Q1 (lean accepted)                 |
| TanStack Query in R13? | Yes — enters with this feature                         | R11 HIxAI Q2 (lean accepted)                 |
| Backend stub vs real   | Real endpoint stub, in-memory array body               | R11 HIxAI Q3 (lean accepted)                 |
| Sub-menu UX            | Drifted's inline expand-collapse                       | R11 HIxAI Q4 (lean accepted)                 |
| Empty state            | Centred AntD `<Empty>` + primary action button         | R11 HIxAI Q5 (lean accepted)                 |
| `WorkspaceCard` naming | Open — lean: generic `ListCard` primitive in `@mdd/ui` | R11 follow-up; R13 commits during Plan-phase |
