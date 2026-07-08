# Round 155: Keyless Append refresh mode — accumulate periodic exports

**Status**: **COMPLETE 2026-07-08** — keyless Append refresh mode shipped (Replace/Append/Merge), with
the pre-commit overlap advisory. DFCFBI: D+F1 signed off, C+B1+B2+F2 green, **Integration human
real-data walk verified** ("good to go"). pytest 374 · vitest 314 · tsc/ruff clean · i18n parity.
**Date started**: 2026-07-08
**Date completed**: 2026-07-08
**Flow**: **DFCFBI (triggers 3, 4, 5)** — set at the D gate via flow-selector; recorded in the Do log.
**Design source**: [`.agents/design/data-management/datasets/upload.md`](../../design/data-management/datasets/upload.md) § Refresh (adds a new § Refresh append mode beside § Refresh + § Refresh merge mode).

## Goal

**Inherits from ← [Round_154](Round_154.md)** (re-ranked at open; append chosen over the carried
Export ④ / AI-propose-key / R145-1b on **hard dogfood evidence** — see below).

**The problem — the flagship dataset cannot be accumulated across months today.** Probed the real
2025 monthly call logs (`tmp/test-data/Weekly - Report Call Full FM1..12.25.xlsx`, real payload =
the `Worksheet` sheet). April (FM4, 2608 rows) vs May (FM5) `Worksheet`:

- **Months are disjoint** — `ID`∩ and recording-file∩ between April and May = **0**; APR dates
  16–29 Apr, MAY 02–30 May. The user wants to **keep all rows** (accumulate), not dedup.
- **No clean single-column key** — the most-unique columns still have within-month dups: `ID` = 10
  dup-keys, `File ghi âm` (recording file) = 1 dup-key (worst 3 rows). The dup rows are **genuine
  distinct calls** (two calls in the same epoch-second → same id), not a fiction.
- **Consequence:** **Replace** loses history; **Merge-on-key 422s** (`MergeDuplicateKeysError`
  rejects any incoming file with >1 row per key); **Append doesn't exist.** All three built paths
  fail. See memory `2026-07-08-append-mode-call-log-evidence.md`.

Research (Power Query / Tableau Prep, corroborated) confirms the primitive and the naming: **Append
= keyless union, keep-all, no auto-dedup** — the standard operation for combining periodic exports;
merge/join is the key-based one. Our existing merge-on-key is actually the *advanced* upsert — we
built the advanced thing and skipped the basic one.

**The capability:** a **third refresh mode, `append`** (keyless union-all), alongside the existing
`replace` and `merge`(-on-key). Modes reframed to the Excel persona's vocabulary
**Replace / Append / Merge**. Reuses `merge.py`'s name-based column reconciliation (null-fill added
cols · cast · drop removed) **minus the key/dedup step**.

**Folded in (this round):**

- **(2) `design-sync data-management/datasets`** — as the D-gate pre-flight (also clears the 2
  pre-existing `dataset-detail.md` drifts deferred from R154).
- **(3) FE pre-fill of the saved `merge_key`** — only if it shares the refresh wizard (backend
  already persists + carries `commitSettings.merge_key`; gap is pure FE pre-fill).

## Pinned D-gate design — the double-count mitigation (human-confirmed 2026-07-08)

Append **keeps all rows** and mutates a dataset with **live dependents** (identity kept), so
re-uploading a period silently doubles rows and inflates every dependent widget — a hard-to-reverse
data effect (cold-review anchor 5 = one-way data door). Because the data has **no clean key**,
key-idempotency cannot be the defense. Mitigation = **keyless, explicit warn-only, never block**,
mapped onto the **existing F10 Drift-review step** (warn-loud/never-block precedent):

| User's date-field choice | Incoming vs. existing range | Behavior |
| ------------------------ | --------------------------- | -------- |
| Picks a date field | ranges **disjoint** | Quiet — *"no overlapping dates detected on `<field>`"* (a fact, **never** "no duplicates") |
| Picks a date field | ranges **overlap** | **Warn** — names the overlapping range, *"appending will add these again"* |
| Picks "None" / skips | (not checked) | **Always warn** — *"can't check for overlaps; append keeps all rows"* |

