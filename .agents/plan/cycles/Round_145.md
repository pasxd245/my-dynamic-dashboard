# Round 145: Refresh a dataset — settings carry-forward + schema-drift gate (⑥ / F9+F10)

**Status**: Complete — human directed finish (2026-07-04)
**Date started**: 2026-07-04
**Date completed**: 2026-07-04
**Flow**: **DFCFBI (triggers 3, 4, 5)** — set at the Design gate via flow-selector; recorded in
the Do log. Per the `dfcfbi-two-round-split` standing call, this round runs
[D + F1 + design-sync]; [C + B + F2 + Integration] follows.

## Goal

**Inherits from ← [Round_144](Round_144.md) "Feeds into" (signed off 2026-07-04)** — per the
signed-off R142 order, the **⑥ refresh theme** opens (rank 3: "every month-2+ upload, by
definition"; multi-round, split by revert seam). This round is the theme's first slice,
**F9 + F10 only**:

- **F9 — settings carry-forward**: re-uploading a new export of an EXISTING dataset must not
  force re-picking everything. The R144 dogfood made this pain **lived, not predicted**: the
  human re-uploaded the FM family four times in one session, re-choosing sheet, dtype
  overrides, and format each time. A refresh pre-fills the wizard from the dataset's
  committed settings (sheet · parse options · dtype overrides + formats · exclusions).
- **F10 — schema-drift gate**: the incoming file's columns are compared against the
  dataset's committed `columns_json` BEFORE commit; drift (added / removed / renamed
  columns) is surfaced loudly, never silently absorbed (purpose.md #5: version, flag,
  adapt — don't reject normal business drift, don't hide it either).

After this round: month-2 of the loop stops being a from-scratch re-configuration. Row
**merge-on-key / precedence (F5+F6) is explicitly NOT this round** — the lived FM exports
are cumulative (FM2.25 carried 6,692 rows superseding the 5,047-row commit), so this
round's refresh semantics can be **whole-table replace**; overlapping non-cumulative
exports pull the merge round next.

_Track: 1. Pulled by ← [Round_144](Round_144.md) Feeds-into + the signed-off ranking in
[2026-07-03-r142-dogfood-findings](../brainstorms/2026-07-03-r142-dogfood-findings.md)
(rank 3: F9+F10+F5+F6 (⑥) — month-2 blocker) + R144 Act learning #4 (F9 pain lived).
D-gate first per the d-gate-artifact-in-design-corpus lesson._

## Plan

