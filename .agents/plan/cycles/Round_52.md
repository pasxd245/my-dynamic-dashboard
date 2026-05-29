# Round 52: `ui-design` skill — UX-affordance fidelity check

**Status**: Planning
**Date started**: 2026-05-29
**Date completed**:

## Goal

**Inherits from ← [Round_51](Round_51.md)** — R51 shipped the
advanced-query feature clean (FE 102 / BE 131, all gates closed),
but its end-of-round brainstorm surfaced a real UX hole: the
advanced-query input renders **indistinguishable from the `?q=`
search box** (no visible "Advanced query" label) and its clear
action is **hidden** (`allowClear` × on hover, or backspace) — and
both of those **drift from R51's own design doc**, whose layout
ASCII specified a labeled box and an explicit `[Clear]` button.

Nothing caught it. R51's **F2 gate** verified *behavior against
MSW* (does the query apply / clear / error correctly) but never
*affordance against the design spec* (is the control labeled,
distinguishable, and is its clear action discoverable). The O-rule
makes the FE-on-MSW the UX source of truth — but that only holds
if something checks the FE against the design's declared
affordances, not just its behavior. That is the gap R52 fills.

R52 ships a **`ui-design` skill**: a *structural* UX-affordance
fidelity check — the design-side counterpart to
[`gate-walker`](../../skills/gate-walker/SKILL.md). It verifies a
built FE surface carries the affordances its design doc declared
(visible label / accessible name, distinguishable from sibling
controls, discoverable clear/destructive actions, all declared
states rendered, keyboard-reachable). It is **review, not
generation** — it never proposes layouts (that would be Track-3
system-building, gated by the
[R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md));
it checks fidelity and cites gaps, exactly as `gate-walker` checks
citations without judging truth.

Its **first run** fixes the surface that pulled it: R51's
`AdvancedQueryInput` gains the label + explicit `[Clear]` its
design doc already specified — a worked example proving the skill
catches a real gap, not theater.

*Track: 2 (agent-method, tooling). Pulled by: R51 end-of-round
brainstorm — the advanced-query field shipped label-less with a
hidden clear action, drifting from its design doc; F2's gate
checked behavior, not affordance. Same shape as R49/R50: a tooling
round pulled by a feature-round lesson, landed before more feature
rounds so it can be applied going forward. Per
[Evolution Rule](../../AGENTS.md).*

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A.**

## What is IN scope

