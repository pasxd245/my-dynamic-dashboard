# Round 154: Full profiling + deeper metadata — the compute-backed Properties sections

**Status**: In Progress — D signed off (Q1–Q4 2026-07-07); C+B done, F next
**Date started**: 2026-07-07
**Flow**: **DCFBI** — set at the D-gate via flow-selector (0/5 conditions fired); recorded in the Do log.

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

- [x] **D-gate pre-flight** — `design-sync --check` the **dataset-detail** design corpus (R153 just
      touched it; re-verify) before designing the profiling section on it. **Done 2026-07-07** →
      report `.agents/tmp/design-sync/data-management-datasets.md`.
- [x] **D**: design-corpus draft resolving Q1–Q4 (written into `dataset-detail.md`); flow-selector
      at D exit → **DCFBI**. **Human D sign-off 2026-07-07** (Q1–Q4 via AskUserQuestion).
- [x] **C**: profile contract — `profile-get.contract.yaml` (+ rationale `.md`), `operationId:
      getDatasetProfile`, one-call-all-columns, predictable per-column shape (nullable-not-omitted),
      `approx`/`sampledRows` cost-guard flags, `format` folded in (Q3). FE `DatasetProfile`/
      `ColumnProfile` types + `datasetsApi.getProfile` + MSW handler (`profileColumnsMock` computes
      truthful stats from the fixture → contract-validated). tsc + vitest 309 green.
- [x] **B**: `profile_dataset_columns` in `rows_reader.py` — one materialized source (`_prof` temp
      table: full when `rowCount <= PROFILE_FULL_SCAN_MAX_ROWS`=200k, else `USING SAMPLE n ROWS`),
      one aggregate select (null/distinct/min-max per-dtype) + a top-k query per string column;
      `GET /datasets/{id}/profile` handler folds `format` from commitSettings; `DatasetProfile`/
      `ColumnProfile` response models. Tests: exact stats, per-dtype min-max/sample split, format
      fold-in, sampling guard (monkeypatched threshold), 404, parquet byte-identical. ruff + pytest
      369 green.
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

### D-gate pre-flight — `design-sync --check data-management/datasets` (2026-07-07)

Ran `--check` on `dataset-detail.md` (the R153 Properties-drawer surface R154 designs onto).
Code-truth read delegated to a subagent, scoped to the R154 build-on surface. Report:
`.agents/tmp/design-sync/data-management-datasets.md`.

**Verdict: OUT OF SYNC — 2 low-severity claims** (marker stamped on the doc):

1. Stale hook name — doc says `useSetColumnVisibility`; code exports `useSetColumnVisibilityMutation`.
2. Doc calls `SectionHeader` "shared"; it is a **file-private** helper inside `PropertiesDrawer.tsx`
   (not exported). R154's Profiling section reuses that in-file helper, not an importable primitive.

**Disposition:** both land inside the drawer section R154's D-phase rewrites → **fold into R154 D**,
no separate sync round (contrast R148's 14 load-bearing findings). Marker clears when D reconciles.

**Truths R154 must design against (from the code-truth map):**

- `format` (date/datetime) lives at `source.json → commitSettings.column_overrides[<name>].format`
  (field of `ColumnOverride`), NOT on the committed `Column` / `columns_json`. Date/datetime only.
- `datasetMetaItems()` currently surfaces 6 items (workspace·rows·cols·size·uploaded·format-label).
- No `GET /datasets/{id}/profile` or any stats route exists — R154 is net-new. `hidden` uses an
  omit-when-unset `@model_serializer` on the shared `Column`; the parquet is never touched by view-hints.

### D-gate decisions — human sign-off 2026-07-07 (AskUserQuestion)

Q1–Q4 answered by the human; design written into `dataset-detail.md` (§ Properties panel + § Data
contract + § Read/write boundary + acceptance criteria), which also **cleared the drift marker** by
folding the 2 pre-flight fixes.

- **Q1 stat set** → **the 4 named, per-dtype.** `null_count` + `null_pct` and `distinct_count` for
  every column; `min`/`max` for numeric+date; `top_k` sample values for strings. Histograms/quantiles
  are explicitly a later additive round (scope brake).
- **Q2 endpoint + cost guard** (headline risk) → **on-demand + guard, single call, no persistence.**
  `GET /datasets/{id}/profile` returns all columns in one response. Full scan when `rowCount <=
  PROFILE_FULL_SCAN_MAX`; **sample** (DuckDB `USING SAMPLE n ROWS`) above it, response carries
  `approx: true` + `sampledRows`. No sidecar/cache — cost is re-paid per open but **bounded**. (If a
  real perf complaint lands later, caching is an additive round — echoes [[query-is-a-connection-not-a-load]].)
- **Q3 `format`** → **surface it.** Read date/datetime `format` from
  `source.json → commitSettings.column_overrides[<name>].format` and show it in the Columns section.
  Completes metadata-half (b). No new persistence.
- **Q4 rendering** → **own 3rd "Profiling" section** in the drawer, lazy on open (own TanStack query
  key `['datasets',{id},'profile']`, `enabled` only while the drawer is open), with
  loading/empty/error states isolated from the two free sections.

**Threshold value** `PROFILE_FULL_SCAN_MAX` deferred to B (a config-value-home call — likely a
backend const per [[config-value-home-heuristic]], single consumer; start ~200k rows, tune on real FM data).

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | Profiling's loading/empty/error/populated are independent render-states, not interactive branches; the only interaction is open-drawer (fires the lazy fetch). |
| 2. New interaction pattern           | no     | Read-only lazy section inside the already-shipped R153 `Drawer` (AntD `Drawer` / `WidgetFilterDrawer` precedent); lazy TanStack-on-open is standard in-product. |
| 3. High user-error risk              | no     | Read-only; no destructive/irreversible action. The one hazard (reading sampled stats as exact) is handled by the `approx` note, a design decision not a flow risk. |
| 4. Contract depends on unresolved UI | no     | Profile response shape is fully fixed by Q1 (stat set) + Q2 (cost guard), both resolved at D; the YAML is already written. |
| 5. UX confidence below threshold     | no     | Reuses the R153 drawer + a standard pattern; Q1–Q4 all signed off, no open UX questions. |

Result: **Flow: DCFBI** (0 conditions fired — default).

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
