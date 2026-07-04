# Round 147: Merge-on-key / precedence — refresh for overlapping exports (⑥ / F5+F6)

**Status**: Planning
**Date started**: 2026-07-04
**Date completed**:
**Flow**: **DCFBI** — set at the Design gate via flow-selector (1 of 5 fired: high
user-error risk); recorded in the Do log. No F1/F2 gates; human verification at Integration.

## Goal

**Inherits from ← [Round_146](Round_146.md) "Feeds into"** (⑥ round 2, slid from R146 by the
R145 re-rank) — per the signed-off R142 order, the **⑥ refresh theme** continues. R145 shipped
refresh as **whole-table replace** (right for cumulative exports — FM2.25 superseded the prior
commit outright). This round covers the case replace cannot: **overlapping, non-cumulative
re-exports**, where the new file and the committed data share keys but neither is a superset.

- **F5 — merge needs an identity key + precedence, and `UNION` cannot fake it**: the two real
  CRM snapshots share 6,960 phone values, and under EVERY counting policy roughly half changed
  their call-status between snapshots — so `UNION ALL` double-lists and `UNION DISTINCT` keeps
  both (the rows differ). Dedup here is **record reconciliation**: keep-latest-per-key, which
  needs a declared key + a conflict rule (newest snapshot wins). Without it, month-2 data for
  a non-cumulative source is silently wrong.
- **F6 — the identity key is a domain decision the product cannot infer**: phone is NOT unique
  even within one file (the source's own `TRÙNG` column counts 1..8+ occurrences; 16,375
  in-file duplicate-phone rows). "One row per lead" is undefined until the human declares what
  a lead IS (phone? phone+creation-date? phone+car?). The mechanism (pick key column(s) +
  precedence, latest-wins) is generic; the *choice* is not.

