# Bind-time validation vs drift — a bad late-bound value is `param_invalid`, never `query_stale` or 500

**Date**: 2026-10-18
**Agent**: Claude Code (coding agent, milestone M1.1–M1.2 of the rc.3 agent-method track)
**Confidence**: High — four instances in two rounds, one of them a P0
**Status**: Promoted (checklist item 5 of [`skills/review-cr`](../skills/review-cr/SKILL.md))

## Problem

A value that arrives **late** — a parameter from the URL, a viewer value, a cell in a refresh
file — meets the engine's existing validation, which was written for a different question: "has
the definition drifted from the schema?" (`409 query_stale`) or "is this a number?" (a silent
coercion). A bad value then reports as the wrong kind of fault, or as no fault at all.

## Finding

R194 named the candidate ("when a value is bound late, make sure the engine's later validation
cannot report the value's fault as drift — check the value at bind time, against the column it
lands on"). The same shape had produced R191's only P0:

| Round                               | The late value                                       | What it reported                            | What it should say                                  |
| ----------------------------------- | ---------------------------------------------------- | ------------------------------------------- | --------------------------------------------------- |
| [R191](../plan/cycles/Round_191.md) | a refresh cell `"1,200"` / `n/a` on a numeric column | **0** — counted silently (BA P0-1)          | the empty state / `coercion_failed`, never a number |
| [R194](../plan/cycles/Round_194.md) | a non-whole number on an integer column              | `409 query_stale` (CR P1)                   | `422 param_invalid` naming the parameter            |
| R194                                | an integer beyond 2^63                               | **500** (CR P1)                             | `422 param_invalid`                                 |
| R194                                | a reversed `between` (max < min)                     | `409 query_stale` (CR P1, also found by QA) | `422 range_reversed` with `source`                  |

The engine's drift check runs **after** binding; by then the bad value looks like a definition
that no longer fits its column. The fix is the same each time: validate the value **where it
binds**, against the dtype of the column it lands on (`site_dtypes`, between-aware), and answer
with the input's own code.

## Evidence

- `workspace/apps/backend/app/params.py` (`bind`, `site_dtypes`, whole numbers on integer sites,
  ±2^63 and ASCII decimals, `range_reversed` with `source: default`), `tests/test_params.py`.
- `workspace/apps/builder/src/features/dashboard/WidgetView.tsx` `allCellsNumeric` (R191 P0-1
  fix, test with `"1,200"` and `n/a`).
- Round files: `Round_191.md` § Do (BA P0-1), `Round_194.md` § B, F and the reviews (CR P1 ×3,
  fix `6c17a89`).

## Recommendation

**Do**

- Every late-bound input has a bind-time check against the column it lands on; the refusal
  carries the input's name, the expected type and the source (`viewer` / `dashboard` / `default`).
- Reserve `query_stale` / `relationship_stale` for a **definition** that drifted; a bad **value**
  is `param_invalid` / `coercion_failed` / `range_reversed`.
- Adversarial QA for each late input: non-whole, huge, reversed, non-ASCII, empty, formula-looking.

**Don't**

- Don't coerce silently; a value that does not fit is a refusal or the empty state, never 0.
- Don't let a `today` default that moves past a literal bound answer as drift (R194 rolling log —
  revisit with 4.2 presets).

## Promotion Candidate?

- [x] `skills/` — `review-cr` item 5 (done, 2026-10-18).
- [ ] `context/` — not yet.

---

_Track: 2 (agent-method). Pulled by: R194 § Act candidate lesson (three P1 in one round) and
R191's P0; promoted at the 2026-10-18 audit._
