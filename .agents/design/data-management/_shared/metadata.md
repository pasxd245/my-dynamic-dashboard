# Metadata — read-only notes on any noun, written through the API

**Concept**: a **metadata entry** is one writer's statement about one noun — a dataset, a
column, a relationship, a query, a workflow, a dashboard or a widget — in one **namespace**.
It is markdown text (the same safe subset as a `note` widget) that may open with a YAML
frontmatter block the product does not interpret. The server stamps **who** wrote it
(`author`, `source`), **when** (`writtenAt`) and **what the noun looked like** at that moment
(`definitionVersion`), so a reader can tell an agent's note from a person's and can see when
the subject has changed since ("may be out of date"). The builder **only reads**: there is no
edit affordance anywhere, and a writer changes an entry by writing it again through the API
with its token. Writes are **off** on a fresh install.

**Status**: Accepted — shipped. Seven noun kinds, three routes, token-gated writes, a
read-only `MetadataPanel` mounted on the dataset, query, workflow and dashboard detail pages
and in the relationship check drawer.

**Domain folder**: `data-management/_shared/` — the feature code lives in
`apps/builder/src/features/metadata/` (a top-level feature, beside `dashboard/` and
`data-management/`), because its consumers span the data-management clusters **and** the
dashboard feature. This doc owns the entry model, the wire shape, the token rules and the
panel; each host page owns only where it mounts the panel.

**Sibling docs**: [`../_noun-model.md`](../_noun-model.md) (the nouns an entry attaches to,
and § Versions — the `definitionVersion` hash an entry anchors to),
[datasets/dataset-detail.md](../datasets/dataset-detail.md),
[queries/queries.md](../queries/queries.md), [workflows/workflows.md](../workflows/workflows.md),
[workspaces/relationships.md](../workspaces/relationships.md) (the host surfaces),
[crud-hygiene.md](crud-hygiene.md) (the code-first error envelope this feature reuses).

> **Why read-only in the UI.** An entry is a statement with an author. If the UI could edit
> it, the author stamp would stop meaning anything — a human tweak to an agent's note would
> still read as the agent's. Keeping every write behind a token makes `author` / `source`
> true by construction, and the **AI** badge then tells a reader not to take an agent's note
> as the official definition.

---

## Surfaces — layer / reuse / purity declaration

| Surface                                                                                                            | Layer                                                         | Reusability  | Purity             | Allowed peer deps                             |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------ | ------------------ | --------------------------------------------- |
| `MetadataPanel` (collapsible page-level panel: own entries + children)                                             | `apps/builder/src/features/metadata/MetadataPanel.tsx`        | feature      | feature            | react, antd, @ant-design/icons, react-i18next |
| `MetadataEntryView` / `MetadataEntriesList` (one entry / a namespace-sorted list; exported for the widget popover) | `apps/builder/src/features/metadata/MetadataPanel.tsx`        | feature      | plain-UI (i18n)    | react, antd, @ant-design/icons, react-i18next |
| `splitFrontmatter` (leading `---` block → `key: value` pairs + body)                                               | `apps/builder/src/features/metadata/frontmatter.ts`           | feature      | pure               | none                                          |
| `useMetadataQuery`                                                                                                 | `apps/builder/src/features/metadata/hooks.ts`                 | feature      | glue (server-data) | @tanstack/react-query                         |
| `metadataApi.get` client (read only — no write method)                                                             | `apps/builder/src/api/metadataApi.ts`                         | builder-only | glue               | (fetch — no extra peer dep)                   |
| `MetadataKind` / `MetadataEntry` / `MetadataEntries` / `MetadataRead` types                                        | `apps/builder/src/features/metadata/types.ts`                 | feature      | data type          | none                                          |
| `SafeMarkdown` (reused, owned by the dashboard `note` widget)                                                      | `apps/builder/src/features/dashboard/SafeMarkdown.tsx`        | feature      | plain-UI           | react, antd                                   |
| `WidgetMetadataButton` + `WidgetMetadataPopover` (per-widget info affordance)                                      | `apps/builder/src/features/dashboard/DashboardDetailPage.tsx` | feature      | feature            | react, antd, @ant-design/icons                |
| `GET /metadata/{kind}/{noun_id}` · `PUT` / `DELETE /metadata/{kind}/{noun_id}/{namespace}`                         | `apps/backend/app/routers/metadata.py`                        | backend      | feature            | (FastAPI — backend native)                    |
| `resolve_noun` · `definition_version` · `validate_entry` · `entries_for` · `children_for`                          | `apps/backend/app/metadata.py`                                | backend      | feature            | (stdlib `hashlib` / `json` / `sqlite3`)       |
| `markdown_problems` (safe-subset check, shared with the `note` widget)                                             | `apps/backend/app/markdown_safe.py`                           | backend      | pure               | (stdlib `re`)                                 |
| `MetadataToken` / `backend.metadata_tokens` settings                                                               | `apps/backend/app/_config/settings.py`                        | backend      | data type          | pydantic                                      |
| `MetadataEntry` SQLModel table (`metadata_entries`, Alembic `0005_metadata_entries`)                               | `apps/backend/app/db_models.py`                               | backend      | data type          | sqlmodel                                      |
| `ApiErrorUnauthorized` / `ApiErrorForbidden` / `ApiErrorMetadataInvalid` envelopes                                 | `apps/backend/app/models/common.py`                           | backend      | data type          | pydantic                                      |

