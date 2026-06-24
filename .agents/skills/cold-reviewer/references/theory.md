# cold-reviewer — theory (the "why")

> Background for [`../SKILL.md`](../SKILL.md). **Not runtime guidance** — read once to understand
> why the skill is shaped the way it is. Fuller exploration + governance:
> [the brainstorm](../../../plan/brainstorms/2026-06-24-s3-anchors-feedback-skill.md).

## The bias it brakes

We sometimes **lock a decision too fast** and pay for it later — a bias, not a slip: Kahneman's
**WYSIATI** (we build a coherent story from what's in view and the gaps stay invisible) and
**regression to the mean** (a fast clean lock-in was partly luck; expecting the next to go as
smoothly is the trap). The deeper finding: **S2 is a lazy controller** — it mostly *rationalizes*
S1's story rather than auditing it, because S1 and S2 share the same priors. "Think harder" doesn't
break a coherent story; something from **outside** it has to. The **lock-in moment** is where this
bites, so that's where the skill fires.

## The model (the human's framing)

- **S1 + S2 = the human** — fast intuition + slow (lazy) deliberation.
- **S3 = the AI** — an external-thinking system *inside the human's loop*, as the human defines it.
  Not a claim the AI makes about itself. **"My view, not your view."**

## Why S3 can't simply *be* the outside check

**S3 cannot be forced into true isolation.** The conversation entangles it — it is primed by the
human's framing and drifts toward coherence with the story already built. It also has its own
failure modes: **sycophancy** (defaults to endorsing) and **its own WYSIATI** (fluent,
confident-but-wrong stories). So "make S3 an isolated reviewer" is the wrong goal — unattainable,
and pretending otherwise manufactures the false confidence we're trying to avoid.

## Anchors → awareness, not isolation

The skill's job is **not** an independent reviewer. It is to plant **anchors** — fixed external
reference points that force the blind spot into view. This is how the real debiasing tools work — a
**pre-mortem**, a **checklist**, **reference-class forecasting** — none makes the thinker unbiased;
each forces awareness.

## The spine

> **You can't isolate the reviewer — so isolate the _questions_.** Author the anchors **cold** (out
> of the heat of any one decision) and apply them **hot** (at lock-in). The skill **is** the
> pre-registration.

That is why this is a *skill* and not "ask the AI to review": the questions were fixed before this
particular story existed, so they don't bend to it.

## What "cold" means

Not *harsh* — **pre-registered**. The anchors were authored cold and are applied with a detached
stance. The reviewer is entangled; the **questions are not**. New anchors are added by **editing
the SKILL.md** (cold), never improvised in the moment (which would re-entangle them with the story).

## The coupling dial

What the human tunes is S3's **disposition toward the decision** (*against → neutral → for*) — the
modes (`challenge` / `fair` / `constructive` / `mix`) — **not** which anchors fire. Disposition is
the one axis; the anchor-set is fixed. `constructive` is the comfortable mode, and S1 will reach for
comfort exactly when it needs the medicine — so **couple the mode to the situation, not the mood**.

## Failure modes the design guards against

- **WYSIATI** (human) — anchor 1 surfaces "what's asserted but unread."
- **Regression to the mean** (human) — the pre-mortem anchor.
- **S2 rationalizes S1** — anchors are exogenous *questions*, not more same-mind deliberation.
- **S3 sycophancy + S3's own WYSIATI** — the `challenge` posture + **grounded-or-silent** (entangled
  S3 can story past a question but cannot fake a citation; that's the whole point).
- **Automation bias** — *surfaces, never decides*; only the human locks. Including the **meta-level**:
  the moment S3's *framing* overwrites the human's, automation bias has won — so "my view, not your
  view" is itself a guard.

## Companion: the Design-exit gate

From the same R92-planning thread — a proposed `gate-walker` Design-exit criterion: _"the round
states, grounded in the real code, what it builds and what it explicitly defers."_ The **gate** is
the *trigger* that forces the pause; this **skill** is the *lens* applied during it. They compose.
