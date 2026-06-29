# Round 108: Read-only widget-config JSON inspector

**Status**: **Complete** (human accepted to stay 2026-06-29; UX reservation → R109 review) — all gates green
**Date started**: 2026-06-29
**Date completed**: 2026-06-29
**Flow**: **DCFBI** — set via flow-selector (0 conditions fired; recorded in the Do log). FE-only, **no
contract change** (widget props already persist as JSON), no Contract/Backend gate. F1/F2 skipped.

## Goal

**Inherits from ← [Round_107](Round_107.md) Feeds-into** (enhancement backlog on the clean seam). Add a
**read-only "view widget config as JSON"** panel to the widget builder — transparency / debugging /
copy-paste of a widget's persisted config. The structured form stays the editor.

_Track: 1 (product — a presentation/transparency affordance). Pulled by ← human (2026-06-29), as a thin,
safe first step toward the ECharts-options work — which is **deferred to its own pull-driven round** (see
the scoping decision below). Per the [Evolution Rule](../../AGENTS.md)._

## Code-sourced truth (verified 2026-06-29)

- Widget props **already persist as JSON**: the FE
  [`Widget`](../../../workspace/apps/builder/src/features/dashboard/types.ts) shape
  (`queryId`, `title`, `chartType` ∈ {bar, pie}, `dimensionCol`, `measureCol?`, `agg`, `span`) IS the
  stored JSON — it serializes under `definition.widgets` into the dashboards table's `definition_json`
  column ([dashboards.py](../../../workspace/apps/backend/app/routers/dashboards.py),
  [wire.ts](../../../workspace/apps/builder/src/features/dashboard/wire.ts)). **So "persist as JSON" needs
  no new work** — this round only ADDS a way to see it.
- The widget editor is a Modal with a structured `Form` + a live preview
  ([WidgetBuilder.tsx](../../../workspace/apps/builder/src/features/dashboard/WidgetBuilder.tsx)).
- The chart lib is **recharts**; **no ECharts in the repo yet** (R101 ladder: recharts → ECharts *when
  pulled*; `WidgetView` is the lib-agnostic seam).

## Scoping decision (Plan gate — human, 2026-06-29)

The fuller idea — "edit props as JSON, because ECharts is configured via a JSON `option`" — was
**reframed and split**:

- **Rejected for now:** making the persisted model ECharts-option-shaped JSON (couples storage to one chart
  lib, breaks the R101 lib-agnostic seam) and a raw-JSON **editor** on the #1 path (fails the product hard
  test — "if a screen makes the user read/write a formula to verify, we're Excel-with-extra-steps"; a raw
  ECharts `option` blob is worse than a formula for the #1 user).
- **Deferred to the ECharts-adoption round** (its real pull): when ECharts lands, keep structured props as
  the #1 spine and add an optional `advancedOptions` JSON **overlay** (additive); the JSON **editor** is then
  a **#2 (AI-authored — human verifies the rendered chart, not the JSON)** or **#3 (power-user)** affordance,
  never on the #1 path.
- **This round (R108):** the thin, safe, additive slice only — a **read-only** JSON **view**.

## Scope (one read-only surface)

1. A **read-only** JSON panel in the widget builder showing the widget's **live working-copy** config
   (updates as the form changes), pretty-printed, with a **copy-to-clipboard** action.
2. FE-only. No contract, no wire field, no backend, no edit path.

## Explicitly out of scope (deferred — default = don't add)

- Editing the JSON (round-trip JSON → widget state).
- ECharts and any ECharts-`option`-shaped model or `advancedOptions` overlay.
- A JSON view anywhere outside the builder (e.g. a per-widget action on the rendered dashboard).

## Open Design questions (for the Design gate)

- **D1 — placement & form:** a collapsible panel **inside the builder Modal** (below/beside the form) vs a
  second tab vs a small "View JSON" popover. _Leaning: a collapsible panel in the Modal, reflecting the live
  working copy — closest to the props it mirrors._
- **D2 — exact content:** the `Widget` object as-is, or a curated subset? _Leaning: the whole `Widget`
  object (it IS the persisted shape — transparency is the point), minus the generated `id` if noisy._
- **D3 — read-only affordance:** how "read-only" is signalled (disabled `Input.TextArea` vs a styled
  `<pre>` + copy button) and ux-design facets (Findability/Credibility) at the Design gate.

## Plan

