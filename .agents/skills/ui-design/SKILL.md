---
name: ui-design
description: Review a UI surface against the six essential components of a design (UX-honeycomb facets — Findability, Usability, Accessibility, Credibility, Utility, Desirability) grounded in Ant Design's Data Entry guidance. Two modes — design-spec (does the design doc DECLARE the affordances; run at the Design gate, primary/preventive) and fidelity (does the BUILD carry them; run at F1/F2, backstop/corrective). Emits a per-facet pass/gap report. Verifies — does not auto-fix.
when_to_use: Run at the Design gate on the design doc (primary — verify the spec is affordance-complete before F builds it), and at the F1/F2 gate on the built component (backstop — verify the build carries what the design declared). Also ad hoc on any surface or design doc. Trigger phrases include "review the UX", "is this design complete", "is this field usable", "check the affordances", "run ui-design", "does this match the design".
argument-hint: <design-doc-path> [component-path]
arguments: design component
allowed-tools: Read, Grep, Bash(grep *)
metadata:
  author: hand-authored-r52
  version: '1.0'
---

## Trigger

The **design markdown is where UX quality is decided.** Under the
mature DCFBI default, the **F phase only confirms** the design into
the FE-on-MSW source of truth — it has **no mandate to revise or
revamp the UX**. So if the design doc under-specifies an affordance
(no label, no clear action, a missing state), DCFBI faithfully
ships that gap with no later phase to catch it. DFCFBI's **F1** is
the *exception*, enabled only when the flow-selector's 2-of-5 fires
because the design *couldn't* be made straightforward.

That makes the **Design gate the main event** for this skill, and
the F gate a safety net:

- **Design gate — design-spec mode (PRIMARY, preventive).** Run on
  the **design doc** before the spec freezes. Verify it *declares*
  each facet's affordance, so "F confirms" is trustworthy and the
  round can stay in the cheap DCFBI lane. The better the D-review,
  the rarer (and more justified) an F1 escape becomes.
- **F1 / F2 gate — fidelity mode (BACKSTOP, corrective).** Run on
  the **built component** against the design doc. Verify the build
  carried what the design declared — because a build can drift even
  from a complete design (R51's advanced-query field declared a
  label + `[Clear]` and the build dropped both).

Run it (also ad hoc on any surface or design doc). The skill is
**dependent + read-only** — callable by any round or task, peer to
`markdown-check-link`; the design-side counterpart to
[`gate-walker`](../gate-walker/SKILL.md).

Do not run this skill when:

- the round touches **no UI** and edits **no design doc**;
- the target is a pure data / type module (no affordances).

## Basis

