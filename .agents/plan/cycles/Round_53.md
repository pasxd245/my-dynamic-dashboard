# Round 53: Apply `ui-design` — the R51 advanced-query UI-fix

**Status**: Complete
**Date started**: 2026-05-29
**Date completed**: 2026-05-29

## Goal

**Inherits from ← [Round_52](Round_52.md)** — R52 shipped the
`ui-design` skill and its first run produced a **fidelity-mode gap
report** on R51's `AdvancedQueryInput`: **Findability** (no visible
label; indistinguishable from the `?q=` search box) and
**Usability** (clear action hover-only). The design spec was
complete (design-spec mode passed 6/6) — the **build** drifted.

R53 is the skill's **first remediation** and its proof in use:
apply the fix R51's design already specified — a visible "Advanced
query" label + an explicit, discoverable `[Clear]` — then re-run
`ui-design` fidelity mode to confirm the two gaps close.

*Track: 1 (product). Pulled by: R52 `ui-design` fidelity-mode gap
report on `AdvancedQueryInput`; R51 end-of-round brainstorm
(user-identified affordance gap). Per
[Evolution Rule](../../AGENTS.md).*

**Not a feature round** — no new design, no flow-selector: the
design (`advanced-query.md`) already decided the affordances; R53
conforms the build to it. The gate is **`ui-design` fidelity mode
passing + FE tests green**.

## What is IN scope

- **`AdvancedQueryInput` fix** — a visible **"Advanced query"
  label** (AntD: label-above for readability/fast-fill) so the
  field is distinguishable from the `?q=` box; an explicit
  **`[Clear]`** control (replacing the hover-only `allowClear` ×),
  routed through the existing `onClear` path.
- **i18n** — `datasets.advancedQuery.label` + `.clear` (en + vi).
- **Design-spec sync** — clarify `advanced-query.md` § Layout that
  the label is a header row + Clear link (the ASCII box was
  illustrative), so the design and build agree exactly.
- **Tests** — extend `tests/advanced-query.test.tsx`: the label is
  present, the field has its accessible name, the `[Clear]` is
  visible when a query is active and removes `?aq=`. Full FE suite
  stays green.
- **Verify** — re-run `ui-design` fidelity mode → all six facets
  pass. Self-audit (`markdownlint` + `markdown-check-link`).

## What is OUT of scope

- Any advanced-query grammar / behavior change (R51 shipped it).
- The MVP query-gap operators (`on_or_after` / string `ne`) — R54.
- Broader affordance sweep of other surfaces — `ui-design` v2
  follow-up.

## Plan

- [x] **Apply the fix** — label header + explicit `[Clear]` in
      `AdvancedQueryInput`; drop the hover-only `allowClear`.
- [x] **i18n** — `label` + `clear` keys, en + vi.
- [x] **Sync the design doc** — `advanced-query.md` § Layout note.
- [x] **Test** — extend `advanced-query.test.tsx`; FE suite green
      (107); `tsc` clean.
- [x] **Verify + audit** — `ui-design` fidelity → **PASS 6/6**;
      `markdownlint` + `markdown-check-link` clean.

## Risks / unknowns

- **Regress the tested component.** The label + `[Clear]` touch the
  7-test `AdvancedQueryInput`. The `[Clear]` must route through the
  same `onClear` (remove `?aq=`, reset page) without breaking
  deep-link repopulation or apply-on-valid. Guard with the existing
  tests + new assertions.
- **"Clear" ambiguity.** The page already has a search "Clear" and
  a chips "Clear all"; scope the new control via a distinct
  `data-component` so tests don't cross-match.

## Do

- **Fix applied** —
  [`AdvancedQueryInput`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/AdvancedQueryInput.tsx)
  gains a header row: a visible **"Advanced query" label**
  (`AdvancedQueryLabel`) + an explicit **`[Clear]`**
  (`AdvancedQueryClear`, shown only when a query is active, routed
  through the existing `onClear`). The hover-only `allowClear` × is
  dropped — one discoverable clear, not two.
- **i18n** — `datasets.advancedQuery.label` + `.clear`, en + vi.
- **Design-spec sync** —
  [`advanced-query.md` § Layout](../../design/data-management/advanced-query.md#layout--ascii-intent)
  gains an R53 note: the label is a header row + Clear link (the
  ASCII boxes are illustrative, not a literal border), so design
  and build agree.
- **Tests** — `tests/advanced-query.test.tsx` +3 (label visible +
  distinguishable; Clear hidden until active; Clear removes `?aq=`).
  **Full FE suite 105 pass** (102 + 3); `tsc --noEmit` clean.
- **`ui-design` fidelity re-run** → **PASS (6/6)**, fidelity diff
  none: Findability + Usability gaps closed, the other four still
  pass. (Empty-state acceptance criterion 8 holds — Clear is hidden
  when no query is active.)
- **Self-audit** — `markdownlint-cli2` 0 errors;
  `markdown-check-link --changed` clean.
- **Visual check (user screenshot of the running app)** — the
  label + Clear render correctly, but the rendered readback showed
  `✓ 1 group(s) · 1 predicate(s)` — a literal `(s)` pluralization
  defect the *structural* `ui-design` pass could not catch (only
  rendered pixels show it). **Fixed**: proper i18next pluralization
  (`summaryGroup`/`summaryPredicate` `_one`/`_other`, composed into
  `summary`) → `✓ 1 group · 1 predicate` / `✓ 2 groups · 3
  predicates`. Locked by 2 regression tests (no `(s)`; plural
  form). FE suite **107** (105 + 2).

## Check

- [x] Fix applied (label + explicit Clear; `allowClear` dropped).
- [x] i18n en + vi; design-spec note synced.
- [x] FE suite green (107); `tsc` clean.
- [x] `ui-design` fidelity re-run **PASS 6/6** (was GAP 2) — the
      skill's first remediation verified by the skill itself.
- [x] Audit clean (markdownlint + markdown-check-link).

## Act

**Learnings**:

- **The skill closed its own loop**: R52 detected the gap
  (fidelity GAP 2), R53 remediated, and the *same skill* re-run
  confirmed PASS 6/6. Detect → fix → re-verify with one tool — the
  `gate-walker`-style discipline applied to UX.
- **Build can clarify the spec**: the design's ASCII "box" was
  illustrative; R53 realized it as a label header + Clear link and
  **synced the design doc** so the two agree (O-rule — no drifting
  second source).

**Follow-ups (not promotions)**:

- **R54** — close MVP query gaps (`on_or_after` / `on_or_before` +
  string `ne`), the first feature round to run `ui-design`
  design-spec mode at its **Design gate** before building.
- `ui-design` v2 (screenshot/app-render; broader surface sweep)
  stays queued — **strengthened pull**: the `(s)` defect proves
  structural mode misses rendered-copy issues that only a
  screenshot/render pass catches. v2 is now a concrete, evidenced
  follow-up, not speculative.
- A stray ruff-format reflow of `test_datasets_rows_get.py` (R51's
  file, no logic change) rides along this round's commit as a
  chore.

**End-of-round Q&A**: R54 (query gaps) is the queued next round —
the first to exercise `ui-design` at D. Confirm at handoff.

## Feeds into → Round_54 — close MVP query gaps

R54 adds the operators R51 documented as MVP gaps — inclusive
date/datetime bounds (`on_or_after` / `on_or_before`) + string `ne`
— to the **shared** predicate vocabulary, and is the first
*feature* round designed with `ui-design` applied at its **Design
gate** (design-spec mode) before any build.
