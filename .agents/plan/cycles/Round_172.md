# Round 172: the undeclared dependency — paging is correct because of a DuckDB default nobody set

**Status**: In Progress — opened 2026-08-15. **D gate PAUSED — the round's `Falsified if` fired
and found a real bug.** Joined-query paging loses rows above ~120k. Awaiting the human's call on
the fix's design fork.
**Flow**: _(set at the Design exit via `flow-selector`)_
**Date started**: 2026-08-15
**Date completed**:

<!-- ⟢ At a glance is authored at the Review→Complete flip (R159 doctrine), not during Do. -->

## Goal

**Inherits from ← [Round_171](Round_171.md)**, whose close produced this by refuting its own
claim. R171 recorded three times that `query_dataset_rows`'s missing `ORDER BY` put the dataset
rows path in "the same class R165 W-7 measured". **The human asked whether it was a real bug, and
the measurement said no** — 200k rows, 20 threads, 60 pages: zero duplicates, exact file order,
stable on repeat and under a filter.

What the measurement left behind is smaller and more interesting than the claim it killed:

> **Paging is correct on every read path because of `preserve_insertion_order`, a DuckDB default
> the code never sets, never asserts, and (until R171's close) never mentioned.**

This round makes that dependency **explicit and guarded**. It is not a bug fix — nothing is
broken today, and this round should not "fix" anything a user could see.

_Track: 1 (product — engine robustness). Pulled by: R171's close, § Act "Correction at close"._

## Plan

**Expected outcome**: the dependency is declared in code, guarded by tests that fail if it ever
stops holding, and stated once in the design corpus. No behaviour change a user can observe.

**Falsified if**: setting `preserve_insertion_order` explicitly changes observable behaviour or
measurably costs performance on the paged reads. Then the dependency is not benign, and the round
becomes a **design** question (should these reads carry a real `ORDER BY`, at what cost?) rather
than a robustness one.

### The audit — **every paged read, verified against the code and measured**

| Path                                                                                         | Paged?                | Carries `ORDER BY`?                | Relies on the setting                |
| -------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------- | ------------------------------------ |
| `query_dataset_rows` ([`:53`](../../../workspace/apps/backend/app/ingest/rows_reader.py))    | yes                   | **no**                             | **YES** — a parquet scan             |
| `query_joined_rows` ([`:694`](../../../workspace/apps/backend/app/ingest/rows_reader.py))    | yes                   | **no**                             | **YES** — a hash join                |
| `run_steps` ([`:539`](../../../workspace/apps/backend/app/ingest/rows_reader.py))            | yes                   | yes — `_page_order_sql` (R165 W-7) | no                                   |
| `materialize_steps` ([`:620`](../../../workspace/apps/backend/app/ingest/rows_reader.py))    | write                 | yes — `_page_order_sql` (R171 #8)  | no                                   |
| `query_aggregate_rows` ([`:670`](../../../workspace/apps/backend/app/ingest/rows_reader.py)) | **no** (whole result) | no                                 | n/a — no `LIMIT/OFFSET` to partition |

**Two paths are exposed, and both were measured clean** — which is the point: they are correct,
and the reason is a default rather than the SQL.

| Probe                                            | Scale                              | Result                                                           |
| ------------------------------------------------ | ---------------------------------- | ---------------------------------------------------------------- |
| Dataset paging (2026-08-15, R171's close)        | 200 000 rows, 20 threads, 60 pages | 0 duplicates · exact file order · stable on repeat + under `?q=` |
| **Joined-query paging** (2026-08-15, this round) | 120 000 × 500 inner join, 40 pages | 0 duplicates · stable on repeat                                  |

The join probe is new and it mattered: a hash join has no insertion order of its own, so the
expectation was that this path _would_ reshuffle. It does not — DuckDB carries probe-side order
through the join while the setting is on. **The exposure is one setting, not one function.**

**Why W-7 was different, stated once so it is not re-derived**: `build_steps_relation` carries hash
aggregates and window functions, where there is no insertion order to preserve. That path needed a
real `ORDER BY` and got one. A scan and a probe-side join are simply not that shape.

**`preserve_insertion_order` appears nowhere in the codebase** except the docstring R171 added.
There are **11 `duckdb.connect(":memory:")` sites** across `rows_reader` · `merge` · `csv_parser` ·
`parquet_writer` · `main`, with no shared constructor.

### D — the design gate

- [ ] **Declare vs assert.** The connections are ephemeral `:memory:` ones this code creates and
      owns — there is no user configuration to respect — so **set it explicitly** rather than
      asserting a global. An assert would fail a running server over a setting we are entitled to
      control. _Ruling drafted; confirm at the gate._
- [ ] **Where.** A single connection helper the paged reads share, rather than 11 edited call
      sites. Decide whether the helper covers **all 11** (uniform, but touches ingest/merge/write
      paths that have no ordering stake) or **only the reads that depend on it** (narrow, but
      leaves two constructors in the file looking arbitrarily different).
- [ ] **Confirm the falsification cheaply** — measure the paged reads before/after the explicit
      set. If the setting is already the default, this must be a no-op; a measurable difference
      means the premise is wrong.
- [ ] **Decide the guard tests' shape**: assert paging **partitions** (every row once, paged ==
      unpaged) for the dataset + joined paths, at a scale that would actually reshuffle if the
      setting were off. A guard that passes on 20 rows guards nothing.
- [ ] **Run [`flow-selector`](../../skills/flow-selector/SKILL.md)** — no new UI surface, so the
      no-UI branch applies and this lands **DCFBI** by construction. Record the run anyway.

### Explicitly NOT in this round

- **Giving `query_dataset_rows` a real `ORDER BY`.** For a **dataset**, file order _is_ the
  product — it is the row order of the spreadsheet the user uploaded, and the detail page is
  explicitly the "view-table Excel model". Imposing every-column-ascending would reorder their
  data. The dependency is the right behaviour; only its silence is the problem.
- **`query_aggregate_rows`' group order.** Unpaged, so no partitioning bug exists. Whether a
  chart's category order should be stable run-to-run is a **presentation** question for the
  dashboard domain.
- **The other 9 connection sites' settings** beyond the ordering one (memory limits, threads,
  extensions). A connection-helper round is not a connection-tuning round.

## Risks / unknowns

| Risk                                                                                               | Why it matters                                                                     | Handling                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A guard test that cannot fail.** At small scale DuckDB is single-threaded and stable regardless. | The whole round is the guard; a guard that passes with the setting off is theatre. | **Verify each guard fails with `preserve_insertion_order=false`** — the same negative control R171 used on item 8, which is what caught a test that proved nothing. |
| **Explicitly setting a default is a no-op that reads as work.**                                    | The round could ship a comment pretending to be a change.                          | The value is the **guard tests + the corpus line**, not the `SET`. If the falsification fires, say so.                                                              |
| **Scope drift into a connection-factory refactor.**                                                | 11 call sites is exactly the shape that invites "while we're here".                | The helper carries **one** setting. Anything else is recorded, not absorbed ([[batch-ui-bugs-into-one-round]]).                                                     |

## Do

### The `Falsified if` fired — and it found a shipping data-correctness bug

The round was written to declare a benign dependency. Building the guard tests **refuted its own
premise**: `preserve_insertion_order` protects a **scan**, and does **not** survive a **hash join**
once DuckDB parallelises it past a row group.

**`query_joined_rows` pages a join with `LIMIT/OFFSET` and no `ORDER BY`, and above ~120k rows it
returns some rows twice and never returns others.**

| Rows    | Scan path (`query_dataset_rows`) | Join path (`query_joined_rows`) |
| ------- | -------------------------------- | ------------------------------- |
| 60 000  | OK                               | OK                              |
| 120 000 | OK                               | OK                              |
| 200 000 | OK                               | **21 344 rows lost**            |
| 300 000 | OK                               | **44 224 rows lost**            |
| 400 000 | OK                               | **95 936 rows lost**            |

**User-visible through the API**, not just at the function level: on a 200k-row joined query,
`GET /queries/{id}/rows?page=500&page_size=100` requested three times returned three different
first rows — `D0150271`, `D0015103`, `D0154367`.

**This is R165 W-7's class, on the joined path** — the exact thing this round's Plan asserted the
join was safe from, on the strength of a 120k probe that sat just under the threshold. Twice now a
claim about this subject has been wrong in the same way: R171 said the scan path was W-7's class (it
is not), and R172's Plan said the join path was safe (it is not). **Both were reasoned from a
mechanism instead of measured at scale.**

