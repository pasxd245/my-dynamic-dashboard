# Round 173: the walk artifact graduates — an agent-private file becomes a repo rule

**Status**: Complete — signed off by the human 2026-08-15 (_"Sign-off, please proceed"_). The
round's own rule was **revised by the human mid-round**: the walk shipped unconditional, they
asked whether it always applies, and the trigger condition that answer produced is the round's
headline learning.
**Flow**: governance round — **D + artifact + I**. No C/B/F: no product code, no wire, no UI, so
the `flow-selector`'s five conditions read vacuously **no**. Recorded rather than run, per R172's
precedent of naming the deviation instead of backdating the gate.
**Date started**: 2026-08-15
**Date completed**: 2026-08-15

## ⟢ At a glance

**Shipped** — **the acceptance-walk artifact now has a repo home and a repo rule.** Five lines in
[`plan/PDCA.md`](../PDCA.md) § Round Template (always record questions + ⬜ + `coverage: N of M`;
spec exact steps only on ask; **count follows the surfaces**), a
[memory file](../../memory/2026-08-15-walk-record-always-spec-on-ask.md) carrying the why and the
four-instance dogfood ledger, and a [`promotions.md`](../promotions.md) entry for sign-off. The
rule was **dogfooded on this round itself, and the dogfood refuted its first draft** — see Studied.

**Studied** _(predicted → saw → now believe)_ — **predicted** a two-file graduation closing four
dangling citations. **Saw** three things, in rising order of importance. (1) Both of R171's
handoff claims were wrong as written: the `promotions.md` entry it reported as *"Logged"* did not
exist, and the dangling-slug problem is **42 slugs, not 1**. (2) A tool default — `rg` skipping
hidden dirs — returned a confident, wrong "zero matches". (3) **The rule shipped unconditional,
and the very first round to apply it over-applied it**: this governance round has no exercisable
surface, so its three "walk questions" were a document review wearing a walk's format. The human
refused it on read.

**Now believe (high confidence)**: a governance artifact's **trigger condition is part of the
artifact**, and it is the part imitation cannot carry — five rounds of hand-use transmitted the
question format faithfully and never once transmitted *when the format applies*, because every one
of those five rounds happened to qualify. **Medium confidence** on the general form: a handoff
paragraph is a *claim about repo state*, not a record of it — the same shape R172 named for
runtime behaviour, one layer out into the doc corpus.

**Watch**

- **41 of 42 dangling `[[slugs]]` remain.** This round closes exactly one. The cause is
  structural — most `[[…]]` cite the agent's private memory (47 files) which the repo (27 files)
  cannot resolve. Recorded, deliberately not fixed (§ Explicitly NOT).
- **`rg` skips hidden directories, and `.agents/` is hidden.** Every `rg` over the agent OS
  without `--hidden` is a silent false negative. It produced one in this round.
  [`context/tools.md`](../../context/tools.md) is human-maintained — flagged, not edited.
- **The PDCA rule points at the memory file by inline path, not a markdown link**, because the
  Round Template is *copied* into `cycles/` where a relative link would break. A link checker
  cannot validate it.
- **No lint guards the new rule.** Deliberate, per `adopt-artifact-defer-enforcement`.

## Goal

**Inherits from ← [Round_172](Round_172.md)**, whose § Feeds into records the human's declared
sequence for 2026-08-15: R172 → **this graduation** → a workflow deep-dive.

The acceptance-walk artifact has been hand-used for five rounds and is over the Evolution Rule's
bar — four instances (R165 · R166 · R167 · R171), four domains, **none refuted**. But its entire
spec lives in an agent-private memory file the repo cannot read. Give it a repo home and a repo
rule, so it stops travelling by imitation.

_Track: 2 (agent-method). Pulled by: R171's count anchor + four round files citing an
unresolvable slug — per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: the rule is stated once where round authors will meet it, the evidence
lives in the repo, and the promotion is logged for sign-off. No product code, no lint.

**Falsified if**: the measured evidence contradicts the pre-agreed shape — i.e. the artifact
turns out to be already-documented, or the graduation cannot close the citations it was scoped
to close.

> **It fired, partially.** The graduation closes **1 of 42** dangling slugs, not "the four
> citations" the plan implied. The shape survives; its stated *reach* did not.

### D — the design gate

- [x] **Where does the rule live** → `plan/PDCA.md` § Round Template, **not** `skills/`. A skill
      could verify a walk was *recorded*; it cannot verify its *return* was read, and the return
      is the entire value. Pre-agreed at R171, re-confirmed here.