- **A new primary skill**
  `.agents/skills/ui-design/SKILL.md` — peer to `gate-walker` /
  `flow-selector` (it operationalizes the F1/F2 UX gate). Covers:
  - **Trigger / when-not-to-run** — run before flipping an F1 or
    F2 gate closed (and ad hoc on any built surface); skip on
    non-UI rounds and when the surface has no design doc to check
    against.
  - **Procedure** — read the round's design artifact + the built
    component(s); for each interactive surface, evaluate a fixed
    **structural affordance checklist** and cite, per item,
    `pass` / `gap` + a one-line pointer (design-doc line or
    component line):
    1. **Visible label / accessible name** — not placeholder-only
       (placeholders vanish on input).
    2. **Distinguishable from siblings** — a control isn't
       visually identical to an adjacent different-purpose control.
    3. **Discoverable clear / destructive action** — not
       hover-only or keyboard-only; matches what the design doc
       declared.
    4. **All design-declared states rendered** —
       empty/typing/parsed/errored/loading per the doc's state
       model.
    5. **Keyboard-reachable + labeled for a11y** —
       `aria-label`/role present.
  - **Design-fidelity diff** — explicitly flag where the built
    component *drifts from* the design doc's declared affordances
    (R51's missing label + `[Clear]` is the canonical example).
  - **Report format** — a structured findings block (table of
    checklist items × surfaces with pass/gap + pointers), returned
    inline like `gate-walker` (no script, no new dependency).
  - **Quality bar** — structural only: verify *declared
    affordances are present + cited*, never judge aesthetics or
    "is it nice." A gap is a missing/hidden affordance or a drift
    from the design spec, not a taste call. Do not auto-fix; the
    author applies the remediation (the skill verifies).
- **Flow integration** — one entry under `## Primary skills` in
  [`skills/README.md`](../../skills/README.md); update the
  [`AGENTS.md`](../../AGENTS.md) skills-index horizon line to list
  `ui-design`; add an optional line to [PDCA.md](../PDCA.md) — run
  `ui-design` at the F1/F2 gate alongside `gate-walker`.
- **First run + fix (worked example, this round)** — apply
  `ui-design` to R51's
  [`AdvancedQueryInput`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/AdvancedQueryInput.tsx);
  implement the two gaps it finds, per R51's design ASCII:
  - a visible **"Advanced query" label / boxed affordance** so the
    field is distinguishable from the `?q=` search box;
  - an explicit **`[Clear]` button** (discoverable, not just the
    hover-`allowClear` ×).
  Add an FE test asserting the label + Clear button exist and the
  Clear button removes `?aq=`; keep the existing advanced-query
  tests green.
- **Self-audit** — `markdownlint-cli2` + `markdown-check-link` on
  the new skill docs (per the R50 quality bar).

## What is OUT of scope

- **Generative / agentic UI design** — proposing layouts, copy, or
  components. The skill *reviews* fidelity; it does not *design*.
  Generation is Track-3 system-building, gated by R99.
- **Automated visual / pixel regression** — screenshot diffing,
  design-token audits, or driving the live app to render. v1 is a
  static design-doc-vs-code fidelity check, mirroring how R50's
  `markdown-check-link` shipped as static link resolution.
  App-render screenshotting (via the existing `run` / `verify`
  skill) is a **named follow-up**, not v1.
- **Retroactive sweep of all prior surfaces** — chips, the upload
  wizard, the workspace shell, the datasets list. v1 ships and
  proves on R51's advanced-query field only; a broader audit is
  its own pulled round.
- **Aesthetic / taste judgment** — color harmony, spacing
  beauty, brand. The checklist is structural affordance fidelity
  only.
- **New design-token values or component primitives** — the fix
  reuses existing tokens + AntD; if a token is missing it is
  promoted as a prerequisite, not invented inline (R36/R40 rule).

## Plan

Tooling round — PDCA template, **no DCFBI/DFCFBI gates or
flow-selector** (those are for feature rounds only, per the
`gate-walker` / `flow-selector` "do not run on non-feature rounds"
clause). Each step verified by tests / lints, not Hard Gates.

- [ ] **Author the skill** — write
      `.agents/skills/ui-design/SKILL.md` with the trigger,
      procedure, the 5-item structural affordance checklist, the
      design-fidelity-diff step, the inline report format, and the
      structural-only quality bar. Mirror the
      `gate-walker` / `markdown-check-link` SKILL conventions
      (frontmatter, `allowed-tools: Read, Grep, Bash(grep *)`,
      when-not-to-run, quality bar).
- [ ] **Wire into the flow** — `skills/README.md` primary-skill
      entry; `AGENTS.md` skills horizon line; `PDCA.md` F1/F2-gate
      audit line. Keep the load-bearing AGENTS.md horizons link
      valid (run `markdown-check-link`).
- [ ] **First run** — execute `ui-design` against R51's
      `AdvancedQueryInput` + its design doc; record the
      affordance-checklist findings (expect: label = gap,
      clear-action = gap/hidden, distinguishable = gap).
- [ ] **Apply the fix** — add the "Advanced query" label/box
      affordance + explicit `[Clear]` button to
      `AdvancedQueryInput`; i18n the label + clear strings (en +
      vi). Re-run `ui-design` → all checklist items pass.
- [ ] **Test** — add/extend
      `tests/advanced-query.test.tsx`: the label is present, the
      field is distinguishable (has the accessible name), the
      `[Clear]` button is visible and removes `?aq=`. Full FE
      suite stays green (baseline 102).
- [ ] **Self-audit** — `markdownlint-cli2` + `markdown-check-link`
      across the round's touched docs; triage + safe `--fix`.

## Risks / unknowns

- **Subjectivity creep.** "Good UX" is taste; a skill that judges
  taste collapses into noise. Mitigate exactly as `gate-walker`
  does: the checklist is **structural** — it verifies a *declared*
  affordance is *present and cited* (or drifted from the design
  doc), never "is it beautiful." A gap must be objective (no
  label; clear action hover-only; a declared state not rendered).
- **Over-mechanization temptation.** The pull might tempt a static
  analyzer or a screenshot harness. v1 stays a **procedure skill**
  (Read/Grep, inline report) — no script, no new dependency, no
  app-render — bounding the round and respecting the R99
  artifact-only horizon. Screenshot mode is a named follow-up.
- **Theater risk.** A checklist everything passes is useless.
  R51's advanced-query field is the built-in proof the skill bites
  — it must report the label + clear gaps on its first run, then
  pass only after the fix lands.
- **Fix regresses the tested component.** The label + `[Clear]`
  touch the 7-test `AdvancedQueryInput`. The Clear button must
  route through the same `onClear` path (remove `?aq=`, reset
  page) without breaking deep-link repopulation or the
  apply-on-valid behavior. Guard with the existing tests + the new
  assertions.
- **Primary-vs-dependent classification.** Filed as **primary**
  (operationalizes the F1/F2 UX gate, peer to `gate-walker`). If
  it proves generic enough to apply outside the gate flow, the
  README taxonomy can be revisited — not a blocker.

## Do

*Filled during execution.*

## Check

*End-of-round verification: skill authored + wired; first run
reported the R51 gaps; fix applied and re-run passes; FE suite
green; audit clean.*

## Act

*Carry-forwards, follow-up pulls (screenshot/app-render mode;
broader retroactive surface sweep; `round-scaffolder` if authoring
drag recurs), end-of-round Q&A notes.*

## Feeds into → Round_53 — close MVP query gaps

R53 is the **first feature round reviewed through the R52
`ui-design` skill**: add the operators R51 documented as MVP gaps
to the **shared** predicate vocabulary — inclusive date/datetime
bounds (`on_or_after` / `on_or_before`) and string `ne` — so the
chip row and the advanced query gain them in lockstep. Cross-cutting
across FE types + date chip editor, BE `OPS_BY_DTYPE` +
`_predicate_sql`, the MSW evaluator, and
[`dataset-filters.md`](../../design/data-management/dataset-filters.md)'s
vocabulary table; the advanced-query parser's prefix maps then
light up the deferred operators automatically.

If R52's authoring also drags (manual round-doc boilerplate, a
second round running), the `round-scaffolder` soft signal from R51
hardens into a pull for the round after.
