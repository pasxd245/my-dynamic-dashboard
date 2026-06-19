# Round 90: free-form canvas — "the rest" (Contract/Backend confirm · F2 polish · real Integration)

**Status**: Complete
**Date started**: 2026-06-19
**Date completed**: 2026-06-19
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

- [x] **Contract/Backend confirmed no-change** — conformance (186 vitest) + pytest (196) green; no
      `query.yaml` edit; `cardinality` verified advisory (not read by the resolver).
- [x] **Edge labels don't overlap nodes** _(FE)_ — actions moved into a select-revealed context pad lifted
      above the node cards (`zIndex`); compact opaque label at rest. _(Built + test-verified; human confirms feel.)_
- [x] **Cardinality-at-draw decided + built** _(FE)_ — **infer smart default, keep confirm** (human's call);
      `inferCardinality` ships, modal pre-sets it as a confirmable suggestion.
- [x] **Handle discoverability** _(FE)_ — enlarged dots + crosshair cursor + hover halo + "drag to join"
      tooltip + column-row hover highlight.
- [x] **Real-stack Integration** _(I)_ — promote persists to the DB; a free-form join runs in DuckDB; the
      snapshot win holds; CORS clean — **agent-verified on the live backend** (data layer); **human browser
      feel-check + `Complete` flip pending** ([[dfcfbi-f1-needs-human-review]]).

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

### Integration gate — real-stack agent-verified (2026-06-19); awaiting human feel-check + `Complete`

Ran the **live stack** (uv/uvicorn backend :8000 + DuckDB v1.1.3 + `seed.py` upsert,
workspace `ws_1e2d1a32` — the sales star) and drove the four data-layer claims over HTTP
(the FE sends exactly these requests; this is the stronger check for the data claims, vs
MSW). **All four PASS:**

| Claim | Result |
| --- | --- |
| **Free-form join runs in DuckDB** (`originRelationshipId: null`) | `POST …/queries/preview` 200 — 11 matched rows, collision-qualified columns (`customers.region_id` / `regions.region_id`). A genuinely free-form pair (customers.region_id → regions.region_id; governed is the reverse orientation). |
| **Promote persists to the governed ER** | `POST …/relationships` **201** → the new `rel_` is present in `GET …/relationships`. |
| **Snapshot win holds (R88) on the real DB** | a copy-on-pick saved query ran **11 rows** → `DELETE` its origin governed rel (**204**) → re-ran **11 rows** (unbroken — runs on its own `definition.relationships` snapshot). |
| **CORS preflight clean** | `OPTIONS` **200** with `access-control-allow-origin: http://localhost:3000`, `-allow-methods`, `-allow-headers: content-type`, `-max-age: 600`; a simple `GET` echoes the ACAO. |

State restored after the probe (3 seed governed rels; probe query deleted). Two self-inflicted
script bugs surfaced (and confirmed the backend's correctness, not a product gap): a probe
`qrel_` id with a non-hex char was correctly **422**-rejected by the `^qrel_[0-9a-f]{8}$`
contract pattern; advisory `cardinality` (`many_to_many`) on a 1:N pair joined fine (cardinality
is not a runtime constraint — Backend-gate finding confirmed end-to-end).

**Full dev stack left UP for the human's feel-check:** backend `http://127.0.0.1:8000`
(seeded) + builder `http://localhost:3000`. **Hard-stop for the human** ([[dfcfbi-f1-needs-human-review]]
— gates/agent can't judge feel or browser CORS): open a seeded query → **Canvas** tab and
confirm the F2 polish in the browser — (a) the **edge context pad** appears on click and no
longer clips behind nodes; (b) a free-form draw opens the modal **pre-set to an inferred
cardinality**; (c) the **handles read as draggable** (cursor/halo/tooltip). Then the human
flips the round to **`Complete`** ([governance](../../context/governance.md) — only humans flip).

## Check

- [x] **Contract gate** — confirmed **no wire change**; conformance green within the 186
      vitest (MSW `additionalProperties:false` + `contract-validator`); no `query.yaml` edit.
- [x] **Backend gate** — confirmed **no change**; pytest **196** green; `cardinality` verified
      advisory (never read by the resolver) → inference is non-destructive.
- [x] **F2 gate** — usability batch landed (context pad · inferred cardinality · handle
      discoverability); **`ui-design` fidelity PASS (0 gaps)**; tsc clean; **vitest 186/186**;
      `vite build` green; canvas.md re-synced (design:lint/tokens/markdownlint/round-lint 0).
- [x] **Integration gate** — real-backend end-to-end **agent-verified** (free-form join in DuckDB ·
      promote persists · snapshot win holds · CORS preflight clean) **+ human feel-checked**.
- [x] **Complete** — **human-flipped** (user instruction, 2026-06-19) after the browser feel-check; only
      humans flip ([governance](../../context/governance.md)).

## Act

**Round COMPLETE (2026-06-19)** — Contract + Backend confirmed no-change; F2 usability batch
landed + `ui-design`-PASS + design-synced; Integration agent-verified on the live stack +
human feel-checked; **human-flipped to `Complete`** (user instruction). The free-form canvas
is hardened and proven on the real stack — the theme payoff (rich query-owned relationships)
is ready to feed **R91+ dashboards**.

**Learnings**:

- **Before agonizing over a default's correctness, check whether the value is load-bearing
  at all.** The cardinality-at-draw decision looked high-stakes (selector condition 3:
  "a wrong join silently produces wrong analytics") until a one-line `grep` showed
  `cardinality` is **never read by the query resolver** — it is advisory ("direction by
  side order"); the join **type** drives the SQL. That flipped the call: infer a smart
  default, keep the confirm, ship — a wrong guess is non-destructive. The axis that matters
  for "how safe is an inferred/auto value" is **does anything load-bearing consume it**, not
  "how often is the guess right." _(Candidate principle — pending a 2nd rep.)_
- **A human's design reference can beat the options you posed.** I offered always-visible vs.
  hover-reveal for the edge-overlap fix; the human pointed to the **bpmn-js context pad**
  (select an element → a floating action palette beside it). Honoring the reference produced
  a strictly better fix — declutter at rest, lift the pad above nodes on select — and a more
  testable design (**canvas-local selection state**, not React Flow's happy-dom-fragile
  internal selection). When a human cites a concrete pattern, build to it rather than to the
  multiple-choice you framed.
- **For an Integration gate, verify data-layer claims over real HTTP, not the browser.** The
  load-bearing R90 claims (free-form join in DuckDB · promote persists · snapshot win holds ·
  CORS preflight) are all exactly the requests the FE emits, so driving them with `urllib`
  against the live backend is the **stronger, faster** check — Playwright/feel is reserved for
  the browser-only concerns the human owns. Reinforces [[seed-data-vs-msw-complementary]].

**Promotions**: none land this round (the governance brake — humans promote, per
[`promotions.md`](../promotions.md)). The "draw-to-pick is a selection, not a creation"
principle ([[query-owned-relationships]]) gained further real-stack validation but holds. The
advisory-field-inference learning above is a `context/` candidate **pending a second rep**.

**Follow-ups (not promotions, just notes):**

- Dashboards / charts over the richer queries → **R91+**.
- Further canvas polish beyond the R90 batch (if the human's feel-check surfaces any) is its
  own follow-up, not this round.
- **Query↔query joins — a query as a *non-driving* (joined-in) source → R91+** (human-flagged,
  2026-06-19). Today only **datasets** are joinable hops: the resolver reads each hop's right
  side as a dataset ([queries.py `_resolve_chain`](../../../workspace/apps/backend/app/routers/queries.py#L210))
  and governed rels are dataset↔dataset; a saved query enters only as the **driving base**
  (composition, R76/R77). So the canvas `[+ Add a source]` listing datasets-only is faithful,
  **not a bug**. Joining query↔query is a **new theme** (resolver must resolve a `qr_`
  right-side; the key/rel model must span queries' effective, collision-qualified columns) —
  also surfaces a related edge: a **composed** query (driving = `qr_`) currently renders no
  connect handles on its base node (columns resolve for datasets only). Not R90 polish scope.

## Feeds into → Round_91+ (dashboards) (TBD)

With the free-form canvas hardened + proven on the real stack, queries carry rich, exploratory, query-owned
relationships — the substrate for **R91+ dashboards / charts** (the theme payoff: free exploration → rich
queries → visualized).
