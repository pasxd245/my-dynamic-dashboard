# Query Builder — the `queries/` domain overview

**Concept**: the **Query Builder** is the product's central data-construction concept:
the place a user **builds a (virtual) dataset** from one or more table-sources —
filtering, searching, joining, and composing on top of other Queries — then **saves** it
as a re-runnable [**Query**](saved-query.md) with its own `qr_` identity, catalog, and
URL. A Query is the **same readable-table-source kind** as a Dataset but a **different
archetype**. This doc is the **domain anchor**: it frames what lives in `queries/`, the
**reuse invariant** every surface here obeys, and the **trajectory** the domain grows
along — so each future capability inherits a clear home instead of re-deriving the IA.

**Status**: Accepted.
**Sibling docs**:
[saved-query.md](saved-query.md) (the **spine** — the Query model, all routes + error
codes, and the execution engine: single-source read, the join tree, outer-join types, and
composed `qr_` sources),
[query-construction.md](query-construction.md) (the **interactive builder** surface — edit
a Query's definition + preview before save; the "Build on this query" create mode),
[canvas.md](canvas.md) (the **free-form visual source-graph canvas** — a view/edit mode
over the `joins` tree; **design banked, build deferred**),
[dataset-detail.md](../datasets/dataset-detail.md) (hosts the **`[Save filters as Query]`**
action — the verb; the Query is the noun, here),
[relationships.md](../workspaces/relationships.md) (the workspace-governed **join input**
the builder consumes),
[datasets.md](../datasets/datasets.md) (the table-source a Query reads from; the catalog +
Page-List conventions the Queries catalog reuses),
[workspace-shell.target.md](../../_platform/workspace-shell.target.md) (the chrome all
surfaces render inside).

> **Why a domain, not a mode.** The Query started life as "a mode of the dataset surfaces"
> — a brake against standing up a `queries/` domain on a guess. The Query-Builder
> complexity (joins, composition, the construction surface) is the genuine pull that made
> the domain **discovered, not imposed**. Crucially, **doc-home and UI-duplication are
> independent axes**: having a `queries/` folder does **not** license parallel pages that
> re-implement the row table. The invariant below is what keeps that true.
> _Track: 1 (product feature)._

---

## The reuse invariant (the one rule this domain holds)

Every surface in `queries/` is **composed from existing shared components/layouts**, never
a parallel page or a re-invented engine — the single lesson the discarded first attempt
violated ([specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md)):

| Concern         | Reused from                                                                |
| --------------- | -------------------------------------------------------------------------- |
| Row table       | `<PagedRowsView>` (`data-management/_shared/`)                             |
| Catalog list    | the Page-List layout (`PageHeader` + `PageCard` + AntD `<Table>`)          |
| Detail layout   | the standard detail layout (`PageHeader` + `PageCard` + `<PagedRowsView>`) |
| Predicate vocab | the shipped `FilterAtom` / advanced-DNF serializers + validators (verbatim) |
| Row execution   | `query_dataset_rows` (live re-run), extended by `query_joined_rows`        |

What is genuinely **new** per capability is only its **persistence + identity + routes +
engine** — never a duplicated surface.

---

## Surfaces — layer / reuse / purity declaration

> Domain-level map. Per-surface specs live in the spine + the builder doc.

| Surface                                | Layer                                                                                   | Reusability         | Purity    | Allowed peer deps                  |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ------------------- | --------- | ---------------------------------- |
| `QueriesPage` (catalog)                | `apps/builder/src/features/data-management/queries`                                     | feature             | feature   | react, antd, @tanstack/react-query |
| `QueryDetailPage` (read + inline Edit) | `apps/builder/src/features/data-management/queries`                                     | feature             | feature   | react, antd, @tanstack/react-query |
| `<PagedRowsView>` (reused, not owned)  | `apps/builder/src/features/data-management/_shared`                                     | shared cross-domain | plain-UI  | react, antd, react-i18next         |
| `Query` type                           | `.../features/data-management/queries/types.ts`                                         | feature             | data type | none                               |
| Query model · routes · engine          | spine ([saved-query.md](saved-query.md))                                                | backend             | feature   | FastAPI, duckdb, @tanstack/react-query |
| Interactive construction surface       | `.../features/data-management/queries` ([query-construction.md](query-construction.md)) | feature             | feature   | react, antd                        |
| Visual source-graph canvas (deferred)  | `.../features/data-management/queries` ([canvas.md](canvas.md))                         | feature             | feature   | react, antd                        |

**Boundary check**: `<PagedRowsView>` is the only shared-cross-domain row here and it is
**reused, not owned** (its boundary lives in
[dataset-detail.md](../datasets/dataset-detail.md)). The catalog + detail pages are
feature-local and **compose** the shared shells; no `queries/` surface re-implements a
dataset surface.

---

## Token map

The `queries/` surfaces are AntD primitives styled by the `<ConfigProvider>` tokens
derived from the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts) (the source of
truth). **No new token is introduced**; the map reuses identifiers already cited by
[datasets.md](../datasets/datasets.md) and [saved-query.md](saved-query.md). `Value` is
informational.

