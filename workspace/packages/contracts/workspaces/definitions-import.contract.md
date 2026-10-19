# Definition pack — `GET /workspaces/{id}/definitions` + `POST /workspaces/{id}/definitions/import` — contract rationale

> **Authoritative shapes**: [definitions-get.contract.yaml](definitions-get.contract.yaml),
> [definitions-import.contract.yaml](definitions-import.contract.yaml),
> [`_shared/definition-pack.yaml`](../_shared/definition-pack.yaml).
> Design: [definition-pack.md](../../../../.agents/design/data-management/_shared/definition-pack.md).

## Purpose

A second workspace, or a second install, that should carry the same analysis as an existing one
re-creates its queries, dashboards and workflows by hand or by scripting the create / update
routes one by one — and every id differs per install. A pack writes a workspace's definitions **by
name** (unique per kind within a workspace), so one file moves them (R201, item 4.8).

## Behavior

- **Export** reads every query, workflow and dashboard of the workspace and rewrites only their
  references: a query's `sourceId` → `dataset`; a relationship's `leftSourceId` / `rightSourceId`
  → `leftDataset` / `rightDataset` (its `originRelationshipId` is left out); a workflow source →
  `{query}` / `{workflow}`; a widget's `queryId` → `query`. `wdg_`, `ctl_` and `qrel_` ids stay —
  they live inside one definition. The datasets the queries read are listed with their columns in
  order (query filters address columns by 0-based index). A reference to a deleted noun refuses
  the export (`409 pack_unresolved`) instead of dropping it.
- **Import** — four steps, one transaction:
  1. read the pack, in order (BA-C3): size (10 MiB, before parsing) → JSON → `packVersion`
     (`version`, whatever the rest looks like) → the one total cap (1 000 nouns) → the closed shape
     (`shape`, with the path) → duplicates (datasets too) → references (a closed pack: queries,
     workflows and the datasets a query names, BA-C4) → cycles — each `422 pack_invalid`;
  2. find each dataset by name in the target, with the pack's columns exactly (`found` /
     `missing` / `columns_differ`); `awaits_publish` when it is missing and a workflow of the pack
     publishes it (`publishedBy`, BA-C2); `unused` when nothing reads it;
  3. plan each noun in write order (queries; workflows after the workflows they read; dashboards)
     against its same-named noun: `create`; `unchanged` when the target's noun, exported, equals
     the pack's; otherwise by `onConflict` — `refuse` → `conflict` (`exists`), `replace` → the
     noun's update, `skip` (Keep mine) → kept, its readers carrying `binds` (BA-C1).
     `source_differs` (a query's update cannot move its dataset) blocks under all three;
     `slug_taken` under `refuse` and `replace`. A reader of an `awaits_publish` dataset, and its
     readers, is `deferred` — a planned state the next import of the same pack completes. A noun
     whose dataset is `missing` / `columns_differ`, that reads a noun that cannot be imported, or
     whose own save check refuses it is `invalid`;
  4. the plan gets its `planHash`; dry run → roll back, 200 plan; apply → commit when `ok` and
     equal to `expectedPlan` (200, new ids), else roll back and `409 pack_refused` (`not_ok` /
     `plan_changed`) with the plan.
- **Writes are the routes' own.** Each create / update runs the code of `POST
  /workspaces/{id}/queries|workflows|dashboards` and `PUT /queries|workflows|dashboards/{id}` on
  the import's connection: the same checks, the same history row (R200 — `#1 create`, `update` on
  a change, none on `unchanged`), the same metadata sweep, a replaced workflow's output cleared. A
  workflow source without an output (new, replaced, or never run) leaves the shape check between a
  workflow's sources (R186) to the run.
- **Errors.** Anything unexpected leaves the transaction uncommitted (`500 internal_error`,
  nothing written); a concurrent writer holding the lock past the 5 s busy timeout ends the same
  way — today's behaviour of every write route.
- **Who.** As open as the PUTs; the optional writer token (`WriterToken`, R200) labels the history
  rows. A saved workspace refuses (`409 read_only_workspace`).

## Error codes

| Code              | Status | Route  | Carries                                     |
| ----------------- | ------ | ------ | ------------------------------------------- |
| `pack_unresolved` | 409    | export | `problems[] {kind, name, reason, ref?}`     |
| `pack_invalid`    | 422    | import | `reason`, `problems[]` (`path`, `detail` on `shape`), `packVersion?`, `supported?` |
| `pack_refused`    | 409    | import | `reason` (`not_ok` / `plan_changed`), `plan` (`applied: false`) |

## Out of scope

Metadata notes, governed relationships, datasets and their rows, workflow runs / outputs / the
publish link, definition history; exporting part of a workspace; a conflict choice per noun;
remapping columns by name; mapping a dataset to a differently named one; running or publishing
from the import; deleting nouns the pack does not hold. Each has a trigger in the
design doc.
