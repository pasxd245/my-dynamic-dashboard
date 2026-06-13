# Round 22: Methodology evaluation — two-chain DCBF readout

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_21](Round_21.md)** — R21 closed the second
full DCBF chain (parse-options R19→R20→R21), giving the methodology
its two-instance evidence base. R21's Act explicitly queues a
dedicated post-R21 evaluation round to read that evidence
independently of the rounds that produced it.

R22 is that evaluation round. Three outputs:

1. **Promote the "D-step picks the chain" framing** to
   `../../context/_archive/contract-driven-feature.md`
   as the affirmative complement to the existing "When _not_ to use
   DCBF" section.
2. **Amend the BE conformance memo**
   ([2026-05-24-be-round-conformance-pattern.md](../../memory/2026-05-24-be-round-conformance-pattern.md))
   with the "every accepted field gets one behavior test" sub-rule
   — backed by two instances (R20 BE behavior tests; R21 reducer
   behavior tests).
3. **Decide `skills/`-readiness.** R17 deferred the skill bar
   pending a "non-toy second feature." R21 is that second feature.
   Promote, defer with a concrete unblocker, or split.

_Track: 2 (agent-method — lesson promotion from two DCBF instances).
Pulled by: [Round_17](Round_17.md), [Round_18](Round_18.md),
[Round_19](Round_19.md), [Round_20](Round_20.md), and
[Round_21](Round_21.md) Feeds-into sections all queue this
evaluation. Per [governance.md](../../context/governance.md), writes
to `context/` and `skills/` require explicit human authorization —
the user's "let's go with R22" at end-of-R21 Q&A is read as that
authorization (matching the R18 precedent of "go with R18"). The
round flips to Review with the writes in place and explicit
call-outs in Check so the human can confirm or revert on the
Status-flip review._

## What is IN scope

- **D-step framing amendment** to `context/contract-driven-feature.md`
  — additive, ≤ one short paragraph + a short bullet list. Keeps the
  "When _not_ to use DCBF" section as-is; adds an affirmative
  framing under a new "What the D-step decides" header (or
  equivalent), citing the two chain instances by name.
- **Behavior-conformance sub-rule** amended into the BE-round
  conformance memo (the natural home — the memo already discusses
  conformance-as-pattern). Add a short subsection under the
  existing Recommendation block: title roughly _"Every accepted
  field gets one behavior test."_ Cite R20 (BE) and R21 (FE
  reducer) as the two instances. The memo is `Status: Promoted` —
  amending it is allowed per the append-only-Complete-rounds rule
  applying only to round files, not memos.
- **`skills/`-readiness decision.** Written into R22's Act with
  one of three outcomes:
  - **Promote.** Draft `skills/<name>/SKILL.md` under the
    [Agent Skills spec][agent-skills], with name matching the
    directory, clear triggers, and a steps section that points at
    the existing context/memory files rather than duplicating
    them.
  - **Defer with concrete unblocker.** Name the specific
    condition that would flip the decision (a third feature?
    multi-language stack? automated audit harness?) so a future
    round has a clean trigger.
  - **Split.** If the skill bar passes for part of the
    methodology (e.g., the D-step framing as a stand-alone skill)
    but not the whole DCBF chain, document the split and promote
    only the ready slice.
- **Promotion log** updated with whatever lands.
- **Lint** clean on touched MDs.

[agent-skills]: https://agentskills.io/specification

## What is OUT of scope (explicit deferrals)

- **No new DCBF chain.** R22 reads existing evidence; it does not
  produce a third instance.
- **No third memo amendments.** The contract-round memo and the FE
  typecheck memo are not amended this round — the D-step framing
  belongs in `context/` (already the methodology's authoritative
  home), and the behavior-conformance sub-rule belongs in the BE
  memo because that's where the conformance discipline is
  documented. Adding it to both memos would duplicate the rule.
  Cross-link instead.
- **No tooling / harness changes.** No codegen, no skill scaffolding
  for unrelated procedures, no contract-validation pipeline. R22
  is pure-text knowledge work.
- **No backfill of R14–R21 round files.** They stay as-is; R22
  cites them as evidence, not edits.