**Boundary check**: no row lives in `@mdd/ui`. The panel encodes metadata-specific copy, the
AI badge and the stale flag, so it is feature code; it lives in its own top-level feature
folder because two feature trees (`data-management/*` and `dashboard/`) mount it. It reuses
the dashboard's `SafeMarkdown` renderer rather than carrying a second markdown parser, and
the backend reuses `markdown_problems` — one safe subset for every text users or agents write
into the product.

---

## Token map

All metadata surfaces are AntD primitives (`<Collapse>`, `<Tag>`, `<Typography>`, `<Empty>`,
`<Popover>`, `<Button>`) styled by the `<ConfigProvider>` tokens derived from the seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts) (the source of
truth). **No new token is introduced.** `Value` is informational.

| Surface                                    | AntD token (themeTokens.ts)                       | Value (informational) |
| ------------------------------------------ | ------------------------------------------------- | --------------------- |
| Panel header background                    | `colorFillAlter`                                  | derived               |
| Panel / popover border                     | `colorBorder`                                     | derived               |
| Author · time line, frontmatter keys, hint | `colorTextSecondary`                              | derived               |
| "May be out of date" `<Tag>`               | `colorWarning`                                    | `#faad14`             |
| **AI** badge `<Tag>`                       | AntD preset colour `purple` (palette, not a seed) | preset                |
| Namespace `<Tag>`                          | `colorFillQuaternary`                             | derived               |
| Widget info button (icon)                  | `colorTextSecondary`                              | derived               |
| Border radius (panel, tags, popover)       | `borderRadius`                                    | `6`                   |
| Font family                                | `fontFamily`                                      | system stack          |

The frontmatter key colour is read through AntD's CSS variable for `colorTextSecondary` with
a hard-coded fallback; it introduces no value of its own.

---

## Layout — ASCII intent

### Page-level panel (dataset / query / workflow / dashboard detail; relationship drawer)

Collapsed `<Collapse size="small">`, open by default when anything is written. Renders
**nothing** while loading or when there are no entries — except in the relationship drawer
(`alwaysShow`), where an empty panel shows the empty state.

