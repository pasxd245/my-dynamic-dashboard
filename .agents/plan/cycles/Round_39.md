# Round 39: Spec 019 — Metadata Extraction & Profiling (UI revision)

**Status**: In Progress
**Date started**: 2026-05-12
**Date completed**:

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Pivot note (2026-05-12)**: Slot was previously planned for Spec 021
> (Readiness Validation). The Data Management revision chain runs in spec
> order (017 → 018 → 019 → 020 → 021) and Round 39 now picks up Spec 019
> after Round 38 closed Spec 018's actionable-error gap. Spec 020 (Column
> Role Assignment) shifts to Round 40; Spec 021 (Readiness Validation)
> shifts to Round 41.
>
> **Round type**: UI/UX revision atop existing backend. No new endpoints,
> no schema migrations (per Spec 019 explicit scope).

## Goal

Revise the profile / override / role-assignment UI in
`App.tsx workflowSchemaSheetPanel` (lines ~625–699) so it presents column
metadata as a proper table instead of a single-select dropdown, and uses
AntD `Form` + `InputNumber` for the override fields. Single feature:
extract the panel into reusable components consumed by the workflow shell.

## Acceptance-criteria audit (Spec 019 vs current state, 2026-05-12)

| AC                                                   | Status     | Notes                                                                                                                                    |
| ---------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Profile UI shows all columns with inferred types     | 🟡 partial | Currently rendered only inside a Select dropdown — user must click to see one column at a time. Round 39 fixes this with a proper Table. |
| Header row override persists and recomputes profiles | ✅ done    | `Sheet Override` form + `onOverride` handler                                                                                             |
| Data range can be adjusted (A1:Z1000)                | ✅ done    | Raw `Input` field (UX improves with placeholder + format hint in Round 39)                                                               |
| Nullability indicator shows for each column          | ❌ blocked | Backend `ProfileColumn` doesn't expose nullability. Out of scope per spec ("no new endpoints"). Documented gap.                          |
| Type overrides available (string, int, float, date)  | ❌ blocked | No backend endpoint for per-column type override. Out of scope per spec. Documented gap.                                                 |
| Error cases handled gracefully                       | ✅ done    | Round 38 actionable-error gap-fill                                                                                                       |

**Net**: 3/6 ACs already pass, 1 improvable in this round, 2 blocked by
backend scope (out of round). Round 39 closes AC 1 and polishes AC 2/3.

## Plan

- [x] Audit Spec 019 acceptance criteria vs current code (table above)
- [x] Confirm single-feature scope: extract `workflowSchemaSheetPanel` into a
      reusable `ProfilePanel` (override form + column-profile table + role
      assignment) under `components/profile/`
- [x] Confirm no backend / endpoint / schema changes
- [x] Confirm out-of-scope gaps (nullability, type overrides) are documented
      for a future spec-update round

## Do

