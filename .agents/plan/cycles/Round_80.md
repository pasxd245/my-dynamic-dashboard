# Round 80: Open the canvas theme — design the free-form visual source-graph canvas

**Status**: Planning
**Date started**: 2026-06-16
**Date completed**:
**Flow**: **Design-only** (a theme-opening design round). This round produces the **canvas
design** and resolves its judgment calls; it ships **no build**. `flow-selector` (DCFBI vs
DFCFBI) is therefore **deferred to the first build round** (R81+) — there is no contract/BE/FE
code to gate here. Gates this round: **Plan → Design**, then Complete at the Design gate
(Complete = the design direction is human-signed-off).

## Goal

**Inherits from ← [Round_79](Round_79.md)** — a Query's driving source is now the single
polymorphic `sourceId` (`ds_`/`qr_`), `datasetId` retired. R79 unified the source field
**specifically so the canvas reads/writes one source, not two** ([Round_79 § Feeds into](Round_79.md)).
This round also inherits the named **canvas deferral**: the *free-form visual source-graph canvas
(drag nodes / draw edges)* has been deferred since R74 (J-1′) under the trigger **"until the
hop-list stops scaling"** ([multi-join.md § Scope](../../design/data-management/queries/multi-join.md),
[query-builder.md trajectory](../../design/data-management/queries/query-builder.md)).

Open the **canvas theme** with a **Design round**: specify the free-form visual source-graph canvas
(datasets + saved queries as nodes, governed relationships as edges) and the standalone **"New
query"** entry it implies, anchored on the unified `sourceId` + the existing `definition.joins`
tree model — **and validate whether the canvas is warranted now**, since its trigger has not
clearly fired. The deliverable is an **accepted canvas design doc + resolved judgment calls**, not
code. The build is one or more **later rounds (R81+)**.

_Track: 1 (product feature — design). Pulled by ← the post-MVP roadmap (the canvas is the next
feature theme after the R78 foundation + R79 cleanup) and the named canvas deferral in
[multi-join.md](../../design/data-management/queries/multi-join.md) /
[query-builder.md](../../design/data-management/queries/query-builder.md) — per
[Evolution Rule](../../AGENTS.md)._

## Judgment calls (held open for the Design gate)

| #   | Question | Why it's the crux |
| --- | -------- | ----------------- |
| J-1 | **Noun or mode?** Is the canvas a **new surface/noun** or a **new MODE of the existing `query-construction` builder** (the hop-list `JoinEditor`)? | The domain's **reuse invariant** says reuse beats parallel pages, and the **noun-vs-mode** brake fires here first. A "canvas page" that re-implements the builder is the discarded-R69 sin; a canvas *mode* of the builder is the likely-right answer — but the design must justify it. |
| J-2 | **Has the trigger fired?** Does the hop-list editor actually **stop scaling** at today's tree sizes, or does it still suffice? | The deferral trigger is "until the hop-list stops scaling" — **unfired** per R79. This Design round must produce an honest **build-now vs defer-the-build verdict** with evidence (concrete hop-list pain), so we **don't MVP-rush a roadmap-home surface**. A design round is the cheap, revertible way to decide. |
| J-3 | **Model impact?** Is the canvas **purely an FE editing surface** over the existing `definition.joins` (tree) + `sourceId`, or does it **re-open the contract/data model**? | Determines the build flow (F-only DCFBI vs a contract re-open) and whether the canvas is **discovered from the existing model** (not imposed anew). R74 already stores a connected acyclic **tree**; the canvas may be just a new *view/editor* of that same tree. |
| J-4 | **Standalone "New query" entry.** Where in the IA does an **empty-canvas "New query"** start, vs today's source-rooted entries ("Save filters as Query" from a dataset; "Build on this query")? | The canvas implies starting from *no* source and picking nodes — a genuinely new entry point. Its home must reuse the Queries-catalog IA, not stand up a parallel surface (the **noun-vs-mode** brake again). |
| J-5 | **First-build scope (if build proceeds).** What is the **thinnest honest first canvas** vs the full node-graph editor? | Reconcile *don't-MVP-rush a roadmap-home surface* (do it right) with YAGNI. The design names the build's phasing so R81+ rounds inherit a clear, thin-but-not-rushed first slice. |

## Plan (by gate)

1. **Plan gate** — ratify J-0 (**open the canvas theme as a Design round**; build deferred to
   R81+); record J-1…J-5 held open. Commit the round file (Plan seam). _(This step.)_