| Surface          | AntD token (themeTokens.ts) | Value (informational) |
| ---------------- | --------------------------- | --------------------- |
| Page background  | `colorBgLayout`             | `#f5f5f5`             |
| Primary action   | `colorPrimary`              | `#1677ff`             |
| Border / divider | `colorBorderSecondary`      | `#f0f0f0`             |

Identifier parity is enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

---

## The trajectory (what `queries/` grows into)

The domain grows by **adding construction modes + inputs**, each obeying the reuse
invariant. What is **built** today lives in the spine; what is **next** is named with its
home and trigger:

```text
BUILT  → the Query spine (saved-query.md)
         · single-source save (filter a dataset, Save as Query)
         · join execution + the multi-hop join TREE (connected acyclic; inner/left/right/full)
         · composition (a Query as the driving source; the unified ds_/qr_ resolver)
         · the interactive construction surface (query-construction.md):
           edit + live-preview + the "Build on this query" create mode
NEXT   → the visual source-graph canvas (canvas.md) — design banked, build DEFERRED.
         Trigger: a real report's joins tree outgrows the hop list (unfired).
LATER  → consumer-save / dashboards (downstream value-out) — read the clean single-spine
         Query model.
```

Each step is **pulled, not pre-built** (the Evolution Rule + the
[dynamic-equilibrium brake](../../../context/purpose.md#dynamic-equilibrium)).

---

## Acceptance criteria

1. **One domain home** — `queries/` has a single catalog + detail home
   (`/data-management/queries`, `/data-management/queries/:id`); both **compose** the
   shared Page-List / detail layouts + `<PagedRowsView>`, with no copy-pasted
   `DatasetsPage` / `DatasetDetailPage`.
2. **Save filters as Query is an action, Query is the noun** — the `[Save filters as
   Query]` verb lives on [dataset-detail.md](../datasets/dataset-detail.md); the Query noun
   + its modes are documented under `queries/` (the noun/verb split mirroring
   `datasets.md` ↔ `upload.md`).
3. **Relationships are the declared join input** — a workspace-governed
   [Relationship](../workspaces/relationships.md) is the table-source edge the builder
   consumes to join.
4. **Trajectory is named, not pre-built** — each future capability (the canvas; downstream
   themes) has a named home + trigger here; none is scaffolded ahead of its pull.

---

## Scope boundary

### IN scope

+ The `queries/` domain anchor: the reuse invariant, the surface map, the trajectory, and
  the noun/verb framing.

### OUT of scope (deferred with named triggers)

+ **The visual source-graph canvas** → design banked, build deferred
  ([canvas.md](canvas.md)). _Trigger: the hop-list stops scaling._
+ **Workflow / complex query (YAML + polars); consumer-save; dashboards** → later
  downstream themes.
+ The Query model / routes / engine and the builder UX — owned by
  [saved-query.md](saved-query.md) + [query-construction.md](query-construction.md), not
  restated here.

---

## Reference materials (read-only)

+ [saved-query.md](saved-query.md) — the Query spine (model · routes · engine).
+ [query-construction.md](query-construction.md) — the interactive builder surface.
+ [relationships.md](../workspaces/relationships.md) — the governed join input.
+ [specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md) — the
  noun-vs-mode / reuse-not-duplicate lesson this domain enforces.
</content>