- [ ] **D**: design-corpus touches, signed off before code:
      [upload.md](../../design/data-management/datasets/upload.md) — a **§Refresh** section:
      entry point (the noun-vs-mode question: reuse the wizard against an existing dataset —
      likely via the R15-reserved `target_dataset_id` seam — vs a parallel surface; the
      reuse-not-duplicate discipline
      ([specious-model-lock-in](../../memory/2026-06-13-specious-model-lock-in.md)) says
      reuse), carry-forward scope (sheet · parse options · overrides+formats ·
      exclusions), refresh semantics (**replace** — atomic swap of `original` + parquet +
      `columns_json`, forward-only history), and the drift gate's UX (what blocks vs what
      warns — **domain decision, ask the human**: is a NEW column a warn-and-continue or a
      stop?). [datasets.md](../../design/data-management/datasets/datasets.md) — the Refresh
      affordance on the dataset row/detail + what happens to dependent queries/widgets on
      drift (the existing `query_stale`/`relationship_stale` machinery is the runtime net —
      name it, don't rebuild it).
- [ ] **Candidate rider (decide at D, split if fat)**: the R144 finding-#3 mechanism — a
      "skip rows that exactly repeat the header" parse option (deterministic, zero
      information loss; the real FM export's append seam). It naturally belongs to the same
      ingest-hygiene surface; if D says it fattens the round, it defers with its trigger
      already named.
- [ ] **Flow selector** at D exit; record the table in Do. (Note: a refresh wizard is a
      REUSED surface in a new mode — condition 2 likely reads no; but a drift-gate step may
      be a genuinely new interaction, condition 1/3 may fire. Let the selector decide.)
- [ ] **C**: contract — refresh request shape (probably the batch endpoint's reserved
      `target_dataset_id` graduating from 422-reserved to real), the drift report shape
      (columns added/removed/dtype-changed), error envelopes (reuse `coercion_failed` /
      the 422 families; a drift-block needs its own typed envelope).
- [ ] **B**: settings snapshot read (the dataset already persists what's needed — verify:
      parse options were NOT persisted per-dataset at R15; D must name where carry-forward
      state comes from, likely `source.json` + `columns_json`), drift diff, atomic replace
      (the R143/R144 staged/rollback discipline extends).
- [ ] **F**: wizard in refresh mode (pre-filled steps, drift gate surface); dataset
      row/detail affordance.
- [ ] **I**: i18n en/vi; design-doc sync.
- [ ] Tests: refresh happy path (carry-forward pre-fill == committed settings; replace is
      atomic; dependent query re-runs against new rows) · drift: added column / removed
      column / dtype change each surface per the D decision · refresh with a coercion
      failure → typed 422, dataset UNTOUCHED (atomicity) · the real FM pair (5,047-row
      commit refreshed by the 6,692-row export) as the fixture shape.

## Risks / unknowns

- **Noun-vs-mode** — a parallel "refresh page" would violate the reuse invariant; the
  wizard must be the surface. But the wizard's state machine assumes create-mode; the
  refresh preset must not fork it into two half-duplicated flows. Strict on the skeleton.
- **Where do carry-forward settings live?** R15 never persisted parse options / overrides
  per dataset (`source.json` carries temp_id/sheet/originalName only). D must decide:
  persist the commit settings on the dataset (new metadata, migration-lite) vs re-derive.
  This is the round's likely fat point — split seam if it grows.
- **Drift-gate severity is a domain decision** — block vs warn per drift kind (new column
  vs removed column vs dtype change). Ask the human at D; the `TRÙNG` lesson stands.
- **Replace vs merge boundary** — replace is THIS round (cumulative exports, the lived
  case); merge-on-key/precedence (F5/F6) is the NEXT round. If D discovers replace can't
  serve the real refresh cadence, stop and re-rank rather than absorbing merge.
- **Dependent artifacts on refresh** — saved queries/widgets referencing dropped/renamed
  columns: the run-time stale machinery already flags them; the drift gate should PREVIEW
  that blast radius, not duplicate it.

## Do

### D-gate — domain decisions (human, 2026-07-04)

1. **Drift-gate severity → warn-loud, never block.** All drift (added / removed / dtype-changed)
   surfaces in a "Drift review" acknowledge step + a blast-radius preview of affected
   queries/relationships; the user acknowledges and the refresh proceeds. Rationale:
   purpose.md #5 (adapt, don't reject) + the runtime `query_stale`/`relationship_stale`
   machinery (recomputed on read) is the net; the gate previews the blast radius, it doesn't
   rebuild the net.
2. **Header-skip rider (R144 finding #3) → deferred** with its trigger named (a real file whose
   append seam repeats the header mid-table). Keeps R145 thin (F9 + F10 only), one-feature-per-round.
3. **Carry-forward home → persist a `commitSettings` snapshot on `source.json` (no Alembic
   migration).** Agent decision — build-home per the `design-altitude-vs-build-home` lesson,
   least-mechanism: committed datasets are lossy (parse options / format / exclusions
   discarded after commit; `columns_json` = `{name,dtype}` only), so re-derive can't recover
   the two things the R144 human re-typed most (overrides+formats, parse options). Extend the
   existing per-dataset `source.json` sidecar — zero migration, single-consumer state. Legacy
   pre-R145 datasets get a lossy-pre-fill fallback that self-heals on next refresh.

### D-gate — artifact

Design corpus (the D deliverable, per the `d-gate-artifact-in-design-corpus` lesson):

- [upload.md § Refresh](../../design/data-management/datasets/upload.md#refresh-re-upload-into-an-existing-dataset-r145)
  — the verb: entry (mode-not-page), F9 carry-forward (`commitSettings` on `source.json`),
  F10 drift gate (warn-loud), atomic-replace semantics (`target_dataset_id` → real,
  UPDATE-in-place, existing dataset intact on failure), wire shape, boundaries, acceptance.
- [datasets.md § Refresh affordance](../../design/data-management/datasets/datasets.md#refresh-affordance-r145)
  — placement (row Actions + detail header) + dependent-artifact consequence (stale-on-read,
  no new persisted status).

Both **SIGNED OFF (human, 2026-07-04)** — "good to go". D gate closed.

### F1 — refresh-mode wizard + Drift review (FE feel-review, request-only)

Per the `dfcfbi-f1-precedes-contract` lesson: F1 is
FE state + request-only, **no new wire fields** (MSW `additionalProperties:false` would block a
new response field). Scope: refresh-mode route + reducer preset (lossy-fallback pre-fill from
the existing `GET /datasets/:id`) + the Refresh affordance + a client-side Drift review step
(drift columns computed from the parse response vs the target's committed columns; dependents
blast-radius stubbed — the new BE read + `commitSettings`-backed full carry-forward land at C/B).
F1 hard-stops for human feel-review before C.

**Built (2026-07-04):**

- **Reducer** ([upload/state.ts](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts)):
  `WizardMode` + refresh fields; `SEED_REFRESH` (fixes workspace/source/target, stashes the
  drift baseline + a lossy-fallback preset); `SET_DRIFT_ACK`; the **preset-replay** — the
  seeding parse REPLAYS carry-forward (keyed by column name: survivors keep, vanished drop,
  new inferred) instead of R19's wipe, then clears the preset so a later user re-parse resets
  normally. Extracted `reduceUploadInit`/`reduceParseSuccess`/`reduceSeedRefresh` to hold the
  reducer's cognitive complexity. `wizardSteps` (mode-aware; inserts `drift` before `confirm`);
  `computeSchemaDrift`/`hasSchemaDrift` (pure, client-side F10 diff).
- **Drift step** (new `UploadDriftStep.tsx`): added/removed/dtype-changed groups, blast-radius
  **stub** (the dependents read is C/B), acknowledge gate; warn-loud-never-block.
- **Page** (`DatasetNewPage.tsx`): `:id` → refresh mode, `useDatasetQuery` → `SEED_REFRESH`
  once, refresh breadcrumb/title, drift step in the chain, `canAdvance` drift-ack gate, commit
  **stubbed** in refresh (real UPDATE wire is C).
- **Affordances**: Refresh in the DatasetsPage row menu + DatasetDetailPage actions; source
  step (banner + read-only workspace, source cards hidden) + sheet step (pre-selected note);
  confirm-step replace warning.
- **Routes**: `/data-management/datasets/:id/refresh` + routeMeta title. **i18n** en+vi
  (`upload.refresh.*`, `upload.drift.*`, `upload.steps.drift`, `datasets.refresh`).
- **No wire change** (request-only per the `dfcfbi-f1-precedes-contract` lesson):
  carry-forward is lossy-fallback from the existing `GET /datasets/:id`; drift is computed
  client-side; the `commitSettings` snapshot + drift-preview `dependents` read + real replace
  commit all land at C/B.

**Gates:** `tsc --noEmit` 0 · `vitest` 275/275 (incl. new `tests/refresh-wizard.test.ts` — 9:
SEED_REFRESH, preset-replay hazard, CSV preset, drift compute) · `design:lint` 0 · `plan:lint`
0 · markdownlint + link-check clean.

**F1 signed off (human, 2026-07-04)** — "continue r145" after the value framing (the benefit is
identity/dependency preservation via a stable `ds_` id — delete+re-upload cascades away the
saved queries; refresh keeps them). Feel accepted. Since the F1 feel-gate (the risk the
two-round split guards) passed, **C+B+F2+I fold into R145's completion** rather than spawning a
separate round; merge stays R146.

### Plan decision (C/B, 2026-07-04) — blast-radius fat-seam split 1a/1b

The signed-off F10 flagged the dependent-artifact **blast-radius preview** as the round's fat
point with a 1a/1b seam. **Decision: split.** R145 = **1a** — full replace + faithful
carry-forward + drift columns surfaced + acknowledge. **1b (deferred)** = the pre-commit
preview naming which dependent queries/relationships reference a drifted column (needs a
per-column reference-extraction engine). Safe: the runtime stale net already catches broken
dependents on next open. Trigger for 1b named in [upload.md § Refresh F10](../../design/data-management/datasets/upload.md#f10-schema-drift-gate-surface-loudly-never-silently-absorb).
Carry-forward read path chosen: dedicated **`GET /datasets/{id}/refresh-settings`** (off the
hot detail-get path).

### C/B/F2/I — built (2026-07-04)

- **C (contracts):** [batch-post.contract.yaml](../../../workspace/packages/contracts/datasets/batch-post.contract.yaml)
  — `target_dataset_id` graduated from 422-reserved to real REFRESH (replace; name ignored;
  missing target → 404, not 422). New [refresh-settings-get.contract.yaml](../../../workspace/packages/contracts/datasets/refresh-settings-get.contract.yaml)
  (+`.md`) — `GET /datasets/{id}/refresh-settings` returns the carry-forward snapshot (mirrors a
  commit item's settings shape) or `available:false` for legacy.
  _Build deviation from the signed draft (flagged): `name` stays REQUIRED on the item and is
  ignored on refresh (leaner than a name⊕target XOR schema; the target keeps its name) — intent
  (mutually-exclusive-in-effect) unchanged._
- **B (backend):** `commitSettings` snapshot persisted on `source.json` at EVERY commit (both
  create and refresh); `target_dataset_id` → `_handle_refresh` UPDATE-in-place (same id) atomic
  **directory swap** (old→`.bak`, staging→live) — coercion validated on the staging copy BEFORE
  any swap, so a failure leaves the dataset fully intact; `GET .../refresh-settings` endpoint.
  Shared `_parse_and_target` / `_write_parquet` helpers extracted (create + refresh enforce the
  R143/R144 dtype contract identically; cut `commit_datasets_batch` complexity 60→27).
- **F2 (FE):** `RefreshSettings` type/api/`useRefreshSettingsQuery`; `SEED_REFRESH` seeds the
  preset from the faithful `commitSettings` when available, else the lossy fallback
  (`refreshLegacy` → honest inline note); the refresh commit sends `target_dataset_id` (real,
  UPDATE-in-place) and navigates to the dataset on success; commit button enabled.
- **I:** i18n en+vi (`confirmReplaceBody` reworded off the F1 stub + `legacyNote`); design-sync
  (F9 read-endpoint, F10 1a/1b split); this Do log.

**Gates:** FE `tsc` 0 · `vitest` 277 (incl. 11 refresh-reducer tests) · BE `ruff` clean ·
`pytest` 337 (incl. `tests/test_datasets_refresh.py` — 7: replace-keeps-id, intact-on-coercion,
single-item, unknown-target-404, commitSettings round-trip, refresh-settings 404 + legacy) ·
`design:lint` 0 · `plan:lint` 0 · markdownlint 0 · link-check clean.

**Accepted F2 gap:** no MSW handler / FE integration test for the refresh route yet — the
feel-review runs against the real backend (seed data), and the backend is contract-verified via
`validate_response`. An MSW-backed wizard-in-refresh integration test is the belt-and-suspenders
follow if wanted.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification                                                                                                             |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| 1. >3 independent states/branches    | no     | Reuses the existing wizard state machine; adds one new "Drift review" acknowledge step, not >3 new branches.              |
| 2. New interaction pattern           | no     | Multi-step wizard + confirmation/review already exist (upload wizard, coercion alert); pre-fill + acknowledge not novel.  |
| 3. High user-error risk              | yes    | Whole-table **replace** of an existing dataset (irreversible, forward-only) can break dependent queries/relationships.    |
| 4. Contract depends on unresolved UI | yes    | The drift-preview/`dependents` read shape follows the Drift-review step; blast-radius split (1a/1b) left to Plan.         |
| 5. UX confidence below threshold     | yes    | Design flags the reducer-preset-replay hazard (initial parse must not wipe carry-forward) + unproven drift-review feel.   |

Result: **Flow: DFCFBI (triggers 3, 4, 5)**

## Check

- [x] D signed off before C/B/F (incl. the drift-severity domain decisions + the rider
      decision) — human, 2026-07-04.
- [~] Real FM pair: refresh the 5,047-row dataset with the 6,692-row export — settings
      pre-filled, one commit, dependent weekly-report query returns the wider range.
      _Automated proxy green (replace-keeps-id + rows widen, `test_datasets_refresh`); the real
      FM-file walk is the human feel-review below._
- [x] Drift cases surface per the signed-off D (added / removed / dtype-changed) — columns
      only (dependent blast-radius preview split to 1b, deferred). _`computeSchemaDrift` tests._
- [x] A refresh that fails coercion leaves the existing dataset fully intact.
      _`test_refresh_coercion_failure_leaves_existing_dataset_intact`._
- [x] Backend pytest + ruff green; FE tsc + vitest green.
- [x] **Complete — human directed finish (2026-07-04).** F1 feel-review was signed off earlier
      ("continue r145"). Honest note: the real-FM in-app end-to-end walk was **not separately
      logged** — completion accepted on green gates + backend contract conformance + the F1
      feel-sign-off. Residual risk (a runtime wiring/CORS bug on the new endpoint) is the class
      the in-app walk would catch; flagged, accepted by the human.

## Act

**Learnings:**

- **The benefit of "refresh" is identity, not replace.** The human's F1 challenge ("just
  replace existing one?") surfaced that the value is preserving the dataset's `ds_` id so
  dependent queries/relationships/dashboards survive — delete+re-upload cascades them away
  (`DELETE /datasets/{id}` deletes `queries WHERE source_id`). Replace is the mechanism; the
  saved analytics stack is the point. Framing a feature by its mechanism ("replace") undersold
  it; frame by what it preserves. (Capture only if it recurs — a general "name the value not
  the mechanism" note.)
- **Lossy committed state forced a design choice, cheaply.** Committed datasets discard parse
  options / formats / exclusions, so carry-forward could not be re-derived — the snapshot on
  `source.json` (no migration) was the least-mechanism home. The seam generalizes: when a
  surface needs to "resume" prior choices, persist the choices at commit, don't reconstruct
  them from effects.

**Promotions:** none proposed.

**Prune check:** **DONE** — carried-in `COERCIBLE_DTYPES` vestigial filter (R144 Act) pruned:
`_parse_and_target` now targets every kept column's committed dtype directly (the guard was
always-true once R144 made all six dtypes coercible); the unused import was removed. Also
**consolidated** the create + refresh parse/write into shared `_parse_and_target` /
`_write_parquet` (was duplicated), cutting `commit_datasets_batch` complexity 60→27.

## Feeds into → Round_146 (context-aware label pass)

**Re-rank (human, 2026-07-04):** R146 = a small **context-aware label** round — refine the
refresh feature's user-facing copy per locale + display context (the naming discussion
surfaced VN `Làm mới` reads as *reload*, not *update the data*; → `Cập nhật dữ liệu`). Done now
"before moving far away" while the context is fresh. **The ⑥ merge round slides to R147.**

Then, per the signed-off R142 order: ⑥ round 2 — **F5+F6 merge-on-key / precedence**
(overlapping non-cumulative exports; identity key + precedence are domain decisions) → F8
multi-range wizard → UI-batch (F7/F3/F4/F12/F13 + carried R140 list). **Carried from R145**:
slice **1b** — the drift-gate's dependent-artifact blast-radius *preview* (per-column reference
resolution), deferred at the R145 Plan split; trigger named in the F10 design.
