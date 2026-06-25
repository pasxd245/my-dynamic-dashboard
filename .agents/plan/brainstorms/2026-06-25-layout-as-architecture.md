# Brainstorm — layout-as-architecture + the `ux-design`/`ui-design` skill split

_Consolidated 2026-06-25 from the R96 discussion (human-led). Track 2/3 (agent-method + self-evo),
**artifact-only** per the [R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md). Design intent
for a future round — nothing is built here._

## 1. The principle — layout is the architecture; the component is a detail

The human's frame (Flutter as the north star): everything is a **widget (~container)**, and layout is
built by **composing layout widgets** under a predictable protocol — *constraints flow down, sizes
flow up, the parent sets position*. Layout is **explicit, local, composable**.

CSS is the opposite — layout is **implicit, global, cascading**, and flex/height interactions surprise
you (`flex:1 1 auto; min-height:0`, `height:100%` only resolving against a definite ancestor). That
surprise *is* the R95/R96 churn (trap → occlude → under-fill → canvas-fill).

**The doctrine:** be **strict on the layout skeleton** (compose a small vocabulary of layout
primitives that *own* the constraint rules), **flexible on the component/widget detail** (the
rendering internals are swappable behind a stable layout). A good layout is the **maintainability
lever**: you revise by recomposing primitives, not by re-debugging CSS. (This is *why* keeping
`PagedRowsView` custom was right — the layout, `bounded` vs `flow`, is what mattered.)

## 2. The layout-primitive vocabulary (emerging — let it stabilize before codifying)

- Seed: **`PageContainer`** (`width` cap-and-center; `fill` = grow / `'bounded'` = cap) — a
  `Container`-ish widget that owns the viewport-fill + cap + scroll-model decision.
- `PagedRowsView scrollMode: 'contained' | 'flow'` — the same idea at the table level.
- **Next likely primitive:** an `Expanded`-style "fill a definite-height parent" wrapper — the
  **canvas large-screen fill** is the first exercise that pulls it (canvas `height:100%` +
  `minHeight:440` under-fills a grow host). Grow the vocabulary through real use, 1–2 rounds.

## 3. The skill split (a future Track-2 correction)

- The current **`ui-design` skill is misnamed — it is really `ux-design`**: its checklist is the six
  UX-honeycomb facets (Findability/Usability/Accessibility/Credibility/Utility/Desirability), grounded
  in AntD Data Entry. It reviews **affordances**, not the layout skeleton.
- **Plan:** (a) **rename `ui-design` → `ux-design`** — cheap, truthful, mechanical (registry pointer +
  skills README + AGENTS.md skills line + active refs; Complete rounds' history stays as-run). (b)
  **Reserve `ui-design` for a real UI/layout-skeleton skill** (Flutter-principle); its rubric lands
  **only once the primitive vocabulary has earned its shape** — codifying "strict layout" against a
  one-primitive vocabulary would repeat the premature-codification mistake one level up.

## 4. Track-3 self-gating — the layout/component signal as a stop-_trigger_, not a skip-_license_

The future layout skill could use **layout-vs-component classification to calibrate when the F-phase
(F1/F2) stops for human confirmation**. This is **not** hand-over-duty or over-trust — Track-3 (agents
owning/editing their own gates, R99+) is a *stated track*; the agent owning this call is the **duty,
the destination** ([[gates-dont-survive-self-modification]]: when the gate is self-editable, the only
brake left is the internalized "why", built now via cheap Track-1 reps). The cold-review *is* that
self-challenge (S3) — practicing it now trains the judgment Track-3 will run unattended.

So the cold-review's three findings are **not objections to agent-judgment** — they are the
**criteria of judging well** (what the self-gate must weigh):

1. **Weigh affordance-risk, not just layout-risk.** "Not-layout" ≠ "not-reviewed" — component changes
   carry catchable UX bugs (the `ux-design`/fidelity record: R51's dropped label + `[Clear]`).
2. **Reason about the composition, not the primitive's reputation.** Layout bugs live in the
   *arrangement* — canvas-fill is a *trusted* `PageContainer` breaking in a new composition. "Trusted
   primitive → bypass" is a category error.
3. **Calibrated uncertainty** — bias to *stop* when genuinely unsure ("confident, not overconfident").

**Shape:** layout/skeleton change → *fires* "needs F-phase eyeball" (a positive escalation, like a
`flow-selector` condition — which escalates, never licenses skipping). A component change keeps its
`ux-design` review. Any eventual **bypass is composition-specific and (until Track-3) human-authorized**
— never agent-self-certified-in-general.

## 5. Meta — a refinement to how the cold-review runs *in this repo*

Don't default to "human-gate permanent / agent-autonomy = risk." In a three-track repo whose telos
includes Track-3 self-governance, frame agent-judgment as **the thing to build well**, not a danger to
suppress. The guardrails become *criteria*, the cold-review becomes *training data*. (Links
[[gates-dont-survive-self-modification]], [[fair-review-at-lockin]].)

## Next steps (when pulled — not now)

- Canvas large-screen fill → first layout-primitive exercise (grows the vocabulary).
- `ux-design` rename (cheap, soon) — its own small Track-2 correction.
- `ui-design` (layout) skill — content once the vocabulary stabilizes; encode §4's
  trigger-not-license rule and the three criteria. Artifact-only until R99.
