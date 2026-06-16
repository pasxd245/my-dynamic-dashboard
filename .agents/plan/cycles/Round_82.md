# Round 82: design-sync sweep — re-sync the design corpus to code (workspaces → datasets → queries)

**Status**: In Progress — Plan gate ratified; Detect pass underway.
**Date started**: 2026-06-17
**Date completed**:
**Flow**: **Track-2 agent-method** — applies the [`design-sync`](../../skills/design-sync/SKILL.md)
skill across the data-management corpus. `flow-selector` (DCFBI vs DFCFBI) is **N/A** (no product
contract/BE/FE code). Gates: **Plan → Detect → Fix** (per-domain seams) **→ Check**.

## Goal

**Inherits from ← [Round_81](Round_81.md)** — R81 authored the `design-sync` skill and synced the
first domain (`workspaces.md`); it left a standing **`OUT OF SYNC` marker** on
[relationships.md](../../design/data-management/workspaces/relationships.md) as the R82 signal.

Run `design-sync` across **all three data-management domains** so the whole design corpus matches
the **actual implementation** (code is the source of truth) and is ledger-free. Approach (user):

1. **Detect first** — one `--check` pass over **workspaces → datasets → queries**: build each
   domain's CODE-TRUTH map, emit a per-domain drift report, and stamp `OUT OF SYNC` markers on the
   drifted docs. This gives the **whole drift picture before any rewrite** (and surfaces
   cross-domain drift — e.g. a rename or a persistence-foundation that hit multiple domains).
2. **Then fix one by one** — run `sync` per domain in **dependency order** (workspaces → datasets →
   queries: container → source → composer), each domain its own **commit seam**, each clearing its
   markers as it lands.

_Track: 2 (agent-method). Pulled by ← [Round_81 § Feeds into](Round_81.md) (the full-corpus sweep)
and the standing `OUT OF SYNC` marker on relationships.md — per [Evolution Rule](../../AGENTS.md)
and the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)._

## Judgment calls (held open)

| #   | Question | Why it's the crux |
| --- | -------- | ----------------- |
| J-1 | **One round or spill `queries` to R83?** | Decide from the **Detect** pass's drift volume (per R81 J-6: round-vs-program decided at sweep time, from evidence). `queries` is **7-way fragmented** (de-fragmentation, not just sync) — the heaviest. Lean: one round with per-domain seams; if Detect shows `queries` is too heavy, spill it to **R83** (keep rounds thin — [[round-bundling-revert-seams]]). |
| J-2 | **`queries` de-fragmentation shape.** | The 7-doc `queries/` cluster needs the skill's **de-fragment** step (§5): spine-first merge + redirect-stubs for the ~8 **locked** round files that link the merged paths. Confirm the spine/mode split **from the code**, not from the R81-reverted draft (that draft was doc-sourced; this must be code-true). Resolved at the `queries` Fix seam. |
| J-3 | **Per-domain CODE-TRUTH depth.** | `datasets` is a large surface (upload, filters, advanced-query, detail, table). Delegate a CODE-TRUTH map per domain (subagent), as in R81. `_shared/crud-hygiene.md` (workspace+dataset CRUD) and `_platform/` are cross-cutting — sync `crud-hygiene` with whichever domain pass touches it; `_platform/` is a follow-up if it drifts. |

## Plan (by gate)

1. **Plan gate** — ratify the sweep + the order + detect-first; record J-1…J-3 open. Commit the
   Plan seam. _(This step.)_
2. **Detect gate** — `design-sync --check` on each domain (`workspaces`, `datasets`, `queries`):
   CODE-TRUTH map → drift report (`.agents/tmp/design-sync/<domain>.md`) → stamp `OUT OF SYNC`
   markers on drifted docs. Tally drift volume; **resolve J-1** (one round vs spill `queries`).
   Verify `--check` stays gate-green with markers in place. Commit the Detect seam (the markers).
