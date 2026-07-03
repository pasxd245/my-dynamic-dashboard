# Round 142: Dogfood probe — one real CRM export through the whole loop, twice

**Status**: Complete
**Date started**: 2026-07-02
**Date completed**: 2026-07-03
**Flow**: probe round — NOT a feature round, so the R47 flow-selector is skipped by its own
trigger rule (no new surface, no contract; the deliverable is evidence). Precedent: the R109
charts probe / R119 probe-the-producer pattern.

## Goal

Answer, with evidence instead of argument: **what keeps the loop from "working brightly"** —
before spending rounds on refresh (⑥), date_trunc (②), or export (④). Walk a REAL CRM export
through the full product loop (upload → join/clean → shape with steps → dashboard), then
**simulate month 2** (a new export for the same report), logging every friction, breakage, and
manual step. The deliverable is an **evidenced, ranked friction backlog** + the named R143 pull.

Known dim spots this probe must confirm/deny and rank (2026-07-02 assessment):

1. **No refresh path** — datasets are create/rename/delete only; a new month's export = a new
   `ds_` id = every downstream query/workflow/dashboard rebuilt (the doctrine's
   "report-maintenance treadmill", unsolved).
2. **No date bucketing** — monthly/quarterly rollups (THE CRM report) are inexpressible
   (no `date_trunc`; brainstorm ② rates it highest-value).
3. **The uncaptured R140 UI/UX list** — folded into this probe's friction log.

_Track: 1 (demand-pull probe — the product decides, the probe listens). Pulled by ←
[Round_141](Round_141.md) "Feeds into" + the human's 2026-07-02 call ("export is not urgent…
it only has value once others work brightly") + the dogfood-first mission resolution
([brainstorm](../brainstorms/2026-07-01-step-model-extensibility.md))._

## Plan

- [ ] ~~**Protocol** — script the two passes~~ *(overtaken by events 2026-07-03: the human pass
      started directly with real files; no scripted protocol was written. The friction-log
      template emerged inline instead — attempted · observed · severity · workaround.)*
- [x] **Agent pre-pass** — *(reshaped: instead of a seed dry-run, the agent verified the real
      pipeline end-to-end while diagnosing F1 — curl + headless-Chromium replay covered
      upload → parse → commit against the live backend.)*
- [x] **Human pass** (real CRM export) — **upload surface DONE by the human** (5 real files,
      F1–F10); **stages 2–4 walked by the AGENT** (FM1 join → aggregate → dashboard
      `dsh_b41da51f`; F11–F13) per the cold-review's coverage fix. *Caveat: agent-walked =
      capability evidence; UX-feel evidence for stages 2–4 still thin — acceptable for
      ⑥-vs-② ranking, noted in epistemics.*
- [ ] **Fold in** the R140-noted UI/UX issues (from the human — still unenumerated).
- [x] **Synthesize** — findings doc in
      [`plan/brainstorms/`](../brainstorms/) (severity × monthly-frequency ranking); name the
      R143 pull and the order of ⑥/②/④/UI-batch behind it. *(2026-07-03:
      [2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md) —
      R143 = F1+F2, order F1+F2 → ② → ⑥ → F8 → UI-batch, month-2 write-off. **Human
      sign-off 2026-07-03.**)*

## Risks / unknowns

- **Probe honesty** — log what the product DOES, not what we hoped; a friction the human
  works around silently is still a friction (capture-inline discipline).
- **Seed ≠ real** — the agent pre-pass verifies the real implementation runs, but only the
  human pass with real data yields the ranking evidence (seed-vs-MSW lesson generalizes).
- **Scope brake** — the probe FIXES nothing (no piecemeal UI fixes mid-probe; the batch-round
  doctrine holds). Findings become rounds; the probe only ranks them.

## Do

