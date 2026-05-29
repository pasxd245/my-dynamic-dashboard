# Round 44: Capture R43 gotchas — IS_NODE under DOM emulation, MSW swallows resolver throws

**Status**: Complete
**Date started**: 2026-05-27
**Date completed**: 2026-05-27

## Goal

**Inherits from ← [Round_43](Round_43.md)** — R43 surfaced two
latent R42 bugs that had been hidden by the dormant validator:
(1) `typeof window === "undefined"` is not a Node detector under
happy-dom/jsdom because the DOM emulators shim `window` globally;
(2) MSW v2 catches resolver throws and emits them via
`unhandledException` rather than rejecting the awaited `fetch()`.
Both are reusable Vite/vitest/MSW gotchas a future round (or a
parallel project) could trip over.

R44 captures both as `memory/` entries while the lessons are
fresh. No code change. No tests. Pure prose under
`.agents/memory/`.

This is the first of a 2-round chain agreed at end-of-R43 Q&A:
R44 = gotcha capture (cheap, low-risk, fresh lessons);
R45 = extend validator coverage to `$ref`-using endpoints via
`@apidevtools/swagger-parser` (now meaningful because the
validator actually runs after R43).

*Track: 2 (agent-method). Pulled by: R43 Act § Follow-ups
"capture the IS_NODE / MSW-unhandledException gotchas in
memory/" — both bugs were surprising enough that the design
*and* the test passed without exercising them; that is exactly
the reusability signature memory exists to preserve. Per
[Evolution Rule](../../AGENTS.md).*

## What is IN scope

### 1. Memory file: IS_NODE under DOM emulation

- File:
  [`.agents/memory/2026-05-27-is-node-detection-under-dom-emulation.md`](../../memory/2026-05-27-is-node-detection-under-dom-emulation.md).
- Documents: `typeof window === "undefined"` is not a Node
  detector when the test runtime uses happy-dom or jsdom;
  use `typeof process !== "undefined" && process.versions?.node`
  instead.
