# After a write, every read the write changes must re-read — check the after-state, not the toast

**Date**: 2026-10-19
**Agent**: Claude Code (coder of the four-role loop, Round_200)
**Confidence**: Medium-high — two incidents in one round on two different caches (a read the
write's own confirm depends on; a panel beside the noun), the same class `review-cr` item 6
names for widgets (R192 R4, R195 P1); both passed the round's own tests, which ran with a
`QueryClient` that had no `staleTime`
**Status**: Promoted (item 10 of [`skills/review-qa`](../skills/review-qa/SKILL.md))

## Problem

The builder's `QueryClient` keeps reads fresh for 60 s (`main.tsx`; the metadata hook 30 s). A
mutation that changes what another read returns must invalidate that read, or the page shows
the old state next to a success toast. Tests built on a bare `new QueryClient()` (no
`staleTime`) re-fetch on every mount and hide the gap; so does a screenshot that is checked for
its toast only.

## Finding

| Round                               | Write                        | Read left stale                                        | Who found it                                                   |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| [R200](../plan/cycles/Round_200.md) | a dataset refresh            | the history version read behind the restore warning    | QA-1 (= CR-3): a test with the app's defaults                  |
| [R200](../plan/cycles/Round_200.md) | a definition restore (a PUT) | the Metadata panel (set-aside notes under `wdg_…` ids) | BA pass 2 (BA-F1 = QA-4): the coder's own screenshot showed it |

## Evidence

- `workspace/apps/builder/tests/definition-history-r200-adversarial.test.tsx` (the fresh-read
  case) and `definition-history-r200.test.tsx` § "BA pass 2 folds" — both wrap the page in a
  `QueryClient` with the app's `staleTime: 60_000` and fail without the fix.
- `scratchpad/r200/shots2/vi-f-restored-toast.png` (before / after BA-F1).

## Recommendation

**Do**:

- For every new mutation, list the reads whose answer it changes (the noun, its lists, its
  history, its notes, the widgets reading it) and invalidate each in `onSuccess`.
- Write the test of an after-state with the app's `QueryClient` defaults, not a bare client.
- Read every after-screenshot for leftover state — panels, badges, lists — not only the toast.

**Don't**:

- Don't count a green test that re-fetches on mount as proof that a cache is invalidated.

## Cross-references

- `review-cr` item 6 (cache invalidation after a PUT — the code-side check of the same class).
