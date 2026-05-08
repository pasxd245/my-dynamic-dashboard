---
name: clean-code
description: >
  Enforces clean code conventions across the full project tech stack:
  Python (FastAPI, Polars, DuckDB, SQLite), TypeScript/React (TanStack,
  React Flow, Tailwind), and Streamlit dashboards. Activates during code
  writing, review, and refactoring.
---

## Trigger

This skill activates whenever an agent is:

- Writing new code in any package (backend, builder, dashboard)
- Reviewing or refactoring existing code
- Generating SQL, API endpoints, React components, or data pipelines

---

## Procedure

Apply the rules below **per tech stack**. When in doubt, favour
readability over cleverness and consistency over personal preference.

---

## 1. Python — General

### Style

- Follow PEP 8. Use 4-space indentation.
- Max line length: 88 characters (Black default).
- Use `snake_case` for functions, variables, modules. `PascalCase` for classes.
- Prefer f-strings over `.format()` or `%`.
- Type-hint all function signatures. Use `from __future__ import annotations` when needed.

### Imports

- Group: stdlib → third-party → local. One blank line between groups.
- Absolute imports only (`from app.core.metadata_db import MetadataDB`).
- Never `from module import *`.

### Structure

- One class per file when the class is substantial (>50 lines).
- Keep functions under 30 lines. Extract helpers when logic branches.
- Early return over deep nesting.
- Use dataclasses or Pydantic models instead of raw dicts for structured data.

### Error handling

- Catch specific exceptions, never bare `except:`.
- Let unexpected errors propagate — do not silently swallow.
- Use `HTTPException` with clear `detail` messages in FastAPI endpoints.

---

## 2. FastAPI (Backend)

### Endpoints

- Use `APIRouter` per domain (`upload.py`, `relationships.py`, `queries.py`).
- Prefix all routes with `/api/v1/`.
- Use Pydantic models for request and response bodies. Avoid raw `dict`.
- Return consistent response shapes: `{"data": ..., "error": null}` or use Pydantic.

### Naming

- Router files match the resource: `tables.py` for `/api/v1/tables/*`.
- Endpoint functions use verb-noun: `upload_table`, `list_relationships`, `execute_query`.

### Dependencies

- Use FastAPI `Depends()` for shared resources (db connections, config).
- Never instantiate DB connections inside endpoint functions.

### Validation

- Validate at the API boundary. Trust internal functions after that.
- Use Pydantic `Field(...)` with descriptions for OpenAPI docs.

---

## 3. Polars (ETL / Data Processing)

### Reading data

- Use `pl.read_excel()` / `pl.read_csv()` for uploads.
- Use `pl.scan_parquet()` (lazy) when querying — only `.collect()` when results are needed.

### Transformations

- Chain operations instead of intermediate variables:

  ```python
  # good
  result = (
      df
      .filter(pl.col("date") >= start)
      .group_by("agent_id")
      .agg(pl.col("amount").sum())
  )

  # avoid
  filtered = df.filter(...)
  grouped = filtered.group_by(...)
  result = grouped.agg(...)
  ```

- Use `.alias()` to name derived columns explicitly.
- Prefer Polars expressions over Python loops on DataFrames.

### Schema detection

- Always capture `null_count` and `n_unique` alongside dtype.
- Store schema as a dict with column metadata, not just a list of names.

### Parquet output

- Use `compression="zstd"` and `statistics=True` for all writes.
- Write to versioned paths: `data/parquet/{file_id}/v{version}.parquet`.

---

## 4. DuckDB (Query Engine)

### SQL generation

- Always alias tables in FROM/JOIN clauses: `AS sales`, `AS agents`.
- Use parameterised paths: `read_parquet('{path}')` — never hardcode data directories.
- Qualify all column references with table alias: `sales.amount`, not `amount`.

### Safety

- Never interpolate user input directly into SQL strings.
- Use DuckDB's parameter binding or validate/escape values in the SQL translator.
- Always `EXPLAIN` before executing generated SQL in development/preview mode.

### Performance

- Add `LIMIT` for preview queries.
- Let DuckDB handle join ordering — do not manually reorder joins.
- Use `union_by_name=true` when reading multi-version Parquet files.

---

## 5. SQLite (Metadata)

### Schema

- Use `TEXT` for UUIDs and ISO timestamps (SQLite has no native UUID/datetime).
- Define foreign keys and create indexes on lookup columns.
- Use `CREATE TABLE IF NOT EXISTS` for idempotent init.

### Queries

- Use parameterised queries (`?` placeholders) — never string concatenation.
- Set `row_factory = sqlite3.Row` for dict-like access.
- Always `conn.commit()` after writes. Use `with conn:` for transactions when grouping multiple writes.

### Naming

- Tables: plural nouns (`files`, `relationships`, `query_configs`).
- Columns: `snake_case`. Boolean columns prefixed with `is_` (`is_active`, `is_broken`).

---

## 6. TypeScript / React (Builder)

### Style

