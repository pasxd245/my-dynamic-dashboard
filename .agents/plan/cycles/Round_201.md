# Round 201: definition pack — export and import by name (item 4.8)

**Status**: In Progress
**Flow**: TBD — set at the Design gate via `flow-selector` (see Do).
**Date started**: 2026-10-19
**Date completed**: —

## Goal

**Inherits from ← [Round_200](Round_200.md)** — every query, dashboard and workflow definition
now has a history (`seq`, the version hash, `change`, who), restore is the noun's own PUT, a
widget's notes follow the widget id, and `app.metadata.token_for` is the one writer-token lookup.
R200's `Feeds into →` named the next item: **4.8 — a definition pack**, not yet in `rc4.md`.

A second install (or a clean re-install) that should carry the same analysis as an existing one
re-creates its queries, dashboards and workflows by hand, or by scripting the create / update
routes one by one — and every id differs per install, so a script written against one install
does not run against the other. A previous round's parity check needed an ad-hoc probe built by
hand for the same reason. Wanted: **export the definitions of one workspace and import them into
another workspace (same or another install) by name, independent of ids** — datasets stay out
(data never travels in the pack); the pack names the datasets it needs and the import finds them
by name in the target workspace.

The owner's decisions (2026-10-19, relayed by the orchestrator): 4.8 is specified **and** built in
rc.4; **4.1 scheduled refresh is deferred** — "no deployment pull yet — the only active install
refreshes by hand on a weekly cadence and runs no scheduler; reopen when a deployment names a
watched source".

_Track: 1 (product). Pulled by: a named product gap — re-creating the same analysis in a second
workspace or install by hand, with ids that differ per install (R200 `Feeds into →`; the hand-built
parity probe of an earlier round) — per [Evolution Rule](../../AGENTS.md). The item is added to
rc.4 by the owner's call of 2026-10-19._

## Plan

**Expected outcome** _(refined at the Design gate)_: `GET /workspaces/{id}/definitions` returns a
versioned, id-free pack of the workspace's queries, dashboards and workflows; an import into
another workspace creates (or, by the chosen conflict rule, replaces or skips) each noun through
the nouns' own create / update paths, all or nothing, after a dry run that writes nothing; every
imported query, dashboard widget and workflow then reads the same rows as its original over the
same data.

- [ ] **D** — the 4.8 spec in `rc4.md` + the program-table row; design doc
      `data-management/_shared/definition-pack.md`; `flow-selector`
- [ ] **F1** _(if DFCFBI)_ — the builder against MSW before the contract; interaction decisions
      frozen
- [ ] **C** — contract (`_shared/definition-pack.yaml`, the route files, the error codes).
      **BA pass 1 at Contract exit.**
- [ ] **F2 / B / I** — per the Flow line
- [ ] Reviews: code review + QA in parallel, then BA pass 2; every P0/P1 fixed

## Risks / unknowns

_Written at the Design gate (the design calls the BA judges at Contract exit)._

## Do

- 2026-10-19 — round opened on `release/v0.0.1-rc.4` at `2f8b34c` (R198–R200 in Review).
- 2026-10-19 — **4.1 deferred** (owner, relayed by the orchestrator): `rc4.md` § 4.1 carries the
  deferral and its reason, the rc.4 exit-gate line names it, the program table reads `deferred`,
  and a rolling-log row records it with its reopen trigger.

## Check

_Open._

## Act

_Open._

## Feeds into → Round_202

_Written at close-out._
