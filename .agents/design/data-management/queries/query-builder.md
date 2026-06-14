# Query Builder — the `queries/` domain overview

**Concept**: the **Query Builder** is the product's central data-construction
concept: the place a user **builds a (virtual) dataset** from one or more
table-sources — filtering, searching, and (from R71) **joining** — then
**saves** it as a re-runnable [**Query**](saved-query.md) with its own `qr_`
identity, catalog, and URL. A Query is the **same readable-table-source kind** as
a Dataset but a **different archetype**; the Query Builder is how Queries come
into being and grow. This doc is the **domain anchor**: it frames what lives in
`queries/`, the **reuse invariant** every surface here obeys, and the
**trajectory** later rounds extend along — so each future capability inherits a
clear home instead of re-deriving the IA.
**Status**: Accepted (R70 — domain anchor; graduated `queries/` from
`datasets/`). **Join execution** is specified in [joins.md](joins.md)
(**shipped R71**); the **interactive construction surface** is specified in
[query-construction.md](query-construction.md) (**Draft → R72**, the editable
single-join builder); the **multi-join canvas** is **deferred → R73** (R72 J-1′).
This anchor seals the domain frame, not those surfaces.
**Round introduced**: [Round_70](../../../plan/cycles/Round_70.md) — "the Query
domain comes of age": the Query-Builder complexity (joins, composition, workflow)
pulled a first-class domain home, so [saved-query.md](saved-query.md) relocated
here and this overview was authored to anchor it.
**Domain folder**: `data-management/queries/`.
**Sibling docs**:
[saved-query.md](saved-query.md) (the **first construction mode** — save a
single-source filtered view; the catalog + query-mode detail surfaces),
[joins.md](joins.md) (the **second construction mode** — a Query consumes a
[Relationship](../workspaces/relationships.md) to read two datasets as one;
R71 join execution),
[query-construction.md](query-construction.md) (the **third construction mode** —
the interactive builder: edit a Query's join + cross-source predicates and preview
before save; R72),
[dataset-detail.md](../datasets/dataset-detail.md) (hosts the **`[+ Save as
Query]` action** — the verb; the Query is the noun, here),
[relationships.md](../workspaces/relationships.md) (the workspace-governed
**join input** the Query Builder consumes from R71),
[datasets.md](../datasets/datasets.md) (the table-source a Query reads from;
the catalog + Page-List conventions the Queries catalog reuses),
[workspace-shell.target.md](../../_platform/workspace-shell.target.md) (the
chrome all surfaces render inside).

> **Why a domain, not a mode (the R69 → R70 shift).** R69 deliberately parked the
> Query under `datasets/` as "a mode of the dataset surfaces" — a **brake**
> against standing up a `queries/` domain on a guess. R70's Query-Builder
> reframing is the genuine **pull** (joins now, composition + workflow next), so
> the domain is **discovered, not imposed**. Crucially, **doc-home and
> UI-duplication are independent axes**: graduating the folder does **not**
> re-commit the discarded first R69's sin (parallel pages re-implementing the row
> table). The invariant below is what keeps that true.
> _Track: 1 (product feature). Pulled by ← [Round_70](../../../plan/cycles/Round_70.md)
> Query-Builder reframing + the R69 deferral._

---

## The reuse invariant (the one rule this domain holds)

Every surface in `queries/` is **composed from existing shared
components/layouts**, never a parallel page or a re-invented engine. This is the
single lesson the discarded first R69 violated
([specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md)):

| Concern         | Reused from                                                                |
| --------------- | -------------------------------------------------------------------------- |
| Row table       | `<PagedRowsView>` (`data-management/_shared/`, R69 extraction)             |
| Catalog list    | the Page-List layout (`PageHeader` + `PageCard` + AntD `<Table>`)          |
| Detail layout   | the standard detail layout (`PageHeader` + `PageCard` + `<PagedRowsView>`) |
| Predicate vocab | the shipped `FilterPredicate` / `aq` serializers + validators (verbatim)   |
| Row execution   | `query_dataset_rows` (live re-run)                                         |

What is genuinely **new** per capability is only its **persistence + identity +
routes** — never a duplicated surface.

---

## Surfaces — layer / reuse / purity declaration

> Domain-level map. Per-surface specs live in the mode docs
> ([saved-query.md](saved-query.md)); join execution is [joins.md](joins.md)
> (R71); the interactive construction surface is R72.

| Surface                                | Layer                                                                                   | Reusability         | Purity    | Allowed peer deps                  |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ------------------- | --------- | ---------------------------------- |
| `QueriesPage` (catalog; R69 shipped)   | `apps/builder/src/features/data-management/queries`                                     | feature             | feature   | react, antd, @tanstack/react-query |
| `QueryDetailPage` (query mode; R69)    | `apps/builder/src/features/data-management/queries`                                     | feature             | feature   | react, antd, @tanstack/react-query |
| `<PagedRowsView>` (reused, not owned)  | `apps/builder/src/features/data-management/_shared`                                     | shared cross-domain | plain-UI  | react, antd, react-i18next         |
| `Query` type                           | `.../features/data-management/queries/types.ts`                                         | feature             | data type | none                               |
| Interactive construction surface (R72) | `.../features/data-management/queries` ([query-construction.md](query-construction.md)) | feature             | feature   | react, antd                        |
| Multi-join canvas (→ R73)              | `.../features/data-management/queries` (future)                                         | feature             | feature   | react, antd                        |

