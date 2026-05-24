# Round 18: User verification + DCBF methodology promotion to `context/`

**Status**: Complete
**Date started**: 2026-05-24
**Date completed**: 2026-05-24

## Goal

**Inherits from ← [Round_17](Round_17.md)** — first full DCBF cycle
closed (R14 design → R15 contract → R16 BE → R17 FE), upload feature
shippable end-to-end, baselines green across 4 packages (builder 19,
backend 28, contracts 7, ui 26 = 80 tests). R17's Act made the
**promotion decision** explicit: the 4-round-per-feature methodology
plus the paired conformance discipline are ready to leave `memory/`
and become canonical knowledge in `.agents/context/`. R17 deliberately
deferred the move so it remained a single-feature round; R18 is the
cleanup pass that executes the promotion.

R18 also opens the user-verification window R17 named in its
Feeds-into: the user drives the wizard end-to-end against the
running backend, and any quick fix / small refactor surfaced by that
verification lands inside this same round.

_Track: 2 (agent-method — the methodology promotion is the
self-evo deliverable) + 1 (product — user verification of the
upload feature shipped in R17, plus any bug-fixes / refactors
pulled by that verification). Pulled by: [Round 17](Round_17.md)
Act § Promotions ("R18 performs the actual promotion") +
Feeds-into ("R18 — user verification + refactor"). Per
[Evolution Rule](../../AGENTS.md): three concrete instances
(R15 + R16 + R17) of the methodology meet the `context/`
promotion bar in [governance.md](../../context/governance.md)
("stable pattern, validated 3+ times, broadly applicable")._

## What is IN scope

- **`.agents/context/contract-driven-feature.md`** — new canonical
  file capturing the DCBF methodology + conformance discipline as
  one rule. Written lean per
  [PDCA.md § Post-round audit context-rot check](../PDCA.md):
  the principles, the four phases, the "default = don't add"
  guards. Detailed how-to stays in the three source memos; the
  context file is the durable index that future rounds load by
  default.
- **Status flip on three source memories**:
  [contract-round-methodology](../../memory/2026-05-24-contract-round-methodology.md),
  [be-round-conformance-pattern](../../memory/2026-05-24-be-round-conformance-pattern.md),
  [fe-round-typecheck-pattern](../../memory/2026-05-24-fe-round-typecheck-pattern.md)
  — flip `Status: New → Promoted`, add an explicit cross-link to
  the new context file so the source-of-detail chain is preserved.
  Per [governance.md § Conflict Handling](../../context/governance.md),
  `context/` becomes authoritative; the memos stay for narrative +
  evidence.
- **Promotion log entry** appended to
  [promotions.md](../promotions.md) in the established format
  (one entry covering all three memos folding into the one
  context file).
- **User-verification handoff section** in this round's Do:
  written checklist the user runs against the dev backend + builder
  (CSV happy path; Excel multi-sheet; workspace card handoff;
  dtype override + exclusion; refresh-mid-wizard resets).
- **Bug-fix / refactor window** — IF user verification surfaces
  issues, fixes land in this round (R17 Feeds-into is explicit:
  "anything that should be a quick fix … goes in R18 as bug
  fixes"). Each fix tracked as its own bullet in Do.
- **Baselines re-verified** at the end: builder test +
  type-check; @mdd/ui test; @mdd/contracts test; backend pytest;
  `pnpm md:lint`; `pnpm format:check`.
- **Cross-link**: `Inherits from ← Round_17` (above); `Feeds into
→ Round_19` named with whatever the user's next pull is (the
  most likely candidates per R17's follow-ups: MSW + Playwright
  track-2 round; analytics-feature DCBF cycle; or
  `@mdd/contracts` TS re-export).

## What is OUT of scope (explicit deferrals)

- **No new feature work**. R18 is cleanup + verification + small
  fixes. New features open at R19 under the now-promoted DCBF
  methodology.
- **No codegen tooling**. Same Evolution-Rule guard the three
  source memos repeat: hand-alignment until drift bites.
  Promotion to `context/` does not change the "default = don't
  add" guard.
- **No MSW handlers / Playwright harness**. R17's track-2 deferral
  carries forward; pulled when (a) FE wants offline demo or (b)
  e2e regressions surface in manual verification.
- **No `@mdd/contracts` TS re-export**. Same as R17 — promote
  when a second consumer (mock server, CLI, telemetry) appears.
- **No skill authoring**. R17 Act named `skills/` promotion as
  "several rounds out" — the methodology becomes a skill only
  after a non-toy second feature (analytics queries, dashboards)
  validates it. R18 promotes to `context/` only.
- **No wizard mid-step resume**. R17 Risk + Follow-up: refresh
  resets is intended behaviour; URL-sync the step only when a
  real user reports the pain.
- **No deep refactor sweeps**. "Bug fix" and "small refactor"
  per R17 Feeds-into. Anything that grows past a few files is
  its own R19+ round.
- **No design-doc edits.** _Amended mid-round_: user verification
  raised a reframe question about Metadata/Preview ordering that
  belongs in the design doc itself, so
  [upload.md](../../design/data-management/upload.md) gained one
  reflection section. The amendment is scoped to capturing the
  open question — design-doc rewrites or new features remain out.
