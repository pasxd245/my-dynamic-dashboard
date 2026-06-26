# Round 54: Advanced-query discoverability — operator/column help + Findability-facet sharpening

**Status**: Complete
**Date started**: 2026-05-29
**Date completed**: 2026-05-30

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
  [`ui-design/SKILL.md`](../../skills/ux-design/SKILL.md) + the
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
  [`advanced-query.md`](../../design/data-management/datasets/advanced-query.md)
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

- [x] **Sharpen two facets** — `ui-design/SKILL.md`: Findability →
      learnability, and Usability → efficiency/effort (Fitts +
      accelerators + don't-degrade-primary). Update README
      role-line + `.claude` ref-stub if affected.
- [x] **Design** — amend `advanced-query.md` § Discoverability
      (popover content + placement + states); run `flow-selector`
      (record Flow) + `ui-design` design-spec mode (old design →
      learnability gap; amended design → pass).
      **→ Flow: DCFBI; design-spec PASS; gate closed.**
- [x] **Build** — `?` trigger + `Popover`; content rendered from
      the live operator vocabulary + `Dataset.columns`; i18n en+vi.
      **→ reference.ts + AdvancedQueryHelp + in-field ×/Esc/focus.**
- [x] **Test** — trigger renders + opens; popover lists operators +
      columns; FE suite green; `tsc` clean. **→ 15 advanced-query
      (+3 R54); FE 110; tsc clean.**
- [x] **Verify + audit** — `ui-design` fidelity → pass;
      `markdownlint` + `markdown-check-link` clean.
      **→ fidelity PASS 6/6; lint + links clean.**

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

### Facets sharpened (prerequisite)

[`ui-design/SKILL.md`](../../skills/ux-design/SKILL.md): **Findability**
now also asks "is the control **learnable** — for a non-obvious
syntax, is there a discoverable help affordance, not just a
placeholder?"; **Usability** now also asks "is the clear/reset
**low-effort** — Fitts (close/sized/keyboard), and don't degrade
the primary affordance to optimize a secondary action." These are
the two gaps R51/R53 exposed.

### Design (D)

Amended
[`advanced-query.md` § Discoverability + low-effort clear](../../design/data-management/datasets/advanced-query.md)
— the `?` help popover (operator prefixes→meanings per dtype +
this dataset's columns, rendered from the live vocabulary), the
low-effort clear (always-visible in-field ×, `Esc`, roomy field,
post-clear focus), the holistic row arrangement, the state-model
additions, and acceptance criteria **C18–C22**.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition | Fired? | Justification |
|---|---|---|
| 1. >3 independent states/branches | no | Adds only a help-popover open/close + an in-field × visible/hidden on top of R51's existing states — not >3 new branches. |
| 2. New interaction pattern | no | A `?`-help `<Popover>` is a stock AntD pattern already used in the product (the chip `FilterPopover`). |
| 3. High user-error risk | no | Read-only help + a clear; no destructive/irreversible action. |
| 4. Contract depends on unresolved UI | no | FE-only — no contract / BE change; the popover renders from existing vocabulary + `Dataset.columns`. |
| 5. UX confidence below threshold | no | Stock help-popover + in-field-×/Esc clear; the design resolved the row arrangement deliberately. |

Result: **Flow: DCFBI** (0 fired). No F1; Contract + Backend are
no-ops (no wire change).

**`ui-design` design-spec mode** (now learnability + efficiency
aware) on the amended design:

| Facet | Verdict | Evidence |
|---|---|---|
| Findability | pass | declares a label + `?` help popover (learnability affordance), distinct from `?q=` |
| Usability | pass | declares always-visible in-field × + `Esc` + roomy field + post-clear focus (low-effort + discoverable) |
| Accessibility | pass | `Esc` + focus retention specced; build adds aria on `?`/× |
| Credibility | pass | state-model additions table (popover open/closed, × visible/hidden) |
| Utility | pass | acceptance criteria C18–C22 |
| Desirability | pass | reuses AntD `<Popover>` + existing tokens; no new token values |

Result: **PASS** — the design is affordance-complete (the sharpened
facets confirm the learnability + efficiency gaps are now closed in
the spec). **Design gate closed.**

### Build (F) — DCFBI; Contract + Backend no-op (FE-only)

- [`advanced-query/reference.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/reference.ts)
  — `SYNTAX_REFERENCE` derived from the parser's exported prefix
  maps (`NUMERIC/STRING/DATE_OP_BY_PREFIX`) + `familiesForColumns`.
  Renders from the **live vocabulary** — R55's new operators appear
  for free.
- [`advanced-query/AdvancedQueryHelp.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/AdvancedQueryHelp.tsx)
  — a `?` `<button>` (aria-labelled) → AntD `<Popover>` listing the
  operator prefixes→meanings (per dtype family present) + **this
  dataset's columns** (`name [dtype]`).
- [`AdvancedQueryInput.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/AdvancedQueryInput.tsx)
  — `?` help in the label row; the R53 far Clear link replaced by
  an **always-visible in-field × suffix** (`CloseCircleFilled`,
  shown when non-empty) + **`Esc`-to-clear** (`onKeyDown`) +
  **post-clear focus** (`inputRef.focus()`); field width unchanged.
- i18n `datasets.advancedQuery.help.*` (en + vi); parser prefix
  maps exported.

### Test + Verify

- [`tests/advanced-query.test.tsx`](../../../workspace/apps/builder/tests/advanced-query.test.tsx)
  +3 (C18+C19 popover opens + lists operators/columns; C20
  always-visible ×; C21 `Esc` clears) and updated the R53 Clear
  assertion (now an icon w/ aria-label). **advanced-query 15 pass.**
- **Full FE suite 110 pass** (107 + 3); `tsc --noEmit` clean;
  markdownlint 0 errors; `markdown-check-link` clean. (One
  full-suite run hit a pre-existing timing flake on the slow
  upload-wizard test — `datasets.test.tsx` passes 7/7 in isolation;
  not an R54 regression.)
- **`ui-design` fidelity re-run** on the built surfaces → **PASS
  (6/6)**, diff none: Findability (learnability) + Usability
  (efficiency) now satisfied by the `?` popover + in-field-×/`Esc`
  clear; the four other facets still pass.

### Bug fixes folded in (user-reported during Review)

**1. Quoted keys.** A user UI review surfaced that columns whose names have **spaces or
unicode** (`customer number`, `SỐ ĐIỆN THOẠI`) **could not be
queried** — the bare-token-only key in R51's grammar ended the
token at the space. Fixed in the parser:
[`splitKeyValue`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/parser.ts)
now accepts a **quoted key** (`"customer number":>100`) — the colon
follows the closing quote; match stays case-insensitive
(unicode-aware). [`serialize.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/serialize.ts)
quotes keys with whitespace so the URL round-trips, and the help
popover shows spaced names quoted. Grammar updated in
[`advanced-query.md` § Grammar](../../design/data-management/datasets/advanced-query.md).
**+6 parser tests** (quoted/unicode/case-insensitive/compose/
round-trip/unquoted-spaced→error).

**2. Unicode operator aliases.** The help shows each operator's math
glyph (`≠` `≥` `≤`, the shared `filters.op.*` labels), but the
parser only knew the ASCII prefixes (`!=` `>=` `<=`) — a user who
copied `id:≠1` from the help got `"≠1" is not a valid integer`.
Fixed: `splitPrefix` accepts `≠`/`≥`/`≤` as aliases for
`!=`/`>=`/`<=`, so the displayed glyph is directly typeable. Grammar
note added; **+1 parser test**. Also removed a now-unused
`PredicateGroups` import (lint).

**3. Icon library.** R54's new components used `@ant-design/icons`
(`QuestionCircleOutlined`, `CloseCircleFilled`), but the app is
migrating to `@phosphor-icons/react` (the user flagged it). Switched
to `QuestionIcon` + `<XCircleIcon weight="fill" />` (size/weight
props, per the `FunnelIcon` precedent in `FilterPopover`). The
convention + the incomplete-migration caveat are captured in
[`.agents/memory/2026-05-30-fe-icons-phosphor-not-antd.md`](../../memory/2026-05-30-fe-icons-phosphor-not-antd.md).

### Consistency tweaks (review feedback)

- **Search-box clear → in-field ×.** The `?q=` search now uses an
  in-field `×` (the same `XCircleIcon`) instead of the external
  "Clear" text link — consistent with the advanced-query field.
  (Custom suffix, not AntD `allowClear`, to avoid the Esc-null
  path.) +1 dataset-detail test.
- **Hover affordance.** The `×` clear and `?` help icons get a
  shared `.aq-icon-btn` hover highlight (tertiary → secondary), so
  they read as interactive like other controls.
- **Help `?` blue accent.** The help trigger additionally gets
  `.aq-help-btn` — the AntD primary blue (same hue as the sidebar
  nav icons) — so the learnability cue is easy to recognise,
  visually distinct from the muted `×` clear.
- **Help `?` tooltip.** Hover now shows a "Help" tooltip (the
  `help.ariaLabel` string, so the visible hint == the accessible
  name) before the click opens the full syntax popover.

## Check

- [x] Two `ui-design` facets sharpened (Findability→learnability,
      Usability→efficiency/Fitts) in SKILL.md.
- [x] Design amended (§ Discoverability + C18–C22); flow-selector
      → DCFBI; `ui-design` design-spec → PASS; Design gate closed.
- [x] Help popover renders operators (from the live vocabulary) +
      this dataset's columns; low-effort clear (always-visible
      in-field × + `Esc` + roomy field + post-clear focus).
- [x] Quoted-key bug fixed (spaced / unicode column names
      queryable) + grammar doc updated.
- [x] FE suite **119 green** (107 + 3 R54 + 6 quoted-key + 1
      unicode-alias + 2 search-Esc guards); `tsc` clean;
      markdownlint 0 errors; `markdown-check-link` clean.
- [x] Search-box `Esc`-clear bug **root-caused + fixed**: AntD v6
      `Input.Search` `allowClear` ran its own Escape handler that
      emitted a stray "null" (repro'd by the user on an *empty*
      box). Fix: drop `allowClear`, own Escape with
      preventDefault + stopPropagation; explicit "Clear" link
      stays. Guards: Esc-with-query clears; Esc-on-empty inserts
      nothing. (Corrected an earlier wrong "stale build"
      diagnosis.)
- [x] `ui-design` fidelity re-run → **PASS 6/6** (the round's own
      design-side gate, both modes used: design-spec at D, fidelity
      at F).

## Act

**Learnings**:

- **The sharpened facets earned their keep immediately**: the
  learnability + efficiency checks (added this round) are exactly
  what flagged R51/R53's gaps; running design-spec at D then
  fidelity at F closed them with the skill verifying its own work.
- **Render-from-vocabulary pays forward**: the help popover reads
  the parser's prefix maps + `Dataset.columns`, so R55's new
  operators appear with zero discoverability work.
- **Fitts beats geometry tricks**: the low-effort clear is solved
  by an accelerator (`Esc`) + an in-field ×, not by shrinking the
  field — the primary write-a-query task stays roomy.

**Follow-ups (not promotions)**:

- **R55** — close MVP query gaps (`on_or_after` / `on_or_before` +
  string `ne`); the popover surfaces them automatically.
- `ui-design` v2 (screenshot/app-render mode; broader surface
  sweep) stays queued.
- `round-scaffolder` soft signal carries forward (R51–R54 were all
  hand-authored round docs).

**End-of-round Q&A**: R55 (query gaps) is the queued next round.
Confirm at handoff.

## Feeds into → Round_55 — close MVP query gaps

R55 adds the operators R51 documented as MVP gaps — inclusive
date/datetime bounds (`on_or_after` / `on_or_before`) + string
`ne` — to the **shared** predicate vocabulary. With R54's
help-popover rendering from the live vocabulary, R55's new
operators surface in the popover automatically — no extra
discoverability work.