- 2026-05-12T17:55Z - Iteration 1 (profile UI revision) - New `apps/builder/src/components/profile/`: - `ColumnProfileTable.tsx` — AntD `Table size="small"` showing
  column name + id (stacked), effective type as a colored `Tag`
  (`TYPE_COLOR` map: int/integer→blue, float/double/number→geekblue,
  date/datetime→purple, bool→gold, default→default), and top-3
  sample values from `top_k_values_json` wrapped in a `Tooltip`
  showing the full JSON. Radio-style row selection wired through
  `selectedColumnId` + `onSelect` so the table is the primary
  column picker. Empty state guides the user to "Load profile". - `ProfilePanel.tsx` — orchestrates three AntD `Card size="small"`
  sections: "Sheet override" (Form with `InputNumber` for header
  row + `Input` for data range + reason + Apply button),
  "Column profile" (the new `ColumnProfileTable` + Load button in
  card extra slot), "Assign role" (column Select bound to the
  same `selectedColumnId` as the table + role Select + reason +
  Assign / Load readiness actions). Stage-scoped
  `ActionableErrorPanel` rendered above the override form when
  `profileError.stage !== "upload_source"`. - `index.ts` — barrel exports. - Documented gaps surfaced inline (nullability, type overrides)
  with a small typography footer so the user knows they exist
  but require a backend update outside Spec 019 scope. - `apps/builder/src/App.tsx`: - Replaced the inline `workflowSchemaSheetPanel` JSX (~75 lines
  of raw `<section>` / `<Input>` / `<Select>` / `<h2>` markup)
  with a single `<ProfilePanel>` element receiving the existing
  state hooks as props. The state still lives in `App.tsx` for
  this round to avoid widening scope — extracting it to a
  `profileStore` is a candidate for a follow-up round. - Removed `Select` import (no longer used in `App.tsx` after the
  role-selection moved into `ProfilePanel`). - Verification: - `pnpm exec vitest run` → 12 files / 70 tests passing
  (unchanged from Round 38; no existing tests exercise the
  schema/profile panel directly). - `pnpm exec tsc --noEmit` → no errors in `App.tsx` or
  `components/profile/`. - `pnpm exec vite build` → 1225 kB raw / 389 kB gzip (was
  323 kB after Round 38; +66 kB for AntD `Table` + `Card` +
  `Form` + `InputNumber` + `Tooltip`). These are first-time
  imports — subsequent rounds that reuse them are free.

## Check

- [x] `pnpm exec vitest run` → 12 files / 70 tests passing
- [x] `pnpm exec vite build` → clean (1225 kB / 389 kB gzip)
- [x] `pnpm exec tsc --noEmit` → no new errors in migrated dirs
- [ ] UI bring-up: Sheet Override form renders header row as `InputNumber`,
      data range as `Input` with format hint, submit via AntD Form
- [ ] UI bring-up: column profile renders as a Table showing column id,
      name, effective type, and (when present) top-k preview
- [ ] UI bring-up: role assignment uses the table row selection AND the
      dropdown — they share `selectedColumnId` state
- [x] No backend endpoint or schema was added or modified

## Act

**Learnings**:

- AntD `Table` `rowSelection={{ type: "radio" }}` plus `onRow={{ onClick }}`
  gives clickable rows that also work via the radio cell. Sharing
  `selectedRowKeys` with an outside Select gives users two ways to pick
  the same column with no extra state. Worth reusing wherever a table
  drives a downstream form.
- The first table/card-heavy surface in a project is expensive to add
  (+66 kB gzip here); subsequent surfaces are nearly free since AntD's
  `Table` / `Card` / `Form` / `InputNumber` / `Tooltip` are imported once
  and tree-shaken. Plan AntD bundle hits as one-time, not per-feature.
- Spec 019 ACs around nullability and per-column type overrides are
  legitimately blocked by backend — surfacing the gap inline (as a small
  typography note in the panel) is more honest than silently shipping a
  partial feature and looks like a TODO breadcrumb for the next spec
  update round.

**Promotions**:

- [ ] → context/ — pattern: profile/schema panel composed of three small
      AntD Cards (override form / column table / role assignment) with the
      column table as the primary selection input. Future surfaces showing
      schema-driven actions should follow this layout.
- [ ] → skills/ — none in this round.

**Deferred** (candidates for follow-up rounds):

- Extract App.tsx profile/role state into a `profileStore` (zustand) so
  `ProfilePanel` can be consumed by other routes without prop-drilling.
- Backend update: expose nullability + accept per-column type override
  endpoint. Would close Spec 019 ACs 4 and 5.

**Next-round decision**:

- Round 40 — Spec 020 (Column Role Assignment). The role-assignment slice
  inside `ProfilePanel` (third Card) is the natural focus: add multi-role
  per column, role-conflict validation feedback, batch assignment, and
  audit trail visibility. The table groundwork from Round 39 means
  per-row role indicators can be added cleanly.
