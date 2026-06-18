# Round 86: the two-tab Form/Canvas builder (layout-first; canvas editing → R87)

**Status**: **In Progress** — Plan + Design + **F** gates **closed** (2026-06-18, scope = **SPLIT /
layout-first**); **Integration gate next** (human review in the running app).
**Date started**: 2026-06-18
**Date completed**:
**Flow**: **DCFBI** (F-only) — set at the Design gate via `flow-selector` (**0/5 fired**; recorded in
the Do log). This layout round adds **no new interaction pattern** (a tab control = R85's Segmented; the
status chip = a standard button) and **no** contract/BE/engine change ([canvas.md J-3](../../design/data-management/queries/canvas.md));
the genuinely-new drag/draw interaction is **R87's**. Gates: **Plan → Design → F → Integration**
(Integration hard-stops for **human review** — a visual surface MSW/vitest can't fully judge,
[[dfcfbi-f1-needs-human-review]]).

## Goal

**Inherits from ← [Round_85](Round_85.md)** (Phase A — the read-only canvas view — shipped &
human-signed-off) and the **human's R86 two-tab direction** (recorded at R85's Integration close):
the builder becomes **two tabs over one working copy** — **"Form"** (the current hop-list editor +
the live preview) and **"Canvas"** (the full-width graph) — still a **mode, not a route**
(honors [canvas.md J-1](../../design/data-management/queries/canvas.md)); **preview table lives on Form
only**; a **clickable status chip** on the canvas (row count + `valid / ⚠ stale`) jumps to the Form
preview.

Make the **canvas an editor** at **hop-list parity** ([canvas.md J-5 Phase B](../../design/data-management/queries/canvas.md)):
**draw an edge** (from an in-graph node to a not-yet-joined dataset → pick the governed `rel_` →
`addJoin`, connected-acyclic guard unchanged), **delete a leaf edge** (`removeJoin`; a non-leaf's delete
is disabled with a text tooltip), over the **same** `useQueryBuilder` working copy and the **same**
validation + preview. **No new model, route, error code, or engine** — direct-manipulation bindings onto
ops the builder already has.

_Track: 1 (product feature). Pulled by ← Phase A's in-app confirmation (the R85 deferral trigger for
Phase B — "Phase A's render confirmed in the app" — has **fired**) + the human's two-tab direction +
[canvas.md J-5](../../design/data-management/queries/canvas.md). Per the [Evolution Rule](../../AGENTS.md)._

## Scope decision (ratified 2026-06-18 → SPLIT / layout-first)

**Resolved: the human chose the SPLIT.** R86 = the **two-tab restructure only** (canvas stays
read-only); editing → R87; Phase C "New query" → R88. _Human rationale: "we are experimenting, thus
commit and revert is more valuable" — in an exploratory phase the option value of a clean revert seam
beats saving a round_ ([[round-bundling-revert-seams]]). The acceptance criteria below (written for the
layout-first cut) stand as-is.

