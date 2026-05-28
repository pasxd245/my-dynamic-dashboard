# `git mv` and `markdownlint-cli2 --fix` — tool quirks for in-round file ops

**Date**: 2026-05-28
**Agent**: Claude Code
**Confidence**: High
**Status**: New

## Problem

[Round_46](../plan/cycles/Round_46.md) (brainstorm-housing convention)
moved 4 docs from `tmp/` (gitignored) to
`.agents/plan/brainstorms/2026-05-28-hybrid-flow/`, then lint-fixed
the moved docs in place. Two tool quirks surfaced that any agent
doing similar in-round file ops will hit.

## Finding

1. **`git mv` requires the source to be tracked.** Attempting
   `git mv` on an untracked file fails with
   `fatal: not under version control, source=...`. This bit two
   in-session moves:

   - The round-renumbering step (`git mv Round_46.md Round_47.md`
     when `Round_46.md` was created in-session and never committed).
   - Would have bitten the 4-doc move from `tmp/` if attempted —
     `tmp/` is gitignored at both repo root and `.agents/`.

   The fallback is plain `mv`; git picks up the destination as a
   new path on the next `git add`.

2. **`markdownlint-cli2 --fix` is safe for whitespace rules, unsafe
   for content rules.** R46 ran `--fix` on the 4 moved docs and
   resolved **59 errors in one pass** with **zero content drift**.
   All 59 were whitespace rules:

   - MD007 (ul-indent)
   - MD009 (trailing-spaces)
   - MD022 (blanks-around-headings)
   - MD031 (blanks-around-fences)
   - MD032 (blanks-around-lists)

   Content rules (MD034 bare-urls, MD040 fence-language, MD059
   link-text, MD025 single-h1) can introduce semantic edits and
   need manual triage instead.

## Evidence

- Round file: [`plan/cycles/Round_46.md`](../plan/cycles/Round_46.md)
  § Do log + § Act § Learnings
- Commands run:
  - `git mv .agents/plan/cycles/Round_46.md .agents/plan/cycles/Round_47.md`
    → `fatal: not under version control`; fallback to plain `mv` worked
  - `npx markdownlint-cli2 --fix .agents/plan/brainstorms/2026-05-28-hybrid-flow/`
    → 59 errors → 0 errors; repo-wide re-lint clean

## Recommendation

**Do**:

- Use plain `mv` when source is untracked (gitignored, or
  in-session-new and uncommitted)
- Reach for `npx markdownlint-cli2 --fix <path>` for whitespace
  cleanup on batches of moved/imported docs — fast and content-safe
- Read the failing rule codes first; if all are MD007/009/022/031/032
  (and similar whitespace-only), `--fix` is safe

**Don't**:

- Run `markdownlint-cli2 --fix` blindly on docs you haven't
  pre-screened — content rules can shift meaning (e.g., MD040
  might add a language tag to a fence in a way that changes
  syntax highlighting expectations)
- Reach for `git mv` without confirming the source is tracked

## Promotion Candidate?

- [ ] `context/` – Stable pattern, broadly applicable
- [ ] `skills/` – Reusable procedure/checklist
- [x] Not yet – Needs more validation (one-instance evidence per
  quirk; promotion bar is 3+ instances per
  [governance.md](../context/governance.md))

---

> Sibling: [2026-05-22-markdownlint-plus-prefix-gotcha.md](2026-05-22-markdownlint-plus-prefix-gotcha.md)
> — same family of repo-specific lint quirks worth capturing here.
> Captured during: R46 post-Review audit, pulled by deep-check
> request 2026-05-28.