```text
┌ ▾ Metadata   3 entries · 2 by AI ──────────────────────────────────────────┐
│  [aicowork] [🤖 AI] [⚠ May be out of date]   aicowork · Oct 15, 2026 08:00 │
│    source   export 2026-10-12            ← frontmatter as key/value table  │
│    ## Leads                              ← body via SafeMarkdown           │
│    One row per lead.                                                       │
│                                                                            │
│  won_at                                  ← a child (column name / widget   │
│  [aicowork] [🤖 AI]   aicowork · Oct 15, 2026 08:00     title) group       │
│    Date the deal closed; blank while open.                                 │
│                                                                            │
│  Read-only — written through the API; the author changes it by writing     │
│  again.                                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Header**: "Metadata" + the total count (own + children) + "· N by AI" when any entry is
  `source: ai`.
- **One entry**: namespace `<Tag>`, the **AI** badge (`RobotOutlined`, purple) iff
  `source === 'ai'`, the stale `<Tag>` (`WarningOutlined`, "May be out of date") iff
  `stale`, then `author · writtenAt` (locale date-time). Below: the frontmatter as a
  two-column table (lines that are not `key: value` show with an empty key), then the body.
- **Children**: a dataset's columns and a dashboard's widgets, each under a bold label — the
  column name, or the widget's title via `childLabel` (falls back to the id).
- Entries are sorted by namespace; children by child id.

### Per-widget affordance (dashboard)

A widget whose id has entries gets an `InfoCircleOutlined` text button in its header
(`WidgetMetadataButton`, tooltip "Metadata on this widget", `data-count` = entry count). Click
opens a `<Popover>` (max 420 × 360, scrolls) with the same `MetadataEntriesList`. No button
when the widget has nothing written.

---

## Data model

```sql
CREATE TABLE metadata_entries (
    kind               TEXT NOT NULL
        CHECK (kind IN ('dataset','column','relationship','query','workflow','dashboard','widget')),
    noun_id            TEXT NOT NULL,          -- see the id table below
    namespace          TEXT NOT NULL CHECK (length(namespace) BETWEEN 1 AND 32),
    md                 TEXT NOT NULL,          -- safe-subset markdown, ≤ 64 KiB UTF-8
    source             TEXT NOT NULL CHECK (source IN ('ai','human','system')),
    author             TEXT NOT NULL,
    written_at         TEXT NOT NULL,          -- ISO-8601 UTC
    definition_version TEXT NOT NULL,          -- the noun's version at write time
    PRIMARY KEY (kind, noun_id, namespace)
);
CREATE INDEX idx_metadata_entries_noun ON metadata_entries(kind, noun_id);
```

The schema of record is the SQLModel `MetadataEntry` table
([db_models.py](../../../../workspace/apps/backend/app/db_models.py)), created by Alembic
`0005_metadata_entries`; handlers use raw `sqlite3`. **There is no foreign key**: the seven
kinds live in five tables, so the write path resolves the noun before writing instead.

### Targets — the seven kinds

| `kind`         | `noun_id`               | What `definitionVersion` hashes (the part a note is _about_)                     |
| -------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `dataset`      | `ds_<8hex>`             | the schema: `[{name, dtype}]` of every column (visibility and data do not count) |
| `column`       | `<ds_id>:<column name>` | that column's `{name, dtype}`                                                    |
| `relationship` | `rel_<8hex>`            | its ends + label: left/right dataset id, left/right column, cardinality          |
| `query`        | `qr_<8hex>`             | the stored query definition                                                      |
| `workflow`     | `wf_<8hex>`             | the stored workflow definition                                                   |
| `dashboard`    | `dsh_<8hex>`            | the stored dashboard definition (widgets included — any widget change moves it)  |
| `widget`       | `<dsh_id>:<wdg_id>`     | that widget's own config object                                                  |

A compound id uses a **colon** because no id contains one and it keeps the id a single path
segment (the client URL-encodes it, so a column name with spaces or slashes works). The hash
is the definition version defined in [`_noun-model.md` § Versions](../_noun-model.md#versions--what-each-noun-was-at-a-given-moment):
the first 12 hex of a sha256 over the payload's canonical JSON with `null` members dropped.
**Data refreshes do not move it** — an entry is about a noun's definition, not its rows.

### The entry on the wire

```ts
// features/metadata/types.ts — hand-aligned to contracts/_shared/metadata.yaml
type MetadataKind = 'dataset' | 'column' | 'relationship' | 'query' | 'workflow' | 'dashboard' | 'widget';
type MetadataSource = 'ai' | 'human' | 'system';

