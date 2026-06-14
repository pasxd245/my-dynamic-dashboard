# Mermaid: bare `;` breaks a stateDiagram label; validate headless with `mermaid.parse` (not mmdc)

**Date**: 2026-06-14
**Agent**: claude-opus-4-8
**Confidence**: High
**Status**: New

## Problem

A `stateDiagram-v2` in `query-construction.md` rendered with a syntax error. No
gate caught it — `design:lint`, `design:tokens`, and `markdownlint` do **not**
parse Mermaid, so a broken diagram passed every check into a Complete design doc
(same "harness can't see it" class as CORS/preflight/layout).

## Finding

- **A bare `;` in a transition label is the killer.** `Saving --> Viewing: 200 →
  persisted; toast; back to read-only` — Mermaid treats `;` as a **statement
  terminator**, so the label ends at the first `;` and the rest tokenizes as
  `INVALID` (`Parse error on line N … got 'INVALID'`). Fix: use commas / `·` / `—`.
- **Brackets `[...]` in labels are FINE** (`click [Edit]`, `[Save] disabled`) —
  they were the obvious red herring; verified against `advanced-query.md` which
  renders with `[Clear]`. `[*]` is only special as the start/end *state*.
- **A `;` *inside parentheses* is fine** (`(independent; aq unchanged)` in
  advanced-query.md / dataset-filters.md parse clean) — only a bare `;` in label
  position terminates the statement.

## Evidence

- Files: `.agents/design/data-management/queries/query-construction.md`
  (fixed, commit `ce75c46`).
- Validated **headlessly** — no `mmdc`/chromium. `mmdc` (@mermaid-js/mermaid-cli)
  drags puppeteer + chromium + katex + fontawesome; overkill and won't run cleanly
  in the sandbox. Instead: `npm i mermaid` (core, no chromium) in a temp dir, stub
  `window`/`document`/`addEventListener` + a `DOMPurify`, then `await
  mermaid.parse(text)`. The jison **grammar** error (`Parse error … INVALID`) is
  the syntax signal; a later `DOMPurify.sanitize` stub failure means parse already
  passed. (jsdom fails under this Node via a css-color ESM/CJS conflict — use
  manual stubs, not jsdom.)

## Recommendation

**Do**:

- Keep Mermaid labels free of bare `;` (commas instead). Same for other jison
  terminators if they appear odd.
- To check a diagram, extract the ` ```mermaid ` block and run `mermaid.parse`
  headless (recipe above) — don't reach for `mmdc`.
- Validate, don't guess at the offending token — the first obvious char (brackets)
  was wrong; `mermaid.parse` named the real line.

**Don't**:

- Assume design:lint/markdownlint cover Mermaid — they don't.
- Install `@mermaid-js/mermaid-cli` just to syntax-check.

## Promotion Candidate?

- [ ] `skills/` – a tiny `design:mermaid` parse gate (extract blocks → mermaid.parse)
  would close the no-gate hole. Pulled by this one incident — **add only if it
  recurs** (default = don't add; the brake). Until then this memory is the guard.
- [x] Not yet – fired once.

---

> Filename convention: `YYYY-MM-DD-short-topic.md`.
> See [.agents/AGENTS.md](../AGENTS.md) for the write policy.
