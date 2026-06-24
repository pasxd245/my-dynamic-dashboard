# Brainstorm — the S3 "anchors" feedback skill (double-check at lock-in)

**Date**: 2026-06-24
**Status**: **Captured concept — NOT built.** A parked Track-2 idea, artifact-only. Sealed enough
to stop pressure-testing (human's call, 2026-06-24); the *build* waits for a Track-1 round to pull
it. Author note: the **S1+S2 / S3 model and the "anchors → awareness" reframe are the human's
framing** ("my view, not your view"); the agent contributed the cold/hot synthesis and the two
caveats, marked below.
**Pulled by**: R92 planning (2026-06-24) — the in-conversation fair-review caught a misnomer
("query×query" was really model→query), the real enabler (column **provenance**, not `qr_`-on-left),
and a loose decision-8 — **debt avoided at planning cost** — plus the human's self-diagnosed
recurring bias (moving too fast at lock-in; Kahneman **WYSIATI** + **regression to the mean**).
_Track: 2 (agent-method — a decision-hygiene instrument for the HIxAI co-spiral). Per the
[Evolution Rule](../../AGENTS.md); honours the [R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md)
artifact-only posture — captured now, built when pulled._

---

## 1. The problem this exists to brake

We sometimes **lock a round too fast** and pay for it later — not a mistake, a *bias*: Kahneman's
**WYSIATI** (we build a coherent story from what's in view and the gaps stay invisible) and
**regression to the mean** (a fast clean lock-in is partly luck; expecting the next to go as
smoothly is the trap). The deeper finding: **S2 is a lazy controller** — it mostly *rationalizes*
S1's story rather than auditing it, because S1 and S2 share the same priors. "Think harder" doesn't
break a coherent story. Something from **outside** the story has to.

## 2. The model (human's framing)

- **S1 + S2 = the human** — fast intuition + slow (lazy) deliberation.
- **S3 = an external-thinking-system-like** — in this context, the AI model — *as defined inside the
  human's loop*. Not a claim the AI makes about itself; a role the human assigns.

The hope was that S3, being a separate system, could be the *outside* check S2 structurally can't be.

## 3. The honest constraint (the correction that shaped the design)

**S3 cannot be forced into true isolation.** In practice the conversation entangles it — S3 is
primed by the human's framing and drifts toward coherence with the story already built. A reviewer
who has been in the room for the whole argument is not independent of it. S3 also has its own failure
modes: **sycophancy** (defaults to endorsing) and **its own WYSIATI** (fluent, confident,
plausible-but-wrong stories — e.g. the agent's first instinct in R92 planning was a confident-wrong
"the missing cells need `qr_`-on-left," corrected only by grounding in the resolver).

→ So **"make S3 an isolated reviewer" is the wrong goal** — unattainable, and pretending otherwise
manufactures the false confidence we're trying to avoid.

## 4. The reframe (human's): anchors → awareness, not isolation

The skill's job is **not** to achieve an independent reviewer. It is to plant **anchors** — fixed
external reference points — that **ensure at least awareness** of the blind spot. This is how the
real debiasing tools work: a **pre-mortem**, a **checklist**, **reference-class forecasting** — none
makes the thinker unbiased; each forces the blind spot into view.

## 5. The spine (agent synthesis on the human's reframe)

> **You can't isolate the reviewer — so isolate the *questions* instead.**

**Author the anchors _cold_** (ahead of any specific round, when no decision is on the line, so they
don't bend to the in-the-moment story) and **apply them _hot_** (at lock-in). The independence we
can't get from S3, we get from the anchors *having been set before the story existed*. **That is why
this wants to be a _skill_ and not "ask the AI to review": the skill is the pre-registration** —
cold-authored questions, hot-applied.

## 6. Design guards (so the anchors actually bite — not theater)

1. **Evidence, not answers** _(agent caveat)_ — an anchor that asks for an *answer* gets rationalized
   ("what would falsify this? — nothing, because X"); one that demands *evidence* resists it ("name
   the file/line you checked; produce the disconfirming case, don't assert there isn't one").
   Entangled S3 can story past a question but cannot fake a citation. **Grounded-or-silent.**
2. **Awareness needs a moment-of-choice trigger** _(agent caveat)_ — surfacing a blind spot ≠ acting
   on it; you can be aware and still barrel through (exactly in fast-mode). So the anchor must fire
   **at lock-in**, not after — which is why it pairs with a **gate-prompt**: the gate makes the
   anchors fire when the human would least remember to ask them.
3. **Surfaces — never decides** — like `ui-design` ("verifies, does not auto-fix") and the
   constitution ("only humans flip/promote"). If S3 starts deciding, automation bias replaces the
   bias it was meant to catch.
4. **Explicit posture** — one axis, **S3's disposition toward the decision** (*against → neutral →
   for*): `challenge` / `fair` / `constructive` / `mix` — to counter S3's default sycophancy; the
   human **tunes the coupling** (`challenge` when they smell themselves moving too fast;
   `constructive` only to *harden* an already-made decision, not while deciding to lock).

## 7. Failure modes it guards against

- **WYSIATI** (human) — anchors surface "what's not in view."
- **Regression to the mean** (human) — the pre-mortem anchor ("assume this failed — why?").
- **S2-rationalizes-S1** — anchors are exogenous *questions*, not more same-mind deliberation.
- **S3 sycophancy + S3's own WYSIATI** — the `challenge` posture + grounded-or-silent.
- **Automation bias, incl. meta-level** — surfaces-not-decides; and **"my view, not your view"** is
  itself a guard: the moment S3's *framing* overwrites the human's, automation bias has won at the
  model level. Keeping authorship of the model with the human is enacting "S1+S2 decides."

## 8. Relationship to the Design-exit gate (they compose, not compete)

From the same R92-planning thread: a proposed **Design-exit criterion** (enforced by `gate-walker`)
— _"the round states, grounded in the real code, what it builds and what it explicitly defers."_

- The **gate** = the *trigger* that forces the pause.
- This **skill** = the *lens* (the anchor-set) applied during the pause.

Build the gate-criterion independently if/when pulled; this skill is the instrument it would invoke.

## 9. Status, governance, open questions

- **Not built.** Default = don't add (Evolution Rule). This is the *artifact* that records the idea;
  the build lands only when a Track-1 round pulls it (and earns "primary" status only over reps).
- **Name chosen**: **`cold-reviewer`** (human, 2026-06-24) — "cold" = the *anchors* are
  cold-authored / pre-registered (not the reviewer, who can't be isolated; §3). A **parked-draft**
  `SKILL.md` exists at [`../../skills/cold-reviewer/SKILL.md`](../../skills/cold-reviewer/SKILL.md) —
  **unregistered** (no `.claude/` pointer, not in the skills README index), so it does not
  auto-trigger; promote only when a Track-1 round pulls it. (Other names considered: `second-look`,
  `pre-mortem`, `red-team`, `cold-anchors`.)
- **Open for later**: the cold-authored **anchor-set** itself (the actual questions); whether modes
  are one skill with a `--mode` arg vs. presets; the exact gate-prompt wording; whether S3 should
  *propose* anchors (re-entangling risk) or only *apply* a fixed set.