- Strict TypeScript (`"strict": true` in tsconfig).
- Use `interface` for object shapes, `type` for unions/intersections.
- No `any`. Use `unknown` + type narrowing when the type is genuinely unknown.
- Prefer `const` over `let`. Never `var`.

### Components

- One component per file. Filename matches component name: `FileUploader.tsx`.
- Use functional components only. No class components.
- Props interface named `{Component}Props`:

  ```tsx
  interface FileUploaderProps {
    onUpload: (file: File) => void;
    disabled?: boolean;
  }
  ```

- Colocate hooks, types, and helpers with their component when single-use.
- Extract to `hooks/` or `utils/` when shared by 2+ components.

### State management

- Server state: TanStack Query (`useQuery`, `useMutation`). Never `useState` + `useEffect` for API calls.
- Local UI state: `useState` or Zustand for cross-component state.
- Invalidate queries after mutations: `queryClient.invalidateQueries({ queryKey: [...] })`.

### TanStack Query conventions

- Query keys are arrays describing the resource: `['tables']`, `['relationships']`, `['table', fileId]`.
- Mutation `onSuccess` handles cache invalidation and user feedback (toast).
- Keep `queryFn` in `api/client.ts`, not inline in components.

### TanStack Router conventions

- File-based routes under `src/routes/`.
- Use route loaders for data that must be available before render.
- Type-safe params via `Route.useParams()`.

### TanStack Table conventions

- Define columns with `accessorKey` and explicit `header` labels.
- Use `cell` renderers for formatting (numbers, dates, badges).
- Enable sorting/filtering only on columns where it makes sense.

### React Flow conventions

- Table nodes are custom node types with column lists.
- Edges represent relationships; label with join column names.
- Save/load graph positions so the layout persists across sessions.

---

## 7. Tailwind CSS (Styling)

- Use utility classes directly. Avoid `@apply` except in base layer resets.
- Extract repeated class strings into components, not CSS files.
- Use `clsx` or `cn()` helper for conditional classes:

  ```tsx
  className={clsx("px-4 py-2 rounded", isActive && "bg-blue-600 text-white")}
  ```

- Stick to the default Tailwind palette. Extend in `tailwind.config.js` only for brand colours.
- Responsive: mobile-first (`md:`, `lg:` prefixes for larger screens).

---

## 8. Streamlit + Pandas (Dashboard)

### Structure

- Entry point: `app.py`. Additional pages under `pages/`.
- Keep business logic out of Streamlit files — call backend API instead.
- Use `st.cache_data` for expensive reads (Parquet, API calls).

### Pandas usage

- Dashboard receives small, pre-aggregated DataFrames. Pandas is fine here.
- Use `.to_dict('records')` when sending data to Plotly.
- For Excel export, use `BytesIO` buffer with `to_excel()`.

### Visualisations

- Default to Plotly (`px.bar`, `px.line`, `px.scatter`).
- Set `use_container_width=True` on all `st.plotly_chart` calls.
- Auto-detect column types to suggest chart types; do not hardcode.

### Layout

- Use `st.columns()` for side-by-side metrics.
- Use `st.expander()` for detail views that clutter the main page.
- Keep the main view to: metrics row → chart(s) → data table → export buttons.

---

## 9. Cross-Cutting Concerns

### Naming consistency across stacks

| Concept       | Python         | TypeScript     | SQL             | API route           |
| ------------- | -------------- | -------------- | --------------- | ------------------- |
| Uploaded file | `file_id`      | `fileId`       | `file_id`       | `/tables/{file_id}` |
| Table link    | `relationship` | `relationship` | `relationships` | `/relationships`    |
| Saved report  | `query_config` | `queryConfig`  | `query_configs` | `/configs`          |

Use snake_case in Python/SQL, camelCase in TypeScript, kebab-case in URLs.

### Error messages

- User-facing: plain language, suggest what to do next.
- Developer-facing (logs): include context (file_id, query, stack trace).
- Never expose internal paths or SQL in API error responses.

### File organisation

```
apps/backend/app/
  api/          → one file per resource (thin: validation + delegation)
  core/         → business logic (testable, no FastAPI imports)
  models/       → Pydantic models and dataclasses

apps/builder/src/
  routes/       → one file per page (TanStack Router)
  components/   → reusable UI pieces
  hooks/        → custom hooks (TanStack Query wrappers)
  api/          → HTTP client and endpoint functions
  types/        → shared TypeScript interfaces

apps/dashboard/
  app.py        → entry point
  pages/        → Streamlit multi-page app
  components/   → chart builders, export helpers
  utils/        → API client, formatters
```

### Git hygiene

- Commit messages: `type: short description` (e.g., `feat: add relationship CRUD endpoints`).
- Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.
- One logical change per commit. Do not mix refactoring with new features.

### Testing

- Backend: test `core/` functions directly (unit). Test API endpoints with `TestClient` (integration).
- Frontend: test hooks and utilities. Components only need tests when they contain non-trivial logic.
- Prefer real DuckDB + temp Parquet files over mocks for data layer tests.
