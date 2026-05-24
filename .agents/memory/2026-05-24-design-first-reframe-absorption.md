# Design-first methodology absorbs multi-reframe rounds

**Date**: 2026-05-24
**Agent**: claude-opus-4-7
**Confidence**: High
**Status**: New

## Problem

How much design churn can a single design-only round absorb before
the methodology breaks? Are cross-linked previews + an HIxAI Q&A
loop a strong enough catch net to keep code work safe when product
direction is still moving?

## Finding

**R14 absorbed four cumulative reframes** of a feature design over a
single round, with **zero code at risk** at any point. Each reframe
reversed a previously-locked decision and would have been an
expensive multi-day code-undo had it surfaced after the
implementation rounds (R15+) shipped:

1. **Noun reframe** — Upload-as-noun → Datasets (noun) + Upload
   (verb). Triggered by the user walking the early preview and
   noticing the semantic mismatch.
2. **Modal → page reframe** — single-screen modal → full-page
   wizard. Triggered by "this is a multi-steps screen."
3. **Single-source → multi-source reframe** — CSV-only → Excel
   primary + CSV secondary, branching step count by source type.
   Triggered by "Excel is the dominant CRM-export format."
4. **Q14 reversal** — locked "no dtype override; trust parser"
   became "yes dtype override + format string + column-include
   checkboxes + range / has-header." Triggered by a drifted-iteration
   reference: "from the drifted, the feature is quite effective."

Each reframe was caught by the **cross-linked preview** (clickable
between Workspaces → Datasets → Upload wizard, like the real app)
combined with an HIxAI Q&A loop on the visible artifact. The
preview's job is exactly this: surface the framing error the
markdown alone can't.

The round shipped 2 design docs (datasets.md + upload.md) + 3
previews (datasets, workspace-shell modal-wiring, upload — rebuilt
three times as the reframes landed) + 2 shared CSS files + 1 index
page + 17 HIxAI decisions in upload.md's open-questions table. R11
shipped fewer of each and validated the design-first thesis. R14
stress-tested it under heavy reframe pressure and the thesis held.

## Evidence

- Files:
  - [.agents/plan/cycles/Round_14.md](../plan/cycles/Round_14.md) —
    full Do log + Act narrating each reframe
  - [.agents/design/data-management/upload.md](../design/data-management/upload.md) —
    17-row open-questions table at the bottom
  - [.agents/design/data-management/datasets.md](../design/data-management/datasets.md) —
    the noun-side split
  - [.agents/design/index.html](../design/index.html) — the hub
    that made cross-linked navigation possible
- Companion lessons:
  - [2026-05-22-ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md) —
    build-first / design-first lineage
  - [2026-05-23-drifted-shell-distillation.md](2026-05-23-drifted-shell-distillation.md) —
    where the methodology came from
- Round_11's smaller-scale validation:
  [Round_11](../plan/cycles/Round_11.md) — five HIxAI decisions in
  one round; R14 confirms the pattern scales to seventeen.

## Recommendation

**Do**:

- Author the cross-linked preview alongside the markdown design,
  not after. The preview is what catches framing errors; markdown
  alone catches surface errors.
- Treat each HIxAI Q&A pass as **expected**, not exceptional.
  Design rounds should budget for multiple reversal passes; the
  methodology is the catch net, not a one-shot specification.
- When a reversal happens, record the **superseded decision** in
  the open-questions table with a "reversed" tag. Don't just
  overwrite — the history of why the design is now this shape
  pays back later when R15+ implementers ask "why not the
  obvious thing?"
- Run the **N=2 preview-infrastructure trigger** the moment a
  second preview lands (shared CSS + cross-linked sidebars +
  index page). The design README documents the pattern; follow
  it without amendment — R14 confirms it slots in cleanly.

**Don't**:

- Don't shortcut to code when a design round is "almost done."
  R14 felt almost-done four times and each near-close surfaced a
  reframe that would have been catastrophic in code.
- Don't treat the open-questions table as a one-time list. It's
  a running ledger across the round; new questions get added as
  the preview surfaces new framing concerns.
- Don't conflate "the markdown is locked" with "the design is
  locked." The preview is the lock — when HIxAI can walk it and
  no new questions surface, the design is locked.

## Promotion Candidate?

- [ ] `context/` — possibly, once a third design-only round (R15
      Plan or later) confirms the pattern under different scope
      shape. The current `design/README.md` already carries the
      operational rules; this memo captures the meta-finding (the
      methodology holds under heavy reframe load), which is a
      separate claim worth its own promotion track.
- [ ] `skills/`
- [x] Not yet — one strong instance (R14) + one smaller instance
      (R11). Promote on the third.
