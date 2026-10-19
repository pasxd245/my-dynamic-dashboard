---
name: review-qa
description: Fixed QA checklist for one round in the four-role loop — gates re-run from a clean state, migration upgrade → downgrade -1 → upgrade on a populated fake database, a live backend / dev-server probe of every acceptance criterion, the visual gate in light EN + VI with screenshots inspected, adversarial tests kept when they pass on the fixed code. Run by the `qa` agent after the F gate. Grades P0/P1/P2; ends with PASS or CHANGES.
when_to_use: After a round's F commit, in parallel with the code review, and again on the fix commit. Inputs are the round file, the diff and a clean checkout only; nothing is taken from the coder's word. Trigger phrases include "QA R<NN>", "re-run the gates", "review-qa".
argument-hint: '<round: Round_NNN.md> <base: commit the round opened on> [--recheck QA-1] [--no-ui]'
allowed-tools: Read, Grep, Glob, Bash
metadata:
  author: hand-authored-2026-10-18
  version: '1.0'
  status: 'registered — Track-2 (agent-method). Pulled by rc3.md § Execution (four-role loop) and the R191–R197 audit: the live probe found the P1 both read-only reviews missed in R196 and R197, and R195 needed a browser for three P1s. Agent: .claude/agents/qa.md'
---

> The role contract (inputs, output schema, grading, what it never does) is
> [`.claude/agents/qa.md`](../../../.claude/agents/qa.md). This file is the **checklist** that
> contract points at. Every item runs every round; answer each with evidence or `n/a (why)`.

## Checklist

1. **Gates from a clean state** — in a fresh worktree at HEAD: `pnpm -s config:render`; backend
   `uv run python -m pytest -q -p no:cacheprovider` and `uv run ruff check app tests`; builder
   `pnpm --filter builder test` and `type-check`; contracts `pnpm --filter @mdd/contracts test`;
   root `pnpm -s md:lint`, `plan:lint`, `design:lint`, `design:tokens`. Record every count. A
   count that differs from the round's `## Check` line is a finding (P1 if a test is red, P2 if
   only the number moved and the round file is wrong).
2. **Tests fail on the pre-round code** — for each new test file, run it against `<base>` (a
   worktree); a test that passes there proves nothing (R191: one backend test did not fail).
3. **Migration on a populated fake database** (rounds with one) — build the database through the
   **pre-round** app: two workspaces, uploads, a relationship, saved queries, a dashboard, a
   workflow run, metadata entries. Then `uv run alembic upgrade head`, `downgrade -1`,
   `upgrade head`; compare every table's rows before / after; `PRAGMA foreign_key_check` empty; a
   cascade delete still works. Repeat through the app's startup migration path. Any lost row is a
   P1; a downgrade that fails is a hard stop.
4. **Live probe of every acceptance criterion** — start the stack (`pnpm dev` /
   `scripts/dev/local-up.sh`); for each criterion perform the user's action with `curl` or the
   browser against the real backend and read the real response. A criterion a unit test calls
   green but the live run fails is a P1 (R196 Filters sheet; R197 a note that never read
   `refreshed`). Include the **missing-side** cases the BA listed (no run, no default, rc.2 rows,
   deleted noun, empty list).
5. **Adversarial tests** — write tests that try to break each criterion (bad types, huge values,
   reversed ranges, non-ASCII names, a formula-looking name, a concurrent save); keep only those
   that pass on the fixed code, under the round's test files.
6. **Regression proof for untouched shapes** — a read with none of the round's new inputs answers
   byte-identically to `<base>` (R194: 11 shapes at HEAD vs the previous close-out).
7. **Visual gate** (UI rounds) — headless browser on the real backend, **light** theme, **EN and
   VI**, one screenshot per surface the round touched (new states included); **dark** only if a
   theme exists — today none (`themeTokens.ts` default algorithm only) → record `dark N/A`. Open
   every screenshot and look at it before grading; a surface that cannot be reached is a P1.
8. **Files that leave the app** — open an exported CSV / XLSX: the cells say what the criteria
   say (versions, parameters, labels); no `<f>` element in any workbook part; a `=`-leading name
   stays text. Memory:
   [file-outlives-its-headers](../../memory/2026-10-18-file-outlives-its-headers.md).
9. **Boundary** — nothing you created is left under `workspace/apps/backend/data/`; no customer,
   company or person name in any added line; screenshots and fake data under the scratch
   directory only.
10. **After-state of every write** — for each mutation the round adds or touches, look at what the
    page shows after it (screenshot and test), not only the toast: every read the write changes
    (the noun, its lists, its history, its notes, the widgets reading it) shows the new state at
    once. Write that test with the app's `QueryClient` defaults (`staleTime` 60 s, `main.tsx`) —
    a bare client re-fetches on mount and hides a missing invalidation (R200 QA-1, BA-F1). Memory:
    [stale-cache-after-a-write](../../memory/2026-10-19-stale-cache-after-a-write.md).
11. **Equality gates run more than once** — a parity, byte-equality or "same answer twice" test
    is re-run **at least 5×** (a loop, fresh state each time) before its green is trusted; one
    red run in the loop is a P1 until its cause is named — usually a read with no explicit order
    (R201 QA-4: a grouped `/aggregate` read with no `ORDER BY` passed every gate run of the
    coder's parity test and failed QA's 40-read probe). Record the loop count. Memory:
    [explicit-order-not-engine-default](../../memory/2026-10-19-explicit-order-not-engine-default.md).

## Output

Per [`qa.md`](../../../.claude/agents/qa.md) § Output schema — `gates (clean)`, `migration`,
findings `QA-n`, `visual gate`, `duplicates`, `adversarial tests kept`, `could-not-verify`.

## Quality bar

- Nothing taken on the coder's word: every count, PASS and screenshot is produced in this run.
- Fixed list; `n/a (why)` for an item the round genuinely lacks (no migration, no UI).
- Surfaces, never fixes product code; the adversarial tests are the only files it adds.