**2026-07-03 — human pass started early (real files, ahead of the scripted protocol); first
blocker hit and diagnosed.** Files: `tmp/test-data/Weekly - Report Call Full FM{1,2,3}.25.xlsx`.
FM1.25 went through the full wizard (Master `A4:F11` + Worksheet with int→string overrides on
`Số gọi`/`Số nhận`) and committed. FM2.25 appeared "stuck when upload" — root-caused by agent
repro (curl + headless-Chromium replay + commit-path rerun in the backend venv):

### Friction log (probe discipline: log, don't fix)

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F1 | **Blocker** | Mixed-type Excel column crashes batch commit with an opaque 500. FM2's `Worksheet.Số gọi` mixes numeric cells with text cells (`'0387353189'`, leading-zero phone). Pandas reads `object`; parquet write dies: `ArrowInvalid: Could not convert '0387353189' … tried to convert to int64`. Upload + parse steps succeed; only Done fails. | `workspace/apps/backend/app/ingest/parquet_writer.py:131-137`; two FM2 temp uploads reached backend 11:15:57 + 11:18:21 (both 200, `data/uploads_tmp/`), zero FM2 datasets; direct `POST /workspaces/ws_d863c02f/datasets/batch` → 500 |
| F2 | **High (correctness)** | Wizard dtype overrides are metadata-only — never passed to the parquet writer (`kept_columns` only). Committed data can contradict its own schema: FM1's `Số gọi` metadata says `string`, parquet holds `int64` (`683`, `981572157`) — leading zeros silently destroyed. The exact override the user set to prevent F1 is ignored. | `workspace/apps/backend/app/routers/datasets.py:239-246` (call site drops `column_overrides`); parquet-vs-`columns_json` diff on `ds_2d436084` |
| F3 | **Medium (diagnosability)** | Server errors are invisible end-to-end: unhandled 500 bypasses CORSMiddleware → response lacks `Access-Control-Allow-Origin` → browser mislabels it "CORS blocked" → FE Confirm alert shows only generic "Failed to fetch". `tmp/dev/log/backend.log` captures 4 startup lines — no access logs, no tracebacks (stderr goes to the uvicorn terminal only). | Headless replay console: `blocked by CORS policy` on `/datasets/batch`; `wc -l backend.log` = 4 after multiple 200s and a 500 |
| F4 | Low | Every failed/abandoned wizard run leaves an orphaned temp upload in `data/uploads_tmp/` (6 dirs accumulated during one dogfood session). | `data/uploads_tmp/` listing 2026-07-03 |

**In-product workaround for the probe**: exclusion (unlike overrides) *does* reach the parquet
writer — excluding `Số gọi`/`Số nhận` at the Metadata step lets FM2 commit, at the cost of
losing those columns. If the report needs them, F1+F2 block the month-1 pass for FM2 and are
the evidence-ranked top finding so far.

_Fix home: F1+F2 are one round candidate (commit path honors overrides + coercion failure →
typed 422 naming column/cells); F3 is a dev-infra/error-envelope candidate; F4 a sweep-job
tweak. Ranking against ⑥/②/UI-batch happens at Synthesize with the rest of the probe._