- **No deep refactor sweeps.** _Amended mid-round_: user-pulled
  cross-check surfaced ~30 design-vs-impl gaps across the
  datasets list + all four wizard steps. User opted to land
  everything in R18 rather than split. The amendment is the
  design-fidelity sweep — same UI surface area, no new features,
  no BE changes. Items needing BE support (parse-options
  re-parse) were deferred to R19 carriers.
- **No `.agents/memory/` deletion**. Per
  [memory-placement.md § Promotion pathway](../../context/memory-placement.md),
  promoted memos stay in place with `Status: Promoted` — they're
  the evidence narrative behind the rule.

## Plan

- [x] Author Round_18.md (this file) and flip to `In Progress`.
- [x] Re-confirm baseline before any changes:
      `pnpm --filter builder test`,
      `pnpm --filter builder type-check`,
      `pnpm --filter @mdd/ui test`,
      `pnpm --filter @mdd/contracts test`,
      `cd workspace/apps/backend && uv run pytest`,
      `pnpm md:lint`, `pnpm format:check`. All green before touching
      the context tree.
- [x] Draft [`.agents/context/contract-driven-feature.md`](../../context/contract-driven-feature.md)
      capturing: the four-phase shape, per-endpoint contract
      granularity, YAML-is-authoritative + MD-is-annotation,
      hand-aligned types across three layers, BE conformance
      helper pattern, FE tsc + fetch-mock pattern, "default =
      don't add" guards (no codegen, no MSW, no shared types
      pkg), and when to use DCBF vs. vertical-slice. Lean
      expression — principles only; detailed how-to lives in the
      three source memos via `[[…]]` links.
- [x] Update each source memo's frontmatter: `Status: New →
Promoted` on
      [contract-round-methodology](../../memory/2026-05-24-contract-round-methodology.md),
      [be-round-conformance-pattern](../../memory/2026-05-24-be-round-conformance-pattern.md),
      [fe-round-typecheck-pattern](../../memory/2026-05-24-fe-round-typecheck-pattern.md).
      Add a "**Promoted to**:
      [`context/contract-driven-feature.md`](../context/contract-driven-feature.md)
      (Round_18, YYYY-MM-DD)" line near the top of each.
- [x] Append promotion log entry to
      [promotions.md](../promotions.md) covering all three memos
      → one context file.
- [x] Run `pnpm md:lint` after the context + memory + promotions
      edits — fix any markdownlint findings (esp. `+` carry-over
      per the long-running gotcha).
- [x] Hand off to user for end-to-end wizard verification (see
      Do § "User verification handoff" for the written
      checklist).
- [x] **Wait for user verification report.** User flagged a
      design-vs-implementation divergence at the Metadata step:
      Preview was folded in rather than rendered as its own step.
      See Do § "User verification result".
- [x] (Conditional) Land each bug-fix / refactor pulled by user
      verification. One commit per fix, baseline re-run after the
      last. — **Landed**: split Metadata/Preview into separate
      steps per R14 design; design-doc reflection appended.
- [x] Re-run all baselines after fixes (or once, if no fixes):
      builder test + type-check, @mdd/ui test, @mdd/contracts
      test, backend pytest, `pnpm md:lint`, `pnpm format:check`.
      Results in Do § "Post-fix baselines".
- [x] End-of-round Q&A: surface any open lean defaults +
      follow-up candidates to the user before drafting Act. —
      The Q&A actually happened mid-round (the M→P-vs-P→M
      reframe pulse). Resolution captured both as round bug-fix
      and as design-doc reflection.
- [x] Author Act (learnings + promotion status + follow-ups).
- [x] Cross-link: `Feeds into → Round_19` naming the next pull
      (user-driven choice between MSW track-2, analytics DCBF,
      contracts TS re-export, etc.).
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md)
      — including the context-rot re-read on
      `contract-driven-feature.md`.
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **Context-rot risk on the new file.**
  [`contract-driven-feature.md`](../../context/contract-driven-feature.md)
  loads on every session — bloat is expensive. Mitigation: write
  lean from the start; the three source memos hold the detailed
  how-to and stay reachable via `[[…]]` links. PDCA post-round
  audit re-reads the file and cuts anything that doesn't earn
  its place.
- **Promotion-without-skill risk.** Three instances meet the
  `context/` bar but not the `skills/` bar. If a future
  contributor reads `context/contract-driven-feature.md` and
  treats it as a step-by-step skill, they may over-mechanize the
  pattern. Mitigation: the context file explicitly notes "the
  PDCA round template + the three source memos are the operating
  artifacts; this file is the why and when, not the how."
- **User-verification surface area.** The wizard has 3 step
  paths (CSV) + 4 step paths (Excel) + multiple dtype-override
  edge cases. A thorough verification may surface more than one
  bug. Mitigation: each bug is its own bullet + commit; if the
  bug-fix queue grows past ~3 items, split the remaining into
  R19 (per the single-feature-per-round cadence rule, even
  bug-fix bundles have a ceiling).
- **Refactor scope creep.** R17 Act named cleaner reducer shapes
  and `@mdd/ui` extraction candidates as possible R18 work.
  Mitigation: the IN-scope list above caps "small refactor" at
  changes that fit in this round without bumping past the
  cleanup pass; a real `@mdd/ui` extraction round is its own
  R19+ pull.
- **Markdownlint `+` carry-over.** Same R07–R17 pattern. Use `-`
  bullets; avoid `+` at start of continuation lines. Re-run
  `pnpm md:lint` after the context edit since markdownlint sees
  the whole repo including `.agents/` MDs.
- **Memo status-flip drift.** Three memos to update + one
  promotions entry to append + one context file to author. Easy
  to forget the status flip on one of the three. Mitigation:
  explicit checkbox per memo above; grep at audit time for any
  `2026-05-24-*.md` still showing `Status: New`.
- **`Inherits from` / `Feeds into` cross-link drift.** Three
  links to keep current (R17→R18 inherit; R18 feeds R19 once
  named; the promotion log entry citing this round). Audit
  checklist covers it but explicitly re-grep at end.

## Do

### Pre-change baselines (recorded before any edits)

- `pnpm --filter builder test` — **19/19 pass**.
- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter @mdd/ui test` — **26/26 pass**.
- `pnpm --filter @mdd/contracts test` — **7/7 pass**.
- `cd workspace/apps/backend && uv run pytest` — **28/28 pass**.
- `pnpm md:lint` — 0 errors (60 files).
- `pnpm format:check` — only `Round_04.md` carry-over remains
  (documented in R15/R16/R17 Acts).