- [x] **The count wording** → **"count follows the surfaces"** (human's call, 2026-08-15). Names
      the anchor explicitly so the next round does not re-inherit five by imitation.
- [x] **Link style inside the Round Template** → **inline code path, not a markdown link.** The
      template is copied verbatim into `cycles/Round_NN.md`, one directory deeper, where
      `../memory/…` would resolve wrong. A broken link in every future round file is a worse
      failure than an unvalidatable path string.
- [x] **Scope of the slug fix** → **close one, record 41** (human's call). Widening to a
      convention or a `[[…]]` linter was offered and declined this round.
- [x] **Dogfood the new rule on this round** → yes, **and it failed the dogfood.** Three surfaces
      touched → three questions (the first non-five count in the series, which is what the test
      was for). But the human read them and asked whether a walk is always required — it is not,
      and the rule did not say so. **Revised at the human's challenge**: the item now carries a
      trigger condition (*rounds that change something a human can exercise*) and requires an
      explicit **skip + reason** otherwise, mirroring the phrasing the visual-verification gate
      in [`PDCA.md`](../PDCA.md) already uses. This round's own walk is now a logged skip.

### Explicitly NOT in this round

- **A `[[…]]` linter.** It would fail on 42 slugs immediately and so needs a migration decision
  first. `adopt-artifact-defer-enforcement`: a presence-lint cannot enforce content quality.
- **A wikilink convention** (when may a round cite private vs repo memory). Offered, declined —
  recorded as the successor question.
- **Editing `context/tools.md`** to add `--hidden` to the `rg` row. `context/` is human-maintained
  and agent **read-only** per [governance.md](../../context/governance.md); flagged in § Do.
- **Backfilling the walk block into rounds before R165.** Same call as the ⟢ At a glance block.

## Risks / unknowns

| Risk                                                                | Why it matters                                                            | Handling                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **A governance round that only moves words.** | The artifact already worked; relocating it could be pure ceremony. | The test is whether it stops the *accidents* — the count anchor is named in the rule itself, and this round's own walk uses 3, not 5. |
| **The rule is written where nobody reads it.** | PDCA.md is long; a 5-line item can be skipped as easily as an imitated one. | It lands **inside `## Check`**, the block a round author must fill to close — not in prose above it. |
| **Over-widening into a link-integrity round.** | 42 dangling slugs is exactly the shape that invites "while we're here". | Human ruled scope at the D gate. The 41 are **recorded** in § Feeds into, not absorbed. |

## Do

**Built** — three artifacts, no code:

1. **[`plan/PDCA.md`](../PDCA.md) § Round Template `## Check`** — a 5-line acceptance-walk item.
   Always record questions + ⬜ + `coverage: N of M`; spec exact steps only on ask; count follows
   the surfaces; relocate from acceptance criteria / Risks; drop what a test closes.
2. **[`.agents/memory/2026-08-15-walk-record-always-spec-on-ask.md`](../../memory/2026-08-15-walk-record-always-spec-on-ask.md)**
   — the why + the four-instance ledger (R165 six defects incl. the latent W-7 pager bug · R166
   header order · R167 canvas layout · R171 the silent Save), R168's skip kept as the
   counter-example, and R171's two late findings (the count anchor; a verdict can arrive globally
   and has a third state — "fixed, UNWALKED" is neither PASS nor FAIL).
3. **[`promotions.md`](../promotions.md)** — the sign-off entry, per
   [governance § Explicit Human Instructions](../../context/governance.md).

### Two handoff claims measured false before starting

R171 § Feeds into is a *claim* about repo state. Both halves failed:

| R171 said                                                     | Measured 2026-08-15                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| *"Logged in `promotions.md` for human sign-off"*               | **No entry existed.** Last entry was 2026-06-14; zero 2026-08 entries. Written by this round. |
| *"four round files cite … a slug the repo cannot resolve"*     | True but **under-scoped**: **51** distinct `[[slugs]]` repo-wide, **9** resolve, **42** dangle |

The 16 citations of `walk-record-always-spec-on-ask` across R166/R167/R168/R171 are confirmed and
are now resolvable. The other 41 slugs are not, and this round does not touch them.

### A method finding: `rg` is a false-negative machine over `.agents/`

The first sweep for `[[…]]` returned **zero matches** — which reads as proof the citations do not
exist. Cause: **`rg` skips hidden directories by default and `.agents/` is hidden.** The
prefer-`rg` row in [`context/tools.md`](../../context/tools.md) carries no `--hidden`. This is
`a-wrong-validator-hides-breaks-both-ways` one layer out: R170 fixed a checker's slug bug, but a
tool default silently scoping a sweep to nothing is the same class of harm and is not owned by
any checker. **Flagged for a human edit to `context/`; not edited.**

## Check

- [x] **`pnpm md:lint`** — **0 errors** across 319 files.
- [x] **`pnpm plan:lint`** — **0 errors across 173 rounds** (Round_173 included).
- [x] **`pnpm check:links`** — **8 broken, unchanged from baseline.** Measured, not assumed: the
      changes were stashed (`git stash -u`), the checker re-run, and the count was **8 both
      ways**. All 8 predate this round (Round_152 → a deleted `ColumnsManager.tsx`; Round_76/77 →
      headings removed when composition retired at R166/R167 and when R169 compacted the corpus)
      — i.e. `compacting-a-doc-can-manufacture-link-rot`, already on the record. **Not fixed
      here**: they belong to the append-only round log, which that lesson says not to rewrite.
- [x] **The 16 citations now resolve** — `2026-08-15-walk-record-always-spec-on-ask.md` matches
      the slug cited by R166/R167/R168/R171.
- [x] **⟢ At a glance Studied line written.**

### Acceptance walk — `coverage: n/a — SKIPPED, no human-exercisable surface`

**Explicit skip + reason, which is the rule this round shipped.** A governance round changes three
markdown files; there is no UI surface and no observable product behaviour to exercise, so a walk
has nothing to put a human in front of. The guard here is the **document review** below plus the
three lints — the same complement R172 demonstrated from the other side, where an engine-only
round was guarded by **measurement at 400k rows** and a walk would have found nothing.

**This skip is the round's sharpest finding.** The rule's first draft made the walk unconditional,
and the first round to apply it — this one — over-applied it: three "read this document" questions
were written and are a **review**, not a walk. The human caught it by asking _"không phải lúc nào
cũng cần đúng ko?"_. The wording now carries a trigger condition, and this section is the
counter-example that produced it. See § Act.

**Document review** _(not a walk — no ⬜ verdicts, no coverage count; a reader check before
sign-off)_:

- [`PDCA.md`](../PDCA.md) § Round Template `## Check` — does the 6-line item tell a round author
  when the walk applies, how many questions to write, and that a skip must be logged?
- [The memory file](../../memory/2026-08-15-walk-record-always-spec-on-ask.md) — does the
  four-instance ledger justify keeping the artifact?
- [`promotions.md`](../promotions.md) — does the entry state what changed, and on whose
  authority, accurately enough to sign?

## Act

**Learnings**:

- **A rule's trigger condition is the part imitation cannot carry.** Five rounds of hand-use
  transmitted the walk's question *format* perfectly and its *applicability* not once — because
  all five happened to qualify. A dogfood ledger only records the cases that fired, so it is
  structurally blind to over-scope. The first round where the trigger mattered is the round that
  wrote the rule, and it got it wrong. **Write the "when does this NOT apply" clause first**;
  it is the clause no amount of successful hand-use will produce.
- **The human read the artifact and refused it in one question.** That is the graduation's own
  acceptance test passing — not the walk, the *reading*. It also re-earns the R171 claim this
  round is built on: a return can arrive outside the frame of anything you asked.
- **A handoff paragraph is a claim, not a record.** R171 wrote *"Logged in promotions.md"* and
  nothing was logged. R172 already named this shape for runtime behaviour — *"a claim about
  runtime behaviour is not established by reading the code"* — and it holds identically for
  claims about the doc corpus. Two commands measured it.
- **A tool's default can scope a sweep to nothing and look like an answer.** The `rg`/`--hidden`
  false negative was indistinguishable from a true "zero matches" until cross-checked against a
  file I had already read with my own eyes.
- **Graduating an artifact re-measures its problem.** The reach was 42× the scoped one. The
  graduation was still right; its stated justification was not.

**Promotions**:

- [x] → `plan/PDCA.md` : the acceptance-walk rule (logged in [`promotions.md`](../promotions.md))

_Not promoted this round_: nothing to `context/` or `skills/`. A `--hidden` row for the `rg`
default is **proposed** for a human edit to [`context/tools.md`](../../context/tools.md) — agents
are read-only there. Deliberately **not** a skill: a check can verify a walk was *recorded*, not
that its *return* was read, and the return is the whole value.

**Follow-ups (not promotions, just notes):**

- The 41 remaining dangling slugs + whether a `[[…]]` convention or lint is wanted.
- `context/tools.md` prefer-`rg` row should carry `--hidden` (human-owned file).

**Prune check**: nothing pruned. The five-question *habit* is retired by naming it, which is the
cheaper move than a rule forbidding it.

## Feeds into → Round_174 (TBD)

**Next in the human's declared sequence ([R172 § Feeds into](Round_172.md)): a workflow
deep-dive.** R168 left it defined but thin — *consolidate + materialize, frozen permanently* —
and R172 left two live threads on it: a workflow's row **order** differs from its source query
(file order vs R165 W-7's total order), and **upstream staleness** (editing a source query does
not invalidate a workflow's frozen output; only a `PUT` on the workflow does).

**Recorded, not carried**: the 41 dangling slugs; the `rg --hidden` row for `context/tools.md`;
and from R172/R171 the UI cluster still queued for the human's planned UI round (catalog
row-actions convention, R167 W-1 canvas layout persistence, the two `onError`-less sibling
mutations — query delete and Duplicate's create).

## Governance

This round modified authoritative knowledge under `.agents/plan/` (`PDCA.md`, `promotions.md`).
The human was warned before the writes and confirmed the scope on 2026-08-15 ("ship as specced");
the change is logged in [`promotions.md`](../promotions.md) per
[governance § Explicit Human Instructions](../../context/governance.md). `context/` and `skills/`
were **not** touched — the one `context/` change this round identified is proposed for a human
edit, not made.
