# A comparison label needs a test per absent input — the missing-side matrix

**Date**: 2026-10-18
**Agent**: Claude Code (coding agent, milestone M1.1–M1.2 of the rc.3 agent-method track)
**Confidence**: High — three rounds, three domains, the same shape each time
**Status**: Promoted (checklist item 3 of [`skills/review-ba`](../skills/review-ba/SKILL.md) § Contract-exit)

## Problem

A label that **compares two states** ("current" vs "another period", "up to date" vs "stale",
"published from run #N") is specified for the case where both sides exist. Every way one side can
be **absent** is left to the default branch — and the default branch renders the happy label.

## Finding

Each absent input is its own bug, and they do not share a fix. R197 named the lesson as a
candidate ("a label that compares two states needs a test for every way one side can be missing");
it had already fired twice:

| Round                               | The comparison                       | The absent side that read as the happy state                                                                                          |
| ----------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| [R192](../plan/cycles/Round_192.md) | publish vs the run stamp             | a run **before stamps existed** (pre-R187) had no stamp → treated as publishable; BA P1-1 made it `never_run`                         |
| [R195](../plan/cycles/Round_195.md) | saved controls vs the dashboard body | the **rename path** built the definition without the new `controls` argument → an absent input wiped them (P0, raised by CR and BA)   |
| [R197](../plan/cycles/Round_197.md) | the metadata anchor vs the page      | **no run yet**, **no default**, **rc.2 rows** (no anchor), a **deleted query** — each read `current`; QA found the fourth after build |

The inputs that can be absent are a short, repeating list: **no run yet · no default · rows
written before this round (rc.2 rows) · the noun was deleted · an empty list**. A matrix of
_every new state × that list_ at Contract exit asks each cell "what does the contract say?" — a
cell with no answer is a P1 before any code exists.

## Evidence

- Round files: `plan/cycles/Round_192.md` § Do (BA P1-1), `Round_195.md` § F (the rename P0,
  `widgetsToDefinition` now takes `controls` as a required argument), `Round_197.md` § C (P0-1 to
  P0-3, P1-2 `assumedParams`) and § F (QA P1 `query_versions` on a parameter without a default,
  commit `5cac7fd`).
- Code: `workspace/apps/backend/app/metadata.py` (`state_of`), `tests/test_metadata_anchor.py`
  (one test per state and per absent side).

## Recommendation

**Do**

- At Contract exit, for every new state / label / comparison, write the matrix row
  (`state × {no run, no default, rc.2 rows, deleted noun, empty list}`) and name the behaviour of
  each cell in the contract or the design doc.
- Make "I don't know" an explicit state (`never_run`, `assumedParams`, `other_definition` for a
  vanished query), never the happy default.
- One test per cell that is not `n/a`; QA's live probe includes the cells.

**Don't**

- Don't let a rename / move / copy path rebuild an object from a subset of its fields — pass the
  new field as a required argument so the compiler finds the path that forgot it.
- Don't accept "the round has no new state" without the list of states checked.

## Promotion Candidate?

- [x] `skills/` — `review-ba` § Contract-exit item 3 (done, 2026-10-18).
- [ ] `context/` — not yet; a third program using the matrix would justify it.

---

_Track: 2 (agent-method). Pulled by: R197 § Act candidate lesson, recurred from R192 and R195;
promoted at the 2026-10-18 audit per rc3.md § Execution "a lesson that recurs a second time is
promoted in that round"._
