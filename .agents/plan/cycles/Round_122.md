# Round 122: workflows — a formula-free derived-column step

**Status**: Review
**Date started**: 2026-06-30
**Date completed**:
**Flow**: **DCFBI** — backend-only; extends the R121 typed step engine.

## Goal

**Inherits from ← [Round_121](Round_121.md)** — add a **`derive`** step: a new column from a
**structured binary op** over numeric operands (`name = left  op  right`, `op ∈ + − × ÷`, `right` a
column or a literal). The real Excel-escape lever ("profit = revenue − cost", "margin = profit ÷
revenue") — and the first step that **ADDS** a column (testing the engine's column-threading for a
non-aggregate reshape).

_Track: 1. Pulled by ← the workflow theme. **Formula-FREE by construction** — a structured
{left, op, right, name}, NOT a formula string (the [[2026-06-26-product-value-framing]] hard test:
no screen should make the user write/read a formula). Chaining builds compound expressions, each a
single structured op. Still **DuckDB** (arithmetic SQL) — no Polars; extend-query holds._

## Plan

- [ ] **C:** `DeriveStep` + a `right` operand (`{kind: col}` | `{kind: const}`) in `_shared/query.yaml`;
      add to `steps` `oneOf` + discriminator.
- [ ] **B:** models (`DeriveStep`, operand union) into the `Step` union; `run_steps` derive arm —
      `SELECT *, (CAST(left AS DOUBLE) op right) AS name`, with `÷` guarded by `NULLIF(right,0)` →
      NULL (no divide-by-zero crash). `_plan_one_step` validates: `left`/`right.col` exist **and are
      numeric**, `name` doesn't collide; output cols += `{name, float}`.
- [ ] pytest: derive col−col + col−const; chain (derive → aggregate the derived col; aggregate →
      derive over measures); divide-by-zero → NULL; 422 (non-numeric operand, name collision,
      unknown col); drift → 409.

## Risks / unknowns

- **Formula-free discipline** — keep it a structured binary op; resist a general expression tree.
  Compound needs chain multiple `derive` steps (each verifiable in isolation).
- **Divide-by-zero** — `÷` must not crash the query; `NULLIF` denominator → NULL cell.
- **Output dtype** — arithmetic → `float` (uniform; int÷int is real division). Reported so a chart
  treats it numeric.

## Do

**Built (backend-only):**

- **Contract** — `DeriveStep` (+ a `right` operand `oneOf` col/const); added to the `steps` union
  - discriminator.
- **Models** — `ColOperand`/`ConstOperand` (discriminated `right`) + `DeriveStep`, into the `Step` union.
- **Engine** — `run_steps` derive arm: `SELECT *, (CAST(left AS DOUBLE) <op> right) AS name FROM (…)`;
  the validated float constant is **inlined** (no `?` in the SELECT → param-order sanity); `÷` wraps
  the denominator in `NULLIF(…, 0)` → NULL, not a crash. Appends a `float` column.
- **Validation** — `_plan_derive` + `_require_numeric`: `left`/`right.col` exist **and numeric**,
  `name` no-collision; output columns gain the new `{name, float}`.

**Verification:** backend `pytest` **260 pass** (7 new: col−col, col×const, ÷0→NULL, derive→aggregate
chain, 3× bad-derive 422) · `ruff` clean · FE `tsc` clean · contract-validator green.

## Check

- [x] Backend pytest 260 (7 new) + no regression; ruff clean.
- [x] Derive adds a `float` column; `÷0` → NULL (no crash); chains both ways (derive→aggregate).
- [x] FE tsc + contract validator green; `Step` union + `DeriveStep` types added.

## Act

**Learnings:**

- **Formula-free held without losing power.** A structured `{left, op, right, name}` (+ chaining for
  compound expressions) delivers "profit = revenue − cost" / "margin = profit ÷ revenue" with **no
  formula bar** — the [[2026-06-26-product-value-framing]] hard test stays green.
- **Column-ADDING threaded cleanly.** `derive` is the first step that grows the column space mid-chain
  (vs aggregate reshape / top_n preserve); the fold in `_plan_one_step` + `run_steps` handled it with
  no engine restructuring — the typed seam generalizes.
- **Still DuckDB, still no wall.** Arithmetic is SQL; `NULLIF` is SQL. The "query can't adapt → a
  Workflow noun" trigger ([[query-is-virtual-dataset]]) has not fired across aggregate/top_n/derive.

**Promotions:** none — application of the workflow seam.

**Prune check:** nothing pruned.

## Feeds into → Round_123 (TBD)

The `derive` step + the column-ADDING thread. R123 adds a **filter-as-step** (a post-aggregate /
post-derive `WHERE`, HAVING-like — e.g. "regions with revenue > 100k", "rows where margin < 0").
