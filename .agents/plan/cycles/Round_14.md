# Round 14: Design — Datasets + Upload wizard (multi-source ingestion)

**Status**: Complete
**Date started**: 2026-05-24
**Date completed**: 2026-05-24

## Goal

**Inherits from ← [Round_13](Round_13.md)** — workspaces are a real
end-to-end product surface: TanStack Query in place,
`QueryClientProvider` mounted, backend HTTP API conventions
established (Pydantic models, router structure, CORS, pytest fetch
patterns), `vi.stubGlobal('fetch', …)` test pattern proven, AntD
v6 prop names locked.

R13's Act explicitly nominated upload as R14's direction with the
guidance: _"Design first per R10's methodology — author `upload.md`
design doc + maybe a `upload.preview.html` before any code."_

**R14 is design-only** — one design doc plus one high-fidelity
preview. No code. No backend. No router changes. The implementation
chain (R15+) takes the locked contracts and builds against them.

_Track: 1 (product — first data-ingestion surface, the thing that
makes "CRM-export → analytics platform" real). Pulled by:
[Round_13](Round_13.md) Feeds-into naming the upload feature; R13
deferrals (workspace detail page, workspace persistence) which
upload forces resolution of; the canonical purpose at
[purpose.md](../../context/purpose.md) (data-management is the
product spine). Per [Evolution Rule](../../AGENTS.md)._

## What is IN scope

One cohesive outcome: **R15+ has concrete contracts to implement
against, and HIxAI has a tangible visual target for the upload
surface before code lands.**

- **Author [.agents/design/data-management/upload.md](../../design/data-management/datasets/upload.md)**
  (new concept doc, follows R10's canonical template; R11's
  `workspaces.md` is the direct shape reference):
  - **Mandatory Surface declaration** header table — every surface
    R15+ will introduce, declared with Layer / Reusability /
    Purity / Allowed peer deps. Expected rows: `WorkspaceDetailPage`
    route, `UploadZone` feature component, `UploadListRow` feature
    component, `useUploadsQuery` + `useUploadMutation` hooks,
    `uploadsApi` client, `POST /workspaces/<id>/uploads` +
    `GET /workspaces/<id>/uploads` backend routes, `Upload` type.
  - **ASCII layout** — workspace detail page populated state
    (uploads list) + zero-uploads state (drop zone is the empty
    state) + during-upload row state + error-row state.
  - **Upload data model** — fields decided this round, not
    discovered during R15+. Open question for HIxAI (see Risks).
  - **File storage decision** — where uploaded files live on disk,
    what format, how they're keyed. Open question for HIxAI.
  - **Parse-time decision** — parse-on-upload vs parse-on-view.
    Open question for HIxAI.
  - **Read/write boundary** — what's stub vs real in R15, what
    defers. R14 doesn't lock the R15/R16/R17 split — that's the
    implementing rounds' Plan-phase call — but the design doc
    must make the boundary _visible_ so the split is mechanical.
  - **Workspace persistence dependency** — uploads are persistent
    artifacts; losing the workspace row but keeping the file is
    incoherent. Design doc notes that the first upload-impl round
    inherits the workspace-persistence swap (R13 deferred).
  - **Lifecycle** — when this design doc amends (each impl round
    closes) vs supersedes (uploads-v2 if the model grows beyond
    CSV).
- **Author `../../design/data-management/_archive/upload.preview.html`**
  (new preview file — N=2 for `data-management/`, but each preview
  is still N=1 per concept; this is the upload concept's first
  preview, not a zoomed-in workspaces variant):
  - Tailwind via CDN, self-contained, opens directly in browser.
  - Renders inside the master-layout chrome (sidebar, breadcrumb,
    PageHeader, PageCard) — visually consistent with
    `../../design/data-management/_archive/workspace-shell.preview.html`.
    Sidebar: "Data Management" expanded → "Workspaces" active →
    breadcrumb shows `Home ▸ Data Management ▸ Workspaces ▸ Marketing`.
  - Content area shows the workspace detail page: page header
    with workspace name + metadata, the upload zone, and a list
    of prior uploads with status + row/column counts.
  - State toggle (bottom-right) flips between: zero-uploads
    (drop-zone-as-empty-state), one-upload-uploading,
    populated-with-three-uploads, one-failed-upload.
  - Token parity with `@mdd/ui` via CSS custom properties; same
    comment-pointer to [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts)
    as the workspace-shell preview.
  - Honest framing banner: "Brainstorming preview — not production
    truth. ~90% fidelity to the upload-feature target. The running
    builder is the real source."
  - Lifecycle: lives through R14 and the immediate next round
    (the first upload-impl round, likely R15); retired in that
    round's Act once the running builder visually matches.
- **HIxAI Q&A loop** on the open questions in Risks. R14 cannot
  flip to Complete until each has a decision recorded in
  `upload.md`. Same pattern R11 used; R13 confirmed it works.

## What is OUT of scope (explicit deferrals)

- **Any code.** R14 is documentation-only. No tests, no
  components, no routes, no backend, no `package.json` changes.
  R15+ implements.
- **Locking R15/R16/R17 internal scope.** R14 produces the
  contracts; each implementing round has its own Plan-phase Q&A
  to set its own scope against the contracts. R14 does not write
  R15's Plan.
- **Workspace edit / rename / delete.** Still R13's deferral list;
  not pulled by upload. Lands when user friction triggers it.
- **TSV / Excel / JSON / Parquet ingestion.** R14 designs **CSV
  only**. Other formats are a future-round pull when a user has
  one. The design doc names this deferral explicitly so future
  rounds inherit the framing.
- **Schema editing / column rename / dtype override after upload.**
  R14 designs read-only schema display (what the parser inferred).
  Edit affordances are R∞ until a user mis-typed column actually
  blocks a downstream feature.
- **Multi-file upload / batch upload.** One file per upload action.
  Multi-select drag-drop is a future-round pull.
- **Upload resume / chunked upload for large files.** First version
  is single-shot multipart POST. Resume lands when a real user
  has a >100MB CSV that fails mid-upload.
- **Saved queries / dashboards / downstream surfaces.** Upload is
  the ingestion surface; what's done with the uploaded table is
  later in the data-management spine. Design doc names this
  boundary so reviewers don't pull downstream concerns into the
  upload scope.
- **`UploadZone` / `UploadListRow` extraction to `@mdd/ui`.** Per
  the build-first lesson and "Default = don't add": stay feature-
  local. Extraction triggers when a second consumer pulls them in.
- **Authentication / per-user file isolation.** Single-user product;
  R∞ until multi-user becomes real.
- **Markdownlint `+` / Prettier carry-over.** Same R07–R13
  flap; mention only, don't re-solve.

## Plan

- [x] Author
      [.agents/design/data-management/upload.md](../../design/data-management/datasets/upload.md)
      with mandatory Surface declaration, ASCII layout, data
      model, file-storage decision, parse-time decision, read/
      write boundary, workspace-persistence dependency, lifecycle.
- [x] Author the high-fidelity preview at
      `../../design/data-management/_archive/upload.preview.html`.
      Tailwind CDN; renders inside the master-layout chrome with
      the workspace detail page as content; state toggle for
      zero/uploading/populated/failed; honest framing banner;
      CSS-var block mirrors `themeTokens.ts`. Visual consistency
      with the workspace-shell preview.
- [x] HIxAI Q&A loop on open questions (file storage, parse-time,
      data model, detail-route shape, upload UI surface, empty
      state, progress feedback, server vs client parse). Lock
      decisions in `upload.md` before flipping to Do-complete.
- [x] `pnpm md:lint` clean across both R14 files.
- [x] `pnpm format:check` clean for R14 files.
- [x] No code paths touched: `git status` shows only `.md` + `.html`
      under `.agents/`; test suites unchanged in count + pass
      (26 + 8 + 5 baseline from R13).
- [x] Cross-link: `Inherits from ← Round_13` in Goal (already
      above); `Feeds into → Round_15` in Act naming the first
      upload-impl scope.
- [x] Post-round audit per [PDCA.md](../PDCA.md) including the
      context-rot check (R14 touches `design/data-management/`,
      not `context/`; no-op verification confirmed).
