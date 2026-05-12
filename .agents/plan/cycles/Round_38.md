# Round 38: Spec 018 — File Upload & Sheet Discovery (UX gap-fill)

**Status**: Complete ✅
**Date started**: 2026-05-12
**Date completed**: 2026-05-12

**Governance**: Spec-Kit PDCA (Plan -> Do -> Check -> Act)

> **Pivot note (2026-05-12)**: Slot previously planned for Spec 020 (Column
> Role Assignment). After the AntD chain (Rounds 35–37) settled the layout /
> style / feedback foundation, the user chose to resume the Data Management
> revision chain at Spec 018. Spec 020 shifts to Round 40.
>
> **Round type**: UI/UX revision atop existing backend. No new endpoints, no
> schema migrations (per Spec 018 explicit scope).

## Goal

Close the remaining UX gaps in the file upload + sheet discovery surface so
all Spec 018 acceptance criteria pass. The surface is substantially built
out from Rounds 33–37; the remaining work is targeted gap-fill, not a
new feature build.

## Acceptance-criteria audit (Spec 018 vs current state, 2026-05-12)

| AC                                             | Status             | Where                                                                                                                                                                                                              |
| ---------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| File picker accepts CSV and Excel              | ✅ done            | `App.tsx` `input[type=file]` with `accept=".csv,.xlsx,.xlsm,.xlsb,.xls"`                                                                                                                                           |
| Excel sheet discovery <2s                      | ✅ backend done    | `apps/backend/app/api/upload.py`                                                                                                                                                                                   |
| Multi-sheet Excel shows sheet selector         | ✅ done            | `ExcelSheetPicker` + `deriveUploadStep` routes to `sheet` step when `requiresSheetSelection`                                                                                                                       |
| Single-sheet Excel auto-selects                | ✅ done            | `App.tsx onUpload` auto-resolves first sheet when `requires_sheet_selection` is false                                                                                                                              |
| CSV upload skips sheet discovery               | ✅ done            | `deriveUploadStep` routes CSV directly to `submit`                                                                                                                                                                 |
| Loading mask blocks UI during upload           | ✅ done (Round 37) | `UploadLoadingMask` (AntD `Spin`) with `shouldShowLoadingMask` covering validate / discover_sheets / uploading states                                                                                              |
| Success redirects to metadata extraction stage | ✅ done            | `App.tsx` `navigate("/workflow/schema-sheet")` after upload                                                                                                                                                        |
| Error messages are actionable                  | 🟡 partial         | `ActionableErrorPanel` + `pushToast("error", …)` show _something_ actionable, but specific error classes (encrypted file, malformed, unsupported extension) may not all map to bespoke guidance. Needs gap survey. |

**Net**: 7/8 acceptance criteria already pass code review. The remaining
gap is the **actionable-error surface** — verifying that each Spec 018 error
class produces a clear "what happened + what to do next" message rather
than a generic backend stack trace.

## Plan

- [x] Audit Spec 018 acceptance criteria against current code (table above)
- [x] User Q&A confirmed Round 38 single-feature Do scope = (a) Actionable
      error gap-fill (FE error classification + bespoke guidance for
      encrypted / malformed / unsupported-extension cases)
- [x] Confirmed single-goal scope: classify backend `error_code` strings on
      the frontend into a small kind enum + bespoke meta (severity + title +
      guidance); render via AntD `Alert` in `ActionableErrorPanel`
- [x] Confirmed no backend / endpoint / schema changes (per Spec 018 scope)

## Do