**2026-07-03 — month-N refresh probe, second dataset family.** Files (user-added):
`tmp/test-data/CRM Full lead_to 31.12.2024.xlsx` (sheet named `Data` with a trailing space,
55,003 rows) and
`CRM Full lead 2025 -12.4.26.xlsx` (sheet `Data 12.4`, 60,065 rows) — two cumulative snapshots
of ONE CRM lead database, identical 39 columns. This is the real "in case we do have overlap"
case the call-logs (FM1–3, disjoint months, 0 overlap) don't exercise.

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F5 | **High (correctness)** | Overlapping re-exports cannot be reconciled — and `UNION` cannot do it. The two snapshots share **6,960 phone values** (the overlapping keys — NOT necessarily 6,960 leads, since phone is not a lead identity per F6); of those phone values, **roughly half changed** their call-status between snapshots. The exact count is method-sensitive *precisely because phone is not a unique key* (F6): first-row-per-phone = 3,308 (48%), last-row = 3,425 (49%), status-set-differs = 3,881 (56%). Under EVERY policy ~half changed — the finding is robust to the counting choice even though a single percentage is not. So the rows are NOT identical → `UNION ALL` double-lists them and `UNION DISTINCT` still keeps both (they differ). Dedup here is record reconciliation, not set arithmetic: it needs an **identity key** + a **conflict/precedence rule** (newest snapshot wins). No step in today's vocabulary (`aggregate`/`top_n`/`derive`/`filter`/`sort`/`select`, R120–R141) expresses row-level "keep latest per key". This is the concrete case behind **dim-spot ⑥**, upgraded from "re-pointing chore" to **correctness risk without merge-on-key**. | agent measure over both `Data` sheets: A∩B on `SỐ ĐIỆN THOẠI` = 6,960; changed `TRẠNG THÁI CUỘC GỌI` per policy = first-row 3,308 / last-row 3,425 / set-differs 3,881 of 6,960; step kinds in `workspace/apps/backend/app/models/common.py:250-381` |
| F6 | **High (domain semantics)** | The identity key is a domain decision the product cannot infer. Phone is NOT unique within a single file — the source's own `TRÙNG` ("duplicate") column counts 1,2,3…8+ occurrences per phone (35,003 rows =1, tail out past 8). "One row per lead" is undefined until a human declares what a lead IS (phone? phone+creation-date? phone+car?). The mechanism (pick key col[s] + precedence col, latest-wins) is generic; the *choice* is not → a natural **#2 AI-loop** moment (agent proposes key, human verifies meaning). Ties to the "domain semantics is the wall no catalog covers" doctrine. | `TRÙNG` value_counts on `Data 12.4`; 16,375 in-file duplicate-phone rows in B |
| F5×F2 | interaction | Merge-on-key silently breaks if the key column's dtype drifts across exports (F2). Both CRM files happen to store phone as `int64`, but a future export with a text phone (leading zero) would land `VARCHAR` → the SAME phone value fails to match its own prior row → **false non-overlap**, dedup silently misses. F2 must be fixed before/with any merge-on-key. | phone dtype `int64` in both files today; F2 proves dtype is accidental |

**2026-07-03 — wide-table readability (surfaced while viewing the 39-col CRM dataset).**

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F7 | **Medium (UI/UX + model)** | Wide tables are unreadable in the dataset row view — `PagedRowsView` renders ALL columns in one horizontal scroll; no show/hide. User proposal: a **column-visibility flag at the metadata level** (`{name, dtype, hidden?}`), editable after upload, honored as the DEFAULT by row-preview surfaces so "we can show more" of what matters. This is the *correct* home for visibility specifically: unlike dtype (F2, which wrongly stops at metadata), visibility SHOULD stay metadata-only — a view hint must never touch stored parquet, so the presentation/compute doctrine is satisfied, not violated. Two NEW capabilities implied: (a) a `hidden` view-hint on column metadata; (b) **post-upload column-metadata edit** (a `PATCH`), which doesn't exist today (rename is dataset-name only; column overrides are upload-time). Open design Q for the round: "default for WHOM" — scope the hint to row-preview surfaces as an *overridable default*, NOT a hard projection, so query-builder / join-key pickers still see all columns. Complementary to the existing compute-level narrowing (R141 `select` step); this is the presentation-level default, not a substitute. | `workspace/apps/builder/src/features/data-management/_shared/PagedRowsView.tsx:141-175` renders every `dataset.columns`; `Column` model = `{name,dtype}` (`workspace/apps/backend/app/models/common.py`); no column-level `PATCH` in `workspace/apps/backend/app/routers/datasets.py` |

**2026-07-03 — multiple tables in one sheet (surfaced parsing `Master`).**

