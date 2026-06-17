# Workspaces — feature design

**Concept**: a **Workspace** is the top-level container that scopes a user's data —
every [Dataset](../datasets/datasets.md), [Query](../queries/queries.md), and
[Relationship](relationships.md) belongs to exactly one workspace (FK, `ON DELETE
CASCADE`). The Workspaces page at `/data-management/workspaces` lists them as a card grid
and is the home for workspace **CRUD** (create, rename, delete) and the entry point to a
workspace's **Relationships**.

**Status**: Accepted — shipped. Full CRUD + SQLModel/Alembic persistence are live;
workspace `name` is globally unique.

**Domain folder**: `data-management/workspaces/` — sibling of [relationships.md](relationships.md)
(the governed join-edges scoped to a workspace). The rename/delete **modal mechanics** are the
shared [crud-hygiene.md](../_shared/crud-hygiene.md) surfaces; this doc owns the workspace noun,
its page, and its CRUD wire shape. Renders inside the
[workspace-shell](../../_platform/workspace-shell.target.md) chrome.

---

## Surfaces — layer / reuse / purity declaration

| Surface | Layer | Reusability | Purity | Allowed peer deps |
| --- | --- | --- | --- | --- |
| `WorkspacesPage` (card grid; loading/error/empty states) | `apps/builder/src/features/data-management/workspaces` | feature | feature | react, antd, @tanstack/react-query |
| `WorkspaceCard` (initial badge, name, created date, overflow `<Dropdown>`) | `apps/builder/src/features/data-management/workspaces` | feature | feature | react, antd, @ant-design/icons |
| `CreateWorkspaceModal` (inline; single name `<Input>`, inline `409`) | `apps/builder/src/features/data-management/workspaces` | feature | feature | react, antd |
| `RenameModal` / `DeleteConfirmModal` / `BlockedDeleteModal` (reused, owned by [crud-hygiene.md](../_shared/crud-hygiene.md)) | `apps/builder/src/features/data-management/_shared` | feature | feature | react, antd |
| `useWorkspacesQuery` / `useCreateWorkspaceMutation` / `useRenameWorkspaceMutation` / `useDeleteWorkspaceMutation` | `…/workspaces` | feature | glue (server-data) | @tanstack/react-query |
| `workspacesApi` client | `apps/builder/src/api` | builder-only | glue | (fetch) |
| `GET/POST/PATCH/DELETE /workspaces` routes | `apps/backend/app/routers/workspaces.py` | backend | feature | (FastAPI — backend native) |
| `Workspace` SQLModel table (`db_models.py`) + Pydantic wire model (`models/common.py`) | `apps/backend/app` | backend | data type | sqlmodel, pydantic |
| `Workspace` type | `…/workspaces/types.ts` | feature | data type | none |

**Boundary check**: `WorkspaceCard` is **feature-local**, not a `@mdd/ui` primitive — it
encodes workspace-specific copy and the Relationships/Rename/Delete menu. The rename/delete
modals live in `data-management/_shared/` (shared across workspaces + datasets per
[crud-hygiene.md](../_shared/crud-hygiene.md)), not in `@mdd/ui`. All BIZ (data shape,
fetching, navigation) is in the feature folder.

---

## The model

```ts
// features/data-management/workspaces/types.ts
type Workspace = {
  id: string;        // ws_<8 hex> — backend-minted, pattern ^ws_[0-9a-f]{8}$
  name: string;      // user-supplied, 1–80 chars, UNIQUE GLOBALLY (not per-anything)
  createdAt: string; // ISO-8601 UTC ("…Z")
};
```

- **Persistence**: SQLModel table `workspaces` (`db_models.py`), columns `id` (PK, TEXT),
  `name` (TEXT), `created_at` (TEXT), all `NOT NULL`; `CHECK (length(name) BETWEEN 1 AND 80)`;
  unique index `idx_workspaces_name_unique` on `(name)` — **uniqueness is global**, unlike
  datasets/queries which are unique per-workspace. Schema is under Alembic (`0001_baseline`).
- **Handlers use raw `sqlite3`** (hand-written SQL via `db.get_conn()`); SQLModel is the
  DDL/migration schema-of-record, not used in request handlers. The Pydantic wire model
  (`models/common.Workspace`, `extra="forbid"`) is the camelCase response shape (`createdAt`).
