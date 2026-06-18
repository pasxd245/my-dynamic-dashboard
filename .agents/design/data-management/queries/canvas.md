# Query Canvas — the free-form visual source-graph editor (a view/edit mode of the builder)

**Concept**: the **canvas** is a **visual presentation + editing mode** of the
[Query](queries.md) builder: it renders a Query's
[`definition.joins`](queries.md#joins-reading-related-datasets-as-one) **tree** as a **node-link graph** — each
table-source (the driving [`sourceId`](queries.md) + every joined dataset) is a
**node**, each governed [`JoinStep`](queries.md#joins-reading-related-datasets-as-one) is an **edge** — and lets a user
read and (later) **edit** that same tree by direct manipulation (drag nodes, draw an
edge to add a hop, delete a leaf edge to remove one). It is **not a new noun and not a
new page**: it edits the **identical** `definition.joins` tree the hop-list
[construction surface](query-construction.md) already edits, keyed on R79's unified
`sourceId`, runs the **same** stateless preview, and saves through the **same**
lifecycle. The canvas is a **second editor over one model**, not a second model.

**Status**: **Accepted** (design) — **Phase A SHIPPED at
[R85](../../../plan/cycles/Round_85.md) (read-only view, human-signed-off 2026-06-18:
`QueryCanvas` + the `[List]/[Canvas]` toggle in `QueryBuilderPanel`); Phases B/C still
deferred (→ R86/R87).** R80 sealed the design and banked the
build (the deferral trigger — "until the hop-list stops scaling" — was UNFIRED at R80's
2–4-node trees, J-2 below). **R85 fires the build of Phase A on the human's product
call** — _"canvas is the #1 end-user-value feature"_ — the **accelerate** side of the
[dynamic equilibrium](../../../context/purpose.md#dynamic-equilibrium): the human pull,
not a hop-list-scaling pain signal, is the authority that opens the build (deliberately
overriding the agent-side "unfired" verdict). Phase A is built **right, not MVP-rushed**
([[dont-mvp-rush-a-roadmap-home-surface]]) — a genuine node-link render. **Phases B
(editing) and C ("New query") remain deferred** with their own triggers (Scope boundary).

> **R85 Design-gate build decision (Phase A).** Render mechanism: **hand-rolled SVG/DOM**
> (AntD-styled nodes positioned by a small deterministic tree-layout fn; SVG edges with
> text labels) — **not** a graph library. This matches the surfaces table's declared
> `react, antd` peer deps (**no deviation**), adds zero bundle weight, and keeps full
> control over the token styling + text-label accessibility model; the bounded-small tree
> (2–4 nodes) makes a generic graph engine overkill. If Phase B (R86) drag-editing proves
> it needs a lib, that is R86's deviation to flag against R86's evidence. `flow-selector`
> at R85's Design gate scored **0/5 → F-only DCFBI** (read-only, FE-only, no new
> interaction), confirming J-3.
>
> **What this doc specifies, by phase.** **Phase A** (the read-only view) is being built
> at R85 against this spec — its surfaces/states/accessibility below are the contract F
> confirms. **Phases B (editing) and C ("New query")** specify the canvas **as it will be
> built when their triggers fire** (Scope boundary); none of B/C is scaffolded today —
> treat those parts as the **inheritance** the later build rounds read. Each build round
> **re-confirms** the verdicts against the then-current builder before it starts (R85 did
> so at its Design gate — see the build-decision note above).

**Round introduced**: [Round_80](../../../plan/cycles/Round_80.md) — the **canvas
theme-opener**, a Design-only round. It fills the
[queries.md trajectory](queries.md#the-trajectory-what-queries-grows-into) step long reserved as the
"free-form visual join canvas", deferred since R74 (J-1′) under the named trigger
**"until the hop-list stops scaling"**.
**Domain folder**: `data-management/queries/` — a **mode** sibling of
[query-construction.md](query-construction.md) (the hop-list builder this re-presents),
[queries.md § Joins](queries.md#joins-reading-related-datasets-as-one) (the `joins` tree this visualizes), and
[queries.md](queries.md) (the create lifecycle the "New query" entry reuses)
under the [queries.md](queries.md) anchor; **not** a parallel page.
**Sibling docs**:
[queries.md](queries.md) (the domain anchor whose trajectory step this
fills; the [reuse invariant](queries.md#the-reuse-invariant-the-one-rule-this-domain-holds)
this obeys),
[query-construction.md](query-construction.md) (the editable builder —
`useQueryBuilder` + `QueryBuilderPanel` — this adds a canvas view/edit mode to; the
create lifecycle the "New query" entry generalizes),
[queries.md § Joins](queries.md#joins-reading-related-datasets-as-one) (the `definition.joins: JoinStep[]` connected acyclic
**tree** the canvas reads/writes — nodes = sources, edges = hops; the `add a hop from
any source` / `remove any leaf` affordances the canvas re-presents),
[queries.md](queries.md) (the base `QueryDefinition`, the catalog the "New
query" entry lives on, and the "Save filters as Query" / "Build on this query" create
verbs the empty-canvas entry sits beside),
[queries.md § Joins](queries.md#joins-reading-related-datasets-as-one) (the per-hop `409 relationship_stale` gate the canvas renders on an
edge),
[relationships.md](../workspaces/relationships.md) (the governed edges each canvas edge
consumes — one `rel_` per hop),
[dataset-detail.md](../datasets/dataset-detail.md) (owns `<PagedRowsView>`, reused for
the canvas's result + preview body),
[workspace-shell.target.md](../../_platform/workspace-shell.target.md) (the chrome all
surfaces render inside).

> **Why a mode, not a noun (the noun-vs-mode check — J-1).** A canvas introduces **no
> new readable-table-source kind, no new engine, and no new model**. It renders and
> edits the **same** `definition.joins` tree [queries.md § Joins](queries.md#joins-reading-related-datasets-as-one) sealed
> (each hop already names its own `leftDatasetId`/`rightDatasetId` — a tree, not a
> path), keyed on the **same** unified `sourceId` R79 landed, and previews/saves through
> the **same** `useQueryBuilder` lifecycle and stateless `POST …/preview`. So it
> **adds a view/edit mode** to the existing builder rather than minting a `/canvas`
> page or a `JoinGraph` / `Canvas` noun (the discarded-R69 trap, the
> [reuse invariant](queries.md#the-reuse-invariant-the-one-rule-this-domain-holds)).
> What is genuinely new is **only the visual rendering + direct-manipulation UX** over
> that tree, named honestly below — never laundered as a new capability.
> _Track: 1 (product feature — design). Pulled by ← R74 J-1′ canvas deferral +
> [queries.md](queries.md) trajectory + R79's unified `sourceId` +
> [purpose.md](../../../context/purpose.md) critical path / key decision #4._

---

## Verdict record — the five judgment calls (Design gate)

The crux of R80 is **not** new model design (the model is twice-validated, R73/R74,
and unified at R79); it is **two governance calls** — _is this a mode or a noun?_ and
_has the trigger fired?_ — plus their three consequences. Each verdict is recorded
here as the design's load-bearing decision, traced against the **real shipped model**,
not a green suite ([specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md)).

### J-1 — Noun or mode? → **MODE** (a view/editor of the existing tree)

A canvas **node** is a table-source already named by the definition (`sourceId` for the
driving node; each `JoinStep`'s `rightDatasetId` for a joined node); a canvas **edge**
is a `JoinStep` already in `joins[]`. Drawing an edge is the **same** operation the
hop-list's `[+ Add a join]` performs (`addJoin(leftSource, rel_)`); deleting a leaf edge
is the **same** `removeJoin(rel_)`; the connected-acyclic invariant is **unchanged**.
The canvas therefore **mints nothing** — no new source kind, no new engine, no new
route, no new noun. It is the **same builder in a different projection**. A "canvas
page" that re-implemented the hop list, the predicate editors, or the run engine would
re-commit the discarded-R69 parallel-pages sin; the reuse invariant forbids it.
**Verdict: a view/edit MODE of `useQueryBuilder` / `QueryBuilderPanel`, parallel to the
hop-list over one working copy — not a noun, not a page.**

### J-2 — Has the trigger fired? → **NO. Defer the build; bank the design.**

The deferral trigger ([queries.md § Joins / Scope](queries.md#joins-reading-related-datasets-as-one)) is: _"the hop-list +
left-source `<Select>` stops scaling — a topology a human can no longer read as a
list."_ Evidence at R80:

| Signal | Reading at R80 |
| --- | --- |
| Real tree sizes today | The product reads CRM exports (Deals, Accounts, Owners, Contacts). The motivating reports are **2–4-node** stars/paths (`Deals ⋈ Accounts ⋈ Owners`; `Deals ⋈ Accounts` **and** `Deals ⋈ Owners`). A 2–4-row hop list is **trivially readable**. |
| Hop-list scaling pain | **None reported.** R73→R74 shipped the hop list + the left-source `<Select>` + leaf removal; no round, memory, or user signal records a tree too large to read as a list. |
| Acyclic-tree ceiling | The model is a **spanning tree** (no diamonds/self-joins). The branching factor a human must track is bounded by the workspace's declared `rel_` set, still small. |
| What a canvas would buy **now** | Spatial layout + drag editing — **desirable, not yet necessary**. The hop list already expresses every tree the model permits. |

**Verdict: the trigger is UNFIRED.** Building the visual editor now optimizes a surface
no current report strains. Per the **dynamic-equilibrium brake** and
**[[dont-mvp-rush-a-roadmap-home-surface]]**, the honest call is **defer the build,
bank the design**: a Design-only round is cheap and fully revertible, and this doc
gives R81+ a resolved home/flow the moment a real tree outgrows the list. The build
round **re-checks this trigger first** — if trees are still small, it defers again.

### J-3 — Model impact? → **NONE. Purely an FE editing surface; F-only build.**

The canvas reads/writes `definition.joins: JoinStep[]` (R74's tree) keyed on `sourceId`
(R79) — **no field added, no route added, no error code added, no engine touched.** A
node maps to a source already in the resolver; an edge maps to a `JoinStep` already
validated by `disconnected_join` / `cyclic_join`; preview runs the **same** stateless
`POST …/queries/preview`; the per-hop `409 relationship_stale` gate renders on the edge
it already names. The canvas is **discovered from the existing model**, not imposed on
it. **Verdict: a frontend-only surface.** When the build is pulled it is an **F-only
DCFBI** round (no contract/BE re-open) — confirm the canvas into the FE-on-MSW source of
truth; `flow-selector` runs at that build round's Design gate, not here.

### J-4 — Standalone "New query" entry → **reuse the Queries-catalog IA + R77's create lifecycle.**

Today's create entries are **source-rooted**: "Save filters as Query" (from a dataset,
[dataset-detail.md](../datasets/dataset-detail.md)) and "Build on this query" (from a
saved Query, [queries.md](queries.md)). The canvas implies the **missing
no-source start**: an empty graph onto which you place the first node. Its home is a
**`[+ New query]` action on the Queries catalog** (`/data-management/queries`) that
opens the builder in **create mode with no preset base** — the empty-source case R77
**explicitly deferred to ship with the canvas, built right**
([[dont-mvp-rush-a-roadmap-home-surface]]). It **reuses R77's create lifecycle**
(`/queries/new`, no `?base=`): no id, name-capture at Save via the reused
`SaveQueryModal`, `POST` carrying `{ name, sourceId, definition }`. The
canvas is the natural editor for that empty start (place a node = pick the driving
`sourceId`; draw an edge = add a hop). **Verdict: not a parallel surface — a catalog
entry into the same create lifecycle, with the canvas as its editor (noun-vs-mode brake
again).**

### J-5 — First-build scope (when build proceeds) → **a phased, thin-but-not-rushed slice.**

The design names the build's phasing so R81+ inherits a clear first cut that respects
both YAGNI and "don't MVP-rush a roadmap-home surface":

| Phase | Scope | Why this is the honest seam |
| --- | --- | --- |
| **A — read-only canvas VIEW** | Render the existing tree as nodes + labelled edges, as a **toggle beside the hop list** in the builder. **Zero** editing, zero model change — pure visualization of what `joins[]` already holds. | The thinnest slice that delivers the canvas's first real value (read a tree spatially) and proves the rendering before any editing risk. The list stays the editor. |
| **B — interactive editing** | Direct manipulation at **parity** with the hop list: draw an edge (`addJoin` from any in-graph source to a not-yet-joined dataset), delete a leaf edge (`removeJoin`), pick the `rel_` on the new edge. Reuses the same validation + preview. | Only pulled once Phase A proves the view **and** a real tree is large enough that drag editing beats the list. Adds no model surface. |
| **C — standalone "New query"** | The empty-canvas create entry (J-4): `[+ New query]` → builder in create mode, no preset base, place the first node on an empty graph. | The genuinely new IA entry; lands last because it depends on B's place-a-node interaction. |

**Verdict: Phase A (the read-only view) is the thin-but-not-rushed first build slice.**
It is doing the view *right* (a real graph render, not a sketch) without rushing the
editor; B and C are their own pulls, each its own round.

**Discovered-vs-imposed:** _discovered._ The canvas is pulled by a real, named trigger
(R74 J-1′, written before R80) and by the unified `sourceId` R79 landed **specifically
so the canvas reads one source, not two**. Nothing is minted to justify the surface;
R80 **declines to build** until a real tree outgrows the list, and banks the design in
the meantime.

---

## The model — unchanged; the canvas renders + edits it

The canvas introduces **no change** to `QueryDefinition` (the tree was sealed in
[queries.md § Joins](queries.md#joins-reading-related-datasets-as-one); the source field unified to `sourceId` in R79). It is a
**read-write projection** of the same object:

```ts
// unchanged — the canvas renders this as a graph and edits it via the same ops
type JoinStep = {
  relationshipId: string; // `rel_…` — the governed edge this EDGE consumes
  type: JoinType; // shipped: 'inner' | 'left' | 'right' | 'full' (types.ts)
};

type QueryDefinition = {
  q?: string | null;
  filters: FilterAtom[];
  advanced: FilterAtom[][];
  joins: JoinStep[]; // R74 tree: each hop names its own left/right → a graph already
};
// the driving node is the Query's unified `sourceId` (R79: ds_ | qr_); each
// joins[k].rel.rightDatasetId is a further node. The canvas reads exactly these.
```

- **Nodes** = the sources the resolver already walks: the driving `sourceId` plus each
  hop's right dataset. **Edges** = the `JoinStep`s in `joins[]`, each labelled with its
  key pair (`account_id ↔ id`) and advisory `cardinality`.
- **Editing maps 1:1 onto the hop-list ops** ([queries.md § Joins](queries.md#joins-reading-related-datasets-as-one)): draw an
  edge = `addJoin` (left ∈ graph, right ∉ graph — the connected-acyclic invariant,
  enforced unchanged); delete a leaf edge = `removeJoin` (a hop whose right is no other
  hop's left). The canvas **cannot express** anything the hop list can't — same tree,
  same guards.
- **Layout (node x/y positions) is view-only.** A graph layout is computed (or stored as
  FE-only view state); it is **never** added to the persisted `definition`, which stays
  the topological `joins[]` order. _(Whether positions persist as cosmetic FE state is a
  build-round detail, [[design-altitude-vs-build-home]]; the model does not carry them.)_

---

## What is genuinely new vs. reused (the honest split)

The canvas adds a **visual projection + direct-manipulation UX** over a sealed model +
shipped engines. Naming the split up front keeps the build from re-inventing anything:

| Reused verbatim (the true half) | Genuinely NEW (the visual UX only) |
| --- | --- |
| The `QueryDefinition.joins` tree + the unified `sourceId` resolver — **rendered + edited, not extended** | A **node-link rendering** of the tree (nodes = sources, edges = hops) as a builder mode |
| `useQueryBuilder`'s `addJoin` / `removeJoin` / working-copy / dirty-Save lifecycle | **Direct-manipulation bindings** (draw-edge → `addJoin`; delete-leaf → `removeJoin`) onto those same ops |
| The connected-acyclic invariant (`disconnected_join` / `cyclic_join`) + the per-hop `409 relationship_stale` gate | The same guards/states **rendered on a node/edge** instead of a list row |
| The stateless `POST …/queries/preview`, `query_joined_rows`, `<PagedRowsView>` | (nothing new — the canvas previews through the identical path) |
| R77's create lifecycle (`SaveQueryModal`, `useCreateQueryMutation`, `/queries/new`) | The **empty-canvas "New query"** entry on the catalog (the no-base create case) + place-first-node |

**No new model. No new engine. No new route. No new noun.** The genuinely new work is
the **graph render + drag/draw editing** + the **catalog "New query" entry** — every
model, validation, preview, and persistence concern is reuse.

---

## Surfaces — layer / reuse / purity declaration

> Specifies the canvas **as it will be built (R81+)**; nothing here is scaffolded at
> R80. Phase A = the read-only view; Phase B = editing; Phase C = the "New query" entry.

| Surface | Layer | Reusability | Purity | Allowed peer deps |
| --- | --- | --- | --- | --- |
| `QueryCanvas` (NEW: node-link render of the `joins` tree; Phase A) | `apps/builder/src/features/data-management/queries` | feature | feature | react, antd |
| `QueryBuilderPanel` (extended: a canvas/list view toggle over one working copy) | `apps/builder/src/features/data-management/queries` | feature | feature | react, antd |
| `useQueryBuilder` (reused: the canvas binds to its `addJoin`/`removeJoin`/Save) | `apps/builder/src/features/data-management/queries` | feature | glue | @tanstack/react-query, antd |
| `CanvasEditing` (NEW: draw-edge / delete-leaf direct manipulation; Phase B) | `apps/builder/src/features/data-management/queries` | feature | feature | react, antd |
| `<PagedRowsView>` (reused, not owned — preview + result body) | `apps/builder/src/features/data-management/_shared` | shared cross-domain | plain-ui | react, antd, react-i18next |
| `SaveQueryModal` (reused, not owned — R69; "New query" name capture; Phase C) | `apps/builder/src/features/data-management/queries` | feature | feature | react, antd |
| `useCreateQueryMutation` (reused, not owned — R69; the "New query" `POST`) | `apps/builder/src/features/data-management/queries` | feature | glue | @tanstack/react-query |
| `JoinStep[]` tree (frontend + contract type) | `.../features/data-management/queries/types.ts` | feature | data type | none |

**Boundary check**: the only shared-cross-domain row (`<PagedRowsView>`) is **reused,
not owned** ([dataset-detail.md](../datasets/dataset-detail.md)). `QueryCanvas` /
`CanvasEditing` **bind to** `useQueryBuilder`'s shipped `addJoin`/`removeJoin`/Save and
the stateless preview — they re-implement **no** validation, engine, predicate editor,
or detail page. The "New query" entry **reuses** R77's `SaveQueryModal` +
`useCreateQueryMutation`. No canvas surface re-implements a dataset/query page, a join
engine, or the hop-list's edit logic; the canvas and the list are **two views of one
working copy**.

---

## Token map

The canvas surfaces are AntD primitives (`<Button>`, `<Tag>`, `<Select>`, `<Alert>`,
`<Tooltip>`, `<Table>` via `<PagedRowsView>`) plus SVG/DOM node-link rendering, styled
by the `<ConfigProvider>` tokens derived from the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts) (the source of
truth — R66). **No new token is introduced**; the map reuses the identifiers already
cited by [queries.md § Joins](queries.md#joins-reading-related-datasets-as-one) and [query-construction.md](query-construction.md).
`Value` is informational.

| Surface | AntD token (themeTokens.ts) | Value (informational) |
| --- | --- | --- |
| Canvas background | `colorBgLayout` | `#f5f5f5` |
| Node card background | `colorBgBase` | derived |
| Driving-node / primary edge (`[+ New query]`, draw-edge) accent | `colorPrimary` | `#1677ff` |
| Edge label / cardinality `<Tag>` text | `colorTextSecondary` | derived |
| Node / edge border | `colorBorderSecondary` | `#f0f0f0` |
| Stale-edge `⚠` warning (hop unavailable) | `colorWarning` | `#faad14` |
| Invalid / unrunnable-graph `<Alert>` | `colorError` | `#ff4d4f` |
| Border radius (node card, table, tag, button) | `borderRadius` | `6` |
| Font family | `fontFamily` | system stack |

Identifier parity is enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

---

## Layout — ASCII intent

The canvas is a **view of the builder**, inside the **same** detail shell
(`PageHeader` + `PageCard`) the hop-list builder uses. A **`[List] [Canvas]` view
toggle** in the Build section swaps the hop list for the node-link graph **over the
same working copy** — edits in either view are the same `addJoin`/`removeJoin`. The
preview + result stay the shared `<PagedRowsView>` below.

### Phase A — read-only canvas view (toggle beside the hop list)

```text
Deals × Accounts × Owners                                         [Cancel] [Save]

  ▾ Build              view:  [ List ] ( Canvas )      ← toggle; same working copy
  ┌─ Canvas ────────────────────────────────────────────────────────────────────┐
  │                          ┌───────────┐                                       │
  │        ┌──────────┐      │  Accounts │      ┌────────┐                        │
  │        │  Deals ◆ │──────┤           ├──────│ Owners │                        │
  │        └──────────┘ account_id↔id    └──┬───┘ owner_id↔id                     │
  │           (driving)     many:many        │       many:one                     │
  │                                          └── (edges labelled: key pair + card.)│
  └──────────────────────────────────────────────────────────────────────────────┘
  Deals.stage = won  ×    Owners.region = APAC  ×            ← active-filter chips
  ▾ Preview · 1,204 rows  ⟳   [ Preview ]
  ┌────────────────────────────────────────────────────────────────────────┐
  │  <the shared <PagedRowsView> — combined columns across all nodes>        │
  └────────────────────────────────────────────────────────────────────────┘
```

`◆` marks the **driving node** (`sourceId`). Edges carry **text** labels (the key
pair + cardinality `<Tag>`), not colour/glyph alone. Phase A is **read-only**: the list
remains the editor.

### Phase B — interactive editing (drag/draw, at hop-list parity)

```text
  ┌─ Canvas (editing) ──────────────────────────────────────────────────────────┐
  │   ┌──────────┐                ┌───────────┐                                  │
  │   │  Deals ◆ │════════════════│  Accounts │   ⊕ drag from a node to a        │
  │   └──────────┘  account_id↔id └───────────┘     not-yet-joined dataset →     │
  │                                                  pick the rel_ → adds a hop   │
  │   [ + Add a source ]   (disabled w/ tooltip when no eligible edge remains)    │
  └──────────────────────────────────────────────────────────────────────────────┘
```

Draw an edge from an in-graph node to a new dataset → choose the governed `rel_` →
`addJoin` (same connected-acyclic guard). A **leaf** edge shows a `[×]`/delete affordance
→ `removeJoin`; a non-leaf edge's delete is **disabled with a text tooltip** (_"remove
the joins that depend on this one first"_). Exactly the hop list's affordances, drawn.

### Phase C — empty-canvas "New query" (the no-source create entry)

```text
Home ▸ Data Management ▸ Queries                                   [ + New query ]
                                       ↓ opens builder, create mode, EMPTY canvas
  ┌─ Canvas ────────────────────────────────────────────────────────────────────┐
  │                                                                              │
  │            ( empty )   [ + Add a source ]  ← place the first node            │
  │                         pick a dataset or saved query (sets sourceId)        │
  └──────────────────────────────────────────────────────────────────────────────┘
  [ Save ] → SaveQueryModal (name) → POST {name, sourceId, definition}
```

`[+ New query]` lives on the **Queries catalog** beside the existing source-rooted
verbs; it opens R77's create lifecycle with **no preset base** and the canvas as editor.

### Stale-edge state (the `409 relationship_stale` gate, on an edge)

```text
  ⚠  The “Deals ⋈ Accounts” join is unavailable — “account_id” no longer exists.
     Fix the relationship in the workspace, or remove this edge.
     [ Open relationships ↗ ]   [ Remove edge ]
```

---

## Behaviour — states

```mermaid
stateDiagram-v2
    [*] --> Viewing: open /queries/:id (read-only)
    Viewing --> Editing: click Edit
    Editing --> CanvasView: toggle view to Canvas (same working copy)
    CanvasView --> CanvasView: draw edge then addJoin / delete leaf then removeJoin (Phase B)
    CanvasView --> ListView: toggle back (no state lost)
    CanvasView --> EdgeStale: a hop edge drifted then 409 relationship_stale on the edge
    CanvasView --> PreviewLoading: edit then debounced preview or Preview
    PreviewLoading --> PreviewPopulated: graph valid then composed rows
    PreviewLoading --> PreviewInvalid: invalid predicate / stale edge then Save disabled
    Editing --> Saving: click Save (graph valid)
    Saving --> Viewing: 200 then persisted
    EdgeStale --> Redirect: open relationships / remove edge
```

- **View toggle is lossless** — `[List] ⇄ [Canvas]` swaps the **rendering** of one
  working copy; no edit is lost, no model is forked. Edits in either view call the same
  `useQueryBuilder` ops.
- **Phase-A trivial states (R85 — declared so F builds them, not infers them).** _Empty
  graph_: a Query with **no joins** (`joins[] === []`) renders the **lone driving node**
  (`sourceId`) — a single-node canvas, not a blank. _Loading_: the canvas mounts on the
  builder's **existing** load — it reads the resolved `joins` plus the same
  `useRelationshipsQuery` / `useDatasetsQuery` the hop-list (`JoinEditor`) already uses to
  name nodes/edges; **no new spinner state is invented** (until that data resolves, the
  Build section shows the same loading it shows today). The canvas resolves each hop's
  dataset names + key pair + cardinality exactly as the list does (reuse, not a parallel
  fetch path).
- **Editing (Phase B)** maps to the hop-list ops exactly: draw-edge → `addJoin`
  (connected-acyclic guard unchanged); delete-leaf → `removeJoin`; non-leaf delete
  disabled with a text tooltip. When **no** source has an eligible outgoing edge, the
  add affordance is **disabled** with the same guiding tooltip the hop list uses
  (_"Declare a relationship first"_, linking to [relationships.md](../workspaces/relationships.md)).
- **Preview / Save / discard** are **unchanged** — the stateless `POST …/queries/preview`
  and the dirty-Save/discard lifecycle; the canvas persists nothing new (positions are
  view-only).
- **Stale gates are flag-don't-crash, per edge** — a stale hop renders the
  "edge unavailable" `<Alert role="alert">` on its edge, naming the column, never a
  blank crash ([purpose.md](../../../context/purpose.md) #5). _Code-reality note (R85):_
  `useQueryBuilder` exposes only a **chain-wide** `relStale: boolean` (set when the
  preview returns `409 relationship_stale`), **not** per-hop. The **per-edge** state is
  derived on the FE from each resolved `Relationship.status` (`'valid' | 'stale'`, already
  on the type the canvas resolves per hop) — no new wire field. Phase A may render the
  per-edge marker from `rel.status` and reuse the chain-wide `relStale` for the
  Save-guarded banner; a richer per-hop preview signal, if ever wanted, is a later
  contract decision, not Phase A's.
- **"New query" (Phase C)** opens create mode with no base; place the first node (sets
  `sourceId`), build the graph, Save captures a name and `POST`s — R77's lifecycle.

### Accessibility (declared here so F builds it, not infers it)

- **The canvas is not the only way to read/edit the tree.** The **`[List]` view is the
  keyboard-and-screen-reader-complete equivalent** (the shipped hop-list affordances);
  the `[List] [Canvas]` toggle is a labelled, keyboard-reachable control, and **List is
  the default for assistive-tech** — the canvas is an *additional*, not a *replacement*,
  affordance. No capability is canvas-only.
- **Nodes and edges carry text, not colour/glyph alone** — each node names its source in
  **text**; each edge names its key pair (`account_id ↔ id`) + a labelled cardinality
  `<Tag>`; the driving node is marked with **text/icon + label**, not colour. Node/edge
  selection is keyboard-reachable in a defined focus order.
- **Editing affordances are labelled** — draw-edge / `[+ Add a source]` / per-edge
  delete are labelled controls; a **disabled non-leaf delete** keeps its label and
  exposes its reason as **text** via tooltip (`aria-disabled`, not a silent dead
  control), so the leaf rule is discoverable.
- **The stale-edge state** is an `<Alert role="alert">` whose reason is **text** (the
  missing column + the edge named), icon + text — not a colour swatch; its
  `[Open relationships]` / `[Remove edge]` actions are focus-order reachable.
- **The "New query" entry + name capture** reuse `SaveQueryModal`'s shipped semantics
  (labelled input, autofocus, accessible `name_taken` error, Save-disabled reason).
- The result/preview reuses `<PagedRowsView>`'s shipped table semantics;
  collision-qualified headers keep every column name unique and screen-reader-navigable.

---

## Data contract (intent — no change)

The canvas is a **frontend-only** surface (J-3). It introduces **no new route, no new
wire field, and no new error code**:

- **Reads/writes** the existing `definition.joins: JoinStep[]` on the existing create /
  get / run / preview / update shapes ([queries.md § Joins](queries.md#joins-reading-related-datasets-as-one) /
  [query-construction.md](query-construction.md)); `sourceId` is R79's unified field.
- **Previews** through the existing stateless `POST /workspaces/{id}/queries/preview`.
- **"New query"** uses the existing `POST /workspaces/{id}/queries` (R76/R77 already
  carry the optional `sourceId`).
- **Consumes** the existing `409 relationship_stale` / `409 query_stale` /
  `422 disconnected_join` / `422 cyclic_join` gates per edge — **no new code**.

If the build round discovers a genuine contract need (e.g. persisting cosmetic node
positions), that is a **deviation flagged at the build's gate**, not assumed here; the
sealed intent is **FE-only over the existing tree**.

---

## Acceptance criteria (Design gate exit)

**This is a Design-only round.** Its acceptance is that the **design is sealed +
the verdicts are recorded**, not that code runs. The **design-gate** criteria below are
**design assertions** checked at this gate; the **handed-down** criteria are the
**future** build-round tests this doc passes to R81+ (run on the human's go-ahead
**if/when** J-2's trigger fires).

**Design-gate (this round):**

1. **Noun-vs-mode resolved → MODE** _(design assertion)_ — this doc records that the
   canvas is a view/edit mode of `useQueryBuilder` / `QueryBuilderPanel` over the
   existing `joins` tree + `sourceId`, minting no noun, page, model, or engine.
2. **Trigger verdict recorded → DEFER** _(design assertion)_ — this doc records the
   honest build-now/defer call with evidence (today's 2–4-node trees read fine as a
   list; the trigger is unfired) and **defers the build to R81+**, banking the design.
3. **Model-impact verdict → FE-only** _(design assertion)_ — this doc records that the
   canvas re-opens **no** model/contract/engine; the build (when pulled) is **F-only
   DCFBI**; `flow-selector` runs at that build round, not here.
4. **"New query" IA resolved** _(design assertion)_ — this doc records the empty-canvas
   "New query" as a **Queries-catalog entry into R77's create lifecycle** (no preset
   base), not a parallel surface — the noun-vs-mode brake on the entry point.
5. **First-build scope named** _(design assertion)_ — this doc names the phased slice
   (A read-only view → B editing → C "New query"), with **Phase A** the thin-but-not-
   rushed first build.
6. **Reuse invariant honoured in the spec** _(design assertion)_ — the surface table +
   honest split show the canvas reusing the builder lifecycle, validation, preview,
   `<PagedRowsView>`, and R77's create path; re-implementing none of them.

**Handed down to the build round (R81+, if the trigger fires):**

1. **Canvas renders the tree faithfully** _(FE)_ — nodes = `sourceId` + each hop's
   right; edges = `joins[]` labelled with the key pair + cardinality; a 2+-hop star
   renders correctly. _(Phase A)_
2. **View toggle is lossless** _(FE)_ — `[List] ⇄ [Canvas]` swaps the rendering of one
   working copy with no edit lost and no model fork.
3. **Canvas editing is at hop-list parity** _(FE)_ — draw-edge → `addJoin` (connected-
   acyclic guard), delete-leaf → `removeJoin`, non-leaf delete disabled with a tooltip;
   both update the live preview. _(Phase B)_
4. **Stale edge flags on the edge, not a crash** _(FE)_ — a drifted hop renders the
   "edge unavailable" alert naming the column on that edge; Save stays guarded.
5. **"New query" creates a Query through R77's lifecycle** _(FE + I)_ — `[+ New query]`
   opens create mode with no base; placing nodes builds the graph; Save name-captures
   and `POST`s — reusing `SaveQueryModal` + `useCreateQueryMutation`, no duplication.
   _(Phase C)_

---

## Scope boundary

### IN scope (R80 — Design only)

- **Resolving J-1…J-5** and **sealing this canvas design**: the noun-vs-mode verdict
  (MODE), the trigger verdict (DEFER, with evidence), the model-impact verdict
  (FE-only), the "New query" IA (catalog entry into R77's create lifecycle), and the
  phased first-build scope (A view → B editing → C "New query").
- **Banking the spec** (surfaces, reuse split, layout, states, accessibility, contract
  intent) so R81+ inherits a resolved home/flow.

### OUT of scope (deferred with named triggers)

- **The canvas BUILD** — any FE code (`QueryCanvas`, `CanvasEditing`, the view toggle,
  the "New query" entry) → **R81+**. _Trigger: a real report's `joins` tree outgrows the
  hop list + left-source `<Select>` — a topology a human can no longer read as a list.
  The build round re-checks this trigger before starting; if trees are still small, it
  defers again._
- **`flow-selector` (DCFBI vs DFCFBI)** → the first build round's Design gate (a
  Design-only round has no contract/BE/FE code to gate; the F-only DCFBI lean recorded
  in J-3 is the build round's starting hypothesis, not a seal).
- **Persisting cosmetic node positions / auto-layout** → a build-round detail if pulled;
  the model carries **no** view state ([[design-altitude-vs-build-home]]).
- **Self-joins / diamonds / general DAGs; re-ordering hops; left/outer joins; composite
  keys; cross-workspace joins** → their own named triggers ([queries.md § Joins](queries.md#joins-reading-related-datasets-as-one));
  the canvas edits the **same tree** the model already permits, no more.
- **`qr_` on the RIGHT of a join hop; the raw-SQL → ORM data-access port; consumer-save
  / workflow / dashboard themes** → their own rounds, untouched here.

### This concept explicitly does NOT cover

- The `joins` tree model + engine (live in [queries.md § Joins](queries.md#joins-reading-related-datasets-as-one)) and the
  builder lifecycle (live in [query-construction.md](query-construction.md)) — the
  canvas **re-presents + edits** them, it does not restate them.
- The governed-edge model (declare / validate / stale) — lives in
  [relationships.md](../workspaces/relationships.md); the canvas **consumes** one edge
  per drawn edge.
- The create modal / catalog (live in [queries.md](queries.md)); the "New
  query" entry **reuses** them.
- The predicate vocabulary internals (live in the dataset filter/advanced docs).

---

## Reference materials (read-only)

- [queries.md § Joins](queries.md#joins-reading-related-datasets-as-one) — the `definition.joins` connected-acyclic **tree**
  (nodes + edges) this canvas renders and edits; the `add from any source` / `remove any
  leaf` affordances it re-presents; the per-hop stale gate.
- [query-construction.md](query-construction.md) — the hop-list builder
  (`useQueryBuilder` / `QueryBuilderPanel`) this adds a canvas view/edit mode to; R77's
  create lifecycle the "New query" entry generalizes.
- [queries.md](queries.md) — the domain anchor + trajectory step this fills;
  the reuse invariant this obeys.
- [queries.md](queries.md) — the catalog + create verbs the "New query" entry
  sits beside and reuses.
- [specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md) — the
  noun-vs-mode / discovered-vs-imposed lesson the verdict record applies.
