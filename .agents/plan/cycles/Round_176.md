# Round 176: `in` / `not in` + column-vs-column predicates

**Status**: Complete — the human signed off 2026-10-15 ("flip r176 to complete") before opening R177; the branch had meanwhile served as the dogfood pin (`release/v0.0.1-rc.1` @ `5334c81`) for two weekly runs.
**Flow**: DCFBI — one capability, contract-first, accepted against real dogfood numbers (kept outside this repo).
**Date started**: 2026-10-04
**Date completed**: 2026-10-15

## ⟢ At a glance

**Shipped** — `in` / `not_in` (a value list, 1–500, case-insensitive for text) and a column
operand (`refCol`) on every predicate that travels as an atom: `aq`, saved-query filters, `filter`
steps and `case` WHEN. The builder's predicate row gets a tag select and a Value/Column switch. The
chip grammar and `OPS_BY_DTYPE` are unchanged. Backend 483 · builder 393 · contracts 40, all green.
On the dogfood export, every lead-funnel query gives identical rows with one `in` in place of the
7-branch `case`.

**Studied** _(predicted → saw → now believe)_ — **predicted** the atom shape could carry both
additions without a new step kind or URL grammar. **Saw** exactly that: two optional fields on
`FilterAtom` / `FilterStepPredicate`, one SQL builder branch each, and the chip path refusing list
ops with a pointer to `aq`. **Now believe (high confidence — 8 real queries, row-for-row)** that
list-membership and flag rules (scope, funnel membership, answered/talked flags) can be expressed
as queries without new nouns. A ratio with an extra status on each side is one `in` per side.

## Goal

**Inherits from ← [Round_175](Round_175.md)**. The weekly-report dogfood recorded two gaps in its
Act section:

- **No list operator.** The lead-funnel pivot filter is literally a checklist of 7 call statuses,
  so the pack spells it as 7 `case` branches.
- **No column-vs-column predicate.** "Same day last year" and "valid from ≤ expiry" go the long
  way round through `date_part` + `derive`.

The human's review (2026-10-04) ordered a program starting here: R176 → R177 (`compute` + `trim`)
→ R178–R179 (refresh) → R180 (workflow as a derived dataset).

This round adds `in` / `not_in` and a `refCol` operand to every predicate that travels as an atom:
`aq`, saved-query filters, `filter` steps and `case` WHEN. The chip grammar is left alone.

