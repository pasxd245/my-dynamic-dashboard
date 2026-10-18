---
name: review-ba
description: Fixed business-review checklist for one round in the four-role loop, run twice — at Contract exit (spec + design + contract diff, before any code) and after the build (built behaviour vs acceptance criteria, then the walk script). Carries the missing-side matrix, the second-user test and the pointers to decisions 1–14 and the accepted design's D-points. Run by the `ba` agent. Grades P0/P1/P2; ends with PASS or CHANGES.
when_to_use: Pass 1 at Contract exit, before B/F; pass 2 after the F commit, before the round moves to Review. Inputs are the round file, the diff and the program docs only. Trigger phrases include "BA review R<NN>", "contract exit review", "review-ba".
argument-hint: '<round: Round_NNN.md> <base: commit the round opened on> --pass contract-exit|after-build'
allowed-tools: Read, Grep, Glob, Bash(git diff *), Bash(git log *), Bash(git show *), Bash(pnpm *), Bash(uv run *), Bash(rg *)
metadata:
  author: hand-authored-2026-10-18
  version: '1.0'
  status: 'registered — Track-2 (agent-method). Pulled by rc3.md § Execution (four-role loop) and the R191–R197 audit: the contract-exit pass found 4 P0 and 15 P1 before code across R192–R194 and R197; two rounds ran without it. Agent: .claude/agents/ba.md'
---

> The role contract (inputs, output schema, grading, what it never does) is
> [`.claude/agents/ba.md`](../../../.claude/agents/ba.md). This file is the **checklist** that
> contract points at. Every item runs on every pass; answer each with evidence or `n/a (why)`.

## Pointers (read before either pass)

- **Decisions 1–14** —
  [`release-rc2-rc5.plan.md` § Settled decisions](../../plan/programs/release-rc2-rc5/release-rc2-rc5.plan.md#settled-decisions-human-2026-10-13-2026-10-15-and-2026-10-17)
  (7 parameters are typed values · 8 saved copy in `<workspace>-saved` · 9 metadata view-only ·
  10 no fuzzy matching · 11 no dataset classification · 13 compute catalog v1 · 14 a version is the
  12-hex hash).
- **Firewall** — same file § Scope + firewall: a round may not open the next rc's items; no user's
  column names, rules, thresholds or numbers in the repo.
- **D-points** — the accepted design doc the round cites, e.g.
  [`dashboards/dashboard-filters.md`](../../design/dashboards/dashboard-filters.md) D1–D7
  (Accepted 2026-10-18); for 3.6b
  [`workspaces/saved-copies.md`](../../design/data-management/workspaces/saved-copies.md).
- **Second-user test** — "would a second user, with a different CRM export, want exactly this
  with no change?" (`release-rc2-rc5.plan.md` § Why).

## Contract-exit checklist (pass 1)

1. **Shape vs the accepted design** — every field, code and route in the contract diff maps to a
   D-point or an item line; anything off it is a **P0** (one-way door) and a hard stop.
2. **Decisions 1–14** — the contract contradicts none (e.g. a version that is not the hash, a
   parameter that is not a typed value, metadata written from the UI).
3. **Missing-side matrix** — for every new state, label or comparison, fill the matrix:

   | state / label | no run yet | no default | rc.2 rows (written before) | deleted noun | empty list |
   | ------------- | ---------- | ---------- | -------------------------- | ------------ | ---------- |
   | `<state>`     | defined?   | defined?   | defined?                   | defined?     | defined?   |

   A cell with no defined behaviour is a **P1**: it will render as the happy state by default
   (R197 — `current` for an unstamped run, a vanished query and rc.2 rows; R192 — an unstamped run
   had to become `never_run`; R195 — a rename path with no `controls` argument wiped them). Memory:
   [missing-side-matrix](../../memory/2026-10-18-missing-side-matrix.md).

4. **Second-user test** on every new word, field and rule.
5. **Who asserts the fact** — a value the server can know (a dashboard's saved value, a version, a
   run stamp) is never taken from the client's say-so (R194 F1; R197 "the anchor ignores
   client-sent versions").
6. **Used vs declared** — a thing declared but not used (a parameter, a control target) never
   claims to have been applied (R194 F2).
7. **What leaves the app** — anything a saved export must say is in the file, not only in a
   response header (R194 P2 → R196). Memory:
   [file-outlives-its-headers](../../memory/2026-10-18-file-outlives-its-headers.md).
8. **Refusals** — each new refusal has a code, a status, a body the UI can act on, and a place in
   the route's `oneOf`; a scripted edit of many routes is re-read file by file (R193 P0-1).
9. **Firewall** — nothing from the next rc; no user data, names or numbers (the boundary words).
10. **Reversibility** — what a user cannot undo (a re-publish, a delete) has a confirm that names
    what is lost (R192 P1-2).

## After-build checklist (pass 2)

1. **Each acceptance criterion** — the test that claims it asserts the criterion's words (open
   it); if the test is weaker than the criterion, run the surface.
2. **Contract-exit findings as built** — each `BA-Cn` closed by code, not by a doc change.
3. **Write paths** — every affordance that writes is absent or refused where the design says
   read-only (R193: Upload still reachable in a saved workspace — missed by the route guard).
4. **Routing of values** — when the server resolves and the client only routes, check who sends
   which value to which read and what a link pins (R195 Copy link; N-1 mixed values).
5. **Copy** — EN and VI, user-space words (no raw type names, no internal indices), the glossary.
6. **Design docs** — the design corpus says what was built (R191: six docs that lied).
7. **Walk script** — one ⬜ item per surface touched: named control, gesture, expected words;
   relocate from the criteria, drop what a test closes (`plan/PDCA.md` § acceptance walk).

## Output

Per [`ba.md`](../../../.claude/agents/ba.md) § Output schema — ids `BA-Cn` / `BA-Fn`, the
matrix, `duplicates`, the walk script (pass 2), `could-not-verify`.

## Quality bar

- A business question the owner has not decided is written as a question, not answered.
- Grounded-or-silent; fixed list; surfaces, never fixes.
