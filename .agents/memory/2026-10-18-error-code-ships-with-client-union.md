# A new error code ships with its client union, MSW and types in the same commit

**Date**: 2026-10-18
**Agent**: Claude Code (coding agent, milestone M1.1–M1.2 of the rc.3 agent-method track)
**Confidence**: High — three rounds, each a different link of the same chain
**Status**: Promoted (checklist item 4 of [`skills/review-cr`](../skills/review-cr/SKILL.md))

## Problem

An error code is one value with **six homes**: the contract enum and the route's `oneOf`, the
config `values.yaml`, the generated backend constants, the builder's `ApiError` union with
`isApiError`, the MSW handler, and the EN/VI copy that renders it. A commit that adds the code to
some of them passes every gate — the contract tests see the enum, the backend tests see the
constant — and the user sees the generic toast.

## Finding

R192 named the candidate ("a new API error code ships with its client union in the same round").
It had already fired, and fired again:

| Round                               | Link that was missing                                                                     | What the user would have seen                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [R192](../plan/cycles/Round_192.md) | `not_publishable` absent from the builder `ApiError` union (CR R1, P1)                    | the generic toast; the Publish button stayed enabled after a server refusal                |
| [R193](../plan/cycles/Round_193.md) | a scripted edit of 19 routes broke `datasets/batch-post`'s 409 `oneOf` (BA P0-1)          | the legacy 409 lost its body schema; `read_only_workspace` also missed the enum until R194 |
| [R196](../plan/cycles/Round_196.md) | `export_too_large` added to the guard in-round — the case the rule was written to prevent | (caught by the rule; kept here as the instance that shows it is now a habit)               |

The chain is linear and greppable; the failure is never in the link that was added, always in
the one that was not.

## Evidence

- `workspace/packages/contracts/_shared/api-error.yaml` (enum + body schemas + per-route
  `oneOf`), `workspace/config/values.yaml`, `workspace/apps/backend/app/_generated/constants.py`
  (rendered by `pnpm -s config:render`),
  `workspace/apps/builder/src/features/data-management/_shared/types.ts` (`ApiError`,
  `isApiError`), `workspace/apps/builder/src/mocks/handlers.ts`,
  `workspace/apps/builder/src/i18n/locales/{en,vi}.json`, `tests/test_schema_parity.py`.
- Round files: `Round_192.md` § Do (R1 and its fix), `Round_193.md` § Do (P0-1),
  `Round_194.md` § C ("the closed code enum gains `read_only_workspace` (missed in R193)").

## Recommendation

**Do**

- Add a code to all six homes in **one commit**; the code review greps the new code's name and
  expects six files in the diff (or a stated reason for fewer).
- After any scripted edit of many contract files, load each file and re-check every `oneOf`.
- A client-visible refusal has a test that asserts the **rendered** message, not only the status.

**Don't**

- Don't let `isApiError` fall through to a generic toast for a code the contract names.
- Don't add a code to the enum "for later" — an enum entry with no body schema and no client
  branch is a lie the parity test cannot see.

## Promotion Candidate?

- [x] `skills/` — `review-cr` item 4 (done, 2026-10-18).
- [ ] A lint that diffs the six homes — only if the checklist item is missed once more.

---

_Track: 2 (agent-method). Pulled by: R192 § Act candidate lesson, recurred in R193 and R196;
promoted at the 2026-10-18 audit._
