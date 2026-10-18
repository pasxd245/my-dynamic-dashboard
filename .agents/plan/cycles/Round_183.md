# Round 183: relationship self-check — coverage, observed cardinality, join multiplication

**Status**: Complete — the owner walked it (walk pack session A, 2026-10-18: all items passed, no findings) and instructed the flip ("All 45 passed, flip them").
**Flow**: DCFBI — one read endpoint + one drawer + one warning, contract-first, verified on a fixture with a repeated and a missing key.
**Date started**: 2026-10-15
**Date completed**: 2026-10-18

## ⟢ At a glance

**Shipped** — `GET /relationships/{id}/check` measures a governed edge against both committed
datasets in one DuckDB query: rows matched / unmatched and coverage per side, distinct keys and
the most rows per key, the **observed** cardinality (`one` where keys are unique, `many`
otherwise) beside the declared one, and whether a join in either direction multiplies rows.
Fresh on every read, never stored; a flag, never a block — a joined query over a mismatched edge
runs exactly as before. The relationships page gets a **Check** button per edge opening a
read-only drawer (coverage bars, declared vs observed, multiplication warnings, and — the R180
follow-up — the relationship's metadata panel); the join modal warns before saving a hop that
will multiply rows. Backend 534 · builder 432 · contracts 46.

**Studied** _(predicted → saw → now believe)_ — **predicted** "cardinality mismatch" was the
useful flag. **Saw** on the fixture that the actionable line is the direction-specific one —
"joining from A to B can multiply rows: a key has up to N rows on B" — because that is what a
query author is about to do; the cardinality label is its summary. **Now believe (high
confidence)** that the check's value is at the join decision (the modal warning), and that the
drawer is the place to _understand_ a number that looks wrong, not a gate anyone must pass.

**Watch** — the check reads both parquets whole; fine at dogfood size (tens of thousands of
rows), worth measuring on a large pair before putting it on a list page automatically (it is
on-demand now for that reason). Keys compare as text after the join's own CAST, so `1` and
`1.0` are different keys, as they are in the join. Blank keys count as unmatched rows and are not
keys.

## Goal

**Inherits from ← [Round_182](Round_182.md)** — the last rc.2 round. A relationship is
declared by a person; the exports it joins change every week. When a key repeats on the "one"
side, a join silently doubles rows and every sum built on it is wrong; when half the rows have
no partner, an inner join silently drops them. Nothing today measures either.

Measure the edge against the data and show it where the edge is declared and where it is used.

_Track: 1 (product). Pulled by: the rc.2 roadmap's R-f (external feedback item F18 — "does the
relationship hold on this week's data?"), and purpose.md's key design decisions #4
(relationships are central and not fixed) and #5 (flag, don't block) — per
[Evolution Rule](../../AGENTS.md)._

## Plan

**Expected outcome**: a fixture with a repeated key and a missing key gives exact coverage and
unmatched counts on both sides, an observed cardinality that differs from a wrong declaration,
and the right direction flagged for multiplication; the joined query over that edge still runs
and returns the same rows.
**Falsified if**: the measurement needs the join to run, or the flag changes what a query
returns.

- [x] **D** — a measurement, not a state: nothing stored, nothing blocked; the join's own
      CAST-to-text comparison, so the numbers describe the join that would run.
- [x] **C** — `relationships/check-get.contract.yaml` (`checkRelationship` → `RelationshipCheck`).
- [x] **B** — `ingest/relationship_check.py` (`check_relationship`: one query, both sides);
      `routers/relationships.check_relationship_route` (404 / 409 `relationship_stale`);
      `tests/test_relationship_check.py` +3.
- [x] **F** — `types.RelationshipCheck`; `relationshipsApi.check`; `useRelationshipCheckQuery`;
      `RelationshipCheckDrawer` (`RelationshipCheckView`, `checkFlags`) with the R180
      `MetadataPanel` for the relationship; **Check** button on `WorkspaceRelationshipsPage`;
      `JoinMultipliesWarning` in `JoinWithRelatedModal` (direction from the hop's own side);
      EN/VI i18n; `MOCK_RELATIONSHIP_CHECK` + MSW; `tests/relationship-check.test.tsx` +4.
- [x] **I / visual gate** — `orders.region ↔ regions.region` declared `many_to_one`, with
      `East` twice and `Central` unused on the right and `South` absent from it: drawer shows
      29 / 40 and 4 / 5 with a partner, 4 keys and up to 12 / 2 rows per key, observed
      `many:many` vs declared `many:1` flagged, both multiplication warnings, the metadata panel.

## Risks / unknowns

- **Cost on large pairs** — two full scans; on-demand only (button / modal), not on the list.
- **Semantics of "coverage"** — rows with a partner over all rows, blanks included in the
  denominator (a blank key is a row the join will drop). Documented in the contract.
- **The modal's direction** — the hop starts from the current dataset, which may be either side
  of the edge; the warning picks `multipliesLeft` or `multipliesRight` accordingly and names the
  other side's max rows per key.

## Do

- 2026-10-15 — B: module + route + contract; the first fixture comment mis-counted (key 3 had no
  partner at all), corrected the expectations to the data. 3 tests. Backend 534, contracts 46.
- 2026-10-15 — F: type, API, hook, drawer with metadata panel, page button, modal warning,
  i18n, MSW, 4 tests (flags, view, page → drawer, modal warning). Builder 432, type-check clean.
- 2026-10-15 — visual gate on the cloud runner (fixture above): the drawer's flags read
  `cardinality multipliesLeft multipliesRight leftUnmatched rightUnmatched`; metadata panel
  present (0 entries). Nothing written under `workspace/apps/backend/data/`.
- 2026-10-15 — **G-rc2 evidence: dogfood before / after parity** (release-level, logged on the
  last rc.2 round). On the owner's machine, against two COPIES of the external dogfood data
  (kept outside this repo; never left the machine; deleted after), `release/v0.0.1-rc.1`
  (`5334c81`) and `release/v0.0.1-rc.2` (`5649834`) each ran an in-process probe that recorded
  only sha256 prefixes and counts:
  - **119 / 119 items identical** — 1 workspace list; 8 datasets × (meta, schema without the new
    `coverage`, every row: 178 557 rows); 40 saved queries × (definition + resolved columns,
    unpaged result: 1 000 rows, none capped); 5 dashboards (the wire body, byte-for-byte — no
    `rows` / `totals` backfilled); 9 widget aggregates (the same 9 answer 422 on both: the probe
    asked `/aggregate` of pre-shaped queries, which the widget itself never does — R127 / R175).
  - **Migration `0005_metadata_entries`** applied cleanly on the real database copy.
  - **R181 on real data**: 27 table widgets (all over stepped queries), 133 numeric columns —
    `/totals` equals a Python sum of the same rows for **133 / 133**.
  - **R178 on real data**: `profile_date_coverage` over all 8 parquets — 18 temporal columns
    profiled, every one with a range and a blank share in [0, 1]. Existing datasets carry no
    `coverage` until their next refresh, as designed.
  - Not exercised: R183 (the dogfood workspace declares no relationship), R180 writes (no token
    configured — the default).

## Check

- [x] backend 534 · builder 432 · contracts 46 green; `tsc --noEmit` clean; `ruff check` clean;
      `plan:lint`, markdownlint 0
- [x] Visual gate (UI-bearing round): real browser, screenshot kept with the review
- [x] Affordance check (`ux-design`, structural): Findability — a Check button on the row, a
      warning in the join modal where the decision is made; Usability — one click, read-only;
      Accessibility — progress bars with text equivalents, warnings as alerts; Credibility — the
      numbers are the join's own comparison; Utility — "will this join double my rows?"
      answered before saving; Desirability — flags with plain sentences, no red X on the list.
- [x] ⟢ At a glance **Studied** line written
- [x] **Acceptance walk** (human reviewer) — `coverage: 3 of 3`, walked 2026-10-18 (walk
      pack session A); no findings:
  - ✅ W1 — on a relationship whose "one" side has a repeated key, press Check. The drawer shows
    the coverage of both sides, the observed cardinality flagged against the declared one, and
    which direction multiplies rows.
  - ✅ W2 — from the "many" side's dataset, open Join with related and pick that edge. The
    warning names the multiplication before you save; the save still works.
  - ✅ W3 — on a clean edge (unique keys, every row matched), Check reads "as declared" with no
    warning.

## Act

- Walk: 3 of 3 passed (session A, 2026-10-18); no findings, so nothing new goes to the
  rolling log.
- Promotion: none this round.
- Prune check: none — the round added no gate or convention; the G-rc2 parity is logged in § Do.

## Feeds into → [Round_184](Round_184.md)

rc.2's seven rounds (R177–R183) are done; the branch awaits the G-rc2 gate (every round
Complete, the dogfood before/after check, the repo grep, the tag). R184 opens rc.3 with the
`compute` / `trim` step program re-sequenced from R176: it inherits the column-operand plumbing
(R176), `_final_relation` as the one definition of a query's result (R181/R182), and the metadata
anchor (R180) to extend with data version / run and view parameters.