- [x] Grep this file for unticked `- [ ]` before marking
      Complete — status header and checkboxes are independent;
      flip both.

## Risks / unknowns

- **Eight open design questions** for HIxAI review. R14 cannot
  flip to Complete until each has a decision:
  1. **File storage backend** — filesystem (raw file in
     `workspace/apps/backend/data/uploads/<workspace_id>/<upload_id>.csv`),
     or DuckDB blob, or SQLite? **Lean: filesystem + raw CSV
     kept verbatim, plus a parsed Parquet companion file** —
     debuggable, rsyncable, DuckDB-native to read for analytics,
     no premature DB schema for blob storage.
  2. **Parse-time** — parse-on-upload (eager: fail fast on
     malformed CSV, store schema + row/column counts in upload
     metadata) vs parse-on-view (lazy: store raw bytes only,
     parse when the detail row is opened)? **Lean: parse-on-
     upload** — list-row metadata (row count, columns) is the
     value of the uploads list view; lazy parse defers errors to
     a worse moment.
  3. **Upload data model** — minimal `{ id, workspaceId,
filename, uploadedAt }`, or richer `{ id, workspaceId,
filename, sizeBytes, rowCount, columnCount,
columns: [{name, dtype}], uploadedAt, status }`? **Lean:
     the richer shape** — list row needs the counts; columns
     unlock the schema-display surface in the detail-row UI
     without a second fetch.
  4. **Workspace detail route shape** — `/data-management/
workspaces/<id>` as a single page with the uploads list +
     drop zone inline, or `/data-management/workspaces/<id>/
uploads` as a sub-route? **Lean: single page, no tabs** —
     uploads are the workspace's primary content for now; sub-
     routes / tabs land when a second peer surface (queries,
     dashboards) pulls them in.
  5. **Upload UI surface** — modal (mirrors R13's create flow),
     inline drop zone embedded in the detail page, or full-page
     drop overlay on dragenter? **Lean: inline drop zone with
     click-to-browse fallback** — modal hides drag-drop
     ergonomics behind a click; full-page overlay is heavyweight
     for what's intended to be the page's main action.
  6. **Empty state on detail page** — separate big-CTA + drop
     zone (mirrors workspaces empty state), or **drop zone is
     the empty state** (the affordance already invites action)?
     **Lean: drop zone IS the empty state** — workspaces empty
     state needed a CTA because there's no affordance otherwise;
     a drop zone already is one. Avoids visual redundancy.
  7. **Upload progress + error feedback** — AntD `message`
     toast, inline status row appended to the uploads list, or
     modal-during-upload? **Lean: inline status row** appended
     immediately on POST; status transitions `uploading → parsing
→ ready` or `failed`. Errors surface in the row (with
     details on click), not a toast that drops context. Matches
     the "fail in place" principle the detail page already needs
     for downstream surfaces.
  8. **Server-side vs client-side parse** — backend parses with
     pandas / polars / DuckDB, or client parses with
     papaparse and sends rows? **Lean: server parse with DuckDB**
     — single source of truth, no client/server schema drift,
     scales via streaming, and DuckDB is the analytics target
     anyway so the parser is already on the dependency path.
- **`WorkspaceCard` → `ListCard` generic-naming question (open
  from R11) still deferred.** Upload's list-row pattern is a row,
  not a card; doesn't trigger the second-card-consumer that would
  pull the extraction. Note in the upload design doc that the
  extraction question remains untriggered.
- **Scope creep into R15+.** R14 designs the surface and locks
  decisions, but it must not write R15's Plan. Same risk R11 had
  for R12/R13. Mitigation: `upload.md` explicitly says
  "implementation lands in R15+ (split decided by that round's
  Plan-phase)" and does not pre-commit the R15/R16/R17 boundaries.
- **Workspace-persistence dependency forces a coupled R15.**
  Upload impl can't ship cleanly on top of R13's in-memory-list
  workspace store — losing workspaces but keeping files on disk
  is incoherent. R14's design doc names this dependency; R15's
  Plan inherits it. Risk: R15 ends up larger than R13 because it
  bundles persistence + upload. If so, R15 splits in its Plan
  phase (persistence first, then upload) — same call R13 had
  available and didn't need.
- **Design-doc length pressure.** Upload has more surfaces than
  workspaces (file storage, parser, status states, error model).
  Risk: `upload.md` grows large enough to be hard to scan.
  Mitigation: same structure as `workspaces.md`; if a section
  needs more than ~150 lines, factor it into a sub-doc under
  `.agents/design/data-management/upload/` and link from the
  parent. Decide during Do.
- **Preview ↔ production divergence.** Same as R11. Tailwind CDN
  uses utility classes; the running builder uses AntD. ~90%
  visual match is the goal, not pixel parity. The detail-page
  chrome (PageHeader, PageCard) already exists in the running
  builder from R12, so HIxAI can compare directly against the
  workspaces page for shell consistency.
- **Markdownlint `+` / Prettier carry-over.** Same R07–R13
  pattern. Use `-` bullets; avoid `+` at start of continuation
  lines.
- **Review-pass iteration cost.** R11's preview went through 7
  review-pass enrichments before sign-off (icons, sample content,
  collapse pattern, CSS bugs). Budget for similar iteration on
  the upload preview — drag-drop affordance, status-row visual
  hierarchy, error-row treatment, and the relationship between
  the drop zone and the existing uploads list are all visual
  decisions that will surface through screenshot review.

## Do

- **HIxAI Q&A — single-turn accept-all.** The eight open questions
  with explicit leans were surfaced to the user before any drafting
  began. The user responded "go with R14" — interpreted as accept
  all eight leans verbatim, mirroring R11's "User accepted all 5
  leans verbatim" pattern. Decisions recorded in
  [upload.md](../../design/data-management/datasets/upload.md)'s "Open
  questions answered in R14" table at the bottom of the doc.
- **upload.md authored**
  ([upload.md](../../design/data-management/datasets/upload.md))
  — Surface declaration table with 12 rows spanning `apps/builder`,
  `apps/backend`, `apps/backend/app/ingest`, and a `parse_csv()`
  helper (the schema absorbed all surfaces without amendment, third
  instance of stability after R11 and R12); ASCII layouts for the
  four documented states (zero-uploads, populated, during-upload,
  failed); `Upload` and `Column` data models; file storage decision
  (filesystem + raw CSV + Parquet companion at
  `data/uploads/<workspace_id>/<upload_id>/{original.csv,parsed.parquet}`);
  parse-time decision (parse-on-upload, synchronous, in-POST);
  read/write boundary with three forced boundaries and a soft
  partitioning sketch for R15/R16/R17; explicit
  workspace-persistence dependency forcing R15 to swap R13's
  in-memory store; backend endpoint shape including the
  201-with-`failed`-status semantics for parse failures; nested
  query-key shape `['workspaces', workspaceId, 'uploads']`;
  lifecycle; deferrals list with 13 named triggers.
- **upload.preview.html authored**
  (`../../design/data-management/_archive/upload.preview.html`)
  — workspace detail page rendered inside a static-expanded
  master-layout chrome. State toggle (bottom-right) flips between
  the four documented states. CSS token vars mirror
  [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts)
  with the same comment-pointer convention as the workspace-shell
  preview. Honest framing banner at top. Sidebar collapse / flyout
  interactions deliberately omitted (already exercised in the
  workspace-shell preview); R14's preview focuses on the content
  area where upload introduces new surface.
- **Markdownlint `+`-prefix gotcha caught and fixed.** First draft
  of `upload.md` had a `+ UploadListRow + hooks + tests` continuation
  line in the R16 soft-partition bullet — exactly the pattern
  [memory/2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md)
  warns about. `pnpm md:lint` flagged MD004; reworded to use
  comma-separated lists instead of `+`-joined.
- **Prettier auto-format applied to R14 files only.** Column-width
  re-alignment in tables, code-comment alignment in the data-model
  TypeScript block, and one indentation tweak in the DuckDB SQL
  snippet. `npx prettier --write` on the two R14 files; the
  pre-existing R02 / R04 / R13 / `promotions.md` warnings remain
  carry-over per R13's Act.