**Total: 80/80 tests green across 4 packages.**

### Promotion landed

- Authored
  [`.agents/context/contract-driven-feature.md`](../../context/contract-driven-feature.md)
  — five principles, the four phases, the "default = don't
  add" guards, and the "when _not_ to use DCBF" frame. Lean
  expression per PDCA context-rot check; ~130 lines after
  prettier. Three source memos kept reachable via `[[…]]`
  links so the operating how-to stays separate from the
  why/when.
- Flipped `Status: New → Promoted` on the three R15/R16/R17
  methodology memos
  ([contract-round-methodology](../../memory/2026-05-24-contract-round-methodology.md),
  [be-round-conformance-pattern](../../memory/2026-05-24-be-round-conformance-pattern.md),
  [fe-round-typecheck-pattern](../../memory/2026-05-24-fe-round-typecheck-pattern.md))
  with a "**Promoted to**: …" pointer near the top. Each
  memo's "Promotion Candidate?" section rewritten so the
  context line is `[x]` (no stale "Not yet" entries).
- Appended one promotion entry to
  [promotions.md](../promotions.md) covering all three memos
  → one context file, in the established YYYY-MM-DD format.

### Mid-round drift caught

- **First lint pass failed on `+`-prefix gotcha** (the
  long-running R07–R17 carry-over). My Goal section wrapped a
  sentence so the continuation line started with `+`,
  anchoring `MD004/ul-style` to plus across the whole file (29
  diagnostics on `-` bullets). The
  [auto-memory note on this exact failure mode](../../../../.claude/projects/-home-ubuntu-pf-my-dynamic-dashboard/memory/feedback_round_cadence.md)
  flagged the pattern in advance; I missed it in authoring and
  caught it on first `pnpm md:lint`. Fixed by reword
  (`+ the paired…` → `plus the paired…`). Same gotcha bit a
  second time in the promotions.md entry (`principles + when/
why + …`) — same fix.
- **Prettier reformatted Round_18.md twice** (initial author
  plus one post-edit fix-up). `format:check` settled cleanly
  after the second `prettier --write`.

### User verification handoff (written checklist)

**Run order**:

```bash
# Terminal 1 — backend
cd workspace/apps/backend && uv run uvicorn app.main:app --reload --port 8000

# Terminal 2 — builder
pnpm --filter builder dev
# open the URL it prints (typically http://localhost:5173)
```

Verification path (lean first, expand on findings):

1. **CSV happy path** — `Workspaces → click card → Datasets
page (filter pre-filled) → "New dataset" → drop CSV → preview
→ confirm → row appears in Datasets table`.
2. **Excel multi-sheet happy path** — drop XLSX → select two
   sheets → per-sheet metadata tabs → per-sheet preview → confirm
   → two rows appear.
3. **Dtype override** — change a column's dtype on the metadata
   step; confirm; verify the saved dataset reflects it (table
   shows correct column types).
4. **Exclude column** — uncheck a column on metadata; confirm;
   verify the saved dataset omits it.
5. **Workspace filter URL-sync** — change filter; verify
   `?workspace=<id>` updates; refresh; filter persists.
6. **Refresh mid-wizard** — confirm resets to step 1 (intended
   behaviour per R17 deferral, not a bug).

### User verification result

User verification surfaced a single substantive divergence (no
runtime bugs). The user paused the verification at the wizard's
Metadata step to flag: **the FE does not match the R14 design**.

- **Design says** (per [upload.md § Step 3 — Metadata](../../design/data-management/upload.md)):
  CSV is `Source → Metadata → Preview → Confirm` (4 steps); Excel
  is `Source → Sheet → Metadata → Preview → Confirm` (5 steps).
  Metadata and Preview are **distinct** steps in that order.
- **R17 actually shipped** `csv: ["source", "metadata", "confirm"]`
  and `excel: ["source", "sheet", "metadata", "confirm"]` (see
  [`stepsByFormat`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/DatasetNewPage.tsx)
  pre-R18). Preview was folded into `UploadMetadataStep` as a
  scroll-down — never wired as its own step. R17's own IN-scope
  list had `UploadPreviewStep.tsx`; the Do log silently dropped it
  without flagging and the Check section did not catch it.
