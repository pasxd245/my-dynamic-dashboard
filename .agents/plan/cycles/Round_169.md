# Round 169: the design corpus re-synced — nine docs and the ledger they accreted

**Status**: Planning — **scoped, not ranked** (see § Standing, not next)
**Flow**: _(set at the Design exit via `flow-selector` — but see § This round ships only documents)_
**Date started**:
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_167](Round_167.md)** — R167 ran `design-sync` over the **four** docs whose
code it changed (`queries.md`, `canvas.md`, `workflows.md`, `_noun-model.md`) and stated, rather
than implied, that the rest of the domain was untouched. That statement is this round's whole
inheritance: the backlog is **named and bounded**, not discovered.

**Seeded from ← the human's scope call, 2026-08-14.** Raised as an open call at R167's close and
answered: the remaining corpus is **its own work**, deliberately **not** folded into
[`Round_168`](Round_168.md) — the last round of
[`query-shaping-surface`](../programs/query-shaping-surface.plan.md), which has no successor to
absorb overflow.

**What this round is for**: every product round in this repo takes a design-corpus doc as its
D-gate artifact ([[d-gate-artifact-in-design-corpus]]). Nine of them currently answer a reader in
the voice of a **round ledger** rather than a **current-state spec** — which is the failure
[[design-docs-are-source-code]] names. The work is to make them answer as specs.

_Track: 2 (agent-method — the design corpus is where the D-gate artifact lives; keeping it
current-state is method upkeep and changes no product behavior). Pulled by: R167 § Not done, and
the human's scope call of 2026-08-14. Artifact-only, inside the
[R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md)._

## Plan

**Expected outcome**: the nine docs below read as current-state specs — code-true, ledger
stripped — and the `data-management` domain carries **no** `design-sync` backlog.

**Falsified if**: the `--check` pass finds the docs are largely **already code-true** and the
backlog is purely cosmetic ledger accretion. That would not be nothing, but it is a **different and
much smaller** round than this one is scoped as, and it should be re-scoped rather than executed at
this size.

### Two problems, measured separately — the scope call turns on which one this is

R167 reported the backlog as **"~286 round-stamps"**, which is a measure of **ledger accretion**.
That is not the same axis as **doc↔code drift**, and the `design-sync` skill separates them by
design: `--check` detects drift and stamps an `OUT-OF-SYNC` marker; the default sync mode
reconciles **and** compacts.

| Axis                          | What it means                                                 | Measured?                                     |
| ----------------------------- | ------------------------------------------------------------- | --------------------------------------------- |
| **Doc↔code drift**            | The doc claims something the code does not do                 | **NO — unmeasured.** `--check` is step 1.     |
| **Ledger accretion**          | Round-stamps, test counts, "shipped RNN", as-built deltas     | **YES — 325 stamped lines across nine docs.** |

**R167 said these docs are "not made untrue by this round"** — which is a claim about R167's own
blast radius, **not** a drift measurement. Nobody has run `--check` on them. So the first step is
cheap and it is the one that decides the round's size.

### The nine docs — re-measured 2026-08-14, and the earlier figure was low

```bash
rg -c '\bR[0-9]{2,3}\b' <doc>   # lines carrying at least one round stamp
```

| Doc                                     | Stamped lines | File lines | Share |
| --------------------------------------- | ------------: | ---------: | ----: |
| `datasets/upload.md`                    |       **166** |      2 124 |  51 % |
| `datasets/dataset-filters.md`           |            42 |        839 |  13 % |
| `queries/query-construction.md`         |            39 |        723 |  12 % |
| `datasets/dataset-detail.md`            |            22 |        969 |   7 % |
| `datasets/advanced-query.md`            |            17 |        777 |   5 % |
| `datasets/datasets.md`                  |            15 |        568 |   5 % |
| `workspaces/relationships.md`           |            13 |        455 |   4 % |
| `_shared/crud-hygiene.md`               |             9 |        598 |   3 % |
| `workspaces/workspaces.md`              |             2 |        216 |   1 % |
| **Total**                               |       **325** |      7 269 | 100 % |

**Correction carried forward**: R167 recorded **"8 docs · ~286 stamps"**. The per-doc figure it
published is reproducible (`upload.md` = 166 lines), but the **total and the count are not** — the
domain holds **14** docs, R167 synced **4**, and `_TEMPLATE.md` is not a surface doc, which leaves
**nine**, at **325** stamped lines. `workspaces/workspaces.md` (2 lines) is the one most likely
dropped from the earlier hand-sum. R167 is `Complete` and append-only, so the correction is
appended there rather than edited in.

**`upload.md` is the round.** One doc is **51 %** of the stamped lines and **2 124** lines long —
larger than the other eight put together on the file-length axis too. Any plan that treats the nine
as interchangeable is wrong about this round's shape.

### Suggested shape (not settled — the D gate owns it)

- [ ] **Step 1 — `design-sync --check` over the whole domain**, per sub-folder
      (`datasets/`, `queries/`, `workspaces/`, `workflows/`, `_shared/`). Writes only the
      `OUT-OF-SYNC` marker, never a body: safe, idempotent, and it converts "unscoped" into a
      ranked drift list. **This step decides whether the rest of the round is one sitting or four.**
