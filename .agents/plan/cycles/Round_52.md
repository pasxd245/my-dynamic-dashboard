# Round 52: `ui-design` skill — six-facet UX review (design-spec @ D, fidelity @ F1/F2)

**Status**: Complete
**Date started**: 2026-05-29
**Date completed**: 2026-05-29

## Goal

**Inherits from ← [Round_51](Round_51.md)** — R51 shipped the
advanced-query feature clean (FE 102 / BE 131, all gates closed),
but its end-of-round brainstorm surfaced a real UX hole: the
advanced-query input renders **indistinguishable from the `?q=`
search box** (no visible "Advanced query" label) and its clear
action is **hidden** (`allowClear` × on hover) — both **drifting
from R51's own design doc**, which specified a labeled box + an
explicit `[Clear]` button. R51's F2 gate verified _behavior against
MSW_ but never _affordance against the design_, so nothing caught
it.

**The deeper lesson — why the Design gate is the main event.**
Under the mature **DCFBI** default, the **F phase only confirms**
the design into the FE-on-MSW source of truth; it has **no mandate
to revise or revamp the UX**. So the design markdown is where UX
quality is _decided_ — if it under-specifies an affordance, DCFBI
faithfully ships the gap with no later phase to catch it. DFCFBI's
**F1** is the _exception_, enabled only when the flow-selector
fires because the design couldn't be made straightforward. That
makes a UX review at the **Design gate** the primary, _preventive_
control; the F-gate review is the _corrective_ backstop (needed
because a build can drift even from a complete design — exactly
R51, whose design _was_ complete).

R52 ships a **`ui-design` skill** with two modes:

- **design-spec mode** _(PRIMARY, run at the Design gate)_ — does
  the **design doc declare** each facet's affordance, so "F
  confirms" is trustworthy and the round can stay in the cheap
  DCFBI lane?
- **fidelity mode** _(BACKSTOP, run at F1/F2)_ — does the **build
  carry** what the design declared (no drift)?

It is **review, not generation** — it never proposes layouts (that
would be Track-3 system-building, gated by the
[R99 evo-horizon](../../decisions/2026-05-27-r99-evo-horizon.md));
it checks affordance-completeness / fidelity and cites gaps, as
`gate-walker` checks citations without judging truth.

