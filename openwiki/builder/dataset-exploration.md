---
type: frontend exploration feature
title: Dataset exploration and advanced queries
description: Dataset row views, visibility and chip filters, plus the builder advanced-query parser, DNF semantics, validation, and URL state.
tags: [frontend, datasets, filtering]
---

# Dataset exploration and advanced queries

Dataset exploration centers on `DatasetDetailPage.tsx`, backed by `datasetsApi.getRows` and `useDatasetRowsQuery`. This feature owns browser presentation and URL-addressable filtering; [backend datasets](../backend/datasets.md) owns parsing and DuckDB execution.

## Rows and visibility

`DatasetDetailPage` loads a dataset and paged rows, manages ordinary text search, simple per-column filters, and advanced-query state. `PagedRowsView` renders the response table. `PropertiesDrawer` exposes column visibility; its mutation sends the *complete* hidden-column set to `PATCH /datasets/{id}/columns`. A hidden column is a view hint: default row rendering omits it, but data selection and analytical pickers continue to see it. The backend’s at-least-one-visible guard remains authoritative.

Simple filters use `filters/types.ts`, `FilterPopover`, `ActiveFilterChips`, and `useFiltersState`. `OPS_BY_DTYPE` and `OPERAND_SHAPE` constrain UI choices. `filters/serialize.ts` is the integration boundary: `serializeFiltersToSearchParams()` maps a filter set to API `f<N>_*` parameters; `parseFiltersFromSearchParams()` restores state; `cacheKeyForFilters()` creates a stable React Query key component. Any shape change must match `datasetsApi.getRows`, the backend query parser, and the rows contract.

## Advanced-query language

The advanced query is a compact textual syntax that compiles to predicate groups. `advanced-query/parser.ts` produces a `ParseResult`; `serialize.ts` converts groups to the `aq` URL/API representation; `useAdvancedQueryState.ts` ties text, parsed state, apply/clear behavior and URL persistence to the page. `reference.ts` builds context-sensitive help from column dtypes.

The semantic form is **DNF: OR of AND groups**. Within a clause, AND binds more tightly than OR. The parser supports quoted keys and values, operator aliases including Unicode forms, and dtype-specific families for strings, numerics, dates, and booleans. It receives the current dataset columns, so it can reject unknown columns, invalid operators for a dtype, invalid operands, and malformed syntax. Parse failures carry positions, allowing the UI to locate the issue instead of treating text as an opaque server error.

The applied structured result is serialized as `aq`; the backend AND-composes it with simple chips and free-text `q`. This makes the URL and API request an explicit compatibility seam: never serialize raw user text as `aq`, and do not assume the server parses the frontend grammar itself.

## Change surface and tests

A grammar or filter change requires coordinated edits to parser/types/reference, serializer/state, detail page and API client, contracts, backend filter parsing/execution, and tests. Focused evidence:

- `tests/advanced-query-parser.test.ts` checks precedence, quoting, aliases, dtype/operator rules, error positions, and serialization round trips.
- `tests/advanced-query.test.tsx` checks UI integration.
- `tests/dataset-detail.test.tsx` checks row/detail behaviors.
- `tests/column-visibility.test.tsx` checks presentation-only visibility behavior.

Run the affected Vitest suite, plus backend `test_datasets_rows_get.py` if the wire or predicate semantics changed.
