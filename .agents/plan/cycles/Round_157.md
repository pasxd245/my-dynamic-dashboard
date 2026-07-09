# Round 157: FM1–12 append dogfood — accumulate the real 12-month call logs

**Status**: **OPEN — Planning / D gate**. Goal set at open (sequenced by the human at R156's open:
provenance first, dogfood next). Flow not yet selected (flow-selector runs at D exit).
**Date started**: 2026-07-09
**Flow**: _TBD — set at the D gate via flow-selector._
**Design source**: [`.agents/design/data-management/datasets/upload.md`](../../design/data-management/datasets/upload.md)
§ Refresh append mode + § Provenance column (R156) — this round exercises them, it does not add to them.

## Goal

**Inherits from ← [Round_156](Round_156.md)** (provenance column shipped) and
**← [Round_155](Round_155.md)** (keyless Append shipped). The two capabilities were built so this
walk is possible: append unions periodic exports keep-all (R155), and each row self-labels its origin
month via `Source.Name` (R156).

**The walk (human, sequenced 2026-07-08):** take the real 2025 monthly call logs
(`tmp/test-data/Weekly - Report Call Full FM1..12.25.xlsx`, the `Worksheet` sheet — the payload
probed in R155) and **append FM1 → FM12 into one dataset in a single real pass**, then group a widget
by `Source.Name` to confirm per-month counts. This exercises append *with* provenance in one walk
(each row self-labels its month) rather than walking 12 months twice.

**Why it earns a round (not just a manual check):** R155/R156 gates were green on synthetic fixtures
and a 2-file walk. The flagship payload is 12 disjoint months with genuine within-month dup keys
(memory `2026-07-08-append-mode-call-log-evidence.md`). Driving the whole real corpus through is the
demand-pull probe that either **confirms the accumulation loop end-to-end** or **surfaces the next
gap** (schema drift across months, dtype reconciliation, provenance under 12-way union, widget
GROUP BY at real row counts). The gap it surfaces is the real deliverable.

_Track: 1 (product — dogfood the accumulation loop on the flagship real dataset). Pulled by: R156
open sequencing (human) — exercise append+provenance in one real 12-month walk._

## Plan

- [ ] Probe the FM1–12 `Worksheet` column sets for drift (before the walk).
- [ ] D — `design-sync --check` + flow-selector; decide validation-round vs build-round shape.
- [ ] Walk: append FM1 → FM12 into one dataset; confirm no null-provenance rows.
- [ ] `GROUP BY Source.Name` in a widget → per-month counts match each file's row count; total = Σ.
- [ ] Capture the gap it surfaces (or confirm the loop end-to-end) as the deliverable.

## D-gate open questions (to resolve at D)

1. **Is this a validation round or a build round?** Expected shape: primarily an Integration/dogfood
   walk that may surface a small build. If the 12-month append is clean, the round's product is the
   verified loop + captured evidence (thin/no code). If it breaks, the break defines the build.
2. **Schema drift across FM1–12** — do all 12 months share the `Worksheet` column set, or does
   append's name-based reconciliation (null-fill / cast / drop) fire? Probe before the walk.
3. **What to assert** — per-month row counts via `GROUP BY Source.Name` should match each file's row
   count; total = Σ months; no null-provenance rows.

## Do

_(D gate not yet run. Next: probe the 12 files' schemas, then run `design-sync --check` +
flow-selector at D exit.)_

### FUNCTIONAL findings (append path — R157-CORE / BLOCKING, not polish)