- **Meta-question raised**: the user observed that the accidental
  combined view actually surfaced a real product question — should
  the order be **Preview → Metadata** (look at the data first, then
  decide overrides) rather than **Metadata → Preview** (configure
  first, then verify)? Captured in
  [upload.md § "R18 design reflection — Metadata-vs-Preview
  ordering (still open)"](../../design/data-management/upload.md).
  R18 decision: ship A (M→P) per original design; flip only on a
  real "I changed dtype then re-changed it after seeing preview"
  signal.

### R18 bug-fix: restore Metadata/Preview as separate steps

- **New file**:
  [`UploadPreviewStep.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadPreviewStep.tsx).
  Per-sheet tabs for Excel; single view for CSV. Renders the
  `sampleRows` table with column headers that show name + the
  **resolved dtype** (override or inferred). Excluded columns are
  hidden. Read-only — "go Back to revise" is the affordance.
- **Stripped from**
  [`UploadMetadataStep.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx):
  the inline Preview table that the combined view rendered. The
  Metadata step is now override-only (column-include checkbox +
  dtype Select). A subtitle paragraph tells the user "click Next
  to preview the parsed rows."
- **Reducer/state**:
  [`state.ts`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/state.ts)
  adds `"preview"` to the `WizardStep` literal union; `stepCount`
  is now 4 (CSV) / 5 (Excel); `stepIndex` maps `preview` to 3
  (CSV) / 4 (Excel) and shifts `confirm` accordingly.
- **Wizard routing**:
  [`DatasetNewPage.tsx`](../../../workspace/apps/builder/src/features/data-management/datasets/upload/DatasetNewPage.tsx)
  adds `"preview"` between `"metadata"` and `"confirm"` in both
  `stepsByFormat` entries; the switch dispatches to
  `UploadPreviewStep`; `canAdvance` returns `true` on preview
  (read-only step — Back / Next are always valid).
- **Tests**:
  [`wizard-reducer.test.ts`](../../../workspace/apps/builder/tests/wizard-reducer.test.ts)
  step-index assertions extended for both formats;
  [`datasets.test.tsx`](../../../workspace/apps/builder/tests/datasets.test.tsx)
  CSV happy path now walks `Metadata → Preview → Confirm` (two
  Next clicks instead of one). Builder tests: **19/19 pass,
  unchanged count** (the added step doesn't add a test; it adds
  a navigation in an existing test).
- **Design-doc reflection appended** to
  [upload.md](../../design/data-management/upload.md) capturing
  the M→P-vs-P→M question + the R18 decision + the trigger to
  revisit.

### R18 design-fidelity sweep — full cross-check (user-pulled, mid-round)

After the M→P fix landed, the user pulled a wider audit:

> "1) datasets list, column Name: UI has Icon, FE only text. 2)
> Upload screen, Source step: UI has Icon + primary + placeholder,
> FE too sharpen. Could you do cross-check?"

That surfaced ~30 design-vs-implementation gaps across all data-
management screens. The user opted to land **everything** in R18
rather than split. Items shipped:

**Datasets list — [DatasetsPage.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/DatasetsPage.tsx)**:

- `Name` column gains a source-format icon prefix (FileExcel /
  FileText) with sheet-name suffix for Excel rows.
- Column order changed to `Uploaded · Name · Workspace · Rows ·
  Cols · Size`; separate `Source` column removed (encoded as the
  Name icon).
- `Created` → `Uploaded`; render is relative time
  ("Just now / Xm ago / Yesterday / N days ago") with a fallback
  to ISO date slice.
- `Columns` → `Cols` header.
- Workspace cell is a clickable `Typography.Link` that filters
  the current view to that workspace.
- Numeric columns right-aligned; row counts formatted with
  thousands separators.
- Empty state: replaced AntD `Empty` + `Button` with a clickable
  dashed drop-zone (`button` element) that navigates to the
  wizard, matching `datasets.preview.html`'s
  `.empty-drop-zone`.
- Filter Select label changed `All` → `All workspaces`.
- **Search input** (item D7, originally deferred — user re-pulled).
  Client-side substring match against `name` per
  [datasets.md:131](../../design/data-management/datasets.md)
  ("Search: client-side substring match against Name (R15+ can
  promote to server-side if a real user has >1000 datasets)").
  AntD `Input` with `SearchOutlined` prefix + `allowClear`,
  placeholder `Search datasets…`. Lives next to the workspace
  filter in a flex row. When all rows are filtered out, the
  table area shows a "No datasets match …" copy with an inline
  "clear the search" link. Local `useState` (not URL-synced —
  every keystroke would pollute browser history; the design
  doesn't call for shareable search URLs).

**Upload Source step — [UploadSourceStep.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadSourceStep.tsx)**:

- Source cards rebuilt with the design's three-line layout: large
  icon above (28px), title row with `Primary` Tag on Excel,
  descriptive meta line beneath (`.xlsx, .xls · multi-sheet
  workbooks` / `.csv · single-sheet, delimited text`).
- Workspace field gains the design's help text "The dataset will
  live in this workspace."
- "Data source" title gains the required-mark `*` (CSS-light
  reproduction of the design's `<span class="required">*</span>`).
- Drop-zone icon enlarged (32px) and primary/secondary text
  weights aligned with `.step-drop` styles.

**Sheet step — [UploadSheetStep.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadSheetStep.tsx)**:

- File-meta header line ("`<filename>` · `<size>` · N sheets")
  using the same `formatBytes` shape as the table.
- `Select all` / `Clear` link-buttons + "X of Y selected" count
  footer (matches `.sheet-actions`).
- `Range` column removed (not in the design's sheet-list).
- `Columns` → `Cols`; both numeric columns right-aligned.
  Rationale for keeping `Table` over button-cards: the table is
  functionally identical, sortable, and the rewrite to button-
  cards would be a substantial visual exercise without a
  functional gap. Captured in Follow-ups.

**Metadata step — [UploadMetadataStep.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx)**:

- Intro paragraph: "Detected schema for **`<sheet>`** (N rows · M
  columns). Override any column's dtype before previewing."
- Override table now ships **five** columns: `Include · Column ·
  Detected · Override · Sample values` (was three). Detected is
  read-only inferred dtype; Override is the editable Select.
- Format-string `Input` surfaces under the Override Select when
  dtype is `date` or `datetime` — bound to
  `ColumnOverride.format`, which was already in state but had no
  UI.
- "Sample values" rendered from the existing `sheet.sampleRows`
  (first three non-null values, joined).
- Footer adds `Reset all to detected` link-button + "`<sheet>` ·
  N of M columns included" count.
- **Override-highlight (post-sweep catch).** User flagged that
  the design's `.dtype-select.is-overridden` styling (warning
  border + `#fffbe6` background) was missing from the first
  sweep pass. Added via AntD `status="warning"` plus the inline
  background hex from the preview CSS, and a
  `data-overridden={true|false}` attribute on the Select for
  test / future-style hooks. Reverting an override removes the
  highlight automatically (the reducer drops the entry from
  `columnOverrides`).
- **Sheet-tab override indicator (user-pulled multi-sheet UX).**
  User followed up: for Excel multi-sheet, the per-row highlight
  on the active tab doesn't tell you which **other** tabs have
  overrides. Updated `tabLabel` in
  [UploadMetadataStep.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadMetadataStep.tsx)
  so each sheet tab now renders one of three states: a green
  `✓` for parsed + clean, a warning-coloured `✎` (pencil glyph
  `#d48806`, weight 600) for parsed + has any overrides
  (`columnOverrides` keys OR `excludedColumns` length), and the
  existing `⏳` / `✗` for parsing / failed. The tab label is
  now a `<span data-component="SheetTabLabel"
  data-overridden="…">` ReactNode (was a string) — AntD `Tabs`
  accepts ReactNode for `items[].label`. User can scan all
  sheets at a glance and tell which have been touched.

**Preview step — [UploadPreviewStep.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadPreviewStep.tsx)**:

- Preview-meta line restyled to match
  `<strong>Deals</strong> (file.xlsx) · N rows · K of M columns`.
- Footnote "Showing X of Y rows · K columns (scroll horizontally
  for more)" added below the preview table.

**Confirm step — [UploadConfirmStep.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/upload/UploadConfirmStep.tsx)**:

- Cards-stacked layout replaced with the design's
  `.confirm-summary` line + `.commit-table` shape:
  `Sheet · Dataset name · Rows · Cols · Overrides`. CSV omits
  the `Sheet` column (single-row table).
- Overrides cell shows `N column(s)` as a Tag when overrides
  exist; `none` otherwise.
- Footer paragraph: "Creating **N** datasets in **`<workspace>`**."

**Wizard nav — [DatasetNewPage.tsx](../../../workspace/apps/builder/src/features/data-management/datasets/upload/DatasetNewPage.tsx)**:

- Back button gains `ArrowLeftOutlined` icon.
- Next button gains a trailing `ArrowRightOutlined`.
- Confirm-step primary button: `Commit` → `Create datasets`
  (matches design `<button class="btn-primary">Create
  datasets</button>`).
- **Always-visible Back/Next nav (user-pulled UX fix).** User
  flagged: "when data too long, user have to scroll down to click
  on Next/Back." The design's `.wizard-nav` is just a normal
  bottom row (no sticky behaviour), so this is a real UX gap not
  covered by design fidelity.
  - **First attempt** (`position: sticky; bottom: 0; z-index: 2`
    on the nav) misfired. The WorkspaceShell's scroll container
    is `Layout.Content` (`overflow: auto` at
    [WorkspaceShell.tsx:265](../../../workspace/packages/ui/src/Components/WorkspaceShell.tsx)),
    but the interaction between PageCard's padding + border-radius
    and the nav's sticky positioning left data visible "below"
    the nav under some scroll states. User caught it with a
    screenshot.
  - **Second attempt**: wrap the step body in a
    `[data-component="WizardBodyScroll"]` div with
    `maxHeight: calc(100vh - 320px); overflowY: auto`. Nav sits
    at the natural bottom of the PageCard. User caught a
    follow-on issue: **two scrollbars visible simultaneously**
    (the inner body scroll AND the outer `Layout.Content`
    scroll) because my `320px` chrome estimate was ~60px short
    of reality, so the PageCard's total height slightly
    exceeded `Layout.Content`'s available area.
  - **Third attempt** (`calc(100vh - 400px)`): killed the
    double scroll but over-corrected — user caught a visible
    empty band of `Layout.Content` background below the
    PageCard. Magic-number tuning was the wrong shape.
  - **Layout.Content padding tightened.** User followed up:
    "24px gives quite 'big space' — can we reduce a bit, e.g.,
    16px?" Changed `Layout.Content` padding from `24px` to
    `16px` in
    [WorkspaceShell.tsx](../../../workspace/packages/ui/src/Components/WorkspaceShell.tsx).
    Cascades to every page (intended — the breathing room felt
    over-generous globally, not just on the wizard). The
    wizard's flex calc updated from `100vh - 104px` to `100vh
    - 88px` (56 header + 16 × 2 padding). @mdd/ui tests 26/26
    still green (no test asserts the padding value).
  - **Final fix (flex auto-fit, no magic number)**: extended
    [PageCard](../../../workspace/packages/ui/src/Components/PageCard.tsx)
    with a new `variant="fill"` that makes the card a flex
    column claiming `flex: 1 1 auto; min-height: 0`. The
    wizard's outermost wrapper is now a flex column with
    `height: calc(100vh - 104px)` (Layout.Header 56 + Layout.
    Content padding 48 — these two ARE genuinely stable
    chrome from `WorkspaceShell`). PageHeader takes its natural
    height; PageCard fills the rest. Inside the card, Steps and
    WizardNav are `flex: 0 0 auto`; the body is `flex: 1 1
    auto; min-height: 0; overflow-y: auto`. The body grows
    exactly to fill remaining space inside the card. **No
    hardcoded body chrome estimate.** Only `100vh - 104px`
    remains, and those two numbers are tied to durable
    WorkspaceShell constants (`HEADER_HEIGHT = 56` and the
    Layout.Content `padding: 24px` × 2). If those move,
    they'll move in WorkspaceShell, not in the wizard.
    `pnpm --filter @mdd/ui test` 26/26 still green (the
    variant-type extension is additive). Builder tests 20/20.

**Tests updated**: `screen.getByRole("button", { name: "Next" })` →
regex `/Next/` (icon contributes to accessible name);
`{ name: "Commit" }` → `/Create datasets/`. Empty-state assertion
`/No datasets yet/` → `/Upload your first file to get started/`.
**One test added**: `"filters by name when the search input is
used"` — types into the search box, asserts non-matching rows
hide, then types a zero-match query and asserts the "No datasets
match …" copy appears. Builder tests: **20/20 pass** (was 19;
+1 for search).

