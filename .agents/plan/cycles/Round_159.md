# Round 159: the Round gains a reader-layer (⟢ At a glance + Check→Study)

**Status**: **COMPLETE** — 2026-07-18 (reopened before push after R160's dogfood pause, then
**scope-frozen**: ship the reader-layer only — ⟢ At a glance block + Plan prediction + Check→Study.
The broader intent⇄formalization "semantic handshake" is held as a **hypothesis for R160 to test**,
deliberately NOT baked into PDCA doctrine; R-glance lint deferred.)
**Date started**: 2026-07-11
**Date completed**: 2026-07-18
**Flow**: DCFBI — governance/doc, no product UI (a lint rule was prototyped then deferred).

## ⟢ At a glance

<!-- reader-layer: read THIS to review the round; the sections below are the working record.
     Authored at the Review→Complete flip. Shipped = what's now true · Studied = predicted→
     saw→now-believe · Watch = open threads / next bearing. -->

**Shipped** — The Round Template gains a top-of-file **⟢ At a glance** block
(**Shipped / Studied / Watch**), a one-line **Plan prediction** (so Studied has something to check
against), and the **Check (verify) vs Studied (learn)** distinction (Deming's PDCA→PDSA). That is
the whole shipped scope. The broader **intent ⇄ formalization "semantic handshake"** (Human-intent
/ Round-question split, semantic-alignment recheck, per-round bearing) was drafted in the reopen
then **held back as a hypothesis for R160** — NOT written into PDCA doctrine (probe-before-theme,
applied to our own process). The block stays manual — **R-glance** lint was prototyped then
deferred. `pnpm plan:lint` 0 · `markdownlint` 0 · changed-links check 0.

**Studied** _(predicted → saw → now believe)_

- Predicted a *new "Prediction" section* would be needed so Study has something to compare
  against → the existing **Risks / unknowns** section is already a proto-prediction (R155's
  "the warn is the whole safety model, if it ages into a nag…") → **reframe Risks as testable
  expectations; don't add a section. The reader-layer is a relocation, not new ceremony.**
- Predicted I'd ship the block **and** its lint gate together → a challenge-mode cold-review
  surfaced that (a) the pull is still hypothetical — the block is proven to me, not proven
  *read* in the wild, and (b) a presence-lint can't stop a hollow/theater block anyway →
  **adopt the artifact, defer its enforcement — probe consumption before mechanizing. Our own
  probe-before-theme rule, applied to our own process.**
- Predicted the block is net-new writing → it is ~90% *relocation* of Act learnings + the
  hand-copied memory rolling-log → **the block ≈ the rolling log, per-round; the log can
  derive from the blocks instead of being separately maintained.**
- Predicted that making a completed Round legible was the full gap → R160 produced a coherent,
  code-grounded story while its original real-user probes remained incomplete, and the human
  paused without a brighter bearing → **legibility is necessary, not sufficient — there may be a
  second, *semantic* gap (does the formal round still answer the human's real question?). But that
  is a hypothesis proven to *me*, not proven in use → don't bake it into PDCA; ship the reader-layer
  and let R160 test the semantic-handshake before it earns doctrine.** The same probe-before-theme
  call this round made for the R-glance lint, made again one level up. Confidence: high that the
  reader-layer earns its place; the semantic model is unproven.

**Watch**

- **R-glance lint gate is deferred**, not dropped — re-evaluate after ~3–4 hand-written blocks:
  if they're read and don't slip, add the rule (prototype fully described in Do); if the block
  reads as theater or gets skipped-without-notice, that's the prune signal instead.
- Legacy rounds (≤ 158) have **no** reader-layer — accepted; a backfill sweep is a separate
  opt-in activity, not pulled by this round.
- **Studied-can-be-hollow** on mechanical rounds (the R128 stub → "Studied: —"). A run of
  hollow Studied lines is a *signal*, not a bug: it feeds the parked **round-size calibration**
  question (is a no-Study round even a round, or a task?). The same discipline keeps `Studied`
  from degrading into hindsight — the prediction lives in Plan, written first.
- The **rolling-log-derives-from-blocks** rewire is named, not built — a follow-up.
- **R160 tests the semantic-handshake hypothesis** — does a completed round need an explicit
  intent⇄formalization return (Human-intent/Round-question, semantic-alignment recheck, per-round
  bearing), or does the reader-layer + an honest `Studied` already carry it? If R160 shows it
  clearly improves the human's bearing, promote it into PDCA then; if it just adds prose, drop it.
  Until that evidence exists, PDCA stays frozen at the reader-layer.

## Goal

**Pulled by ← this session's meta-review of the PDCA round machinery** (a Track-2 governance
review the human opened). Evidence round: **[R158](Round_158.md)** — a *well-written* 314-line
round that still cannot be reviewed in under ~20s, because "what shipped / what to watch" is
scattered across Plan `[x]` + Do + Check `[x]` + Act + Risks + "Explicitly NOT" + Feeds-into +
inline `[F-]` markers.

**Reopened before push ← R160 dogfood pause (2026-07-17).** R160 showed the
missing seam: a Round can become formally coherent and informative yet stop short of answering
the user's original question or leaving a clear next bearing. The human reframed the Round as a
bridge between ambiguous natural language and formal/structured language the agent can execute.

**Human intent** — Make a Round preserve the user's meaning closely enough that a correct formal
execution remains aligned with the problem they meant, while honestly allowing discovery to
change either side.

**Round question** — Can the existing Goal / Plan / Check / Studied / Feeds structure carry an
inspectable `intent → formalization → evidence → alignment → bearing` loop without adding a new
phase, a percentage theater metric, or another lint gate?

Give a completed round a **reader-layer**: a top-of-file storyboard a reviewer reads *instead of*
the working log. Grounded in the PDCA→PDSA research: our third phase is a **Check** (verify:
gates-green + human walk), and Deming's whole objection to "Check" is that it leaves a *verdict*,
not a *revised belief* (**Study**). The learning already lives in **Act** — the last, thinnest,
least-read section — plus an improvised rolling-log in the agent's private memory. This round
brings that reader-layer *home*, into the round file, structured, per-round.

_Track: 2 (agent-method — round-artifact legibility; the reader-layer. Semantic alignment was
surfaced but deferred to R160 as a hypothesis). Pulled by: the felt friction of reviewing a
completed round (R158) + the R160 dogfood pause + the PDCA Check-vs-Study research — per
[Evolution Rule](../../AGENTS.md). Least-mechanism: one close-out block (lint enforcement
deferred until consumption is proven) and clarified existing fields; no new phase._

## Plan

Expected outcome: a single close-out block (Shipped/Studied/Watch) delivers the 20-second review,
and small prompts in existing fields make the human↔formal translation inspectable **without** a
new phase or heavyweight authoring load. Falsified if: the prompts merely produce more polished
prose, duplicate content that drifts, force false certainty, or fail to leave the human with a
clearer answer/bearing.

- [x] Add the **⟢ At a glance** block to the Round Template in [PDCA.md](../PDCA.md) — placed
      directly under the Status/Date header, before `## Goal`; with an inline guidance comment
      (close-out artifact; Shipped/Studied/Watch).
- [x] Add a short **Check(verify) → Studied(learn)** note to the Cycle Template, and one line to
      the **Plan** phase: state an expected outcome (a prediction) so Study can compare.
- [x] Add one **post-round audit** checklist item: the block is authored at close — a **manual**
      check (no lint gate), rounds ≥ 159.
- [x] ~~Extend round-lint.mjs with rule **R-glance**~~ — **prototyped, then reverted per the
      cold-review** (probe-before-theme): enforcement deferred to a follow-up, not shipped here.
- [x] Dogfood: this round (R159) carries the block, with a real Plan-time prediction.
- [x] Reopen before push on R160 evidence → then **scope-froze** (2026-07-18): keep the reader-layer
      in PDCA; trim the intent⇄formalization vocabulary back out and hold it as an R160 hypothesis.
- [x] Gates: `pnpm plan:lint` 0 (round-lint unchanged from its R67 baseline) · `markdownlint-cli2` 0.

## Risks / unknowns

- **Ceremony rot** — the block could age into a copy-paste header nobody reads. Mitigation:
  it's a *close-out* artifact (written once at the Complete flip, not maintained during Do), and
  it mostly relocates existing Act/memory content — so it adds ~no net authoring. If it stops
  earning its place, prune it (dynamic-equilibrium brake).
- **Legacy corpus** — any future R-glance MUST grandfather (≥ 159) or `plan:lint` would red-line
  157 Complete rounds on first run (the prototype used a `GLANCE_MIN_ROUND` threshold; the lesson
  is preserved in Do for when the gate lands).
- **Hollow Studied** — mechanical rounds have no theory to revise; `Studied: —` is honest, but a
  block that's mostly "—" would signal the round unit is mis-sized (a separate, parked question).
- **Semantic theater** — the agent can write a fluent alignment story unsupported by user action.
  Mitigation: the `Studied` line distinguishes observation from inference and reports alignment
  confidence with the evidence that earns it, so a hollow story has nothing concrete to point to.
- **False precision** — “85% aligned” can be decorative. Use high/medium/low confidence with the
  evidence that earns it; use a percentage only if a real measurement exists.

## Do

### Doctrine + lint edits (2026-07-11)

- **[PDCA.md](../PDCA.md)** — Round Template gains the `## ⟢ At a glance` block (Shipped/Studied/
  Watch) under the header. Cycle Template: the **Plan** phase gains "state an expected outcome
  (prediction)"; a short **Reader-layer** note frames Check = *verify* (gates + walk) vs Studied =
  *learn* (predicted→saw→now-believe), and states the block is authored at the Review→Complete
  flip. Post-round audit gains the block-present checklist item.
- **[round-lint.mjs](../../../scripts/lint/round-lint.mjs)** — **reverted to its R67 baseline.**
  An **R-glance** rule was prototyped (heading + `**Shipped**`/`**Studied**`/`**Watch**` labels,
  gated `num ≥ GLANCE_MIN_ROUND (159)` to grandfather the legacy corpus, negative-tested to
  confirm it both fired and grandfathered), then removed on the cold-review's call. The prototype
  is ~15 lines and fully described here, so re-adding it once consumption is proven is trivial.
- **This file (R159)** — dogfoods the block with a Plan-time prediction (the honest test of the
  Gap-1 fix: prediction written *before* the outcome, not reconstructed after).

### Cold-review → split decision (2026-07-11)

Ran `cold-reviewer` in **challenge** mode before the Complete flip (human-requested). Two anchors
bit: **pre-mortem** — R-glance is a presence-lint, so it guarantees the *slot* exists but not that
the block is honest (a `Studied — —` / `Watch — none` block passes green); **counter-case** — the
pull is still hypothetical ("*imagine* I want to check a round"), so shipping a permanent per-round
lint gate from unproven-in-the-wild value cuts against the Evolution Rule and probe-before-theme.
**Reversibility** was the pivot — everything here is a one-op revert, so the real question was
*sequencing*, not go/no-go. **Outcome — split the lock:** adopt the block + Check→Study doctrine
now (dogfooded, useful); revert R-glance to a deferred follow-up. The block's consumer is the
person flipping Complete (the human), so self-interest guards its presence better than it guarded
the agent-authored `Feeds into →` that R67 had to lint.

### Reopen — R160 exposed the semantic seam (2026-07-17)

R160 was paused after its dogfood log developed a strong engine/composition explanation but left
the original baseline, anti-join, messy-key, and render probes open. The human's felt result was
not “the Round is unreadable”; it was “I stopped without a brighter direction.” That falsified the
idea that reader legibility alone closes the gap. A summary can faithfully compress a formally
coherent Round that has translated the wrong question—or has not returned to the original one.

The reopen first drafted a full **intent ⇄ formalization** refinement across the template: Goal =
Human-intent + Round-question; Plan names meaning-changing assumptions; Do separates observation
from inference; Check verifies the formal question while Studied rechecks semantic alignment;
Feeds-into leaves a bearing. Written out, it was a sizeable doctrine addition resting on a single
round's felt pause.

### Scope-freeze (2026-07-18)

Applying this round's own **probe-before-theme** rule one level up: that whole semantic layer is a
**hypothesis, not yet earned doctrine.** So the reopen was trimmed to ship only the reader-layer
(⟢ At a glance + Plan prediction + Check→Study), and the intent⇄formalization vocabulary was removed
back out of PDCA.md. R160 is the test: if the semantic return demonstrably improves the human's
bearing, promote it into PDCA then; otherwise drop it. A “no — the result no longer answers the
intent” stays valid learning for a round to record in `Studied`; no checksum, witness section,
alignment score, or lint rule is added while the pull is unproven.

_(Git note: an earlier local R159 commit was soft-reset, so R159 is staged/uncommitted — this
closes as a fresh commit, no history rewrite.)_

### Verification

- `node scripts/lint/round-lint.mjs` → 0 errors across all 159 rounds (round-lint is back at its
  R67 baseline — no new rule; R159 passes on the five phase headings + cross-links + Feeds-into).
- `npx markdownlint-cli2` on the touched `.md` → 0; `check_links --changed` → 0.

## Check

- [x] Round Template carries the block; guidance comment present; placed before `## Goal`.
- [x] Cycle Template documents Check(verify) → Studied(learn) + the Plan prediction line.
- [x] `round-lint.mjs` reverted to R67 baseline; `pnpm plan:lint` 0 across all 159 rounds
      (no new rule shipped).
- [x] R159 carries the block (manual dogfood — not lint-enforced).
- [x] PDCA carries ONLY the reader-layer (block + Plan prediction + Check→Study); the
      intent⇄formalization vocabulary was trimmed back out — no new phase, numeric score, lint
      rule, checksum, or semantic-handshake doctrine added.
- [x] `markdownlint-cli2` 0 on touched files; `check_links --changed` 0.
- [x] **Human sign-off** (2026-07-11) — reader-layer block format + Check→Study framing approved.
- [x] **Human scope-freeze** (2026-07-18) — ship the reader-layer; hold the semantic-handshake as
      an R160 hypothesis, not PDCA doctrine. Git was soft-reset, so R159 is staged for a fresh
      commit (no history rewrite).

## Act

**Learnings** _(the Studied block above is the reader-facing form; full notes here)_:

- The reader-layer was **already being authored twice** — once in Act, once hand-copied into the
  agent's private memory rolling-log — because the round file had no slot for it. The block gives
  it a home; net new work ≈ zero.
- Deming's Check-vs-Study distinction is *exactly* the writer-vs-reader distinction: a verdict is
  for the auditor closing the loop; a revised belief is for the next person who acts on it. Naming
  our third phase "Check" and pushing learning into "Act" is why the learning ended up least-read.
- Gap-1 (no prediction to Study against) has a **lighter** fix than a new section: the existing
  Risks section is a proto-prediction; the Plan just needs to state the expected outcome once.
- **Gap-2 (semantic, not structural) is real but unproven**: a correct implementation can satisfy
  the Round while the Round no longer answers the human's real question. R160 surfaced it; whether
  the fix (intent/formalization split, semantic `Studied`) belongs in PDCA is exactly what R160
  will test. Named it, did NOT bake it — probe-before-theme applied to our own process.
- A research Round that returns a **bearing** (known / unknown / smallest discriminating move)
  instead of forcing a solution felt truthful in R160 — but that too is part of the deferred
  hypothesis, not yet PDCA doctrine.
- **A challenge-mode cold-review changed the plan mid-round** — from "ship block + lint" to
  "ship block, defer lint." The right unit to lock was the *artifact*, not its *enforcement*;
  mechanizing waits on proof-of-consumption. Adopt-then-observe beats adopt-and-enforce when the
  pull is still hypothetical — and this round reshaping itself is the cleanest demonstration that
  the Studied/reader-layer it introduces is worth having.

**Promotions**: none this round. The doctrine change lives in PDCA.md; if the block proves out
over the next few rounds, a `memory/` note on "reader-layer / Check→Study" may earn its place —
not promoting speculatively.

**Prune check**: nothing pruned. (The block is additive but least-mechanism; its own Watch list
flags the prune trigger if `Studied` goes chronically hollow.)

## Feeds into → Round_160 (TBD)

- **Semantic-handshake hypothesis test** — R160 is where we find out whether a completed round
  needs an explicit intent⇄formalization return beyond the reader-layer. Finish R160's decisive
  real-data probe (or name the smallest discriminating move), and judge the semantic layer by
  whether it gives the human a clearer bearing. If yes → promote into PDCA; if no → drop it. Until
  then PDCA stays frozen at the reader-layer.
- **R-glance lint gate** — add the (reverted) prototype once ~3–4 hand-written blocks show the
  reader-layer is actually read and doesn't slip. Trigger: a block skipped-without-notice, or a
  reviewer relying on the block instead of the log. Until then the manual audit item carries it.
- **Round-size calibration** (parked thread from this session) — now has a concrete sensor: a run
  of `Studied: —` blocks = rounds that may be tasks, not rounds. Revisit whether "one round" is a
  calibrated unit.
- **Rolling-log-derives-from-blocks** — wire the memory rolling-log to derive from per-round
  blocks instead of being separately hand-maintained (named here, not built).
- **Optional backfill** — a sweep adding blocks to high-value legacy rounds, if a reader ever
  needs them (opt-in, not pulled).
