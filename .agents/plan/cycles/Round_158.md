# Round 158: provenance×refresh hardening — computed-column-in-metadata

**Status**: **COMPLETE** — 2026-07-11 (Integration signed off by the human: datasets refresh/drift verified in-app)
**Date started**: 2026-07-09
**Date completed**: 2026-07-11
**Flow**: **DCFBI** (0/5 fired — no-UI/refactor round) — set at the Design gate via flow-selector;
recorded in the Do log. **C skipped** (no wire/contract change; pointer is BE-internal in `commitSettings`).
**Design source**: [`.agents/design/data-management/datasets/upload.md`](../../design/data-management/datasets/upload.md)
§ Provenance column (R156) + § Refresh — this round MODIFIES both (provenance recognition moves from a
magic name to a metadata pointer; drift diff excludes computed columns) → a `design-sync --check`
pre-flight is the first D-gate step (R148 lesson).

## Goal

**Inherits from ← [Round_157](Round_157.md)** (dogfood: append+provenance core verified; surfaced the
provenance×refresh seam) and **← [Round_156](Round_156.md)** (provenance column shipped, name-only).

Fix the **provenance×refresh seam** R157 confirmed, by implementing the design direction the human
chose there: **model the provenance column as a COMPUTED column whose spec is recorded in
`commitSettings` metadata** (recognition by registry pointer, not the magic string `Source.Name`).

