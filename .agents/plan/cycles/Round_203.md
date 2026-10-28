# Round 203: within N days of a start date — a builder recipe for cohorts that cannot be read yet (item 5.3, pulls 4.5)

**Status**: Review
**Flow**: **DCFBI** — builder-only after the Contract-exit review (see Do): a dialog that inserts five
existing steps; no contract, route, engine or migration change.
**Date started**: 2026-10-28
**Date completed**: —

## Goal

**Inherits from ← [Round_202](Round_202.md)** — rc.5 is open on `release/v0.0.1-rc.5` (R202 in
Review). R202's `Feeds into →` names the typed metadata entry, which waits for a machine-read case;
this round takes the next pulled item instead.

A rate **by start period** — "of the rows that started in September, how many reached the event
within N days?" — reads low for the newest periods: their rows have not yet had the full window. A
reader sees "the rate fell" when nothing fell. The program parked this as conditional item **4.5**
("cohort ratios flag cohorts not yet observable for the full window"). Its second entry condition
is now in the rolling log: the first user still needs a workaround after rc.3 — a weekly page read
"conversion fell" while closed deals rose, and the user rebuilt a same-age rate outside MDD.

**What the gap is (corrected at Contract exit).** The first draft of this round said no step could
compare a start date with the data's cut-off. BA showed otherwise: R175's `group_column` with an
empty `by` gives a whole-table value — added for exactly "the data's cut-off compared on every row"
— so `max(start)` across everything, two `date_diff` and two `case` steps already produce an
**observed** and a **within** column (probe on a fixed table: 5 rows, 3 observed, 1 within). The
engine is not missing anything; the user did not find the five steps, and assembling them right
(age ≥ N, 0 ≤ days-to-event ≤ N, within ⊂ observed, as-of from the start column) is where people
slip. A new step kind is a one-way door (saved queries would depend on it); a recipe is not.

The owner added the item to rc.5 (2026-10-28) as a general, adaptive feature, not shaped for one
user: any funnel has the arithmetic (trial → paid within 30 days, ticket → resolved within 7 days,
invoice → paid within 45 days).

_Track: 1 (product). Pulled by: rolling log 2026-10-28 (4.5 entry, second condition) + owner,
2026-10-28._

## Plan

**Expected outcome**:

- **Recipe** (`queries.md` § the recipe) — five ordinary steps, in order:
  1. `group_column` `{name: <start>_as_of, agg: max, col: start, by: []}` — the latest non-NULL
     `start` (never later than the true cut-off: an `end` typo or a due date cannot move it);
  2. `date_diff` `day` `start → <start>_as_of` → `<start>_age_days`;
  3. `date_diff` `day` `start → end` → `<start>_to_<end>_days`;
  4. `case` `<start>_age_days ≥ N → 1`, otherwise `0` → **observed** (default `observed_<N>d`);
  5. `case` `observed = 1 ∧ days-to-event ≥ 0 ∧ days-to-event ≤ N → 1`, otherwise `0` → **within**
     (default `within_<N>d`) — a subset of observed by rule.
- **Builder** — `Add a column` ends with **Within N days of a start date…** / VN **Trong N ngày kể
  từ ngày bắt đầu…**; a dialog with Start date · Event date (date/datetime only) · Within (days)
  1–3660 (default 30) · Observed column · Within column (defaults follow N until typed); `[Add]`
  appends the five steps after the last card; names that already exist get `_2`, `_3`, …; disabled
  with a reason when fewer than two date columns exist at the end of the chain; `[Add]` disabled
  while start = end, a name is blank, or the two names are equal. EN/VI labels per design.
- **Tests** — backend: the recipe's numbers on a fixed table, including the boundary day N, an end
  before the start, an end after the window, a NULL end, a NULL start, an `end` far in the future
  (as-of unchanged), a `filter` before the recipe, and the rate through aggregate + derive;
  builder: the menu entry and its disabled reason, the dialog defaults and name-follow, the five
  steps appended with the right bodies, collision suffixes, EN/VI.

**Falsified if** any of these happens:

- the recipe reads `observed = 1` for a row whose start is fewer than N calendar days before the
  latest start;