- Includes the concrete R42→R43 incident (validator silently
  no-op'd for ~one full round) as the citation that makes the
  abstract rule load-bearing.

### 2. Memory file: MSW v2 swallows resolver throws

- File:
  [`.agents/memory/2026-05-27-msw-swallows-resolver-throws.md`](../../memory/2026-05-27-msw-swallows-resolver-throws.md).
- Documents: a resolver throw becomes an `unhandledException`
  event, not a rejected `fetch()`. `.rejects.toThrow(...)`
  assertions silently pass. Pattern: buffer
  `unhandledException` events and drain in `afterEach`.
- Includes the concrete R43 incident and a snippet of the
  `tests/setup.ts` buffer-and-drain pattern.

### 3. Pipeline

- `npx markdownlint-cli2` — 0 errors over the new files and
  the wider repo.
- No type-check / test / build needed — no code changed.
- Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- Grep this file for unticked `- [ ]` before flipping Status
  to Review.

## What is OUT of scope

- **No code changes.** The fixes already landed in R43; R44
  only captures the lessons.
- **No new test files or test changes.** Same reason.
- **No memory promotion to `context/` or `skills/`.** Both
  files are first-author memory; promotion is a future
  judgement when a second incident pulls.
- **No `decisions/` entry.** The lessons are reusable gotchas,
  not multi-round commitments — `memory/` is the right home
  per `decisions/README.md § What does NOT go here`.
- **No coverage-extension work.** That is R45 explicitly.

## Plan

- [x] Confirm scope at planning review.
- [x] Author
      `.agents/memory/2026-05-27-is-node-detection-under-dom-emulation.md`
      using the memory `_TEMPLATE.md` structure.
- [x] Author
      `.agents/memory/2026-05-27-msw-swallows-resolver-throws.md`
      using the same template.
- [x] Run `npx markdownlint-cli2` — 0 errors over 106 files
      (was 103; +3 from R44).
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping
      Status.

## Risks / unknowns

- **None substantive.** Pure prose round; the failure modes
  are documentation quality (insufficient detail, wrong
  generalization) and markdownlint nits, both cheap to fix.
- **Possible over-specification**: the IS_NODE gotcha could
  apply to environments beyond happy-dom/jsdom (Deno test
  shims, browser-like test runners). Mitigation: name
  happy-dom and jsdom explicitly as the _observed_ shims and
  state the general rule (any DOM-emulation runtime that
  shims `window` will trigger the same trap).

## Do

**Memory file 1: IS_NODE under DOM emulation.**

Authored
[`.agents/memory/2026-05-27-is-node-detection-under-dom-emulation.md`](../../memory/2026-05-27-is-node-detection-under-dom-emulation.md)
following the memory `_TEMPLATE.md` structure (Date / Agent /
Confidence / Status frontmatter; Problem / Finding / Evidence /
Recommendation / Promotion sections). The file:

- States the rule (`typeof window === "undefined"` fails under
  happy-dom / jsdom because both shim `window`) with a 4-row
  environment table showing where the idiom misfires.
- Cites the R42→R43 incident concretely — validator silently
  no-op'd for one full round, surfaced only by R43's
  `assertion that drift fires` pattern.
- States the operational fix as a code snippet
  (`process.versions.node` check), not just prose.
- Names happy-dom and jsdom as the _observed_ shims; states
  the general rule for any DOM-emulator that shims `window`.
- Calls out _why_ `process.env.NODE_ENV === "test"` is a worse
  proxy (narrow to vitest, doesn't generalize to dev-SSR).

**Memory file 2: MSW v2 swallows resolver throws.**

Authored
[`.agents/memory/2026-05-27-msw-swallows-resolver-throws.md`](../../memory/2026-05-27-msw-swallows-resolver-throws.md)
in the same shape. The file:

- States the surprising-but-deliberate MSW behaviour: resolver
  throws become `unhandledException` events; `fetch()`
  resolves with a synthetic 500; `.rejects.toThrow` silently
  passes.
- Cites the R42→R43 incident (`withContractValidation`
  decorator's "throws in test mode (loud)" was loud in intent
  but not in effect).
- Includes the full buffer-and-drain `tests/setup.ts` pattern
  as a code snippet — the reusable shape future MSW-using
  suites can lift verbatim.
- Notes the per-test drain pattern for tests that
  _intentionally_ assert on the captured throw (the R43
  stress-test pattern).
- Includes the MSW stderr signature
  (`[MSW] Encountered an unhandled exception …`) so future
  agents recognize the symptom in raw output.

**Pipeline.**

- `npx markdownlint-cli2` — 0 errors over 106 files (was 103;
  +3 from R44 — Round_44.md + 2 memory files).
- No type-check / test / build needed; no code touched.

## Check

- [x] Both memory files exist under `.agents/memory/` with
      the standard frontmatter (Date / Agent / Confidence /
      Status = New).
- [x] Each file cites the R42→R43 incident as concrete
      evidence, not just the abstract rule.
- [x] Each file's Recommendation section states the
      operational fix in code-snippet form: the `IS_NODE`
      `process.versions.node` replacement; the
      `tests/setup.ts` buffer-and-drain pattern.
- [x] `npx markdownlint-cli2` returns 0 errors (106 files).
- [x] Post-round audit passes; all Plan + Check checkboxes
      flipped.

## Act

**Learnings**:

- **Memory entries pay for themselves when the _why_ is on
  the page.** Both files lead with the surprising behaviour
  (a table for IS_NODE, a misleading-design-intent narrative
  for MSW), not the fix. The fix is a one-line code snippet
  near the bottom. This shape mirrors what made the
  [markdownlint MD004 gotcha](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md)
  load-bearing: the _example_ of the bug is what makes a
  future reader recognize the symptom in their own work.
  Memory without a concrete recognition-anchor is just a
  rule; with one, it's a debugging shortcut.
- **The two gotchas are deeper than the round that surfaced
  them.** IS_NODE-under-DOM-emulation will apply to _any_
  module that needs Node access in vitest — not just the
  R42 validator. MSW-swallows-throws will apply to _any_
  resolver-decorator pattern, not just `withContractValidation`.
  R44's memory files are therefore reusable beyond the MSW
  thread of work. The promotion-candidate sections both
  flag "Not yet — single incident; revisit when a second
  domain hits the same trap" — exactly the right discipline
  per
  [decisions/categorization-proposal-test](../../decisions/2026-05-27-categorization-proposal-test.md):
  don't generalize ahead of pull.
- **Two memory files in one round is the right grain.** The
  topics are independent but were surfaced by the same
  forcing-function (R43 stress-test), so splitting them into
  two rounds would have been theatre — same forcing-function,
  same lesson-fixation window, same prose-quality concerns.
  R44 is "capture the R43 gotchas," not "capture
  gotcha A in one round and gotcha B in another." This is
  consistent with the cadence memory's _"one feature per
  round"_ rule: the _feature_ here is "memory capture of R43
  findings," not "memory file authoring in the abstract."

**Promotions** _(none — both memory files are first-author,
single-incident. Promotion to `context/` or `skills/` requires
a second incident or a documented pull. Current
promotion-candidate flag on both: "Not yet.")_:

**Follow-ups (not promotions, just notes):**

- **Audit other defensive code paths for the same dormant-
  failure trap.** R43 Act listed this as a follow-up; R44
  doesn't address it directly but the new IS_NODE memory
  file makes the audit _cheaper_ (the symptom-recognition
  anchor is captured). Candidates per R43's note: the R39 BE
  `validate_response()` helper, the R34 contract-validity
  tests. Not pulled today.
- **A "writing modules that touch both Node and browser"
  pattern doc.** Both memory files' promotion-candidate
  sections point at this. If a third Node-vs-browser
  gotcha lands (e.g., during a preview-HTML or SSR round),
  the three memories together would justify a `context/`
  promotion. Pull threshold: 3+ incidents.
- **A "writing MSW-using tests" pattern doc.** Same shape;
  the MSW memory file's promotion-candidate section names
  the trigger (`packages/mocks` extraction or a second
  MSW-using domain).

## Feeds into → Round_45 (TBD)

R45 = extend validator coverage to `$ref`-using endpoints
(`getDataset`, list, batch, uploads) via
`@apidevtools/swagger-parser`. Now meaningfully different
from before R43 — the validator actually runs (R43 fix), so
adding coverage produces observable drift-detection on those
endpoints (not theoretical). With the two gotchas captured
in `memory/`, R45 can lean on the symptom-recognition
shortcuts if any new bugs surface.
