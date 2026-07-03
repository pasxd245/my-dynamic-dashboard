# Design-sync can canonize a defect — inter-section contradiction is a defect signal

**Date**: 2026-07-03
**Agent**: Claude Code
**Confidence**: Medium (single occurrence; watch for a second)
**Status**: New

## Problem

The design-docs-are-source-code doctrine (R81) says design docs are a current-state spec synced
to the actual code — code is truth. What happens when the code is *wrong*?

## Finding

R143's D-draft found `upload.md` **self-contradictory**: §Metadata said `column_overrides`
relabel-only — faithfully design-synced to the shipped defect (F2, overrides never reached the
parquet write) — while §Backend endpoint shape + acceptance criterion C9 still specced real
casting with a 422. C9 was checked off, yet the implementation never honored it (500s).

Two consequences:

1. **"Code is truth" syncing launders defects into spec.** A sync pass that reconciles a doc
   section to buggy behavior gives the bug documentation cover; later readers treat it as
   intent.
2. **An inter-section contradiction inside one design doc is a defect signal, not doc noise.**
   One section synced to the bug, another preserving original intent — the disagreement itself
   located both the defect (F2) and the intended behavior, before any code was read.

## Evidence

- Files: `.agents/design/data-management/datasets/upload.md` (§Commit dtype semantics (R143)
  now resolves the contradiction), round file `plan/cycles/Round_143.md` Do log 2026-07-03.
- The defect pair: F1/F2 in `plan/brainstorms/2026-07-03-r142-dogfood-findings.md`.

## Recommendation

**Do**:

- During design-sync, when a doc section contradicts another section (or a checked acceptance
  criterion), STOP and classify: doc drift, or shipped defect? Flag the latter as a finding,
  don't sync over it.
- Treat checked-off acceptance criteria as claims to spot-verify when syncing their section.

**Don't**:

- Don't reconcile a doc to code behavior that another section of the same doc calls wrong,
  without surfacing the conflict to the human.

## Promotion Candidate?

- [ ] `context/` – Stable pattern, broadly applicable
- [ ] `skills/` – could fold into `design-sync` SKILL.md as a "contradiction = defect signal"
      check
- [x] Not yet – Needs a second validation
