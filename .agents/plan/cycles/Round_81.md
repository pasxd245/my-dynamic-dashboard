# Round 81: Open the design-compaction theme — distill the design corpus to latest-state + author the compaction skill

**Status**: Review — re-scoped 2026-06-17 (course-correction): the skill is **`design-sync`**
(re-sync a domain's design docs to the **actual implementation**, then compact), the primary axis
is **doc↔code sync** (not doc↔doc merge), and the pilot domain is the **simplest one —
`workspaces`** (the output is a domain-general skill that re-runs on any `design/<domain>`). Skill
authored + workspaces pilot synced + gates green; awaiting human sign-off.
**Date started**: 2026-06-16
**Date completed**:
**Flow**: **Track-2 agent-method** (a design-flow improvement). `flow-selector` (DCFBI vs
DFCFBI) is **N/A** — this round authors a **skill + a corpus distillation**, not a product
feature with contract/BE/FE code to gate. Gates: **Plan → Design** (resolve the judgment
calls, spec the skill) **→ Build** (author the skill + run the pilot) **→ Check**.

## Goal

**Inherits from ← [Round_80](Round_80.md)** — R80 banked the canvas design and **deferred its
build** (J-2: trigger unfired). This round adds a **further gate on the canvas build**: per the
user, **the canvas waits until the design corpus has a final, compacted latest-state version of
all current screens** — we stop layering new design on a drifted, fragmented base.

The design corpus has **drifted from "source code for the UI" into a ledger**. Two named smells:

1. **Accretion** — [crud-hygiene.md](../../design/data-management/_shared/crud-hygiene.md) is
   665 lines ending in bolted-on **"R30 stamp / R32 stamp / R33 stamp"** + "shipped R24–R26" +
   test counts. The *current truth* is buried under its own changelog.
2. **Fragmentation** — [`queries/`](../../design/data-management/queries/) is **7 docs**
   (joins, multi-join, composition, query-construction, query-builder, saved-query, canvas) for
   what is really **one** concept ("a Query"). Born one-per-round-pull; no single place reads the
   current query model, so it can't be aligned against the actual UI.

**The principle (user, 2026-06-16):** _a design doc is **source code**, not history. It states the
**latest state** of a screen — the part-of-app — and nothing else. History (why/when/round/test
counts) lives in **git + rounds + memory**, never inline._ Compaction = **distill each cluster to
its current-state spec and delete the ledger**, organized as a **"reason set"** (verb/operation
view, the way [crud-hygiene.md](../../design/data-management/_shared/crud-hygiene.md) already frames
CRUD as one verb-set across two nouns — but kept lean over time).

**Deliverable:** a **design-compaction skill** + a **pilot** that distills one cluster
(`queries/`, the worst offender) to prove the method — most importantly the **compaction order**.
The corpus-wide sweep is a follow-on (R82+).

_Track: 2 (agent-method). Pulled by ← the user's D-flow pain (2026-06-16): design docs go stale +
fragment after a few rounds and are hard to align with the actual UI; successor to the closed
[design-corpus-audit program](../programs/design-corpus-audit.plan.md) (which made the corpus
*conform*; this keeps it *current + compact*) — per [Evolution Rule](../../AGENTS.md) +
the [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)._

## Judgment calls (held open for the Design gate)

| #   | Question | Why it's the crux |
| --- | -------- | ----------------- |
| J-1 | **Latest-state boundary.** What exactly does "source code, not history" keep vs delete? | Headline rule. Resolved-direction: **keep** the current-state spec + the living rationale that explains *why the current shape is shaped this way* (good source has explanatory comments); **delete** dated round-stamps, test counts, superseded intermediate states, and round attribution (git/rounds/memory own those). Pin the precise line at Design so the skill isn't lossy in the wrong direction. |
| J-2 | **Compaction order.** Per cluster, process **newest→oldest**, or **dependency-smart** (canonical *spine* doc — what the noun IS — first, then fold verbs/modes onto it)? | The pilot's reason for being. Wrong order ⇒ rework (compact a derived doc, then redo it when its base lands). The pilot on `queries/` decides this empirically and the skill codifies the winner. |
| J-3 | **Output shape (the "reason set").** Does a cluster collapse to **one** verb/operation-organized canonical doc (CRUD-style), or a **noun-spine doc + thin mode docs + an index**? Fixed rule or per-cluster judgment? | Determines what "compacted" looks like and whether the file count actually drops. Must honor the noun-vs-mode brake (one model, modes as siblings — the R80 canvas verdict). |
| J-4 | **Skill shape + trigger + brake.** Is it a **procedure-checklist skill** (judgment-heavy, like `ui-design`/`research`) or a mechanical script? **When** does it run (manual on noticed drift? at round close? a freshness lint?) and **how does it avoid re-bloat** (what it prunes — the brake)? | A new skill is new mechanism; the brake demands it counter a *named* failure mode at least cost and name what keeps it from becoming ceremony. |
| J-5 | **UI-alignment.** The motivation is "align with the **actual UI**." Does the skill **verify** the compacted doc against the shipped FE/contract (a traceability spot-check, like the audit program), or purely **consolidate docs** and leave alignment to `ui-design` fidelity mode? | Decides whether compaction also closes the doc↔shipped-UI drift gap or just the doc↔doc fragmentation gap. |
| J-6 | **Corpus scope of R81.** R81 = author the skill + pilot `queries/` only. Is the **full-corpus sweep** (every cluster → final current-state, the gate on the canvas build) a follow-on **R82+**, or a **program**? | Keeps R81 thin (brake) while naming the larger commitment the user set ("final design version of all screens before canvas"). |

## Plan (by gate)

1. **Plan gate** — ratify the goal (open the compaction theme; canvas build now gated behind a
   compacted corpus); record J-1…J-6 held open. Commit the round file (Plan seam). _(This step.)_
2. **Design gate** — resolve J-1…J-6; the headline is the **latest-state boundary** (J-1) and the
   **compaction-order** call (J-2, settled by the pilot). Spec the skill (SKILL.md outline:
   procedure, inputs, the order rule, the keep/delete boundary, the brake/trigger, how it calls
   `markdown-check-link --fix` for merge-induced link repair). Run `ui-design` design-spec only if
   the round produces a *UI* design doc (it produces a *skill* + a distilled spec — `ui-design`
   applies to the **pilot's output doc**, not the skill). Commit the Design seam.
3. **Build gate** — author `.agents/skills/design-compaction/` and **run the pilot on `queries/`**:
   distill the 7 docs to the J-3 output shape using the J-2 order. Re-point inbound links
   (`markdown-check-link --fix`). Commit the Build seam.
4. **Check** — gates green on the touched design docs (`design:lint`, `design:tokens`,
   `markdownlint`, `markdown-check-link`, `plan:lint`); the pilot reads as current-state with the
   ledger gone; the order rule is documented in the skill. Flip to Review for human sign-off.

## Acceptance criteria

+ [x] **Goal ratified** (Plan gate, 2026-06-16); **J-1…J-6 resolved** (Design gate, 2026-06-16);
      **re-scoped to doc↔code sync** (course-correction, 2026-06-17).
+ [x] A **`design-sync` skill** exists with: the **code-as-source-of-truth** procedure (CODE-TRUTH
      map → drift report → reconcile), the **keep/delete boundary** (J-1), the **spine-first order**
      (J-2), and its **trigger + brake** (J-4 → standing skill).
+ [x] The **`workspaces` pilot** is re-synced to the actual code and compacted (372 → ~205 lines;
      ledger gone; the R13-frozen claims corrected to the shipped CRUD + persistence reality).
+ [x] Gates green: `design:lint` 0, `design:tokens` 0, `markdownlint` 0, `markdown-check-link` 0,
      `plan:lint` 0.
+ [ ] **Complete = human-signed-off** (the principle + the skill + the workspaces pilot).

## What is OUT of scope

+ **The full-corpus sweep** — distilling *every* cluster to final current-state — is **R82+**
  (or a program), per J-6. R81 proves the method on one cluster.
+ **The canvas build** — still deferred (R80 J-2), now additionally gated behind the completed
  corpus sweep.
+ **Re-litigating the audit program's format conventions** — `design:lint`/`design:tokens` stay
  the format authority; compaction works *within* them, distilling content, not redefining format.

## Risks / unknowns

+ **Lossy in the wrong direction (J-1).** Aggressive compaction could delete rationale that still
  governs the current design, leaving a spec nobody can reason about. _Mitigation: J-1 pins the
  line — delete the *ledger*, keep the *living why*; the pilot is reviewed before the skill ships._
+ **New mechanism that doesn't earn its place (J-4).** A skill that's run once and forgotten is
  ceremony. _Mitigation: name the trigger + the brake; if the pilot shows compaction is a rare
  one-off, the honest output may be a documented *procedure* + a one-time sweep, not a standing skill._
+ **Order wrong ⇒ rework (J-2).** _Mitigation: that's the pilot's whole job — settle it on `queries/`
  before codifying._

## Do

### Plan-gate ratification (2026-06-16)

+ **Goal ratified** (user): open the design-compaction theme — distill the design corpus to
  latest-state ("source code, not history") + author a `design-compaction` skill, proven by a
  **pilot on `queries/`**. The corpus-wide sweep is the feeds-into (R82+).
+ **New gate on the canvas build ratified**: it waits until the corpus is compacted to a final
  current-state version of all current screens — stacked on R80 J-2's unfired trigger.
+ **J-1…J-6 held open** for the Design gate; the headline pair is **J-1 (latest-state boundary)**
  and **J-2 (compaction order)**, the latter settled empirically by the Build-gate pilot.
+ **`flow-selector` N/A recorded** — Track-2 skill-authoring + a doc distillation, no product
  contract/BE/FE to gate (same as the `flow-selector`/`gate-walker`/`ui-design` authoring rounds).

### Design-gate resolution (2026-06-16)

+ **J-1 → latest-state boundary = "source code, not history".** The keep/delete line, with one
  test: _"would this line still be written if the screen were built fresh today, knowing nothing
  of how we got here?"_
  + **KEEP**: current surface-declaration table, current layout/behavior/states, current token
    map, current scope boundary, **and the living rationale that explains *why the current shape
    is the way it is*** (the "why one feature, not two" kind — an explanatory comment a fresh
    reader needs). De-attributed: stated as current design rationale, not "R23 decided…".
  + **DELETE → git/rounds/memory own it**: dated round-stamps (`R30 stamp`, `R32 stamp`,
    `R33 stamp`), `shipped R24–R26`, test counts (`54/54 backend tests pass`), per-round decision
    attribution (`R23 HIxAI Q1`), the round-by-round implementation-chain narration, and any
    superseded intermediate state.
+ **J-2 → compaction order = dependency-smart, SPINE-FIRST (not newest→oldest).** Rationale: the
  *newest* doc in a cluster is usually a **leaf mode** (`canvas.md` is newest in `queries/` but
  sits on top of the model), so compacting newest-first re-derives the model from a derived doc ⇒
  rework — exactly the failure the user flagged. Order: **(1)** establish the canonical
  **spine** = the noun/model docs (for `queries/`: [saved-query.md](../../design/data-management/queries/saved-query.md)
  + the joins-tree model in [multi-join.md](../../design/data-management/queries/multi-join.md)/
  [joins.md](../../design/data-management/queries/joins.md)); **(2)** fold the verb/mode docs
  (query-construction, query-builder, composition, canvas) onto the spine in dependency order.
  **Recency is only a tiebreaker** within one dependency layer (the newer statement of the *same*
  surface usually reflects current truth). The Build-gate pilot **confirms** this order empirically.
+ **J-3 → output shape = noun-spine doc + thin mode siblings + a cluster index** (per-cluster
  judgment, this default). Maps the noun-vs-mode brake (R80) onto the file layout: a cluster
  collapses to **(a)** one canonical **spine doc** = the model + its "reason set" of operations
  (crud-hygiene's verb-set-across-consumers is the exemplar), **(b)** **mode sibling docs only
  where a mode carries distinct surface/affordance content that would bloat the spine** (e.g.
  `canvas.md` stays a sibling per R80), **(c)** a short cluster index listing the reason set +
  pointing at spine + modes. Bar for a surviving mode doc: _folding it into the spine would push
  the spine past readability._ `queries/` 7 → spine + ≤2 modes + index (pilot sets the exact count).
+ **J-4 → procedure-checklist skill** (judgment-heavy, like [`ui-design`](../../skills/ui-design/SKILL.md)/
  [`research`](../../skills/research/SKILL.md)), **not** a mechanical script — the keep/delete (J-1)
  and spine/mode (J-3) calls need judgment a regex can't make.
  + **Trigger** (human-invoked, no auto-sweep — README precedent): a cluster crosses a smell
    threshold — **(a)** one concept spread across **≥3 docs**, or **(b)** a doc carries **≥2**
    dated round-stamps / `shipped RNN` / test-count lines. Recommended cadence: run as the
    **closing step of any round that adds a 3rd+ doc to a cluster** (catch fragmentation at birth).
  + **Brake** (earns its place / avoids re-bloat): the skill is the periodic **GC**; the durable
    convention "**design docs are source code, not history**" (promote from this round) is the
    discipline that stops garbage re-accumulating (future rounds **re-distill in place**, never
    append a stamp). **Watch-item**: if the pilot shows compaction is a genuine one-off, the
    honest output is a *documented procedure + a one-time sweep* — **don't ship a standing skill**
    (a skill run once is ceremony). Decided at Build, from pilot evidence.
+ **J-5 → consolidate docs (doc↔doc) primary; light doc↔code spot-check secondary.** The skill
  (1) distills to current-state, (2) **spot-verifies the single highest-risk current-state claim
  per cluster against the shipped FE/contract** (the audit program's proven depth —
  [design-corpus-audit](../programs/design-corpus-audit.plan.md) § "doc-conformance + spot-verify"),
  (3) **hands deeper drift to [`ui-design`](../../skills/ui-design/SKILL.md) fidelity mode** as a
  follow-up rather than fixing inline. Not a full fidelity audit (brake — that's `ui-design`'s job).
+ **J-6 → R81 = author skill + pilot `queries/` only; full sweep = R82+ rounds, NOT a program
  (yet).** A program is justified only if the sweep needs cross-round governance + a rolling
  gap-log (why the audit program existed). Decide round-series-vs-program at **R82 planning**, from
  the post-pilot picture (cluster count + rubric-sharing) — don't pre-create program structure
  (Evolution Rule).

**Skill spec (outline — full authoring is the Build gate):** `design-compaction`, **dependent**
skill, `argument-hint: <cluster-dir>`. Procedure: **(1)** map the cluster's docs → classify each
as spine (noun/model) vs mode (verb/surface) vs index; **(2)** order spine-first (J-2); **(3)**
distill each into the canonical spine applying the J-1 keep/delete test, organizing by reason set
(J-3); **(4)** keep a mode doc only if it'd bloat the spine; **(5)** spot-verify the top current-
state claim against shipped code (J-5); **(6)** write the cluster index; **(7)** repair inbound
links with [`markdown-check-link --fix`](../../skills/markdown-check-link/SKILL.md); **(8)** run
`design:lint`/`design:tokens`/`markdownlint`. Verifies/distills — the human reviews the pilot
output before the skill is declared shippable.

**`ui-design` (design-spec)** — **deferred to the Build gate**, run against the *pilot's distilled
spine doc* (the round's actual UI design output), not against the skill (a skill is not a UI
surface). Recorded here so the Design-gate UX check isn't silently skipped.

### Build-gate course-correction + workspaces pilot (2026-06-17)

+ **Course-correction (user).** The primary axis is **doc↔code sync**, not doc↔doc merge: the
  design corpus must be the **current-state spec of each domain's actual implementation**
  (3 domains — `workspaces`, `datasets`, `queries`), and **the code is the source of truth**.
  The deliverable is a **`design-sync` skill** that re-runs on any `design/<domain>`; the pilot
  domain is the **simplest, `workspaces`**. The earlier "compaction" framing + the `queries/`
  spine draft were **reverted** (wrong domain; doc-sourced, not code-verified). The J-1 keep/delete
  boundary and the J-2 spine-first order survive as the skill's compaction step; J-5 (code-sync) is
  **promoted from secondary to primary**.
+ **CODE TRUTH established** (delegated read of the real backend / contracts / frontend) and the
  **drift report** produced — `workspaces.md` was frozen at R13 while the code moved on:

  | Doc said (R13-frozen) | Code does (truth) |
  | --- | --- |
  | "read-only + create-stub" | full CRUD: `GET`/`POST`/`PATCH`/`DELETE`, `409 name_taken`, `409 non_empty` + `datasetCount` |
  | in-memory `_WORKSPACES = []`, "real persistence deferred R14+" | SQLModel table + Alembic (`0001`), raw `sqlite3` in handlers |
  | `WorkspaceCard` is a generic `@mdd/ui` plain-UI primitive | `WorkspaceCard` is **feature-local** with a Relationships/Rename/Delete overflow menu |
  | card click → `/workspaces/<id>` (stub) | card click → `/data-management/datasets?workspace=<id>`; no detail page |
  | "open question: ListCard naming" | resolved — stayed feature-local |
  | (no mention) | `name` is **globally unique**; rename/delete invalidate `['workspaces']` + `['datasets']` |

+ **`workspaces.md` re-synced + compacted** — rewritten to the code truth (372 → ~205 lines),
  ledger removed (R11/R13 stamps, HIxAI Q&A, lifecycle, in-memory/stub narration, deferred-items
  that shipped). Gates green: `design:lint` 0, `design:tokens` 0, `markdownlint` 0,
  `markdown-check-link` 0. _No de-fragmentation needed — workspaces is 2 distinct docs
  (workspace noun + relationships), not a split concept._
+ **`design-sync` skill authored** — [SKILL.md](../../skills/design-sync/SKILL.md) + the
  `.claude/skills/` pointer + the [skills README](../../skills/README.md) index. Procedure:
  inventory domain ↔ code → build the CODE-TRUTH map (delegable) → diff into a drift report →
  reconcile each doc to the code applying the keep/delete boundary → de-fragment spine-first only
  if a concept split (redirect-stub on merge for locked round-file links) → link-repair + gate.
+ **J-4 watch-item resolved → standing skill** (not a one-off): the drift is large and **recurs
  every time code evolves ahead of the doc**, and the procedure is identical per domain — so a
  reusable skill earns its place. The brake: code-as-truth bounds it (it reconciles, can't invent)
  and the *source-code-not-history* convention stops re-bloat; a domain kept in-sync round-by-round
  won't need it.
+ **`flow-selector` N/A** re-affirmed (Track-2 skill + doc work, no product contract/BE/FE).
  **`ui-design`** not run — `workspaces.md` is a code-true distillation of a shipped surface, not a
  new UX design; affordance fidelity is the shipped app's, already covered by its build rounds.

## Check

+ [x] **`design-sync` skill** authored ([SKILL.md](../../skills/design-sync/SKILL.md) + pointer +
      README index), code-as-truth procedure + drift report + keep/delete boundary + spine-first +
      brake all specified.
+ [x] **`workspaces.md` re-synced to the code** and compacted; the drift report (doc↔code) recorded
      in Do; all gates 0.
+ [ ] **Human sign-off** — the doc↔code-sync principle + the `design-sync` skill + the workspaces
      pilot output (Complete = signed-off). _Review `workspaces.md` against the running app / code._

## Act

**Learnings**:

+ **The drift is doc↔code, and it is large.** `workspaces.md` was a faithful record of R13 and a
  fiction about today — "read-only + create-stub / in-memory" vs shipped CRUD + SQLModel/Alembic.
  Compacting doc→doc (the first framing) would have polished the fiction; only **code-as-truth**
  catches it. The user's correction reframed the whole round.
+ **Spine-first / keep-delete survive as the *compaction* step**; the *sync* step (build a CODE
  TRUTH map, diff, reconcile) is the new heart. The drift report is worth emitting as evidence.
+ **A standing skill is justified** (J-4): drift recurs whenever code outpaces the doc, and the
  procedure is domain-identical — `design-sync` re-runs on `datasets` and `queries` unchanged.

**Promotions**: the durable principle **"design docs are source code, not history — synced to the
implementation"** is now encoded in the [`design-sync` skill](../../skills/design-sync/SKILL.md);
not separately promoted to `context/` (the skill is its home). A one-line memory captures the
round's reframe for future recall.

**Follow-ups (not promotions, just notes):**

+ R82+ — run `design-sync` on the remaining `workspaces` doc ([relationships.md](../../design/data-management/workspaces/relationships.md))
  and the `datasets` + `queries` domains (the latter is also fragmented — 7 docs — so it exercises
  the de-fragmentation step the workspaces pilot did not need).
+ The canvas **build** stays gated behind a synced corpus (the added R81 gate) + R80 J-2.

## Feeds into → the full-corpus design-sync sweep (R82+)

A proven `design-sync` skill + the workspaces pilot. R82+ re-run the skill on every remaining
domain (`workspaces/relationships.md`, `datasets/`, `queries/` — the last also exercises the
de-fragmentation step, being split 7 ways) so the whole `design/` corpus is synced to the actual
implementation and ledger-free. When the corpus is synced, the **canvas build** gate (R80 J-2 +
this round's added "synced-corpus-first" gate) re-opens against a corpus that matches the code.
