# Round 99: Seed a Sales scenario for a dashboard — orders at volume + a telesale dataset

**Status**: **Complete** — human-signed-off 2026-06-26 ("tested, pls flip to Complete"). Seeded a
Sales scenario for a planned dashboard: orders 2000 · telesale 2000 (new) · customers 50, via a
deterministic generator in `seed.py` (bulk uncommitted). **5 relationships** incl. the nullable
`orders→telesale` converted-link (`telesale.order_id` profiled integer). CLI split: `dev:seed` (light)
· `dev:seed:full` (volume). DCFBI (dev-data round); Integration verified live + human-tested.
**Date started**: 2026-06-26
**Date completed**: 2026-06-26
**Flow**: **DCFBI** (dev-data / tooling round — `seed.py` + CSV/generated data, **no product UI**;
`flow-selector` skipped per its no-feature branch). Verified by running the seed against the real local
backend (the seed's whole point — non-mock, real DuckDB/contract).

## Goal

Enrich the local **seed** (`scripts/dev/seed.py` + `seed-data/`) into a **Sales scenario** big enough
to build + demo a **simple dashboard**: the existing **orders** fact scaled to **~1k–5k rows**, plus a
new **telesale** (phone-sales activity) fact at similar volume, wired into the existing star with
governed relationships. **R99 seeds the data only — it does not build the dashboard** (that's a later
value-out round, [[post-mvp-roadmap-migration-first]]).

_Track: 1 (product — dev/demo data enabling the dashboard value-out path). Pulled by ← the human's
dashboard plan + the [[seed-data-vs-msw-complementary]] doctrine (seed verifies the REAL impl). Per the
[Evolution Rule](../../AGENTS.md)._

## Current seed (grounded)

A real sales star uploaded via the contract: **regions(5) → customers(11) → orders(32)**,
**products(7) → orders**, + governed rels + 2 base queries on `customers`. `orders` cols:
`order_id · customer_id · product_id · amount · quantity · status · is_priority · ordered_at`. Fixed
CSVs (hand-crafted edge cases: customer **"Lonely Co"** with no orders, product **"Legacy Tool"** never
ordered). 32 rows is far too small for a dashboard.

## Proposed requirements (per dataset — ratify at Design)

| Dataset | Role | Rows | Notes |
| --- | --- | --- | --- |
| `regions` | dimension | 5 (keep) | unchanged |
| `products` | dimension | 7 (keep) | unchanged (keep "Legacy Tool" edge case) |
| `customers` | dimension | **~50** (bump from 11) | richer for grouping; keep "Lonely Co" |
| `orders` | **fact** | **~2,000** (in the 1k–5k band) | same schema; scaled |
| **`telesale`** | **fact (NEW)** | **~2,000** | phone-sales activity |

**Proposed `telesale` schema** (confirm):
`call_id · customer_id · agent · called_at · duration_sec · outcome · order_id`

+ `outcome` ∈ {`connected`, `no_answer`, `callback`, `converted`, `declined`} (str).
+ `order_id` — **nullable** FK → `orders`, set only when `outcome = converted` (the call that produced
  a sale; the dashboard's telesale→revenue link).
+ `customer_id` — FK → `customers` (a customer receives many calls).

**Proposed relationships (governed):** `telesale.customer_id → customers.customer_id` (one_to_many);
`telesale.order_id → orders.order_id` (one_to_many, the converted-call link). Existing star rels stay.

## Open decisions for the Design gate

1. **Generated vs committed CSVs.** ~2k-row facts as **committed CSVs** (~150–300 KB each in git) vs a
   **deterministic generator in `seed.py`** (stdlib `random` + fixed seed — reproducible, no large git
   blobs, injects the named edge cases). _Lean: generator_ — keeps the repo light + reproducible;
   keep the small dimensions (regions/products/customers) as fixed CSVs.
2. **Exact volumes** — 2k each is a placeholder in the 1k–5k band; confirm orders/telesale/customers counts.
3. **Telesale schema + the two FKs** — confirm columns, `outcome` set, and the nullable `order_id`
   converted-link (vs telesale standing alone off `customers` only).
4. **MSW parity?** — the seed is the real backend; the dashboard's FE-on-MSW (later round) needs its own
   fixtures. R99 is seed-only; note the split ([[seed-data-vs-msw-complementary]]).

## Plan (by gate — DCFBI; dev-data round)

1. **Design gate** — ratify the per-dataset table + telesale schema + relationships + the
   generated-vs-CSV decision + volumes. **Human ratify.**
2. **Contract / Backend** — none (seed uses the existing contract; no new endpoints).
3. **Build gate** — add `telesale` (CSV or generator) + scale `orders`/`customers`; wire `seed.py`
   (`upsert_dataset` + `upsert_relationship` for the two telesale FKs); keep edge cases + UPSERT
   convergence.
4. **Integration gate** — run `pnpm dev:seed` against the real local backend: datasets + rows + the
   telesale relationships land; row counts in the 1k–5k band; existing star + queries still seed. Human
   confirm + Complete.

## Acceptance criteria (finalize at Design)

+ [ ] `telesale` dataset seeds with the ratified schema + ~1k–5k rows; `orders` scaled into the band.
+ [ ] Governed rels `telesale→customers` (+ `telesale→orders` for converted calls) seeded.
+ [ ] Edge cases preserved (Lonely Co, Legacy Tool); UPSERT re-run converges (no dup); `--reset` works.
+ [ ] Seed runs clean against the real backend (non-mock); the existing star + base queries still seed.
+ [ ] No product UI / contract change; the dashboard itself stays a later round.

## Risks / unknowns

+ **Referential integrity at volume** — generated FKs (`customer_id`, `product_id`, `order_id`) must
  reference real parent rows; the converted-call `order_id` must point at an actual order for that
  customer. A generator needs to honor the star.
+ **Git weight** — committed 2k-row CSVs add ~hundreds of KB; the generator avoids it (decision 1).
+ **Determinism** — a generator must use a fixed seed so re-runs + reviews are stable.

## Do

### Plan-gate draft — opened from the human's dashboard plan (2026-06-26)

After R98, the human pivoted to seeding a Sales dashboard's data: order (current) + telesale, ~1k–5k
rows. Opened here with a per-dataset requirements proposal (above).

### Design gate — RATIFIED (human, 2026-06-26)

All four decisions settled: **(1) generator, no committed bulk** — keep the "light" committed
edge-case CSVs as the base; **generate** the volume rows in-memory at seed-time and upload (nothing
bulk committed to git). **(2) parameterize volume** — `seed.py --orders N --telesale N --customers N`,
defaults **2000 / 2000 / 50** (tunable per run, in the 1k–5k band). **(3) telesale schema + the two
FKs** confirmed (`call_id · customer_id · agent · called_at · duration_sec · outcome · order_id`;
nullable converted-call `order_id`). **(4) seed-only** — no dashboard, no product UI/contract change.
Generator is **deterministic** (fixed `random` seed) + honors referential integrity (FKs reference
real parents; converted `order_id` is a real order for that customer) + preserves the edge cases. →
**Design gate closed; building.**

### Build + Integration — done & verified (2026-06-26)

Built the generator into `scripts/dev/seed.py` (FE-free, stdlib): `generate_data()` extends the
committed light base → target volume (deterministic `random.Random(1337)`); `validate_data()` checks
referential integrity + edge cases; in-memory upload path (`upload_bytes` / `upsert_dataset_bytes`);
`--orders/--telesale/--customers` params (default 2000/2000/50) + `--dry-run` (generate+validate, no
backend); `upsert_relationship(optional=True)` for the nullable converted-link. Regions/products stay
committed CSVs; **no bulk data committed** (generated at seed-time).

**CLI split (human's call — `dev:seed:full`?):** added a `--light` flag (small counts — 40/25/12 —
**same structure**: telesale + all 5 rels + edge cases) and two pnpm scripts: **`dev:seed`** →
`--light` (fast everyday dev), **`dev:seed:full`** → the volume Sales scenario (2000/2000/50). One code
path; only row counts differ. Explicit `--orders/...` override `--light`.

**Verified — offline (`--dry-run`):** integrity OK at full / 5000·3000·80 / 1000·1000 / **`--light`
(12·40·25)** / `--light --orders 100` (override holds); converted calls link a real order **of the same
customer**; edge cases hold (Africa no customers, Legacy Tool never ordered, Lonely Co 0 orders but
calls); `py_compile` clean. _(Light path not run live — it shares the full's code, which IS live-verified;
running `--light --reset` would wipe the live full data.)_

**Verified — live backend (`pnpm dev:seed --reset`, the real Integration):** committed
regions(5)·products(7)·customers(50)·orders(2000)·telesale(2000); **5 governed relationships**
declared (3 star + customers→telesale + orders→telesale); `telesale.order_id` profiled **integer**
(nullable FK declared cleanly — `optional` flag unused but kept as insurance); all 6 base queries seed;
UPSERT/`--reset` converge.

## Check

+ [x] **Design gate** — **RATIFIED** (human, 2026-06-26): per-dataset table + telesale schema + rels +
      generator(no-commit) + params (2000/2000/50).
+ [x] **Contract / Backend** — **no change** (existing contract; no new endpoints).
+ [x] **Build gate** — **done**: generator + telesale + params + dry-run + optional rel in `seed.py`.
+ [x] **Integration gate** — **closed; human-signed-off Complete 2026-06-26** ("tested, pls flip to
      Complete"). Verified live (real backend: datasets + 5 rels + row counts + integer FK dtype) +
      the human ran/tested the seed.

## Act

R99 turned the "light" 32-row star into a **Sales scenario at dashboard volume** — orders scaled to
2000, a new **telesale** fact (2000 calls) with the converted-call→order link, customers to 50 —
without committing a single bulk row (a deterministic generator extends the committed edge-case base
in-memory at seed-time). Carried lessons:

+ **Requirements-table-first paid off again** ([[requirements-table-before-building-ui]]) — the
  per-dataset spec (schema · volumes · relationships · generator-vs-CSV) was ratified before code, so
  the build was one clean pass + a live verify, no rework. The human's "param not 2k?" sharpened it
  into `--orders/--telesale/--customers`.
+ **The nullable FK profiled cleanly** — `telesale.order_id` (blank on non-converted calls) inferred
  as `integer`, so the `orders→telesale` governed rel declared without the `optional` fallback — but
  the fallback stays as insurance (a future schema change could reintroduce the risk).
+ **Generator + `--dry-run` = backend-free verification** — referential integrity (incl.
  converted-call-owns-its-order) + edge cases checked offline; the live `--reset` seed was the real
  Integration. Seed verifies the REAL impl ([[seed-data-vs-msw-complementary]]); the dashboard's
  FE-on-MSW fixtures are a later round's job.

**Edge cases preserved** for join testing: Africa (no customers), Legacy Tool (never ordered), Lonely
Co (no orders — but now *receives* telesale calls, a "called, never converted" case).

## Feeds into → Round_100+

+ **The simple Sales dashboard** — the value-out surface this data enables (its own round; FE-on-MSW
  fixtures + the real seed) ([[post-mvp-roadmap-migration-first]]).
+ Consumer-save / Excel output — the other value-out path.