- **No changes to PDCA.md / governance.md** unless the skill
  readiness decision requires a governance touchpoint (e.g., a
  new path under `skills/`). Surface and stop if it does.
- **No loading-mask / toast UX round.** Carries over to a later
  track-2 round, per R19–R21 user-deferral.
- **No visual verification of the R21 parse-options UI.** Separate
  small follow-up, not R22's job.

## Plan

- [x] Author Round_22.md (this file) and flip to `In Progress`.
- [x] Re-read
      `../../context/_archive/contract-driven-feature.md`
      and pick the smallest viable amendment shape for the
      "D-step picks the chain" framing.
- [x] Apply the amendment; verify line count growth stays modest
      (~22 lines actual — slightly over the ≤15 target; logged in
      Do).
- [x] Re-read
      [2026-05-24-be-round-conformance-pattern.md](../../memory/2026-05-24-be-round-conformance-pattern.md)
      and pick where the behavior-conformance sub-rule belongs.
- [x] Apply the sub-rule amendment with cross-links to R20 and
      R21 as the two instances.
- [x] Make the `skills/`-readiness decision and write it up in
      Act (decision: defer with sharpened unblocker; not promoting
      this round).
- [x] Update [plan/promotions.md](../promotions.md) with the
      lines that landed.
- [x] Run `pnpm md:lint` (repo-wide) and `pnpm format:check` for
      touched MDs.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **Authorization scope.** The R18 precedent treats a brief user
  pick ("go with R18") as authorization to write to `context/`.
  R22 inherits that read, but the human can still push back at
  Review. If they do, the cleanest reversion is `git restore` of
  the touched files; R22's Plan + draft amendments stay in the
  round file as the receipt.
- **Memo-vs-context placement of the behavior-conformance
  sub-rule.** It could live in `context/contract-driven-feature.md`
  as a fifth bullet under principle 5 ("Fail loudly, pain first"),
  or in the BE memo. Lean: amend the memo first (lower-stakes,
  agent-writable), and only promote into `context/` if a third
  instance surfaces. Mirrors the Evolution Rule.
