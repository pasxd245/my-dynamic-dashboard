# Round 23: D-round — CRUD hygiene (workspaces + datasets)

**Status**: Complete
**Date started**: 2026-05-25
**Date completed**: 2026-05-25

## Goal

**Inherits from ← [Round_22](Round_22.md)** — R22 promoted the
"D-step picks the chain" framing to `context/` and deferred
`skills/` until a non-data-ingestion-domain feature lands a DCBF
chain. The user pivot at R22's Q&A: **complete the
workspaces + datasets POC/MVP first**, then resume track-2/3
work. R23 starts that pivot.

R23 is a DCBF **D-round** — design only — for **CRUD hygiene
across workspaces and datasets**: rename + delete affordances on
both resources, plus the cascade rule for what happens to a
workspace's datasets when the workspace is deleted. Picked at
the R22 → R23 handoff as the next POC/MVP gap: the demo needs
basic resource management beyond create-via-upload.

**Feature framing — one enhancement, two resources.** The user
explicitly framed this as **"enhancement feature (DCBF)"** at
brainstorm time, resolving the would-be cadence tension between
"workspaces CRUD" and "datasets CRUD" as separate features. The
read: same operations (rename + delete), same UX patterns
(confirmation, optimistic update, cascade reasoning), two
resources. Structurally parallel to the parse-options chain
(R19→R21) — one feature, two consumers (CSV + Excel there;
workspaces + datasets here).

Per the new "D-step picks the chain" rule, this round's job is
**not** to spawn four downstream rounds by default; it is to:

1. **Design the CRUD hygiene surface** to the level where
   contract / BE / FE scope becomes obvious — _and produce a
   visualization the user can react to_ (see "D-round
   philosophy" below).
2. **Resolve the load-bearing UX questions** in-round through
   HIxAI Q&A: cascade-on-workspace-delete, confirmation UX,
   rename scope. Each answer changes the contract shape, so
   they're D-round work, not C-round work.
3. **Declare the chain** — almost certainly full DCBF (four new
   endpoints, none in the R15 contracts) but confirmed at
   round-end against the actual design, not assumed.

### D-round philosophy: see before do

Agreed with the user at R23 kickoff: **a D-round is not merely a
design doc — it is the cheapest place to put a visualization in
front of the user so they can react before the team spends effort
on code.** Feedback sooner is feedback that costs less. R14 and
R19 both shipped `*.preview.html` alongside their markdown
designs and benefited; R23 elevates this from tacit practice to
required deliverable.

Operating consequences:

- **Preview is the default deliverable for a UI-bearing feature,
  not an afterthought.** The round assumes it ships alongside
  the markdown unless the round-runner (human or autoagent)
  states a specific reason to skip in Do. Default-on, skip with
  stated reason — softer than "required," so the autoagent /
  autopilot path stays open to skip when the shape doesn't
  warrant a fresh preview.
- **Legitimate skip cases include**: the feature is BE-only with
  no UI surface; the visual surface is fully covered by an
  existing preview (e.g., adding a single button to an already-
  mocked page); the feature is so trivial visualization would
  add no clarity; or the autoagent is operating unattended and
  judges the preview cost outweighs its asynchronous-feedback
  value for this specific feature. The point is judgement, not
  a checkbox.
- **The HIxAI Q&A loop runs against whatever artifact the user
  reacts to**, ideally the preview when one ships. Questions get
  framed in terms of what the user sees: layout, affordances,
  empty states, failure states, edge cases. Answers absorb into
  the design doc, and into the preview if it shipped, in
  lockstep.
- **For non-UI features** (BE-only contract introduction, schema
  migrations, infra), the equivalent is whatever artifact lets
  the user see the shape cheapest — an example payload, a
  sequence diagram, a CLI session transcript. Same principle,
  different medium.

This philosophy is currently scoped to R23 as a working agreement.
A future evaluation round (post-POC/MVP, per the user's track-2/3
freeze) can decide whether to promote it into
[context/contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)
as a sixth principle, or amend the
[design-first-reframe-absorption memo](../../memory/2026-05-24-design-first-reframe-absorption.md)
with the viz-first sub-rule. Captured in Follow-ups so the
methodology-evaluation gate doesn't lose this thread.

_Track: 1 (product — POC/MVP completion). Pulled by user explicit
pivot at end-of-R22 Q&A: "I wanna complete the first POC/MVP
(workspaces + datasets) ... After finish this, we will pay
attention on developing track2&3." Expectation set: **"ready for
autoagent, autopilot move forward."** That north star shapes
choices but is not this round's deliverable._

## What is IN scope

- **Design doc** `crud-hygiene.md` in
  [.agents/design/data-management/](../../design/data-management/).
  Match the existing
  [upload.md](../../design/data-management/upload.md) /
  [datasets.md](../../design/data-management/datasets.md) shape:
  concept paragraph, status header, sibling-doc cross-links.
  Cross-link _from_
  [workspaces.md](../../design/data-management/workspaces.md)
  and [datasets.md](../../design/data-management/datasets.md)
  in the "Sibling docs" rows (verb-to-noun pattern, matching
  how upload.md hangs off datasets.md).
- **`crud-hygiene.preview.html`** as the default visual
  deliverable — both surfaces (workspace card with rename/delete
  affordances; datasets-table row actions) in one preview HTML
  so the user sees the patterns side-by-side. Per the D-round
  philosophy, soft-skip with stated reason allowed; but for
  CRUD hygiene the surface is genuinely novel (no existing
  preview covers it) and the UX questions below are exactly
  the kind that prose can't resolve cheaply.
- **Four endpoint shapes resolved at design time**:
  - `PATCH /workspaces/{id}` — rename body shape (just name?
    name + description?), conflict semantics (409 on dup name?),
    response.
  - `DELETE /workspaces/{id}` — cascade rule (see load-bearing
    question below), idempotency, response codes.
  - `PATCH /datasets/{id}` — same shape question as workspaces;
    decide whether to share a `Renamable` payload schema or
    keep per-resource shapes.
  - `DELETE /datasets/{id}` — cleanup semantics (does the
    underlying parquet file get deleted? when?), response.
- **Load-bearing UX/design questions** resolved in-round (each
  changes the contract):
  1. **Cascade-on-workspace-delete**: block when non-empty?
     cascade-delete the datasets? require "move datasets first"?
     soft-delete with undo window? Most consequential — drives
     the workspace DELETE response, the FE confirmation flow,
     and whether `DELETE /workspaces/{id}` needs a `?cascade=`
     query parameter.
  2. **Confirmation UX**: simple yes/no modal? type-the-name
     to confirm? soft-delete + trash bin + undo? Hard-delete +
     toast with undo timer? Different choices map to different
     wire shapes (sync DELETE vs DELETE-then-restore).
  3. **Rename scope**: name only, or name + description /
     metadata? Smaller is faster; larger removes a future
     round's pull. Lean: name-only until a second pull
     surfaces.
  4. **Optimistic vs pessimistic UI**: optimistic update with
     rollback on error, or block-on-server? Affects TanStack
     Query usage but not the wire.
- **Chain declaration** at round-end with one-line per-phase
  justification, citing
  [contract-driven-feature.md § What the D-step decides](../../context/_archive/contract-driven-feature.md).
- **Chain declaration** at the end of the round — explicit
  statement of which downstream rounds (if any) inherit from
  R23, and what each is on the hook for. Cites R22's "What the
  D-step decides" rule.
- **HIxAI Q&A loop** absorbed in the design itself, per the
  [design-first-reframe-absorption memo](../../memory/2026-05-24-design-first-reframe-absorption.md).

## What is OUT of scope (explicit deferrals)

- **No contract / BE / FE code in R23.** D-round means design
  only. Any code that ships is wrong-shape work for this round —
  surface and stop.
- **No methodology amendments.** R22 just landed. No new
  promotions to `context/` or `memory/` for the methodology
  itself this round — that's a different track.
- **No `skills/` re-evaluation.** R22's unblocker is specific:
  the new feature lands a DCBF chain in a non-data-ingestion
  domain. R23 may or may not satisfy that — but the evaluation
  is a future round's job, not R23's.
- **No autoagent / autopilot infrastructure work.** That's the
  north star, not this round's deliverable. The product side
  needs to land first.
- **No carry-over follow-ups** (visual verification of R21,
  loading-mask round, AntD deprecations, reducer refactor).
  Each is a separate pull, not part of R23.

## Plan

- [x] Brainstorm and pick the feature with user: **CRUD hygiene
      (workspaces + datasets)**, framed as one DCBF
      enhancement feature.
- [x] Read sibling design docs
      ([upload.md](../../design/data-management/upload.md),
      [datasets.md](../../design/data-management/datasets.md),
      [workspaces.md](../../design/data-management/workspaces.md),
      [workspace-shell.target.md](../../design/data-management/workspace-shell.target.md))
      to understand existing concept vocabulary the new design
      must extend.
- [x] Resolve the four load-bearing UX/design questions through
      HIxAI Q&A, in order of consequence (cascade rule first).
- [x] Draft `crud-hygiene.md` in
      [.agents/design/data-management/](../../design/data-management/),
      matching the existing header shape: concept paragraph,
      status, round stamps, sibling cross-links.
- [x] Build `crud-hygiene.preview.html` alongside the markdown.
      Per the D-round philosophy this is the default; CRUD
      hygiene's surface is novel enough that the preview earns
      its place.
- [x] Cross-link the new doc from
      [workspaces.md](../../design/data-management/workspaces.md)
      and [datasets.md](../../design/data-management/datasets.md)
      sibling rows (additive R23 stamps; no rewrites).
- [x] **Chain declaration**: full DCBF — R24 (C), R25 (B),
      R26 (F). Recorded under Act § Feeds into. Cites
      [contract-driven-feature.md § What the D-step decides](../../context/_archive/contract-driven-feature.md).
- [x] `pnpm md:lint` (repo-wide) and `pnpm format:check` for
      R23-touched MDs.
- [x] Post-round audit per [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this file for unticked `- [ ]` before flipping to
      Review.

## Risks / unknowns

- **Brainstorm scope creep.** The "complete POC/MVP" frame
  invites bundling ("if we're touching X, why not Y?"). Honor
  the single-feature-per-round cadence; spinoff candidates land
  in Follow-ups, not in R23's design.
- **Chart-builder over-pull.** If the user picks the chart
  builder, the feature likely exceeds one D-round — the design
  itself decomposes into "chart configuration" + "chart
  rendering" + "dashboard composition." Surface this early; if
  the feature genuinely needs design decomposition, split into
  R23 (one slice) + a future round (next slice) before drafting
  the design doc.
- **Contract already in place?** Per the R19 precedent, the
  C-step can collapse if a relevant contract already exists.
  Worth checking the existing
  `../../../contracts/` directory during the D-round
  for any endpoint shape that already covers the picked feature.
- **Preview-build cost.** Previews paid back on upload +
  parse-options at roughly half a round's effort. Per the
  D-round philosophy this round adopts, the preview is the
  default for UI-bearing features (skip with stated reason) —
  so the cost is baked into R23's scope when it applies. If
  brainstorming surfaces a feature whose preview alone would
  exceed one round, that is a scope-too-large signal and the
  feature itself needs slicing, not the preview deferred.
- **Track-1 freeze on track-2/3 work.** Per the user pivot, no
  methodology amendments / skill scaffolding / governance edits
  in R23 or its downstream chain. If the round surfaces a
  methodology learning, capture it as a follow-up for a future
  evaluation round; do not amend `context/` or `memory/`
  mid-product-track without explicit user authorization.
- **POC/MVP scope is implicit.** The user has not written down
  the explicit POC/MVP definition-of-done. R23's brainstorm
  should at least name the remaining gaps (in this round's Do
  log) so future rounds inherit the picture, even if R23 only
  closes one of them.

## Do

### Brainstorm — feature pick

User picked **CRUD hygiene across workspaces + datasets** at the
R22 → R23 handoff. Framed as **"enhancement feature (DCBF)"** —
one cohesive feature spanning two resources, structurally
parallel to the parse-options precedent (one feature, two
source-format consumers).

Considered and deferred (these come back as future rounds, not
now):

- **Dataset detail / row preview** (`/datasets/:id`) — the
  read-side counterpart to upload. Closes the "I uploaded, now
  what?" gap. Strong R24+ candidate; would test R22's `skills/`
  unblocker (different domain shape — read-side).
- **Chart / visualization builder** — headline feature, too
  large for one D-round.
- **Dataset schema editing** post-commit — adjust dtypes,
  rename columns, mark PII.

CRUD hygiene was picked because the POC/MVP demo needs basic
resource management before showing dataset-detail or chart
features — without delete/rename, the workspace + datasets list
becomes write-once garbage. Smallest gap that meaningfully moves
the POC toward demo-ready.

### Load-bearing UX/design questions

_Resolving with user, in order of consequence. Answers absorb
into the design doc and preview HTML in lockstep._

1. **Cascade-on-workspace-delete** — **resolved: block when
   non-empty (HTTP 409).** BE refuses `DELETE /workspaces/{id}`
   if the workspace has datasets; response body names the count
   so the FE can show "This workspace has N datasets — delete
   them first or move them." Smallest correct shape for POC;
   no data-loss risk; no cascade-bug class; future round can
   add opt-in `?cascade=true` if friction surfaces. Contract
   consequence: `DELETE /workspaces/{id}` has two response
   codes — `204 No Content` on success, `409 Conflict` with
   `{ datasetCount: number }` body on non-empty.
2. **Confirmation UX** — **resolved: simple modal with
   destructive button.** Standard AntD `Modal.confirm` /
   `Popconfirm` pattern: title shows the resource name being
   deleted; body is a one-liner; primary action button styled
   `danger`. No type-the-name gate, no soft-delete/undo toast.
   Right weight for POC — no critical-data scenarios, and the
   confirmation modal already gates the destructive action.
3. **Rename scope** — **resolved: name only.** PATCH body is
   `{ name: string }` for both resources. Workspace names
   unique globally (409 on collision); dataset names unique
   within workspace (409 on collision). Description editing,
   tags, and metadata mutability remain out of scope this round
   — pulled as follow-ups when concrete need surfaces.
4. **Optimistic vs pessimistic UI** — **resolved: pessimistic
   for both, with loading state.** Mutations show a spinner on
   the affected row/card and block until the server responds.
   TanStack Query usage stays simple (`mutate` + `invalidateQueries`);
   no `onMutate` / `onError` rollback code. Matches the wizard's
   existing pessimistic style; optimistic UX can be a focused
   future round if rename feels sluggish in practice.

### Design doc + preview

- [crud-hygiene.md](../../design/data-management/crud-hygiene.md)
  drafted. Matches the existing
  [datasets.md](../../design/data-management/datasets.md) /
  [upload.md](../../design/data-management/upload.md) shape:
  concept paragraph, status header, sibling cross-links, surfaces
  layer table, ASCII layouts for both affordance surfaces and all
  six modal states, wire shape, state-management, BE endpoint
  shape, lifecycle, out-of-scope deferrals, HIxAI Q&A table.
- [crud-hygiene.preview.html](../../design/data-management/_archive/crud-hygiene.preview.html)
  drafted. Two-surface toggle (Workspaces page / Datasets page)
  alongside six modal-state toggle (rename, rename loading,
  rename 409 error, delete-dataset confirm, delete-workspace
  confirm, delete-workspace blocked). Reuses the shared shell chrome
  via `../_css/{tokens,preview-shell}.css`. The overflow menus
  are shown open on one card / row each so the affordance is
  visible without a hover state.
- Cross-linked from
  [workspaces.md](../../design/data-management/workspaces.md)
  and
  [datasets.md](../../design/data-management/datasets.md)
  sibling rows. Both rows name R23 as the round that closes
  the R∞-deferred CRUD gap each existing doc had under "Out of
  scope."
- **Preview index updated** ([.agents/design/index.html](../../design/_archive/index.html)):
  added the CRUD hygiene entry to both the sidebar nav-items
  block and the preview-card list, and bumped the topbar count
  from `N = 3 previews` to `N = 4`. Per the index's own
  inline comment, this is a manual update on every preview-
  shipping round — no generation tooling.

### Resolved contract shape (preview, formalized in C-round)

Four endpoints, four wire shapes:

```text
PATCH  /workspaces/{id}     body: { name: string }
                            200: Workspace
                            409: { code: "name_taken" }
                            404: { code: "not_found" }

DELETE /workspaces/{id}     204: (success)
                            409: { code: "non_empty",
                                   datasetCount: integer }
                            404: { code: "not_found" }

PATCH  /datasets/{id}       body: { name: string }
                            200: Dataset
                            409: { code: "name_taken" }
                            404: { code: "not_found" }

DELETE /datasets/{id}       204: (success — underlying parquet
                                  deleted in same transaction)
                            404: { code: "not_found" }
```

The 409 bodies are deliberately shaped so the FE can branch on
`code` without parsing free-text messages. `non_empty` carries
the dataset count so the FE message is precise. `name_taken` is
shared between rename PATCH on both resources for a
single-branch FE handler.

### Scope reconsideration — autopilot-readiness prerequisites

At post-design Q&A, user surfaced three cross-cutting concerns
that need to be clear before autoagent/autopilot can operate
reliably:

1. **UX infrastructure** — global toast configuration, page-
   level loading masks, list skeletons, central mutation-error
   boundary. Carried over from R19/R20/R21/R22 deferrals.
2. **Application config + theme** — backend `Settings` class
   for env vars (currently port/host/CORS are hardcoded in
   `app/main.py` and `app/__main__.py`); frontend
   `config.ts` / `env.ts` typed env-var wrapper; AntD
   `ConfigProvider` wired with centralized theme tokens (the
   preview CSS has `tokens.css` but the running app has none
   in TS).
3. **Constants / enums audit** — `"csv"` / `"excel"` literals
   at 16+ sites (type-safe via `SourceFormat` union but not
   centralized); TanStack query keys (`['workspaces']`,
   `['datasets']`) inline at every call site; AntD message
   types inline; new R23 error codes (`name_taken`,
   `non_empty`, `not_found`) need centralization too.

All three reconsidered and held off R23 with the same logic:

- **Each is cross-cutting infrastructure**, not feature-local.
  Bundling into the CRUD chain would let one feature's needs
  shape the global pattern — under-shooting risk that's worse
  here than it would be feature-locally.
- **The CRUD chain already does the locally-correct thing**:
  error codes are named in the contract, query keys are tagged,
  modal copy is parameterized. R24-R26 implementers carry the
  discipline forward inline; they do not invent a global
  framework mid-chain.
- **Calibrated current state** (from a brief codebase audit):
  what's clean — env-var DB path, hand-aligned types, typed
  closed unions, centralized API clients per resource. What's
  noisy — hardcoded BE port/host/CORS, no FE config/constants
  modules, no theme in TS, magic strings at 16+ sites. The
  noisy side warrants focused design rounds, not feature-side
  bundling.

**Decision: defer all three to a post-R26 autopilot-readiness
track.** Three named D-rounds, each focused, can parallelize:

- **R-A** (post-R26): UX-infrastructure design.
- **R-B** (post-R26): App config + theme design — BE Settings
  class, FE typed env, AntD `ConfigProvider` theme tokens.
- **R-C** (post-R26): Constants / enums audit + conventions —
  promote magic strings to a `constants/` module per package,
  set the linting bar against new magic values.

The three together unlock autoagent/autopilot; running them in
parallel post-R26 (when CRUD + parse-options + upload give
three real consumers to inform the design) is the cleanest
path.

**Guidance for R24-R26 chain implementers**:

- Use `message.success` / `message.error` and
  `<Button loading>` inline at each mutation site. Do NOT
  build global toast config or page-level masks this chain.
- Use named constants for the four error codes the contract
  introduces (`'name_taken'`, `'non_empty'`, `'not_found'`)
  — at minimum a `const ERROR_CODES = { ... } as const`
  inline in the feature module. Do NOT scatter the strings.
- Use named constants for the new TanStack query keys
  (`WORKSPACES_QUERY_KEY`, `DATASETS_QUERY_KEY`) — inline
  in the feature module. R-C will promote these to a shared
  module if a pattern emerges.
- Do NOT regress: don't add new `"csv"` / `"excel"` literals
  at fresh sites; route through `SourceFormat` only.
- Do NOT pre-emptively design a global config or theme
  module — that's R-B's scope, and inventing it now (with
  only CRUD as input) would force a re-design.

These rules apply only to NEW code R24-R26 adds. They do not
require auditing existing magic-value sites — that is R-C's
job.

## Check

- [x] Feature named (CRUD hygiene across workspaces + datasets) + framing (one enhancement, two consumers) recorded in
      Do § Brainstorm.
- [x] Design doc
      [crud-hygiene.md](../../design/data-management/crud-hygiene.md)
      lives in `.agents/design/data-management/`, matches the
      existing concept-paragraph + status-header + sibling
      cross-links shape.
- [x] All four HIxAI Q&A answers absorbed into the design doc
      body — both as inline prose and as the bottom "Open
      questions answered in R23" table.
- [x] Preview HTML
      [crud-hygiene.preview.html](../../design/data-management/_archive/crud-hygiene.preview.html)
      built; two-surface toggle + six modal states; reuses
      shared shell CSS.
- [x] Chain declaration in Act § Feeds into names R24 (C),
      R25 (B), R26 (F) with one-line per-phase justifications.
- [x] Sibling design docs cross-link the new doc in their
      "Sibling docs" rows.
- [x] Preview index ([design/index.html](../../design/_archive/index.html))
      updated with the CRUD hygiene sidebar item, preview-card
      entry, and `N = 4` count bump.
- [x] `pnpm md:lint` 0 errors repo-wide.
- [x] `pnpm format:check` clean for R23-touched MDs (R04 + R18
      prettier carry-overs persist as expected; not R23's job).
- [x] All Plan + Check checkboxes flipped `[x]` before Status
      moves to Review.

## Act

**Status**: Complete (human-approved 2026-05-25).

**Learnings**:

- **One enhancement, two consumers is a coherent feature shape.**
  Reframing "workspaces CRUD + datasets CRUD" as one CRUD-
  hygiene feature held throughout the design — same modal
  components, same mutation hook shape, same 409-error code
  surface. Two instances of this pattern now (parse-options
  R19→R21 was the first); a third would meet the Evolution
  Rule's threshold for promoting the "one feature, N consumers"
  framing into the methodology.
- **The cascade question was the load-bearing decision.** Once
  "block when non-empty (409)" was picked, every downstream
  shape question (modal copy, error code, FE branching) flowed
  from it. Resolving the cascade first kept the subsequent
  three questions to small choices, not architectural ones —
  validates the "load-bearing first" sequencing.
- **Preview as default deliverable paid off here.** The six
  modal states are hard to describe in prose alone (especially
  the difference between modal 3 = rename 409 and modal 6 =
  delete-workspace 409). The preview turns them into concrete
  visual states the user can flip between in <1 second. The
  soft-default-with-stated-reason framing (R23 kickoff edit)
  was right — required would have been overkill on simpler
  features, but for CRUD hygiene the preview earned its place.
- **`_shared/` folder pattern emerges naturally.** `RenameModal`
  and `DeleteConfirmModal` are feature-local but cross-feature
  inside data-management — neither belongs in `@mdd/ui` (too
  domain-specific: 409 branching, resource-type copy) nor in
  one feature folder (used by both). The
  `features/data-management/_shared/` location is the third
  shape between the two extremes. Worth noting for any future
  rounds adding cross-feature components within a domain.
- **The D-round surfaces the roadmap.** R23's post-design Q&A
  asked three "should we bundle X?" questions (UX
  infrastructure; app config + theme + constants; dataset
  detail view). All three returned to the same answer (focused
  R23, dedicated post-R26 round) — but the act of asking them
  sharpened three previously-vague follow-ups into named rounds
  with concrete triggers. The result: the POC/MVP path is now
  legible in one ASCII tree under Follow-ups, where before R23
  it lived only in scattered round-file references. **The
  D-round philosophy "see before do" applies at the roadmap
  level too** — designing CRUD made the rest of the path
  visible enough to write down. Methodology candidate for a
  future track-2/3 evaluation round.

**Promotions** _(none this round)_: D-rounds rarely promote.
The "one enhancement, two consumers" pattern is now at
two-instance evidence (parse-options + CRUD hygiene); per the
user's track-2/3 freeze, no methodology amendments mid-product-
track. Captured as a follow-up so the post-POC/MVP evaluation
round has the thread.

**Follow-ups (not promotions, just notes):**

- **Methodology candidate: "one enhancement, N consumers."**
  Parse-options chain (R19→R21) and CRUD hygiene (R23→R26) both
  fit the shape: one cohesive feature spread across multiple
  resource consumers, sharing endpoint shapes and FE components.
  Worth a sentence in
  [context/contract-driven-feature.md](../../context/_archive/contract-driven-feature.md)
  or a memo amendment after the chain closes. Held for the
  post-POC/MVP track-2/3 evaluation round.
- **Methodology candidate: D-round philosophy formal
  promotion.** R23 was the first round to apply "see before do"
  explicitly (R14, R19 did it tacitly). The default-on, skip-
  with-stated-reason framing worked; the soft form did not lock
  out the autoagent path. After one more D-round confirms the
  pattern transfers, consider promoting into the `context/`
  doc as a sixth principle or amending the
  [design-first-reframe-absorption memo](../../memory/2026-05-24-design-first-reframe-absorption.md).
- **`_shared/` folder pattern.** Capture as a memo when the
  second component lands there (`RenameModal` and
  `DeleteConfirmModal` are the first; if R26 ships them
  cleanly, that's two-instance evidence the location is the
  right granularity).
- **Dataset detail view — next POC/MVP feature chain (post-R26).**
  Read-side counterpart to upload: `/datasets/:id` page with
  paginated rows + columns metadata. User named this at R23 Q&A
  as a POC/MVP-completing feature. Considered for R23 but
  declined (CRUD picked instead because resource management is
  the more foundational gap; without rename/delete the workspace
  grid is write-once garbage). **Dual leverage of this chain**:
  closes the obvious upload → read-data demo loop AND satisfies
  R22's `skills/` unblocker — read-side, query-driven, outside
  the data-ingestion-domain test the methodology has been
  designed against. Likely full DCBF chain: new GET endpoint
  for paged rows (new contract), BE pagination + column-metadata
  shape, FE virtualized table with column-type-aware cells.
  **Sharpened trigger**: queue as the R27 D-round once R26
  closes CRUD; it is the next chain on the POC/MVP path.

### POC/MVP roadmap (as of R23)

The POC/MVP-completion path is now legible enough to write down.
Captured here as a follow-up note, not a commitment — user picks
order at each round's Q&A.

```text
Shipped:
  R11/R13   Workspaces page (read + create-stub)
  R14-R17   Datasets table + Upload wizard (full DCBF)
  R19-R21   Parse options (DCBF — D+B+F, C-collapse)
  R22       Methodology evaluation (track-2/3)

In flight:
  R23-R26   CRUD hygiene (full DCBF — D in progress)

Queued (post-R26, order TBD):
  R27+      Dataset detail view (POC/MVP-closing feature;
            also tests R22 skills/ unblocker)
  R-A       UX-infrastructure design       ┐
  R-B       App config + theme design      │ Autopilot-readiness
  R-C       Constants / enums conventions  ┘ track (parallelizable)

POC/MVP demo-ready ≈ when CRUD + dataset-detail + autopilot-
readiness all land. The "ready for autoagent, autopilot move
forward" north star follows shortly after.
```

- **Autopilot-readiness track (post-R26)** — three focused
  D-rounds the user named at R23 post-design Q&A as
  prerequisites for autoagent/autopilot moving forward.
  Sharpened trigger: pull after R26 closes the CRUD chain;
  rounds can parallelize.
  - **R-A — UX-infrastructure design**. Global toast
    configuration, page-level loading masks, list skeletons,
    central mutation-error boundary. Carries forward the
    R19/R20/R21/R22 deferrals.
  - **R-B — App config + theme design**. Backend `Settings`
    class for env vars (port, host, CORS — currently hardcoded
    in `app/main.py` + `app/__main__.py`); frontend
    `config.ts` / `env.ts` typed wrapper for `import.meta.env`;
    AntD `ConfigProvider` wired with centralized theme tokens
    (the preview CSS has `tokens.css` but the running app has
    none in TS).
  - **R-C — Constants / enums audit + conventions**. Promote
    `"csv"` / `"excel"` literals (16+ sites today, type-safe
    but scattered), TanStack query keys (`['workspaces']`,
    `['datasets']` inline at every site), error codes (the new
    R23 set plus existing ones), AntD message types — into
    per-package `constants/` modules, with a lint bar against
    new magic values.
- **Other R21 carry-overs still pending** — visual verification
  of the parse-options UI, reducer-complexity refactor, AntD
  v5 deprecation cleanup. None blocking; pull when convenient.

## Feeds into → Round_24 (Contract — full DCBF chain)

**Chain declaration**: full DCBF — R24 (C), R25 (B), R26 (F).

Per the
[D-step-picks-the-chain rule](../../context/_archive/contract-driven-feature.md),
R23 considered chain truncation and rejected it:

- **C-step survives because the contracts don't exist yet.**
  None of the four endpoints (`PATCH /workspaces/{id}`,
  `DELETE /workspaces/{id}`, `PATCH /datasets/{id}`,
  `DELETE /datasets/{id}`) live in the existing R15 contracts.
  The 409 error-body shape (`{ code, datasetCount? }`) is also
  new. No collapse-because-already-locked path available.
- **B-step survives because four new BE handlers need code.**
  Two new routes per resource, the `RenameBody` Pydantic model,
  the 409 cascade-check on workspace delete, the atomic parquet
  cleanup on dataset delete. None of this exists today.
- **F-step survives because three new modal components +
  four new mutation hooks need code.** `RenameModal` and
  `DeleteConfirmModal` in `_shared/`, plus a third
  `BlockedDeleteModal` variant, plus the overflow-menu
  affordance wiring on both the WorkspaceCard and the dataset
  table's new Actions column.

What R23 hands forward to R24 (Contract):

- **A locked wire shape** for all four endpoints, including the
  three error codes (`not_found`, `name_taken`, `non_empty`)
  and the 409 body for the cascade-blocked path.
- **A locked HIxAI Q&A table** (10 entries) absorbed into
  [crud-hygiene.md](../../design/data-management/crud-hygiene.md)
  so R24's contract writer doesn't re-litigate decisions.
- **The preview HTML** as the visual reference R25 (B) and R26
  (F) implementers can use to confirm wire-vs-UX behavior at
  every step — "does my BE 409 response cause the FE to flip
  to modal state 6?" is now a concrete question with a
  concrete visual answer.
