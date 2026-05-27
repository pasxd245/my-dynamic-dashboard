---
decided: 2026-05-27
status: active
revisit-when: each queued item's named trigger fires, or a new failure mode pulls a reorder
tracks: 2
---

# Decision: Verification stack — ordered queue with named triggers

**Commitment**: The verification gap (intent ↔ reality divergence
caught only by human testing) is a single problem visible from five
angles. It will be closed in **ordered, one-per-round increments** with
named pulls — never bundled.

## Why

The five angles, all the same root cause:

1. ASCII design ≠ rendered UI (R33 design → R36 implementation slips).
2. In-conversation contradiction drift across long sessions.
3. MSW-less FE/BE sequencing forces contracts → BE → FE serial chain.
4. No E2E behavior coverage (R36 "browser-eye walk skipped").
5. All current checks are retrospective and human-driven.

Per the current PDCA cadence in [plan/PDCA.md](../plan/PDCA.md)
and the Evolution Rule's "smallest useful change" guard, one feature
lands per round. Bundling these would re-create the drift this horizon
is designed to prevent.

## Queue (ordered)

1. **MSW** — ✅ **Landed (R41)**.
   *Pulled by*: R34 → R35 → R36 sequencing cost. Unlocks
   contracts → (FE ∥ BE). [Round_41.md](../plan/cycles/Round_41.md)
   added `msw` as a builder devDependency, authored
   `src/mocks/{fixtures,handlers,server,browser,start}.ts`,
   wired MSW into `tests/setup.ts` (Node server with
   `onUnhandledRequest: 'bypass'` so legacy `vi.stubGlobal(
   'fetch')` tests coexist), wired a `VITE_MOCKS=1` dev-mode
   opt-in in `main.tsx`, and migrated
   `tests/dataset-detail.test.tsx` as the proof of pattern.

2. **Pattern-import paragraph in design skill** — to land via a future
   skill edit, not as part of this decision.
   *Pulled by*: minimal-UI cost-of-rederivation (this conversation).

3. **`.agents/decisions/` register + AGENTS.md link** — this commit lands it.
   *Pulled by*: drift-via-contradiction failure mode.

4. **Preview-HTML in design rounds** — process change in the design skill.
   *Trigger*: next design round (post-R37) catches a layout surprise
   ASCII would not have caught.

5. **Playwright baseline** — parked.
   *Trigger*: R30 visual-verification gate slips again on a future FE
   round, OR a regression escapes vitest+RTL.

6. **Memory retriever** — parked.
   *Trigger*: N_memory_files > 50, OR 3+ incidents of relevant memory
   not surfaced when it should have been.

7. **Decisions-consistency sub-agent** — parked.
   *Trigger*: a contradiction-drift event recurs *and* we have the
   receipts (file diffs / conversation excerpts) to train against.

## What this forbids

- Bundling two queue items into one round.
- Reordering without a named pull (impatience doesn't qualify).
- Adding items 8+ without first retiring or de-parking an earlier item.
- Custom verifier frameworks (see [r99-evo-horizon](2026-05-27-r99-evo-horizon.md)).

## Not in the queue

- Storybook — too heavy for current scale.
- Visual regression tooling (Percy / Chromatic) — irrelevant at POC stage.
- Mutation testing, snapshot suites — no pull observed.

## Trade-off accepted

Some verification gaps stay open for many rounds (Playwright trigger
may not fire until R45+). We accept this because the cost of premature
tooling investment (re-derived for the wrong scale) is higher than the
cost of catching a regression by human-eye one more time.

*Track: 2. Pulled by: 2026-05-27 conversation; R36 Do log
"browser-eye walk skipped (headless this turn)".*