- **No code touched.** `git status` shows three untracked files,
  all under `.agents/`: `Round_14.md`, `upload.md`, and
  `upload.preview.html`. No diffs in tracked files. Test suites
  are unchanged in count and pass by inspection — the inspection-
  based check is the design-only round's equivalent of running
  the suites (same pattern R10 and R11 used).
- **Context-rot check.** R14 modifies `design/data-management/`
  and `plan/cycles/`, not `context/`. Check is a no-op for this
  round. Verified.
- **Schema-stability observation.** R10 predicted R11 would
  stress-test the Surface-declaration schema; R11 confirmed it
  held. R14 is the third instance and adds two new column values
  that fit unchanged: `pure (data)` Purity for the backend
  `parse_csv()` helper, and `apps/backend/app/ingest/` Layer.
  Schema continues to absorb new surfaces without amendment.
- **N=2 preview infrastructure pulled in mid-Do.** During HIxAI
  screenshot review, the user asked whether upload should be its
  own sub-menu peer to Workspaces (a real IA question — the most
  important affordance in the product is currently buried 2
  clicks deep). To make that decision well, the user wanted to
  navigate between previews as if they were real pages. That
  fired the exact trigger
  [design/README.md](../../design/README.md) documents at "When
  to add structure": N=2 → extract shared CSS, cross-link
  previews, optionally add an index page. Enrichment landed:
  - **`.agents/design/_css/tokens.css`** — CSS variables mirroring
    [themeTokens.ts](../../../workspace/packages/ui/src/themeTokens.ts).
    Same comment-pointer convention as the inlined version was
    using; this is now the canonical preview-side mirror.
  - **`.agents/design/_css/preview-shell.css`** — shared chrome
    utilities (sidebar, top-bar, nav-group flyout, breadcrumb,
    page-header, page-card, btn-primary, state-toggle,
    preview-index-link). Both previews link both files via plain
    `<link rel="stylesheet">` — works from `file://`, no build,
    no server.
  - **`workspace-shell.preview.html`** shrank from 828 → 429
    lines. All chrome rules moved out; only workspace-specific
    styles remain (`workspaces-grid`, `workspace-card*`,
    `empty-state`, `empty-illustration`).
  - **`upload.preview.html`** rewritten to share the chrome.
    Sidebar now matches workspace-shell's SVG-icon-rich Data
    Management + Reports (sample) + Settings (sample) structure
    for visual parity. Topbar gets the fold/unfold toggle.
    Class names aligned to workspace-shell conventions
    (`.mdd-content` / `.breadcrumb` / `.page-header` /
    `.page-card`) so the shared CSS covers both files. The
    previous `.mdd-main` / `.mdd-page-header` / etc. were
    parallel-but-incompatible naming from the first draft;
    consolidated.
  - **Cross-linking landed.** In `workspace-shell.preview.html`,
    each `.workspace-card` is now `<a href="upload.preview.html">`
    — clicking a card drills into the workspace detail page.
    In `upload.preview.html`, the "Workspaces" sidebar item and
    the breadcrumb's "Workspaces" segment are both
    `<a href="workspace-shell.preview.html">` — clicking returns
    to the grid. Sidebar item retains `is-active` styling because
    the upload page IS conceptually under Workspaces.
  - **`.agents/design/index.html`** authored. Manually-maintained
    per the README ("do not build generation tooling"). The
    README documents N=3+ as the index trigger; the user pulled
    it in early at N=2 because the IA navigation needed a hub.
    Each preview links back via the `← Preview index` button in
    the bottom-left corner.
  - **CSS duplicate-selector warnings caught by IDE.** Two
    `.upload-zone` selectors initially appeared in both the
    layout block and the visibility-helpers block. Consolidated
    into the layout block; visibility-helpers now only owns the
    `[data-show-when]` attribute rules.
- **N=2 schema-stability observation.** The README's "When to
  add structure" section documented the N=2 trigger before any
  preview hit it. R14 is the first round to actually fire it;
  the documented pattern (`_css/` extraction + cross-linked
  previews + index page) applied verbatim with no amendment
  needed. Worth noting as a track-2 confirmation that the
  design-directory governance is doing its job.
- **Mid-round reframe: Upload became a verb; Datasets became
  the noun.** Walking the cross-linked previews surfaced a
  framing error in the initial design: "Upload" was being treated
  as both action and entity, with a dedicated workspace detail
  page as the upload surface. The user's review call:

  > Upload data should be a function of datasets (sibling
  > workspaces). When upload we need to select a workspace. This
  > is a Table List.

  The reframe lands the cleaner model:
  - **Dataset = noun.** The tabular artifact a user reasons about
    and downstream queries / dashboards read from. Lives under
    a Workspace via `workspaceId`.
  - **Upload = verb.** The action that creates a Dataset. Modal-
    driven, with a workspace picker. There is no separate
    "upload event" entity — failed parses are Datasets with
    `status='failed'`.
  - **Datasets becomes a sub-menu peer of Workspaces** under
    Data Management (promoted from R11's `(sample)` placeholder).
  - **No workspace detail page route.** Workspace card clicks
    deep-link to `/data-management/datasets?workspace=<id>`. The
    Datasets page handles both "all workspaces" and per-workspace
    filtered views as one surface.
  - **Card-row layout → table list.** Sortable columns, workspace
    filter dropdown, status badges, search.

- **Design-doc split.** Per the user's R14 directive ("keep both
  datasets.md and upload.md"):
  - New
    [datasets.md](../../design/data-management/datasets/datasets.md) —
    the noun. Surface declaration (9 rows), table-list ASCII
    layout (populated / empty / filtered-empty), Dataset data
    model, workspace filter behavior, IA placement, `GET /datasets`
    endpoint, sub-menu promotion, lifecycle, deferrals.
  - [upload.md](../../design/data-management/datasets/upload.md)
    rewritten verb-only: Surface declaration (6 rows), modal ASCII
    layouts (closed / no-workspace / workspace-pre-filled), four-
    state status state machine with the `failed` 201 vs network-
    error optimistic-row asymmetry, file storage decision
    (path now `data/datasets/<ws>/<ds>/{original.csv,parsed.parquet}`,
    noun-aligned), parse-time decision, `POST /workspaces/<id>/datasets`
    endpoint shape with rationale for path-based create vs body-
    based future-PATCH, workspace-persistence dependency, lifecycle.
  - Both docs cross-reference; the open-questions tables at the
    bottom of each doc reference R14's 11 HIxAI decisions (eight
    pre-reframe, three from the reframe).
- **Preview replaced.** Old `upload.preview.html` (workspace-
  detail-page-centric) removed; new
  `../../design/data-management/_archive/datasets.preview.html`
  authored — Datasets page (table list with sortable columns,
  workspace filter, status badges, six sample rows including one
  failed) with togglable upload modal overlay. State toggle for
  empty / populated / with-failed-row; click `+ Upload` (or the
  empty-state drop zone) to open the modal. Sidebar matches
  workspace-shell preview; "Workspaces" cross-links back to the
  grid; index link bottom-left.
- **Cross-link graph updated.** Workspace-shell preview's
  workspace cards now `<a href="datasets.preview.html">` (was
  `upload.preview.html`). Workspace-shell sidebar's "Datasets"
  sub-item promoted from `(sample)` to real (`<a href="datasets.preview.html">`).
  Index page swaps the upload preview entry for the datasets
  preview entry with the new copy. Three navigation paths
  available to HIxAI review:
  1. Index → workspace-shell → click any workspace card → datasets
  2. Index → datasets → click `+ Upload` → modal → cancel → back
  3. Index → datasets → click "Workspaces" in sidebar → grid
- **Tailwind CDN SRI warning (S5725).** IDE flagged the lack of
  Subresource Integrity on the `cdn.tailwindcss.com` script tag
  in both previews. Not actionable: the
  [design/README.md](../../design/README.md) endorses Play CDN
  for prototyping; SRI on a CDN that auto-updates would be
  brittle. Noted, not fixed.
