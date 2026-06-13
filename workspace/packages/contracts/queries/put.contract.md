# PUT /queries/{id} — rationale

**Round**: R72 — the interactive construction surface (editable builder).
**Design**:
[query-construction.md](../../../../.agents/design/data-management/queries/query-construction.md).

## What it is

Persists an edited query **definition** (the builder's Save). The first
mutate-an-existing-Query path — R69 was create + read; R72 adds edit.

## Shape decisions

- **Definition-only body** `{ definition }`. R72 edits the join +
  predicates; the Query's `name` is unchanged this round (rename is a
  separate, deferred affordance — see query-construction.md § Scope), so
  there is **no `name_taken`** path and the body omits `name`.
- **PUT, not PATCH.** The whole `definition` is replaced (the builder owns
  the entire working copy); a full-replace PUT is the honest verb. The
  Query's identity, name, source, and `createdAt` are untouched.
- **Same validate-on-save guards as create** — `422` for a bad atom or an
  unknown / cross-workspace / stale edge; you cannot save a definition that
  can't run. `404` if the query is absent.
- **Response is the updated `Query`** with `resolvedColumns` recomputed
  (present when the saved definition joins), so the FE re-renders the
  read-only view from the response without a second fetch.