**Boundary check**: `<PagedRowsView>` is the only shared-cross-domain row here
and it is **reused, not owned** (its boundary lives in
[dataset-detail.md](../datasets/dataset-detail.md)). The catalog + detail pages
are feature-local and **compose** the shared Page-List / detail shells; they add
only their own sections. No `queries/` surface re-implements a dataset surface.

---

## Token map

The `queries/` surfaces are AntD primitives styled by the `<ConfigProvider>`
tokens derived from the six seeds in
[`themeTokens.ts`](../../../../workspace/packages/ui/src/themeTokens.ts) (the
source of truth — R66). **No new token is introduced**; the map reuses the
identifiers already cited by [datasets.md](../datasets/datasets.md) and
[saved-query.md](saved-query.md). `Value` is informational.

| Surface          | AntD token (themeTokens.ts) | Value (informational) |
| ---------------- | --------------------------- | --------------------- |
| Page background  | `colorBgLayout`             | `#f5f5f5`             |
| Primary action   | `colorPrimary`              | `#1677ff`             |
| Border / divider | `colorBorderSecondary`      | `#f0f0f0`             |

Identifier parity is enforced by
[`design-token-parity.mjs`](../../../../scripts/lint/design-token-parity.mjs).

---

## The trajectory (what `queries/` grows into)

The domain grows by **adding construction modes + inputs**, each a named round,
each obeying the reuse invariant:

```text
R69    single-source save     saved-query.md       (shipped) — filter a dataset, Save as Query
R70    declared join input    relationships.md     (shipped) — govern column↔column edges
R71    join execution         joins.md             (shipped) — a Query consumes a relationship
                                                      → joined rows (inner, single-key)
R72    construction surface   query-construction.md (this round, design) — the editable single-join
                                                      builder: edit join + cross-source predicates,
                                                      preview before save
R73    multi-join canvas      (future)             — chain 2+ relationships; a multi-hop join engine
later  workflow / composition (future)             — YAML + polars; a Query as input to another Query
```

Each step is **pulled, not pre-built** (the Evolution Rule + the
[dynamic-equilibrium brake](../../../context/purpose.md#dynamic-equilibrium)).
This doc is updated as each lands.

---

## Acceptance criteria (Design gate exit)

**User journey** — as a user I treat "my queries" as **one coherent place**: a
catalog of saved/constructed views, each reopenable and always re-run against
fresh data, built so the IA I learn for a single-source save still holds when I
later join or compose — because every query surface reuses the same shells.

1. **One domain home** _(structural / FE)_ — `queries/` has a single catalog +
   detail home (`/data-management/queries`, `/data-management/queries/:id`); both
   **compose** the shared Page-List / detail layouts + `<PagedRowsView>`, with no
   copy-pasted `DatasetsPage` / `DatasetDetailPage` (maps to the R69 reuse tests).
2. **Save filters as Query is an action, Query is the noun** _(structural)_ — the
   `[Save filters as Query]` verb (relabelled R72, was "Save as Query") lives on
   [dataset-detail.md](../datasets/dataset-detail.md);
   the Query noun + its modes are documented under `queries/` (the
   noun/verb split, mirroring `datasets.md` ↔ `upload.md`).
3. **Relationships are the declared join input** _(forward / R71)_ — a
   workspace-governed [Relationship](../workspaces/relationships.md) is the
   table-source edge the Query Builder consumes to join (R71); R70 only declares
   - validates it.
4. **Trajectory is named, not pre-built** _(structural)_ — each future capability
   (join execution → R71 [joins.md](joins.md); construction surface → R72;
   workflow + composition → later) has a named home + round here; none is
   scaffolded ahead of its pull.

---

## Scope boundary

### IN scope (R70)

- Establishing the `queries/` domain + this anchor: the reuse invariant, the
  surface map, the trajectory, and the noun/verb framing.
- Relocating [saved-query.md](saved-query.md) here as the first construction
  mode.

### OUT of scope (deferred with named triggers)

- **The interactive query-construction surface** (edit a join + build
  cross-source predicates, preview before save) → **R72**, specified in
  [query-construction.md](query-construction.md). The **multi-join canvas** (chain
  2+ relationships) is **R73**. _Trigger: a Query must be built from more than a
  minimal join + the saved filter state._
- **Join execution** (a Query consuming a [Relationship](../workspaces/relationships.md)
  to produce joined rows) → **R71** (shipped), specified in [joins.md](joins.md).
  The unified table-source resolver stays deferred (R71 J-2′).
- **Workflow / complex query** (YAML + polars) → **later**.
- **Query composition** (a Query as input to another Query) → later.

---

## Reference materials (read-only)

- [saved-query.md](saved-query.md) — the first construction mode (full spec).
- [relationships.md](../workspaces/relationships.md) — the join input (R70).
- [specious-model-lock-in](../../../memory/2026-06-13-specious-model-lock-in.md)
  — the noun-vs-mode / reuse-not-duplicate lesson this domain enforces.
