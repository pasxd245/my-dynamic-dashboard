# Round 154: Full profiling + deeper metadata — the compute-backed Properties sections

**Status**: Planning — D-gate pending (design-sync pre-flight first)
**Date started**: 2026-07-07
**Flow**: TBD — set at the D-gate via flow-selector. A real C+B round (new compute endpoint), so
likely **DCFBI**; the selector decides at D exit.

## Goal

**Inherits from ← [Round_153](Round_153.md)** — the human's 2-round split: R153 shipped the
Properties UI + **simple (free) props** (a multi-section drawer: Dataset facts + Columns
schema/visibility, all already on `Dataset`/`Column`, zero backend). R154 is the **depth** half —
the sections that need **computation** and so couldn't ride the free path.

**The problem:** the Properties drawer's value stops at what's stored. The real "metadata" a user
wants when sizing up a dataset — *how many nulls? how many distinct values? what's the range?* — is
**not persisted**; it must be **computed from the parquet**. And a few metadata facts (the
date/datetime **`format`**) live off the `Column`, in `source.json` commitSettings.

**Two capabilities:**

- **(a) Profiling section** — per-column stats (null count/% · distinct · min–max · sample),
  computed on the parquet via **DuckDB**, exposed by a new endpoint and rendered as a third section
  in the Properties drawer.
- **(b) Deeper metadata** — surface the facts not on the committed `Column` (the `format` string;
  anything else the D-gate pulls), so the Dataset/Columns sections read fully.

## Open design questions (the D-gate — hard-stop for the human)

1. **Which stats** (scope the profile) — null count + % · distinct count · min–max (numeric/date) ·
   a few sample values? Per-dtype (min–max only for numeric/date; top-k for strings)? Keep the first
   cut small; more stats are additive later.
2. **Endpoint shape + cost guard** (load-bearing) — `GET /datasets/{id}/profile` returning all
   columns in one call, or per-column? **Computed on-demand vs cached** (a wide/deep parquet is
   expensive — a full scan per open would be a silent cost). Cap / sample / async? This is the real
   risk (echoes the [[query-is-a-connection-not-a-load]] "consumer pays" lesson — but here the
   Properties panel IS the consumer, so the cost lands on drawer-open).
3. **`format` source** — read the date/datetime `format` from `source.json` commitSettings for the
   Columns section, or leave it out? (Only date/datetime overrides have one.)
4. **Rendering** — profiling as expandable per-column rows in the Columns section, or its own
   Profiling section? Loading/empty/error states for the async compute.

## Plan (draft — the D step refines; do NOT build before D sign-off)

- [ ] **D-gate pre-flight** — `design-sync --check` the **dataset-detail** design corpus (R153 just
      touched it; re-verify) before designing the profiling section on it.
- [ ] **D**: design-corpus draft resolving Q1–Q4; flow-selector at D exit. **Human D sign-off.**
- [ ] **C**: the profile contract — `GET /datasets/{id}/profile` response shape (per-column stats),
      error/empty semantics; the `format` exposure if Q3 pulls it.
- [ ] **B**: DuckDB profiling over the parquet (the cost guard from Q2); the handler; tests
      (stats correctness, the cap/sample behaviour, empty/edge columns).
- [ ] **F**: the Profiling section in the Properties drawer (loading/error states), + the `format`
      display; TanStack query for the profile (its own cache key, lazy on drawer-open).
- [ ] **I**: i18n en+vi for the stat labels + states.
- [ ] Tests: profile stats correct; cost guard holds; drawer renders the section + states; per D.

## Risks / unknowns

- **Compute cost** — the headline risk. A profile is a full-scan aggregate; on a wide/deep parquet,
  computing it every drawer-open is a real latency/CPU cost. The D-gate must pick on-demand-vs-cached
  - a guard, or the "nice metadata panel" becomes a performance footgun.
- **Scope creep in stats** — "profiling" can balloon (histograms, quantiles, correlations). Keep the
  first cut to the four the human named (null/distinct/min–max/sample); more are additive rounds.
- **dtype-specific stats** — min–max is meaningless for strings; distinct/top-k is the string
  analogue. The stat set is per-dtype, not uniform — a modest branching the contract must carry.
- **Still presentation-adjacent** — profiling READS the parquet (compute), never writes it; it does
  not touch `columns_json` or the stored data. Keep that boundary (the R152/R153 doctrine).

## Do

_(D-gate pre-flight + D log land here.)_

## Check

- [ ] D signed off before C/B/F (stat set · endpoint/cost · format source · rendering).
- [ ] Profile stats are correct; the cost guard holds; the drawer renders the Profiling section with
      loading/empty/error states; `format` shows where present.
- [ ] Backend pytest + ruff green; FE tsc + vitest green; contract valid; design/plan/md lints clean;
      i18n parity.
- [ ] Human review of the profiling section (feel + real-data walk).

## Act

_(Learnings / promotions / prune check at close.)_

## Feeds into → Round_155 (TBD)

Re-rank at open. **Carried**: Export ④ (unpark — loop is bright), AI-propose-key (#2 additive),
R145 slice 1b. **Consider**: a 2nd dogfood probe now that the R142 backlog is exhausted.
