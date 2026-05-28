# Round 46: Brainstorm-housing convention — `.agents/plan/brainstorms/`

**Status**: Complete
**Date started**: 2026-05-28
**Date completed**: 2026-05-28

## Goal

**Inherits from ← (no direct artifact handoff from R45)** — R45
(MSW validator coverage) is the immediate predecessor but not
artifact-dependent; R46 opens a new Track-2 thread (planning
infrastructure). The conventions R46 *does* build on:

- [Round_05](Round_05.md) — PDCA template, status lifecycle,
  post-round audit checklist, and the memory-placement rule. R46
  uses all four (status flips Planning → In Progress → Review;
  audit-before-Complete; tool-quirk learnings written to
  `.agents/memory/` per the placement rule).
- DCBF methodology at
  [context/contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)
  (promoted from the R14→R21 chain) — R46's Track-1 anchor (below)
  cites it: the DCBF chain's lived experience is what pulled the
  DCFBI/DFCFBI pivot R47 codifies, and R46 is R47's enabling
  plumbing.
- [memory/_TEMPLATE.md](../../memory/_TEMPLATE.md) — R46's
  tool-quirk memory file follows this template shape.

R46 establishes `.agents/plan/brainstorms/` as the durable home for
pre-decision brainstorm chains, lands the 2026-05-28 hybrid-flow
chain as the first instance, and adds a short section to
[`PDCA.md`](../PDCA.md) naming the **brainstorm → decision → round**
lifecycle so the pattern is discoverable.

The pattern this round establishes is **optional**, not mandatory: a
round only writes a brainstorm chain when its decision needs more
exploration than fits inline in the decision file's `## Why`. Most
rounds will skip brainstorms entirely; this round documents the
shape *for the rounds that need it*.

*Track: 2 (agent-method, planning infrastructure). Pulled
transitively through R47's Track-1 anchor (DCBF experiment yielded
fair-only results for over-effort + D-phase overwhelm as design-
corpus scope grew → DCFBI/DFCFBI pivot, per
[context/contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)
and the 2026-05-28 brainstorm chain). The inflection itself is
captured as an S-curve break-point in
[memory/2026-05-28-dcbf-to-dcfbi-pivot.md](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md).
R46 is the enabling plumbing R47 needs. Per
[Evolution Rule](../../AGENTS.md).*

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Subdirectory pattern**: `<YYYY-MM-DD>-<slug>/` — matches the
   `decisions/` filename convention (e.g., `2026-05-27-msw-contract-anchor.md`)
   but as a directory because brainstorm chains hold multiple docs.
   First instance: `2026-05-28-hybrid-flow/`. Date = first doc in
   the chain, slug = topic that ties the chain to its eventual
   decision file's slug (`hybrid-flow` ↔ `hybrid-flow-governance`).
2. **Move, not copy.** `tmp/` files are gone after the move. Single
   source of truth — keeping both copies guarantees drift. Use
   `mv` (not `git mv` — the `tmp/` source is untracked, `git mv`
   would fail; the destination is freshly tracked when added).
3. **`README.md` in the subdirectory** documents the chain order
   (MEMO-FINDINGS → TOOLING-ANALYSIS → TOOLING-QUICK-START →
   FINAL-RECOMMENDATION) and a one-line summary of what each doc
   contributed. Short: 15-25 lines.
4. **PDCA.md section placement**: new sibling section between
   "Naming Convention" and "Round Template" titled
   `## Brainstorm lifecycle (optional)`. Keeps the round template
   discoverable as the centerpiece while placing the brainstorm
   shape where readers already scan for structural conventions.
5. **PDCA.md section length**: 10-15 lines. Names the shape
   (`plan/brainstorms/<YYYY-MM-DD>-<slug>/`), the
   brainstorm→decision→round flow, and the "optional, only when
   inline `## Why` is insufficient" qualifier. Cites this round's
   2026-05-28-hybrid-flow chain as the worked example. No prose
   bloat — readers should leave knowing *that* the pattern exists
   and *where to find an example*.
6. **No `.agents/.gitignore` change.** `.agents/.gitignore` already
   excludes `tmp/` — that's fine; `plan/brainstorms/` is not under
   `tmp/`, so it's tracked by default. Sanity check this in Check
   phase.
