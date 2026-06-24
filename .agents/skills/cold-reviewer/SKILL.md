---
name: cold-reviewer
description: Apply a fixed, evidence-grounded pre-lock review to decisions before commitment. Use when the user is about to seal a plan/design gate, commit scope/model choices, complete a round, approve a diff, or asks to challenge, pre-mortem, double-check, or review blind spots before locking. Produces an inline anchor review; it surfaces concerns but never decides or edits.
when_to_use: Run at a lock-in moment — before sealing a Plan/Design gate, locking a scope/model, flipping a round Complete, or approving a diff. Human-invoked; can be gate-prompted. Pick the mode by the situation, not the mood — reach for challenge under speed or a big lock-in. Trigger phrases include "cold-reviewer", "double-check this before I lock", "challenge this", "pre-mortem this", "what am I not seeing".
argument-hint: '<target: round-file | diff | described-decision> [--mode challenge|fair|constructive|mix]'
allowed-tools: Read, Grep, Glob, Bash(grep *), Bash(git diff *), Bash(git log *), Bash(git show *)
metadata:
  author: hand-authored-2026-06-24
  version: '1.0'
  status: registered — Track-2 (agent-method, decision-hygiene). Pulled by R92 planning (a cold-reviewer pass caught the resolveConnect/provenance seam + pinned the qr_-node scope before build). Concept: ../../plan/brainstorms/2026-06-24-s3-anchors-feedback-skill.md
---

> The *why* behind every rule here lives in [`references/theory.md`](references/theory.md)
> (S1/S2/S3, WYSIATI, "cold" = pre-registered). This skill is **registered** (a `.claude/` pointer +
> a [`../README.md`](../README.md) index line), so the runtime auto-discovers it at session load.

## What it does

At a **lock-in moment**, run a **fixed, cold-authored anchor-set** against the decision about to
commit, to force blind spots into view before the human locks it. **Surfaces, never decides.**
(When to run + trigger phrases: the `when_to_use` frontmatter.)

**Don't** run it as ceremony on a trivially-reversible or already-verified step — a rubber-stamped
check manufactures the false confidence it exists to puncture.

## Inputs

- `target` — what's about to commit: a round-file path, a `git diff` / PR, or a described decision.
- `mode` _(optional)_ — `challenge` | `fair` | `constructive` | `mix`. Missing → use `mix`; an unknown value → use `mix` and note the fallback in the report.

## Modes — one axis: reviewer posture toward the decision

The posture is how the reviewer (S3, in the [theory](references/theory.md)) leans toward the
decision — _against → neutral → for_. It is the only thing the mode changes; **all anchors run
every time**.

| Mode              | Disposition   | What it does                                                                                  |
| ----------------- | ------------- | --------------------------------------------------------------------------------------------- |
| `challenge`       | adversary     | tries hardest to **break** the decision                                                       |
| `fair`            | neutral judge | genuine strengths **and** flaws, no inflation                                                 |
| `constructive`    | ally          | points at **what would strengthen** it / what to verify — _verification directions, not implementation or final decisions_ |
| `mix` _(default)_ | all           | `fair` pass → `challenge` the weakest point → `constructive` on next steps                     |

`constructive` is the comfortable mode — use it to **harden an already-made decision**, not while
deciding whether to lock.

## The anchor-set (fixed — run all six; do not substitute softer ones)

Each answer must be **grounded** or marked **could-not-verify** — never a fluent assertion. Prefer
exact `file:line` evidence; if line numbers aren't available, cite the smallest stable pointer you
have: file path, diff hunk, commit hash, PR section, or a quoted excerpt of the target.

1. **Ground the story** — what does the decision *assert* that no one *read*? Open the file/line; does it still say what the story says?
2. **Pre-mortem** — assume it shipped and created debt. Name the cause in one line. Is it already visible now?
3. **Deferrals** — what does it explicitly *not* do? Is each deferral a named boundary with a why, or unexamined? Any scope left ambiguous?
4. **Counter-case** — *make* the strongest argument against it (don't assert it's weak). What would have to be true for the opposite to be right?
5. **Reversibility** — one-way or two-way door? If wrong, how cheap to undo? Does that justify locking now vs. one more check?
6. **Confidence source** — evidence, or a small/lucky sample? What's the reference class / base rate?

## Procedure

1. **Resolve** target + mode. Read the target and the evidence it leans on (for a round file, the actual gate it's about to close).
2. **Run every anchor — ground each.** Read / Grep / `git diff` to verify. Record per anchor: **surfaced concern** (+ pointer), **clear** (+ pointer), or **could-not-verify** (name what you couldn't check). No verdict without a citation or an explicit could-not-verify.
3. **Apply the mode's disposition** to tone and to how hard anchor 4 is pushed — not to which anchors run.
4. **Emit the report**, then stop.
5. **Do not decide, edit, or advance a gate.** Only the human locks.

## Output — inline, no file written

```text
cold-reviewer [<mode>] — <target>

| Anchor              | Verdict                             | Evidence / concern (pointer)        |
|---------------------|-------------------------------------|-------------------------------------|
| 1 Ground the story  | surfaced / clear / could-not-verify | <one line + file:line / round:line> |
| 2 Pre-mortem        | …                                   | <…>                                 |
| 3 Deferrals         | …                                   | <…>                                 |
| 4 Counter-case      | …                                   | <…>                                 |
| 5 Reversibility     | …                                   | <…>                                 |
| 6 Confidence source | …                                   | <…>                                 |

Before you lock — check these (highest-value first):
- <surfaced concern → the one verification or decision that would resolve it>

Could not verify (do not read as "clear"):
- <what, and why — what evidence was missing>

cold-reviewer surfaces; it does not decide. You lock.
```

## Quality bar

- **Grounded-or-silent.** Every verdict cites evidence or is `could-not-verify`. An ungrounded challenge is contrarianism — noise.
- **Fixed anchors.** Run all six; never quietly swap in a softer set to make the decision look ready.
- **Surfaces, never decides.** No auto-edit, no gate advance, no "ship it." If S3 decides, automation bias replaces the bias it was meant to catch.
- **Name what you couldn't check.** A `could-not-verify` beats a confident `clear`; never let missing evidence read as a pass.
- **Keep the human's frame.** Surface in the human's terms; don't let S3's framing overwrite the decision.
