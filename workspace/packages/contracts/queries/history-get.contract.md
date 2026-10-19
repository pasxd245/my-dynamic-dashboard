# GET /{queries,dashboards,workflows}/{id}/history — rationale

**Round**: R200 — item 4.4, definition history.
**Plan/design**: [Round_200.md](../../../../.agents/plan/cycles/Round_200.md),
[definition-history.md](../../../../.agents/design/data-management/_shared/definition-history.md).

One rationale for the three route files (`queries/`, `dashboards/`,
`workflows/history-get.contract.yaml`) — they differ only in the id prefix and
the `kind` they answer.

## What it is

Every saved definition of a query, a dashboard or a workflow, newest first,
and any one of them read-only. A row is written by the server in the same
transaction as the definition change it records; nothing writes a row through
these routes.

## Why it exists

A definition's version is its hash (decision 14), so a note or a run can tell
that a definition moved — but not what it was before, who moved it, or how to
put it back. The previous definition was gone the moment a PUT landed.

## Shape decisions

- **One list route and one version route per kind, under the kind's own
  prefix** (`/queries/{id}/history`, not `/history/{kind}/{id}`): the id
  prefix already names the kind, the 404 for a missing noun is the noun's, and
  the builder calls the route next to the noun it is showing.
- **`seq` orders, `version` identifies a definition.** `seq` is the row's own
  number (+1 per change) and the list's order (`ORDER BY seq DESC`); `version`
  is the hash, and a restored version appears twice. The version route takes
  the hash (the item spec's `{version}`) and answers the newest row with it —
  every row with one hash holds the same definition.
- **`?seq=` on the version read** (added at the R200 visual gate). The hash
  identifies a definition, but a restored version has several rows with
  different times; the drawer asks for the row the user clicked, so the
  answer's `seq`, `changedAt` and a query's `sourceChangedSince` are that
  row's. Without `seq`, the newest row with the hash (the item spec's form).
- **The list carries no definitions.** It stays light for a long history; the
  version route returns one definition when the reader asks for it.
- **`current` beside `entries`.** The reader marks the current row by
  comparing, not by assuming the first row is current.
- **`changedBy` always present, `null` when unknown.** The builder never sends
  a writer token, so most rows are `null`; an agent writing through the API
  with its token is named. Server-stamped from configuration — the body has no
  such field (decision 9's rule for who wrote a thing).
- **`changedSource` beside `changedBy`** (BA-C4) — the token's `ai | human |
system`, stored while the table is new so an AI label can come later without
  a migration; the builder does not show it yet (owner question 2).
- **`sourceChangedSince` on a query version** (BA-C2) — a query's filters
  address columns by 0-based index, and a refresh that drops or adds a column
  only warns, so an old definition can validate and still read the wrong
  column. The server knows the datasets' `refreshedAt`; the builder should not
  guess, so the version read says whether a source changed after the row and
  the restore confirm warns (warn, not refuse — owner question 5).
- **`baseline`.** Migration 0011 seeded the definition each noun had at the
  upgrade; `change: baseline` says its time is when the history began, not
  when that definition was written.
- **No restore route.** Restore is the noun's PUT with an old definition, so
  it runs every check an edit runs and records a new version; a definition
  that no longer validates is refused by that PUT for its own reason.
- **No new error code.** 404 `not_found` (noun or version absent), FastAPI 422
  for a malformed id or version.

## Cross-links

- `_shared/history.yaml` — the schemas, the write rules and the `WriterToken`
  header the six create / update contracts reference.
- [put.contract.yaml](put.contract.yaml), `dashboards/put`, `workflows/put` —
  the routes a restore uses.