**Why nobody has hit it**: joins have shipped since R71, and the human's real call-log data is ~90k
rows — under the threshold. It is monthly-growing data, so this is a bug with a date on it.

**Recorded as a strict `xfail`** in `tests/test_paging_partitions.py`, carrying the numbers and the
reason: the suite stays green and honest, and the test flips to a failure the moment the bug is
fixed, rather than the bug living only in prose.

### Built so far (valid regardless of the fork)

- **`app/duck.py`** — the one place a DuckDB connection is made, setting `preserve_insertion_order`
  explicitly. All **11** `duckdb.connect(":memory:")` sites now route through it
  (`rows_reader` ×5 · `merge` ×3 · `csv_parser` · `parquet_writer` · `main`). Behaviour-neutral (it
  was already the default); the value is that the dependency is now declared where a reader meets
  it. `ruff check` clean, 443 passed + 1 xfailed.
- **`tests/test_paging_partitions.py`** — guards for the scan path (partitions, file order, repeat
  stability) at 400k rows, driven at the reader functions because the API caps `page_size` at 100
  and a small fixture would pass with the setting off. Plus a negative control.

### The fork — the human's call, and why it is not mine

The fix is a deterministic total order on the paged join. **Which order is a product decision**, not
a mechanical one, because a joined query today comes back in **driving-dataset file order** — "my
deals, with account columns attached" — and that is what users see below the threshold.