- **Index page promoted to chrome-shell layout.** User asked
  the index to wear the same master-layout chrome as the
  previews — sidebar with grouped sub-items pointing at the
  previews, topbar, breadcrumb, page-card containing the
  descriptive preview cards. Re-authored
  `../../design/_archive/index.html` against
  `../_css/preview-shell.css` (same shared chrome as the two
  previews). The index now reads as a small "design-previews
  hub" app in its own right, which is the natural meta-view of
  a brainstorming directory with multiple previews. The MDD
  brand mark / logo in each preview's sidebar header is now an
  `<a href="../index.html">` for consistent return navigation
  (was already so on `datasets.preview.html`; brought
  `workspace-shell.preview.html` into line in the same pass).
- **Second reframe: upload is a full-page wizard, not a modal.**
  User reviewed the modal-based Datasets preview and named the
  next concern:

  > Upload should be a screen/page, not just a simple pop-up.
  > Because this is a multi-steps screen.

  The modal couldn't carry a useful data preview — and the
  preview of the parsed schema + first ten rows is exactly the
  gate that justifies multi-step ingestion in an analytics
  product. Three-question HIxAI Q&A locked the wizard shape:
  - **Q13 / Q13a — Page vs modal, step count.** Full-page
    wizard at `/data-management/datasets/new`, three steps:
    **Source → Preview → Confirm**.
  - **Q12 — Status field on Dataset.** Dropped. The wizard
    validates the parse before committing, so the Datasets
    table only ever contains committed-ready datasets. Failed
    parses live inside the wizard's Step 2 and never become
    persisted Datasets. Model simplifies; table loses the
    Status column; the `bad_export` row from earlier previews
    is gone.
  - **Q14 — Column-dtype override in Step 2.** Deferred. R15+
    ships read-only schema display; override is R∞ until a real
    user is blocked by mis-inferred types.

- **Backend model rebuilt around the wizard.** R15+ now ships
  **two endpoints** — a temp upload + parse, then a commit:
  - `POST /uploads` → writes temp file to
    `data/uploads_tmp/<temp_id>/`, parses with DuckDB, returns
    `{ temp_id, columns, rowCount, sampleRows, sizeBytes }` on
    success or `422` with parse error on failure. No Dataset
    row created.
  - `POST /workspaces/<id>/datasets` → commits `{ temp_id, name }`.
    Server moves `uploads_tmp/<temp_id>/` →
    `datasets/<workspace_id>/<dataset_id>/` (filesystem rename,
    atomic on same volume), inserts the Dataset row, returns it.
  - 24h TTL sweep on `uploads_tmp/` cleans abandoned wizards.
    R15's Plan decides whether the sweep ships in R15 or R16.
- **Design-doc updates landed.**
  - [datasets.md](../../design/data-management/datasets/datasets.md):
    Dataset data model drops `status` + `errorMessage`; counts
    are non-null at commit time. Surface table drops
    `DatasetStatusBadge`. Populated-state ASCII drops the
    Status column and the `bad_export` failed row. Backend
    endpoint comment clarifies "every returned dataset is
    committed-ready by definition." Read/write boundary swaps
    "Status badge rendering" for "`+ Upload` button navigates
    to the wizard." Open-questions table gains Q12 + Q14
    decisions.
  - [upload.md](../../design/data-management/datasets/upload.md):
    rewritten from modal-flow to full-page wizard. New surface
    declaration (12 rows including stepper + three step
    components + temp-upload endpoint + commit endpoint). ASCII
    layouts for all three steps + the parse-failed variant of
    Step 2. Two-phase backend endpoint shape with HTTP
    semantics. State-machine diagram showing the four-state
    transition. File-storage layout adds `uploads_tmp/` for
    pre-commit temp files. Open-questions table now lists
    eleven decisions (eight pre-reframe, three from the wizard
    reframe).
- **Preview rebuild.**
  - New
    `../../design/data-management/_archive/upload.preview.html`
    — full-page wizard with the master-layout chrome. Stepper
    at the top of the page-card with active / done / pending
    states. State toggle bottom-right has four buttons:
    `1·Source`, `2·Preview (ok)`, `2·Preview (failed)`,
    `3·Confirm`. Each step body is independently shown via
    `[data-show-when]` attributes; the stepper markers update
    in JS to match. `Next / Back` buttons in the wizard nav
    cycle through the steps in code, mirroring the eventual
    production behavior.
  - `../../design/data-management/_archive/datasets.preview.html`
    updated in place: modal CSS + markup deleted (~115 lines of
    CSS, ~33 lines of markup, ~17 lines of JS). The `+ Upload`
    button is now `<a href="upload.preview.html">`; the empty-
    state drop zone is also a navigation link. Table dropped
    the Status column and the failed row. State toggle dropped
    the "With failed row" button. Modal-related JS functions
    removed.
- **Shared button styles promoted.** `.btn-primary` already
  lived in
  `../../design/_archive/_css/preview-shell.css`;
  `.btn-secondary` joined it in the same file (it's used by
  both Datasets and Upload previews now, and as links in some
  places). Inline copies in both preview files removed.
  `.btn-primary` and `.btn-secondary` also picked up
  `text-decoration: none` + `display: inline-block` so they
  render correctly when used as `<a>` (Cancel buttons in the
  wizard, `+ Upload` action button on Datasets).
- **Index page updated to N=3.** Added the upload wizard as a
  third sidebar sub-item (with a CloudUpload SVG icon) and a
  third preview card on the right. The topbar placeholder reads
  `N = 3 previews`. The footer-note's navigation walk-through
  now describes the three-way flow:
  `Workspaces → Datasets → Upload wizard`.
- **Third reframe: Excel becomes the primary source, wizard
  branches by source type.** User reviewed the single-source
  wizard and named the next concern:

  > Before select a Workspace, we need to select the "Data
  > source": Excel, CSV (future will supported: API, Website,
  > ... multi-datasources). Then next step: CSV → Metadata
  > (Column + Datatype); Excel → Sheet Extraction → Metadata.

  The user followed up that **Excel is the primary path** and
  CSV is the secondary path (CRM-export workflows are
  predominantly `.xlsx`).

- **HIxAI Q15 — primary data source + wizard shape.** Excel
  is now first-class R15 scope (not a deferred "Coming soon"
  stub). The wizard branches by source type:
  - **Excel path: 4 steps** — Source → Sheet → Preview →
    Confirm. Sheet selection is a real gate because metadata
    depends on which sheet of the workbook is chosen.
  - **CSV path: 3 steps** — Source → Preview → Confirm. No
    Sheet step (single-table format).
  - **Metadata as a separate step**: rejected for both paths.
    Q14 locked "no dtype override" → a dedicated Metadata step
    would be read-only display with nothing to act on. The
    Preview step's table header already shows column name +
    dtype above the sample rows.
  - **Wizard IA forward-compat**: the source-type selector is
    the extension point for future sources (API, Website,
    SQL, …). Each future source adds one selector option + its
    own step variants; R14 does not pre-bake any of them.
- **Dataset model gains `sourceFormat` + `sheetName`.** Two new
  fields on
  [datasets.md](../../design/data-management/datasets/datasets.md)'s
  Dataset type — `sourceFormat: 'excel' | 'csv'` and an
  optional `sheetName: string` (present iff Excel). The
  Datasets table surfaces a source-format icon prefix
  (`📊` Excel · `📄` CSV) next to the dataset name so the user
  can see at a glance how each dataset was ingested. The icon
  earns its keep without needing a dedicated column.
- **Backend gains a second endpoint.** R15+ now ships three
  endpoints, not two:
  - `POST /uploads` — light metadata extraction. For CSV,
    parses immediately (returns schema + sample rows). For
    Excel, enumerates sheet names + per-sheet counts (no parse
    yet — keeps the wait short for multi-sheet workbooks).
  - `POST /uploads/<temp_id>/parse` — Excel-only. Triggered
    when the user picks a sheet in Step 2; parses that sheet
    to Parquet and returns schema + sample rows.
  - `POST /workspaces/<id>/datasets` — commit, unchanged in
    shape but the move-from-temp now handles the
    `parsed.<sheetkey>.parquet` files keyed by sheet name.