- IDs are `ws_{secrets.token_hex(4)}`; `name` max is the cross-language `NAME_LENGTHS.workspace_max`
  (80). Deferred fields (`description`, `ownerId`, `updatedAt`) land when a surface needs them.

---

## Data contract

| Method / Path | Body | Success | Errors (`code`) |
| --- | --- | --- | --- |
| `GET /workspaces` | — | `200` → `Workspace[]` (`created_at DESC, id DESC`) | — |
| `POST /workspaces` | `{ name }` (`extra="forbid"`, 1–80) | `201` → `Workspace` | `409 name_taken`; `422` |
| `PATCH /workspaces/{id}` | `{ name }` (`extra="forbid"`, 1–80) | `200` → `Workspace` | `404 not_found`; `409 name_taken`; `422` |
| `DELETE /workspaces/{id}` | — | `204` | `404 not_found`; `409 non_empty` + `datasetCount` |

- `{id}` matches `^ws_[0-9a-f]{8}$`. Error bodies are the code-first `{ "code": … }` envelope
  (`non_empty` adds an integer `datasetCount`), per [crud-hygiene.md](../_shared/crud-hygiene.md).
- **Delete is block-not-cascade** (for the workspace→datasets relation): the route pre-counts
  `datasets WHERE workspace_id = ?` and returns `409 non_empty` (with `datasetCount`) if any
  exist. The DB-level `ON DELETE CASCADE` on `datasets`/`queries`/`relationships` FKs is a
  belt-and-braces backstop, not the user-facing behaviour — the user must empty a workspace first.

---

## Layout — ASCII intent

The page renders inside the master-layout chrome
([workspace-shell.target.md](../../_platform/workspace-shell.target.md)) with "Data Management ▸
Workspaces" active; `PageHeader` carries the breadcrumb + title + `[+ Create]`; `PageCard` wraps
a responsive `<Row>`/`<Col>` grid (3 cols ≥1280px, 2 ≥768px, 1 below).

### Populated state

```text
Home ▸ Data Management ▸ Workspaces                              [+ Create]
Workspaces
Manage logical containers for your data and reports.

┌──────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                  │
│  ┌────────────────  ⋮ ┐  ┌────────────────  ⋮ ┐  ┌────────────────  ⋮ ┐    │
│  │ ▣  Marketing     │ │  ▣  Sales Ops     │ │  ▣  Finance      │           │
│  │ Created 2026-05-21│  │ Created 2026-05-18│  │ Created 2026-05-10│        │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
└──────────────────────────────────────────────────────────────────────────┘
```

- Each `WorkspaceCard` shows an initial badge, the name, `createdAt.slice(0,10)`, and a `⋮`
  (`<MoreOutlined />`) overflow `<Dropdown>` with **Relationships** / **Rename** /
  **Delete** (danger). Card click → `/data-management/datasets?workspace=<id>` (the
  workspace-filtered datasets view — there is **no** workspace detail page); the Relationships
  item → `/data-management/workspaces/<id>/relationships`.

### Empty state

```text
┌──────────────────────────────────────────────────────────────────────────┐
│  PageCard                                                                  │
│                                   ▣                                        │
│                        No workspaces yet                                   │
│              Create your first workspace to get started.                   │
│                       [ + Create your first workspace ]                    │
└──────────────────────────────────────────────────────────────────────────┘
```

AntD `<Empty>` with a centred primary `<Button>` ("Create your first workspace").

---

## Behaviour — states

- **List**: `useWorkspacesQuery()` (key `['workspaces']`) → loading skeleton / error `<Alert>` /
  `<Empty>` / card grid.
- **Create**: `[+ Create]` (or the empty-state CTA) opens `CreateWorkspaceModal` (single name
  `<Input>`); submit `POST`s, invalidates `['workspaces']`; `409 name_taken` → inline field error.
- **Rename**: the overflow menu opens the shared `RenameModal`; `useRenameWorkspaceMutation` →
  `PATCH`, invalidates **both** `['workspaces']` and `['datasets']` (the workspace name shows on
  the datasets table). `409 name_taken` → inline error.
