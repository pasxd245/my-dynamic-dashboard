# Round 54: Advanced-query discoverability — operator/column help + Findability-facet sharpening

**Status**: Planning
**Date started**: 2026-05-29
**Date completed**:

## Goal

**Inherits from ← [Round_53](Round_53.md)** — R53 fixed the
advanced-query field's label + Clear (Findability + Usability), but
the R53 UI review surfaced a deeper **learnability** gap: a user
faced with the input has **no way to discover the operators**
(`:` equals, `~` contains, `>`/`<`/`>=`/`<=`, `!=`, `AND`/`OR`,
precedence) or **which columns exist** in this dataset. The only
teaching affordance today is the placeholder + a one-line hint —
which vanish and don't enumerate anything.

This is a **design (UX) question** — _what learnability affordance
should the feature have_ — so it earns a Design gate, not an
ad-hoc patch. R54 closes the gap with a lightweight **help
affordance**: a `?` trigger by the "Advanced query" label opening
a popover that lists, for _this_ dataset, the operator vocabulary
(prefix → meaning, per dtype) + the column names + the AND/OR
precedence rule.

R54 also **sharpens `ui-design`'s Findability facet** to probe
_learnability_, not just "is it labeled." R52's design-spec run
marked Findability `pass` on the presence of a label while missing
"can a user discover how to use the control" — exactly this gap.
With the sharpened facet, R54 is the **first round to run
`ui-design` design-spec mode at its Design gate** against the
amended design, and it should now flag the _old_ design as a
learnability gap and the _new_ design as pass.

_Track: 1 (product: the help affordance), with a small Track-2
prerequisite (the Findability-facet sharpening) pulled by this
round's need to review learnability at its Design gate. Pulled by:
R53 visual-review finding ("how can users remember all
operators?"). Per [Evolution Rule](../../AGENTS.md)._

**Feature round** — the DCFBI/DFCFBI flow applies: `flow-selector`
at Design exit, `ui-design` design-spec at the **Design** gate
(now learnability-aware) + fidelity at **F**. Likely DCFBI (a
static reference popover is low-uncertainty), but the selector
decides.

## What is IN scope

- **Sharpen two `ui-design` facets** (prerequisite, Track-2) —
  both gaps R51/R53 exposed that the v1 skill under-probed. Update
  [`ui-design/SKILL.md`](../../skills/ui-design/SKILL.md) + the
  README role-line:
  - **Findability → learnability** — extend from "labeled +
    distinguishable" to also ask **"is there a discoverable way to
    learn the control's syntax / options (visible label, a help
    affordance, examples, or autocomplete)?"**
  - **Usability → efficiency/effort** — add **"are frequent /
    clear / reset actions low-effort — close to the user's focus,
    adequately sized, or keyboard-accessible (Fitts's Law /
    accelerators)?"** plus the principle **"don't degrade the
    primary affordance to optimize a secondary action"** (e.g.
    don't shrink the query field just to ease clearing). This is
    the objective rule that determined R53's far-top-right Clear
    is high-effort — not a feeling.