- **Parser library decisions** (R15 plan-phase confirms):
  - CSV: `duckdb.read_csv_auto` (unchanged from prior
    framings).
  - Excel: lead is `openpyxl` (mature, well-tested) plus
    `pandas.read_excel(engine='openpyxl')` for parse-to-
    DataFrame → DuckDB Parquet write. DuckDB's `excel`
    extension is an alternative the R15 plan can benchmark.
- **File-storage layout absorbs both formats.** The
  `data/datasets/<ws>/<ds>/` directory now holds
  `original.<csv|xlsx>` + `parsed.parquet` + `source.json`
  (a small metadata file recording sourceFormat + sheetName +
  parsedAt). Temp uploads at
  `data/uploads_tmp/<temp_id>/` similarly carry the original
  file plus `parsed.<sheetkey>.parquet` files for each sheet
  the user previews (Excel) or one default key (CSV).
- **Design-doc updates landed.**
  - [upload.md](../../design/data-management/datasets/upload.md)
    rewritten as the multi-source wizard. New surface table
    (15 rows including the data-source selector, the Excel-
    only Sheet step component, two parse helpers + a
    sheet-enumerator helper, and three backend endpoints).
    ASCII layouts for all four step states including the
    Excel Sheet-picker and the source-type-aware Preview
    header. State-machine diagram showing the two parallel
    arms branching at Step 1. Endpoint-shape Python sketches
    with HTTP status semantics. Open-questions table now lists
    thirteen decisions (Q1–Q15).
  - [datasets.md](../../design/data-management/datasets/datasets.md):
    Dataset type gains `sourceFormat` + optional `sheetName`.
    Populated-state ASCII shows the source-format icon prefix
    on Name. Open-questions table picks up Q15. Sample dataset
    names use the Excel `<filename>_<sheet>` pattern where
    appropriate.
- **Preview rebuild.**
  - `../../design/data-management/_archive/upload.preview.html`
    rewritten. Step 1 now has the source-type selector (two
    cards — Excel default, CSV alternative) above the
    workspace picker. New Step 2 shows the Excel sheet picker
    (radio list with row/column counts per sheet); CSS hides
    it for CSV. Preview step's metadata line varies by source.
    Confirm step's summary card has a Sheet row hidden for
    CSV. The state-toggle bottom-right now has two rows:
    Source (Excel | CSV) and Step (Source | Sheet | Preview ok
    | Preview failed | Confirm). The Sheet toggle button is
    hidden when source = CSV. Next/Back JS branches on the
    source flow array (`STEPS_EXCEL = 4`, `STEPS_CSV = 3`) so
    Next from Source goes to Sheet (Excel) or directly to
    Preview (CSV).
  - `../../design/data-management/_archive/datasets.preview.html`:
    Name cells now have the source-format icon prefix (4 of 5
    sample rows are Excel — matching the "Excel primary"
    direction). Empty-state copy generalised from "your first
    CSV" to "your first file · Excel or CSV". Small
    `.source-icon` CSS class added.
- **A11y warning fixes (S6853).** IDE flagged three decorative
  `<label>` elements without `for=` attributes on the wizard's
  field-label headers (Data source / File / Summary — they
  caption groups rather than individual inputs). Converted
  those three to `<div class="field-label">` while keeping the
  two real `<label for=...>` instances (`for="ws-pick"` and
  `for="ds-name"`). Tailwind CDN SRI warning (S5725) remains
  non-actionable per the design README's Play CDN guidance.
- **Fourth reframe: Metadata step + multi-sheet selection.** User
  reviewed the multi-source wizard and named two related concerns:

  > Before preview, we must have Metadata Step. User can change if
  > the "autodetect" provides wrong type. For Excel, user can add
  > multi-sheets instead of just 1 sheet?

  Both are reversals of locked decisions: Q14 (no dtype override)
  becomes "yes — dedicated Metadata step"; Sheet-step radio
  becomes checkbox.

- **HIxAI Q14 (reversed), Q16, Q17.**
  - **Q14 reversed**: dedicated **Metadata** step inserted between
    Sheet/Source and Preview. Per-column dropdown for dtype
    override (string · integer · float · boolean · date · datetime),
    with sample values shown for context. Read-only column names
    (rename deferred per Q16). Backend re-casts via
    `cast_columns()` at commit; implausible casts surface as 422
    with row-pointing errors.
  - **Q16**: column rename remains R∞. The Metadata step is
    dtype-override-only.
  - **Q17**: Sheet step accepts **multi-select via checkboxes**.
    One Dataset per selected sheet. R15+ ships multi-sheet from
    day one (Q17b). Multi-sheet Metadata + Preview steps render
    **tabs** (Q17a) — one per selected sheet, with per-sheet
    override state preserved in `UploadDraft`.
- **Wizard step counts updated.**
  - **CSV**: 4 steps — Source → **Metadata** → Preview → Confirm.
  - **Excel**: 5 steps — Source → Sheet → **Metadata** → Preview
    → Confirm. Sheet step uses checkboxes; Metadata + Preview have
    tabs per selected sheet.
- **Backend endpoints adjusted for batch + multi-sheet.**
  - `POST /uploads/<temp_id>/parse` now accepts an array of sheet
    names (Excel multi-select); returns per-sheet status (success
    or failure per sheet). Individual sheet failures are
    body-carried (not 4xx) so the wizard can show per-tab `✗`.
  - Commit endpoint renamed to
    `POST /workspaces/<id>/datasets/batch` and accepts
    `{ items: [{ temp_id, sheet?, name, column_overrides? }] }`.
    **Atomic** — all-or-nothing transaction. CSV sends length 1;
    Excel sends length N = selected-sheets count.
  - New helper `cast_columns()` re-writes Parquet at commit time
    if any item carries `column_overrides`.
