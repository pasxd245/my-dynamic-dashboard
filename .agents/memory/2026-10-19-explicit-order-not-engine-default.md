# A paged or listed read needs an explicit ORDER BY — an order the engine happens to keep is not a guarantee

**Date**: 2026-10-19
**Agent**: Claude Code (coder of the four-role loop, Round_199)
**Confidence**: High — three incidents on three read paths, each measured; the fourth path's
reliance was named as a risk (R171) and then failed (R199)
**Status**: Promoted (item 13 of [`skills/review-cr`](../skills/review-cr/SKILL.md); item 11 of
[`skills/review-qa`](../skills/review-qa/SKILL.md), R201)

## Problem

`LIMIT/OFFSET` partitions a relation only if the relation has a total order. Without an
`ORDER BY`, each page is an independent execution free to emit rows in another order: rows come
back twice, others never, while `total` and every page size still look right. A one-shot listing
(an export, an unpaged widget read) is merely out of the user's order — the same defect, harder
to see. DuckDB keeps a parquet scan in file order under `preserve_insertion_order`, which made
"no ORDER BY" pass every small test.

## Finding

| Round                               | Read path                               | What broke the engine's order                                   | Fix                                      |
| ----------------------------------- | --------------------------------------- | --------------------------------------------------------------- | ---------------------------------------- |
| [R165](../plan/cycles/Round_165.md) | stepped query, paged (walk W-7)         | a hash aggregate / window — 96 rows paged, 63 distinct          | `_page_order_sql` (a total order)        |
| [R172](../plan/cycles/Round_172.md) | joined query, paged                     | a hash join past one row group — 200k rows, 21 344 twice        | `ORDER BY` the driving `file_row_number` |
| [R199](../plan/cycles/Round_199.md) | dataset / single-source query, filtered | an `IN (?, ?)` list or `OR col IS NULL` — 130k rows overlapping | `ORDER BY file_row_number` when filtered |
| [R201](../plan/cycles/Round_201.md) | grouped `/aggregate`, aggregate step    | a hash `GROUP BY` — one widget's groups in two orders, 40 reads | `ORDER BY` the group keys, nulls last    |

R171 had written the third one down in advance: "paging on the dataset path is correct because of
a DuckDB default, not because of our SQL … an aggregate entering that read path breaks paging
silently." It was not an aggregate; a two-value filter was enough (out of order from 50k rows).
The round's own first test sorted its rows to pass and the coder logged the symptom as an "order
quirk" — the code reviewer's 400k-row probe is what found it.

R201, the fourth, came after item 13 existed: the round's own parity test compared widget reads
byte for byte and passed in every gate run of the coder; QA's 40-read probe showed two orders,
and the parity test then failed about one run in five. Not a page and not a large file — a
few-row `GROUP BY` was enough. Repetition is what caught it, so QA now loops equality gates
(`review-qa` item 11).

## Evidence

- `tests/test_paging_partitions.py` (R172), `tests/test_shared_filter_paging.py` (R199) — both
  at a scale where DuckDB parallelises (≥ ~130k rows); below it every read is stable regardless.
- `app/ingest/rows_reader.py` `query_dataset_rows` (R199 CR-1), `_page_order_sql` (R165),
  `_driving_relation_with_order` (R172).

## Recommendation

**Do**:

- Give every paged read and every row listing an explicit `ORDER BY` on a stable key (a
  `file_row_number`, a total column order) — or write down, next to the read, why it may omit one
  and which test guards it.
- Guard ordering with a test at a scale the engine parallelises at, and check it fails without
  the fix.
- Treat "my test needed `sorted()` to pass" as a finding, not a test detail.

**Don't**:

- Rely on `preserve_insertion_order` (or any engine default) as the ordering contract.
- Prove ordering on a few-row fixture.

## Promotion Candidate?

- [ ] `context/` – Stable pattern, broadly applicable
- [x] `skills/` – Reusable procedure/checklist → `review-cr` item 13 (R199, the in-round rule:
      a lesson that recurs is promoted in that round); `review-qa` item 11 (R201 — loop an
      equality gate ≥ 5× before trusting its green)
- [ ] Not yet – Needs more validation