2. **Design gate** —
   + Resolve **J-1…J-5**; the headline is the **noun-vs-mode verdict** (canvas as a *mode* of the
     existing builder unless a new surface is justified) and the **trigger verdict** (build-now vs
     defer, with evidence).
   + Author the **canvas design doc** — a new `canvas.md` under
     [`data-management/queries/`](../../design/data-management/queries/) (or an extension of
     `query-builder.md`'s trajectory if J-1 lands "mode"), to the design-doc format conventions
     (status vocab · Surface-table Reusability/Purity · token map if any · scope boundary ·
     acceptance criteria).
   + Run **`ui-design` (design-spec mode)** against the design doc (does it *declare* the canvas's
     affordances across the six facets); **`design:lint`** (+ `design:tokens` if a token map) 0.
   + **`flow-selector` is deferred** to the first build round (no build here); record that
     explicitly in the Do log.
   + Commit the Design seam. **The round Completes at the Design gate.**

## Acceptance criteria

+ [ ] **J-0 ratified**; **J-1…J-5 resolved** at the Design gate.
+ [ ] A **canvas design doc** exists and is **Accepted**, carrying: the **noun-vs-mode** verdict,
      the **model-impact** verdict (FE-only over the existing tree vs a contract re-open), the
      **standalone "New query"** IA, and the **trigger verdict** (build-now vs defer + the evidence).
+ [ ] **`ui-design` design-spec** facets pass on the design doc; **`design:lint`** 0
      (+ **`design:tokens`** 0 if the doc has a token map).
+ [ ] Gates green: **`plan:lint`** 0, **`markdownlint`** 0, **`markdown-check-link`** 0.
+ [ ] **Complete = human-signed-off on the design direction** (the canvas concept + the build-now/
      defer call). **No build ships this round.**

## What is OUT of scope

+ **The canvas BUILD** — any contract/BE/FE code — is **R81+** (or deferred, if J-2 lands "defer").
+ **The consumer-save / workflow / dashboard themes** — later roadmap, their own rounds.
+ **`qr_` on the RIGHT of a join hop** and **the raw-SQL → ORM data-access port** — their own
  named trigger / R78 incremental deferral, untouched here.

## Risks / unknowns

+ **Opening a theme before its trigger fires (J-2).** The canvas trigger ("hop-list stops scaling")
  is unfired. _Mitigation: a Design-only round is cheap + fully revertible, and J-2 makes the
  build-now/defer call explicit with evidence — the round may honestly recommend **defer the build**
  while banking the design._
+ **Noun-vs-mode trap (J-1).** A "canvas page" that re-implements the builder re-commits the
  discarded-R69 parallel-pages sin. _Mitigation: the reuse invariant + the noun-vs-mode brake;
  any new surface must be justified in writing at the Design gate._
+ **Over-design.** Specifying the full node-graph when a constrained first slice suffices.
  _Mitigation: J-5 names the thin-but-not-rushed first build scope; the design doc's scope boundary
  is a hard gate._

## Do

### Plan-gate ratification (2026-06-16)

+ **J-0 → open the canvas theme as a Design round.** Specify the free-form visual source-graph
  canvas + the standalone "New query" entry, anchored on R79's unified `sourceId` + the existing
  `definition.joins` tree; **ship no build** — the build is R81+ (or deferred per J-2).
+ **J-1 (noun-vs-mode), J-2 (trigger fired?), J-3 (model impact), J-4 ("New query" IA), J-5
  (first-build scope)** held open for the Design gate.
+ **Topic chosen** per the user (Round 80 selector): the canvas is the roadmap's next feature theme
  after the R78 foundation + R79 cleanup; opened on roadmap sequence, with **J-2 making the
  build-now/defer call honest** since the "hop-list stops scaling" trigger has not clearly fired.
+ **`flow-selector` deferred** to the first build round — a Design-only round has no contract/BE/FE
  code to gate (DCFBI/DFCFBI is a build-flow choice).

## Check

+ [ ] **J-0 ratified** (Plan gate); **J-1…J-5 resolved** (Design gate).
+ [ ] **Design gate closed** — canvas design doc Accepted; noun-vs-mode + model-impact + "New
      query" IA + trigger verdict recorded; `ui-design` design-spec pass; `design:lint`/
      `design:tokens` 0; `flow-selector` deferral recorded; committed as the Design seam.
+ [ ] **Human sign-off** — the design direction + the build-now/defer call (Complete = signed-off).

## Act

_Pending — filled at round close._ The intended outcome: an **accepted canvas design** anchored on
the unified `sourceId` + the existing `joins` tree, with the noun-vs-mode and build-now/defer calls
made on evidence — so the first canvas **build** round (R81+) inherits a clear, thin-but-not-rushed
home instead of re-deriving the IA, or so the build is honestly deferred with its trigger restated.

## Feeds into → the first canvas build round (R81+, TBD)

A resolved canvas design + a build-now/defer verdict. If **build**: R81+ inherit the noun-vs-mode
home, the model-impact decision (which sets their flow — likely FE-heavy DCFBI over the existing
tree), the "New query" IA, and the J-5 first-slice scope. If **defer**: the design is banked and the
canvas trigger is restated for a future round. Either way the **consumer-save** and **dashboard**
themes downstream read a single, canvas-clean `sourceId` source model.
