# Round 125: workflows FE — the transform-steps builder (F1, awaits feel-review)

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: **DFCFBI** — a UI feel-surface; **hard-stops at F1 for the human's in-browser review**
([[dfcfbi-f1-needs-human-review]]). No contract/backend change — the wire (steps on the definition)
shipped R120–R123; this is FE authoring over it.

## Goal

**Inherits from ← [Round_124](Round_124.md)** — make the backend workflow engine (R120–R123)
**usable**: a "Transform" section in the query builder to author the ordered `steps` (group / compute
a column / filter / top-N), with the live preview showing the shaped result and Save persisting via
the existing PUT/POST (which already accept `steps`).

_Track: 1. Pulled by ← the human ("proceed with FE builder first")._

## The column fork — resolved (v1 = single-source)

The builder's `columns` is the **PRE-step** space (the join/filter editors depend on it); a stepped
query's preview returns **POST-step** columns. Resolution:

- **`resultColumns`** (new) = `preview.resolvedColumns ?? columns` — the columns matching the
  (possibly shaped) preview ROWS. The preview TABLE uses it; for a stepless query it equals `columns`
  (no change). The per-column source-filter popover is dropped once shaping (a source-index filter
  can't map onto a shaped result — that's a `filter` step's job).
- **The steps editor** authors against the **pre-step** space and threads the evolving columns
  through each step on the FE (`steps.ts`, a mirror of the backend `_step_plan`), so every step
  offers the columns available AT that point.
- **v1 scope: single-source dataset queries** (`canUseSteps = !isJoined && !isComposed`), where
  `columns` IS the clean pre-step base. Joined/composed steps show a note and wait until the preview
  exposes base + result columns separately (the general fix). **Empty `steps` = every query
  unchanged** (opt-in; all existing tests green).

## Plan

- [x] `steps.ts` — pure column-threading (`threadColumns`/`stepOutput`/`blankStep`/`isNumericCol`).
- [x] `StepsEditor.tsx` — add/reorder/remove steps; per-kind forms (aggregate · derive · filter ·
      top_n), using the per-step columns. v1: one measure / one predicate (chain for more).
- [x] `useQueryBuilder` — `setSteps`, `resultColumns`, `canUseSteps`.
- [x] `QueryBuilderPanel` — a collapsible **Transform** section + the preview using `resultColumns`
      + the source-filter popover gated off when shaping.
- [x] i18n (en + vi); FE unit tests (threading + editor render/remove).
- [ ] **F1 GATE — human in-browser feel-review** (the DFCFBI hard stop): author steps on a real
      query, confirm the live preview shows the shaped result and Save round-trips.

## Risks / unknowns

- **Feel unknowns only a browser shows** — the per-kind forms' ergonomics, the shaped-preview
  refresh, the source-filter-drops-when-shaping transition. That's the F1 review's job.
- **MSW preview ignores steps** — so an FE *integration* test can't yet assert the shaped preview;
  covered by the pure-threading + editor unit tests here, the backend pytest (R120–123), and the
  human feel-review. A steps-aware MSW preview mock is a follow-up.

## Do

**Built:** `steps.ts` (threading mirror), `StepsEditor.tsx` (4 per-kind forms + add/move/remove),
`useQueryBuilder` (`setSteps`/`resultColumns`/`canUseSteps`), `QueryBuilderPanel` (Transform section
via `TransformSection`; preview `resultColumns`; popover gated by `shaping`), en/vi `steps.*` keys.

**Verification:** FE `tsc` clean · `vitest` **246 pass** (7 new in `steps-editor.test.tsx`, covering
threading and editor render/remove) · no regression (the query-builder + dashboard suites are green;
stepless path byte-unchanged) · `prettier` clean.

## Check

- [x] `tsc` + full FE suite green (246; 7 new); no regression to the shipped builder.
- [x] Stepless queries render exactly as before (the Transform section is additive; `resultColumns`
      ≡ `columns` with no steps).
- [ ] **Human feel-review (F1)** — pending (the DFCFBI hard stop; only a browser can judge it).

## Act

**Learnings:**

- **The wire being ready made the FE pure-additive.** Because R120–123 shipped `steps` on the
  definition + preview/run applying them, the FE round added **no contract/backend** — just authoring
  - the column-fork handling. Building the producer first paid off again.
- **The column fork is the real integration cost**, and it's bounded: `resultColumns` for the table,
  pre-step `columns` for the editors, single-source for v1. The joined/composed generalization is a
  clean follow-up (preview returns base + result).

**Promotions:** none — extends [[workflows-extend-query-duckdb-first]] (now has an authoring surface).

**Prune check:** nothing pruned.

## Feeds into → Round_126 (TBD)

Pending the **F1 feel-review**. Likely next: the widget-consolidation (a chart widget over a
pre-shaped query should render its rows, not re-aggregate — the "two aggregate paths" from R120); the
joined/composed steps generalization (preview returns base together with result columns); and/or the
parked **Workflow-noun** decision (R124's wall).