The `Master` sheet is not one table — it holds FIVE side-by-side blocks: `Nhân viên` employee
roster (A:B), `Hot line` extension→agent map (E:F), `Test Data` (H:J), `Weekday` EN/VI lookup
(L:M), + a stray "Tuần hiện tại" scalar. The earlier `A4:F11` grabbed two of them mashed
together (source of the `Unnamed: 2/3` columns). The `Hot line` block (`Số Ext`→`TSA Name`) is
the actual join dimension the call-log report needs (Extension→agent) — so clean extraction is
on the report's critical path, not cosmetic.

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F8 | **Medium (UX gap, backend ready)** | Extracting N tables from one sheet forces N re-uploads of the same file — but ONLY because the wizard blocks it; the **backend already supports multiple ranges per sheet in a single batch**. The fix is mostly front-end: let one selected sheet yield several named ranges → several datasets. The richer, later option is auto-detect table blocks (empty-row/col gaps) and propose them — a natural **#2 AI-loop** "agent proposes the tables, human verifies" upsell. | `POST /uploads/{tmp}/parse` with two `sheet:"Master"` items (ranges `A4:B8`, `E4:F12`) → two clean tables `[ID,Tên]`/`[Số Ext,TSA Name]`, no error; wizard `workspace/apps/builder/src/features/data-management/datasets/upload/state.ts` models `selectedSheets: string[]` keyed by name + one `parseOptions` per sheet → 1-sheet-1-dataset |

**2026-07-03 — month-2 refresh of the SAME dataset (Jan→Feb): settings reuse + drift detect.**

The probe's core scenario. NOTE: the three call-log Worksheets are schema-STABLE (9 identical
cols, same order across FM1/2/3) and the two CRM `Data` sheets share 39 identical cols — so this
data doesn't drift naturally; these findings are about the missing CAPABILITY, which the
protocol explicitly meant to poke.

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F9 | **High (treadmill)** | No reuse of a prior upload's settings. The wizard starts every upload from `INITIAL_WIZARD_STATE` — no template / profile / prefill / remembered range·overrides·exclusions·name. Re-uploading "Feb of dataset X" means re-configuring everything by hand, every month = the report-maintenance treadmill in its purest form. A reserved-but-unbuilt hook exists: `target_dataset_id` "reserved for append-mode (R∞)" (422 today). | zero `template\|profile\|prefill\|remember\|localStorage` hits in `workspace/apps/builder/src/features/data-management/datasets/upload/`; `workspace/apps/backend/app/routers/datasets.py:164-167` rejects `target_dataset_id` |
| F10 | **High (correctness)** | No schema-drift / conflict detection at upload. Nothing compares a new export against the prior dataset's columns; added/dropped/renamed/dtype-changed columns pass silently, and a later union (F5) NULL-fills the drift with no warning. Drift detection DOES exist — but at the query layer (R70/R71 → 409-stale when a saved query's dataset columns move), the wrong layer for catching it at ingest. | no `schema-compare\|drift\|conflict` at upload; query-time drift only in `workspace/apps/backend/app/query_engine.py` (R70/R71) |