- 2026-05-12T17:28Z - Iteration 1 (actionable error gap-fill) - New module `apps/builder/src/api/errorKinds.ts`: - `ErrorKind` union: `encrypted_file | malformed_file |
        unsupported_extension | source_type_mismatch | missing_source_type
        | empty_sheet | sheet_not_supported | not_found | unknown`. - `classifyErrorCode(code)` maps backend strings to kinds. Mapping
  derived from `apps/backend/app/api/upload.py` raise sites:
  `encrypted_file → encrypted_file`,
  `parse_failed | sheet_discovery_failed → malformed_file`,
  `unsupported_file → unsupported_extension`,
  `source_type_mismatch → source_type_mismatch`,
  `invalid_source_type → missing_source_type`,
  `empty_sheet → empty_sheet`,
  `sheet_discovery_not_supported | sheet_selection_not_supported
        → sheet_not_supported`,
  `smoke_run_not_found → not_found`.
  Unrecognized codes fall back to `unknown`. - `getErrorKindMeta(kind)` returns severity (`error|warning|info`),
  title, and bespoke guidance copy per kind. Severities map to
  AntD `Alert` types directly. - `getErrorMetaForCode(code)` composes both functions. - Rebuilt `apps/builder/src/components/errors/ActionableErrorPanel.tsx`: - Now renders as AntD `<Alert type={meta.severity} showIcon>` with
  a structured `description` containing kind title, kind guidance,
  the server `user_message` (only if it differs from the kind
  title), the `next_steps` bullet list, the stage recovery copy,
  and a correlation-id footer. - Technical details collapse into AntD `<Collapse size="small">`
  toggled by an inline `Button type="link"`. - Exposes `data-error-kind` attribute on the root for downstream
  styling/testing. - Replaced raw `<h3>` / `<p>` / `<ul>` markup with AntD
  `Typography.Text` / `Paragraph` + `Flex vertical` for token-
  driven layout. - New tests: - `apps/builder/src/api/__tests__/errorKinds.test.ts` — 17 cases
  covering every classifier mapping, severity matrix, and
  `unknown` fallback. - `apps/builder/src/components/errors/__tests__/ActionableErrorPanel.test.tsx`
  — 6 cases covering encrypted-file kind copy, source-type-mismatch
  warning copy, unknown-code fallback, next-step bullets,
  correlation-id render, and `data-error-kind` attribute. - Verification: - `pnpm exec vitest run` → 12 files / 70 tests passing
  (+21 new tests since Round 37). - `pnpm exec tsc --noEmit` → no new errors in `api/errorKinds.ts`,
  `components/errors/ActionableErrorPanel.tsx`, or related. - `pnpm exec vite build` → 1017 kB raw / 323 kB gzip (was 319 kB
  after Round 37; +4 kB for `Collapse` + classifier code).

## Check

- [x] Run `/speckit.analyze` for Spec 018 artifacts — run; findings captured below
- [x] Verify `specs/018-file-upload-sheet-discovery/tasks.md` matches reality — reconciled; 13/15 tasks checked
- [x] `pnpm exec vitest run` → 12 files / 70 tests passing
- [x] `pnpm exec vite build` → clean (1017 kB / 323 kB gzip)
- [x] `pnpm exec tsc --noEmit` → no new errors in migrated files
- [~] Manual check: CSV upload works end-to-end — deferred visual QA
- [~] Manual check: Excel single-sheet and multi-sheet discovery/selection works — deferred visual QA
- [~] Manual check: each Spec 018 error class produces actionable guidance — covered by errorKinds.test.ts (17 cases) + ActionableErrorPanel.test.tsx (6 cases); visual QA deferred
- [x] No backend endpoint or schema was added or modified

### Check log (2026-05-12)

- speckit.analyze: 2 CRITICAL findings (C1 — backend tasks greenfield vs pre-existing endpoints; C2 — no task IDs). Neither blocks Round 38 close: C1 is historical doc mismatch (endpoints existed before spec was written), C2 is documentation quality debt. Both logged as cleanup items for a future docs-reconcile round. No CRITICAL implementation failures.
- tasks.md reconciled: 13/15 tasks marked [x] based on code evidence; 2 remain unchecked (E2E tests not implemented; manual acceptance checklist not automated).
- Automated checks pass: 12 files / 70 tests, clean build (1017 kB / 323 kB), no errors in actionable error scope.

## Act

**Learnings**:

- Backend exposes 10 distinct `error_code` strings from `upload.py`; the
  frontend previously rendered all of them via the generic `user_message` +
  `next_steps` path. Grouping them into 9 frontend kinds (with `unknown`
  catch-all) gave each error a bespoke title + recovery copy without
  touching the backend.
- AntD `Alert` `description` slot is the right home for structured error
  detail — it accepts a `ReactNode`, so a `Flex vertical` of typography,
  bullets, and inline buttons composes naturally. Avoiding `message`
  altogether sidesteps the v6 deprecation entirely.
- Pattern that emerges: backend produces semantic error codes; frontend
  owns the user-facing copy. Backend doesn't need to know about UI
  vocabulary. Worth extending to other surfaces (workspace API errors,
  query errors) as they get more error classes.

**Promotions**:

- [x] → context/ — `errorKinds.ts` taxonomy + classifier pattern. Future
      rounds adding error classes should extend this module rather than
      hand-rolling copy in components.
- [x] → skills/ — none in this round.

**Next-round decision**:

- Round 39 — Spec 019 (Metadata Extraction & Profiling). Header-row /
  data-range override UI is currently rough (inline `<Input>` rows in
  `App.tsx workflowSchemaSheetPanel`) and is the natural follow-up after
  the upload surface is solid. Alternative: WorkspacePicker visual refit
  (deferred AntD chain step) — but lower user value.