type MetadataEntry = {
  md: string; // safe-subset markdown; may open with `---` frontmatter
  source: MetadataSource; // from the writing token — server-stamped
  author: string; // the token's author (1–120 chars) — server-stamped
  writtenAt: string; // ISO-8601 UTC, `Z` — server-stamped
  definitionVersion: string; // 12-hex — the noun's version at write time
  stale: boolean; // computed on every read: definitionVersion ≠ the noun's current version
};
type MetadataEntries = Record<string, MetadataEntry>; // keyed by namespace

type MetadataRead = {
  entries: MetadataEntries;
  children?: Record<string, MetadataEntries>; // dataset → by column NAME; dashboard → by widget id
};
```

### Writers — `backend.metadata_tokens`

Writers are **configuration, not data**: a list in `values.yaml` / `MDD_CONFIG_FILE`, or the
JSON env `MDD_BACKEND__METADATA_TOKENS`. Each `MetadataToken` (`extra="forbid"`) carries:

| Field        | Rule                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| `token`      | the bearer secret, **≥ 16 chars**                                                   |
| `author`     | 1–120 chars — stamped on every entry the token writes                               |
| `source`     | `ai` \| `human` \| `system` (default `human`) — stamped on every entry              |
| `namespaces` | the **closed** list this token may write; `system` is never writable even if listed |

The default is an empty list — **every write is `401`** until an operator adds a token.

---

## Behaviour

### Write (`PUT`) — the gate, in the order the handler applies it

```mermaid
stateDiagram-v2
    [*] --> Auth: PUT /metadata/{kind}/{noun_id}/{namespace} { md }
    Auth --> Unauthorized: no "Bearer" / unknown token → 401 unauthorized
    Auth --> Grant: token known
    Grant --> Forbidden: namespace = system, or not in token.namespaces → 403 forbidden
    Grant --> Validate: granted
    Validate --> Invalid: namespace pattern / empty / > 64 KiB / unsafe markdown → 422 metadata_invalid
    Validate --> Resolve: valid
    Resolve --> NotFound: noun absent (or column / widget not in its parent) → 404 not_found
    Resolve --> Cap: noun found
    Cap --> Invalid: new namespace and noun already has 32 → 422 metadata_invalid (namespace_cap)
    Cap --> Stored: upsert (kind, noun_id, namespace) → 201 entry