7. **Only the 4 hybrid-flow docs move.** `tmp/` also contains
   `dev/` and `ref-apps/` subdirectories — explicitly out of scope.
   The convention applies to *brainstorm chains that produced or
   will produce a decision*; other `tmp/` content (in-flight work,
   scratch files, reference imports) stays where it is.
8. **No edits to the 4 docs.** Move as-is. Any tightening or
   re-framing belongs in the eventual decision file (R47's work),
   not the brainstorm record. The brainstorm captures *what the
   thinking looked like at the time*; rewriting it falsifies the
   audit trail.

## What is IN scope

### 1. Create the brainstorms directory

- Path: `.agents/plan/brainstorms/2026-05-28-hybrid-flow/`.
- The parent `.agents/plan/brainstorms/` is created implicitly by
  the first subdirectory (no empty top-level needed; the README in
  the first chain serves as the worked example).

### 2. Move the four brainstorm docs

From → To (file content unchanged):

| From (`tmp/`) | To (`.agents/plan/brainstorms/2026-05-28-hybrid-flow/`) |
|---|---|
| `MEMO-FINDINGS-2026-05-28.md` | `MEMO-FINDINGS-2026-05-28.md` |
| `TOOLING-ANALYSIS-2026-05-28.md` | `TOOLING-ANALYSIS-2026-05-28.md` |
| `TOOLING-QUICK-START.md` | `TOOLING-QUICK-START.md` |
| `FINAL-RECOMMENDATION-2026-05-28.md` | `FINAL-RECOMMENDATION-2026-05-28.md` |

- `tmp/dev/` and `tmp/ref-apps/` stay put — not part of this chain.
- Method: `mv` (source is untracked; `git mv` would fail).

### 3. Write the chain README

- Path:
  `.agents/plan/brainstorms/2026-05-28-hybrid-flow/README.md`.
- Contents (~15-25 lines):
  - One-line topic summary ("Hybrid design-and-delivery flow —
    pre-decision brainstorm for R47").
  - Chain order with one-line role per doc:
    1. `MEMO-FINDINGS-2026-05-28.md` — initial gap audit (what
       isn't working in the current process).
    2. `TOOLING-ANALYSIS-2026-05-28.md` — what MSW + contracts +
       PDCA can / cannot support today.
    3. `TOOLING-QUICK-START.md` — operational shortcuts derived
       from the tooling analysis.
    4. `FINAL-RECOMMENDATION-2026-05-28.md` — synthesized
       operating model (DCFBI default, DFCFBI conditional, O-rule
       invariant) that R47 codifies into a decision.
  - Pointer to the eventual decision file:
    `→ .agents/decisions/2026-05-28-hybrid-flow-governance.md`
    (R47 output).
  - Pointer to the round that codified it: `→ ../cycles/Round_47.md`.

### 4. Add PDCA.md section

- File: [`PDCA.md`](../PDCA.md).
- Placement: new section between `## Naming Convention` and
  `## Round Template`.
- Section title: `## Brainstorm lifecycle (optional)`.
- Content (~10-15 lines):
  - Names the shape:
    `.agents/plan/brainstorms/<YYYY-MM-DD>-<slug>/` holds chains of
    pre-decision analysis docs + a `README.md`.
  - States the flow: brainstorm → decision → round. The brainstorm
    is exploration; the decision is the committed paraphrase; the
    round is the work that produces the decision file and any
    artifact edits.
  - Optional, not mandatory: only when inline `## Why` in the
    decision is insufficient. Most rounds skip brainstorms.
  - Worked example: `2026-05-28-hybrid-flow/` → R47 →
    `decisions/2026-05-28-hybrid-flow-governance.md`.
  - No editing of brainstorm docs after the decision lands — the
    chain is historical record.

### 5. Pipeline

- `npx markdownlint-cli2` — 0 errors over new + edited files. The
  4 moved docs were never linted under `.agents/`; expect some
  errors and fix inline.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status.

## What is OUT of scope

- **No edits to the 4 brainstorm docs' content.** Move as-is. Any
  tightening lives in R47's decision file.
- **No moving of other `tmp/` content.** `tmp/dev/` and
  `tmp/ref-apps/` are not brainstorm chains; they stay put.
- **No decision file.** R47 writes
  `.agents/decisions/2026-05-28-hybrid-flow-governance.md`. R46
  only establishes the brainstorm path R47 references.
- **No AGENTS.md edit.** R47 adds the Operative-horizons bullet
  pointing at the decision file. R46 doesn't add a top-level
  horizon because "brainstorms exist" is plumbing, not a
  commitment that constrains future agent behavior.
- **No new memory file.** Memory captures learnings; R46 *is*
  plumbing work.
- **No `.agents/.gitignore` change.** Sanity-check only — `tmp/`
  exclusion is unchanged; `plan/brainstorms/` is tracked by
  default. No code change needed.
- **No format spec or template for future brainstorm docs.**
  Brainstorms are exploratory by nature; over-specifying their
  shape (frontmatter, required sections) would defeat the
  purpose. The README per chain provides the only structure
  required.
- **No tooling, no skill, no orchestrator.** This is one directory,
  one README, one PDCA section. Anything more is speculative
  scaffolding per the Evolution Rule.

## Plan

- [x] Confirm scope at planning review.
- [x] `mkdir -p .agents/plan/brainstorms/2026-05-28-hybrid-flow/`.
- [x] Move 4 docs:
      `mv tmp/MEMO-FINDINGS-2026-05-28.md
          tmp/TOOLING-ANALYSIS-2026-05-28.md
          tmp/TOOLING-QUICK-START.md
          tmp/FINAL-RECOMMENDATION-2026-05-28.md
          .agents/plan/brainstorms/2026-05-28-hybrid-flow/`.
- [x] Write
      `.agents/plan/brainstorms/2026-05-28-hybrid-flow/README.md`
      with chain order + one-line role per doc + forward pointers
      to R47 and the decision file.
- [x] Edit [`PDCA.md`](../PDCA.md): add `## Brainstorm lifecycle
      (optional)` section between Naming Convention and Round
      Template.
- [x] Run `npx markdownlint-cli2` — fix any errors. Expect issues
      from the moved docs (never linted under `.agents/` before).
- [x] `git status` confirms: 4 new files present + new README + new
  PDCA section; 4 source deletions from `tmp/` on disk (deletions don't appear
      because `tmp/` is gitignored — those just vanish from disk).
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping Status.

## Risks / unknowns

- **Moved docs may fail markdownlint under `.agents/`.** The 4 docs
  were authored in `tmp/` where lint was likely not enforced. Heading
  styles, trailing punctuation, fence languages, and line lengths
  may not conform. Mitigation: fix lint issues inline as a Do-phase
  task; if a doc needs substantive content change to lint-clean,
  flag and defer that doc to a follow-up rather than rewriting the
  brainstorm record.
- **PDCA.md is read by every session at load.** Adding a section
  has real signal weight. Mitigation: keep section ≤15 lines;
  qualify as "optional"; cite the worked example. Failure mode
  would be readers thinking every round needs a brainstorm chain
  — the "optional, only when inline `## Why` is insufficient"
  framing is the guard.
- **Directory convention may not generalize.** `<YYYY-MM-DD>-<slug>/`
  works for this chain; some future chain might span days or weeks
  with multiple iterative dates. Mitigation: don't optimize for
  that yet. First instance proves the shape; subsequent chains
  refine if needed. `revisit-trigger` would be: a chain that
  doesn't fit the date-slug shape.
- **Sequencing with R47.** R47 references the post-R46 path. If
  R46 isn't committed before R47 starts execution, the path R47
  documents would be wrong. Mitigation: explicit gate — R47 cannot
  flip to `In Progress` until R46 flips to `Review` (work landed,
  awaiting human sign-off). Captured in R47's Plan first checkbox
  ("Confirm scope at planning review").
- **The `.gitignore` is correct as-is**, but worth a sanity check:
  no rule under `.agents/` excludes `plan/brainstorms/` or any
  subdirectory pattern that would silently swallow the moved docs.
  Read `.agents/.gitignore` once in Do; expect only `tmp/`.

## Do

**Scope confirmation.** User authorized execution via "go ahead" at
end of planning review. Proceeded under [auto mode].

**Directory creation + 4-doc move.**

- `mkdir -p .agents/plan/brainstorms/2026-05-28-hybrid-flow/` created
  parent and target subdir in one command.
- `mv` (plain, not `git mv`) was the right tool: the `tmp/` sources
  were untracked (gitignored), so `git mv` would have errored — and
  did, during the earlier round-renumbering step before falling back
  to plain `mv`. The destination is tracked freshly on the next
  `git add`.
- Moved all 4 docs as planned. `tmp/` remaining content: `dev/` and
  `ref-apps/` — untouched, as scoped.
- Sanity-checked `.agents/.gitignore` (only `tmp/`) and the root
  `.gitignore` (no `.agents/plan/brainstorms/` exclusion); new
  directory tracks cleanly.

**README authored.**

- Used the actual chain order discovered during execution: MEMO-
  FINDINGS = scan summary with 6 issues + 2 critical; TOOLING-
  ANALYSIS = per-issue full analysis; TOOLING-QUICK-START =
  executive summary companion to the analysis (not strictly
  sequential — companion, but listed in chain order); FINAL-
  RECOMMENDATION = synthesis into operating model.
- README is 41 lines, over the planned 15-25 target. The lifecycle
  ASCII block (brainstorm → decision → round → first measurement)
  earned its space — concrete shape is easier to read than prose.
  Forward pointers to `Round_47.md` and the not-yet-existing
  decision file are valid once R47 lands.

**PDCA.md section added.**

- Section title: `## Brainstorm lifecycle (optional)`.
- Placement: between `## Naming Convention` and `## Round Template`,
  with `---` rulers matching the surrounding pattern.
- Length: ~26 lines including the directory-shape code fence and
  worked-example footer — over the planned ≤15-line target. The
  content earns its space (concrete shape + worked example +
  optional-not-mandatory framing); trimming further would lose the
  ASCII shape or the worked example, both of which are the section's
  load-bearing content. If a future PDCA-context-rot check disagrees,
  trim then.

**Lint sweep + auto-fix.**

- Initial lint of `brainstorms/2026-05-28-hybrid-flow/`: **59 errors**
  across the 4 moved docs. All whitespace/blank-line rules
  (MD007 ul-indent, MD009 trailing-spaces, MD022 blanks-around-
  headings, MD031 blanks-around-fences, MD032 blanks-around-lists).
  No content rules fired — substance is lint-clean as authored.
- `npx markdownlint-cli2 --fix` resolved all 59 in one pass.
  Whitespace-only changes; no word-level edits.
- Repo-wide re-lint: **0 errors over 114 files** (was 109; +5 for
  the new brainstorms/ contents).

**Sanity verification.**

- `wc -l -w` on each moved doc — line counts grew slightly from
  blank-line insertions (expected); content intact.
- `git status` confirms: 4 new docs under `brainstorms/2026-05-28-
  hybrid-flow/`, 1 new `README.md`, modified `PDCA.md`, plus the
  two round files (R46 self + R47). No deletions tracked (tmp/
  sources were untracked).
- `tmp/` no longer contains any of the 4 brainstorm docs; only
  `dev/` and `ref-apps/` remain — as scoped.

**Post-Review amendments (pulled by deep-check request 2026-05-28).**

User requested a deep audit of R46 against existing
workflow/rules/conventions. Audit surfaced four concerns; all four
were addressed without re-opening Status (PDCA permits in-Review
edits — *"Active rounds are editable. Rounds in Planning,
In Progress, or Review may have any section updated as work
proceeds."*).

- **Track-1 anchor strengthened.** Both R46 and R47 `Pulled by:`
  lines were rewritten to cite the DCBF experiment (R14→R21, per
  [context/contract-driven-feature.md](../../context/_archive/contract-driven-feature.md))
  plus D-phase overwhelm as design-corpus scope grew → DCFBI/DFCFBI
  pivot. R47 carries the direct Track-1 anchor; R46 chains through
  it transitively as enabling plumbing. This closes the
  Evolution-Rule weakness flagged by the audit
  ("Track-2 capabilities only land when a track-1 round actually
  pulls them in").
- **Memory file written** at
  [`memory/2026-05-28-mv-and-markdownlint-fix-quirks.md`](../../memory/2026-05-28-mv-and-markdownlint-fix-quirks.md)
  capturing the two tool quirks (`git mv` requires tracked source;
  `markdownlint-cli2 --fix` is whitespace-safe, content-unsafe).
  Per [memory-placement.md](../../context/memory-placement.md), these
  are repo-relevant tool quirks (parallel to
  [2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md))
  — they belong in `.agents/memory/`, not just inline in Act prose.
- **Promotions log appended** at
  [`promotions.md`](../promotions.md) with a 2026-05-28 entry for
  the brainstorm-housing convention (`plan/brainstorms/` + the new
  PDCA section). Per
  [governance.md § Explicit Human Instructions](../../context/governance.md),
  edits under `.agents/plan/` get logged. The AskUserQuestion
  approval was the user's explicit consent; the promotions entry
  closes the procedural loop.
- **R47.md line 41 emphasis typo** (`._` closing where `.*` was
  intended) fixed as part of the R47 Pulled-by rewrite — the new
  block closes correctly with `.*`.

**Post-Complete reversal (2026-05-28).**

R46 was briefly flipped to `Complete` (commit `33b6a53`, unpushed)
during R47 execution but soft-reset before push, per user request:
*"round 46 have not push, let soft reset, flip R46 to review and
update. Till I'm okay to 'ship it'..."*. Rationale: R47's
post-Review work produced several artifacts that R46's narrative
benefits from cross-linking — most notably the S-curve
break-point memory
([2026-05-28-dcbf-to-dcfbi-pivot.md](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md))
which captures the very inflection R46 is plumbing for.
Re-opening R46 to Review (pre-push, so the soft reset is
non-destructive) lets the cross-link land before R46 ships.

Updates applied during reversal:

- **R46 Track-1 anchor cross-links the break-point memory**
  (new paragraph appended to the `Track:` italic block in the
  Goal section). Mutual linking: the memory file cites R46 as
  its origin round; R46 cites the memory as the captured
  inflection.
- **Brainstorm chain README** at
  [`plan/brainstorms/2026-05-28-hybrid-flow/README.md`](../brainstorms/2026-05-28-hybrid-flow/README.md)
  lifecycle diagram updated:
  `first measurement → Round_48.A (design-corpus audit)` →
  `corpus reconciliation → Round_48 (precondition for first DCFBI
  trial)`. Reflects R47's R48 audit→reconciliation reframe and
  the dropped presumptive-sub-round naming.
- R46.md self-references unchanged otherwise — the round's body
  (Goal, Plan, IN/OUT scope, Risks, Do, Check, Act) accurately
  describes R46's own work and stays appropriate.

R46 holds at `Status: Review` pending user "ship it" approval.

## Check

- [x] `.agents/plan/brainstorms/2026-05-28-hybrid-flow/` directory
      exists with all 4 brainstorm docs + 1 `README.md`.
- [x] Source `tmp/` files are gone (4 deletions from disk; git
      doesn't notice because `tmp/` is ignored).
- [x] `README.md` lists the chain order with one-line role per doc
      and forward pointers to R47 + the decision file (which
      doesn't exist yet — that's a forward link to R47's output).
- [x] [`PDCA.md`](../PDCA.md) has a new `## Brainstorm lifecycle
      (optional)` section between Naming Convention and Round
  Template; cites this round's chain as the worked
      example.
- [x] No edits to the 4 moved docs' substantive content (verify
      with `diff` against the original `tmp/` paths if needed
      — or simpler: `wc -l` parity per file).
- [x] No other `tmp/` content moved (`tmp/dev/` and `tmp/ref-apps/`
      untouched).
- [x] No AGENTS.md, no `.agents/decisions/`, no `.agents/context/`
      changes. One `.agents/memory/` file added (`2026-05-28-mv-
      and-markdownlint-fix-quirks.md`) during post-Review amendment
      — see Do § Post-Review amendments. Original plan said "no
      new memory file"; deep-check audit reversed that on
      memory-placement-rule grounds.
- [x] `.agents/.gitignore` unchanged.
- [x] `npx markdownlint-cli2` — 0 errors.
- [x] `git status` shows 4 new files present in
      `plan/brainstorms/2026-05-28-hybrid-flow/` + new `README.md` +
      edited `PDCA.md` + the two round files (R46, R47).
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md)
  run for agent-owned checks; human-only `Complete` checks
  (status/date flip) remain pending.
- [x] **Post-Review:** Track-1 anchor cited in R46 + R47 Pulled-by
      lines (DCBF experiment + D-phase overwhelm → DCFBI/DFCFBI
      pivot, per
      [context/contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)).
- [x] **Post-Review:** Memory file
      [`memory/2026-05-28-mv-and-markdownlint-fix-quirks.md`](../../memory/2026-05-28-mv-and-markdownlint-fix-quirks.md)
      written per `_TEMPLATE.md` shape; captures the two tool
      quirks surfaced this round.
- [x] **Post-Review:** Promotions log appended at
      [`promotions.md`](../promotions.md) with 2026-05-28 entry for
      the brainstorm-housing convention (PDCA.md section +
      `plan/brainstorms/` doc area) per
      [governance.md § Explicit Human Instructions](../../context/governance.md).
- [x] **Post-Review:** R47.md line 41 emphasis-typo (`._` →
      `.*`) fixed via Pulled-by rewrite.
- [x] **Post-Review:** Repo-wide markdownlint re-run after
      amendments — 0 errors.

## Act

**Learnings**:

- **`git mv` requires source tracking.** Attempted `git mv
  Round_46.md Round_47.md` during the round-renumbering step
  earlier in this session and got `fatal: not under version
  control, source=...` — the file was created in-session and
  never committed. Same shape would have bitten the 4-doc move
  from `tmp/`. Rule: for untracked sources, plain `mv` is the
  right tool; git picks up the destination as a new path on the
  next `git add`. `git mv` is only correct when both the source
  is tracked and the destination should land in the index.
- **`markdownlint-cli2 --fix` is reliable for whitespace rules.**
  59 errors auto-fixed in one pass with no content drift.
  Safe to reach for whenever a moved batch of historical docs
  fails whitespace rules (MD007/009/022/031/032). NOT safe for
  content rules (MD034 bare-urls, MD040 fence-language, MD059
  link-text) — those can introduce real semantic edits and should
  be triaged manually.
- **PDCA.md edits should reuse the surrounding rulers.** PDCA
  separates major sections with `---`. Anchoring an Edit on a
  multi-line block that includes the ruler before AND after the
  insertion point keeps the document structure intact. Useful
  pattern for future PDCA.md edits.
- **Plumbing rounds are small in steps, large in unblock value.**
  R46 was 5 file-system operations + 1 markdown section + 1
  README + 1 lint pass. The *work* is small; the *value* is that
  R47's references no longer rot. Worth treating future plumbing
  rounds the same way — minimal Plan, sharp Check, the unblock
  is the point.

**Promotions** *(none — convention plumbing, not a validated pattern.
The first non-trivial use of the convention will be its own
validation signal; promotion to `.agents/context/` would be premature
until at least 2 brainstorm chains have landed and produced
decisions.)*:

**Follow-ups (not promotions, just notes):**

- **`<YYYY-MM-DD>-<slug>/` directory pattern is provisional.**
  First instance worked; second chain may surface that multi-day
  brainstorms need a different shape. No action this round.
- **README format is also provisional.** This README has a
  lifecycle ASCII block; future brainstorms may not need one. The
  PDCA.md section deliberately under-specifies README structure
  beyond "chain order + one-line role per doc."
- **PDCA.md section ran over the ≤15-line target (~26 lines
  actual).** Acceptable for now; if a future context-rot check
  flags it, trim by collapsing the worked-example footer into a
  one-liner.
- **R47 unblocked.** R47 can flip from `Planning` → `In Progress`
  now. The path `brainstorms/2026-05-28-hybrid-flow/` is durable;
  R47's decision-file `## Why` can cite it without rot risk.
- **Audit-against-governance is worth doing before Complete.** The
  deep-check after Review flipped four things: weak Track-1 pull
  citation (Evolution Rule), missing memory file (memory-placement
  rule), missing promotions entry (governance Explicit Human
  Instructions), and an emphasis typo. None blocked the work but
  all closed real governance gaps. Cheap to apply before human
  sign-off; expensive to retrofit after Complete (rounds are
  append-only). Pattern to repeat on future rounds — especially
  those touching `.agents/plan/` or adding new doc areas.

## Feeds into → Round_47

R47 (DCFBI/DFCFBI governance codification) consumes:

- `.agents/plan/brainstorms/2026-05-28-hybrid-flow/FINAL-RECOMMENDATION-2026-05-28.md`
  as the source-of-truth referenced from the decision file's
  `## Why`. Optionally also cites the chain's sibling docs.
- The `## Brainstorm lifecycle (optional)` section in `PDCA.md` —
  no consumption per se, just sets context for how the chain ↔
  decision ↔ round relationship is documented going forward.

R47's `Inherits from ←` link cites R46 as the round that established
this path. Without R46, R47's decision-file references would rot.
