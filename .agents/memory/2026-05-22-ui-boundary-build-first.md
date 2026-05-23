# UI/BIZ boundary — build `@mdd/ui` first, don't extract later

**Date**: 2026-05-22
**Agent**: claude-opus-4-7
**Confidence**: High
**Status**: New

## Problem

Generic React advice ("rule of three", extract shared components after
multiple consumers exist) was the path the drifted iteration of this
repo took. Result: `packages/ui/` was extracted from already-entangled
BIZ code, the boundary inherited the entanglement, the UI became hard
to modify, and the end-user experience became _"good idea, hard to
use."_

## Finding

For **this** codebase specifically, the UI/BIZ boundary must be **built
first** — `@mdd/ui` scaffolded as an empty look-and-feel-only package
_before_ any feature code in the builder. The boundary is enforced by
import path at component creation, not by later refactor.

The named track-1 pull is product architecture: separating "UI duty"
(look-and-feel: theme, providers, generic primitives) from "BIZ duty"
(CRM features, data flows, query state) lets either side improve
independently — UI redesign goes to `@mdd/ui`, feature work goes to
`apps/builder/src/features/`.

User's diagnosis verbatim (2026-05-22): _"it drifted because @mdd/ui
came in too late."_

## Evidence

- Drifted UI package evidence is indexed through
  [drifted-iteration.md](../context/drifted-iteration.md): the old
  package had 8 dirs (`Components`, `Pages`, `Providers`, `Contexts`,
  `Icons`, `Utils`, `constants`, `types`) and was BIZ-coupled by
  extraction time.
- Drifted peer deps included BIZ libs (`react-router-dom`,
  `@tanstack/react-query`, `zod`) — the BIZ leak.
- Round_02 plan: [.agents/plan/cycles/Round_02.md](../plan/cycles/Round_02.md)
- Companion deferral memory: [2026-05-22-round-roadmap-deferrals.md](2026-05-22-round-roadmap-deferrals.md)

## Recommendation

**Do**:

- Scaffold the empty `@mdd/ui` package before any builder feature code
- Keep `@mdd/ui` peer deps to `react`, `react-dom`, `antd`,
  `@ant-design/icons` only — **nothing BIZ**
- Source-only exports (`./src/*.ts(x)`), no build step
- Add a one-paragraph governance rule in `packages/ui/README.md`:
  what belongs here, what belongs in `apps/builder/src/features/`,
  one positive + one negative example
- Generalize the principle: for _any_ boundary abstraction where the
  late-extraction failure mode has been observed, prefer build-first

**Don't**:

- Apply generic "extract-later" or "rule of three" advice to UI in
  this repo
- Add `Pages/`, `Contexts/`, `react-router-dom`, `@tanstack/react-query`,
  or `zod` to `@mdd/ui` peer deps — those are BIZ and belong in the
  builder

## Promotion Candidate?

- [x] `context/` — once Round_03 (builder skeleton) validates the
      boundary under real consumption, promote the one-paragraph
      governance rule into `.agents/context/`
- [ ] `skills/`
- [ ] Not yet
