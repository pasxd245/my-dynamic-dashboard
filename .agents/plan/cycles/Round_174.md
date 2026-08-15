# Round 174: the workflow dogfood — the noun has never been used by a human

**Status**: Review — **pass 1 (agent-driven) is done; pass 2 (the human's real-data walk) is OPEN.**
The round is deliberately NOT Complete: its two-track design (§ D) makes the human pass part of
this round, not a successor. Further findings append to § Do as `W-7`+ and gain a row in the
program's rolling log. It flips to Complete when the human either runs pass 2 or declares it
skipped with a reason (PDCA § Check).
**Flow**: probe round — **D + walk**. No C/B/F by design: the deliverable is findings, not code.
A fix that the probe ranks first may be taken in-round if it is small; anything else is recorded.
**Date started**: 2026-08-15
**Date completed**: —

## Goal

**Inherits from ← [Round_173](Round_173.md)**, and from the human's declared sequence at
[R172 § Feeds into](Round_172.md): _this round → a workflow deep-dive_.

**The Workflow noun was defined by reading code, and no human has ever exercised it.**
[R168](Round_168.md) settled it — *consolidate + materialize, frozen permanently* — and its
acceptance walk was **skipped** (`coverage: 0 of 5`), the only skip in the series. Datasets were
dogfooded at [R157](Round_157.md) and queries at [R160](Round_160.md); both probes **reordered the
roadmap**, and R160's broke a four-week stall. Workflows have had no equivalent.

This round walks the whole workflow loop once and lets the gaps rank themselves.

_Track: 1 (product). Pulled by: the human's declared sequence + R168's skipped walk — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: a ranked list of what actually hurts when a person tries to use a Workflow,
grounded in a real walk rather than in the noun's definition. The findings are the deliverable.

**Falsified if**: the walk surfaces nothing beyond the one gap already known (upstream staleness).
Then the noun is in better shape than this round assumes, and the deep-dive should collapse into
a scoped staleness fix — a smaller, more honest round.

### What is already known going in — so the probe does not re-derive it

| Thread                                                                    | State                                                                                |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Workflow row ORDER differs from its source query                          | **CLOSED.** R171 item 8 ordered the materialized write; R172's `duck.py` closed the residue |
| **Upstream staleness** — editing a source query does not invalidate output | **LIVE**, confirmed in [`workflows.py:147`](../../../workspace/apps/backend/app/routers/workflows.py) |
| No table carries an `updated_at`                                          | **Confirmed** — only `created_at` everywhere, plus `materialized_at` on workflows. Any staleness signal needs a schema decision |

_R169's open-list carried the row-order thread as live; it was written 2026-08-14, before R171
fixed it on 08-15. Verified here rather than inherited — [Round_173](Round_173.md)'s lesson._

### D — the probe design

- [x] **Two-track split** ([[two-track-verification-seed-vs-real]]) — **agent-driven pass first,
      human real-data pass second.** The dev DB carries the seed plus R171/R172's synthetic probe
      workspaces (up to 200k rows) but **not** the human's real 2025 call log. Synthetic data can
      verify the *feature*; only their file verifies the *problem*.
- [x] **Walk every stage once, shallowly** — R142's lesson: walking every loop stage once beats
      deep coverage of one stage. Six stages below.
- [x] **Record findings, do not fix mid-walk** — a probe that stops to fix loses the walk. The one
      exception is a fix small enough to not displace the round's purpose.
- [x] **Acceptance walk applies** — this round changes nothing a human can exercise, but its
      *deliverable* is a human exercising things. The walk **is** the round; `## Check` carries it.

### The six stages

1. **Create** — build a workflow consolidating ≥2 saved queries. Are sources findable? Does the
   surface explain what consolidation will do?
2. **Run** — materialize it. What errors are reachable? What does it cost at scale?
3. **Read** — page the output. Order, totals, column names, dtypes.
4. **Edit upstream** — change a source query. **What does the user see?** (the known gap — walked
   to find out how it *presents*, not whether it exists)
5. **Re-run** — does the change land, and is the difference legible?
6. **Consume** — point a widget or dashboard at the output. Does a frozen table serve the purpose
   the noun exists for?

### Explicitly NOT in this round

- **Building the staleness signal.** It needs a schema decision (add `updated_at` vs capture a
  definition-hash at run vs re-resolve on read) and a UX decision. The probe should rank it
  against whatever else it finds first.
- **Re-opening the noun.** R168 settled *consolidate + materialize*; this round tests whether that
  noun is usable, not whether it is right.

## Risks / unknowns

| Risk                                                       | Why it matters                                                        | Handling                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **An agent-driven walk cannot feel a UX gap.**             | The four-for-four walk evidence is all about what a *human* notices.  | The agent pass is explicitly the *mechanical* half; the human pass is where feel lands. |
| **Synthetic data hides the real problem.**                 | R160's finding only appeared on real 28k-row call data.               | Findings from the agent pass are marked provisional until the real-data pass confirms. |
| **The probe finds one thing and the round becomes a fix.** | That is the falsification firing, not a failure — but it must be said. | Recorded in § Check as the `Falsified if` firing, and the round re-scoped in the open. |

## Do

### The agent-driven pass — all six stages walked 2026-08-15

Backend on `:8000` (DuckDB v1.1.3), seed workspace `ws_42feca6a`. Two probe workflows created,
run, read, and **deleted at the close**; the one seed mutation attempted (a `PUT` on
`qr_fd38fa21`) **422'd on a wrong step shape and never landed**, so the seed is as it was.

**`Falsified if` did NOT fire.** The round expected to find nothing beyond upstream staleness. It
found **six**, three of them severe, and the severest is not staleness.

### W-1 — a Workflow's output has no consumer _(severe; the headline)_

`Widget.queryId` is typed [`QueryId`](../../../workspace/apps/backend/app/models/common.py) —
pattern `^qr_`. The widget picker in
[`WidgetBuilder.tsx:196`](../../../workspace/apps/builder/src/features/dashboard/WidgetBuilder.tsx)
offers `queryOptions` only, and the FE never calls the workflow rows path — `rg` over
`workspace/apps/builder/src` finds `unpaged` used exclusively against `/queries/{id}/rows`.

The backend router documents `unpaged=true` as _"the widget load path"_
([`workflows.py:257`](../../../workspace/apps/backend/app/routers/workflows.py)). **No widget can
reach it.** A workflow can be built, run, and read on its own detail page, and that is the end of
the road. **The noun exists to materialize a consolidated table so something can consume it, and
nothing can.**

### W-2 — consolidation silently narrows the output schema to the FIRST source _(severe)_

Consolidated `qr_fd38fa21` `[status, amount]` with `qr_35e9bccb`
`[status, month, amount, prev_month, cumulative]`. Measured on the written parquet:

| Layer                                    | Result                                                             |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `output.parquet` (DuckDB `DESCRIBE`)     | **all 5 columns** — `UNION ALL BY NAME` did the right thing         |
| `output_columns_json` (captured schema)  | **2 columns** — the first source's, per `build_consolidated_relation` |
| `GET /workflows/{id}/rows`               | **2 of 5** — reads by the captured schema                           |

**Three columns are written to disk and then permanently invisible through the API.** No warning,
no `422`. The docstring says _"v1 assumes same-shape sources"_ — the assumption is documented and
unenforced, which is the gap.

### W-3 — consolidation has no provenance, and the numbers double-count _(severe)_

The same walk stacked **4** all-time-by-status rows onto **43** monthly-by-status rows of the
**same orders**, indistinguishable in the output — 47 homogeneous-looking rows.

```text
SUM(amount) over the workflow output = 68 079.00
              source 1 (all-time)    =  7 326.25
              source 2 (monthly)     = 60 752.75   ← the same revenue, counted twice
```

Datasets got a `Source.Name` provenance column at [R156](Round_156.md) for exactly this failure.
**Workflow consolidate never did**, and it is the noun's defining operation.

### W-4 — upstream staleness is real, and already live in the seed _(severe, confirmed)_

No edit was needed to demonstrate it. `wf_1b103a9f`'s frozen output versus its own source, today:

```text
SOURCE today   : cancelled 574.25 · completed 4 735.00 · pending   648.50 · refunded 1 368.50
WORKFLOW frozen: cancelled 8 451.00 · completed 33 705.25 · pending 10 096.75 · refunded 8 499.75
```

**A 7× divergence, with no badge, no warning, and `materializedAt` the only clue** — a timestamp
the user cannot compare against anything. Worse: **no table carries an `updated_at`**, so the
product cannot say when or why the source moved, and neither can this round. The datasets are
unchanged (same `created_at`, same row counts), so the drift came from the query definition — but
**the audit trail needed to prove that does not exist.**

### W-5 — a workflow can be created over a never-resolved query _(minor)_

`qr_2b9aa958` ("Telesale calls", `resolvedColumns: []`) was accepted as a source → **201
Created**. `_validate_sources` checks only that the row exists in the workspace. It fails later,
at run.

### W-6 — a query named for an aggregate returns raw rows _(minor, known theme)_

`qr_4f39de0d` "Revenue by region" has **0 steps** and returns **20 raw joined columns**. The R163
naming/legibility gap the human parked, still live and now feeding workflow sources.

## Check

### Acceptance walk — `coverage: 6 of 6 stages walked, agent-driven`

- [x] **1 Create** — ✅ works; also W-5.
- [x] **2 Run** — ✅ materializes; W-2 captured the wrong schema here.
- [x] **3 Read** — ⚠️ W-2 + W-3 surfaced.
- [x] **4 Edit upstream** — ⚠️ W-4 confirmed without needing the edit.
- [x] **5 Re-run** — ✅ re-resolves fresh (the fix path works; nothing tells the user to use it).
- [x] **6 Consume** — ❌ **W-1: no consumer exists.**

**Provisional until the human's real-data pass** ([[two-track-verification-seed-vs-real]]): the
findings are mechanical and reproduce on seed data, so W-1/W-2/W-3/W-5 are structural and do not
need real data to confirm. W-4's *severity* does — how much a stale number costs depends on
whether a person would notice.

### Pass 2 — the human's real-data walk _(OPEN — this round continues)_

Same six stages, on the real 2025 call log rather than the seed. Two questions pass 1 could not
answer, both of which bear directly on the program's item 1:

- ⬜ **P1 — is there a job that needs consolidate?** Something you'd want to stack *across shaped
  queries* that dataset Append (R155) cannot already do by stacking the raw monthly files. A
  concrete yes is the case for giving the noun an exit; a shrug is evidence for pruning it.
- ⬜ **P2 — would you have caught W-4?** The seed's workflow is 7× off its source with no signal.
  On your own data, would a stale number look wrong to you, or would it look like an answer?

Findings from this pass append below as `W-7`+. Nothing here blocks the program from opening —
item 1 is the human's ruling either way, and pass 2 informs it rather than gating it.

- [x] Seed left as found; both probe workflows deleted (`204`), the attempted `PUT` never landed.

## Act

**Learnings**:

- **The probe answered a question the round did not ask.** It was scoped to rank gaps *inside* the
  noun and instead found the noun has **no exit** (W-1). Four rounds (R132–R135) built Workflow
  and four more (R167, R168, R171, R172) refined it; none checked whether anything could consume
  it. **A capability with no consumer reads as complete from every angle except use** — which is
  the argument for dogfood probes, now 3-for-3 at reordering the roadmap (R142, R160, R174).
- **"v1 assumes same-shape sources" is a comment, not a guard.** W-2's data loss is fully
  described in the docstring of the function that causes it. Documenting an assumption and
  enforcing it are different acts, and only one of them survives a user.
- **The absence of `updated_at` is not a missing column, it is a missing capability.** W-4 could
  not be *diagnosed* — not by the product, not by me. The system cannot distinguish "frozen on
  purpose" from "silently wrong".

**Promotions**: none — the findings belong to the successor round, not to `context/`.

**Prune check**: nothing pruned this round, but W-1 puts the **Workflow noun itself** on the table
for the successor: a noun whose output nothing consumes is a prune candidate, not only a fix
candidate.

## Feeds into → the `workflow-earns-its-place` program

The probe's job was to rank the successor, and it produced a **different question than the one
this round inherited**: the staleness fix R174 was expected to tee up ranks **fourth**, behind a
noun-level question nobody had asked — *does a materialized output nothing can consume earn its
place at all?*

That is more than one round, so the findings hand off to a **program**, not to `Round_175`
directly: [`programs/workflow-earns-its-place.plan.md`](../programs/workflow-earns-its-place.plan.md).
Same shape as [R160](Round_160.md) → the
[query-shaping-surface program](../programs/query-shaping-surface.plan.md): a dogfood probe pulls a
program, and the program's item 1 becomes the next round.

**The split, so neither document drifts**: this round owns the **evidence** — § Do holds every
finding with its measurement, commands, and code anchors, and is append-only. The program owns the
**disposition** — ranking, work items, and a rolling log carrying all six findings with a
disposition each. Rankings are not restated here; dispositions are not re-argued there.

**Item 1 is a one-way door** and is deliberately left open for the human
([[lock-concepts-hold-one-way-door]]): give the output an exit (widen `Widget.queryId` to accept
`wf_`), or prune the noun. Items 2–4 are **void, not deferred**, if it prunes — except W-4's
underlying gap (`updated_at` is missing product-wide), which survives either ruling.

**Also carried, untouched**: the UI cluster from R171/R172 (catalog row-actions convention, R167
W-1 canvas layout persistence, the two `onError`-less sibling mutations), the 41 dangling wikilink
slugs (R173), and the `--hidden` row proposed for `context/tools.md`.
