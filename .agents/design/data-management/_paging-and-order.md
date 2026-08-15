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

## The mechanism, concretely

Three layers, because the ordering key has to be produced _below_ the join, survive the projection,
and be usable _above_ it — while never reaching the caller.

**1. The driving relation gains an ordering column** — `_driving_relation_with_order`
([`rows_reader.py`](../../../workspace/apps/backend/app/ingest/rows_reader.py)). It branches on the
relation's SQL shape, because only one of them has a file to read positions from:

```sql
-- a parquet leaf (a Dataset, or a workflow's frozen output): ask the SCANNER
read_parquet(?, file_row_number=true)          -- order key: T0.file_row_number

-- anything else (a composed `qr_` sub-relation): number it as it emits
(SELECT *, row_number() OVER () AS _mdd_row_ord FROM <sub-relation>)
```

The branch is not defensive padding: `resolve_source` genuinely returns a sub-SELECT for the `qr_`
shape. A Query cannot reach it since R167 made every operand a `ds_` — but **nothing enforces that**,
and silently returning unordered pages for an unexpected shape is exactly how this bug shipped.

**2. The projection carries it through.** `build_joined_select` takes an optional `order_expr` and
appends it to the select list under a reserved alias. The filter wrapper above it is
`SELECT * FROM (…) AS _q WHERE …`, so the column survives that too:

```sql
SELECT <effective columns…>, T0.file_row_number AS _mdd_row_ord
FROM read_parquet(?, file_row_number=true) AS T0
INNER JOIN read_parquet(?) AS T1 ON T0."acct" = T1."acct"
```

**3. The paged read orders by it, and never returns it.** `query_joined_rows` casts only the
effective columns into the output, so the key is invisible on the wire:

```sql
WITH joined AS ( <the SELECT above> )
SELECT CAST("deal_id" AS VARCHAR), CAST("amount" AS VARCHAR), …
FROM joined
ORDER BY _mdd_row_ord          -- ← what makes LIMIT/OFFSET a partition
LIMIT ? OFFSET ?
```

The `COUNT(*)` companion query needs no order and does not get one.

### Why a key in the file beats a key computed at runtime

`file_row_number` and `row_number() OVER ()` produce the **same order** and cost the **same**
(14.5–15.0 ms/page at 200k — the cost is the sort, not the key). They differ in what they depend on:

|                        | where the key comes from                                    | stable across a restart?                       |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `file_row_number`      | the **stored parquet** — a row's byte position in the file  | **yes, by construction**                       |
| `row_number() OVER ()` | the order rows **reach the operator** during this execution | only while the scan happens to emit file order |

The second is file-order _because_ `preserve_insertion_order` holds — which is the exact assumption
this round exists to stop depending on silently. Same price, so there is no trade: **prefer the key
that lives in the data.**

### Measured, before and after

200k-row join, every page walked twice in **fresh connections** (one per request, as the app runs):

|                    | pages whose content changed between visits | rows duplicated / never shown |
| ------------------ | ------------------------------------------ | ----------------------------- |
| unordered (before) | **21 of 100**                              | 19 984 / 19 984               |
| ordered (now)      | **0 of 100**                               | 0 / 0                         |

**What it costs**: 2.4 → 13.5 ms per page at 90 000 rows, 2.7 → 30.0 at 200 000. Correctness is not
free on this path; it is bounded, it is well under a perceptible page load, and it grows with the
data. The alternative was a read that silently lied.

### What the user sees: nothing

The chosen key **is** the order a joined query already presented — driving-dataset file order, "my
deals, with account columns attached". That was the acceptance criterion for picking it over
`ORDER BY <every column>`, which is equally correct, equally priced, and would have silently
re-sorted every joined result alphabetically.

## The contract

**For a consumer of any paged endpoint**:

1. **Walking every page returns every row exactly once.** No duplicates, no omissions.
2. **The paged walk equals the unpaged read**, row for row.
3. **The same page returns the same rows on a later visit** — across connections, processes and
   restarts, not merely twice in a row. The app opens a **fresh DuckDB connection per request**, so
   every page load is already a separate execution; an order that is only stable within one
   execution would not satisfy this. _(This is the clause that separated the candidate fixes in
   R172: before it, 21 of 100 pages returned different content on a second visit.)_
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
