# Round 68: Minimal harness enforcement — auto-run the gates that earn it

**Status**: Complete
**Date started**: 2026-06-12
**Date completed**: 2026-06-12

## Goal

**Inherits from ← [Round_67](Round_67.md)** — R67 made the round
template self-enforcing (`plan:lint`) and its Feeds-into named this pull:
_auto-run the gates so manual `pnpm` invocation can't slip._ Plan-time
grounding confirmed the gap: [`.husky/pre-commit`](../../../.husky/pre-commit)
runs **only** `config:render`, so [`.lintstagedrc.json`](../../../.lintstagedrc.json)
is **dead config** (never executed), and the audit lints run by memory,
not machinery.

**R68 is the first round under the
[dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)
and applies it to itself.** The brake: every gate must counter a named
LLM failure mode at proportionate cost. Per-candidate verdict —

- **Keep — changed-file-scoped lint wiring.** lint-staged runs a hook
  only when the matching file type is committed: design docs →
  `design:lint` + `design:tokens` (the latter is the genuine
  anti-hallucination / stale-grounding guard from R66), round files →
  `plan:lint` (the cross-links slip recurred R63/R66), `*.md` →
  `prettier` + `markdownlint --fix` (auto-fix, reviving config that was
  always meant to run). These fire on the _relevant_ commit, are
  sub-second, and target **demonstrated** drift.
- **Decline — an every-commit `commitlint` hook.** It would add friction
  to _every_ commit to enforce message style the repo already follows;
  no LLM failure mode, no demonstrated harm. Fails the brake — see
  § Out of scope.

Net: this is _less_ ceremony, auto-applied — **not** a gate on every
commit. **Local-only; CI explicitly out of scope.**

_Track: 2 (agent-method / harness). Pulled by ← [Round_67](Round_67.md)
Feeds-into follow-up (auto-run the gates), scoped by the Complexity
brake._

## Judgment calls to ratify before wiring (gate these)