**⑥ now has a full, evidenced spec** (the probe's chartered output). "Survive month 2" =
three parts, all evidenced here: **schema reconcile** (F10 — added/dropped/renamed/dtype) +
**settings carry-forward** (F9 — reuse prior metadata) + **row merge-on-key** (F5/F6 —
overlap/precedence). Two existing scaffolds de-risk the build: the reserved `target_dataset_id`
API shape, and the query-layer drift pattern to mirror at ingest. This is the leading R143 pull.

**2026-07-03 — stages 2–4 walked (agent-driven, per cold-review): FM1 report built end-to-end.**
Join (Worksheet.Extension → Master.`Số Ext`, left) → aggregate (calls per agent, count +
count_distinct) → dashboard `dsh_b41da51f` with bar + table widgets — **renders with real
data**. The loop closes for FM1 *except the time axis*. Join-key reality: 97.2% of 5,047 calls
match the Master map; the 139 unmatched (internal extensions `683 - NV BT BH Dien thoai`,
`682 - NV tong dai`, raw phone numbers) surface honestly as a `(blank)` row under the left
join — inner join would have silently dropped them.

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F11 | **High — ② CONFIRMED by walking** | THE report's time axis is inexpressible. A weekly/monthly call report needs calls-per-agent-per-WEEK/DAY; the two available moves both fail: (a) aggregate with `Ngày gọi` as dimension → **5,015 groups** (one per timestamp string — useless); (b) `derive` a bucket from the date → rejected, derive is numeric-only (`+ - * /`). Two-layer gap: no date-bucket step vocabulary AND `Ngày gọi` landed dtype `string` at ingest (dd-mm-yyyy hh:mm:ss), so even a future `date_trunc` needs date-typed ingest (F2-family) first. ② upgraded from brainstorm-rated to **probe-confirmed: the only missing piece between today's product and THE named report ("Weekly - Report Call")**. | preview `dimensions:["Ngày gọi"]` → `total: 5015`; derive on string → `query_stale` 422; `Ngày gọi` dtype string in `columns_json` of `ds_2d436084` |
| F12 | Low (modeling UX) | Relationship cardinality vocabulary is `one_to_one`/`one_to_many`/`many_to_many` — no `many_to_one`, so the most common analytics join (fact→dimension) has no correct label; probe used `many_to_many` untruthfully to proceed. | `POST /workspaces/{id}/queries` 422 enum; created `qr_fe4cf56e` with `many_to_many` |
| F13 | Low (diagnosability, F3-family) | Dashboard load fires two silent 422s in the console while rendering succeeds — errors invisible unless devtools open. | headless console on `dsh_b41da51f` load |

**Probe epistemics (2026-07-03, pre-Synthesize).** The findings' *defects* are code-anchored
product facts (absences/behaviors in the shipped code) — they reproduce on any data. The
example files supply *illustration*, not frequency: magnitudes (6,960 overlap, 5 tables in
`Master`, 39 cols) are properties of THESE files, and whether an issue fires at all is a usage
fact the examples can't settle (the call-logs FM1–3 do NOT overlap; the CRM snapshots DO).
Synthesize therefore ranks by **structural severity** (silent-corruption ≥ loud-failure ≥
chore, regardless of firing rate) + **by-construction frequency** (F9 fires on every refresh
by definition; F1 only when an export has a mixed-type column — flagged "conditional,
real-frequency unknown"), NOT by example counts.

_Round-shaping (candidate, NOT locked — the bundle-vs-split call is the Synthesize step's job):_

- **⑥ refresh** (F5+F6+F9+F10) is the leading R143 pull and a multi-round THEME —
  "survive month 2" = schema reconcile (F10) + settings carry-forward (F9) + row merge-on-key
  (F5/F6). Likely split: [refresh mode via `target_dataset_id` + settings reuse (F9)] →
  [schema-drift gate (F10)] → [row merge-on-key + precedence (F5/F6)] → [optional AI-propose
  key/table]. Split by revert seam per [[round-bundling-and-revert-seams]]; F5×F2 forces F2 to
  ride in front of it.
- **F1+F2** (commit honors overrides + typed coercion error) — one thin round; unblocks ⑥'s
  key-dtype dependency, so a natural FIRST pull.
- **F3** (error envelope / dev logging), **F4** (temp sweep) — small, batch-able together or
  with the UI-batch round per [[batch-ui-bugs-into-one-round]].
- **F7** (wide-table show/hide) — splits cleanly: a transient FE column-picker is pure UI
  (fits the UI-batch round now); the *persisted metadata default + post-upload column PATCH* is
  a thin C+B slice on the dataset model (own round, or rides the ⑥ dataset-model work since
  both touch column metadata). Design-gate the "default for whom" scope before building.
- **F8** (multi-table per sheet) — mostly-FE wizard change (one sheet → N named ranges);
  backend already accepts it, so a cheap high-value win. Groups with upload-wizard work (NOT
  the UI-batch — it touches wizard state model). Auto-detect blocks is a separate later #2 round.
- Final order (F1+F2 → ⑥ theme → ② date_trunc → UI-batch, or a re-rank) is decided at
  Synthesize against severity × monthly-frequency, then handed to R143.

## Check

- [x] Both passes executed and logged (month-1 build + month-2 refresh simulation).
      *(2026-07-03: month-1 = DONE — upload (human) + join/shape/dashboard (agent,
      `dsh_b41da51f`); month-2 refresh = capability-analyzed (F5/F6/F9/F10), in-product run
      **written off with human sign-off** per the findings doc — code-verified absences, a run
      would demo, not discover.)*
- [x] Friction backlog is evidence-linked (each entry names what was attempted and observed).
      *(F1–F13 + F5×F2; all paths verified to resolve; hardened by 2 human review passes +
      cold-review 2026-07-03.)*
- [ ] ~~R140 UI/UX issues enumerated and folded in~~ *(NOT enumerated this round — the human
      didn't supply the list before close; the approved findings doc reserves its slot at
      rank 5 (UI-batch). CARRIED, with sign-off, to the UI-batch round's open — deferred
      explicitly, not silently dropped. Second carry: noted at Round_140.md:67 first.)*
- [x] Findings doc signed off; R143 pull named.
      *([2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md)
      — **R143 = F1+F2**; human "approved" 2026-07-03.)*

## Act

**Learnings:**

- **Probe-before-theme validated again (3rd time: R109, R119, R142).** The pre-probe assumption
  ranked ⑥ first and ② by brainstorm rating; walking the loop flipped the frame — ② blocks
  month 1, ⑥ blocks month 2 — and surfaced the actual first pull (F1+F2) that NO pre-probe
  argument had ranked at all. Evidence reordered everything; argument had ordered it wrong.
- **Rank only after walking every stage once** (cold-review catch): a probe that walks one
  surface deep ranks by coverage, not reality — the FM1 stages-2-4 walk (hours) changed the
  R143 pull. Generalizes to any future probe.
- **Overlap is reconciliation, not set arithmetic**: union (ALL or DISTINCT) cannot dedup
  changed rows; it takes an identity key + precedence rule, and the KEY is a domain decision
  (the `TRÙNG` lesson) — a #2 AI-loop moment, per the domain-semantics-wall doctrine.
- **Probe epistemics pattern**: separate code-anchored facts (reproduce on any data) from
  example illustration (magnitudes, whether an issue fires); rank by structural severity ×
  by-construction frequency. Reusable for every future dogfood round.

**Promotions:** memory `export-parked-probe-before-theme` updated with the probe outcome
(② month-1 / ⑥ month-2 / R143 = F1+F2). No new shared doctrine — the round *validated*
existing ones (probe-the-producer, domain-semantics wall, batch-UI-bugs).

**Prune check:** probe artifacts `qr_fe4cf56e` + `dsh_b41da51f` KEPT deliberately — they are
the live repro/verification fixtures for R143 (F1+F2) and ② (F11). `review.md` (repo root) is
the human's session scratch — flagged for the human to delete or move. Scratch repro scripts
lived in the session scratchpad (auto-cleaned, nothing to prune in-repo).

## Feeds into → Round_143

**RESOLVED (signed off 2026-07-03): R143 = F1+F2** — commit path honors dtype overrides;
coercion failure → typed 422 naming column/cells. Order behind it:
**② date-bucketing (F11) → ⑥ refresh theme (F9/F10 → F5/F6, multi-round) → F8 → UI-batch
(F7/F3/F4/F12/F13 + carried R140 list)**; ④ export stays parked. Full ranking + rationale:
[2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md).