R86 couples **two separable concerns**: the **two-tab layout** (a low-risk refactor over existing
state) and the **canvas editing** (the new interaction). Per [[round-bundling-revert-seams]] (keep rounds
thin so one design error doesn't force discarding all layers) and [[dont-mvp-rush-a-roadmap-home-surface]],
the recommendation was to **split**, layout first:

- **Recommended — R86 = the two-tab restructure only** (Form/Canvas tabs, preview-on-Form, the clickable
  status chip), **canvas stays read-only**. A clean, revertible layout slice that gives the editor its
  roomy home and de-risks it. Then **R87 = Phase B editing** in that home; Phase C "New query" → **R88**.
- **Alternative — R86 = layout + editing together** (the human's integrated vision in one round). Larger,
  one revert seam; faster to the headline editing value.

The acceptance criteria below are written for the **recommended (layout-first) cut**; if ratification
chooses the bundle, the Phase-B-editing criteria from [canvas.md "handed down" #3](../../design/data-management/queries/canvas.md)
fold in. **This is the human's call at the Plan gate** (the equilibrium authority on scope/pace).

## Plan (by gate) — recommended (layout-first) cut

1. **Plan gate** — ratify: open Phase B; **decide the scope split** (layout-only R86 vs. layout+editing);
   confirm the two-tab model is a mode (one working copy, shared Save), not a route. _(This step.)_
2. **Design gate** — re-confirm the current builder (`QueryBuilderPanel` / `useQueryBuilder` /
   `QueryCanvas` as shipped at R85); amend [canvas.md](../../design/data-management/queries/canvas.md)'s
   layout (it currently draws the preview **under** the canvas) to the two-tab model in place
   ([[design-docs-are-source-code]]); settle tab labels (**Form / Canvas** recommended over
   "Simple view"); run `flow-selector` (expect F-only DCFBI) + `ui-design` (design-spec) on the two-tab
   surface + the status chip (Findability: does the chip make "results live on Form" discoverable
   without a static note?).
3. **F gate** — restructure `QueryBuilderPanel` into the `[Form] [Canvas]` tabs over the one
   `useQueryBuilder` copy; move the preview into the **Form** tab; add the **clickable status chip** to
   the Canvas tab (labelled button → switches to Form with the preview expanded; aria-label "View N
   result rows in Form builder"). vitest + MSW: tab toggle is lossless, Save stays gated on preview
   validity while the Canvas tab is active (the preview query runs regardless of visible tab), the chip
   reflects valid/stale and navigates. **No** contract/BE work.
4. **Integration** — **human review** in the running app: the two tabs read well, the canvas has room,
   the status chip makes the Form-preview discoverable, nothing feels lost moving between tabs.

## Acceptance criteria (recommended layout-first cut)

- [ ] **Two-tab builder over one working copy** _(FE)_ — `[Form] [Canvas]` tabs both bind to the same
      `useQueryBuilder`; switching is lossless (no edit lost, no model fork); still a **mode, not a
      route** (no new page/state).
- [ ] **Preview table on Form only; Save gate intact** _(FE)_ — the preview lives on the Form tab; the
      Canvas tab has no preview **table**, yet Save (header) stays correctly gated on preview validity
      (a stale edge / dangling predicate still disables it) because the preview query runs regardless of
      the visible tab.
- [ ] **Clickable canvas status chip** _(FE)_ — a labelled, keyboard-reachable control on the Canvas tab
      shows row count + `valid / ⚠ stale` and, on activation, switches to the Form tab with the preview
      expanded (preferred over a static "go to Form" note).
- [ ] **Canvas stays read-only this round** _(structural)_ — no editing affordance is added to the
      canvas (editing is R87 unless ratification bundles it); no model/contract/BE/engine change.
- [ ] **Accessibility** _(FE)_ — the Form tab remains the keyboard/SR-complete equivalent and the
      assistive-tech default; the tabs + the status chip are labelled, keyboard-reachable controls.
- [ ] **canvas.md is current-state** _(doc)_ — the layout section reflects the two-tab model (preview no
      longer drawn under the canvas) ([[design-docs-are-source-code]]).
- [ ] **Complete = human-signed-off** (the two-tab builder, run in the app).

## What is OUT of scope (this round, recommended cut)

- **Canvas editing** (draw-edge → `addJoin`, delete-leaf → `removeJoin`, pick `rel_`/type) → **R87**
  (Phase B), unless ratification bundles it here.
- **Phase C — standalone "New query"** (empty-canvas create) → **R88**; depends on Phase B's place-a-node.
- **Persisting cosmetic node positions / auto-layout** → a build detail only if pulled; the model carries
  **no** view state ([[design-altitude-vs-build-home]]).
- **Any model / contract / BE / engine change** — R86 is FE-only over the existing tree + preview.
- **The dashboard theme** (the human's #2) → its own theme after canvas.

## Risks / unknowns

- **Scope/pace (the #1 item above)** — bundling layout + editing risks a fat round; splitting delays the
  headline editing value a round. _Mitigation: the human decides at the Plan gate._
- **Save-gate-without-visible-preview confusion** — a user on the Canvas tab may not see *why* Save is
  disabled. _Mitigation: the status chip surfaces `⚠ stale` + the reason and links to the Form preview;
  validated at `ui-design` + Integration._
- **New interaction (if editing is bundled)** — drag/draw is a genuinely new pattern the hand-rolled
  SVG/DOM render must support; a graph-lib peer dep becomes a real question. _Mitigation: that is the
  editing round's Design-gate deviation decision against its own evidence, per R85's note — not
  pre-committed._

## Do

### Plan-gate ratification (2026-06-18)

Ratified on "split please". **Scope = SPLIT / layout-first**: R86 builds **only** the two-tab
Form/Canvas restructure (preview-on-Form, the clickable canvas status chip) with the **canvas
staying read-only**; canvas **editing** (Phase B's draw/delete) moves to **R87** and the standalone
"New query" entry (Phase C) to **R88**. The Goal, Plan-by-gate, acceptance criteria, and OUT-of-scope
list above are accepted for this cut.

**Why split (human's call, recorded).** _"We are experimenting, thus commit and revert is more
valuable."_ In the current exploratory phase the **option value of a clean revert seam** (a layout
mistake and an editing mistake stay in separate, independently-revertible commits) outweighs the cost
of one extra round — the [[round-bundling-revert-seams]] discipline applied deliberately, with the human
as the equilibrium authority on pace.

**Confirmed sound before ratifying:** the two-tab builder is a **mode, not a route** — both tabs bind to
the **one** `useQueryBuilder` working copy and Save through the **same** header lifecycle (honors
[canvas.md J-1](../../design/data-management/queries/canvas.md)); the Save gate stays intact on the
Canvas tab because the preview query runs regardless of the visible tab; the canvas stays read-only this
round (no model/contract/BE/engine change).

**Open items carried to the Design gate** (not blockers): tab labels (**Form / Canvas** recommended);
`flow-selector` (expect F-only DCFBI — the new *drag* interaction that would weigh condition 2 is R87's,
not this layout round's); amend [canvas.md](../../design/data-management/queries/canvas.md)'s layout
(preview currently drawn **under** the canvas) to the two-tab model in place.

**Gates remaining**: Design → F → Integration (Integration hard-stops for **human review** in the
running app, [[dfcfbi-f1-needs-human-review]]).

### Design-gate close (2026-06-18)

**Verdicts re-confirmed against the shipped builder.** Read the R85 code under
`workspace/apps/builder/src/features/data-management/queries/` (`QueryBuilderPanel.tsx`,
`useQueryBuilder.ts`, `QueryCanvas.tsx`). Today the `[List]/[Canvas]` `<Segmented>` toggle lives
**inside** the Build section and swaps only the join editor, with the preview section below (shared).
R86 promotes this to **two top-level tabs over the one working copy**: **Form** (the full builder — base
picker + hop list + filter chips + advanced + search + the live **preview**) and **Canvas** (the
full-width `QueryCanvas`, read-only this round, + a **clickable status chip**; **no** preview table).
Both tabs bind to the **one** `useQueryBuilder`; Save (page header) is shared. **Mode, not a route**
(honors [canvas.md J-1](../../design/data-management/queries/canvas.md)) — no new page/state/model.

**Tab labels → `Form` / `Canvas`** (human-leaning; "Simple view" rejected as it undersells a full
editor). Recorded; final string lives in i18n at the F gate.

**Save gate without a visible preview on Canvas — confirmed sound.** `useQueryBuilder`'s preview query
keys on the working copy (`debouncedDraft`) and runs whenever `active && (query || isCreate)` —
**independent of which tab is visible**. So `canSave` (which reads `previewOk` / `relStale` /
`invalidCount`) stays correctly gated on the Canvas tab; the user just doesn't see the rows there. The
**status chip** surfaces the gate state (row count + `valid / ⚠ stale`) and navigates to the Form
preview — no logic change to the hook, an FE rendering addition only.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | The round adds a 2-state `[Form]/[Canvas]` tab switch + a chip-click; the canvas stays read-only (editing branches are R87). |
| 2. New interaction pattern           | no     | A tab control is R85's shipped `<Segmented>` pattern; the status chip is a standard navigating button. The genuinely-new drag/draw is R87. |
| 3. High user-error risk              | no     | Read-mostly layout refactor; canvas read-only; no destructive or irreversible action. |
| 4. Contract depends on unresolved UI | no     | FE-only — zero contract surface (renders the resolved `joins` + the existing preview the builder already holds). |
| 5. UX confidence below threshold     | no     | The two-tab model is the human's explicit direction over a reviewed design; the one open question (preview discoverability on Canvas) is answered by the status chip, validated at `ui-design` + Integration. |

Result: **Flow: DCFBI** (F-only — this layout round adds no contract/BE and no new interaction pattern).

**`ui-design` (design-spec) on the two-tab surface + status chip** — **5 pass / 1 gap → fixed**.
Findability, Usability, Accessibility, Utility, Desirability **pass** (labelled `Form`/`Canvas` tabs; the
status chip is the declared discovery path to results; Form stays the SR-complete equivalent + AT
default; reuses the token map). **Credibility gap**: the canvas **status chip's states were undeclared**
(loading / empty-zero / valid / stale-or-invalid). **Fixed in canvas.md** — the Layout section now
declares all four chip states (text + icon, not colour alone), the Behaviour section declares
"preview-on-Form-only, Save gate holds on both tabs," the Accessibility section declares the chip's
`aria-label` + focus move, and the token map adds the chip's valid/stale token rows. Re-review clean.

**canvas.md amended in place** ([[design-docs-are-source-code]]): Status block → R86 two-tab restructure
(Design gate closed); Layout section rewritten to the **two-tab `Form`/`Canvas` model** (preview-on-Form,
the full-width canvas + the status chip; ASCII updated); Behaviour + Accessibility + token map carry the
chip; the build-decision note's "Phase B (R86)" drag-editing reference repointed to **R87** (editing is
now R87, not R86). `design-token-parity` **0 errors**; `markdown-check-link` **all links resolve**.

### F-gate close (2026-06-18)

**Built (FE-only):**

- **`QueryBuilderPanel.tsx`** restructured into a top-level **`[Form] [Canvas]`** view switch over the
  **one** `useQueryBuilder` working copy:
  - **Form tab** — the shipped builder unchanged (base picker + hop list + filter chips + advanced +
    search) **with** the live `<PagedRowsView>` preview below.
  - **Canvas tab** — the read-only `QueryCanvas` (full-width) + a **clickable status chip**; **no
    preview table**. The chip (`QueryCanvasStatusChip`) mirrors the preview gate — `N rows` (valid) /
    `Previewing…` / `⚠ Unavailable` (text + icon, not colour alone) — and on click returns to the Form
    tab with the preview expanded (`aria-label` "View N result rows in the Form builder").
  - The R85 inline `[List]/[Canvas]` toggle (which lived inside the Build section) is **replaced** by
    these tabs.
- **i18n** (en + vi, parity-aligned): `tabForm` / `tabCanvas` / `canvasStatusRows` /
  `canvasStatusUnavailable` / `canvasStatusAria` / `canvasStatusAriaUnavailable`.

**Mechanism note (build-home, [[design-altitude-vs-build-home]]).** The tab switch is an AntD
`<Segmented>` (not `<Tabs>`) acting as the view control — the proven R85 pattern, conditional-render so
each view cleanly mounts/unmounts. It satisfies the design's declared a11y (labelled, keyboard-reachable,
text labels). If true ARIA `tablist`/`tabpanel` semantics are wanted, that's a small follow-up — flagged,
not silently diverged.

**Save gate holds on the Canvas tab — verified.** `useQueryBuilder`'s preview query keys on the working
copy and runs whenever the builder is active, **independent of the visible tab**, so `canSave` stays
correct on Canvas; the chip surfaces the gate state without a preview table.

**Verification:**

- `tsc --noEmit` (`type-check`) — **clean**.
- vitest + MSW (`tests/queries.test.tsx`): the 3 R85 canvas tests repointed to the new tabs (lossless
  switch, faithful star render, per-edge stale) **+ 2 new**: (1) the Canvas-tab **status chip** shows the
  row count and **navigates back to Form** (no preview table on Canvas); (2) a **blocked preview
  (409)** keeps **Save disabled on the Canvas tab** and the chip reads `Unavailable`. **Full builder
  suite: 162/162 green.**
- i18n parity test green (new keys aligned en/vi).

**Known advisory (non-blocking):** Sonar flags `QueryBuilderPanel`'s cognitive complexity (two full view
branches in one component) — consistent with how the repo already tolerates Sonar advisories (no
eslint/Sonar gate in pre-commit). A `/simplify` extraction of `FormTab`/`CanvasTab` is an optional
follow-up; left inline to avoid a risky refactor mid-gate.

**Integration gate next** — hard-stops for **human review** in the running app (the two tabs read well,
the canvas has room, the status chip makes the Form preview discoverable; [[dfcfbi-f1-needs-human-review]]).

## Check

- [x] Plan gate ratified on "split please"; Do log records the **scope (SPLIT / layout-first)**, the
      human's revert-value rationale, and the mode-not-route soundness check.
- [x] **Design gate closed.** Verdicts re-confirmed vs. the shipped builder (the two-tab model is a
      mode, not a route — one `useQueryBuilder`, shared Save; the Save gate holds on the Canvas tab
      because the preview query runs regardless of visible tab); tab labels → **Form / Canvas**;
      `flow-selector` run (**0/5 → DCFBI, F-only**); `ui-design` design-spec run (**5 pass / 1
      Credibility gap → fixed** in canvas.md — the status-chip states); canvas.md amended in place to
      the two-tab model; token-parity + link checks clean.
- [x] **F gate closed.** `QueryBuilderPanel` restructured into `[Form] [Canvas]` tabs over the one
      working copy (Segmented mechanism, flagged); preview on Form; clickable `QueryCanvasStatusChip` on
      Canvas (row count / unavailable, navigates to Form). `type-check` clean; full suite **162/162**
      (3 R85 canvas tests repointed to tabs + 2 new: chip navigation, Save-gated-on-Canvas-tab); no
      contract/BE.
- [ ] _Integration gate (next step): **human review** in the running app — toggle Form ⇄ Canvas (room,
      reads well), the status chip makes the Form preview discoverable, Save gating is clear on Canvas
      ([[dfcfbi-f1-needs-human-review]])._

## Act

_Pending — filled at round close._

## Feeds into → canvas Phase B editing (R87), then Phase C "New query" (R88), then the dashboard theme

R86 lands the two-tab Form/Canvas home (recommended cut); **R87** adds canvas editing (Phase B) in that
home; **R88** the standalone "New query" entry (Phase C). With the canvas theme delivering the #1
end-user value, the **dashboard theme** (the human's #2) opens after canvas, reading the clean
single-spine Query model ([queries.md](../../design/data-management/queries/queries.md)).
