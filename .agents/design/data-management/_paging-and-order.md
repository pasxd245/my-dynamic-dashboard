# Paging & row order — the engine contract

**Status**: Accepted (R172). Cross-domain engine contract, not a surface spec — hence the `_`
prefix (`design-doc-lint`'s five rules are for surface docs; this has no token map by nature, the
same reason [`_noun-model.md`](_noun-model.md) carries one).

**Why this exists**: two rounds in a row reasoned about row order from a mechanism instead of
measuring it, and were wrong both times — R171 claimed the dataset read was broken (it is not),
R172 claimed the joined read was safe (it is not, above ~120k rows). **A paged read that is
correct by accident looks exactly like one that is correct by design.** This doc states which is
which, so the next person does not have to re-derive it, and so a new read path has a rule to
follow instead of a precedent to copy.

**Sibling docs**: [queries.md](queries/queries.md) (the engine + `Step` union),
[workflows.md](workflows/workflows.md) (the materialized write),
[dataset-detail.md](datasets/dataset-detail.md) (the view-table "Excel" model this protects).

---

## The mechanism, in one paragraph

`LIMIT n OFFSET k` returns **a slice of an ordered relation**. If the relation has no order, there
is no defined slice — each page is an **independent execution**, free to emit rows in a different
sequence, so page 2 is a slice of a _differently-shuffled_ relation than page 1. The result is not
"pages in a funny order"; it is **rows returned twice and rows never returned at all**, with the
totals still adding up. That is why it is invisible: `total` is right, every page is full, and the
count of rows you received equals the count you asked for.

> **A total order is not a presentation choice. It is what makes `OFFSET` mean anything.**

## Worked example — what "no order" actually costs

A 200 000-row `deals` dataset joined many-to-one to `accounts`, walked in 10 pages of 20 000
(measured 2026-08-15, DuckDB 1.1.3, 20 threads):

```text
asked for 200000 rows across 10 pages; received 200000, distinct 187488
rows delivered MORE THAN ONCE: 12512
rows NEVER delivered:          12512

  row_id "2048"   was returned on pages [1, 2]
  row_id "38560"  was on NO page at all (nor "38561", "38562")
```

Every page was full. The row count matched exactly. **12 512 rows silently became duplicates of
other rows.** Through the API the same defect reads as instability: on that query,
`GET /queries/{id}/rows?page=500&page_size=100` requested three times returned three different
first rows — `D0150271`, `D0015103`, `D0154367`.

## What guarantees order, per read path

| Read path              | Plan shape             | Order guaranteed by                                   | Safe at scale?                   |
| ---------------------- | ---------------------- | ----------------------------------------------------- | -------------------------------- |
| `query_dataset_rows`   | parquet **scan**       | `preserve_insertion_order` → file order               | **yes** — measured clean to 400k |
| `query_joined_rows`    | **hash join**          | explicit `ORDER BY` driving `file_row_number` (R172)  | **yes** — measured clean to 400k |
| `run_steps`            | steps relation         | explicit `ORDER BY _page_order_sql` (R165 W-7)        | yes                              |
| `materialize_steps`    | steps relation → write | explicit `ORDER BY _page_order_sql` (R171 item 8)     | yes                              |
| `query_aggregate_rows` | GROUP BY, **unpaged**  | n/a — no `LIMIT/OFFSET`, the whole result is returned | n/a                              |

**`preserve_insertion_order` is DuckDB's default and is now set explicitly** in
[`app/duck.py`](../../../workspace/apps/backend/app/duck.py), the one place a connection is made.
It makes a **scan** emit file order even under a parallel scan. **It does not survive a hash
join** once DuckDB parallelises past a row group (~122 880 rows) — which is the whole finding:

| Rows    | scan | join                 |
| ------- | ---- | -------------------- |
| 120 000 | OK   | OK                   |
| 200 000 | OK   | **21 344 rows lost** |
| 400 000 | OK   | **95 936 rows lost** |

## The contract

**For a consumer of any paged endpoint**:

1. **Walking every page returns every row exactly once.** No duplicates, no omissions.
2. **The paged walk equals the unpaged read**, row for row.
3. **The same page requested twice returns the same rows.**
4. **`total` is the count of the full matched relation**, so `total > len(rows)` is the only
   correct test for "there is more".

**Where the order comes from**, and this is a product rule, not an implementation detail:

- A **Dataset** reads in **file order** — the row order of the sheet the user uploaded. This is the
  view-table "Excel" model and it is the _feature_; imposing a sort would re-present their data.
- A **Query with an ordering step** (`sort` / `top_n`) reads in **the order the user asked for**,
  with every remaining column appended as a tiebreak so the order is total.
- A **Query with no ordering step** reads in a **reproducible** order. Arbitrary as a presentation,
  identical across executions — which is the only property paging needs.
- A **joined** Query reads in **driving-dataset order** — "my deals, with account columns attached".

**For anyone adding a read path**, the rule is one line:

> **If it pages, it needs a total order in the SQL — unless it is a bare scan, and then say so in
> a comment naming `preserve_insertion_order`.**

Do not infer safety from an existing path. `query_joined_rows` looked exactly like
`query_dataset_rows` and was broken; the difference is in the query plan, not the code.

## What enforces it

- [`test_paging_partitions.py`](../../../workspace/apps/backend/tests/test_paging_partitions.py) —
  guards clauses 1–3 above at **400k rows**, driven at the reader functions because the API caps
  `page_size` at 100 and a small fixture would pass with the guarantee removed. Includes a
  **negative control**: the same shape without the setting, proving the guard can fail.
- [`test_paging_total_order.py`](../../../workspace/apps/backend/tests/test_paging_total_order.py) —
  R165 W-7's guard on the stepped path, plus the `_page_order_sql` shape itself.
- [`test_workflow_row_order.py`](../../../workspace/apps/backend/tests/test_workflow_row_order.py) —
  R171 item 8: a workflow's materialized rows match its source query's order.

**Scale is load-bearing in all three.** DuckDB is single-threaded and order-stable on small inputs,
so a guard written against a 20-row fixture passes whether or not the guarantee holds. A paging
test that has never seen a parallel plan has not tested paging.

## How the joined path was fixed (R172)

A hash join has no insertion order of its own, so `preserve_insertion_order` does not reach it. The
paged join now orders on the **driving source's position in its parquet** —
`read_parquet(?, file_row_number=true)` on `T0`, carried through the projection and used as the
paged `ORDER BY`.

**Why that key and not another**: it is the order a joined query already presented, so nothing a
user sees moved; it costs the same as any other correct choice (the cost is the sort, not the key —
14.5–15.0 ms/page at 200k for all three candidates); and it is **a property of the stored file
rather than of the execution**, so a page is identical across connections, processes and restarts.
Numbering rows as they emit (`row_number() OVER ()`) would have been right today for the wrong
reason — file-order only because the scan happens to emit file order, which is the fragility this
round exists to remove. A driving relation that is _not_ a parquet leaf (the `qr_` sub-relation
shape — unreachable for a query since R167, but permitted by the type) falls back to that weaker
numbering rather than silently returning unordered pages.

**Measured before → after**, 200k-row join, every page walked twice in fresh connections:
21 of 100 pages changed content between visits and 19 984 rows were duplicated → **0 and 0**.

**What it costs**: 2.4 ms → 13.5 ms per page at 90k rows, 2.7 → 30.0 at 200k. Correctness is not
free here; it is bounded, and it buys a page that is the same page tomorrow.
