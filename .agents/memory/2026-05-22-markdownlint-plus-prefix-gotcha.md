# Markdownlint MD004 — avoid `+ word` at the start of a wrapped line

**Date**: 2026-05-22
**Agent**: claude-opus-4-7
**Confidence**: High
**Status**: New

## Problem

The repo's [.markdownlint-cli2.jsonc](../../.markdownlint-cli2.jsonc)
inherits the default MD004 (`ul-style`) rule, which enforces a
**consistent** unordered-list bullet character per file. Markdownlint
treats the first bullet character it encounters as the file-wide
expectation.

If a paragraph wraps such that a continuation line starts with the
characters `+ word…`, markdownlint parses that line as a `+`-bulleted
list item and now expects every other list in the file to use `+`.
Subsequent `-` bullets then fail MD004 with:

```text
MD004/ul-style: Unordered list style [Expected: plus; Actual: dash]
```

This bit Round_02 (`+ snapshot test` continuation), Round_03 (`+ provider
stack` continuation), and Round_04 (`+ [tests/setup.ts]` continuation)
across the session of 2026-05-22.

## Finding

The fix is purely a writing convention, not a config change. Don't
break wrapped lines such that they begin with a `+` immediately
followed by a space and text. The MD004 default is fine; the lint
warning is correct in the abstract (mixed bullet styles are
confusing) — it just trips on prose accidentally.

## Evidence

- Config: `.markdownlint-cli2.jsonc` (no MD004 override)
- Three incidents in `.agents/plan/cycles/Round_02.md`,
  `Round_03.md`, `Round_04.md` — all in wrapped paragraphs

## Recommendation

**Do**:

- When writing wrapped prose in markdown, ensure no continuation line
  starts with a `+` followed by a space followed by text. Use `plus`,
  `and`, or rephrase.
- The same gotcha theoretically applies to `*` and `-` as bullet
  characters — but `+` is the common offender because we use `+` in
  prose (e.g., "X + Y") far more often than `*` or `-`.

**Don't**:

- Override MD004 to silence the warning. The rule has real value for
  intentional lists; the false-positive is on us for prose wrapping.
- Switch all bullets to `+` to make the linter happy — readability
  suffers.

## Promotion Candidate?

- [ ] `context/` — possibly, if a "writing markdown for this repo"
      style guide ever lands. For now memory is enough.
- [ ] `skills/`
- [x] Not yet — single-purpose gotcha note; revisit if more
      markdown gotchas accumulate and a style guide makes sense.