- **Design** — amend
  [`advanced-query.md`](../../design/data-management/advanced-query.md)
  with a **§ Discoverability**: the help-popover content (operator
  prefix→meaning table per dtype, the dataset's columns, AND/OR +
  precedence) and its open/close states. **The label row now
  carries three controls** — the "Advanced query" label, the new
  `?` help, and the existing Clear — so design the **row's
  affordance arrangement holistically**: `?` placement _and_ Clear
  placement are (re)decided together at the Design gate, not bolted
  on / assumed (adding `?` changes the row, so "Clear stays
  top-right" must be a deliberate call, not a default). Run
  `flow-selector` + `ui-design` design-spec mode against the whole
  row.
- **Low-effort clear** (per the Usability/efficiency facet) — the
  row commits to a clear that is **both discoverable and
  low-effort**: an **always-visible in-field × clear** (close to
  focus, not the hover-only AntD default) **+ `Esc`-to-clear** when
  the field is focused (zero mouse travel) **+ keep the field
  roomy** (don't shrink it to ease clearing) **+ retain focus
  after clear** (ready to retype; not autofocus-on-load, which
  steals focus). This unifies the deterministic `Esc`-to-clear
  pattern already applied to the `?q=` search field (the AntD-v6
  Escape-null fix) across both query inputs.
- **Build** — a `?` help trigger by the "Advanced query" label →
  AntD `Popover` whose content is **rendered from the existing
  vocabulary** (`OPS_BY_DTYPE` / the parser's prefix map) +
  `Dataset.columns`, so it auto-covers any operators a later round
  adds (e.g. R55). FE-only — no contract / BE change, no new
  predicate.
- **i18n** — help-popover copy (en + vi).
- **Tests** — the `?` trigger renders, opens the popover, the
  popover lists the operator set + this dataset's column names.
  Full FE suite green.
- **Verify** — `ui-design` fidelity → pass; self-audit
  (`markdownlint` + `markdown-check-link`).

## What is OUT of scope

- **Autocomplete / type-ahead** in the input — still deferred
  (needs a rich-text input surface; own round). The popover is the
  MVP learnability affordance, not inline completion.
- **New operators** (`on_or_after` / `on_or_before` / string `ne`)
  — R55. The popover renders whatever the vocabulary contains, so
  it picks up R55's additions for free.
- **Broader affordance sweep** of other surfaces — `ui-design` v2.

## Plan

- [ ] **Sharpen two facets** — `ui-design/SKILL.md`: Findability →
      learnability, and Usability → efficiency/effort (Fitts +
      accelerators + don't-degrade-primary). Update README
      role-line + `.claude` ref-stub if affected.
- [ ] **Design** — amend `advanced-query.md` § Discoverability
      (popover content + placement + states); run `flow-selector`
      (record Flow) + `ui-design` design-spec mode (old design →
      learnability gap; amended design → pass).
- [ ] **Build** — `?` trigger + `Popover`; content rendered from
      the live operator vocabulary + `Dataset.columns`; i18n en+vi.
- [ ] **Test** — trigger renders + opens; popover lists operators + columns; FE suite green; `tsc` clean.
- [ ] **Verify + audit** — `ui-design` fidelity → pass;
      `markdownlint` + `markdown-check-link` clean.

## Risks / unknowns

- **Scope creep to autocomplete.** The pull is "discoverability";
  the temptation is inline completion. Hold to a **static
  reference popover** for the MVP — autocomplete stays its own
  deferred round.
- **Hardcoding the operator list.** If the popover hardcodes
  operators it drifts from the vocabulary. Render it from
  `OPS_BY_DTYPE` / the parser's prefix map so it stays in lockstep
  (and auto-covers R55's new operators).
- **Track-blend (facet + feature).** The Findability-facet
  sharpening is Track-2 inside a Track-1 round; kept because it is
  the instrumental prerequisite that makes this round's Design-gate
  review meaningful (analogous to promoting a token as a
  prerequisite). Small + delineated; split out if it grows.
- **Popover content density.** An operator table + a long column
  list can overflow. Cap height + scroll; group by dtype.

## Do

_Filled during execution._

## Check

_Verification: facet sharpened; design amended + design-spec
re-run distinguishes old-gap from new-pass; help popover built +
renders operators/columns; FE green; fidelity pass; audit clean._

## Act

_Carry-forwards + end-of-round Q&A._

## Feeds into → Round_55 — close MVP query gaps

R55 adds the operators R51 documented as MVP gaps — inclusive
date/datetime bounds (`on_or_after` / `on_or_before`) + string
`ne` — to the **shared** predicate vocabulary. With R54's
help-popover rendering from the live vocabulary, R55's new
operators surface in the popover automatically — no extra
discoverability work.