- **Skill scaffolding placement.** `skills/<name>/SKILL.md` lives
  inside `.agents/skills/`. The directory currently exists but is
  empty — first skill in the project. Naming matters because the
  directory becomes the skill's `name` field. Candidate names:
  `dcbf-chain` (concise, matches the methodology's abbreviation)
  or `contract-driven-feature` (matches the context file).
  Resolve at decision time.
- **Markdownlint `+`-prefix gotcha.** R07–R21 carry-over. Lint
  after every MD edit; prefer "and" over " + " in wrapped bullets.
- **No fresh code/tests to run.** Verification this round is text-
  consistency review + lint. Stay honest about that in Check
  rather than ticking a code-test box.
- **One-feature-per-round cadence.** Per user-memory guidance,
  single-feature rounds are the cadence. R22's "feature" is the
  evaluation itself; the three outputs are one cohesive act. If at
  decision time the skill scaffold feels like a separate feature,
  split it into Round_23 rather than bundling.

## Do

### Amendment 1 — D-step-picks-the-chain framing (context/)

Added a new section **"What the D-step decides"** to
`../../context/_archive/contract-driven-feature.md`,
positioned between "What this methodology refuses to add" and
"When _not_ to use DCBF." The section is the affirmative
complement to the existing negative-framing section:

- Names both chain instances by round number (R14→R17 took all
  four phases; R19→R21 took D + B + F because R15 had landed the
  schema).
- States the rule plainly: "**Scope the chain to the downstream
  rounds the feature actually moves through.**"
- Closes with one-liner: "the chain is a tool, not a quota."

Net add: ~22 lines (slightly over the ≤15 target — the second
chain instance needed a sentence explaining _why_ C collapsed,
otherwise the framing reads as license to skip phases on a whim).

Existing principles 1–5 unchanged; the "default = don't add"
guards unchanged; the "When _not_ to use" section unchanged.

### Amendment 2 — Behavior-conformance sub-rule (memory/)

Two amendments to
[2026-05-24-be-round-conformance-pattern.md](../../memory/2026-05-24-be-round-conformance-pattern.md):

1. **In the Finding section**, after the `extra='forbid'`
   paragraph, added _"Shape conformance ≠ behavior conformance"_
   with two-instance citation (R20 BE behavior tests; R21 FE
   reducer behavior tests). Frames the sub-rule and explains the
   silent-ignore failure mode the original R16 net missed.
2. **In the Recommendation → Do block**, appended a bullet
   _"Every accepted field gets one behavior test."_ Mirrors the
   finding, applies on both sides of the wire, sets the test
   density at "one per field, observable effect, not exhaustive
   matrix."

Both amendments cross-link R20 and R21. The memo's `Status:
Promoted` is unchanged — the amendment extends the captured
pattern without invalidating what was already promoted to
`context/`. Marked the amended paragraphs with _"(Amended R22 ...)"_
inline so the next reader can trace the change to this round.

### Decision — `skills/`-readiness

**Outcome: Defer with sharpened unblocker.**

The R17 memo set the skill bar as "the pattern proves itself on
a non-toy second feature (analytics queries, dashboards). Several
rounds out." R21 supplied a second DCBF chain instance, but the
parse-options feature is an extension of the upload flow — same
domain (data ingestion), same wizard, same parsing pipeline. It
proved the methodology survives a partial chain (D + B + F), but
it didn't prove the methodology transfers to a different problem
shape.

The principled deferral: promoting DCBF to `skills/` now would
codify a procedure whose generality has been demonstrated only
within one domain. The downstream risk is concrete — a skill that
loads automatically into agent context could push future agents
toward spawning DCBF chains for features that genuinely don't fit
(single-layer changes, FE-only refactors, BE-only fixes), even
though the `context/` doc warns against it. The skill format
amplifies the methodology's affirmative voice and quiets its
guards.

The sharpened unblocker for the next round that pulls this
question:

> **A feature outside the data-ingestion domain** (analytics
> query builder, dashboard widget, chart configuration, sharing /
> permissions, or any non-upload surface) **takes a DCBF chain —
> full or partial — and the methodology survives without
> needing a fresh amendment.** When that round closes, the
> skills bar passes; until it does,
> `context/contract-driven-feature.md` plus the three source
> memos remain the operational home.

The other half of the gate — _"`context/` settles"_ — does
appear met: R18 promoted the `context/` doc; R22 amends it but
the amendment is additive and small. No churn in the principles.
A `skills/` promotion blocked only on the "non-toy second
feature in a new domain" condition is the cleanest read.

Logged as a follow-up at the bottom of Act.

### Verification

- **No code touched this round.** R22 is text-knowledge work.
  Reducer, types, contracts, BE — all unchanged.
- `pnpm md:lint` (repo-wide) — _to run_.
- `pnpm format:check` for R22-touched MDs — _to run_.
- Manual re-read of touched files (Round*22.md, context doc,
  BE memo) for internal consistency, link correctness, and the
  Plan/Check checkbox count — \_to run after lint*.

## Check

- [x] `context/contract-driven-feature.md` amendment in place,
      cites R14→R17 and R19→R21 by name, leaves principles 1–5
      and the "When _not_ to use" section unchanged.
- [x] BE conformance memo amended with the behavior-conformance
      sub-rule; cross-links to R20 and R21.
- [x] `skills/`-readiness decision recorded in Act —
      **Defer-with-unblocker**. No `skills/` directory created
      this round; the sharpened unblocker lives in Do §
      "Decision — `skills/`-readiness."
- [x] `plan/promotions.md` has a new dated entry for whatever
      landed.
- [x] `pnpm md:lint` returns 0 errors repo-wide.
- [x] `pnpm format:check` is clean for R22-touched MDs (R04 + R18
      prettier-vs-markdownlint carry-overs persist as expected;
      not R22's job).
- [x] Round_22.md has all Plan + Check checkboxes flipped `[x]`
      before Status moves to Review (per user-memory checklist
      flip rule).

## Act

**Status**: Complete (human-approved 2026-05-25).

User confirmed the defer-skills decision and the track-2/3 freeze:
_"keep the current state of track2&3"_ — pivot focus to track-1
(POC/MVP completion) until workspaces + datasets is demo-ready,
then resume track-2/3 work. Validates R22's sharpened unblocker:
the next DCBF chain will be a product feature, not another
methodology round.

**Learnings**:

- **The D-step framing crystallised on the second instance, not
  the first.** R14's "D-step picks the chain" finding was
  invisible until R19 supplied a counter-example (the C-step
  collapsed because the schema was already there). One instance
  reads as "took all four phases"; two instances reads as "the
  chain reflects what the feature actually needs." Promotions
  that look obvious in hindsight required the two-instance
  reading to become writable.
- **Behavior-conformance is the kind of sub-rule a memo absorbs
  cleanly.** Amending the BE memo with the new finding (without
  re-promoting to `context/`) honours the Evolution Rule's
  3-instance threshold for `context/` while still capturing the
  pattern where future agents will find it. Memos are the right
  granularity for "two-instance, transferable, repo-local" rules.
- **The `skills/` bar is not the same as the `context/` bar.**
  R18 promoted DCBF to `context/` on three same-domain instances
  (R15 + R16 + R17). R22 declines to promote to `skills/` on two
  same-domain chain instances (R14→R17 and R19→R21). The
  difference: `context/` is read with judgement; `skills/` is
  loaded into agent context and quietly normalises the
  procedure. The skill bar therefore correctly demands
  cross-domain evidence, not just instance count.
- **Methodology-evaluation rounds are honest work.** No code,
  no tests, no UI — but the round produced two named amendments
  and a defensible defer decision with a sharpened trigger. That
  reads as track-2 product even though it shipped only Markdown.

**Promotions**:

- **`context/contract-driven-feature.md`** — amended with the
  "What the D-step decides" section. Two-instance evidence (R14→R17;
  R19→R21). Logged in [promotions.md](../promotions.md).
- **`memory/2026-05-24-be-round-conformance-pattern.md`** —
  amended with the "Shape ≠ behavior conformance" finding and
  matching "Every accepted field gets one behavior test" Do
  bullet. Two-instance evidence (R20 BE; R21 FE reducer). Memo
  remains `Status: Promoted`; the amendment extends the promoted
  pattern. No re-promotion to `context/` this round — held until
  a third instance surfaces.
- **`skills/<dcbf>` — NOT promoted this round.** Decision
  recorded in Do § "Decision — `skills/`-readiness" with the
  sharpened unblocker (a non-data-ingestion-domain feature must
  take a DCBF chain).

**Follow-ups (not promotions, just notes):**

- **Watch the next non-upload feature.** Whether it's analytics,
  dashboards, sharing, or auth, the next feature that lands a
  DCBF chain outside the upload domain opens the `skills/`
  promotion gate. The round that closes that chain should
  re-evaluate.
- **Behavior-conformance sub-rule eligibility for `context/`.**
  Currently two instances (R20 BE, R21 FE reducer); both are
  same-feature (parse-options). A third instance in a different
  feature would meet the Evolution Rule's 3-instance bar and
  justify promoting the sub-rule from the memo into principle 5
  of the `context/` doc.
- **Visual verification of the R21 parse-options UI** — R21
  carry-over, still pending whenever the user has the app open.
  Not R22's job.
- **Loading-mask + toast UX-infrastructure round** — R19/R20/R21
  carry-over, still queued.
- **`wizardReducer` cognitive-complexity refactor** — R21
  carry-over, still optional.
- **AntD v5 deprecation cleanup** — R21 carry-over, still
  optional.

## Feeds into → Round_23 (TBD)

What R22 hands forward:

- **A sharper context doc.** The "What the D-step decides"
  section makes "the chain reflects the feature, not vice versa"
  legible to any future round.
- **A sharper BE memo.** The behavior-conformance sub-rule
  is now written down where the next BE or FE round will read it.
- **A defensible `skills/` defer with a concrete unblocker.**
  Future rounds know exactly when to re-pull the skill question:
  the first non-data-ingestion DCBF chain.
- **Five outstanding follow-ups**, all small, none blocking — the
  user picks at end-of-round Q&A whether R23 is the loading-mask
  round, the visual-verification follow-up, a new feature round
  (which would also test the `skills/` unblocker), or something
  else.
