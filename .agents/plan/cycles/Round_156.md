# Round 156: Append provenance column — which source file did this row come from?

**Status**: **COMPLETE** (2026-07-09) — provenance column shipped; Integration walk signed off
(human). Next → [Round_157](Round_157.md) (FM1–12 append dogfood).
**Date started**: 2026-07-08
**Date completed**: 2026-07-09
**Flow**: **DCFBI** (0/5 — no-UI / backend-internal round) — set at the D gate via flow-selector.
**Design source**: [`.agents/design/data-management/datasets/upload.md`](../../design/data-management/datasets/upload.md)
§ Refresh append mode (provenance is append-created; likely also touches § initial commit).

## Goal

**Inherits from ← [Round_155](Round_155.md)** (keyless Append shipped). R155's append unions
periodic exports keep-all — but the unioned rows lose their origin: after appending
FM1…FM12 you **cannot tell which month a row came from**, so per-month aggregation/filtering in a
widget is impossible. This is a gap **append itself created**.

**Sequencing (human, 2026-07-08):** provenance **first** (R156), FM1–12 dogfood **next** (R157) —
so the dogfood exercises append *with* provenance in one real walk (each row self-labels its month),
rather than walking 12 months twice.

**The capability:** an opt-in **provenance column** materialized into the parquet, carrying each
row's source file (Power Query's `Source.Name` convention). Because it is a real column (not a
view-hint) it is queryable / groupable / filterable like any other — the point is `GROUP BY` the
source in a widget.

## Pinned D-gate design (human-confirmed 2026-07-08)

- **Materialized, not a view-hint.** A view-hint can't aggregate; provenance must be a real parquet
  column so widgets can group/filter by it. (Presentation-vs-compute doctrine: this is a COMPUTE add.)
