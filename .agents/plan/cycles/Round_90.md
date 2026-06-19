# Round 90: free-form canvas — "the rest" (Contract/Backend confirm · F2 polish · real Integration)

**Status**: In progress
**Date started**: 2026-06-19
**Date completed**: —
**Flow**: **DFCFBI continuation** — the back half of [R89](Round_89.md)'s DFCFBI flow
(**C + B + F2 + Integration**); R89 shipped **[D + F1 + design-sync]** per the
[[dfcfbi-two-round-split]] convention. No new `flow-selector` run (the flow is inherited).

## Goal

**Inherits from ← [Round_89](Round_89.md)** — the built React Flow free-form canvas (draw-to-connect
copy-on-pick + free-form define, promote, divergence warn + re-sync), feel-confirmed by the human and green
on MSW (181 vitest). R89 established **Contract = no wire change** and **Backend = no change** as Design
findings. This round **executes/confirms the rest of the flow**: lock those findings, **harden** the F1
build, land the **deferred usability-polish batch**, and prove the feature **on the real stack** (not MSW).

_Track: 1 (product — the production hardening + real-stack verification of R89's prototype). Pulled by ←
[Round_89](Round_89.md) "Feeds into → Round_90" + [[dfcfbi-two-round-split]]. Per the
[Evolution Rule](../../AGENTS.md)._

## Plan (by gate — the DFCFBI back half)

1. **Contract gate** — confirm **no wire change**: free-form rides the already-nullable
   `QueryRelationship.originRelationshipId`; promote reuses `POST /workspaces/{id}/relationships`;
   divergence is FE. Re-run contract conformance (MSW `additionalProperties:false` + `contract-validator`).
2. **Backend gate** — confirm **no change**: the promote endpoint + dedup/dtype rulebook pre-exist (R70);
   the join resolver is origin-agnostic (R88). Backend pytest stays green (no edits expected).
3. **F2 gate — harden + the usability-polish batch** ([[2026-06-18-r-ui-bug-fixing-round]]):
   - **Edge-label/node overlap** — the key-pair + cardinality + Promote/[×] toolbar clips behind adjacent
     node cards when nodes are close (seen at F1).
   - **Cardinality-at-draw UX** — the quick-prompt modal vs. inferring a default (the deferred "improve at
     end of F1" call).
   - **Handle discoverability** — make the column connect-dots obviously draggable (affordance cue).
   - Re-run `ui-design` (fidelity mode) on the canvas; keep vitest green.
4. **Integration gate — real backend, not MSW** ([[seed-data-vs-msw-complementary]],
   [[dfcfbi-f1-needs-human-review]]): run the app against the live Python backend + DuckDB + seed and
   confirm end-to-end — **promote actually persists** to the workspace ER; a **free-form join actually runs**
   in DuckDB; the **snapshot win holds** (editing/deleting an origin governed rel doesn't break a saved
   query); CORS/preflight clean. Human review → `Complete`.

## Acceptance criteria (draft: sharpen at F2)

- [ ] **Contract/Backend confirmed no-change** — conformance + pytest green; no `query.yaml` edit.
- [ ] **Edge labels don't overlap nodes** _(FE)_ — the edge toolbar is legible at the canvas's real node
      spacing (no clipped Promote/[×]).
- [ ] **Cardinality-at-draw decided + built** _(FE)_ — infer-vs-prompt resolved; the chosen affordance ships.
- [ ] **Handle discoverability** _(FE)_ — the connect-dots read as draggable (cue/label).
- [ ] **Real-stack Integration** _(I)_ — promote persists to the DB; a free-form join runs in DuckDB; the
      snapshot win holds; CORS clean — on the live backend, human-verified.

## Risks / unknowns

- **Real-stack surprises MSW hid** — CORS/preflight, DuckDB join semantics for a free-form key pair, the
  promote `POST` round-trip. _Mitigation: this gate exists precisely to surface them; R89 changed no BE, so
  blast radius is small._
- **Polish scope creep** — the usability batch could balloon. _Mitigation: the named items above are the
  batch; further gaps are their own follow-up, not this round._

## Do

### Green baseline re-confirmed (2026-06-19)

Inherited R89's `dev`-branch state: **vitest 181/181**, **backend pytest 196 passed**, tsc
clean, `vite build` green. Read the real F1 build (`QueryCanvas.tsx`, `joinGraph.ts`,
`chain.ts`, the canvas tests) before touching anything — the back-half gates run against
the code, not the R89 notes.

### Contract gate — confirmed no wire change (CLOSED, 2026-06-19)

R89 established this as a Design finding; R90 formally confirms it. **No `query.yaml`
edit.** Free-form rides the already-nullable `QueryRelationship.originRelationshipId`
(`null` = free-form); promote reuses `POST /workspaces/{id}/relationships` (`relationship.yaml`
`CreateRelationship`, with its `409 relationship_exists` dedup + `422` dtype already
specified); divergence + the new cardinality **inference** are pure FE. The F2 polish added
**no wire surface** (a local selection state, an inferred default fed into the existing
`defineJoin`, CSS/tooltip affordances). Conformance held — the MSW `additionalProperties:false`
guard and `contract-validator` are green within the **186** vitest (free-form / diverged / promoted
definitions all load through MSW without contract drift). Selector condition 4 (richer
promote-conflict payload) again did **not** fire — the bare `409/422` + the
`CanvasPromoteError` alert suffice.

### Backend gate — confirmed no change (CLOSED, 2026-06-19)

The promote target endpoint pre-exists (R70) and does the whole rulebook (dedup / dtype /
self-join); the resolver is origin-agnostic (R88) so free-form rels join with no engine
change. **Key check for the cardinality-inference decision:** `grep` confirmed
`cardinality` is **never read by the query resolver** (`app/routers/queries.py`) — it is
stored + enum-validated (`db_models.py`, `relationships.py`) but **advisory** ("direction by
side order"); the join **type** (inner/left/right/full) drives the SQL. So inferring a
default cardinality is **non-destructive** — a wrong guess changes no query result and is
editable later. Nothing to build server-side; **backend pytest 196 unaffected** (no edits).

### F2 gate — usability-polish batch landed (CLOSED, 2026-06-19)

The three deferred items ([[2026-06-18-r-ui-bug-fixing-round]]), all FE-only:

1. **Edge-label/node overlap → bpmn-style context pad** (human's reference:
   [bpmn.io context pad](https://bpmn.io/toolkit/bpmn-js/)). At rest each edge shows only a
   **compact opaque label** (key-pair · cardinality · type · Free-form/Governed). **Clicking
   it selects the edge** (canvas-local state — robust + testable, not React Flow's internal
   selection; pane-click deselects) and reveals a floating **context pad** of actions
   (Promote · Re-sync-if-diverged · leaf `[×]`) **lifted above the node cards (`zIndex`)** so
   it never clips. Removes the F1 overlap and declutters the resting canvas.
2. **Cardinality-at-draw → inferred, confirmable default** (human's call: _infer smart
   default, keep confirm_). New pure `inferCardinality(left,right)` in `joinGraph.ts`: both
   columns key-like (`id`/`*_id`/`*_key`/`*_code`/`uuid`) → `one_to_one`; one key-like →
   `one_to_many`; neither → `many_to_many` (a fan-out join, surfaced). The define modal opens
   **pre-set to the inference** with a "suggested — change if wrong" hint; manual change
   clears the hint. Safe because cardinality is advisory (Backend gate finding).
3. **Handle discoverability** — enlarged 11px connect dots, a crosshair cursor, a hover halo
   (`--ant-control-outline` token), a "drag to join" `title` tooltip, and a column-row hover
   highlight (scoped CSS).

**`ui-design` (fidelity mode) on the canvas: PASS — 0 facet gaps.** The only finding was
**doc-lag** (build ahead of `canvas.md`); reconciled below. **Verification:** tsc clean;
**vitest 186/186** (181 → +5 `inferCardinality` unit tests; the canvas component tests
updated to select the edge before reaching the context-pad actions); `vite build` green
(pre-existing chunk-size advisory unchanged). i18n: 3 new `queries.builder.canvas*` keys in
`en` + `vi`.

**Design-sync (canvas.md) — reconciled to the F2 build** ([[design-docs-are-source-code]]):
the edge-toolbar section → label + select-revealed context pad; the cardinality picker →
inferred/confirmable default (+ the `inferCardinality` rule); the ASCII layout + handle
description; `inferCardinality` added to the `joinGraph.ts` surfaces row; the "usability
polish" OUT-of-scope item retargeted "deferred" → "built (R90)". Gates: **design:lint 0 ·
design:tokens 0 · markdownlint 0 · round-lint 0**.

### Integration gate — real-stack verification (in progress)

_Next: run the app against the live Python backend + DuckDB + seed; confirm promote
persists, a free-form join runs in DuckDB, the snapshot win holds, CORS clean. Then the
human's `Complete` flip ([[dfcfbi-f1-needs-human-review]] — gates can't see CORS/feel)._

## Check

- [x] **Contract gate** — confirmed **no wire change**; conformance green within the 186
      vitest (MSW `additionalProperties:false` + `contract-validator`); no `query.yaml` edit.
- [x] **Backend gate** — confirmed **no change**; pytest **196** green; `cardinality` verified
      advisory (never read by the resolver) → inference is non-destructive.
- [x] **F2 gate** — usability batch landed (context pad · inferred cardinality · handle
      discoverability); **`ui-design` fidelity PASS (0 gaps)**; tsc clean; **vitest 186/186**;
      `vite build` green; canvas.md re-synced (design:lint/tokens/markdownlint/round-lint 0).
- [ ] **Integration gate** — real-backend end-to-end; **agent real-stack verification next**,
      then **human-verified** `Complete` flip.

## Act

_(Drafted at Review.)_

**Learnings**:

- TBD

**Promotions** _(if none: write as plain text, not checkboxes)_:

- TBD

**Follow-ups (not promotions, just notes):**

- Dashboards / charts over the richer queries → **R91+**.

## Feeds into → Round_91+ (dashboards) (TBD)

With the free-form canvas hardened + proven on the real stack, queries carry rich, exploratory, query-owned
relationships — the substrate for **R91+ dashboards / charts** (the theme payoff: free exploration → rich
queries → visualized).