```

- The body is **only** `{ md }` (`extra="forbid"`) — a client cannot send an author. The
  server stamps `author` / `source` from the token, `writtenAt` now, and `definitionVersion`
  from the noun as resolved in the same connection.
- **Upsert**: writing an existing namespace replaces it (still `201`); other namespaces on the
  noun are untouched.
- `422 metadata_invalid` carries a `reason` — `namespace` (not `^[a-z][a-z0-9_]{0,31}$`),
  `empty`, `too_large` (over 65 536 UTF-8 bytes), `markdown_unsafe` (with `problems` ⊆
  `html` · `image` · `link_scheme`), `namespace_cap`. Unsafe text is **refused, never
  silently cleaned** — the writer should know.
- An unknown `kind` (not one of the seven) is FastAPI's generic `422 detail[]`.

### Delete

`DELETE /metadata/{kind}/{noun_id}/{namespace}` follows the same token rules (`401` / `403`),
removes exactly that row (`204`), and answers `404 not_found` when there is no such entry. It
does not resolve the noun, so a writer can retract an entry on a noun that no longer exists.

### Read

`GET /metadata/{kind}/{noun_id}` needs no token. It resolves the noun (`404` if absent), returns
every entry keyed by namespace with `stale` computed against the noun's **current** version,
and — for a `dataset` or `dashboard` — every child's entries under `children`, so a detail page
needs one request. A child whose column / widget no longer exists is skipped.

### The panel

- `useMetadataQuery(kind, nounId)` — key `['metadata', kind, nounId]`, enabled only with an id,
  `retry: false`, `staleTime` 30 s. A `404` or an unreachable API reads as "no entries": the
  panel is informative, never blocking, and never shows an error.
- The dashboard page reads `('dashboard', id)` once; the page panel and every widget's info
  button share that cache entry (widgets read `children[widgetId]`).
- There is no write path in the builder (`metadataApi` has only `get`), so nothing
  invalidates the key; a newly written entry appears on the next fetch after `staleTime`.

### Where it is mounted

| Host                                                              | Call                                            | Notes                                                               |
| ----------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| `DatasetDetailPage` (header strip, under the date-coverage strip) | `kind="dataset"`                                | column entries ride as children, labelled by column name            |
| `QueryDetailPage`                                                 | `kind="query"`                                  | hidden while the query is being edited                              |
| `WorkflowDetailPage` (read view, above the summary)               | `kind="workflow"`                               | hidden while editing                                                |
| `DashboardDetailPage` (under the page header)                     | `kind="dashboard"`, `childLabel` = widget title | plus the per-widget info button / popover                           |
| `RelationshipCheckDrawer` (below the check result)                | `kind="relationship"`, `alwaysShow`             | shown only once the check succeeds — a stale edge's drawer has none |

`column` and `widget` are never read directly by the builder; they arrive as children of
their parent.

### Lifecycle of an entry when its noun changes

- **Definition changes** (a query re-saved with a different definition, a column retyped, a
  widget edited, a relationship's ends changed): the entry stays and reads `stale: true` —
  "may be out of date" — until its writer writes it again.
- **Re-saving an unchanged definition** does not flag it: `null` members are dropped before
  hashing, so a definition re-serialized under a newer model with more optional fields hashes
  the same.
- **The noun is deleted**: its entries are **not** removed. They stay in `metadata_entries`,
  unreadable (the read `404`s on the missing noun; a parent read skips the missing child) and
  harmless. A column entry **reappears** if a column of the same name returns to that dataset
  (e.g. after a refresh), flagged stale if its dtype differs.

---

## Data contract

Contracts: [`workspace/packages/contracts/metadata/`](../../../../workspace/packages/contracts/metadata/)
(`get` · `put` · `delete` `.contract.yaml`) + `_shared/metadata.yaml` (the entry / read
schemas) + `_shared/api-error.yaml` (`unauthorized`, `forbidden`, `metadata_invalid`).

| Route                                           | Auth         | Success                          | Errors                                                                                      |
| ----------------------------------------------- | ------------ | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `GET /metadata/{kind}/{noun_id}`                | none         | `200` `{ entries, children? }`   | `404 not_found` (noun absent)                                                               |
| `PUT /metadata/{kind}/{noun_id}/{namespace}`    | Bearer token | `201` the stored `MetadataEntry` | `401 unauthorized` · `403 forbidden` · `422 metadata_invalid` (+`reason`) · `404 not_found` |
| `DELETE /metadata/{kind}/{noun_id}/{namespace}` | Bearer token | `204`                            | `401 unauthorized` · `403 forbidden` · `404 not_found` (no such entry)                      |

Path limits: `noun_id` 1–400 chars, `namespace` 1–64 chars at the path layer (the 32-char
pattern is enforced as `422 metadata_invalid` `reason: namespace`, after the `403` grant check —
token `namespaces` lists are not pattern-validated in settings).

---

## Acceptance criteria (Design gate exit)

**User journey** — as an analyst I open a dataset (or query, workflow, dashboard, or a
relationship's check drawer) and see what people and agents have written about it — who wrote
each note, whether an AI did, and whether the thing has changed since — without being able to
alter anyone's words; as an operator I give an agent a token limited to its own namespaces so
it can write notes the product will attribute to it.

1. **Writes off by default** _(pytest)_ — with no configured token every `PUT` / `DELETE` is
   `401 unauthorized`.
2. **Server-stamped authorship** _(pytest)_ — a stored entry carries the token's `author` /
   `source`, `writtenAt` and the noun's `definitionVersion`; a client-sent author is refused
   by the body schema.
3. **Namespace rules** _(pytest)_ — a namespace outside the token's list, or `system`, is
   `403`; a granted namespace that breaks the pattern is `422 reason: namespace` (the grant is
   checked first, so an ungranted malformed name is `403`).
4. **Entry validation** _(pytest)_ — empty, over 64 KiB, and unsafe markdown (HTML, images,
   non-http(s) links) are `422 metadata_invalid` with the matching `reason` / `problems`;
   nothing is stored.
5. **Namespace isolation** _(pytest)_ — writing or deleting one namespace leaves the noun's
   other namespaces untouched.
6. **All seven kinds resolve; children ride with the parent** _(pytest)_ — each kind accepts
   its id format; a dataset read returns column entries and a dashboard read widget entries
   under `children`.
7. **Stale on definition change, not on re-save** _(pytest)_ — changing the noun's definition
   flips `stale` to `true`; re-saving an unchanged definition keeps it `false`.
8. **Namespace cap** _(pytest)_ — a new namespace beyond the per-noun cap is `422 reason:
namespace_cap`.
9. **Read-only panel** _(FE)_ — `MetadataPanel` shows namespace, AI badge for `source: ai`,
   the stale tag, author · time, frontmatter as a key/value table and the safe-markdown body;
   it offers no control that edits; it renders nothing when empty or failing (unless
   `alwaysShow`).
10. **Mounted where the nouns live** _(FE)_ — dataset, query, workflow, dashboard detail and
    the relationship check drawer; a dashboard widget with entries shows the info button and
    popover.

---

## Scope boundary

### IN scope

- Entries on seven noun kinds, keyed by namespace; three routes; token-configured writers
  with closed namespace lists; server-stamped authorship and definition version; the 64 KiB
  and per-noun namespace caps; the shared safe-markdown rule.
- The read-only `MetadataPanel`, the widget info popover, and their five mounts.

### OUT of scope (deferred with named triggers)

- **Editing in the UI** — out by design (authorship must stay true). _Trigger: none planned;
  a writer re-writes through the API._
- **Removing a deleted noun's entries** — not done today (see § Lifecycle). _Trigger: orphan
  rows become a measurable size or privacy concern, or a re-created column name surfaces a
  misleading old note._
- **Anchoring an entry to a data version / workflow run or to view parameters** — an entry
  anchors only to the definition today. _Trigger: a writer needs to say "true of the data as
  of version N"._
- **Read authorization / workspace scoping of reads** — reads are open to anyone who can call
  the API, like the nouns themselves.
- **Column- or widget-level panels outside their parent** — children are shown only inside
  the parent's panel.
- **Interpreting frontmatter** — the product shows `key: value` lines as a table and nothing
  more; nested YAML stays text.

---

## Reference materials (read-only)

- [`_noun-model.md` § Versions](../_noun-model.md#versions--what-each-noun-was-at-a-given-moment)
  — the definition version an entry anchors to, shared with workflow run stamps.
- [dataset-detail.md](../datasets/dataset-detail.md),
  [workflows.md](../workflows/workflows.md), [relationships.md](../workspaces/relationships.md)
  — host pages.
- `apps/backend/tests/test_metadata.py` — the behaviour the acceptance criteria map to.