- **[F-append-commit-fail] Append commit fails — two variants; the append loop is blocked.** Found by
  the human 2026-07-09 dogfooding append; symptom = toast "Couldn't commit datasets" +
  "Extra inputs are not permitted · Extra inputs are not permitted" (no field named).
  - **CAUSE NOT YET CONFIRMED — neither variant faithfully reproduced from current code.** (Correction
    2026-07-09: an earlier "reproduced Source.Name 409" claim was retracted — that repro bypassed the
    FE's own guard; see below.)
  - **`Source.Name` 409 is guarded by the FE — NOT a live bug in the normal flow.** `applyPreset`
    ([state.ts:256](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts#L256))
    filters carried-forward overrides AND exclusions to **only columns present in the freshly-parsed
    incoming file**, so the auto-injected `Source.Name` (absent from an incoming FM file) is dropped
    before commit. A hand-built payload that bypasses this filter DOES 409 (`unknown_column:
    Source.Name`), but the real FE won't emit it — UNLESS the incoming file literally contains a
    `Source.Name` column. Residual hardening (low priority): backend could ignore a provenance-column
    entry in `column_overrides` rather than 409.
  - **`Extra inputs ×2` — NOT reproduced; lead hypothesis = a STALE running backend predating R155.**
    Driving create→refresh-settings→multi-append (settings AND lossy paths) never yields it, and NO
    persisted `source.json` carries extra keys. "Extra inputs" = Pydantic `extra=forbid`; the DOUBLED
    message = exactly TWO rejected fields. The FE always sends `refresh_mode` on append (+
    `overlap_check_field` when a date col is picked); a pre-R155 `_BatchItem` has neither → both
    rejected → two identical messages, matching the symptom exactly. **To pin (needed before any
    fix):** (1) restart the backend on current code + retry; (2) read the 422 `detail[].loc` from the
    browser Network tab.
  - **Severity HIGH if real** (blocks the FM1–12 dogfood), but **cause unconfirmed** — do NOT write a
    fix until the `loc` / backend-freshness check identifies the actual rejected fields. No speculative
    code change.

- **[F-drift-provenance-phantom] CONFIRMED R156 × refresh regression: the Drift step falsely reports
  `Source.Name` as a REMOVED column on every refresh of a provenanced dataset.** `refreshBaseline =
  target.columns` includes the committed `Source.Name` (hidden but present); the incoming file never
  contains it (auto-injected at commit); `computeSchemaDrift`'s
  `removed = baseline.filter(c => !incoming.has(c.name))`
  ([state.ts:682](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts#L682))
  therefore always lists `Source.Name` under "removed" with the "dependents may go stale" hint — the
  human's "warning as it already deleted." Spurious: commit re-injects it, nothing is lost.
  **Confirmed faithfully** (deterministic from the code + verified `target.columns` carries
  `Source.Name` in the detail read). **Fix:** exclude the reserved provenance column from the drift
  diff (needs a FE-side reserved-name constant matching backend `PROVENANCE_COLUMN = "Source.Name"` —
  a cross-language contract value, so source it from generated constants / values.yaml rather than a
  literal). Severity **medium** (false warning every refresh → erodes trust in the drift gate; no data
  loss). R156-interaction, higher confidence than [F-append-commit-fail]. Found 2026-07-09.
  - **Collision concern (human) — no DUPLICATION risk, but exposes a design weakness:**
    `_inject_provenance_col` ([datasets.py:246](../../../workspace/apps/backend/app/routers/datasets.py#L246))
    skips injection when a source column already claims `Source.Name` (user's column wins) → at most
    one such column, no duplication. BUT →
  - **[DESIGN — anchors the hardening round] Provenance identity is NAME-ONLY (`Source.Name`), no
    structural marker.** This is the shared root of the drift phantom AND the collision awkwardness.
    Consequences: (a) can't distinguish system-injected provenance from a user column of the same
    name; (b) the name can't change (it IS the identity); (c) downstream (drift diff, hidden
    carry-forward) keys off the name. Human's Qs: *if the user's column wins, what do we name ours,
    and how do we recognize it?* Today = we add nothing (correct for the Power Query case — PQ's
    `Source.Name` already IS the source filename; wrong only for a coincidental non-provenance user
    column, which then gets no provenance and is mistaken for ours).
  - **CHOSEN DIRECTION (human, 2026-07-09) — model provenance as a COMPUTED column, spec saved in
    metadata; recompute on refresh; auto-suffix on collision.** Supersedes the earlier
    "structural flag on the `Column` wire model" idea. Three parts:
    1. **Metadata registry, not name-matching.** `commitSettings` (the ingest recipe) records WHICH
       column is the computed provenance one (a pointer + "value = source filename"). Recognition
       reads the pointer, not the string `Source.Name`. Fixes the phantom-drift + collision-ambiguity
       root. **Keeps the `Column` wire model unchanged** → sidesteps the R152 widen-shared-model /
       `null`-on-bystander trap entirely ([[widening-shared-wire-model-omit-serializer]]) — the reason
       to prefer this over the flag-on-Column idea.
    2. **Recompute on refresh.** A computed column isn't part of the incoming file's schema, so the
       clean rule: **drift compares SOURCE columns only; the computed column is excluded from both
       sides and re-applied after the diff** (principled fix for [F-drift-provenance-phantom], not a
       special-case).
    3. **Collision → auto-suffix** `Source.Name` → `Source.Name1` (de-dup loop → `…2`), so provenance
       always exists and the user's column is never clobbered. Caveat: in the PQ case (incoming
       `Source.Name` already = source filename) this yields a mildly redundant second column — harmless
       (hide/drop one); auto-suffix is the safe default since name alone can't distinguish PQ-provenance
       from a coincidental user column.
  - **SCOPE BRAKE:** record ONLY provenance in metadata now (a single pointer) — do NOT build a general
    "computed columns" engine until a second computed-at-ingest column pulls it (evolution rule).
    Design input for the hardening round, not built this round.

- **[F-commit-error-opaque] The commit-error surface shows raw Pydantic messages with no field or
  guidance** (the human's "no info about what the error is"). `commitErrorDescription` returns
  `err.body.detail` verbatim for a non-coded 422
  ([UploadConfirmStep.tsx:86](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadConfirmStep.tsx#L86)),
  under a generic title — so a validation failure reads "Extra inputs are not permitted" with no
  column/field named. Same family as the R144 *error-surfaces-teach-the-fix* lesson. Fix = map
  validation errors to a field-named, actionable message. Severity **medium** (diagnosability). Found
  2026-07-09.

### Dogfood findings (pre-D, captured — NOT R157 core scope)

- **[F-metadata-reset] Metadata step clears column overrides destructively with no click-time confirm
  and no undo.** Two paths, sharing one root; found by the human 2026-07-09.
  - **Reset all to detected** — `resetAll` ([UploadMetadataStep.tsx:219](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx#L219),
    button [:327](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx#L327))
    wipes every dtype override in one click. **No warning, no confirm, no undo**; only guard is
    `disabled={!hasAnyOverride}`.
  - **Re-parse the sheet / edit the range** — `PARSE_SHEET_SUCCESS` (create mode) and
    `SET_PARSE_OPTIONS` reset `columnOverrides` to `{}` ([state.ts:344](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts#L344),
    [:569](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts#L569)).
    This is **intentional + documented** (comment "R19 Q2": re-parse yields new columns so old
    overrides can't be trusted) **and warned** by a standing Alert (`ParseOptionResetWarning`,
    [:485](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx#L485):
    *"Re-parsing or editing the range resets your column overrides…"*). The human still lost overrides
    unexpectedly → the **passive info Alert doesn't catch the eye**; it isn't a click-time confirm.
  - **Root:** destructive override-clearing in the Metadata step relies on a disabled-state guard +
    (for re-parse only) a passive Alert; neither is a click-time `Popconfirm`, and nothing is
    undoable. Severity **medium-low**: destroys in-wizard input (annoying to redo), not committed
    data. Cheap fix = a `Popconfirm` on both actions (re-parse's is a confirm of the already-documented
    reset; reset-all's is net-new). **Tangential to append/provenance** (pre-existing R19/F9-era
    editing-safety gap) → recorded as a follow-up, does not expand the FM1–12 walk.

- **[F-metadata-highlight] Every column shows the "overridden" highlight in refresh/append/merge
  mode, not just the ones the user changed.** The dtype-cell highlight is gated on
  `isOverridden = override !== undefined` ([UploadMetadataStep.tsx:349](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx#L349),
  yellow bg + `warning` status [:354-357](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx#L354))
  — i.e. "an override *entry exists*," not "differs from the auto-detected dtype." Create mode is
  correct (an override is only created when the pick ≠ detected, and picking detected back dispatches
  `null`, [:362](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx#L362)).
  But refresh/append/merge seed `columnOverrides[name] = {dtype: carriedForward}` for **every**
  surviving column (`applyPreset` [state.ts:249](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts#L249);
  lossy `presetFromDataset` [:233](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts#L233)),
  so every cell is highlighted from the start — even columns whose carried dtype equals the fresh
  detection — and the user's one real change is indistinguishable. **Root:** highlight semantics are
  "override object present" when they should be "differs from auto-detected." Cheap presentation-only
  fix = gate the highlight on `override?.dtype !== row.dtype` (+ format). Severity **low** (signal
  dilution, no data loss). **Relevant to the FM1–12 walk's ergonomics** — appending 12 months runs
  refresh mode 11× so the all-yellow table shows each time — but not to append/provenance correctness.
  Found by the human 2026-07-09.

- **[F-drift-layout] Drift step's "Schema changes detected" table right-aligns the type column →
  looks weird; + is the type column even needed?** `DriftGroup`
  ([UploadDriftStep.tsx:118](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadDriftStep.tsx#L118))
  renders a 2-column header-less `Table`: `name` (`<code>`, default left) + `detail`
  (`align: 'right'`, [:152](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadDriftStep.tsx#L152)).
  With only two columns in a full-width table the name hugs the left edge and the type floats to the
  right → a wide gap. Right-align is a numeric-column convention misapplied to a type string.
  **Cosmetic fix** = left-align `detail` (or replace the `Table` with a compact inline `name — type`
  row). Severity **low**. Found by the human 2026-07-09.
  - **Attached design question — RESOLVED (human + code, 2026-07-09): format-only change is NOT
    drift; do NOT add format to the drift baseline.** `format` is a parse instruction, not a stored
    property — translated to strptime (`translate_format`, `parquet_writer.py`) and consumed once at
    ingest to coerce string→date/datetime; the parquet then stores a typed column with no format.
    Both `yyyy-MM-dd` and `dd/MM/yyyy` produce the same `datetime` dtype, so no dependent breaks →
    drift (a stored-schema-compat warning) correctly ignores it. The real format risk is
    **parse-correctness** (a new file's layout no longer matching the carried format → loud parse-fail,
    already surfaced at the Metadata preview; or silent misparse of an ambiguous-but-valid layout →
    a Metadata-preview concern), NOT schema drift. Modeling format as drift would be wrong-altitude.
  - **Type column, by group** (the layout finding's remaining choice): **dtype-changed** — type IS
    the content (`from → to`), keep; **added / removed** — type is context only, droppable for a
    leaner row (build-time call).

- **[F-drift-blastradius] The "Dependent artifacts" Alert is an `info` stub whose copy promises a
  preview "later this round" that has been parked since R145.** `DriftBlastRadius`
  ([UploadDriftStep.tsx:87-96](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadDriftStep.tsx#L87))
  shows `blastRadiusStub` ("A preview of the queries and relationships that reference the removed /
  changed columns lands with the backend read (**later this round**). Until then, dependents are
  flagged automatically the next time they're opened."). Found by the human 2026-07-09.
  - **Stale copy (the actionable bit):** the dependent-preview backend read is **R145 slice 1b, parked
    and never built**; "later this round" is now several rounds stale and misleads. Fix = build the
    preview, or soften the copy to drop the timeline promise (keep the standing "auto-flagged on next
    open" reassurance, which is true).
  - **Tone (`info` vs `warning`) — keep `info` for now, make it data-driven later.** The Alert only
    appears on removed/retyped columns (breaking kinds), so it feels warning-worthy; but per the R145
    doctrine **drift never blocks** + the runtime stale-machinery auto-flags broken dependents on
    open, so "FYI, covered later" = honest `info`. The drift is already warning-toned above (⚠ title +
    `error`/`warning` group tags) → a second `warning` here would double-signal. Correct long-term
    model: **tone tracks the real affected-list** — `info` when zero dependents, `warning` when
    non-empty. Changing tone on the stub in isolation is not worth it. **Not append/provenance scope.**

- **[F-append-copy] The unchecked-append duplicate warning says "double those rows" — inaccurate for
  repeated re-adds, and inconsistent with the checked-path copy.** `confirmAppendUncheckedBody`
  ([en.json:525](../../../workspace/apps/builder/src/i18n/locales/en.json#L525)): "…appending it
  again will **double** those rows." Append is **additive** (each re-append adds one more copy), not
  **multiplicative**: "double" is only right for the FIRST accidental re-add (1→2 copies); a 3rd
  upload is 2→3 (+1 copy), not a doubling. Risk: a false mental model ("already doubled → another
  upload is harmless") — the opposite of the truth. The codebase already has the correct framing in
  the sibling checked-path message `overlapWarnBody`
  ([:530](../../../workspace/apps/builder/src/i18n/locales/en.json#L530)): "Appending will add those
  rows again (duplicates)." — additive, accurate for any count, concrete. Fix = align the unchecked
  copy to that additive phrasing (e.g. "each re-append adds those rows again as duplicates"); reject
  the over-vague "data may be duplicated" (loses the concreteness that makes a warning land). EN + VN
  mirror. Severity **low** (copy), but a guardrail warning being technically wrong erodes trust. Found
  by the human 2026-07-09. **Not append/provenance-logic scope** (the append behavior is correct; only
  the warning copy is off).

## Risks / unknowns

- Schema drift across FM1–12 may fire append's name-based reconciliation (null-fill / cast / drop).
- Real row counts (12 disjoint months) may surface performance or provenance-under-12-way-union gaps.

## Check

- [ ] _(pending — filled at Check phase)_

## Act

**Learnings**: _(pending)_

**Promotions**: _(pending — likely none for a dogfood round unless a gap is found)_

**Follow-ups (not promotions, just notes):**

- **[F-metadata-reset]** click-time `Popconfirm` (+ no undo) on the Metadata step's destructive
  override-clearing — both "Reset all to detected" (unguarded) and re-parse/range-edit (passive Alert
  only, easy to miss). See Do § Dogfood findings. Own slice or a rider on a future upload-UX round.
- **[F-metadata-highlight]** gate the dtype-cell highlight on `override?.dtype !== row.dtype` so it
  means "differs from auto-detected," not "an override entry exists" (fixes the all-yellow refresh
  table). Cheap presentation-only. Natural companion to [F-metadata-reset] on the same upload-UX round.
- **[F-drift-layout]** left-align the Drift "Schema changes detected" type column (cheap cosmetic);
  optionally prune the type column on added/removed rows. (Format-only-drift question RESOLVED = not
  drift; format is a parse instruction, not stored schema — see Do § Dogfood findings.)
- **[F-drift-blastradius]** fix the stale "later this round" copy on the Dependent-artifacts Alert
  (dependent preview = R145 slice 1b, parked) — build it or drop the timeline promise; and when the
  real preview ships, make the Alert tone data-driven (`info`=no dependents, `warning`=affected).
- **[F-append-copy]** align the unchecked-append warning to additive phrasing ("adds those rows again
  as duplicates") — drop "double" (wrong for 3rd+ re-adds); match the checked-path `overlapWarnBody`.
  EN + VN.
- **[F-overlap-range-copy]** `overlapWarnBody` date range: en-dash between two ISO dates is dash-soup
  (`2025-01-16–2025-01-29`) → "from {{min}} to {{max}}" (human hand-edited EN 2026-07-09, good). **VN
  mirror pending** — `vi.json` still has `{{min}}–{{max}}` → `từ {{min}} đến {{max}}` (EN/VN diverged).
  Only occurrence in the corpus. Cosmetic/low; Confirm-step, same cluster as [F-append-copy].

## Feeds into → Round_158 (TBD)

_(pending — either "accumulation loop confirmed end-to-end on the flagship dataset" or the specific
gap the walk surfaced, which would define R158.)_