After this round: refresh serves both real export shapes — cumulative (replace, R145) and
overlapping partial (merge-on-key, this round) — and month-2 stops being a correctness risk
for non-cumulative sources. The **AI-propose-key** slice (agent proposes, human verifies
meaning — the natural #2 AI-loop moment F6 names) is explicitly **NOT this round**: #2 is
additive, never load-bearing; the manual key pick must stand alone first.

_Track: 1. Pulled by ← [Round_146](Round_146.md) Feeds-into + the signed-off ranking in
[2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md)
(rank 3, ⑥ = month-2 blocker; F5 upgraded to correctness risk) + the R145 boundary note in
[upload.md § Refresh](../../design/data-management/datasets/upload.md) ("replace can't dedup
overlapping partial exports; that wall pulls the merge round next").
D-gate first per the d-gate-artifact-in-design-corpus lesson._

## Plan

- [ ] **D**: design-corpus touches, signed off before code:
      [upload.md § Refresh](../../design/data-management/datasets/upload.md) extends with a
      **merge mode** — the noun-vs-mode question first: merge as a refresh-commit **choice**
      (replace | merge-on-key) inside the existing wizard vs a workflow-step home
      ("keep latest per key" IS expressible as one DuckDB window step — but R142 filed it as
      an ingest/⑥ gap, and refresh-time merge keeps the dataset the single source dependents
      read; weigh both, pick one, name the rejected home). Then: key declaration UX (pick key
      column(s) on first merge; persisted where — `commitSettings` on `source.json` is the
      R145 seam), precedence rule (latest-wins = incoming file wins; is anything else needed
      round 1?), **row-absence semantics** (a key present in the committed data but absent
      from the incoming partial export must be KEPT — that is the difference from replace),
      and **in-file duplicate policy** (F5's first-row/last-row ambiguity: what does merge do
      when the incoming file itself repeats the key —
      **domain decision, ask the human**, same class as drift severity in R145).
      [datasets.md](../../design/data-management/datasets/datasets.md) — whether the merge/
      replace choice and the declared key surface on the dataset detail.
- [ ] **Domain decisions at D (human)**: (1) the identity-key declaration UX + whether a
      declared key is remembered per dataset; (2) in-file duplicate handling; (3) replace vs
      merge as a per-refresh choice or a per-dataset setting.
- [ ] **Flow selector** at D exit; record the table in Do. (A key-picker step in the refresh
      wizard is likely a new interaction; merge of live data is high user-error risk —
      let the selector decide.)
- [ ] **C**: contract — the batch/refresh request gains the merge shape (mode + key columns);
      merge-report shape (rows matched/updated/inserted/kept); error envelopes (unknown key
      column, key-dtype mismatch — reuse the 422 families where they fit).
- [ ] **B**: DuckDB-first merge (keep-latest-per-key over committed parquet + incoming
      staging; the R145 atomic directory-swap discipline extends — validate on staging BEFORE
      any swap); key-dtype guard (F5×F2: the drift gate already surfaces dtype changes — the
      merge path must hard-check the KEY column's dtype specifically, a silent mismatch =
      false non-overlap).
- [ ] **F**: refresh wizard gains the replace|merge choice + key picker + merge summary in
      the confirm step (counts: updated / inserted / kept).
- [ ] **I**: i18n en+vi — per the R146 lessons: grep the corpus for existing renderings
      before coining copy; "tập dữ liệu"; EN loanwords only for Dashboard/sheet/widget;
      value-only residual sweep. Design-sync.
- [ ] Tests: the real CRM pair as the fixture shape (6,960 overlapping keys, ~half changed →
      merged result has ONE row per key with the incoming status; absent-from-incoming rows
      kept) · in-file duplicate per the D decision · key-dtype mismatch → typed 422, dataset
      untouched · merge failure mid-way leaves the committed dataset intact (atomicity) ·
      replace path unregressed.

## Risks / unknowns

- **Noun-vs-mode / build-home** — refresh-commit mode vs workflow-step home. Default leans
  refresh-mode (the ⑥ framing + dependents read the dataset), but the
  workflows-extend-query-DuckDB-first doctrine says shaping lives in steps; D must argue it,
  not assume it. If D picks the step home, the round re-scopes — flag and stop, don't absorb.
- **Key + precedence are domain decisions** (F6) — the round hard-stops at D for the human;
  the `TRÙNG` lesson stands. Agent proposes the table of options, human declares.
- **In-file duplicates make "latest-wins" ambiguous** — file row order is not time; if the
  incoming file repeats the key, "which row wins" needs a rule (last-in-file? reject-loudly?).
  Don't invent silently; surface at D.
- **Fat-point watch: the key-picker UX** — declaring a composite key mid-wizard could balloon.
  Seam if it grows: slice 1 = single-column key + latest-wins; composite keys / precedence
  variants defer with trigger named.
- **F5×F2 residual** — dtypes are trustworthy since R143, but the merge key is the one column
  where a dtype drift = silent false non-overlap; the drift gate warns, the merge path must
  treat a key-dtype change as its own loud stop (warn-never-block was scoped to drift review,
  a corrupt merge is a different severity class — confirm at D).
- **Carried, not this round**: R145 slice **1b** (drift blast-radius preview — per-column
  reference resolution); trigger named in
  [upload.md § F10](../../design/data-management/datasets/upload.md); re-rank only on
  evidence. AI-propose-key likewise parked (#2 additive, needs the manual path shipped).

## Do

### D-gate — design draft (2026-07-04, awaiting human sign-off)

Design corpus drafted (the D deliverable, per the `d-gate-artifact-in-design-corpus` lesson):

- [upload.md § Refresh merge mode (R147)](../../design/data-management/datasets/upload.md#refresh-merge-mode-merge-on-key-and-precedence-r147)
  — **build home ARGUED, not assumed**: refresh-commit mode chosen over the workflow-step home
  (a step-home dedup is opt-in per consumer → the dataset stays double-rowed and every query
  that forgets the step is silently wrong — the exact F5 failure; F5 is source correctness,
  not presentation shaping, so the DuckDB-first steps doctrine doesn't claim it; a
  presentation-level "latest per key" step stays open to a future pull, orthogonal). No new
  wizard step: Confirm gains the `replace | merge` choice + key picker. Merge = keep-latest-
  per-key (incoming wins; committed-only rows KEPT — the difference from replace); one DuckDB
  statement, same staged/atomic-swap invariant. **F5×F2 key-dtype guard**: key-column drift
  (removed / dtype-changed) is the ONE loud stop in the otherwise warn-never-block drift gate
  — blocks *merge*, not refresh (switch to replace / fix / re-pick); backend 422s
  independently. Wire: item gains optional `merge_key: string[]` (absence = replace,
  unchanged); 201 adds `{updated, inserted, kept}` counts; `commitSettings` remembers
  `mergeKey` + `refreshMode` (F9 pattern).
- [datasets.md § Refresh affordance](../../design/data-management/datasets/datasets.md#refresh-affordance-r145)
  — stamped: **no new placement**; choice + key live in the wizard Confirm step; detail
  header unchanged in slice 1.
- Stale R146→R147 pointers in both docs corrected (design docs are current-state spec).

**❓ Domain decisions D1–D5 tabled for the human** (each with a recommendation, none decided):
D1 key shape/persistence (rec: ≥1 committed columns, remembered in `commitSettings.mergeKey`) ·
D2 incoming dup-key rows (rec: **loud typed 422** — file order is not time; the error teaches
the fix) · D3 precedence (rec: incoming-wins; precedence-column defers with trigger) ·
D4 mode selection (rec: per-refresh choice, last-used default) · D5 result schema under drift
(rec: incoming schema wins, consistent with replace). **Hard stop here for the human.**

### D-gate — CLOSED (human, 2026-07-04)

**"recs are fine"** — D1–D5 all resolved to the tabled recommendations, including the
key-dtype exception to warn-never-block (blocks merge, not refresh). Spec banners flipped to
SIGNED OFF in upload.md + datasets.md. Human verification scheduled at Integration ("proceed
then tell me what to confirm").

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification |
| ------------------------------------ | ------ | ------------- |
| 1. >3 independent states/branches    | no     | Wizard state machine reused unchanged; merge adds a mode choice + key picker on Confirm and one blocking condition in the existing Drift step — not >3 new independent branches. |
| 2. New interaction pattern           | no     | Radio mode choice, column multi-select, and typed-422 surfacing all exist (metadata dtype dropdowns, coercion alert, R145 drift review). |
| 3. High user-error risk              | yes    | Irreversible forward-only merge of live data; a wrongly-declared key silently reshapes the dataset (the F5 class). |
| 4. Contract depends on unresolved UI | no     | D1–D5 resolved; `merge_key` + `{updated, inserted, kept}` are writable as YAML now. |
| 5. UX confidence below threshold     | no     | Standard controls inside an existing step; D review closed with no open UX questions. |

Result: **Flow: DCFBI**

### C/B/F/I — built (2026-07-04)

- **C (contracts):** [batch-post.contract.yaml](../../../workspace/packages/contracts/datasets/batch-post.contract.yaml)
  — item gains `merge_key` (requires `target_dataset_id`); 201 becomes a `oneOf`
  (plain array | `{ datasets, merge: {updated, inserted, kept} }` wrapper, FE branches on
  `Array.isArray`); 422 oneOf gains the `merge_duplicate_keys` envelope + the detail-string
  guard list. New shared [ApiErrorMergeDuplicateKeys](../../../workspace/packages/contracts/_shared/api-error.yaml)
  (key · duplicateKeyCount · sampleKeys ≤5). [refresh-settings-get](../../../workspace/packages/contracts/datasets/refresh-settings-get.contract.yaml)
  gains `merge_key` + `refresh_mode` (D1/D4 memory). Both `.md` rationales updated —
  including the stale-since-R145 `target_dataset_id` "422-reserved" paragraph (truth fix).
  Error code added to `values.yaml` + both constants templates → regenerated.
- **B (backend):** new [app/ingest/merge.py](../../../workspace/apps/backend/app/ingest/merge.py)
  — one DuckDB statement (incoming ∪ anti-join committed) writing the merged parquet;
  dup-key detection BEFORE any write; kept committed rows CAST loudly into the incoming
  schema (no TRY_CAST-to-NULL by design). [datasets.py](../../../workspace/apps/backend/app/routers/datasets.py):
  `_merge_key_guards` (unknown / missing-from-incoming / dtype-drifted key → 422, dataset
  untouched — the F5×F2 stop, BEFORE any write) · `_run_merge` (staging-side merge; failures
  discard staging, same intact-on-failure invariant as replace) · `merge_key` on a create
  item → 422 · row_count = merge sum · `commitSettings` remembers `refresh_mode` +
  `merge_key` (a later replace carries the key forward) · merge 201 = the wrapper response.
- **F (FE):** `RefreshSemantics` block on the Confirm step (mode radio + key multi-select
  from the committed columns + blocking alert); `mergeKeyIssues` pure guard (excluded =
  missing; effective dtype = override ?? parsed) drives picker error state AND the disabled
  commit button; `SEED_REFRESH` seeds remembered key/mode (dropping key columns no longer
  committed; merge with no surviving key falls back to replace); commit sends `merge_key`;
  wrapper response → success toast with the counts; `merge_duplicate_keys` typed error
  rendered on Confirm (title + teach-the-fix description). Types: `RefreshMode`,
  `MergeReport`, `CommitBatchMergeResponse`, ApiError variant + `isApiError`.
- **I (i18n):** en+vi `upload.refresh.mode*`/`mergeKey*`/`confirmMerge*`/`commitMergeLabel`/
  `mergeSuccess` + `upload.confirm.errorMergeDuplicateKeys*`. VN per the R146 lessons —
  corpus-grepped first: **"khóa"** (established: "khóa nối", "khóa sắp xếp") + **"gộp"**
  (Excel-vi "Gộp ô"); one word per concept; value-framed hints ("dòng chỉ có trong tập dữ
  liệu được giữ lại"). Design-sync: 2 build deviations flagged in upload.md (key guard
  surfaced on Confirm, not the Drift step — the key is only declared on Confirm; committed
  dups folded into `kept`, no 4th count) + snake_case snapshot keys.

**Gates:** BE `ruff` clean · `pytest` 347 (incl. new `tests/test_datasets_merge_refresh.py`
— 10: keep/incoming-wins/counts, dup-key envelope + intact, unknown/missing/dtype-drift key
guards, merge-on-create 422, composite key, D5 schema, commitSettings memory, replace
unregressed) · FE `tsc` 0 · `vitest` 286/286 (incl. 9 new merge reducer/guard tests) · i18n
en/vi parity OK.

### Post-build fix — refresh sheet handling (human finding, 2026-07-05)

The human's checklist question ("should refresh allow multi-sheet select?") surfaced **three
R145-era gaps** the merge build had inherited. Design answer recorded in
[upload.md § Entry point](../../design/data-management/datasets/upload.md): refresh stays
**single-sheet by design** (one new table → one dataset; the wire's one-item invariant), but
the sheet must stay **re-pickable** — the committed sheet name is a default, not a lock
(monthly exports rename sheets; the real CRM files are date-stamped). Fixed:

1. **Silent multi-select** — the Sheet step allowed checking N sheets; commit silently used
   only the first. Now radio semantics in refresh (`reduceToggleSheet`): selecting REPLACES,
   Select all/Clear hidden, advance requires exactly one.
2. **Ghost pre-select** — the committed sheet was pre-selected without checking it exists in
   the new workbook ("1 selected", nothing visibly checked, doomed parse). Now pre-selected
   only when present; when absent the note flips to a warning:
   "sheet gốc … không có trong tệp này — hãy chọn sheet chứa dữ liệu cập nhật".
3. **Carry-forward lost on rename** — the preset was keyed by the committed sheet name, so
   parsing a renamed sheet silently dropped ALL carry-forward (the F9 value). Now
   `pendingPresetFor` falls back to the single stashed preset whatever its key, consumed
   wholesale on first apply (re-parse still resets normally, R19 Q2).

i18n: `upload.refresh.sheetNoteMissing` + `sheetSelectionHint` (en+vi). Tests: +5 reducer
tests (ghost, pre-select-when-present, radio replace/clear, create multi-select unregressed,
renamed-sheet preset fallback). **Gates re-run:** FE `tsc` 0 · `vitest` 291/291 · en/vi
parity OK · doc lints clean.

## Check

- [x] D signed off before C/B/F (incl. the identity-key, in-file-duplicate, and
      choice-vs-setting domain decisions). _Human, 2026-07-04 — "recs are fine"._
- [~] Real CRM pair merges: one row per declared key, incoming status wins, non-overlapping
      committed rows kept; counts surfaced. _Automated proxy green
      (`test_merge_keeps_committed_only_rows_and_incoming_wins` — the overlap/changed-status
      fixture shape); the real-file walk is the human verification below._
- [x] A merge that fails validation leaves the existing dataset fully intact.
      _dup-key + guard tests assert rowCount/rows unchanged._
- [x] Key-dtype mismatch is a loud typed failure, never a silent false non-overlap.
      _`test_merge_key_dtype_drift_is_blocked_422` (BE) + `mergeKeyIssues` tests (FE)._
- [x] Backend pytest + ruff green; FE tsc + vitest green; design/plan/markdown lints clean.
- [ ] Human feel-review of the refresh-with-merge walk (checklist handed over 2026-07-04).

## Act

_(open)_

## Feeds into → Round_148 (TBD)

Per the signed-off R142 order: **F8** multi-range wizard (one sheet → N named ranges; backend
already supports) → UI-batch (F7/F3/F4/F12/F13 + carried R140 list). **Carried**: R145 slice
**1b** (drift blast-radius preview) + AI-propose-key (parked until the manual merge path is
lived). Re-rank allowed at open per evidence.