> **PAUSE here for ratification** (mirrors R64–R67's Plan-gate pause).

- **J-1 — per-file vs whole-corpus invocation.** lint-staged passes the
  changed-file list; the design/round lints are **corpus-level** (report
  "0 across N") and fast. Run them **whole-corpus** (a function entry
  that ignores the file list and calls the bare `pnpm` script) or
  per-file? _Lean: whole-corpus — the scripts already scan-all by
  default, they're sub-second, and corpus-level is the audit's
  semantics._
- **J-2 — block strictness.** Hooks block the commit on a lint failure;
  the `*.md` prettier/markdownlint step **auto-fixes** (re-stages, no
  block); `--no-verify` is the deliberate WIP escape. Confirm that
  blend (block on real lint errors, auto-fix formatting) vs warn-only.

## Plan (by step) — provisional, pending J-1/J-2

1. **Ratify J-1/J-2** and record in Do (incl. the brake verdict to
   decline `commitlint`).
2. **Revive lint-staged** — `.husky/pre-commit` runs `config:render`
   **then** `pnpm lint-staged` (render stays first so generated
   artifacts are fresh before lints read them; either failure blocks).
3. **Extend [`.lintstagedrc.json`](../../../.lintstagedrc.json)** per
   J-1: `.agents/design/**/*.md` → `design:lint` (+ `design:tokens`);
   `.agents/plan/cycles/Round_*.md` → `plan:lint`. **Deviation
   (mid-round):** the existing `*.md` → `prettier --write` was
   **dropped** — verification showed it corrupts hand-authored docs
   where bold `**` abuts a `**/*.md` glob (see Do). Kept
   `markdownlint-cli2 --fix` (safe, targeted).
4. **Verify** (see Check): hooks fire only on the relevant file type,
   block a seeded violation, pass a clean change, `--no-verify`
   bypasses; all gates still 0.

## Acceptance criteria

- [x] **J-1 + J-2** ratified and recorded in Do (J-1 = **per-file**,
      revised from the whole-corpus lean; J-2 = block on lint errors +
      `markdownlint --fix` auto-fix + `--no-verify` escape); the
      `commitlint` decline recorded with the brake as its reason.
- [x] `pre-commit` runs `config:render` **and** `lint-staged`; a seeded
      broken round file **blocked** (round-lint `R-feeds` → lint-staged
      exit 1); a clean change passes; `--no-verify` bypasses (git native).
- [x] `.lintstagedrc.json` routes changed design docs → `design:lint`
      (+`design:tokens`) and round files → `plan:lint`; this turn touched
      **no** design doc → `.agents/design/**/*.md — 0 files → SKIPPED`
      (proportionate trigger confirmed).
- [x] No regression: `design:lint` 0/0, `design:tokens` 0/8,
      `plan:lint` 0/68, repo `markdownlint` 0.

## What is OUT of scope

- **`commitlint` commit-msg hook — declined per the
  [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium).**
  Every-commit friction to
  enforce message style the repo already follows; counters no LLM
  failure mode. Re-pull only if commit-message drift becomes a real,
  recurring problem (then it earns its place).
- **CI / GitHub Actions** — deferred (2026-06-12 decision); local git
  hooks only. A CI backstop is a future pull if local hooks prove
  bypass-prone.
- **New lint rules / conventions** — R68 _runs_ existing gates; it adds
  none (those were R64–R67).
- **Track-1 product work** (the B3 a11y backlog etc.) — its own product
  round when pulled.

## Risks / unknowns

- **Commit friction.** A blocking pre-commit can stall WIP commits;
  `--no-verify` is the escape and lint-staged scopes work to changed
  files. _Mitigation: keep gates fast; the `*.md` step auto-fixes rather
  than blocks._
- **lint-staged ↔ corpus-scan mismatch.** Corpus-level scripts ignore
  the passed file list; a function-style `.lintstagedrc` entry handles
  this cleanly (J-1).
- **config:render ordering.** Must stay first in pre-commit so generated
  artifacts are fresh before the lints read them.
- **Brake self-discipline.** The temptation mid-wire will be to "also add
  commitlint while we're here." The decline is deliberate; honor it
  unless a real harm is shown.

## Do

### Decisions (J-1 / J-2 / commitlint)

- **J-1 → per-file** (revised from the whole-corpus lean). The
  design/round lint rules are all **per-document**, so passing
  lint-staged's changed-file list is both correct and *less mechanism*
  (plain-JSON config; no `.lintstagedrc.mjs` function entry). The
  pre-commit gate checks what's staged; the post-round audit keeps the
  whole-corpus `pnpm` sweep. The brake favoured the simpler option.
- **J-2 → block on lint errors; auto-fix formatting; `--no-verify`
  escape.** `markdownlint --fix` re-stages cosmetic fixes (no block);
  the conformance lints block on real violations.
- **`commitlint` → declined** per the
  [dynamic-equilibrium brake](../../context/purpose.md#dynamic-equilibrium)
  (every-commit friction, no named failure mode).

### Wiring

- [`.husky/pre-commit`](../../../.husky/pre-commit) → `config:render`
  **then** `pnpm exec lint-staged`.
- [`.lintstagedrc.json`](../../../.lintstagedrc.json) → `*.md`:
  `markdownlint-cli2 --fix`; `.agents/design/**/*.md`: `design:lint` +
  `design:tokens`; `.agents/plan/cycles/Round_*.md`: `plan:lint`.

### Mid-round finding — the brake fired on `prettier` (a live instance)

Verification (`prettier --check`) flagged the docs; running
`prettier --write` then **corrupted** PDCA.md where bold `**` abuts the
`**/*.md` glob in the audit checklist — it ate spaces (`` `.md`with ``,
`` map**:`pnpm ``) and escaped globs. `markdownlint` still passed (it
can't see eaten prose spaces), so this was a silent content-degradation
a format-only gate would have shipped. **Verdict: `prettier --write` on
hand-authored agent docs causes more harm than good → dropped from the
hook** (kept the targeted, safe `markdownlint --fix`). PDCA.md restored
from HEAD; the doctrine edits re-applied by hand. This is the
accelerate ⇌ brake doctrine in action: a mechanism that *looked* like
hygiene was net-negative, so it was cut, not entrenched.

### Verification run (mimicking the hook)

`pnpm exec lint-staged` on the staged set: `*.md — 3 files` →
markdownlint clean; `.agents/design/**/*.md — 0 files → SKIPPED`;
`Round_*.md — 1 file` → round-lint passed. Negative test: a seeded
broken round file → `round-lint R-feeds` FAILED → lint-staged exit 1
(commit would block), then auto-reverted. The **R68 commit itself**
passes through the new hook — the ultimate end-to-end check.

## Check

- [x] **Happy path** — `pnpm exec lint-staged` passes on the staged set;
      `markdownlint --fix` made no changes (docs already clean).
- [x] **Proportionate trigger** — no design doc staged this turn →
      design lints `SKIPPED`; only `*.md` + `Round_*.md` tasks ran.
- [x] **Gate bites** — seeded broken round file → `round-lint` exit 1 →
      `lint-staged` failed the run (commit blocked); clean revert after.
- [x] **No regression** — `plan:lint` 0/68, `design:lint` 0/0,
      `design:tokens` 0/8, repo `markdownlint` 0, `check_links` exit 0.
- [x] **`prettier` corruption caught + dropped** (see Do); the committed
      PDCA.md is the clean, hand-restored version.

## Act

**Outcome: the quality gates now run themselves at commit time** —
`config:render` + lint-staged (markdownlint-fix on `*.md`; `design:lint`
and `design:tokens` on changed design docs; `plan:lint` on changed round
files). The "manual `pnpm` slips" failure mode (which bit R63/R66) is
closed locally, at proportionate cost: each lint fires only when its
file type is staged.

**The brake earned its keep on day one.** R68's own verification cut a
mechanism — `prettier --write` on agent docs — that corrupted prose
under a green `markdownlint`. That is exactly the
[dynamic-equilibrium](../../context/purpose.md#dynamic-equilibrium)
discipline: add (and *keep*) mechanism only when it counters a named
failure mode without causing a worse one. `commitlint` was declined for
the same reason.

**Doctrine.** Local git hooks enforce the post-round audit's mechanical
gates; CI remains a deferred backstop. `--no-verify` is the WIP escape.
Auto-`prettier` on hand-authored `.agents` docs is **out** (corruption
risk); `markdownlint --fix` stays.

**Lifecycle.** `.husky/pre-commit` + `.lintstagedrc.json` amended; the
dynamic-equilibrium doctrine relocated to
[purpose.md](../../context/purpose.md#dynamic-equilibrium) with PDCA
pointing to it (consolidation, not addition). No new round queued by
this work.

## Feeds into → Round_69 (TBD)

With the proportionate gates auto-running locally, the open harness
question is whether a **CI backstop** is ever needed (only if local
hooks prove bypass-prone). The first **prune** under the new Act prompt
is also queued: revisit R64–R67's gates and cut anything not earning its
place. Next pull stays open — a further Track-2 thread, a prune round, or
the first Track-1 product round (B3 a11y).

---

> **PAUSED at the Plan gate.** Ratify **J-1/J-2** (lint-staged invocation
> style; block strictness). The `commitlint` hook is **declined** by the
> dynamic-equilibrium brake — flag it if you disagree. Do / Check / Act
> fill once the round executes.