- [ ] **Step 2 — re-scope against what `--check` returned**, and say so in the Do log. If drift is
      near-zero, the honest round is a **compaction** pass and this file gets rewritten to that
      size (the _Falsified if_ above).
- [ ] **Step 3 — sync, smallest-first**, so the method is calibrated on `workspaces.md` /
      `crud-hygiene.md` before it meets `upload.md`.
- [ ] **Step 4 — `upload.md` as its own slice**, split out deliberately
      ([[split-fragile-subphase]]): 51 % of the backlog, the known site of a canonized defect
      (below), and the one doc where a bad sync pass does real damage.
- [ ] **Gates**: `md:lint` 0/311 · `check:links` at parity with the pre-round baseline ·
      `design:lint` 0/14 · `design:tokens` 0/11. **No product code changes**, which is the
      assertion to verify rather than assume — a `design-sync` that edits code has exceeded scope.

### Explicitly NOT in this round

- **Product code.** Nothing. If a sync finds the code wrong, it produces a **finding**, not a fix
  (see the canonize-a-defect risk below).
- **The `_platform` domain** — measured while scoping and left out on purpose:
  `workspace-shell.md` (27 stamped lines) and `workspace-shell.target.md` (56). **The `.target.md`
  must never be design-synced at all** — it is a deliberate TARGET-not-current doc, so "sync it to
  the code" would destroy the thing it exists to hold. Raised for the human, not assumed.
- **De-fragmenting / merging docs** — the skill's secondary axis (§ 5). Only where one concept has
  split across files, and only if `--check` shows it.
- **The standing product backlog** — R157 UX cluster, naming/legibility, Export ④,
  `[F-prov-reimport-choice]`, AI-propose-key #2, R145 1b, the latent pager risk. None of it is
  here.

### This round ships only documents

The [`query-shaping-surface` firewall](../programs/query-shaping-surface.plan.md) says **no round
ships only documents**, and names the R159→R161 four-week stall — three consecutive code-free
rounds on the same untouched seam — as the failure mode it was built to prevent. **This round is
outside that program and is deliberately doc-only**, which is exactly why it must not be folded
into a product round: a doc-only tail on a feature round is how it goes unmeasured.

So it inherits the risk rather than the exemption, and pays for it with a **timebox**: the F1
timebox of ≤2 working days from
[hybrid-flow-governance](../../decisions/2026-05-28-hybrid-flow-governance.md) is the ceiling for
the whole round. If step 1 says the work exceeds that, the round **splits by sub-folder** rather
than running long.

## Risks / unknowns

| Risk                                                                                                                              | Why it matters                                                                                                                                              | Handling                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A sync pass launders a shipped defect into spec** ([[design-sync-can-canonize-defects]]) — and the recorded instance was **`upload.md`**, this round's biggest doc. | R143 found `upload.md` self-contradictory: one section synced to a shipped bug, another preserving the intent. "Code is truth" gave the bug documentation cover. | The memory's rule is the round's rule: an **inter-section contradiction is a defect signal**. Stop, classify drift vs defect, and log the defect as a finding — never reconcile it silently. |
| **Stripping the ledger destroys rationale.** A round-stamp sometimes carries the only surviving *why*.                            | Compaction that deletes the reason a decision was made trades one kind of untruth for another.                                                              | Rationale worth keeping moves to a decision artifact or a memory entry, cited from the doc. Deleting a stamp is fine; deleting a **reason** is a finding.      |
| **`upload.md` at 2 124 lines may not survive one pass.**                                                                          | The largest doc, the most stamps, and the known defect site — the three risks coincide on one file.                                                          | Its own slice (step 4), after the method is calibrated on small docs.                                                                                          |
| **Doc-only round, no hand-use, no walk.**                                                                                         | The repo's acceptance mechanism is a human at a surface ([[dfcfbi-f1-needs-human-review]]). There is no surface here.                                        | Acceptance is: **a human reads one re-synced doc and says whether it now answers as a spec.** Written at D as a walk question, per the criterion R168 is deciding — one doc, read cold, is a perceivable gesture. |
| **Scope inflation into a corpus-wide program.**                                                                                   | [`design-corpus-audit`](../programs/design-corpus-audit.plan.md) was exactly this shape and ran seven rounds. Default = don't add.                           | One domain, nine docs, one timebox. `_platform` stays out unless the human pulls it in.                                                                        |

## Standing, not next

**This file is a scope artifact, not a claim on the next slot.** The human ranks the successor set
when `query-shaping-surface` closes at R168 — and this round is one candidate in it, alongside the
R157 UX cluster, naming/legibility, Export ④, `[F-prov-reimport-choice]`, AI-propose-key #2 and
R145 1b.

It carries the number **169** because that is where it sits today. If the human ranks another item
first, this file **renumbers** — the precedent is the program plan's own renumbering of
2026-08-10. The number is bookkeeping; the scope is the point.

## Do

_(empty — Planning)_

## Check

_(empty — Planning)_

## Act

_(empty — Planning)_

## Feeds into → not pre-decided

A corpus that answers as a spec is worth having for the round **after** it — whatever the human
ranks next designs on these docs. That is the whole return.
