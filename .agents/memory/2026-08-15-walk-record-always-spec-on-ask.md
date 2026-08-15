# The acceptance walk: record always, spec on ask

**Date**: 2026-08-15
**Agent**: claude-opus-5
**Confidence**: High — four instances across four rounds and four domains, none refuted
**Status**: Promoted (rule lives in [plan/PDCA.md](../plan/PDCA.md) § Round Template)

## Problem

Every human-handover gate (DFCFBI's F1/F2, DCFBI's Integration) ends with a human in front of
a real surface. From [Round_165](../plan/cycles/Round_165.md) onward the rounds recorded that
handover as a numbered list of **walk questions** with ⬜ verdicts and a `coverage: N of M`
line — and it kept catching things every automated gate missed.

But the artifact had **no repo definition and no lint**, so it travelled round to round **by
imitation**. Imitation transmits accidents as faithfully as intent, and it did:

- **The count was an unexamined anchor.** R165–R168 and R171's first draft each wrote exactly
  **five** questions. Nothing ever prescribed five. In R171 it cost item 3 its walk question,
  recovered only because the human noticed and it was re-added as T6.
- **Its entire spec lived in an agent-private memory file** the repo cannot read, while four
  round files cited a slug (`walk-record-always-spec-on-ask`) that resolved to nothing.

## Finding

**A walk question works by putting a human in front of a surface — and what they notice is not
bounded by what you asked.** The question is a *pretext for attention*, not a test assertion.
That is precisely the property no test and no lint can reproduce, and it is why the record of
the walk has to survive in the round file rather than in a passing green check.

The evidence is that in four of four rounds, the walk returned **defects that none of its own
questions were about**:

| Round                                        | The question asked about…            | What the human actually found                                                                                    |
| -------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [R165](../plan/cycles/Round_165.md) `5 of 5` | the ordered-window numbers           | **six** defects after every gate was green — incl. **W-7**, a pager bug latent since R125 (33 of 96 rows twice)   |
| [R166](../plan/cycles/Round_166.md) `5 of 5` | Duplicate replacing composition      | header action order — `[Duplicate][Edit][Delete]`, caused by a doc sketch                                         |
| [R167](../plan/cycles/Round_167.md) `5 of 5` | whether `qr_` traces still resolve   | canvas layout never persists (W-1)                                                                                |
| [R171](../plan/cycles/Round_171.md) `6 of 6` | a preview panel naming a dead server | **a silent failed Save** — the human pressed Save, not edit; `onError` was missing. The only defect that loses data |

R171 is the sharpest instance: **`tsc`, 375 builder tests, 440 backend tests and five linters
were all green** over a mutation with no error branch. The human's gesture was *not the one the
question specified*, and that is the whole mechanism.

[R168](../plan/cycles/Round_168.md)'s walk was **skipped** — the only skip in the series. It is
the counter-example the ledger needs, not a refutation: it produced no finding because it never
put a human in front of anything.

### The trigger is part of the artifact — and imitation could not carry it

The rule's first draft (R173) made the walk **unconditional**, and the first round to apply it
over-applied it: a governance round with no exercisable surface wrote three "read this document"
questions in walk format. The human refused them on read — _"không phải lúc nào cũng cần đúng
ko?"_ — and the item gained a trigger condition the same day.

**Why five rounds of hand-use never surfaced this**: R165–R171 all happened to have a surface, so
every instance qualified. Imitation transmitted the question *format* perfectly and the
*applicability* not at all — a blind spot a dogfood ledger cannot see, because a ledger only
records the cases that fired. The complement is now explicit: **surface rounds are guarded by a
human walk; engine rounds by measurement at scale** (R172), **docs rounds by review and lints**.

## Evidence

- Round files: `plan/cycles/Round_{165,166,167,168,171}.md` — `## Check` sections
- R171's two extra findings, both recorded at its close:
  - **the count anchor** (five was imitation, never a rule) — see R171 § Check;
  - **a verdict can arrive globally** — the human's general remark *was* the re-walk verdict
    for three items, and it was first filed as small talk (`23a0d34`). Related: a walk verdict
    has a **third state** — "fixed, UNWALKED" is neither PASS nor FAIL (`07f147d`).
- Gate-green-but-broken proof: R171 W-2, five linters + 815 tests green over a silent `PUT`.

## Recommendation

**Do**

- **First, check the trigger.** A walk applies to rounds that change something a human can
  **exercise** — a UI surface, or observable product behaviour. If nothing qualifies, there is
  no walk: log an explicit **skip + reason** and name what guards the round instead. An
  engine-only round is guarded by **measurement at scale** (R172 found a data-loss bug at 400k
  rows that no walk could have surfaced); a docs/governance round by review and lints.
- When it applies, `## Check` **always** carries the questions, ⬜ verdicts, and
  `coverage: N of M`. The *record* is unconditional; the *walk* is not.
- **Let the count follow the surfaces** the round touched. There is no prescribed number.
- **Relocate** questions from the round's own acceptance criteria and Risks; do not invent a
  parallel set.
- **Drop any question an automated test already closes** — the walk's value is where tests
  cannot see.
- Name the **card / control / surface** a step acts on, so the gesture is reproducible.
- **Grade the gesture, not the outcome.** In R165 a `FAIL` was logged on an assumption about
  which card the human moved, and their own number overturned it.
- Accept verdicts that arrive **outside** their question's frame, and globally.

**Don't**

- Don't write exact click-steps unless the human asks — they are noise at the record layer,
  and a compressed prose chain is itself a failure surface (R163: the human built a 4-step
  variant that dropped both `derive`s; the re-test that answered the question was 2 cards).
- Don't treat a green gate as a substitute. Four for four says otherwise.
- Don't read a skipped walk as a pass.

## Promotion Candidate?

- [x] `plan/PDCA.md` § Round Template — **done** (R173): the rule, ~5 lines.
- [ ] `skills/` – **deliberately not.** A skill could check that a walk was *recorded*; it
      cannot check that its *return* was read, which is the only part that matters.
- [ ] `context/` – not yet; `plan/` is the right altitude for a round-mechanics rule.

---

**Not enforced by a lint, on purpose** — adopt-and-dogfood first, mechanize only if hand-use
proves the artifact is read (see `2026-07-11-adopt-artifact-defer-enforcement` in the agent's
memory; same call as the R159 `⟢ At a glance` block).

_Track: 2 (agent-method). Pulled by: R171's count anchor + four round files citing an
unresolvable slug._