- `within = 1` on a row with `observed = 0`, an end before the start, or an end more than N days
  after the start;
- an `end` value later than every `start` changes any row's `observed`;
- inserting the recipe changes any existing column's value or the row count, or produces a name
  collision;
- the menu offers the recipe where fewer than two date columns exist, without a reason.

## Risks / unknowns

- **As-of after a narrowing filter** — a `filter` before the recipe lowers the as-of to that
  subset's latest start, so a quiet segment reads younger than the export. Safe direction (never a
  young row read as observed); stated in the docs. The as-of is a visible column, so a reader can
  see what it was.
- **Calendar days vs timestamps** — `date_diff` counts day boundaries on the DATE; a datetime start
  at 15:00 on day 0 is observable on day N whatever the hour. The I-phase match uses the same rule.
- **Five editable cards** — a user can later edit one of the five and break the rate. Accepted; the
  trigger for a step kind of its own is a logged case of exactly that.

## Do

- [x] **D** — rc5.md item 5.3; program row + rolling-log entry (4.5 entry met); this round file;
      design: `queries.md` § the recipe, `query-construction.md` § Within N days (dialog) + AC 14
- [x] **C** — _the first draft added a `conversion_window` step kind; reverted at Contract exit
      (BA-C1: the five-step recipe already exists; a step kind is a one-way door). No contract
      change._
- [x] Contract-exit BA (CHANGES, all folded): C1 premise corrected (Goal); C2 as-of = latest
      **start** only; C3 I-phase match defined below; C4 VN for every label; C5 "latest non-NULL";
      C6 neutral title ("Within N days of a start date"; the output is `within_<N>d`); C7 the
      rolling log carries no user rule or threshold.
- [x] **B** — `tests/test_within_days_recipe_r203.py` pins the recipe (4 tests: every row case
      incl. boundary day 14, end before start, a 2099 end, NULL start; the rate through aggregate +
      derive with ÷0 → NULL; a filter first lowers the as-of; no existing cell or row changes). No
      app change.
- [x] **F** — `steps.ts`: `RecipeChoice` in `STEP_MENU` (last in Add a column), `withinDaysRecipe`,
      `withinDaysDefaults`, `withinDaysProblem`, `withinDaysAvailable`, fresh names (`_2`, `_3`);
      `WithinDaysDialog.tsx` (labels above controls, names follow N until typed, the problem
      shown and `[Add]` disabled); `StepsEditor`: the entry opens the dialog, disabled with a
      reason under two date columns, the menu renders every option (`virtual={false}`, 17
      entries); i18n EN/VI. `tests/within-days-r203.test.tsx` (10).
- [x] **I** — real-volume install: the recipe on the dogfood's lead dataset, per creation month,
      against the outside computation **with the same semantics** (calendar days, as-of = latest
      start date, the user's own N): match = equal `observed` and `within` counts per month; any
      difference listed with its cause. **Result:** a de-identified extract of the first user's funnel (a row number, two dates and a
      group label — no customer field) loaded on this branch's backend; recipe + month bucket +
      aggregate: **10 / 10 months equal** (row count, observed, within) to the outside computation;
      the newest month reads partial in both. Rows with no start date fall outside every month in
      both. The staged extract was deleted after the run.
- [x] Check — gates; code review; BA (after build); QA (see Check)

## Check

**Gates** (head of this round): builder **685 / 685** (674 + 11). The last full run read
684 / 685 — the i18n parity test caught a missing VI `withinDaysHelp_one`; added, and that file plus
the round's re-run green; `tsc` clean, `vite build` clean (chunk-size warning as before); backend **802 / 802**
(+ 4 recipe tests; no app file changed); contracts **55 / 55** (net contract diff empty — the
Contract-exit revert left nothing behind); md / plan / design lints 0; guard (no user names, no
`backend/data`) empty.

**Real-volume run** — 10 / 10 months equal to the outside computation (Do › I).