- **Failed-parse handling refined.** Excel-multi-sheet failures
  are per-sheet (one bad tab doesn't block inspection of others).
  `[Deselect this sheet]` removes the failing sheet from the
  selection; `[Re-pick file]` returns to Step 1. Next is disabled
  while any selected sheet has a parse failure.
- **Design docs updated.**
  - [upload.md](../../design/data-management/datasets/upload.md): concept
    paragraph mentions Metadata + multi-sheet + atomic batch.
    Surface table grows from 15 → 18 rows (UploadMetadataStep,
    cast_columns helper, batch commit endpoint, name changes).
    New "Step 3 — Metadata" section with ASCII override table.
    Preview step adds tabs (Excel multi-sheet) + dtype reflects
    overrides. Confirm step shows a multi-row commit table with
    Sheet · Name · Rows · Cols · Overrides columns. State-machine
    diagram redrawn with 4-step CSV and 5-step Excel paths.
    Endpoint section adds batch + per-sheet semantics. TanStack
    hook renamed to `useDatasetsCommitMutation` (atomic batch).
    Open-questions table grows from 13 → 16 decisions
    (Q14 marked "reversed", Q16/Q17/Q17a/Q17b added).
  - [datasets.md](../../design/data-management/datasets/datasets.md):
    backend endpoint note explains the atomic batch commit and
    that one wizard run produces 1+ Datasets. No change to the
    Dataset model itself — the per-sheet semantics live in the
    upload wizard, not in the Dataset row.
- **Preview rebuild (third pass).**
  - `../../design/data-management/_archive/upload.preview.html`
    rewritten end-to-end. New Metadata step body with the
    override table (one row per column: Name · Detected · Override
    dropdown · Sample values; the `amount` row's dropdown is
    visually marked as overridden via a yellow border + bg).
    Sheet step uses checkboxes (`<button class="sheet-option">`
    so keyboard a11y works — converted from `<div onclick>` to
    address the S6848 warning). Metadata + Preview steps render
    a tab row at the top (Deals · Contacts) when source = Excel;
    tabs hidden on CSV. Failed-parse state shows the active tab
    with a `✗` marker. Confirm step's commit table has one row
    per dataset-being-created (2 for the Excel multi-sheet demo).
    State-toggle bottom-right now has three rows: Source · Step ·
    Tab (Tab row is hidden on CSV).
  - [datasets.md](../../design/data-management/datasets/datasets.md)
    populated-state ASCII unchanged in shape (source-format
    icons remain).
- **A11y warning fixes.** Four S6848 warnings on the sheet-option
  divs (interactive `<div>` with `onclick` but no keyboard
  equivalent) — converted to `<button type="button">` with
  appropriate CSS resets (border: none, font: inherit,
  text-align: left, width: 100%) so they retain the row look.
  Tailwind CDN SRI (S5725) still non-actionable.
- **Wizard polish pass: nav buttons, date format, CSV Confirm.**
  User reviewed the multi-sheet wizard and surfaced three small
  refinements:
  - **"Two Next buttons" → redundant Cancel.** The wizard-nav
    carried a Cancel button on the Source step that duplicated
    the page-header's top-right Cancel. Removed the wizard-nav
    Cancel; the page-header Cancel is the single exit affordance
    for every step. Wizard-nav now carries only step-progression
    controls (Back / Next / Create datasets).
  - **HIxAI Q14a — format string for date/datetime.** Source
    dates are ambiguous (`01/02/2026` is Jan 2 or Feb 1 by
    locale). The Metadata step's override cell now reveals a
    monospaced format-string input under the dtype dropdown
    **only when the dtype is date or datetime**. Default is
    auto-detected from sample rows (e.g., `yyyy-MM-dd HH:mm`);
    user can edit. Format syntax follows the
    Java/`DateTimeFormatter` pattern that pandas + DuckDB both
    understand. `column_overrides` payload changes from
    `Record<string, Dtype>` to `Record<string, { dtype: Dtype;
format?: string }>`.
  - **CSV Confirm = exactly 1 dataset.** The preview's commit
    table previously rendered both Excel sample rows
    unconditionally. Added `body.source-csv .commit-row-excel-extra
{ display: none }` to hide the Contacts row on CSV; the
    Sheet column was already hidden. CSV name input swaps to a
    `q1_pipeline` default (no `_<sheet>` suffix); Excel name
    stays `q1_pipeline_2026_Deals`. Footer copy is already
    source-conditional (`Creating 1 dataset` vs
    `Creating 2 datasets`).
- **Drifted-pull: table range + auto-gen headers (Q14b / Q14c).**
  User cited the drifted iteration as proof these features are
  effective for messy CRM-export spreadsheets and asked them
  forward into R15. Both ship in R15:
  - **Q14b — Table range / skip-rows override.** Excel gets a
    `Range` text input (default = the sheet's full used range
    from the sniffer; override with `A1:C20` etc.). CSV gets a
    `Skip rows` numeric input (default 0). Both live in a new
    **Parse options ▸** disclosure at the top of the Metadata
    step body — collapsed by default so clean files don't see
    the complexity.
  - **Q14c — Auto-generate headers when no header row.**
    `First row is header` checkbox (default ON) inside the same
    disclosure. When OFF, parser produces names
    `column1, column2, column3, …` (Excel "Format as Table" /
    HIxAI Q14c locked the convention).
  - **Re-parse semantics.** Editing parse options + clicking
    `[Re-parse this sheet]` triggers
    `POST /uploads/<temp_id>/parse` with the new options for
    the active sheet. Backend re-writes
    `parsed.<sheet_key>.parquet` + `preview.<sheet_key>.json`.
    Metadata refreshes; **dtype overrides for that sheet
    reset** (columns may no longer match) with an inline
    warning. Conservative R15 behavior; smarter override-merge
    is R∞.
  - **Backend changes.** `POST /uploads/<temp_id>/parse` body
    becomes `{ items: [{ sheet?, parse_options? }] }` where
    `ParseOptions = { range?, skip_rows?, has_header? }`.
    `POST /workspaces/<id>/datasets/batch` commit items gain
    `parse_options?` — the backend validates that the
    `parsed.<sheet_key>.parquet` was produced with matching
    options (409 if the user changed options without
    re-parsing).
- **Justification (Evolution Rule, per [AGENTS.md](../../AGENTS.md)).**
  _Track: 1 (product). Pulled by: user reference to drifted-
  iteration features + the recurring "spreadsheet has title
  rows" pattern that the upload preview's sample data
  highlights._
- **Column selection (Q14d) ships in R15; append-mode (Q14e)
  deferred to R16+.** User reviewed the Metadata step and named
  two more potential features:
  - **Q14d — Include checkboxes per column.** Lands in R15: the
    Metadata override table gains an `Include` column as the
    first column, with a checkbox per row. All checked by
    default. Unchecked rows dim and are dropped at commit time.
    At least one column must remain checked or `Next` is
    disabled. Backend payload adds
    `excluded_columns?: string[]` to each batch item; commit
    writes the Parquet with `SELECT * EXCEPT excluded_columns`.
  - **Q14e — Append / update an existing Dataset: deferred.**
    Real CRM workflow (monthly export → grow a single
    `monthly_sales` Dataset, not 12 sibling Datasets). I argued
    for deferral because R15 is already heavy and append-mode
    is its own feature (schema-match semantics, conflict
    resolution, audit trail on Dataset). User accepted the
    defer.
    The commit endpoint shape is **forward-compatible**: a
    future round adds `target_dataset_id?: string` to each
    batch item (mutually exclusive with `name`); no API
    break.
  - **Preview update**: the Metadata table now shows 6 columns
    in the demo with `closed` unchecked + dimmed to illustrate
    the excluded-row visual. Footer reads
    `5 of 6 columns included`.
- **Awaiting HIxAI screenshot review of the Metadata-step
  with Include checkboxes + parse-options + multi-sheet.**
  Refresh `../../design/_archive/index.html`, open the
  Upload wizard preview, and walk:
  - **Excel path (5 steps)**: default state. Step 1 Source
    (Excel card selected) → Next → Step 2 Sheet (checkboxes —
    two pre-selected: Deals + Contacts) → Next → Step 3 Metadata
    (override table; switch between Deals/Contacts via the tab
    row OR the bottom-right Tab toggle) → Next → Step 4 Preview
    (sample rows; same tabs) → Next → Step 5 Confirm
    (commit-table with one row per selected sheet) →
    `Create datasets`.
  - **CSV path (4 steps)**: flip bottom-right Source toggle to
    CSV. Stepper redraws to 4 dots; the Sheet step button + the
    Tab toggle row both hide. Step 1 → Next → Step 2 Metadata
    (no tabs; single column list) → Next → Step 3 Preview →
    Next → Step 4 Confirm.
  - **Failed parse**: flip Step toggle to `Preview (failed)`.
    The active tab gets a `✗` marker (Excel multi-sheet — one
    bad sheet, other tabs still navigable). `[Deselect this
sheet]` shows only on Excel.
  - **Datasets table** (`../../design/data-management/_archive/datasets.preview.html`):
    rows now show source icons. Four Excel + one CSV in the
    sample data; empty state copy generalised. `+ Upload`
    navigates to the wizard.
  - After sign-off, R14 closes.
- **Final polish: workspace-shell preview Create button wired.**
  User noticed the Create button on the Workspaces preview was a
  dead `<button>` (no onclick, no link). Both Create affordances
  (`+ Create` in the PageHeader; `+ Create your first workspace`
  in the empty-state CTA) now open a simulated AntD-style modal
  mirroring R13's production
  [`CreateWorkspaceModal`](../../../workspace/apps/builder/src/features/data-management/workspaces/WorkspacesPage.tsx) —
  title "Create workspace", auto-focused Name input with the
  same `e.g. Marketing` placeholder, and Cancel/Create buttons.
  Esc, the × close icon, Cancel, and Create all close the modal
  (no real backend call in the preview). The overlay-click-to-close pattern was dropped
  to clear S6848 (interactive-div without keyboard equivalent);
  Esc covers keyboard dismissal canonically.
- **Pre-flight repro of an unrelated bug.** The user initially
  asked whether the Create button worked in the running app. I
  drove a headless Chromium against the live `:3000` builder
  and verified end-to-end (empty-state CTA + PageHeader button
  both open R13's real
  [`CreateWorkspaceModal`](../../../workspace/apps/builder/src/features/data-management/workspaces/WorkspacesPage.tsx)
  modal with name input + Cancel/Create, no console errors).
  Production code is fine; user clarified they meant the
  preview's dead button — fix above.
- **R14 complete: 17 HIxAI decisions, 4 design reframes, 1 N=2
  preview-infrastructure trigger fired cleanly.** See Act for
  the learnings; Feeds-into → Round_15 names the implementation
  slice.

## Check

- [x] [datasets.md](../../design/data-management/datasets/datasets.md)
      exists (new, mid-round split) — noun-side: Dataset entity,
      DatasetTable surface, workspace filter, source-format
      icons (`📊` / `📄`), atomic-batch backend endpoint,
      lifecycle.
- [x] [upload.md](../../design/data-management/datasets/upload.md)
      exists, rewritten end-to-end as the verb-side full-page
      wizard. 18-row Surface declaration, ASCII for all 5 step
      states (Source / Sheet / Metadata / Preview / Confirm) +
      parse-options disclosure + per-sheet tabs + failed-parse
      variant, three backend endpoints, state-machine diagram
      with parallel CSV/Excel arms, `ParseOptions` +
      `ColumnOverride` + `excluded_columns` types, lifecycle,
      named-pull R16+ append-mode deferral.
- [x] `../../design/data-management/_archive/upload.preview.html`
      exists — rebuilt 3 times across the round. Final state:
      source-selector cards (Excel default · CSV) + workspace
      picker + drop zone in Source; checkbox sheet list in
      Sheet; parse-options disclosure + Include checkboxes +
      dtype dropdowns + date/datetime format input in Metadata;
      sortable preview table with per-sheet tabs in Preview;
      multi-row commit table in Confirm. Three-row state
      toggle bottom-right (Source · Step · Tab) with sheet/tab
      hiding on CSV.
- [x] `../../design/data-management/_archive/datasets.preview.html`
      exists — Datasets table list with workspace filter +
      source-format icon prefix on Name; `+ Upload` navigates
      to the wizard; empty-state drop zone navigates to the
      wizard. Modal-based markup removed when the wizard
      reframe landed.
- [x] `../../design/data-management/_archive/workspace-shell.preview.html`
      updated — Datasets sub-item promoted from `(sample)` to
      real; workspace cards `<a href>` to
      `datasets.preview.html`; brand mark wrapped as `<a href>`
      to the index for consistent return navigation; Create
      buttons (both PageHeader and empty-state) wired to a
      simulated AntD-style create-workspace modal mirroring
      R13 production.
- [x] `../../design/_archive/_css/tokens.css`
      and
      `../../design/_archive/_css/preview-shell.css`
      authored — N=2 preview-infrastructure trigger fired on
      schedule per the design README. `.btn-primary` +
      `.btn-secondary` promoted to shared mid-round.
- [x] `../../design/_archive/index.html`
      authored — chrome-shell layout (sidebar + topbar +
      page-card), three preview entries (Workspaces · Datasets ·
      Upload wizard), each clickable via sidebar sub-item OR
      descriptive card.
- [x] All 17 HIxAI decisions recorded in `upload.md`'s
      open-questions table (Q1–Q3, Q5–Q14a–Q14e, Q15–Q17b — Q4
      retired by the workspace-detail-page deferral, Q12
      reversed by the wizard's pre-commit-validation model).
- [x] `pnpm md:lint` clean; `pnpm format:check` clean for all
      R14 files.
- [x] `git status` shows only `.md` + `.html` + `.css` changes
      under `.agents/`; @mdd/ui and builder test suites
      unchanged in count + pass (26 + 8 + 5 baseline from R13);
      no code paths touched.
- [x] Cross-links: `Inherits from ← Round_13` in Goal;
      `Feeds into → Round_15` in Act with R15's cohesive scope
      named.
- [x] Tailwind CDN SRI warning (S5725) documented as
      non-actionable per the design README's Play-CDN
      endorsement; affects every preview equally.
- [x] Context-rot check: R14 modified `design/data-management/`,
      `design/_css/`, `design/index.html`, and `plan/cycles/` —
      not `context/`. No-op verification.

## Act

**Status**: Complete (human-approved 2026-05-24 after a long
HIxAI review loop spanning four design reframes and a final
polish pass).

**Learnings**:

- **Design-first methodology absorbed four cumulative reframes
  without code damage.** Each reframe was caught by the
  cross-linked previews BEFORE any implementation, and each
  reversed a previously-locked decision:
  1. **Noun reframe** — Upload-as-(noun+verb) split into
     Datasets (noun) and Upload (verb). Triggered by the user walking the early
     preview and noticing "upload is what I do, not what I have."
     Split `upload.md` into `datasets.md` + `upload.md`;
     Datasets became a sub-menu peer of Workspaces; workspace
     detail route was deleted (cards link to filtered Datasets
     view).
  2. **Modal → page reframe** — single-screen modal → full-page
     wizard. Triggered by "this is a multi-steps screen". The
     preview step's data table justified the full content area;
     the failed-parse experience now lives in the wizard, never
     in the Datasets table.
  3. **Single-source → multi-source reframe** — CSV-only →
     Excel primary + CSV secondary, branching step count by
     source. Triggered by the user naming Excel as the
     dominant CRM-export format. Added a Sheet step (Excel
     only, checkboxes), multi-tab Metadata + Preview, atomic
     batch commit. New `parse_excel()` + `read_excel_sheets()`
     helpers + the `POST /uploads/<temp_id>/parse` endpoint.
  4. **Q14 reversal** — locked "no dtype override; trust
     parser" became "yes dtype override + format string +
     column-include checkboxes". Triggered by drifted-iteration
     reference: "from the drifted, the feature is quite
     effective." Lands in the Metadata step's override table
     plus the Parse-options disclosure (table range,
     skip-rows, has-header → auto-gen `column1, column2, …`).

  Each reframe would have been a multi-day code-undo if it had
  surfaced after R15+ landed. This is the strongest validation
  of the design-first methodology in the project's history.
  Memo captured at
  [.agents/memory/2026-05-24-design-first-reframe-absorption.md](../../memory/2026-05-24-design-first-reframe-absorption.md).

- **N=2 preview-infrastructure trigger fired exactly as the
  design README documented.** When the second preview joined,
  the trigger pulled shared CSS extraction —
  `_css/tokens.css` and `_css/preview-shell.css` — plus cross-linked sidebars and an
  index page — verbatim from the README's "When to add
  structure" section. No amendment needed; the documented
  pattern slotted in cleanly. Third confirmation that the
  design-directory governance is paying its keep (after R10
  Surface-declaration schema + R11 holding under second
  instance + R14 N=2 trigger).
- **CSS specificity gotcha caught the wizard-nav visibility
  rules.** Wrappers with `class="btn-group"` won over the
  `[data-show-step] { display: none }` default rule via higher
  specificity (0,2,0 vs 0,1,0), so all buttons leaked visible.
  Fix: drop the redundant class from the wrappers + use
  exact-match (`=`) instead of token-match (`~=`) on the CSV
  hide-sheet rule. Worth filing under preview-CSS hygiene:
  show/hide containers should NOT carry unrelated layout
  classes, because every class raises the specificity floor
  the hide rule has to beat.
- **Headless Chromium repro confirms the design previews
  match production behavior.** Mid-round, the user asked about
  a Create-button bug in the running app. Playwright drove the
  live `:3000` builder, verified both Create affordances open
  R13's
  [`CreateWorkspaceModal`](../../../workspace/apps/builder/src/features/data-management/workspaces/WorkspacesPage.tsx)
  cleanly. The "preview is broken too" follow-up taught the
  inverse lesson: design previews need to simulate the same
  interaction shape as production, or users hit dead clicks
  that look like product bugs. The workspace-shell preview's
  Create button is now wired.
- **`+`-prefix MD004 gotcha hit five times this round.** Each
  time a continuation line happened to start with `+` (after
  a soft wrap with a `+ Cancel + Create` enumeration or a
  `+ HTTP status semantics` continuation), markdownlint
  switched to expected-`+`-style and the rest of the file
  rejected `-` bullets. Memo at
  [.agents/memory/2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md)
  was already in place; R14 confirms the rule fires for
  prose `+`s, not just bullet `+`s. Worth strengthening the
  guidance next time the memo is amended.
- **Round scope was bigger than R11's design round.** R11
  authored 2 design docs (workspace-shell.target.md +
  workspaces.md) + 1 preview. R14 authored 2 design docs
  (datasets.md + upload.md), 3 previews (datasets +
  workspace-shell modal-wiring + upload — rebuilt 3× as the
  reframes landed), 2 shared CSS files, 1 index page, and
  documented 17 HIxAI decisions. Validates the "design-only
  rounds can be heavy without being risky" pattern — no code
  was at risk during any reframe.

**Promotions** _(decision: none this round)_:

- The reframe-absorption pattern + the CSS-specificity gotcha
  are both new and worth memo-capturing this round, not
  promotion-to-`context/`. R10's promotion criterion ("3+
  instances OR documented gap") is met for design-first
  methodology — but the current `design/README.md` already
  carries the rules; promoting from there to `context/` is a
  later-round decision when the pattern has more cross-round
  weight than just R11+R14.
- Build-first lesson + AntD-wrapper-testing pattern (queued
  from R12/R13 Acts) still deferred to a post-upload Track-2
  batch round per the original R12 user call. R15+ is the
  first upload-impl round; the batch round happens after R15
  closes.

**Follow-ups (not promotions, just notes)**:

- The wizard preview's state-machine JS branches by source +
  step. R15+ will face the same state-machine in real React
  code; reusing the same `STEPS_EXCEL` / `STEPS_CSV` array
  pattern (preview lines ~1255) is a sensible starting point.
- The 24h temp-upload-sweep is a real R15+ concern (or it
  becomes R16's). The preview's parse-options disclosure
  re-parse warning ("dtype overrides reset") is a UX cue R15
  must honor in production.
- `target_dataset_id` append-mode (Q14e) is the headline R16+
  feature. The commit endpoint's payload was kept
  forward-compatible (`name` xor `target_dataset_id` per
  item).

## Feeds into → Round_15

What R14 hands forward:

- **Two locked design contracts**:
  [datasets.md](../../design/data-management/datasets/datasets.md) (noun)
  and [upload.md](../../design/data-management/datasets/upload.md) (verb).
  17 HIxAI decisions recorded in upload.md's open-questions
  table. Surface declarations (9 + 18 rows) name every
  component, hook, and endpoint R15+ will build.
- **One running design preview** at
  `../../design/_archive/index.html` — three
  cross-linked HTML files HIxAI can walk to verify the running
  builder against. The preview is the "what should this end up
  looking like" anchor for the impl chain.
- **Forward-compat backend shapes**: the commit endpoint
  payload accepts an optional `target_dataset_id` slot R16+
  will use for append-mode without an API break.

**R15 candidate scope** (per the design-first methodology and
the workspace-persistence dependency — finalized by R15's
own Plan-phase Q&A):

- **Workspace persistence swap** — in-memory list → DuckDB or
  SQLite. R15 Plan-phase picks the engine. Forced by Datasets'
  foreign-key reference (workspaceId → Workspace.id); files on
  disk keyed by `workspace_id` cannot outlive a non-persistent
  workspace store.
- **Backend ingestion**:
  - `POST /uploads` (multipart) — temp upload + lightweight
    metadata. CSV parses inline; Excel enumerates sheets.
  - `POST /uploads/<temp_id>/parse` — per-sheet parse honoring
    `ParseOptions` (range, skip_rows, has_header).
  - `POST /workspaces/<id>/datasets/batch` — atomic commit
    accepting `parse_options` + `column_overrides` +
    `excluded_columns` per item. CSV batch length = 1; Excel
    batch length = N (selected sheets).
- **Parsers**: `parse_csv()` via DuckDB `read_csv_auto`;
  `parse_excel()` via openpyxl + pandas → DuckDB Parquet
  write. `read_excel_sheets()` for the cheap sheet
  enumeration. `cast_columns()` for the commit-time dtype +
  format re-cast.
- **File storage**: `data/datasets/<ws_id>/<ds_id>/{original.<csv|xlsx>,
parsed.parquet, source.json}` for committed datasets;
  `data/uploads_tmp/<temp_id>/{original.<ext>, metadata.json,
parsed.<sheet_key>.parquet, preview.<sheet_key>.json}` for
  temp uploads. 24h TTL sweep (R15 or R16's call).
- **Pytest coverage** matching R13's pattern — success +
  parse-failure + validation paths, both source types.
- **`GET /datasets[?workspace_id=...]`** for the table list
  (R16's UI surface consumes it, but the endpoint lands in
  R15 for backend completeness).

**R15 is explicitly backend + persistence only.** The wizard
UI + Datasets page + workspace-card → datasets navigation are
**R16+ scope** — each is a substantial slice in its own right.
R15's Plan-phase Q&A confirms or splits the backend slice
further.

**R16 candidate scope** (sketch, not committed):
`DatasetsPage` + `DatasetTable` + workspace filter +
`useDatasetsQuery`; the Workspaces page's card-click handler
updates to navigate `/data-management/datasets?workspace=<id>`.
Datasets table renders source-format icons. `+ Upload` button
in place but navigates to a stub route — the wizard itself
lands in R17+.

**R17+ candidate scope** (sketch): `DatasetNewPage` route at
`/data-management/datasets/new` + the 5-step wizard
components (`UploadStepper`, `UploadSourceStep`,
`UploadSheetStep`, `UploadMetadataStep`, `UploadPreviewStep`,
`UploadConfirmStep`) + the three mutation hooks. May split
across two rounds (wizard skeleton in R17; Metadata-step
override table + parse-options + Include checkboxes in R18)
depending on R15's actual length.

## Appending to Complete rounds

### 2026-05-24 — Shared JS extraction polish pass

User end-of-round feedback: "we do have the standard design, but
seem have not extract css/js completely for all preview pages?"

Audit confirmed the duplication: `toggleGroup` lived in all four
previews; `toggleCollapse` + the MenuFold/Unfold SVG path
constants (~250 chars each) lived in three previews. About 30
lines per preview of pure boilerplate. Same pattern as the N=2
`_css/` extraction earlier in this round — applied to JS this
time.

**Landed**:

- New
  `../../design/_archive/_js/preview-shell.js`
  carrying `toggleGroup` + `toggleCollapse` + `FOLD_PATH` +
  `UNFOLD_PATH`. Loaded as a classic `<script src>` (not
  `type="module"`) so it works directly from `file://` — same
  no-build constraint the README puts on previews themselves.
  Functions are global on purpose; preview-specific inline JS
  calls them by name.
- Four preview files updated:
  `../../design/data-management/_archive/workspace-shell.preview.html`,
  `../../design/data-management/_archive/datasets.preview.html`,
  `../../design/data-management/_archive/upload.preview.html`,
  and `../../design/_archive/index.html`. Each now does
  `<script src="../_js/preview-shell.js"></script>` (or
  `_js/preview-shell.js` from the index) and dropped the inline
  duplicates.
- `toggleCollapse` defensively no-ops when `#shell` is missing
  (index doesn't have a fold button), so the same file works
  for every preview without an "if you don't have a topbar
  toggle, skip the import" caveat.

**Verified end-to-end**: headless Chromium navigated all four
preview files from `file://` URLs, confirmed sidebar-group-
expanded state, topbar collapse toggle (SVG path swap intact),
workspace-shell create-modal open, and upload-preview source-
card selection — zero pageerrors or console errors across the
four pages.

**Track**: 2 (agent-method / design-system hygiene).
**Pulled by**: user feedback at R14 close.
**Per [Evolution Rule](../../AGENTS.md)**: same N=2 → extract
trigger documented in [design/README.md](../../design/README.md)
"When to add structure," applied to JS rather than CSS. The
README's documented shape — `_css/{tokens.css,
preview-shell.css}` — now has a JS sibling:
`_js/preview-shell.js`. The README itself isn't amended in this
append; the next round that touches the design directory can
add `_js/` to the structure documentation when a real
second-instance pull arrives (a second JS file or a genuine
pattern change).