_Track: 1 (product). Pulled by: R175 Act ("recorded, not fixed") + the human's ordered program —
per [Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: the lead-funnel pack's 7-branch membership tests collapse to one `in`
predicate, and the funnel numbers stay identical on the real dogfood export. A query can filter `col_a >= col_b` directly.
**Falsified if**: a list op needs a new step kind or a URL-grammar change to be usable — i.e. the
atom shape cannot carry it.

- [x] **D** — [`dataset-filters.md` § Atom-only operators](../../design/data-management/datasets/dataset-filters.md)
      and [`query-construction.md` § Predicate rows](../../design/data-management/queries/query-construction.md).
      `OPS_BY_DTYPE` stays the chip vocabulary.
- [x] **C** — `_shared/query.yaml`: `FilterAtom` and `FilterStepPredicate` gain `vals` (1–500)
      and `refCol` (index / effective name). The rows-get `aq` description notes them.
- [x] **B** — `app/ingest/filters.py`:
  - list ops + column operand in `_build_aq_atom` and `_predicate_sql`;
  - `_plan_filter` maps `refCol` name → index;
  - the chip path rejects list ops with a pointer to `aq`;
  - pydantic models gain both fields;
  - new `tests/test_in_list_and_col_compare.py`.
- [x] **F** — `PredicateList`:
  - `in` / `not_in` render a tag select;
  - comparison ops get a Value/Column switch;
  - types, i18n (EN/VI), MSW parity;
  - `tests/steps-r176.test.tsx`.
- [x] **I** — run the dogfood lead pack with `in` on this branch's backend and compare with the
      `case` version on the same data. The numbers must be identical.

## Risks / unknowns

- **Case-folding `IN`** builds `lower(?)` per value, so 500 values is 500 parameters. That is
  fine in DuckDB, but the cap is the guard.
- **NULL in `not_in`**: excluding NULLs matches `ne`. Users could read "is not one of" as
  including blanks, so it is documented and covered by a test, not changed.
- **The pack cannot switch to `in` until this branch is merged** on the owner's PC. Until then the
  pack keeps `case`, and the `in` variant is proven on the cloud runner only (see I).

## Do

- 2026-10-04 — R175 flipped to Complete (human sign-off). D written. The design choice is to keep
  `OPS_BY_DTYPE` unchanged and layer `in` / `not_in` on top inside the atom path only. That keeps
  the chip popover, its URL grammar and the paired FE/BE vocabulary tests untouched.

- 2026-10-04 — C + B (`9002f36`): contract fields, `_build_aq_atom` / `_predicate_sql` branches,
  `_plan_filter` name → index, chip rejection, pydantic models, 20 backend tests. Two test fixes on
  the way: unique query names (409 `name_taken`) and `before` instead of `lt` for dates.
- 2026-10-04 — F (`91ddf4a`): `PredicateList` tag select + Value/Column switch (same dtype family,
  never the row's own column), EN/VI i18n, MSW parity for list ops and `refCol` in the filter and
  `case` mocks, `tests/steps-r176.test.tsx` (6).
- 2026-10-04 — I: on the cloud runner (this branch, the 04/10 data), each saved `Lead funnel – …`
  query and the DQ query was previewed twice through `POST /queries/preview` (persists nothing;
  `app.sqlite` md5 unchanged): as saved, and with the 7-branch membership flag swapped for one `in`
  (the DQ query's 7 AND-ed `ne` → one `not_in`). All 8 identical, row for row. A preview of a ratio with one extra status on each side works as expected. The pack itself still uses `case` until the
  owner merges this branch.

## Check

- [x] backend 483 · builder 393 · contracts 40 green; `plan:lint`, `design:lint`, markdownlint 0
- [x] I: lead funnel with `in` = with `case`, every month 01–09/2026 (8 queries identical)
- [x] ⟢ At a glance **Studied** line written
- [x] **Acceptance walk** (human reviewer) — `coverage: 3 of 3`, closed at the Complete flip
      (2026-10-15): the human accepted the round on the strength of I (8 dogfood queries identical,
      row for row) and two weekly runs on this commit as the pinned release; no separate per-step
      walk was recorded.
  - ✅ W1 — in a query's Transform, add a `filter` step on a status column **in** a list of
    statuses via the tag select. The row count matches the equivalent `case` query.
  - ✅ W2 — switch the op to **not in** and add one more status. The rows with that status disappear and
    the blanks stay out (NULL rule).
  - ✅ W3 — on a dataset with two date columns, add a `filter` step end-date **gte** in Column mode
    against start-date. Every row survives; flipping to **lt** returns 0 rows.

## Act

**Learnings**:

- The atom shape (`FilterAtom` / `FilterStepPredicate`) is the right seam for predicate growth:
  two optional fields covered both a list operator and a column operand, with no new step kind and
  no change to the chip grammar or its URL form.
- Proving a feature on the cloud runner against the saved dogfood queries (`POST /queries/preview`,
  persists nothing) is a cheap, repeatable I-gate for rounds that must not change existing numbers.
  rc.2 reuses it as the "before/after identical" check (G-rc2).
- Keeping `OPS_BY_DTYPE` as the chip vocabulary and refusing list ops on the chip path (with a
  pointer to `aq`) kept the paired FE/BE vocabulary tests untouched — the cheapest possible
  backward-compatibility story.

**Promotions**: none this round — the lessons above are round-local; the preview-as-I-gate pattern
is worth a memory note once a second round uses it.

**Follow-ups (not promotions, just notes)**:

- The dogfood pack still spells membership as `case` until it is re-pointed at `in` on the owner's
  side; that is a pack change, not a repo change.
- The ordered program from R175 (`compute`/`trim` → refresh → derived-dataset publish) is
  re-sequenced by the 2026-10-13 roadmap: it moves to rc.3, behind the rc.2 presentation rounds.

## Feeds into → Round_177

The 2026-10-13 roadmap (rc.2 → rc.5, decided outside this repo) re-sequences the program R175 set
out: the `compute` / `trim` step, refresh and the derived-dataset publish move to **rc.3**, and
`release/v0.0.1-rc.2` branches from this commit (`5334c81`) for a set of small presentation and
trust rounds. Round numbers follow the implementation order, so:

- **R177** — widget height (`Widget.rows`, 1–3; optional, absent = 1). The first rc.2 round.
- then dataset date coverage, a `note` widget, read-only metadata, table totals, export, and
  relationship self-check — each its own round, in that order.
- `compute` / `trim`, refresh (multi-file merge, `replace_period`) and the derived-dataset publish
  follow in rc.3, inheriting the column-operand plumbing from this round for `concat` join keys.