| Option                                              | Correct? | What the user sees                                                                                                                                    | Cost                                                                                 |
| --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **(a)** `ORDER BY` every effective column ascending | yes      | **Re-sorted.** Rows re-present alphabetically by the first column — the same thing this round refused for datasets, where file order _is_ the product | cheapest                                                                             |
| **(b)** Number the driving relation, order by that  | yes      | **Unchanged** — exactly today's presentation, made deterministic                                                                                      | a `row_number()` over the driving side, carried through the join                     |
| **(c)** Order by the driving source's columns only  | **no**   | approximately unchanged                                                                                                                               | cheap — but only deterministic if those columns are unique, which nothing guarantees |

**Measured 2026-08-15 — the recommendation changed from (b) to (d).** Two questions the human asked
turned the fork, and both needed measurement rather than reasoning:

**1. "Which is cheapest with no end-user impact?"** All three correct options cost **the same**
(14.5–15.0 ms/page at 200k, median, warm) — because the cost is **the sort**, not how the sort key
is produced. That removes (a)'s only advantage: it was the cheap-but-visible option and it is not
cheaper. _(A first benchmark showed the broken version as the SLOWEST; it was measuring cold file
cache on the first variant run. Re-run with per-query warm-up and reversed ordering.)_

| Rows                       | today  | with (d) | correctness today |
| -------------------------- | ------ | -------- | ----------------- |
| 10 000                     | 1.3 ms | 2.9 ms   | correct           |
| **90 000** (real call log) | 2.4 ms | 13.5 ms  | correct           |
| 200 000                    | 2.7 ms | 30.0 ms  | **loses rows**    |
| 500 000                    | 3.2 ms | 65.0 ms  | **loses rows**    |

**2. "Is the order retained whenever I visit the pages?"** — the deciding question, and a different
property from "pages partition within one walk". Every page walked twice in **fresh connections**
(the app opens one per request, so each page load is already a separate execution):

|         | pages whose content changed between visit 1 and 2 | duplicated / never shown |
| ------- | ------------------------------------------------- | ------------------------ |
| today   | **21 of 100**                                     | 19 984 / 19 984          |
| **(d)** | **0 of 100**                                      | 0 / 0                    |

_(A first, SAMPLED version of this check reported "SAME" for the broken build — it happened to pick
stable pages. The instability is not uniform. Third time in two rounds that a sample or a mechanism
argument gave the wrong answer and exhaustive measurement corrected it.)_

_Recommendation: **(d)**, `file_row_number` on the driving source._ Tied for cheapest, invisible to
the user (it **is** driving-dataset file order), and — the deciding property — its sort key is a
**property of the stored parquet, not of the execution**, so the order is identical across
connections, processes and restarts by construction. **(b) would inherit the very fragility this
round exists to remove**: `row_number() OVER ()` is file-order only because the scan happens to emit
file order.

**Unverified before building** (2 items): that every join source is a parquet leaf — `query_engine`
builds `("read_parquet(?)", …)` at both sites and R167 removed query-as-source, but `file_row_number`
exists only on a parquet scan, so a sub-SELECT relation would need a fallback; and that a dataset is
always ONE parquet file, since `file_row_number` is per-file and a multi-file dataset would make it
non-total.

## Check

_(filled at the gate)_

## Act

_(filled at close)_

## Feeds into

**The human's declared sequence, 2026-08-15**: this round → **the Track-2 walk-artifact
graduation** (pre-approved in [Round_171 § Feeds into](Round_171.md); rule → `PDCA.md`, why +
dogfood ledger → repo `.agents/memory/`, `promotions.md` for sign-off — now carrying R171's two
extra findings: the count anchor, and that a walk verdict can arrive globally) → **a workflow
deep-dive**.

Carried forward from R171 and **not** taken here: the catalog row-actions convention, R167 W-1
(canvas layout persistence, needs a storage decision), and the two `onError`-less sibling mutations
(query delete, Duplicate's create) — all UI, all queued for the human's planned UI round.
