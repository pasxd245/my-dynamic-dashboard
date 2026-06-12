# Round 67: Round-structure lint — mechanically enforce the PDCA round template

**Status**: Complete
**Date started**: 2026-06-12
**Date completed**: 2026-06-12

## Goal

**Inherits from ← [Round_66](Round_66.md)** — R66's review surfaced that
the round-file conventions are **defined three times** in
[PDCA.md](../PDCA.md) (Cycle Template → Act; the Round Template skeleton;
the post-round audit's "Cross-links present" item) yet still slipped:
**R63** and **R66** both shipped `Complete` with no outbound
`Feeds into →` section.

Root cause — that audit gate is the **last manual checkbox** in a list
whose every other recent sibling is a script (`markdownlint`,
`design:lint`, `design:tokens`). Same lesson the R56–R64 design-corpus
audit reached: *defined + templated but unlinted ⇒ it recurs.* R67
closes the gap with a `scripts/lint/round-lint.mjs` (`pnpm plan:lint`) that
checks every round file for its required sections and **replaces the
manual checkbox** with a mechanical gate.

_Track: 2 (agent-method / tooling). Pulled by ← [R66](Round_66.md) Act
follow-up (round-structure conventions are not linted)._

## Plan

- [x] Audit the 66 existing rounds for section consistency to decide
      whether a grandfather baseline is needed.
- [x] Build [`scripts/lint/round-lint.mjs`](../../../scripts/lint/round-lint.mjs):
      enforce Status (+lifecycle vocab), Date fields, the five phase
      headings, an outbound `Feeds into →`, and an inbound
      `Inherits from ←` / `Pulled by ←` (Round_01 exempt).
- [x] Backfill the two known gaps so the corpus is clean with **no
      baseline**: [R63](Round_63.md) (append-only `Feeds into →`) and
      [R66](Round_66.md) (outbound section).
- [x] Wire `pnpm plan:lint` in `package.json` and **replace** the manual
      "Cross-links present" checkbox in the PDCA post-round audit with
      the script.
- [x] **Folded in (mid-round):** relocate the whole lint family to
      `scripts/lint/` (alongside `scripts/dev/`) — `design-doc-lint.mjs`
      + its baseline, `design-token-parity.mjs`, and `round-lint.mjs` —
      and update every reference (3 `package.json` entries, the scripts'
      `REPO_ROOT` depth + baseline path, and ~17 doc/round cross-links).
- [x] Verify: `plan:lint` 0 errors over all rounds (incl. this one);
      `markdownlint` 0; `check_links --changed` exit 0.

## Risks / unknowns

- **Convention variants.** The inbound handoff appears as both
  `Inherits from ←` and `Pulled by ←`; the outbound as both a
  `## Feeds into` heading and a `**Feeds into →` bold line. The linter
  accepts all observed forms to avoid false positives on conformant
  history. _Mitigation: rules derived from the audit, not guessed._
- **Append-only history.** R63 is `Complete`; its fix is an appended
  dated correction, not a mid-file rewrite (per
  [governance.md](../../context/governance.md)).
- **Over-strict `Inherits from`.** Round_01 has no predecessor (exempt);
  a future predecessor-less round uses `Pulled by ←` at a memory / gap.

## Do

### Audit (decide baseline)

Section-presence sweep over all 66 rounds:
`Status / Goal / Plan / Do / Check / Act` → **0 missing**;
`Feeds into` (outbound) → **1 missing (R63)**;
inbound cross-link → **2 "missing"** (Round_01 legitimately; R64 uses the
`Pulled by ←` variant the first regex didn't catch). Conclusion: the
corpus is clean enough for a **baseline-free** linter — fix R63, accept
the `Pulled by ←` variant, exempt Round_01.

### Build + wire

- [`scripts/lint/round-lint.mjs`](../../../scripts/lint/round-lint.mjs) — rules
  `R-status` / `R-dates` / `R-sections` / `R-feeds` / `R-inherits`; no
  grandfather baseline (any violation errors).
- `package.json` → `"plan:lint": "node scripts/lint/round-lint.mjs"`.
- [PDCA.md](../PDCA.md) post-round audit — the manual "Cross-links
  present" item is replaced by a `pnpm plan:lint` gate.

### Backfill

- [R63](Round_63.md) — appended a `## Feeds into → Round_64` correction
  (history above untouched).
- [R66](Round_66.md) — added its `## Feeds into → (no successor queued)`
  section (during R66's own review).

### Relocate the lint family to `scripts/lint/` (folded in)

User-requested mid-round, for parity with `scripts/dev/`. Moved
`design-doc-lint.mjs` + `design-doc-lint.baseline.json`,
`design-token-parity.mjs`, and `round-lint.mjs` into `scripts/lint/`.
Updated: each script's `REPO_ROOT` (`..` → `../..`) and the baseline
path inside `design-doc-lint.mjs`; the three `package.json` entries; and
~17 doc/round cross-links (`scripts/<name>` → `scripts/lint/<name>`).
The cross-link updates touch the Complete rounds R64–R66 — treated as
**link-maintenance** (keeping a moved-file reference valid), not a
history rewrite. All three lints run identically from the new location.

## Check

- [x] **`pnpm plan:lint`** → `0 error(s) across 67 round(s)` (66 prior +
      this one; R63 + R66 now conformant, no baseline).
- [x] **`node scripts/lint/round-lint.mjs <one Complete round>`** errors on a
      synthetic missing-`Feeds into` (rule fires) — confirmed during dev
      against the pre-fix R63/R66 state.
- [x] **`markdownlint-cli2`** repo-wide → 0 errors.
- [x] **`check_links.py --changed`** → exit 0 (14 changed `.md`; every
      moved-script link resolves to `scripts/lint/`).
- [x] **Post-relocation:** all three lints run from `scripts/lint/` via
      `pnpm design:lint` / `design:tokens` / `plan:lint` (exercises the
      updated `package.json` paths); no `scripts/lint/lint/` doubles or
      stale bare `scripts/<name>.mjs` references remain.

## Act

**Outcome: the round template is now self-enforcing.** The last manual
item in the post-round audit is a script. The convention that slipped
twice (R63, R66 missing `Feeds into →`) can no longer ship silently —
`pnpm plan:lint` fails the audit.

**Doctrine.** Round files follow the PDCA Round Template; `plan:lint`
checks it, the way `design:lint` / `design:tokens` check design docs.
The three places PDCA *defines* the convention stay (they teach it);
the lint *enforces* it. No grandfather baseline — the corpus was clean
once R63 was backfilled, so any future violation errors immediately.

**Pattern reused.** This is the third Track-2 "template + lint" instance
(design-doc format R64/R65, token parity R66, round structure R67),
each converting a manual convention into a mechanical gate.

**Scope note — lint family relocated.** Folded in mid-round at the
user's request: all three lints now live under `scripts/lint/` (parity
with `scripts/dev/`), with every reference updated and verified green.
Doing it inside R67 — rather than a separate R68 — meant `round-lint.mjs`
landed in its final home immediately instead of move-then-move. The
Complete-round cross-link edits (R64–R66) are link-maintenance, not
history rewrites.

## Feeds into → (no successor queued)

R67 closes the round-structure gap; nothing is handed to a specific next
round. The post-round audit's enforceable items (`markdownlint`,
`design:lint`, `design:tokens`, `plan:lint`) now cover the conventions
that were proven to drift. Future pulls that would inherit from here:

- A **CI / pre-commit hook** chaining the four lints, if manual
  `pnpm` invocation in the audit ever slips the way the checkbox did.
- A **new required round section** — add a rule to `round-lint.mjs`
  alongside the PDCA template edit, same as adding an L-rule to
  `design-doc-lint.mjs`.