3. **Fix gate** — `sync` per domain, dependency order, one commit seam each:
   + **(a) workspaces** — sync [relationships.md](../../design/data-management/workspaces/relationships.md)
     to code (clear its marker; correct the persistence + declare-`422`/`409` + the mermaid branch
     labels); re-confirm `workspaces.md` still in sync.
   + **(b) datasets** — CODE-TRUTH → sync each `datasets/` doc; clear markers.
   + **(c) queries** — CODE-TRUTH → **de-fragment spine-first** (J-2) + sync; redirect-stubs for
     merged paths with locked round-file links; clear markers. _(Spills to R83 if J-1 says so.)_
4. **Check** — per-domain gates green; **no `OUT OF SYNC` marker remains** in `design/` (the
   absence-of-markers *is* the in-sync signal); flip to Review.

## Acceptance criteria

+ [ ] **Detect pass** run on all three domains; per-domain drift reports + markers produced; **J-1
      decided** (one round vs `queries`→R83).
+ [ ] Each in-scope domain **synced to the code** (markers cleared); `queries` **de-fragmented
      spine-first** with redirect-stubs where locked round files link merged paths.
+ [ ] **No `OUT OF SYNC` marker remains** in the synced scope — the corpus matches the
      implementation and is ledger-free.
+ [ ] Gates green: `design:lint` 0, `design:tokens` 0, `markdownlint` 0, `markdown-check-link` 0,
      `plan:lint` 0.
+ [ ] **Complete = human-signed-off** (the synced corpus).

## What is OUT of scope

+ **The canvas BUILD** — still deferred (R80 J-2); this round **re-opens its gate** (a synced
  corpus) but ships no canvas code.
+ **New features / new design** — sync only; code is the source of truth, nothing is invented.
+ **`_platform/` chrome docs** — a follow-up if Detect shows they drift; not a data-management
  domain. (`_shared/crud-hygiene.md` rides along with the workspaces/datasets passes that touch it.)

## Risks / unknowns

+ **`queries` de-fragmentation is the hard part** — a lossy spine-first merge + redirect-stubs for
  ~8 locked round files. _Mitigation: code-as-truth + the J-1 spill-to-R83 option + the skill's
  documented merge rule (redirect-stub, not deletion)._
+ **Re-deriving `queries` from code, not the reverted R81 draft** — that draft was doc-sourced.
  _Mitigation: J-2 confirms the spine/mode split from the CODE-TRUTH map._
+ **Detect stamps many markers at once** — must stay gate-safe. _Mitigation: proven in R81; the
  marker is a comment, body untouched._

## Do

### Plan-gate ratification (2026-06-17)

+ **Sweep ratified** (user: "proceed r82"): run [`design-sync`](../../skills/design-sync/SKILL.md)
  across all three data-management domains so the corpus matches the **actual implementation**
  (code is the source of truth) and is ledger-free.
+ **Order ratified**: **detect-first** (one `--check` pass over workspaces → datasets → queries for
  the whole drift picture before any rewrite), **then fix one-by-one** in dependency order
  (container → source → composer), each domain its own commit seam.
+ **J-1…J-3 held open** — J-1 (one round vs spill `queries`→R83) resolved from the Detect drift
  volume; J-2 (`queries` spine/mode split) resolved at the `queries` Fix seam from CODE-TRUTH;
  J-3 (per-domain CODE-TRUTH depth) — delegate a code-read subagent per domain.
+ **`flow-selector` N/A recorded** — Track-2 agent-method (no product contract/BE/FE to gate).

## Check

+ [ ] _(Pending.)_

## Act

_Pending — filled at round close._

## Feeds into → R83 (if `queries` spills) / the canvas-build gate

A design corpus synced to the implementation and ledger-free. If `queries` spills, **R83** finishes
it. When the sweep completes, the **canvas build** gate (R80 J-2 + R81's synced-corpus gate)
re-opens against a corpus that matches the code — and the downstream consumer-save / dashboard
themes read a clean, code-true source model.