The bug being fixed — **[F-drift-provenance-phantom]** (R157, CONFIRMED): every refresh of a
provenanced dataset falsely lists `Source.Name` under the Drift step's "removed" columns
(`refreshBaseline = target.columns` carries the committed provenance col; the incoming file never does;
`computeSchemaDrift`'s `removed = baseline.filter(c => !incoming.has(c.name))`
[state.ts:682](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts#L682)
therefore always flags it). Spurious (commit re-injects it) but erodes trust in the drift gate every
refresh.

_Track: 1 (product — harden the accumulation loop's refresh interaction so the drift gate is truthful).
Pulled by: R157 dogfood — [F-drift-provenance-phantom] CONFIRMED + human-chosen design direction._

## The chosen design (from R157, human 2026-07-09) — three parts

1. **Metadata registry, not name-matching.** `commitSettings` (persisted in source.json by
   `_commit_settings_dict` [datasets.py:342](../../../workspace/apps/backend/app/routers/datasets.py#L342))
   records WHICH column is the computed provenance one — a pointer + "value = source filename".
   Recognition reads the pointer, not the string `Source.Name`. **Keeps the `Column` wire model
   unchanged** → sidesteps the R152 widen-shared-model / `null`-on-bystander trap
   ([[widening-shared-wire-model-omit-serializer]]) — the reason this beats a structural flag on `Column`.
2. **Recompute on refresh.** The computed column isn't part of the incoming file's schema, so the rule:
   **drift compares SOURCE columns only; the computed column is excluded from both sides and re-applied
   after the diff.** Principled fix for [F-drift-provenance-phantom], not a special-case.
3. **Collision → auto-suffix.** `Source.Name` → `Source.Name1` (de-dup loop → `…2`), so provenance
   always exists and a user's same-named column is never clobbered. Supersedes R156's collision-SKIP
   (user-column-wins → provenance silently absent). Caveat: in the Power-Query case (incoming file
   already has `Source.Name` = source filename) this yields a mildly redundant second column — harmless
   (hide/drop one); auto-suffix is the safe default since name alone can't tell PQ-provenance from a
   coincidental user column.

**SCOPE BRAKE (R157, carried):** record ONLY provenance in metadata now (a single pointer) — do NOT
build a general "computed columns" engine until a second computed-at-ingest column pulls it (Evolution
Rule). This round is a provenance-only pointer.

## D-gate open questions (to resolve at D)

1. **`design-sync --check` pre-flight** on `upload.md` (+ `datasets.md` if it names provenance) — the
   round edits the provenance/refresh sections; per R148, check for drift BEFORE designing on the doc.
   If OUT OF SYNC in a load-bearing section, reconcile first (own slice or fold in).
2. **Where exactly does the pointer live in `commitSettings`, and what is its shape?** Candidate: a
   `computed_columns` (or narrower `provenance`) key = `{name, kind: "source_filename"}`. Decide the
   minimal shape that a future second computed column could extend without a migration, WITHOUT building
   the general engine (scope brake). Is this a values.yaml cross-language contract value, or
   backend-metadata-only with the FE reading it off the refresh-preset response?
3. **FE recognition path.** Today the FE has no provenance constant (backend-only `PROVENANCE_COLUMN`).
   Does the FE learn the computed-column name from the refresh-preset / dataset-detail payload (read the
   pointer), or from a generated constant? The drift-diff exclusion (part 2) needs the FE to know which
   column to exclude — confirm the data path that delivers it.
4. **Backfill / migration for R156-era provenanced datasets.** Existing datasets have a `Source.Name`
   column but NO pointer in their source.json. Does refresh of such a dataset need to synthesize the
   pointer (recognize the legacy name once, then record it), or is name-fallback acceptable for legacy
   only? Decide the compatibility rule.
5. **Flow-selector** (2-of-5) once the above shape is fixed → DCFBI vs DFCFBI. Likely DCFBI (backend +
   drift-diff logic, no new feel-risk UI surface), but the drift-step UX (the false warning
   disappearing) is a human-verifiable interaction → confirm at the selector.

## Plan

- [x] D — `design-sync --check` pre-flight (done, OUT OF SYNC ×2 → reconcile in D rewrite).
- [x] D — decisions locked (Q2/Q3 pointer home · Q4 legacy compat · Q5 flow=DCFBI); see Do log.
- [x] D — provenance-section rewrite drafted in upload.md (reconciles [D1] single-write seam + [D2]
      stale status; adds §Metadata registry, §Drift-interaction-source-only, §Collision→auto-suffix,
      §Legacy synthesize-once; 9-point acceptance). Marker cleared; gates green (markdownlint 0,
      design:lint 0, design:tokens 0). **D SIGNED OFF (human, 2026-07-09)** — computed_columns shape +
      auto-suffix collision default confirmed. B proceeds.
- [x] B — backend: record the `computed_columns` pointer in `commitSettings` at commit; recompute
      provenance on refresh from the pointer; auto-suffix on collision (replace R156's skip);
      legacy-dataset synthesize-by-name-once per Q4. **C (minimal)** — one additive optional
      `computed_columns` field on the refresh-settings-get contract (not the shared model).
- [x] B/F — drift diff excludes the computed column both sides + re-applies after → phantom gone.
- [x] I — human refresh-walk of an already-provenanced dataset: NO false "removed Source.Name"
      warning; provenance still present + correct post-refresh; collision auto-suffix works.
      **Signed off 2026-07-11** (+ folded-in UX riders: name-readonly-on-refresh, [F-metadata-highlight],
      [F-drift-layout], [F-drift-dtype-label]).

## Do

### D-gate pre-flight — `design-sync --check` on upload.md (2026-07-09) — DONE

Scoped to the provenance/refresh/drift claims R158 designs on (not a full 5-doc domain audit).
**Verdict: OUT OF SYNC — 2 claims** (report: `.agents/tmp/design-sync/data-management-datasets-upload.md`;
marker stamped on upload.md):

- **[D1] load-bearing** — §Injection seam ([upload.md:1631](../../design/data-management/datasets/upload.md))
  describes a **post-write DuckDB rewrite**, but shipped code injects provenance **into the single
  parquet write** (`write_csv_to_parquet` / `write_excel_to_parquet` `provenance_value`;
  `_add_provenance_df`) — the exact mechanism R156's ACT lesson reversed. R158's spec must carry the
  real single-write seam, not the frozen design prose.
- **[D2] ledger** — §Provenance status frozen at "Integration walk pending / pytest 379·vitest 314"; R156
  is COMPLETE (25c06b2).
- **Verified accurate (not drift):** backfill, collision=user-wins-skip, hidden+carry-forward,
  boundaries, acceptance. `datasets.md` has NO provenance claim (no Dataset-model field) → the metadata
  pointer lives in `source.json`/`commitSettings`, model doc untouched. `PROVENANCE_COLUMN` is
  backend-only (no FE constant, no values.yaml entry) — confirms Q3's premise.
- **Resolution:** reconcile [D1]+[D2] **inside R158's Design rewrite** of the provenance section (the
  skill's "sync does NOT run during an in-scope round" rule — standalone sync would be double-work).

### D decisions (human, 2026-07-09)

- **Q2/Q3 pointer home = `source.json`/`commitSettings` only, BE-internal (no wire field).** Record
  `computed_columns: [{name, kind:"source_filename"}]` in `commitSettings`. The FE learns the computed
  column's name off the **existing** `GET /datasets/{id}/refresh-preset` response (already returns
  `commitSettings`) and uses it to exclude that column from `computeSchemaDrift` both sides. **No
  contract change → no C phase** (confirms the R157 rationale: dodge the widen-shared-model trap
  [[widening-shared-wire-model-omit-serializer]]).
- **Q4 legacy compat = synthesize the pointer on first refresh.** A pre-R158 provenanced dataset (has
  `Source.Name`, no pointer) is recognized by name ONCE at its next refresh; the pointer is written into
  `commitSettings` that commit; registry-driven thereafter. One-time name-fallback, no migration script.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)) — **no-UI / refactor round** (backend + FE drift-diff logic, no new UI surface; the visible change is a false drift warning disappearing + auto-suffix on collision), so the UX conditions read vacuously → DCFBI by construction:

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | No new state model; the refresh/Drift step states are unchanged — one column is excluded from the existing diff, nothing added. |
| 2. New interaction pattern           | no     | Existing R145/R155 refresh + drift flow; no new pattern (metadata pointer + diff-exclusion are internal). |
| 3. High user-error risk              | no     | The change REMOVES a false warning and auto-suffixes on collision (no user decision); refresh stays atomic (existing dataset intact on failure). |
| 4. Contract depends on unresolved UI | no     | Decided BE-internal (Q2) — pointer in `source.json`/`commitSettings`, no wire/contract change; the schema is writable now. |
| 5. UX confidence below threshold     | no     | No new UX; design human-chosen at R157, shape confirmed 2026-07-09; the one interaction delta is an unambiguous improvement. |

Result: **Flow: DCFBI** (0/5 fired — no-UI round → DCFBI by construction).

### B build (2026-07-09) — gates green

Backend ([datasets.py](../../../workspace/apps/backend/app/routers/datasets.py),
[parquet_writer.py](../../../workspace/apps/backend/app/ingest/parquet_writer.py)):

- **Registry pointer** — `_commit_settings_dict(..., provenance_name)` records
  `computed_columns:[{name,kind:"source_filename"}]` in `commitSettings`; recorded on create AND refresh.
  `_provenance_pointer(cs)` reads it back (recognition by pointer, not the magic name).
- **Auto-suffix collision** — `_resolve_provenance_name(existing)` returns `Source.Name`, else
  `Source.Name1`… `_inject_provenance_col(..., name=)` always injects (no skip). The writer takes a
  `provenance_name` (pre-resolved collision-free); provenance still goes into the SINGLE parquet write.
- **Recompute on refresh** — `_resolve_refresh_provenance(prev_names, prev_cs, incoming_names)` →
  pointer-name (R158) → legacy `Source.Name` by-name (pre-R158, synthesize once) → fresh
  collision-free (pre-R156). Backfill only when newly introduced.
- **Legacy read-time synth** — `GET /refresh-settings` synthesizes the pointer for a legacy dataset
  (has `Source.Name`, no pointer) so the FE excludes it from drift even before the transition commit.
- **C (minimal)** — one additive optional field `computed_columns` on the **refresh-settings response
  contract** ([refresh-settings-get.contract.yaml](../../../workspace/packages/contracts/datasets/refresh-settings-get.contract.yaml)).
  NOT the shared Dataset/Column model → no widen-shared-model/[[widening-shared-wire-model-omit-serializer]]
  risk; no bystander endpoint shares this schema.

Frontend: `RefreshSettings.computed_columns` type; `WizardState.computedColumns` (populated in
`reduceSeedRefresh` from settings); `computeSchemaDrift(baseline, incoming, computed)` excludes the
computed names from BOTH sides → phantom gone; both call sites pass `state.computedColumns`.

Gates: **pytest 383** (create-records-pointer, refresh-recompute, legacy-synth, refresh-collision;
rewrote R156 collision test → auto-suffix), **vitest 317** (+3: two drift-exclusion cases, one
SEED_REFRESH capture), contracts openapi-validity 40, ruff clean, tsc 0, design/md/plan lints 0.

### B addendum (2026-07-09) — refresh-collision edge, found by human probe

Human probed: create `a,b,c,d` → refresh introduces provenance `Source.Name` → **refresh again with a
file that itself has a `Source.Name` column**. Reproduced (verify-live, not just reasoning): the first
cut produced a **duplicate `Source.Name` in `columns_json`** (corrupt schema, silent 201) — my R158
auto-suffix was applied only on the create/fresh path, not the pointer-refresh path (`_inject_provenance_col`
appended unconditionally). Human chose **auto-suffix on refresh too** (extend the create rule). Fix:
`_resolve_refresh_provenance` now returns a `rename=(old,new)` when the incoming file collides with the
established provenance; `merge.py` `_cur_select_sql` gained a `provenance_rename` remap (committed
provenance `Source.Name`→`Source.Name1`; the incoming same-named column becomes user data, NULL for
committed rows); `_carry_forward_hidden(..., ignore=)` stops the old provenance's hidden hint sticking to
the incoming user column. Verified end-to-end: no duplicate, committed history preserved under the
suffixed name, user data intact. Lesson: **a collision guard added on one write path must cover every
write path** (create AND pointer-refresh AND legacy) — reproduce the edge through the real code path.

### I-phase rider (2026-07-11) — [F-refresh-name-noop] editable name on refresh is a no-op

Human found during the Integration walk: the Confirm step renders an **editable** "Dataset name"
`Input` for every unit including refresh, but refresh **pins the name** — `commitRefresh` sends
`state.refreshTargetName` ([DatasetNewPage.tsx:171](../../../workspace/apps/builder/src/features/data-management/datasets/upload/DatasetNewPage.tsx#L171))
and the server ignores `name` on a refresh (target keeps its name; `RefreshPreset.name` = "pinned;
refresh never renames"). So a user could type a new name and see nothing change — the affordance lied.
Pre-existing (not introduced by R158's provenance work); surfaced by the R158 refresh dogfood.

**Fix (small rider, human-approved 2026-07-11):** in `UploadConfirmStep` the name cell renders
read-only `Typography.Text` (pinned target name, `title` = pinned-name hint) when
`state.mode === 'refresh'`, and the required `*` is dropped from the column header in refresh mode; the
editable `Input` stays for create. New i18n key `upload.confirm.namePinnedHint` (EN + VN). Gates:
tsc 0, vitest 317 (refresh-wizard 33 green). _Scope note: a one-file UX-truthfulness rider on the
surface R158 is already dogfooding — not the provenance engine; the provenance-only brake holds._

## Explicitly NOT in this round (R157 UX polish cluster — queued behind, own round or rider)

[F-metadata-reset] (Popconfirm on destructive override-clear) · ~~[F-metadata-highlight]~~ **(FIXED
2026-07-11 rider)** · ~~[F-drift-layout]~~ **(FIXED 2026-07-11 rider)** · [F-drift-blastradius] (stale
"later this round" copy = R145 slice 1b) · [F-append-copy] (additive "adds those rows again" not
"double") · [F-commit-error-opaque] (field-named 422 messages).
See [Round_157](Round_157.md) § Follow-ups. These are cosmetic/diagnosability; the drift phantom is the
one that erodes trust in a gate every refresh → it earns its own round first.

### I-phase riders (2026-07-11) — R157 follow-ups + drift-label clarity, human-found during the walk

All fixed on the surface R158 is dogfooding (human-approved 2026-07-11); tsc 0, vitest 317.

- **[F-metadata-highlight]** — the Metadata step's dtype cell highlighted on `override !== undefined`
  ("an override ENTRY exists"), so on refresh every carried-forward column lit yellow and the user's one
  real change was buried — and it disagreed with the Drift step, which shows only genuine schema changes.
  Fix: gate on `override !== undefined && override.dtype !== row.dtype` ("differs from THIS file's fresh
  detection") in [UploadMetadataStep.tsx:349](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx#L349).
  Now metadata highlights match intent (a change vs what we'd infer now), aligning with the Drift step.
- **[F-drift-layout]** — the Drift step's "Schema changes detected" table right-aligned the type column
  (`align:'right'`), a numeric convention misapplied to a type string → name hugged left, type floated
  right with a wide gap. Fix: drop `align:'right'` (default left) in
  [UploadDriftStep.tsx:150](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadDriftStep.tsx#L150).
- **[F-drift-dtype-label] (NEW, human-found 2026-07-11)** — the type-mismatch row read `datetime → string`,
  which parses as "datetime BECOMES string." It actually means `committed ↔ this file's raw detection`,
  and the carried-forward override (set one step earlier, sent at commit as `column_overrides`) coerces
  the value back — so the SAVED type stays `datetime`. Human chose the light-touch fix (keep the raw
  comparison, clarify copy): arrow `→`→`↔` (a difference, not a becomes), title "Type changes"→"Type
  differences", and the hint now states the dataset keeps its current type unless changed and the new
  file is converted to match (EN+VN i18n only — `upload.drift.dtypeArrow`/`dtypeChangedTitle`/
  `dtypeChangedHint`). _Deferred alternative (NOT taken): make drift compare EFFECTIVE (override-applied)
  dtype so these rows vanish entirely — same phantom-drift class as the provenance fix; revisit if the
  clarified copy still reads as noise._

_Scope note: all are one-file presentation/copy fixes on the refresh/drift surface under Integration —
not the provenance engine; the provenance-only brake holds (same basis as the name-readonly rider)._

**[F-prov-reimport-choice] (NEW — surfaced 2026-07-11 during R158 Integration; own round, DFCFBI-ish).**
A computed provenance column that is EXPORTED and then RE-UPLOADED as the next refresh's source re-enters
as a "real" source column; name-based recognition can't tell it from genuine user data, so the auto-suffix
CLIMBS each cycle (`Source.Name` → `Source.Name1` → `Source.Name2` → …). Verified live: ds_074d6197's
uploaded `calls_clean.csv` header is literally `Source.Name1,month,…` and provenance resolved to
`Source.Name2` — **arithmetically correct** (both lower names occupied), NOT a rule bug, but it reveals
R158 handles only a *coincidental* collision, not the *re-import feedback loop*. Human-chosen direction
(2026-07-11): **DETECT a "provenance-like" incoming column** (matches the dataset's pointer name or the
reserved `Source.Name[<n>]` shape) **and let the user choose** — "this is the source-tracking column"
(fold into provenance, recompute in place, no climb) vs "this is my own data" (keep, current suffix).
New decision point + feel-risk → its own Design gate, not this no-UI round. Also resolves the
name-ambiguity we agreed the pointer/properties is the truth for — by asking instead of guessing.
_Stale-data note: two 07-09 datasets (ds_36cd8ddc, ds_fb5ed89a) carry DUPLICATE `Source.Name` columns —
pre-addendum-fix "first cut" artifacts. **Cleared as safe-to-delete (2026-07-11):** a new regression test
`test_repeated_reimport_collision_never_duplicates` drives create→3× re-import-collision and asserts the
committed schema never duplicates a column — GREEN on current code, so the corruption can't recur; those
two are stale. Delete via the app UI (they are the user's dogfood datasets) during the re-test._

## Risks / unknowns

- The `commitSettings` pointer is a persisted-metadata shape change — pre-R158 source.json files lack it
  (Q4). Get the legacy-compat rule right or refresh of R156-era datasets regresses.
- Auto-suffix changes R156 behavior (skip → suffix): existing datasets with a legit user `Source.Name`
  column now get a `Source.Name1` on next refresh. Confirm that's the intended (safe) direction.

## Check

- [x] Backend recognizes provenance by the `commitSettings.computed_columns` pointer, recorded on
      create + refresh (pytest: create-records-pointer, refresh-recompute-keeps-pointer).
- [x] [F-drift-provenance-phantom] fixed — `computeSchemaDrift` excludes the computed column both sides;
      a real removed source column still surfaces (vitest: two exclusion cases).
- [x] Collision → auto-suffix `Source.Name1`, user column intact, pointer records the suffixed name
      (pytest: rewritten collision test).
- [x] REFRESH collision (incoming file brings `Source.Name` after provenance established) → auto-suffix
      + committed-provenance remap; NO duplicate column (pytest: refresh-collision; human-probed edge).
- [x] Legacy pre-R158 dataset gets the pointer synthesized on read (pytest: legacy-synth) and persisted
      on its next refresh (recompute path).
- [x] REPEATED re-import collision (3× re-upload a file carrying the current provenance name) never
      duplicates a committed column — corruption class can't recur (pytest:
      `test_repeated_reimport_collision_never_duplicates`, added 2026-07-11 Integration probe).
- [x] Gates: pytest 384 · vitest 317 · contracts 40 · ruff/tsc/design/md/plan lints 0.
- [x] **Integration (human, 2026-07-11):** refreshed provenanced datasets in-app → NO phantom "removed
      Source.Name" in the Drift step; provenance present + correct post-refresh; collision auto-suffix
      confirmed. Human verdict: "datasets looks good now." Four UX riders folded in during the walk
      (name-readonly-on-refresh · [F-metadata-highlight] · [F-drift-layout] · [F-drift-dtype-label]).

## Act

Learnings (logged at close 2026-07-11):

1. **`design-sync --check` design-gate pre-flight earned its keep a 2nd time** (first R148): it caught
   R156's design prose (post-write rewrite) had frozen while the code shipped a single-write injection.
   Cheap check, real drift found before designing on stale prose.
2. **A collision guard added on ONE write path must cover EVERY write path** (create AND pointer-refresh
   AND legacy). The human-probed refresh-collision edge (B addendum) reproduced a duplicate `columns_json`
   through the pointer-refresh path my first cut missed — reproduce the edge through the REAL code path,
   don't reason it closed.
3. **Recognition-by-pointer decouples name from identity → the name can be pinned for stability.** Because
   R158 recognizes provenance via `commitSettings.computed_columns`, refresh carries the SAME name forward
   (no reclaim of a freed lower suffix) — dependents referencing the column by name don't break. The name
   only auto-suffixes UP on a genuine incoming collision. (Verified live + resolver trace during the walk.)
4. **Integration surfaces edges design can't** — the human walk found the export→re-import provenance
   feedback loop ([F-prov-reimport-choice], deferred) and four UX-truthfulness gaps on the drift/metadata
   surface (name-readonly, all-yellow highlight, drift type-align, `datetime → string` phantom-ish label).
   The drift-label one echoes the round's own theme: a gate that reads as a change when nothing changes
   erodes trust. Fixed the cheap four as riders; the loop earns its own round.

Promotions: none proposed (no reusable skill/process change; learnings captured in memory rolling log).

## Feeds into →

- **[F-prov-reimport-choice]** (own round, DFCFBI-ish) — detect a provenance-like incoming column and let
  the user choose "source-tracking column" vs "my own data," resolving the export→re-import climb.
- **Remaining R157 UX cluster** — [F-metadata-reset], [F-drift-blastradius], [F-append-copy],
  [F-commit-error-opaque] still queued (see § Explicitly NOT); three cluster items cleared as R158 riders.