- **Delete**: the overflow menu confirms via `DeleteConfirmModal`. The FE does a **client
  pre-flight** against cached `['datasets']` (any `d.workspaceId === ws.id`) and opens
  `BlockedDeleteModal` locally if non-empty — but the **backend `409 non_empty` is
  authoritative** (a race swaps confirm→blocked on `onError`, reading `err.body.datasetCount`).
  Success invalidates `['workspaces']` + `['datasets']`.

---

## Token map

The page is AntD primitives (`<Card>`, `<Row>`/`<Col>`, `<Empty>`, `<Modal>`, `<Dropdown>`,
`<Button>`) styled by the `<ConfigProvider>` tokens derived from the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts) (the source of truth).
**No new token is introduced**; `Value` is informational (`theme.getDesignToken()`, antd 6.x).
Identifier parity is enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

| Surface | AntD token | Value (informational) |
| --- | --- | --- |
| Page background | `colorBgLayout` | `#f5f5f5` |
| Page card background | `colorBgBase` | derived |
| Card border / divider | `colorBorderSecondary` | `#f0f0f0` |
| Card hover background | `colorPrimaryBg` | `#e6f4ff` |
| Card title text | `colorText` | derived |
| "Created …" subtitle text | `colorTextSecondary` | derived |
| Empty-state caption text | `colorTextTertiary` | derived |
| Overflow `⋮` / Delete (danger) menu item | `colorTextTertiary` / `colorError` | derived / `#ff4d4f` |
| Create / primary action button | `colorPrimary` | `#1677ff` |
| Border radius (cards, modal, button) | `borderRadius` | `6` |
| Font family | `fontFamily` | system stack |

---

## Acceptance criteria

A user opens Workspaces to see every container they have created, creates / renames / deletes
one, and is protected from deleting a workspace that still holds data.

1. **List** — the populated state renders one `WorkspaceCard` per workspace from
   `useWorkspacesQuery()` (name + created date), sorted most-recent-first.
2. **Empty state** — zero workspaces renders `<Empty>` with the CTA button.
3. **Create** — `[+ Create]` / the CTA open a name modal; submit `POST /workspaces`, invalidates
   `['workspaces']`, the new card appears; a duplicate name → `409 name_taken` inline.
4. **Rename** — the overflow `Rename` patches `{ name }`; success invalidates `['workspaces']` +
   `['datasets']`; duplicate → `409 name_taken` inline.
5. **Delete (empty)** — `DELETE` returns `204`; the card disappears; `['workspaces']` +
   `['datasets']` invalidate.
6. **Delete (non-empty) blocked** — `DELETE` returns `409 non_empty` with `datasetCount`; the FE
   shows `BlockedDeleteModal` (reached by pre-flight or by the authoritative `409`).
7. **Navigation** — a card click opens `/data-management/datasets?workspace=<id>`; the
   Relationships menu opens `/data-management/workspaces/<id>/relationships`.
8. **Backend list shape** — `GET /workspaces` returns `{ id ~ ^ws_[0-9a-f]{8}$, name 1–80,
   createdAt ISO-UTC }`; `name` is globally unique.

---

## Scope boundary

**IN**: the Workspaces card-grid page (list / empty / loading / error); workspace CRUD
(create + rename + delete via the shared modals) with the global-name-unique constraint and the
block-not-cascade delete (`409 non_empty` + `datasetCount`); the Relationships entry point;
SQLModel/Alembic persistence.

**OUT (named triggers)**:

- **A workspace detail page** (`/data-management/workspaces/<id>`) — *not built*; cards link to
  the filtered datasets view instead. _Trigger_: a per-workspace action needs its own URL.
- **`description` / `ownerId` / `updatedAt`** on the model — _Trigger_: a surface needs the field.
- **Sharing / multi-user / permissions** — _Trigger_: a real second user (currently single-user).
- **Search / filter / sort controls** on the grid — _Trigger_: a user with 20+ workspaces.
- **Cascade-on-delete for the user** (delete a workspace *and* its datasets in one action) —
  _Trigger_: friction with the block-first flow; see [crud-hygiene.md](../_shared/crud-hygiene.md).

**Explicitly does NOT cover**: the rename/delete **modal mechanics** + the 409-branching contract
([crud-hygiene.md](../_shared/crud-hygiene.md)); the governed join-edge model
([relationships.md](relationships.md)); the datasets a workspace scopes
([datasets.md](../datasets/datasets.md)).
