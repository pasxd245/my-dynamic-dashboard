# Round 148: design-sync the datasets upload corpus to code (upload.md + datasets.md)

**Status**: Complete — human-approved (2026-07-06)
**Date started**: 2026-07-06
**Date completed**: 2026-07-06
**Type**: Design-sync / hygiene round (Track 2 — doc↔code truth). No product code change.

## Goal

**Inherits from ← [Round_147](Round_147.md)** — R147's "Feeds into" handed F8 to the next round;
opening F8 surfaced that its design corpus had drifted, so this round inserts the sync gate
**before** F8 (which moves to [Round_149](Round_149.md)).

**Re-scoped from the F8 open** (2026-07-06, human-directed): opening the F8 multi-range round
triggered a design-gate pre-flight `design-sync --check` on the two docs F8 designs on — and both
came back **OUT OF SYNC**, with upload.md drifted in exactly the F8-load-bearing sections (wizard
state machine, per-dataset state keying, §Backend endpoint shape / batch wire). Designing F8 on a
drifted doc would mean specifying against a phantom (a `UploadDraft` type that doesn't exist, a
5-step machine that's really 6, a 409/pre-parsed-parquet commit model that was never built).

Per the `design-docs-are-source-code` + `round-bundling-&-revert-seams` lessons, the human's call
is to make **the sync its own round** rather than smuggle it into F8's D phase: a 12-finding
reconciliation is a distinct concern with its own gate (`design:lint`), and keeping it separate
means a slip in the sync can't force discarding F8 design work (and vice versa). **F8 moves to
[Round_149](Round_149.md).**

This round reconciles the two `--check`-confirmed-drifted docs to the code (the source of truth),
compacts out any ledger, repairs links, and clears the OUT-OF-SYNC markers. After it, upload.md +
datasets.md describe the app as actually built, and R149 designs F8 on truth.

_Track: 2 (agent-method — doc↔code sync, within the [R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md);
artifact-only, no system-building). Pulled by: the F8 design-gate pre-flight
([datasets-R148.md](../../tmp/design-sync/datasets-R148.md)) — a Track-1 round (R149 F8) cannot be
designed on the drifted upload.md. This is the `design-sync` skill's step-3 preventive trigger
firing exactly as intended._

## Scope

- **In**: full `design-sync` (rewrite mode) of the two docs `--check` confirmed drifted —
  [upload.md](../../design/data-management/datasets/upload.md) (12 findings) +
  [datasets.md](../../design/data-management/datasets/datasets.md) (2 findings). Reconcile each
  claim to code, compact the ledger, repair links, clear both markers.
- **Out (named)**: the other 3 datasets-domain docs (advanced-query, dataset-detail,
  dataset-filters) were **not** `--check`ed and are **not** synced this round — no claim about
  their state; they keep no marker. A future hygiene pass (or their next build round's pre-flight)
  covers them. Scoping to the evidence-confirmed-drifted docs is the brake (don't expand a sync
  beyond what a pull surfaced).
- **Out**: any product code change. This is a doc-truth round; the code is the truth and is not
  edited. If a finding turns out to be a genuine *code* bug (not just doc drift), flag it and stop
  — don't fix code under a sync round.

## Plan

- [x] `design-sync --check` (detection) — done; report
      [datasets-R148.md](../../tmp/design-sync/datasets-R148.md); both docs stamped. (See Do.)
- [ ] **Reconcile upload.md** to the CODE TRUTH map (findings 1–12):
      - F8-load-bearing (1–5, 9): state machine gains the refresh Drift step (6 steps); state-keying
        section replaces the phantom `UploadDraft` with `WizardState` + `sheets: Record<sheetKey,
        SheetState>` incl. the `CSV_SHEET_KEY=""` sentinel; primary wire snippet gains
        `target_dataset_id?`/`merge_key?`; §Backend endpoint shape gains the parse-422 net + the
        merge-wrapper 201 oneOf; §F5×F2 + acceptance #3 repointed from the Drift step to Confirm.
      - §Backend-endpoint-shape debt (6, 7, 8, 10): delete the never-built 409/pre-parsed-parquet
        model (commit re-parses from `original.<ext>`); /parse writes nothing (returns inline);
        name bound = 120; `POST /uploads` = 200 with `TempUploadCsv/Excel`, form field `sourceFormat`.
      - stale counts/pointers (11, 12): step counts 4/5 (create) matching the intro; drop the
        "merge deferred to R146" line (shipped R147).
      - Compact: drop round-stamps / test counts / as-built deltas per the keep/delete boundary;
        keep living rationale, de-attributed.
- [ ] **Reconcile datasets.md** (findings 1–2): remove the drop-zone empty-state / upload-modal
      spec (it's a plain AntD `<Empty>` → full-page wizard); fix the migration list
      (`0001_baseline`, `0002_dashboards`, `0003_workflows`).
- [ ] **Verify the mermaid state-machine diagram** in upload.md is synced (states + the refresh
      arm + error-branch labels are code-owned facts, not just prose).
- [ ] **Links + gate**: `markdown-check-link` (repoint any moved anchors); `pnpm design:lint` 0,
      `pnpm design:tokens` 0, `npx markdownlint-cli2` 0.
- [ ] **Clear the OUT-OF-SYNC markers** (banner + sentinel) from both docs — a synced doc carries
      no marker; its absence is the in-sync signal.
- [ ] **Spot-check** the highest-risk current-state claim per doc against code once more.

## Risks / unknowns

- **Reconciliation error** — the sync could introduce a *new* wrong claim. Mitigation: the CODE
  TRUTH map (report) cites file:line; spot-check the highest-risk claim per doc after rewrite.
- **Scope creep into the other 3 docs** — tempting to "sync the whole domain." Held out by scope
  above; they weren't `--check`ed, so syncing them would be un-evidenced work. Named trigger:
  their next build-round pre-flight.
- **A finding is a code bug, not doc drift** — if reconciling reveals the *code* is wrong (not the
  doc), that's a product finding for a real round, not a silent doc-match. Flag and stop.

## Do

### Design-gate pre-flight — `design-sync --check` (2026-07-06)

Ran the detection pass on the two docs the (then-R148, now-R149) F8 round designs on, before
drafting the D-spec (skill step 3, preventive; per the `design-docs-are-source-code` lesson).
Report: [datasets-R148.md](../../tmp/design-sync/datasets-R148.md). Both docs **stamped OUT OF
SYNC**.

- **upload.md — DRIFTED (12 claims).** F8-load-bearing drift: the wizard **state machine omits
  the refresh Drift step** (6 steps, not 5); **state keying** doc names a non-existent
  `UploadDraft` type and misses the `CSV_SHEET_KEY=""` sentinel (`state.ts` reality =
  `WizardState` + `sheets: Record<sheetKey, SheetState>` — the exact keying F8's N-units-per-sheet
  must extend); the **§Backend endpoint shape** cluster is stale (describes a 409/pre-parsed-parquet
  commit model that was never built — commit re-parses from `original.<ext>`; omits the R147 parse-422
  net, the merge-wrapper 201 oneOf, and `target_dataset_id`/`merge_key` on the primary wire snippet);
  the R147 key-dtype guard deviation is half-reconciled (says Confirm in the note, still says Drift
  step in §F5×F2 + acceptance). Spot-checked against code — confirmed.
- **datasets.md — DRIFTED (2 claims, both incidental to F8).** Refresh-affordance content is
  accurate; drift is the removed drop-zone empty state + stale migration list.

This detection pass is now this round's own step-1. Human directed making the full sync its own
round (R148) and moving F8 → R149 ("full sync as 1 round 148 → move current r148 → r149").

### Reconcile — both docs synced to code (2026-07-06)

- **upload.md — all 12 findings reconciled** (delegated reconcile against the code-truth map;
  spot-checked the F8-load-bearing sections myself). F8-load-bearing: state machine now shows the
  refresh-only Drift step (create 4/5, refresh 5/6); Surfaces table + keying prose use the real
  `WizardState` + `sheets: Record<string, SheetState>` (Excel by sheet name, CSV by
  `CSV_SHEET_KEY=""`); primary wire snippet gains `target_dataset_id?`/`merge_key?` (refresh/merge-only);
  §Backend endpoint shape gains the commit-time `parse_failed` 422 + the merge-wrapper 201 oneOf;
  §F5×F2 + acceptance #3 repointed from the Drift step to Confirm. §Backend-endpoint-shape debt
  deleted: the never-built 409/pre-parsed-parquet commit model (commit re-parses from
  `original.<ext>`; real 409s = `unknown_column`, `name_taken`), /parse writes nothing (returns
  inline), name bound 120, `POST /uploads` = 200 with `TempUploadCsv/Excel` + form field
  `sourceFormat`. Stale counts/pointers fixed (4/5 steps; merge shipped R147 not "deferred to R146").
  The reconcile also caught 3 uncited duplicates of the same false claims (acceptance C8 stale
  1–80 flag, acceptance C9 mismatch-409, §Parse-time-decision parquet-write timing) — fixed.
- **datasets.md — both findings reconciled**: the removed drop-zone/upload-modal empty state →
  the real AntD `<Empty>` + `[+ Upload]` CTA → full-page wizard (Inbox icon zero-state / Table icon
  filtered-state), across Surfaces table, boundary, both ASCII states, token map, acceptance #6,
  scope boundary, and the upload cross-ref; migration list → `0001_baseline`, `0002_dashboards`,
  `0003_workflows`.
- **Markers cleared** on both docs (a synced doc carries none). No code touched — no finding was a
  code bug; all were doc drift.

**Gates:** `design:lint` 0 · `design:tokens` 0 · `plan:lint` 0 · `md:lint` 0 · `check:links` clean.

## Check

- [x] upload.md: all 12 findings reconciled; F8-load-bearing sections (state machine, keying,
      §Backend endpoint shape) match code; ledger compacted; marker cleared. _+3 uncited dup
      claims also fixed._
- [x] datasets.md: both findings reconciled; marker cleared.
- [x] Highest-risk claim per doc spot-checked against code post-rewrite. _upload.md state machine
      + keying (§46–54, §79, §323–325, §491–521) verified vs `state.ts`; datasets.md empty state
      vs `DatasetsPage.tsx:244-266`._
- [x] `design:lint` 0 · `design:tokens` 0 · `markdownlint-cli2` 0 · `markdown-check-link` 0.
      _(+ `plan:lint` 0.)_
- [x] No product code changed; any code-bug finding flagged separately. _None — all 14 findings
      were doc drift, no code bug._

## Act

**Learnings:**

1. **A design-gate pre-flight `--check` earned its round.** Opening F8 and running `design-sync
   --check` on the doc it would design on caught that upload.md's state-machine, state-keying, and
   §Backend-endpoint-shape sections were all drifted — the F8 D-spec would have specified against a
   phantom `UploadDraft` type and a never-built 409 model. This is the skill's step-3 preventive
   trigger doing exactly its job; the value was concrete enough that the human split it into its own
   round rather than fold it into F8's D phase.
2. **Drift clusters where a section is shared across rounds but owned by none.** The worst cluster
   (§Backend endpoint shape — a 409/pre-parsed-parquet commit model that was never built) survived
   because R143/R145/R147 each reconciled their *own* new sections and left the shared endpoint-shape
   section untouched. The `design-docs-are-source-code` convention says amend-in-place every round —
   the gap is the *shared* section no single round feels ownership of. (Capture only if it recurs —
   an instance of the established convention, not a new lesson.)

**Promotions:** none. The doctrine (`design-docs-are-source-code`, `d-gate-artifact-in-design-corpus`)
already exists; this round is an application of it, not a new lesson.

**Prune check:** nothing added to the agent OS. This round *removed* stale doc content (net
reduction) and cleared two drift markers. No new skill/process/mechanism. The `design-sync` skill
earned its place again (it found real drift a build round would have tripped on).

## Feeds into → Round_149 (F8 multi-range wizard)

[Round_149](Round_149.md) = **F8, one sheet → N named ranges** (the round this sync unblocks).
Slice locked at the F8 open (2026-07-06): **N ranges within a single sheet · typed A1 ·
new-datasets-only, refresh untouched.** R149's D-gate designs the multi-range spec onto the
now-current-state upload.md. **Carried**: R145 slice 1b (drift blast-radius preview) +
AI-propose-key (parked). After F8: the UI-batch round (F7/F3/F4/F12/F13 + R140 list).