The checklist is **the six essential components of a design** (the
UX-honeycomb facets), made *structural* and grounded in
[Ant Design's Data Entry spec](https://ant.design/docs/spec/data-entry/)
and [Form guidance](https://ant.design/components/form/) for the
concrete "how" in this stack. The honeycomb gives *what to
evaluate*; AntD gives *how it should look here*. See also
[Figma's UI design principles](https://www.figma.com/resource-library/ui-design-principles/).

## Modes

| Mode | Inputs | Gate | Question |
| --- | --- | --- | --- |
| **design-spec** *(primary)* | design doc only | Design | Does the **spec declare** each facet's affordance? |
| **fidelity** *(backstop)* | design doc + component | F1 / F2 | Does the **build carry** what the design declared (+ no drift)? |
| **build-only** *(ad hoc)* | component only | — | Standalone affordance check; fidelity diff skipped. |

## Procedure

### 1. Resolve inputs + mode

`$0` is the design-doc path; `$1` (optional) is the component path.

- `$0` only → **design-spec mode**.
- `$0` + `$1` → **fidelity mode**.
- `$1` only (no design doc) → **build-only mode**; report
  `fidelity-diff: skipped (no design doc)`.

Read what was given. In fidelity / build modes, identify each
**interactive surface** in the component (input, button, popover,
toggle, …).

### 2. Evaluate the six facets — structurally

For each surface (fidelity / build mode) or for the design as a
whole (design-spec mode), evaluate every facet and record
`pass` / `gap` / `n/a` plus a one-line pointer
(`design-doc:line` or `component:line`). Read the evidence from the
**spec** (design-spec mode) or the **build** (fidelity mode); do
not infer from intent.

1. **Findability** — is the control **labeled** and
   **distinguishable** from siblings? *Spec:* does the design
   declare a visible label / distinct affordance? *Build:* is a
   real label rendered (a placeholder is **not** a label — it
   vanishes on input), and is the control not visually identical to
   an adjacent different-purpose control? *AntD:* label above =
   fast-fill/high-readability; left = compact.
2. **Usability** — are **primary + clear/reset/undo** actions
   declared/present and **discoverable** (not hover-only /
   keyboard-only)? Are errors recoverable without destroying input?
   *Build grep:* `allowClear` (hover-only ×) vs an explicit
   clear/reset control; the error-render branch.
3. **Accessibility** — visible label *and* accessible name
   (`aria-label` / role), keyboard-reachable, not colour-only,
   contrast meets the token spec.
4. **Credibility** — is **every design-declared state** specced /
   rendered (empty / loading / error / …)? No dead ends or
   misleading affordances; consistent with siblings.
5. **Utility** — does the design / surface fulfil the doc's stated
   journey / acceptance criteria (the job it exists to do)?
   Overlaps `gate-walker`'s Design gate — cite the criteria IDs.
6. **Desirability** — does the design declare a token map / does
   the build use the **design-token system** (no inline ad-hoc
   colour/space values) and match the doc's visual spec?

### 3. Fidelity diff (fidelity mode only)

Compare the surface's built affordances against the affordances the
design doc **declared** (labels, clear actions, states, placement).
List every drift — a build that diverges from its own spec is the
backstop failure this mode exists to catch.

### 4. Emit the report

Return inline (no file written):

```text
ui-design [<mode>] — <surface-or-design> (vs <design-doc | "no design doc">)

| Facet         | Verdict | Evidence / gap (pointer) |
|---------------|---------|--------------------------|
| Findability   | gap     | <one line + pointer>     |
| Usability     | gap     | <…>                      |
| Accessibility | pass    | <…>                      |
| Credibility   | pass    | <…>                      |
| Utility       | pass    | <…>                      |
| Desirability  | pass    | <…>                      |

Fidelity diff: <drifts, or "none" / "skipped (no design doc)">
Result: PASS | GAP (N facet(s))

Remediation (author applies — this skill does not auto-fix):
- <facet>: <concrete, AntD-grounded fix + design-doc pointer>
```

### 5. Do not auto-fix

The skill **verifies**; the author **applies** the remediation and
re-runs. Auto-fixing UI (or silently editing the design doc) hides
the affordance decision from the human reviewer — the same
discipline `gate-walker` keeps.

## Quality Bar

- **Structural only.** Verify a *declared* affordance is *present
  and design-doc-faithful* — never "is it beautiful." Every gap
  must be a checkable assertion (spec doesn't declare a label;
  build's clear is hover-only; a declared state unrendered;
  hardcoded value vs token).
- **Bound the taste-prone facets.** **Desirability** = "declares /
  uses the token system + matches the visual spec," not aesthetics.
  **Credibility** = "all declared states present, no misleading
  affordance," not brand-feel.
- **`n/a`, never guess.** If a facet can't be reduced to a
  checkable assertion for the target, mark it `n/a` with one line
  of why.
- **Cite a pointer for every verdict** — `design-doc:line` or
  `component:line`. A verdict without a citation is worthless to a
  future auditor (same rule as `gate-walker`).
- **Do not auto-fix, do not advance a gate.** Return the report;
  the author acts.
- **Do not run on non-UI rounds** or pure-logic modules.