**Live probe + visual gate** (QA, real backend, mocks off, Playwright, 1366 × 768, light EN + VI;
`tmp/r203vis/`): the dialog inserted the five steps; per-row observed/within read right on the
boundary day, an end before the start, a same-day end, a NULL end, a NULL start and a far-future
end (as-of unchanged); a second insertion suffixed `_2` throughout; Save → PUT 200 and the rows
endpoint returned the same values; the one-date-column menu disabled the entry; no console or page
errors.

**Reviews**

- Contract-exit BA — **CHANGES** (C1–C7), all folded before B (see Do); the step kind was withdrawn.
- Code review — **PASS** (P0/P1 none). P2 fixed: CR-1 the MSW mock's date `max` returned NULL
  (`Number('2026-…')` is NaN), so the mock preview read every row unobserved and the mock test
  proved nothing — the mock now takes a date's min/max as the earliest/latest date and the test
  asserts both outcomes; CR-2 a typed name could be suffixed silently — the dialog now shows
  **Will add: …** with the final five names; CR-3 a cleared Days field kept the previous N — now
  the `days` problem, `[Add]` disabled.
- After-build BA — **CHANGES** (one P1). P1 fixed: BA-F1 the round file carried the first user's
  threshold, row counts and column list — reduced to the parity statement (the firewall). P2 fixed:
  BA-F2 the design example and the backend test used the first user's N — now 30 in the docs and
  10 in the test; BA-F3 "18 entries" → 17; BA-F4 = CR-2. Walk script below (BA's).
- QA — **PASS** (P0/P1 none). P2 fixed: QA-1 the disabled reason was only a hover `title` — now a
  visible second line in the option; QA-2 EN "once 1 days" — plural keys (`_one` / `_other`);
  QA-3 the Add-step popup truncated long labels (VI already did before) — the popup now sizes to
  its longest label. Logged, not fixed: a recipe's own `*_as_of` columns are date columns, so a
  second recipe's pickers offer them (harmless, may surprise); the auto-name input clips
  `<start>_to_<end>_days` on the card (cosmetic, pre-existing width).

**Walk script** (owner; fresh install, any CSV with two date columns, a few rows starting in the
last two weeks; ~10 min):

- W1 Upload; create a query; `[Add step ▾]` → Add a column: the last entry reads **Within N days of
  a start date…**.
- W2 Add a Select columns step keeping one date column: the entry is greyed with the visible line
  "Needs two date columns at this point". Delete that step.
- W3 Open the entry: Start / Event offer only date columns; Within (days) = 30; names
  `observed_30d` / `within_30d`; the **Will add** line lists five names.
- W4 Days 14 → both names follow; type a Within name, then Days 7 → only Observed follows. Clear
  Days → the problem line, `[Add]` disabled.
- W5 Event = Start → `[Add]` greyed with "Start date and event date must be different columns."
- W6 `[Add]` → five ordinary cards after the last card; preview: rows newer than N days before the
  latest start read Observed 0 and Within 0; Within never 1 where Observed is 0; row count unchanged.
- W7 Date bucket (month) on the start column → Group & aggregate by month (count, sum Observed, sum
  Within) → Computed column Within ÷ Observed: the newest month shows Observed below its count, not
  a near-zero rate.
- W8 Switch to VI: menu **Trong N ngày kể từ ngày bắt đầu…**; labels Ngày bắt đầu / Ngày sự kiện /
  Trong (ngày) / Cột đủ thời gian / Cột trong hạn.

## Act

- **Rolling log**: the two QA observations (recipe columns offered to a second recipe; the clipped
  auto-name input) go to the program's rolling log.
- **Lesson (Track 2, for promotion review)**: a round premise ("no step can do X") is a claim about
  the engine — check it against the vocabulary before the contract, not at BA. Here the BA caught
  it at Contract exit and the one-way door (a new step kind) was avoided; the probe that settled it
  took one test.
- **Prune check**: no new step kind, no new endpoint; the recipe is reversible (remove the menu
  entry and the dialog).
- **Promotion**: none yet — one round of evidence.

## Feeds into → Round_204

- A step kind of its own for the recipe opens only on a logged case of a user editing one of the
  five cards and breaking the rate (the trigger in `queries.md`).
- rc.5's own exit (tag) remains the owner's call; 5.1 stays conditional.