- Date-overlap is an **honest heuristic, not a proof** (overlap ≠ dups; disjoint ≠ zero-dups) — the
  reason this warns rather than blocks; the human (who knows re-upload vs. new data) decides.
- The **Append mode label carries the baseline expectation** (*"adds all rows; does not remove
  duplicates"*), so the mode is honest before a file is chosen.
- Ergonomic: **pre-select a detected date column** as the default field (dtype known at parse), with
  "None" available — common case is one confirm, not a blank pick.

## Open design questions (D-gate — for the design-corpus write + F1)

1. **Where is overlap computed?** BE compares committed vs. incoming min–max on the chosen date
   column and returns the result on the drift-review/commit response (reusing the F10 warn channel),
   vs. FE-computed from preview. Shapes the contract → resolve at D (see condition 4).
2. **Wire shape.** `refresh_mode: "append"` explicit vs. inferred; the optional
   `overlap_check_field?: string` (column name) — and what the response carries when overlap is
   detected (a typed `append_overlap` warn payload for the drift-review step?).
3. **Modes reframe surface.** How Replace/Append/Merge present in the wizard (the mode selector today
   is replace-vs-merge implied by `merge_key` presence) — an explicit 3-way choice.
4. **`merge.py` reuse boundary.** Append = the merge SQL path with no key predicate and no dup-key
   guard (pure `UNION ALL BY NAME` with the same null-fill/cast/drop reconciliation) — confirm the
   cleanest reuse (shared reconciliation helper vs. a sibling `append_parquets`).

## Plan (draft — D refines; F1 feel-review precedes C on the DFCFBI path; do NOT build before sign-off)

- [x] **D-gate pre-flight** — `design-sync --check data-management/datasets` (folded item 2). **Done
      2026-07-08** → report `.agents/tmp/design-sync/data-management-datasets.md`; markers stamped.
- [x] **D**: append design authored into `upload.md` § Refresh append mode (3-state warn mitigation +
      Replace/Append/Merge reframe + wire shape + acceptance) + 9-drift reconcile; design gates green.
      **Human D sign-off 2026-07-08** — incl. the explicit `refresh_mode` discriminator.
- [x] **F1 (built)**: mode reframe (Replace/Append/Merge) + date-field picker + the 3 warn states,
      contract-safe (FE state + request-only per [[dfcfbi-f1-precedes-contract]]); append commit
      **disabled** in F1 (no wire → never falls through to replace). tsc + vitest 314 green.
      **Awaiting the human feel-walk** — *does the overlap-warn prevent the double-count, or get
      dismissed?* (the swing risk).
- [x] **C**: refresh contract gains `refresh_mode` + `overlap_check_field?` + the append 201 wrapper
      `{datasets, append:{appended,total}}`; **new `POST /datasets/{id}/append-overlap` preview endpoint**
      (cond-4 decision — human chose the dedicated endpoint over extending two reads); FE types/api/MSW.
      tsc + vitest 314 + contract-validator 18 green.
- [x] **B1**: core append — `append_parquets` (UNION ALL, reuse D5 reconciliation, no key/dup-guard);
      `_handle_refresh` routes on explicit `refresh_mode`; 422 guards (append+merge_key, refresh_mode on
      create, replace+merge_key); commitSettings carry-forward (refresh_mode + overlap_check_field);
      append 201 wrapper. pytest 369 (+7), ruff clean.
- [x] **B2**: `POST /datasets/{id}/append-overlap` — `column_min_max` (DuckDB) on the committed
      parquet vs. a re-parsed incoming probe (field only, carried format); interval-overlap →
      `{field, overlaps, committedRange, incomingRange, overlappingRange?}`. 404 dataset/temp; 422
      non-date-field / unparseable. pytest 374 (+5), ruff clean, FE contract-validator 18 green.
- [x] **F2**: append commit enabled (`refresh_mode:'append'` + `overlap_check_field` on the item;
      append 201 wrapper → success toast); the overlap warn made LIVE via `useAppendOverlapQuery`
      (checking / clean / overlap-detected-names-range / couldn't-check states) replacing F1's
      copy-preview; en+vi live-warn keys. tsc + vitest 314, i18n parity green.
- [ ] **I**: i18n en+vi for the append mode label, the date-field picker, and the 3 warn states.
- [ ] Tests: BE append keep-all + column reconciliation + overlap detect; parquet doctrine (append
      writes, but never mutates the *incoming* file); FE mode select + warn states; contract-valid mock.

## Risks / unknowns

- **The warn is the whole safety model** — if it ages into a click-through nag, the footgun is
  unguarded. Version B (overlap-detected, quiet-when-clean) chosen specifically to keep signal; F1
  validates it works.
- **Double-count is a one-way data door** — corrupted accumulated rows are hard to unwind (which
  were the dups?). Get the mitigation right at D/F1 **before** B, not warn-only-as-afterthought.
- **Date-field heuristic honesty** — never render "no duplicates"; only "no overlapping dates on
  `<field>`". A wrong/coarse field weakens the signal — surfaced, not hidden.
- **merge.py reuse** — the dup-key guard must NOT fire on the append path (append keeps dups by
  design); confirm the guard is merge-only.

## Do

### D-gate pre-flight — `design-sync --check data-management/datasets` (2026-07-08)

Code-truth read delegated to a subagent (routers/datasets.py, ingest/merge.py, alembic, FE feature +
datasetsApi.ts). Report: `.agents/tmp/design-sync/data-management-datasets.md`. Markers stamped on all 3 docs.

**Verdict: all 3 docs OUT OF SYNC — 9 claims, only 1 mildly load-bearing; nothing blocks append.**

- **upload.md** (4, all low): § Refresh *mechanism* accurate; drifts = `target_dataset_id`
  "422-reserved" (now real), 2 stale line anchors, UPDATE list omits `sheet_name` (relevant — an
  append renaming the sheet rewrites it), `GET /datasets/:id/dependents` cited but unbuilt (slice 1b).
- **dataset-detail.md** (3): hook name `useSetColumnVisibility` → `useSetColumnVisibilityMutation`
  (load-bearing; R154 suspect #1 CONFIRMED), "shared `SectionHeader`" is file-private (suspect #2
  CONFIRMED), Surfaces table omits `PropertiesDrawer`.
- **datasets.md** (2): § Column visibility frozen at `PROPOSED — R152` (shipped), same hook-name drift.
- **R154 revert confirmed CLEAN** (no `/profile` route/contract/FE refs).

**Disposition:** upload.md § Refresh synced **by construction** as R155's D-phase writes append onto
it (per skill: no separate sync during an in-scope build round on the domain). The drifts in
dataset-detail.md and datasets.md (the R154-deferred cleanup) are fixed as a targeted reconcile in D
— no full compact (citations/labels, not ledger sprawl). Markers clear when D reconciles each doc.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no (borderline) | Top-level branches = mode ∈ {replace, append, merge} (3) + append's date-field-or-none; at/near the threshold, not clearly over it. |
| 2. New interaction pattern           | no     | Extends the R145/R147 refresh wizard; date-field picker is a standard select; the overlap warn reuses the existing F10 Drift-review step. |
| 3. High user-error risk              | **yes** | Append mutates a dependent-bearing dataset and keeps all rows — re-uploading a period silently doubles rows and inflates every dependent widget (a hard-to-reverse data effect); unclear flow amplifies it. |
| 4. Contract depends on unresolved UI | **yes** | Whether overlap is BE-computed (a typed `append_overlap` warn payload on the response) or FE-computed from preview is unresolved and changes the wire shape — can't cleanly write the YAML without deciding it (Q1/Q2). |
| 5. UX confidence below threshold     | **yes** | The feature's entire safety rests on a soft warn; whether it prevents the footgun vs. gets dismissed is a genuine open feel question (the A-vs-B debate) — no real-app validation yet. |

Result: **Flow: DFCFBI (triggers 3, 4, 5)** — the F1 feel-review of the overlap-warn precedes the contract.

### D-phase — append design authored + drift reconcile (2026-07-08)

Wrote **§ Refresh append mode** into `upload.md` (the durable D-gate artifact, per
[[d-gate-artifact-in-design-corpus]]): Concept (the case merge can't serve — real call-log evidence)
· Build home (3rd refresh semantics `replace | merge | append`, reuses `merge_parquets` minus
key/dup-guard) · keep-all union semantics · the **3-state warn mitigation** as pinned · wire shape ·
boundaries · acceptance. Reconciled all **9 drifts** from the pre-flight in the same pass
(upload.md ×4 by construction; dataset-detail.md ×3 incl. the load-bearing hook name; datasets.md
×2) and **cleared all 3 markers**.

**Design decisions resolved in the draft (for D sign-off):**

- **Explicit `refresh_mode` discriminator** — append is keyless so it *can't* piggyback on
  `merge_key` presence (that's how replace/merge are told apart); `refresh_mode:
  'replace'|'merge'|'append'` becomes an explicit item field. Replace/merge stay back-compatible
  (inferred when omitted); `append` requires it. This is the one genuinely-new wire call.
- **Append counts** `{ appended, total }` on the 201 (mirrors merge's `{updated,inserted,kept}`).
- **Deferred:** overlap-computation *location* (BE vs FE) → resolved at C after F1 (cond-4); a
  per-append **provenance column** (`Source.Name`) → out of slice 1, trigger named.

**Gates green:** `design:lint` 0 · `design:tokens` 0 · `markdownlint-cli2` 0 · `markdown-check-link` 0
(new same-file anchor + F6/F10 cross-refs resolve). Pre-flight report superseded in
`.agents/tmp/design-sync/data-management-datasets.md`.

**Human D sign-off 2026-07-08** ("approve") — including the explicit `refresh_mode` discriminator, the
`{appended, total}` counts, and the two deferrals (overlap-location → C-after-F1; provenance column
out of slice 1). D gate closed → F1.

### F1-phase — contract-safe feel-review build (2026-07-08)

Built the append UX for the human walk, no wire touched:

- `RefreshMode` gains `'append'` (types.ts); wizard state gains `overlapCheckField: string | null` +
  `SET_OVERLAP_FIELD` + a `dateFieldOptions(sheet)` helper (kept date/datetime cols, effective dtype).
- `UploadConfirmStep` refresh-semantics block → 3-way **Replace / Append / Merge**; Append reveals a
  **date-field picker** (allowClear = "None") and the **2 client-knowable warn states** — field picked
  → info note previewing the overlap-warn promise; None → warning note (the always-warn baseline). The
  mode hint carries "adds all rows; does not remove duplicates".
- `DatasetNewPage`: append commit **disabled** (`appendNotWired`) + a defensive early-return in
  `commitRefresh` — F1 must never let append fall through to a replace commit (no `merge_key` ⇒ replace).
- i18n en+vi `upload.refresh.{modeAppend,modeAppendHint,commitAppendLabel,overlapField*,confirmAppend*}`
  (vi is a first pass — the careful copy pass is I).
- Tests: +5 in `refresh-wizard.test.ts` (SET_OVERLAP_FIELD, remembered-append carry-forward keyless,
  `dateFieldOptions` filtering + override-dtype + unparsed). **tsc clean · vitest 314 (+5) · i18n parity green.**

**The "overlap detected" warn itself is a backend result** (committed vs. incoming date range) — not
computable client-side (no committed data on the FE), so F1 previews its *copy/placement* only; the live
detection lands at C/B (the cond-4 open). The walk judges the mode reframe + picker + warn wording.

**Human F1 sign-off 2026-07-08** ("verified") — mode reframe + picker + warn UX approved on a real
screen. Round-half-1 [D+F1+design-sync] complete → C opens (the cond-4 overlap-computation decision first).

### C-phase — contract + FE plumbing (2026-07-08)

Cond-4 resolved by the human: **dedicated preview endpoint** (over extending two reads).

- **Contracts**: `batch-post` item gains `refresh_mode` (`replace|merge|append`, back-compat: omitted ⇒
  inferred; `append` explicit) + `overlap_check_field?` (remembered, not acted on at commit); 201 oneOf
  gains the append wrapper `{datasets, append:{appended,total}}`; +append guards on 422. **New
  `append-overlap-post.contract.yaml`** — `POST /datasets/{id}/append-overlap {temp_id,sheet?,field}`
  → `{field, overlaps, committedRange, incomingRange, overlappingRange?}`, 404/422. `refresh-settings`
  gains `overlap_check_field` + `append` in the `refresh_mode` enum.
- **FE**: types (`AppendReport`, `CommitBatchAppendResponse`, `DateRange`, `AppendOverlap{Request,Result}`,
  item fields); `datasetsApi.previewAppendOverlap`; MSW handlers (append/merge wrapper branch on the batch
  mock + the append-overlap mock, both contract-valid; field-name "overlap" = test affordance for the
  overlap shape). Commit-union narrowing fixed (`'merge' in result`).
- **Gates**: tsc clean · vitest 314 · contract-validator 18 (auto-discovers the new contract by glob +
  operationId). No backend logic yet (that's B); append commit still disabled (F1).

### B1-phase — core append backend (2026-07-08)

Append works end-to-end at the backend; the overlap advisory is split to B2 (below).

- **`append_parquets`** (ingest/merge.py) — keyless `UNION ALL(committed, incoming)` reusing merge's
  D5 column reconciliation (CAST / NULL-fill / drop) **minus** the key predicate and the dup-key guard;
  returns `{appended, total}`. Shares `MergeCastError` (the one common failure — a kept committed value
  that can't cast into the incoming schema).
- **`_handle_refresh`** now resolves an effective `mode` (explicit `refresh_mode` wins; else inferred
  merge-iff-key / replace). Guards: append+merge_key → 422 (keyless); merge without key → 422; replace
  with key → 422. `_run_append` mirrors `_run_merge` (staging, intact-on-failure). commitSettings
  remembers `refresh_mode` + `overlap_check_field`, carrying the non-owning mode's identity forward.
  Append 201 returns the `{datasets, append:{appended,total}}` wrapper.
- **Create-path guard**: `refresh_mode` / `overlap_check_field` on a create item → 422 (refresh-only).
- **Tests** (`test_datasets_append_refresh.py`, +7): keep-all incl. duplicates · **dup-key guard does
  NOT fire on append** · D5 incoming-schema-wins (null-fill/drop) · append+merge_key 422 · refresh_mode
  on create 422 · explicit replace still returns array · commitSettings memory + carry-forward. **ruff
  clean · pytest 369 (+7)**; append wrapper + settings contract-validated via `validate_response`.

**B2 (deferred slice)**: the `append-overlap` endpoint re-parses the incoming file to read the field's
range — needs the committed date-format carried through, and drift (incoming format ≠ committed) is a
real edge. Isolated to its own slice so the fragile parsing gets a focused pass; append is fully
functional without it (F1 already proved the warn UX; the live trigger lands at B2).

### B2-phase — append-overlap advisory endpoint (2026-07-08)

- **`column_min_max(parquet, field)`** (ingest/merge.py) — the DuckDB min/max range primitive.
- **`POST /datasets/{id}/append-overlap`** (`preview_append_overlap`): committed range from the dataset
  parquet; incoming range from a throwaway **probe parquet** — re-parses only `field` with the target's
  CARRIED format (an override only when a format was carried; inferred-date columns re-infer, since a
  date override without a format is itself rejected). Interval overlap = `imin ≤ cmax AND cmin ≤ imax`;
  `overlappingRange = max(mins)…min(maxes)`. Ranges serialized ISO (`_iso`/`_range_json`). Advisory —
  never mutates; 422 "couldn't check" on a non-date field / absent-from-incoming / unparseable (the
  drift edge I flagged, handled honestly).
- **Contract fix**: same-file `#/components/$ref` broke `validate_response` (it validates the extracted
  response subtree, so `components` is out of scope) → inlined the `DateRange` shape as
  `type: [object, "null"]`. AJV + jsonschema both accept it.
- **Tests** (`test_datasets_append_overlap.py`, +5): overlap-with-ranges + overlappingRange · disjoint
  → no overlap / no overlappingRange · non-date field 422 · field-absent 422 · 404 dataset/temp.
  **ruff clean · pytest 374 (+5)** (contract-valid via `validate_response`); FE contract-validator 18 green.

### F2-phase — append wired live (2026-07-08)

- **Commit**: append now committable — `commitRefresh` sends `refresh_mode:'append'` + (remembered)
  `overlap_check_field`; the append 201 wrapper `{appended,total}` → `appendSuccess` toast. Dropped
  the F1 `appendNotWired` disable + the defensive early-return.
- **Live warn**: `useAppendOverlapQuery` (own key `['datasets',{id},'append-overlap',{tempId,sheet,field}]`,
  `retry:false`, enabled only in append + field-picked) drives four states in the Confirm block —
  **checking** / **clean** (no overlap) / **overlap-detected** (warns naming the overlapping range) /
  **couldn't-check** (soft info, never blocks) — replacing F1's copy-preview. None-field keeps the
  always-warn note.
- **i18n**: dropped `confirmAppendCheckedBody`; added `appendSuccess` + `overlap{Checking,Clean,
  WarnTitle,WarnBody,CheckFailed}` (en+vi).
- **Gates**: tsc clean · vitest 314 · i18n parity green. The live-warn *render* + append commit through
  the wizard are validated at the Integration human walk (DFCFBI: F2 builds, Integration is the gate).

## Check

- [x] D signed off (the 3-state mitigation + explicit `refresh_mode` discriminator) before F1/C/B — human 2026-07-08.
- [x] F1 human walk: mode reframe + overlap-warn UX verified on a real screen ("verified").
- [x] Append keeps all rows incl. duplicates; column reconciliation (D5) correct; dup-key guard does NOT fire on append; overlap detect correct; carry-forward remembered — asserted by pytest (+12 across append + overlap suites).
- [x] Contract valid (mock end-to-end via `validate_response` + FE contract-validator 18); BE pytest 374 + ruff; FE tsc + vitest 314; i18n parity; design/md lints.
- [x] Integration human real-data walk ("good to go") — append accumulates; re-append warns; replace/merge unregressed.

## Act

**Shipped 2026-07-08.** Keyless **Append** is the third refresh mode (Replace / Append / Merge),
closing the real gap the dogfood probe found: the 2025 monthly call logs have disjoint months but no
clean key, so replace lost history and merge-on-key 422'd — neither could accumulate them. The
double-count hazard append introduces is guarded by a keyless, warn-never-block overlap advisory
(`POST /datasets/{id}/append-overlap`) surfaced pre-commit; because the data has no clean key,
key-idempotency couldn't defend it, so a date-range heuristic does — honest ("no overlapping dates on
`<field>`", never "no duplicates"), and it warns rather than blocks.

**Lessons (→ memory):**

- **Split a phase when a sub-part carries disproportionate risk.** B was cleanly split B1 (core
  append — no parsing fragility, reuses the staged parquet) / B2 (the overlap endpoint — re-parses the
  incoming with a carried date-format, where drift is a real edge). The fragile part got its own
  focused pass; append shipped functional after B1. Mirrors R145 slice-1a/1b. → [[split-fragile-subphase]].
- **`validate_response` validates the extracted response subtree** — a same-file
  `#/components/$ref` can't resolve there (no `components` in scope). Inline the shape (or use a
  cross-file `_shared/` ref). Cost a debug loop at B2. → [[contract-validator-no-same-file-component-ref]].
- **Reframe modes in the persona's vocabulary.** Research (Power Query *Append* / Tableau *Union*)
  showed append = the *basic* keyless op; we'd built the *advanced* upsert (merge-on-key) and skipped
  it. Naming the trio Replace/Append/Merge matched the Excel-literate mental model. See
  [[append-mode-call-log-evidence]].
- **The cold-review's desirability probe was the highest-value gate**: its "does the data actually
  have a key?" challenge, answered against the real 2025 logs, is what turned a vague "allow merge
  without key" into the correct, evidence-backed Append round.

**Deferred / carried:** a per-append **provenance column** (`Source.Name`, "undo one append") — trigger
named, no pull yet. FE **pre-fill of the saved `merge_key`** (candidate #3) — backend already carries
it; pure FE polish, not pulled this round. Export ④, AI-propose-key #2, R145 slice 1b — still parked.

**Prune check:** nothing to prune — every addition (append mode, overlap endpoint, the reframe) is
load-bearing for the shipped capability.

## Feeds into → Round_156 (TBD)

Re-rank at open. **Carried**: Export ④, AI-propose-key #2 (the no-clean-key finding gives it a real
job — propose a composite key), R145 slice 1b (blast-radius preview), FE `merge_key` pre-fill polish,
append provenance column (trigger named). **Consider**: a dogfood pass on the full 12-month append
(FM1–FM12) now that the loop is closed.