1. **Plan gate** — human confirms the read-only-only scope (this file). ← we are here.
2. **Design gate** — resolve D1–D3; `ux-design --design-spec` on the panel; `flow-selector` (expected DCFBI).
3. **Build** — the panel + copy action; a focused test (JSON reflects the working copy; read-only).
4. **Check** — gates green + human eyeball (it's a UI surface).

## Risks / unknowns

- **Scope creep toward an editor** — the whole point of the reframe is read-only; if "edit" sneaks in, stop
  (it belongs to the ECharts round, by tier).
- **Over-investment** — this is a thin transparency affordance; keep it small, don't build a JSON-schema
  layer.

## Do

### Plan gate PASSED + Design gate ratified (human, 2026-06-29)

Plan scope confirmed: **read-only JSON inspector only**. Design D1–D3 locked as recommended:

- **D1** — a collapsible **"View as JSON"** panel **inside the builder Modal** (right column, under the live
  preview), reflecting the **live working-copy** config.
- **D2** — show the **persisted widget shape** (`Omit<Widget, 'id'>` — same object `submit()` sends; the
  synthetic preview `id` is excluded as noise).
- **D3** — a styled read-only `<pre>` block + a **copy-to-clipboard** control (clearly not an input).

**ux-design facets (proportionate inline check — a single read-only display surface, not a full
`--design-spec` run):** _Findability_ — labelled collapsible, collapsed by default so it doesn't crowd the
form. _Usability/Accessibility_ — copy control has an `aria-label`; `<pre>` is selectable text.
_Credibility_ — shows the literal saved shape (transparency is the feature). _Utility_ — lets the user (and
the future ECharts round) see exactly what an `advancedOptions` overlay would augment. _Desirability_ —
monospace, muted, unobtrusive. No gaps that block build.

**Flow selector run** (per [R47](../../decisions/2026-05-28-hybrid-flow-governance.md)):

| Condition                            | Fired? | Justification  |
| ------------------------------------ | ------ | -------------- |
| 1. >3 independent states/branches    | no     | One panel, collapsed/expanded; no new state model. |
| 2. New interaction pattern           | no     | A read-only disclosure panel + copy — both already used in the app. |
| 3. High user-error risk              | no     | Read-only display; nothing to mis-submit or destroy. |
| 4. Contract depends on unresolved UI | no     | No contract change at all (props already persist as JSON). |
| 5. UX confidence below threshold     | no     | Trivial, ratified read-only surface. |

Result: **Flow: DCFBI** (0 fired). F1/F2 skipped.

### Built (2026-06-29) — awaiting human Check

A collapsed **"View as JSON"** panel in the widget builder Modal
([WidgetBuilder.tsx](../../../workspace/apps/builder/src/features/dashboard/WidgetBuilder.tsx)), right
column under the live preview (D1). It shows the **live working-copy** persisted shape — a read-only,
muted, monospace `<pre>` (`data-component="WidgetConfigJson"`) with an AntD `Typography.Paragraph`
copy-to-clipboard control (i18n tooltips) (D2/D3). Background/radius from theme tokens. Four i18n keys added
to `dashboard.builder` in both `en`/`vi`.

**Refactor folded in (dedup, not just for testing):** extracted `draftToConfig(draft) → Omit<Widget,'id'>`,
now the single source for **both** the submit payload and the JSON view (previously `submit()` built the
shape inline). `measureCol` is dropped for `count`; unset fields drop out under `JSON.stringify`. This is
behavior-preserving for the submit (persisted JSON is identical — `undefined` and absent both serialize away).

**Tests:** new [`widget-config.test.ts`](../../../workspace/apps/builder/src/features/dashboard/widget-config.test.ts)
(3 cases, pure-fn style matching `slug`/`aggregate`): sum-draft → id-less shape with trimmed title;
`measureCol` dropped for count; unset fields omitted from the JSON.

**Verification (automated):** FE typecheck **clean** · suite **219 passed** (216 + 3 new). No contract /
backend touched.

**Pending human Check (DCFBI UI surface):** open the widget builder, expand "View as JSON", confirm the JSON
tracks the form live, the copy button works, and it reads clearly as read-only (no edit affordance).

## Check

| Item | Result |
| --- | --- |
| FE typecheck | clean |
| FE suite | **219 passed** (216 unchanged + 3 new `draftToConfig` tests) |
| Contract / backend | untouched (no wire change — props already persist as JSON) |
| Scope held (read-only, no editor, no ECharts) | ✅ |
| **Check (human)** | ✅ **accepted to stay** (2026-06-29) — with a UX reservation: "not quite right." Kept as a thin, isolated, low-risk layer; a **holistic charts/widget review** (incl. this inspector's placement & value) is **deferred to R109 (ECharts)**. Not independently app-run; read-only surface, low risk. |

## Act

**Round complete (2026-06-29).** Shipped the thin, agreed slice: a read-only "View as JSON" panel mirroring
the live widget config, plus the `draftToConfig` dedup (now the single source for the submit payload and the
view). FE typecheck clean · 219 passed · no contract/backend touched.

**Provisional by design.** The human finds the inspector "not quite right" but chose to keep it rather than
churn now — the correct call: the inspector's final form (placement, whether read-only is enough, whether it
becomes the `advancedOptions` editor) depends on what the ECharts round decides widget config should look
like. R108 deliberately did NOT pre-decide that. Per [[round-bundling-and-revert-seams]], it's a thin layer
that R109 can revise or absorb cleanly. No commitment locked beyond "a read-only view exists."

## Feeds into → Round_109 (ECharts + charts/widget review)

R109 adopts ECharts (the real pull for richer charts) AND runs a **holistic review of the charts/widget
approach**, explicitly including:

- **R108's JSON inspector** — keep read-only, evolve into the editor, relocate, or drop. The "not quite
  right" reservation gets resolved here, with ECharts context in hand.
- The **`advancedOptions` JSON overlay** on the structured props (additive; lib-agnostic core preserved per
  the R101 ladder), and whether the JSON editor is a **#2 (AI-authored)** or **#3 (power-user)** affordance —
  never on the #1 path.
- recharts (basic bar/pie) ⇄ ECharts (advanced) coexistence at the `WidgetView` lib-agnostic seam; ECharts
  added additively + lazy-loaded.