- **Value = the source filename** (Q1 ✓) — `meta.originalName`, already captured + persisted in
  `source.json` ([datasets.py:339](../../../workspace/apps/backend/app/routers/datasets.py#L339)),
  available at initial commit and every refresh. FM filenames encode the month, so this is directly
  useful for the flagship dataset.
- **Automatic, always — hidden by default** (Q2 ✓, human's composition). Every dataset gets the
  column at commit; it is added to `columns_json.hidden` (R152 view-hint) so it stays out of the
  row-preview clutter. Per **R152 Q1** the `hidden` flag is a **preview default only** — every
  picker/widget/query IGNORES it — so provenance is fully available to `GROUP BY`/filter while
  invisible in the dataset-detail preview. R152's `_carry_forward_hidden` re-applies `hidden` by
  name across refresh (stays hidden for free); the user can persistently unhide via the Columns
  manager. This eliminates both the opt-in decision AND the first-append null-provenance trap.
- **Injected by us at commit** on both initial upload and every refresh mode (replace / append /
  merge), reusing the `incoming_cols` schema-reconciliation seam in
  [merge.py](../../../workspace/apps/backend/app/ingest/merge.py) — the committed side keeps its own
  stored provenance, the incoming side gets the new filename. No row is ever null-provenance.
- **Q3 — pre-existing datasets** (proposed, pending veto): datasets committed before R156 gain the
  column on their next refresh; **backfill their old rows from `source.json` `originalName`** at the
  reconciliation seam so there are no null-provenance rows.
- **Collision** with an existing source column named the same → guarded at the seam (build detail).

_Track: 1 (product — a COMPUTE add to the data-management datasets domain). Pulled by: gap append
itself created — unioned rows lose their origin month (R155)._

## Plan

- [x] D — author the provenance §-artifact in the design corpus; resolve the 3 open questions
      (value / scope / pre-existing datasets); run flow-selector.
- [x] C — confirm the shared `Column` schema already admits the hidden provenance column (no edit).
- [x] B — inject provenance into the single parquet write; backfill pre-R156 rows; collision-skip;
      update downstream test expectations for the extra column; add R156 provenance tests.
- [x] F — none (FE `Column` type already carries `hidden`; renders in R153 Properties → Columns).
- [x] I — human Integration walk (upload → hidden → unhide → append → per-row source → GROUP BY).

## Risks / unknowns

- Provenance flows through the compute layer (query/join/workflow) because `hidden` is preview-only —
  resolved at B (human: accept, flows everywhere).
- A post-write parquet rewrite is not dtype-transparent — caught + fixed mid-B (inject into the
  single write instead).

## Do

### D-gate pre-flight — `design-sync --check data-management/datasets` (2026-07-08) — CLEAN

No drift; no marker stamped. HEAD is R155 (`f195b5a`) and the domain docs were reconciled in that
same commit, so no code has changed since the last sync. Spot-checked the two areas provenance
builds on: **upload.md** § Refresh append mode + `refresh_mode` discriminator (line 1456, the commit
seam provenance injects into) and **dataset-detail.md** the R152 `hidden` view-hint + `PATCH
/datasets/{id}/columns` + Columns manager (line 523+, the hidden-by-default mechanism). Both match
code. (Note: for an in-scope build round the D-phase syncs its own doc by construction; this
pre-flight only confirms the starting state is trustworthy.)

### D-phase — provenance design authored (2026-07-08)

Wrote the D-artifact into the design corpus (per *design-docs-are-source-code*): a new
**§ Provenance column (R156)** in
[upload.md](../../design/data-management/datasets/upload.md#provenance-column-which-source-file-did-each-row-come-from-r156)
(concept · build home · injection seam · backfill · collision · boundaries · 7 acceptance criteria).
Also flipped the R155 append boundary bullet "No provenance column" → a pointer to the new section,
and compacted a stale R155 section status stamp ("D-gate F1 pending" → "shipped R155"). Q3 = backfill
(human-confirmed). The `hidden` mechanism the section rides on is documented in
[dataset-detail.md](../../design/data-management/datasets/dataset-detail.md) (R152) — no edit needed
there; provenance is just another hidden-by-default column.

### D-gate open questions — RESOLVED

1. Value → **source filename** (`meta.originalName`). 2. Scope → **automatic + hidden-by-default**
   (R152 view-hint). 3. Pre-existing datasets → **backfill** old rows from `source.json` originalName.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | No UI state model; the branches (initial/replace/append/merge/backfill/collision) are backend reconciliation, not interactive states. |
| 2. New interaction pattern           | no     | Reuses the R152 `hidden` view-hint + Columns manager; introduces no new UI surface. |
| 3. High user-error risk              | no     | Automatic + hidden + additive — no user step to misstep; append's double-count risk is R155's, already mitigated. |
| 4. Contract depends on unresolved UI | no     | No new request field; response uses the existing `Column {name,dtype,hidden?}` shape — contract determined without any UI decision. |
| 5. UX confidence below threshold     | no     | No new UX; the shape was human-confirmed at D. |

Result: **Flow: DCFBI** (0/5 — no-UI / backend-internal round → DCFBI by construction).

**D gate — SIGNED OFF (human, 2026-07-08).** Proceed C → B → F+I (DCFBI).

### C-phase — contract (2026-07-08) — EMPTY (verify-only)

No contract change. The shared `Column` schema
([column.yaml](../../../workspace/packages/contracts/_shared/column.yaml)) already admits
`{name:"Source.Name", dtype:"string", hidden:true}` — `dtype` enum has `string`, `hidden` is an
optional boolean, and the only three properties allowed under `additionalProperties:false` are
`name`/`dtype`/`hidden`. Provenance is automatic ⇒ no new request field on batch-post. `GET
/datasets/{id}` returns provenance as an ordinary `Column` entry. Contract-validity test stays green
by construction (no edit). No FE-type / MSW change (mocks are hand-authored fixtures; a hidden column
already exists in R152 fixtures).

### B-phase — inject + backfill + collision (2026-07-08)

**Code (green, ruff clean):** `parquet_writer.PROVENANCE_COLUMN = "Source.Name"` + `_add_provenance_df`;
provenance injected into the **single** parquet write via `provenance_value` on `_write_parquet` →
`write_csv_to_parquet` / `write_excel_to_parquet` (see the mid-B correction below);
`merge._cur_select_sql` + `provenance_backfill` param on `append_parquets`/`merge_parquets` (backfill
absent-on-committed with a filename literal, not NULL); router `_inject_provenance_col` (collision-skip;
hidden-iff-new) wired into both create + refresh, refresh passing `prov_backfill` (committed
source.json originalName) to the reconcilers.

**Scope inflection surfaced + resolved (human, 2026-07-08): provenance flows through the compute
layer.** First pytest run: 31 failures, ALL "one more column: Source.Name" (no bugs) — spread across
ingest/joins/queries/workflows because `hidden` is preview-only (R152) so `Source.Name` is a real
column in query/join/workflow output. Human chose **accept — flows everywhere** (groupable in a
single-dataset query = the goal; join output carries `<src>.Source.Name` per source = accepted mild
noise). → update the ~31 test expectations to include `Source.Name` (last per source); do NOT weaken
assertions.

**Injection approach corrected mid-B (a real bug caught before it shipped).** First cut materialized
provenance via a POST-write DuckDB `COPY (SELECT *…)` rewrite — which re-encodes every column and
**strips pandas' `string` extension dtype**, so string columns read back as `object`, breaking the
R142-F2 invariant (stored physical dtype == columns_json dtype). The delegated test-update subagent
followed its rule "verify each diff is only a provenance addition; STOP on any other diff" and
surfaced the 2 failing dtype tests as a **real regression, not test churn** (did not mask them).
Fix: inject provenance into the **single** parquet write instead — `provenance_value` threaded through
`_write_parquet` → `write_csv_to_parquet` (pandas branch: `_add_provenance_df` string column; DuckDB
COPY branch: literal in the SELECT) / `write_excel_to_parquet`; the post-write rewrite helper deleted.
No existing column is ever re-encoded. Lesson: a post-write parquet rewrite is not dtype-transparent.

**R156 tests** (`tests/test_datasets_provenance.py`, 5): initial-upload tag + hidden default + string
dtype (crit 1); per-file append value (crit 2); backfill of a pre-R156 committed table
(crit 4, unit on `append_parquets`); collision = user's column wins (crit 6); unhide-survives-refresh
(crit 5). Crit 3 (groupable-while-hidden) covered by the existing resolved-column tests
(test_workflows_run passthrough, test_resolve_plan) now including `Source.Name`.

### C+B+F gates — GREEN (2026-07-08→09)

pytest **379** (374 pre-existing updated + 5 new) · vitest **314** · tsc clean · ruff clean ·
design:lint 0 · design:tokens 0 · markdownlint 0. **F empty** (no-UI round): the FE `Column` type
already carries `hidden`, so `Source.Name` renders as a hidden column in the existing R153
Properties → Columns section with no FE change.

**Next: Integration walk (human — DCFBI hard gate).** Green tests ≠ done (R153/R154 lesson). Suggested
walk: upload a file → open Properties, confirm `Source.Name` present + hidden → "show all"/unhide it →
append a 2nd file → confirm each row shows its own source filename → group a widget/query by
`Source.Name` → confirm per-file counts.

### Integration gate — SIGNED OFF (human, 2026-07-09)

The DCFBI human hard gate passed: the walk above confirmed `Source.Name` is present + hidden on
upload, unhides via the Columns manager, carries the correct per-file source filename after an
append, and groups per-file counts in a widget. Re-verified automated gates on the flip commit:
**pytest 379 passed · ruff clean** (no FE files touched this round → vitest/tsc unchanged). **Round
COMPLETE.** → open [Round_157](Round_157.md): FM1–12 append dogfood (the sequenced real walk that
exercises append *with* provenance — each row self-labels its month).

## Check

- [x] pytest 379 passed (374 pre-existing updated + 5 new provenance tests) · ruff clean.
- [x] No FE files touched → vitest 314 / tsc / design:lint / design:tokens / markdownlint unchanged
      from the R155 baseline.
- [x] Downstream test expectations updated for the extra `Source.Name` column with no weakened
      assertions (the delegated update surfaced the dtype regression rather than masking it).
- [x] Integration walk signed off by the human (DCFBI hard gate) — see above.

## Act

**Learnings**:

- A post-write parquet rewrite (DuckDB `COPY (SELECT *…)`) is **not dtype-transparent** — it strips
  pandas' `string` extension dtype, breaking the R142-F2 stored-dtype invariant. Inject added columns
  into the *single* write, never re-encode existing columns. Captured in memory.
- Because `hidden` is preview-only (R152), an "invisible" column is still a real, groupable column —
  provenance flowing through query/join/workflow output is the feature, not leakage.

**Promotions**: none this round (the dtype-transparency lesson is a memory file, not a `context/` or
`skills/` promotion).

**Follow-ups (not promotions, just notes):**

- R157 dogfood may surface schema drift across FM1–12 that append's reconciliation must absorb.

## Feeds into → Round_157 (FM1–12 append dogfood)

R156 hands forward a groupable, hidden-by-default `Source.Name` provenance column on every dataset
across all refresh modes. R157 consumes it: appending FM1→FM12 in one real walk, each row
self-labels its month, then `GROUP BY Source.Name` yields per-month counts.
