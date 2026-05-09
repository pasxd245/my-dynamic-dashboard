# Phase 0 Research: Relationship Rules

- Scope: Research decisions for FR-001..FR-016 and US1..US4 in `002-relationship-rules`.
- Constraint alignment: Preserve constitution Principle III (relationship rule before cross-table query) and Principle VI (traceability).

- Decision: Use two-step overlap evaluation with a profile fast path and a DuckDB exact path.
- Rationale: Fast path keeps UI responsive for review loops; exact path satisfies governance accuracy and SC-002.
- Alternatives considered: Polars-only set math (rejected for slower joins at higher cardinality and less SQL transparency).

- Overlap definition: `overlap_pct = distinct_intersection_count / distinct_source_count`.
- Comparable values: Normalize values according to `rel_type` before comparison.
- Null handling: Exclude null and empty canonical values from both numerator and denominator.
- Storage: Persist final `overlap_pct` on `relationship_rules` after create/edit recomputation.

- DuckDB SQL pattern (exact path):

```sql
WITH src AS (
  SELECT DISTINCT src_value AS v
  FROM source_frame
  WHERE src_value IS NOT NULL
),
tgt AS (
  SELECT DISTINCT tgt_value AS v
  FROM target_frame
  WHERE tgt_value IS NOT NULL
),
src_count AS (
  SELECT COUNT(*) AS c FROM src
),
intersect_count AS (
  SELECT COUNT(*) AS c
  FROM src
  INNER JOIN tgt USING (v)
)
SELECT
  CASE WHEN src_count.c = 0 THEN 0.0
       ELSE CAST(intersect_count.c AS DOUBLE) / CAST(src_count.c AS DOUBLE)
  END AS overlap_pct
FROM src_count, intersect_count;
```

- Execution note: Register temporary relation inputs in DuckDB from parquet-backed workspace slices, then execute one SQL statement.
- Performance note: Distinct + join path scales well to 100k rows under SC-002 on local DuckDB in-process mode.

- Decision: Derive cardinality from existing `column_profiles.uniqueness_ratio` values.
- Rule mapping:
- If source `>= 0.99` and target `>= 0.99` then `1:1`.
- If source `>= 0.99` and target `< 0.99` then `1:N`.
- If source `< 0.99` and target `>= 0.99` then `N:1`.
- If source `< 0.99` and target `< 0.99` then `N:N`.
- Rationale: Reuses already-governed profile metrics and avoids unnecessary table scans.
- Alternatives considered: Direct duplicate scans per review action (rejected due to avoidable latency).

- Decision: Detect broken rules through metadata consistency checks plus existence checks.
- Broken check 1: Referenced `from_column_id` and `to_column_id` must exist.
- Broken check 2: Stored type baseline must remain compatible with current `columns.effective_type`.
- Broken check 3: Mark broken on incompatible type drift even if ids still exist.
- Rationale: Covers schema deletion and type changes required by FR-013 and SC-003.
- Alternatives considered: Broken detection only on missing IDs (rejected because type drift can silently invalidate joins).

- Decision: Profile-vs-scan strategy is adaptive and explicit.
- Fast path: Estimate overlap from `column_profiles.top_k_values_json` when both sides are fresh and contain enough support.
- Freshness heuristic: Latest profile timestamp newer than last schema-affecting update for both columns.
- Accuracy threshold: If estimate is near policy boundaries (5% or 80%), run exact DuckDB computation before persisting.
- Fallback conditions: Missing/empty top-k, stale profile, low support, or user-triggered revalidation.
- Rationale: Preserves fast UX while preventing governance decisions from using weak estimates.
- Alternatives considered: Always exact scan (rejected due to unnecessary cost in frequent review operations).

- Governance impact:
- Enforce approval block at `< 0.05` overlap unless `override_reason` is present.
- Enforce warning/acknowledgement at `< 0.80` overlap before progressing in lifecycle.
- Write immutable audit rows for all lifecycle transitions and edit/delete operations.

- Operational notes:
- Recompute overlap/cardinality on create and edit.
- Reset status to `suggested` after edits.
- Re-run broken detection on schema refresh and before approval transitions.
- Keep audit actor and reason nullable only where action semantics allow.

- Final recommendation: Implement adaptive overlap (profile estimate + DuckDB exact), profile-based cardinality mapping, and deterministic broken checks as the baseline for spec 002.