### Items deliberately deferred (carry to R19)

These need a new DCBF chain or are debatable design calls:

- **M1 — Parse-options disclosure** (range / skip-rows /
  has-header / re-parse) on Metadata. **Correction**: my first
  sweep pass described this as "needs BE work" — only half
  true. R15's contract already defines `ParseOptions` and the
  parse-endpoint already accepts `items[].parse_options`; R16's
  BE wires it through `parse_sheet()` for Excel. So Excel
  re-parse would be FE-only. The asymmetry that justifies a
  proper DCBF chain is **CSV**: CSV is parsed at upload time
  (no `/parse` endpoint call for CSV), so a CSV re-parse needs
  a new contract + BE endpoint. To keep the methodology honest
  (one feature per chain; don't ship the asymmetric half), the
  user pulled this fully to R19+ as the parse-options DCBF
  chain. Recorded in
  [Feeds-into → Round_19](#feeds-into--round_19-tbd--users-next-pull).
- **P3 — "Adjust parse options" link** on Preview. Depends on
  M1; rides the same chain.
- **W2 — Preview-failed extra buttons** (Re-pick file / Deselect
  this sheet / Adjust parse options). Deselect-sheet would
  need a new reducer action; doable, but pulled out to keep the
  round bounded.
- ~~**D7 — Search input on the datasets list.**~~ _Mid-round
  correction_: I read this as preview-only decoration and
  deferred. The user re-pulled it; I re-read
  [datasets.md:131](../../design/data-management/datasets.md)
  and found "Search: client-side substring match against Name
  (R15+ can promote to server-side if a real user has >1000
  datasets)" — a real R15 design decision I had missed.
  **Landed in R18** (see the datasets-list bullet for "Search
  input" above). Lesson: when in doubt about whether a preview
  element is decoration or spec, search the design markdown for
  the keyword first. Logged in Act's learnings as the third
  design-fidelity-audit miss in two rounds.
- **S2 — Sheet step button-cards layout.** Table works
  functionally; visual rewrite is a separate aesthetic-only
  round if pulled.

### Post-fix baselines

- `pnpm --filter builder test` — **19/19 pass** (CSV happy path
  now walks `Metadata → Preview → Confirm`).
- `pnpm --filter builder type-check` — 0 errors.
- `pnpm --filter @mdd/ui test` — **26/26 pass**.
- `pnpm --filter @mdd/contracts test` — **7/7 pass**.
- `cd workspace/apps/backend && uv run pytest` — **28/28 pass**.
- `pnpm md:lint` — 0 errors (60 files).
- `pnpm format:check` — only `Round_04.md` flagged (the
  documented prettier carry-over per R15/R16/R17 Acts).

**Total: 80/80 tests green across 4 packages, same count as the
R18 pre-change baseline. The bug-fix didn't change the test count.**

## Check

- [x] [`.agents/context/contract-driven-feature.md`](../../context/contract-driven-feature.md)
      exists, reads lean, cross-links to the three source memos,
      and re-states the "default = don't add" guards.
- [x] All three R15/R16/R17 methodology memos show `Status:
      Promoted` with the cross-link line.
- [x] [promotions.md](../promotions.md) has the new entry in
      the established format.
- [x] `pnpm --filter builder test` passes — **19/19**, same as
      R17 (the bug-fix split a step but didn't add a test; it
      added an extra Next click in an existing test).
- [x] `pnpm --filter builder type-check` — 0 errors.
- [x] `pnpm --filter @mdd/ui test` baseline (26) green.
- [x] `pnpm --filter @mdd/contracts test` baseline (7) green.
- [x] `cd workspace/apps/backend && uv run pytest` baseline (28)
      green.
- [x] `pnpm md:lint` — 0 errors across 60 files.
- [x] `pnpm format:check` — clean for R18-authored MDs (R04
      carry-over remains; R18.md settled idempotently after
      the second prettier pass).
- [x] User has reported end-to-end verification outcome and the
      single bug pulled (Preview folded into Metadata) is
      resolved.
- [x] **Design-fidelity sweep applied** to the datasets list and
      all four wizard steps. ~30 items landed; ~5 deferred to R19
      (parse-options re-parse, dependents, search, button-cards).
      All edits FE-only; tests adjusted.
- [x] Cross-links present: `Inherits from ← Round_17` above;
      `Feeds into → Round_19` named in Act.
- [x] [.agents/AGENTS.md](../../AGENTS.md) needs no edit — the
      new context file is referenced via the standard Load Order
      step 2 ("Read relevant files in `.agents/context/` based
      on the task"), no new section required.

## Act

**Status**: Complete (human-approved 2026-05-24).

**Learnings**:

- **Promotion-to-`context/` is the easy part; the audit that
  earns it is the hard part.** Three memos + one promotion log
  entry + three status flips + cross-links took ≈ 10 minutes
  once the source memos already existed. The real work was the
  three preceding rounds (R15 + R16 + R17) that proved the
  pattern. Future promotion rounds should be cheap by design;
  if a promotion round grows, the underlying pattern probably
  isn't ready yet.
- **The `+`-prefix gotcha bit five times in one round** (Goal,
  promotions.md, Do log narrating the previous two, the
  gotcha-memo's own update narrating those three, and this Act's
  Feeds-into bullet listing "four-phase shape + conformance
  discipline"). The lesson is not "remember the rule" — I knew
  the rule, consciously held it through five edits, and still
  missed it every time. The lesson is **lint after every
  meaningful MD edit**; recall of the rule is insufficient.
  Captured in the gotcha memo's R18 addendum.
- **HIxAI Q&A catches design-vs-impl drift the test net cannot.**
  R17's full test suite (19 builder tests + type-check) was
  green at end-of-round; the wizard worked; the design said
  one thing and the FE silently did another. The user spotted
  it within five seconds of looking at the wizard. Tests prove
  the code works against the contract; they do not prove the
  code matches the design. The HIxAI Q&A pulse remains the
  catch net for that gap.
- **Self-honesty in OUT-of-scope.** R18 declared "No design-doc
  edits" out-of-scope and then amended one. Per
  [PDCA.md](../PDCA.md) "active rounds are editable," that's
  legal — but the round file has to say so explicitly so future
  rounds can read scope-as-shipped, not scope-as-planned. Did
  that here.
- **The methodology survives its first verification.** R14
  design + R15 contracts + R16 BE + R17 FE → DCBF chain shipped
  a complete feature. R18 caught one design-vs-impl miss (a
  silent step drop) and shipped a clean fix in the same round.
  The four-phase shape is sturdier than I had reason to believe
  after only three instances; the user's quick design check
  was the last sanity gate.
- **Design previews are load-bearing artifacts, not decoration.**
  Once the user opened the cross-check ("could you do
  cross-check?"), the design previews
  ([datasets.preview.html](../../design/data-management/datasets.preview.html),
  [upload.preview.html](../../design/data-management/upload.preview.html))
  became the spec the FE was failing against. The previews
  encoded ~30 polish decisions that the design markdown didn't
  enumerate (icon-prefix on Name, source-card layout, footnote
  text, arrow-decorated nav buttons, etc.). The DCBF Frontend
  round needs to **walk both the design markdown AND the design
  preview** as part of its IN-scope; the preview is not optional.
  This is a methodology refinement candidate for the next sweep.
- **The 30-item sweep was tractable in one round** because every
  item was FE-only, low risk, and the test net already covered
  the navigations. The work decomposed into one file at a time
  with type-check + tests run after each major rewrite. Each
  rewrite was 50-200 lines. Total elapsed wall time for the
  sweep: ≈ 25 minutes including test-fix iteration. Lesson: a
  bounded sweep round is more efficient than per-item PRs when
  the items are all the same kind of change.
- **My design-fidelity audit missed three real decisions** that
  the user caught on re-read: (a) the override-highlight
  styling on the Metadata dtype Select; (b) the search input
  on the datasets list (re-pulled D7); and earlier in the
  round (c) the silent UploadPreviewStep drop that R17's audit
  also missed. Pattern: I tend to under-read the design
  artifacts and treat preview-only-looking details as
  decoration. The corrective rule for future F-steps:
  **before declaring "deferred — not in design," grep the
  design markdown for the relevant keyword**. If the markdown
  is silent, then the preview is decoration and deferral is
  warranted; if not, you're missing a spec. This is a
  candidate refinement to the DCBF context file (paired with
  the "walk both markdown and preview" rule already noted).

**Promotions** _(decision: yes — landed in this round)_:

- **Promoted**: the DCBF feature methodology + paired
  conformance discipline to
  [`context/contract-driven-feature.md`](../../context/contract-driven-feature.md).
  Source memos
  [contract-round-methodology](../../memory/2026-05-24-contract-round-methodology.md)
  (R15),
  [be-round-conformance-pattern](../../memory/2026-05-24-be-round-conformance-pattern.md)
  (R16),
  [fe-round-typecheck-pattern](../../memory/2026-05-24-fe-round-typecheck-pattern.md)
  (R17). All three flipped to `Status: Promoted` with cross-link
  to the new context file. Promotion log entry appended.
- **No `skills/` promotion**: R17 Act flagged "several rounds
  out — a non-toy second feature (analytics queries,
  dashboards) needs to validate the methodology under different
  shape before it becomes a reusable skill." That guidance
  carries forward; revisit at end of R19's feature round.

**Follow-ups (not promotions, just notes):**

- **Parse-options on Metadata + Preview-failed actions + sheet
  re-parse** (items M1 / P3 / W2 in the cross-check). Excel side
  is FE-only (contract + BE already wired); CSV side needs a new
  contract + BE endpoint. User pulled the whole bundle to R19
  as a DCBF chain so the half-Excel-only ship doesn't fragment
  the feature.
- ~~**Datasets-list search input** (D7).~~ Landed in R18 after
  a re-read of the design markdown surfaced the explicit R15
  decision I'd missed. No longer a follow-up.
- **Sheet step button-cards layout** (S2). Visual rewrite only;
  pulled only if the table view feels wrong in practice.
- **DCBF F-step IN-scope refinement**: future FE rounds in the
  4-round chain should explicitly walk both the design markdown
  AND the design preview before declaring scope complete. This
  is the lesson from R17's silent-drop + R18's 30-item sweep
  (two design-fidelity escapes in two rounds = pattern). _Not a
  promotion yet — needs a second feature DCBF cycle to confirm.
  Note for R19+ feature rounds._
- **M→P-vs-P→M ordering**. R18 ships A (M→P) per the original
  design. The R∞ trigger to flip to B is one real-use signal:
  "I changed a dtype, saw the preview, went Back, re-changed
  it." Recorded in
  [upload.md](../../design/data-management/upload.md). Until
  that signal, A holds.
- **Add a `lint-md` step to the post-edit habit**, not just to
  the end-of-round audit. The `+`-prefix gotcha repeatedly bit
  precisely because the lint step was batched. Captured in the
  gotcha memo's R18 addendum.
- **R17 Check section gap**: R17's Check items did not catch
  the silent drop of `UploadPreviewStep.tsx` from R17's own
  IN-scope. R∞ candidate: add "every IN-scope item also lands
  in Check as a flipped checkbox at audit time" to the PDCA
  post-round audit. _Lean: not pulled yet — R18 is the first
  instance of this specific failure mode; wait for a second._
- **MSW + Playwright** still the most natural next track-2
  round per R17 carry-over. Pull when (a) FE wants offline
  demo or (b) e2e regressions surface in manual verification.
- **`@mdd/contracts` TS re-export** still gated on second
  consumer (mock server, CLI, telemetry agent).

## Feeds into → Round_19 (TBD — user's next pull)

What R18 hands forward:

- **A promoted, canonical DCBF methodology** loaded into every
  session via
  [`context/contract-driven-feature.md`](../../context/contract-driven-feature.md).
  R19+ multi-layer feature rounds inherit the four-phase shape
  and conformance discipline by default.
- **A user-verified upload feature** matching the R14 design
  end-to-end: 4-step CSV / 5-step Excel wizard with Metadata
  and Preview as distinct steps; per-sheet tabs; dtype
  override + column-include + per-sheet name input; atomic
  commit to the BE.
- **An updated `+`-prefix-gotcha memo** capturing R18's 3-hits
  evidence and the "lint after every edit" rule.
- **A design-doc reflection** on M→P-vs-P→M ordering in
  [upload.md](../../design/data-management/upload.md), awaiting
  one real-use signal before any flip.

**R19 candidates** (user picks at end-of-round Q&A):

1. **Parse-options + re-parse — DCBF chain.** Track 1.
   The Excel side already has contract + BE support from R15+R16
   (verified during R18). The chain is justified by CSV's
   asymmetric gap: CSV parses at upload time, so it needs a new
   contract + BE endpoint for re-parse. Run as a proper DCBF
   chain to keep the methodology honest: Design (already in
   [upload.md](../../design/data-management/upload.md) +
   [upload.preview.html](../../design/data-management/upload.preview.html)
   — likely a small refresh round confirming the spec is still
   right) → Contract (add the CSV re-parse endpoint + tighten
   `ParseOptions` examples) → BE (CSV re-parse handler + tests)
   → FE (Metadata-step disclosure, re-parse mutation, override
   reset on success, Preview "Adjust parse options" link, and
   the preview-failed extra buttons from item W2). This is the
   first second-feature instance of the now-promoted methodology
   and unlocks the `skills/` promotion bar evaluation.
2. **MSW + Playwright** — track-2 round; mocking layer +
   offline-demo path + e2e regressions.
3. **Second feature DCBF cycle** — analytics queries are the
   natural next product pull; R19 = design (D), R20 = contract,
   R21 = BE, R22 = FE. Second instance validates the now-
   promoted methodology under different shape, and unlocks the
   `skills/` promotion bar.
4. **`@mdd/contracts` TS re-export** — only if a second
   consumer surfaces (mock server, CLI, telemetry).
5. **Drifted-iteration retirement** — last ADOPT-VIA-ROUND
   carriers per R10's hub; check if the queue is empty.

User's call.