**Basis**: **the six essential components of a design** (the
UX-honeycomb facets — _Findability, Usability, Accessibility,
Credibility, Utility, Desirability_), made _structural_ and paired
with **Ant Design's Data Entry / Form guidance**
(label-over-placeholder, label placement, "don't make users
guess"). The honeycomb gives the _what to evaluate_; AntD gives the
_how, in this stack_. References:
[AntD Data Entry](https://ant.design/docs/spec/data-entry/),
[AntD Form](https://ant.design/components/form/),
[Figma UI design principles](https://www.figma.com/resource-library/ui-design-principles/).

**This round ships the tool, not the fix.** Its first run is
**report-only** (the skill is read-only): run both modes against
R51 as worked examples — design-spec mode on the design doc
(expected **pass**: R51's design declared the label + `[Clear]`)
and fidelity mode on the built component (expected **gap**:
Findability + Usability). That localizes R51's failure to the
**build** stage and hands the gap to **R53**, which applies the
remediation. Splitting build-the-tool (R52) from use-the-tool (R53)
mirrors R49/R50 → R51.

_Track: 2 (agent-method, tooling). Pulled by: R51 end-of-round
brainstorm — the advanced-query field shipped label-less with a
hidden clear action, drifting from its design doc; F2's gate
checked behavior, not affordance. Same shape as R49/R50: a tooling
round pulled by a feature-round lesson, landed before more feature
rounds so it can be applied going forward. Per
[Evolution Rule](../../AGENTS.md)._

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A.**

## What is IN scope

- **A new dependent skill**
  `.agents/skills/ui-design/SKILL.md` — the design-side counterpart
  to `gate-walker`, filed _dependent_ (operates on design docs +
  components, not round files; callable by any round/task — see the
  classification note in Risks). Covers:
  - **Trigger / modes** — design-spec mode at the **Design gate**
    (primary), fidelity mode at **F1/F2** (backstop), build-only ad
    hoc; the DCFBI "F only confirms" rationale for why D is primary;
    skip on non-UI rounds.
  - **Procedure** — resolve inputs → mode (`design only` →
    design-spec; `design + component` → fidelity; `component only`
    → build-only). For each surface / the design as a whole,
    evaluate **the six essential components of a design** as
    _structural_ checks, reading evidence from the **spec**
    (design-spec mode) or the **build** (fidelity mode), citing
    `pass` / `gap` / `n/a` + a one-line pointer per facet:
    1. **Findability** — labeled + distinguishable from siblings
       (a placeholder is _not_ a label; not visually identical to
       an adjacent different-purpose control).
    2. **Usability** — primary + clear/reset/undo actions
       discoverable (not hover-only / keyboard-only); errors
       recoverable without destroying input.
    3. **Accessibility** — visible label _and_ accessible name
       (`aria-label` / role), keyboard-reachable, not colour-only,
       contrast meets the token spec.
    4. **Credibility** — every declared state present
       (empty / loading / error / …); no dead ends; consistent with
       siblings.
    5. **Utility** — fulfils the design doc's journey / acceptance
       criteria (overlaps `gate-walker`'s Design gate — cite IDs).
    6. **Desirability** — declares / uses the design-token system
       (no inline ad-hoc values) + matches the visual spec.
  - **Fidelity diff** (fidelity mode) — flag where the build drifts
    from the design's declared affordances (R51 is the canonical
    example).
  - **Report format** — an inline per-facet `pass`/`gap` table with
    pointers + a mode tag, like `gate-walker` (no script, no new
    dependency).
  - **Quality bar** — structural only; the taste-prone facets
    (Desirability, Credibility) bounded to token-use + state-
    coverage; `n/a` not guessed; cite every verdict; do not
    auto-fix.
- **Flow integration** — entry under `## Dependent skills` in
  [`skills/README.md`](../../skills/README.md) (D-primary framing);
  update the [`AGENTS.md`](../../AGENTS.md) skills horizon line; add
  the affordance-check line to [PDCA.md](../PDCA.md)'s Check
  visual-verification gate (D-spec primary + F-fidelity backstop).
- **First run — report only (worked example, both modes)** — run
  `ui-design` against R51 and record the reports:
  - **design-spec mode** on
    [`advanced-query.md`](../../design/data-management/advanced-query.md)
    → expected **pass** (the design declared the labeled box +
    `[Clear]` + all states);
  - **fidelity mode** on
    [`AdvancedQueryInput`](../../../workspace/apps/builder/src/features/data-management/datasets/advanced-query/AdvancedQueryInput.tsx)
    vs the design → expected **gap** (Findability, Usability).
    No code change this round — the reports localize the failure to
    the build and hand the gap to R53.
- **Self-audit** — `markdownlint-cli2` + `markdown-check-link` on
  the round's touched docs (per the R50 quality bar).

## What is OUT of scope

- **The R51 UI-fix itself** — deferred to **R53**. This round ships
  the tool + the gap report; R53 applies the label + explicit
  `[Clear]` remediation and its tests. (Separating build-tool from
  use-tool, per the R49/R50 → R51 pattern.)
- **Generative / agentic UI design** — proposing layouts, copy, or
  components. The skill _reviews_; it does not _design_. Generation
  is Track-3 system-building, gated by R99.
- **Automated visual / pixel regression** — screenshot diffing,
  design-token audits, driving the live app to render. v1 is a
  static spec-and-code review, mirroring R50's `markdown-check-link`
  (static link resolution). App-render screenshotting (via the
  `run` / `verify` skill) is a **named follow-up**, not v1.
- **Retroactive sweep of all prior surfaces** — chips, the upload
  wizard, the workspace shell, the datasets list. v1 ships + proves
  on R51 only; a broader audit is its own pulled round.
- **Aesthetic / taste judgment** — colour harmony, spacing beauty,
  brand. The checklist is structural only.

## Plan

Tooling round — PDCA template, **no DCFBI/DFCFBI gates or
flow-selector** (those are for feature rounds only). Each step
verified by lints / the skill's own report, not Hard Gates.

- [x] **Author the skill** — write
      `.agents/skills/ui-design/SKILL.md` (two modes, six-facet
      structural checklist, fidelity diff, inline report, quality
      bar) + the `.claude/skills/ui-design/SKILL.md` ref stub.
      Mirror the `gate-walker` / `markdown-check-link` conventions
      (`allowed-tools: Read, Grep, Bash(grep *)`). Cite the AntD +
      Figma references so the basis is auditable.
- [x] **Wire into the flow** — `skills/README.md` dependent-skill
      entry; `AGENTS.md` skills horizon line; `PDCA.md` Check
      affordance-check line (D-primary / F-backstop). Keep the
      load-bearing AGENTS.md horizons link valid
      (`markdown-check-link`).
- [x] **First run — report only** — run `ui-design` design-spec
      mode on R51's design doc (expect pass) and fidelity mode on
      `AdvancedQueryInput` (expect Findability + Usability gap);
      record both reports in Do. No code change.
      **→ design-spec PASS (6/6); fidelity GAP (2) — failure
      localized to the build.**
- [x] **Self-audit** — `markdownlint-cli2` + `markdown-check-link`
      across the round's touched docs; triage + safe `--fix`.
      **→ markdownlint 0 errors; link-check fixed 1 anchor, clean.**

## Risks / unknowns

- **Subjectivity creep.** "Good UX" is taste; a skill that judges
  taste collapses into noise. Mitigate as `gate-walker` does: each
  facet is verified **structurally** — a _declared_ affordance is
  _present and cited_ (or drifted) — never "is it beautiful." The
  two taste-prone facets are bounded hard: **Desirability** =
  "declares / uses the token system + matches the visual spec";
  **Credibility** = "all declared states present, no misleading
  affordance." Unreducible → `n/a`, not guessed.
- **D-vs-F weighting drift.** The skill's value is at the **Design
  gate** (preventive); used only at F it degrades to a late
  fidelity-differ. The SKILL.md + PDCA make D-spec mode the primary
  framing; watch that future rounds actually run it at D, not just
  F.
- **Over-mechanization temptation.** v1 stays a **procedure skill**
  (Read/Grep, inline report) — no script, no app-render — bounding
  the round and respecting the R99 artifact-only horizon.
  Screenshot mode is a named follow-up.
- **Theater risk.** A checklist everything passes is useless. R51
  is the built-in proof the skill bites: fidelity mode **must**
  report the label + clear gaps; design-spec mode **must** pass
  (the design was complete) — together localizing the failure to
  the build.
- **Primary-vs-dependent classification.** Resolved to
  **dependent**: by the README's definition, _primary_ skills
  operate on round files and enforce the DCFBI/DFCFBI flow
  mechanics, whereas `ui-design` operates on design docs +
  components and is callable by any round/task (like
  `markdown-check-link` / `research`). The design-side _counterpart_
  to `gate-walker` in role, not primary in taxonomy.

## Do

### Authored the skill (two modes)

- [`.agents/skills/ui-design/SKILL.md`](../../skills/ui-design/SKILL.md)
  — design-spec mode (primary, Design gate) + fidelity mode
  (backstop, F1/F2) + build-only (ad hoc); six-facet structural
  checklist with per-mode evidence source; fidelity diff; inline
  report; structural-only quality bar; AntD + Figma references
  cited. `allowed-tools: Read, Grep, Bash(grep *)` (read-only,
  no script).
- [`.claude/skills/ui-design/SKILL.md`](../../../.claude/skills/ui-design/SKILL.md)
  ref stub. The skill is discoverable at session load (appears in
  the Skill list).

### Wired into the flow

- [`skills/README.md`](../../skills/README.md) — `ui-design` under
  **Dependent skills**, D-primary / F-backstop framing.
- [`AGENTS.md`](../../AGENTS.md) skills horizon line now lists
  `flow-selector` + `gate-walker` (primary); `research`,
  `markdown-check-link`, `ui-design` (dependent) — also completing
  R50's omission of `markdown-check-link` from that line.
- [`PDCA.md`](../PDCA.md) Check visual-verification gate gains an
  affordance-check line: `ui-design` design-spec at D (primary),
  fidelity at F1/F2 (backstop).

### First run — report only (both modes on R51)

The skill is read-only; this round runs it to **demonstrate it
bites** and to localize R51's failure. **No code change** — the
remediation is R53.

**Mode 1 — design-spec (PRIMARY)** on `advanced-query.md`:

| Facet         | Verdict | Evidence                                                                         |
| ------------- | ------- | -------------------------------------------------------------------------------- |
| Findability   | pass    | § Layout declares a labeled "Advanced query" box, distinct from the search bar   |
| Usability     | pass    | § Layout declares explicit `[Clear]`; § Behavior apply-on-valid / error-no-apply |
| Accessibility | pass    | declares visible label + Enter/keyboard commit; error is text, not colour-only   |
| Credibility   | pass    | § Behavior state model: empty/typing/parsed/errored + composition                |
| Utility       | pass    | 17 acceptance criteria                                                           |
| Desirability  | pass    | declares "no new tokens" (inherits the dataset-detail token map)                 |

Result: **PASS (6/6)** — the spec was affordance-complete.

**Mode 2 — fidelity (BACKSTOP)** on `AdvancedQueryInput.tsx` vs
the design:

| Facet         | Verdict | Evidence / gap                                                                           |
| ------------- | ------- | ---------------------------------------------------------------------------------------- |
| Findability   | **gap** | no visible label (placeholder-only); field identical to the sibling `?q=` `Input.Search` |
| Usability     | **gap** | clear is hover-only `allowClear` × + backspace; design declares explicit `[Clear]`       |
| Accessibility | pass    | `aria-label="Advanced query"` + `aria-invalid`; keyboard-reachable (`onPressEnter`)      |
| Credibility   | pass    | empty/parsed/errored states all rendered                                                 |
| Utility       | pass    | implements acceptance criteria 8–11 (F2 tests)                                           |
| Desirability  | pass    | token-based (`var(--font-family-mono…)`, Typography token colours)                       |

Fidelity diff: 2 drifts — labeled box + explicit `[Clear]` dropped.
Result: **GAP (2 facets — Findability, Usability)**.

**Localization**: design-spec **pass** + fidelity **gap** ⇒ R51's
failure was at the **build**, not the spec — the exact D-primary /
F-backstop thesis, demonstrated. The fidelity gap is handed to R53
for remediation.

## Check

- **Skill authored (two modes)** + `.claude` ref stub; discoverable
  at session load (appears in the Skill list).
- **Wired** into `skills/README.md` (dependent, D-primary framing),
  `AGENTS.md` horizon line, and `PDCA.md`'s Check affordance gate
  (D-spec primary / F-fidelity backstop).
- **First run recorded both reports**: design-spec **PASS (6/6)**
  on `advanced-query.md`; fidelity **GAP (2 — Findability,
  Usability)** on `AdvancedQueryInput.tsx` — failure localized to
  the build, not the spec. Demonstrates the skill bites (theater
  risk cleared) and validates the D-primary / F-backstop thesis.
- **No code change** this round — the remediation is R53 (per the
  build-tool / use-tool split).
- **Audit clean**: `markdownlint-cli2` 0 errors across touched
  docs; `markdown-check-link --changed` clean (caught + fixed one
  anchor — `#feeds-into--round_53…` doubled-hyphen vs the checker's
  hyphen-collapsing slug).
- **Governance**: R51 (Complete) corrected via an append-only
  roadmap note, not a rewrite; this round flipped to `Review` (not
  `Complete` — human-only per [PDCA § Governance](../PDCA.md)).

## Act

**Learnings**:

- **The Design gate is where UX is decided.** Under DCFBI the F
  phase only _confirms_ — no mandate to revamp UX — so an
  affordance gap in the design ships faithfully. `ui-design` at D
  (design-spec mode) is the _preventive_ control; F1/F2 fidelity is
  the _corrective_ backstop. R51 proved both are needed: its spec
  was complete (design-spec pass) yet the build drifted (fidelity
  gap). This doctrine is captured in the skill + PDCA — no separate
  memory file (it would duplicate the repo's own record).
- **`ui-design` is the 2nd dependent skill pulled by a UX lesson**
  (after `markdown-check-link`'s link-rot pull). The pattern holds:
  feature rounds surface the tooling the method needs.
- **`markdown-check-link` earned its keep again** — 2nd real anchor
  catch across R51/R52. Its hyphen-collapsing slug is now a known
  authoring gotcha.

**Follow-ups (not promotions)**:

- **R53** — apply `ui-design`: the R51 UI-fix (label + explicit
  `[Clear]`), the skill's first remediation. See the **Feeds into**
  section below.
- **R54** — close MVP query gaps, the first feature round designed
  with `ui-design` at its Design gate.
- **`ui-design` v2** (named follow-ups): app-render/screenshot mode
  via the `run`/`verify` skill; a broader retroactive affordance
  sweep of prior surfaces (chips, wizard, shell).
- **`round-scaffolder` watch** — R51 + R52 were both heavy manual
  round-doc authoring. Two consecutive; if R53 drags too, the soft
  signal hardens into a pull.

**End-of-round Q&A**: R53 (apply `ui-design` — the UI-fix) is the
user-directed next round (decided in this session's brainstorm).
Open at handoff: proceed to R53, or batch the UI-fix differently.

## Feeds into → Round_53 — apply `ui-design` (the R51 UI-fix)

R53 is the skill's **first remediation** and its proof in use: take
R52's fidelity-mode gap report on `AdvancedQueryInput` and apply
the fix R51's design already specified — a visible "Advanced query"
label (AntD: label-above for fast-fill/readability) + an explicit
discoverable `[Clear]` (replacing the hover-only `allowClear` ×) —
i18n'd (en + vi), with FE tests asserting the label + Clear and the
full suite green. Re-run `ui-design` fidelity mode → all facets
pass.

**R54 → close MVP query gaps** (was R53): inclusive date/datetime
bounds (`on_or_after` / `on_or_before`) + string `ne`, added to the
shared predicate vocabulary; the first _feature_ round designed
with `ui-design` applied at its Design gate.

If R52/R53 authoring drags (manual round-doc boilerplate across
consecutive rounds), the `round-scaffolder` soft signal from R51
hardens into a pull.
