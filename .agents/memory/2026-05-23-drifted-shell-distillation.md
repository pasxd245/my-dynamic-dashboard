# Drifted AppShell distillation — pull-list for future rounds

**Date**: 2026-05-23
**Agent**: claude-opus-4-7
**Confidence**: High (for ADOPT/REJECT verdicts — direct evidence in drifted source); Medium (for DEFER triggers — depends on future product pulls)
**Status**: New

> **Drifted context**: this memo is one extracted lesson from the old
> local-only drifted reference. Use
> [drifted-iteration.md](../context/drifted-iteration.md) for the
> durable summary, lifecycle, and citation discipline. The principles
> below stand on their own; the old checkout was evidence, not
> load-bearing context.

## Problem

The drifted iteration's
`docs/agents/design/design-guidelines.md`
and
`packages/ui/src/Components/MasterLayout/index.tsx`
are a post-mortem distillation that earned its decomposition over ~35
rounds. Per the 2026-05-23 brainstorming conversation, dialectical
negation requires preserving the _principles_ this material crystallised
while negating the _timing_ (entanglement) that produced it. Without a
curated pull-list, future rounds will either cherry-pick ad-hoc or
re-discover lessons that are already paid for.

## Finding

The drifted shell system decomposes into ≤ 20 principles with clear
verdicts. The system primitives (`PageCard`, `PageHeader`,
`WorkflowShell`, sizing tiers, motion tokens) survive the negation;
the BIZ leaks (`useNavigationContext`, `Pages/NotFound`,
`MddUIProvider`) do not.

## Pull-list

Each bullet is **a discrete pull** with a verdict and a drifted-source
citation. **ADOPT-NOW** = this round (R10) absorbs it into its own
outputs. **ADOPT-VIA-ROUND** = a named future round will pull this as
its single feature. **DEFER** = no concrete pull yet; named trigger
for re-evaluation. **REJECT** = anti-pattern, with reason.

### ADOPT-NOW (R10 bakes into its own outputs)

- **A. Layer/reuse/purity header table** in every design MD. Source:
  the boundary rule in
  [memory/2026-05-22-ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md)
  combined with drifted's § 3.5 ("Rule of one shell"). Baked into
  `.agents/design/README.md` template + workspace-shell.md backfill
  this round. Verdict: ADOPT-NOW.
- **B. "Rule of one shell" / "Rule of one card" anti-fragmentation
  principle.** Source: drifted `design-guidelines.md § 3.1, § 3.5`.
  Stated as principle in `workspace-shell.target.md` this round; the
  primitives that enforce it (`PageCard`, `AppShell`) are
  ADOPT-VIA-ROUND. Verdict: ADOPT-NOW (principle only).
- **C. Slot-pattern + discriminated-union nav signature.** Source:
  drifted
  `MasterLayout/index.tsx:17-19`
  (`navigation: NavigationItem[]` OR `navGroups: NavigationGroup[]`,
  plus `title?: ReactNode` / `header?: ReactNode` precedence and
  `Logo?: FC<IconProps>` / `brand?: ReactNode` precedence). Recorded
  in `workspace-shell.target.md` as the prop signature the future
  shell evolves toward; not implemented this round. Verdict:
  ADOPT-NOW (signature only).

### ADOPT-VIA-ROUND (each is a named future round)

- **D. `PageCard` primitive in `@mdd/ui`.** Source: drifted
  `§ 3.1 PageCard`
  and `packages/ui/src/Components/PageCard/`.
  "Every route lives in one." Includes `variant="flush"` for pages
  that draw to the card edge. **R11 candidate** — the strongest
  next pull because the Data Management placeholder is the first
  occupant.
- **E. `PageHeader` primitive in `@mdd/ui`.** Source: drifted
  `§ 3.5 PageHeader`
  and `packages/ui/src/Components/PageHeader/`.
  Per-route breadcrumb + title + subtitle, consumes a routeMeta
  shape that the builder owns. **R12 candidate** — pairs with the
  first PageCard consumer.
- **F. Sizing tier lock (32 / 40 / 48).** Source: drifted
  `§ 2 Sizing`.
  Three tiers only; pin AntD `controlHeightSM` / `controlHeight` /
  `controlHeightLG`. Small token-layer round, updates
  [themeTokens.ts](../../workspace/packages/ui/src/themeTokens.ts) +
  the design doc. **R13 candidate.**
- **G. 8px spacing grid + `.stack-N` helpers.** Source: drifted
  `§ 3.4`.
  Replaces ad-hoc `space-y-*` with `.stack-2/3/4/6/8`. Couples
  naturally with F; can ship in the same round or split.
- **H. Motion tokens (120/180/240ms).** Source: drifted
  `§ 1.2`.
  Replace R09's ad-hoc 200ms with AntD's `motionDurationFast/Mid/Slow`.
  Tiny round (~10 lines).
- **I. Paired Fold/Unfold hamburger icons.** Source: drifted
  `MasterLayout/index.tsx:86`
  (`MenuFoldOutlined` / `MenuUnfoldOutlined`). R09 chose single
  `MenuOutlined` and deferred paired icons to "a polish round". This
  is that round; affordance gain is real (icon shows direction).
- **J. NAV_GROUPS data shape (flat vs grouped union).** Source:
  drifted
  `MasterLayout/index.tsx:17-19`.
  When the second feature domain arrives, the current flat
  `NAV_ITEMS` becomes a `NavigationGroup[]` (e.g.,
  "Workspace" + "Admin" groups). Trigger: 2nd domain. Tied to the
  build-first promotion criterion.
- **K. AntD-wrapper testing pattern.** Source: R08 (icon-dep
  discovery) + R09 Act-section ("Tooltip strips data attributes").
  Two instances in our own rounds; a third instance triggers
  promotion to `.agents/context/` as a short "testing patterns for
  `@mdd/ui` primitives composed of AntD" doc. Not a feature round —
  a promotion round.

### DEFER (no concrete pull; named trigger)

- **L. Brand palette + typography refresh** (`#4F45B6` purple,
  Cairo/Poppins, 15-20px radii). Source: drifted
  `Styles.css`
  and `§ 1.1`.
  Already deferred since R07. Trigger: product chooses brand
  identity (not an agent-method decision; a stakeholder one).
- **M. `WorkflowShell` specialised PageCard.** Source: drifted
  `§ 3.2`.
  Adds stage navigation, active-context bar, prerequisite callouts.
  Trigger: first `/workflow/*` route in product. Likely far off
  (CRM-export to analytics may not need this shape).
- **N. TanStack Query + TanStack Table.** Source: drifted `§ 4–6`.
  Trigger: first feature that reads server data with pagination,
  sorting, or caching needs. Both libs are pulled together (Table
  cells often use Query state). Likely couples with the first real
  Data Management feature.
- **O. Tailwind + CSS layer order** (`@layer tailwind-base,
tailwind-components, tailwind-utilities, antd`). Source: drifted
  `§ 1.0`
  — they hit a real defect in R35 iteration 11 ("Input/InputNumber/
  Button render naked") to learn this. Trigger: only if Tailwind
  enters this codebase at all. The drifted preview-HTML uses
  Tailwind via CDN, but production today is AntD-only — no
  pre-built Tailwind. **If we add Tailwind, adopt the layer order
  in the same round** so we don't repeat their defect.
- **P. Dark mode + density (compact) + zero-runtime mode.** Source:
  drifted `§ 9`.
  No current pull; user preference doesn't exist yet.

### REJECT (anti-patterns)

- **Q. `useNavigationContext` (React Context) inside `@mdd/ui`.**
  Source: drifted
  `packages/ui/src/Contexts/NavigationContext/`
  and `MasterLayout/index.tsx:52`
  (`useNavigationContext()`). Direct BIZ leak per
  [build-first memo](2026-05-22-ui-boundary-build-first.md): a
  cross-cutting state provider in the UI package couples consumers
  to that state shape and forces the package to know about
  application semantics. R09 already proved the right pattern:
  collapse state is held in the builder (`useState` in `AppLayout`)
  and passed in via props. Verdict: never add Context to `@mdd/ui`.
- **R. `Pages/` directory in `@mdd/ui`.** Source: drifted
  `packages/ui/src/Pages/NotFound/`.
  Pages are route components — they are BIZ by definition (they
  bind to URLs, fetch data, compose features). `@mdd/ui` provides
  primitives that pages compose; pages themselves live in
  [apps/builder/src/features/](../../workspace/apps/builder/src/features/).
  Already prevented structurally (no `Pages/` dir today); recording
  to avoid creation.
- **S. `MddUIProvider` cross-cutting state provider in `@mdd/ui`.**
  Source: drifted
  `packages/ui/src/Providers/MddUIProvider/`.
  Couples every UI consumer to a state shape the UI package owns.
  R04's `<ThemeStyle>` is the only UI-side provider needed —
  look-and-feel only. Verdict: never add a state Provider to
  `@mdd/ui`; theme/token provider only.
- **T. Runtime `console.warn` for slot-precedence collisions.**
  Source: drifted
  `MasterLayout/index.tsx:29-48`
  (`warnOnPrecedenceCollisions`, `isDev()`). Same collision is
  catchable at compile time with a discriminated union (TS already
  enforces "exactly one of A or B"). Runtime warnings are
  over-engineering: 20 lines of dev-mode plumbing that a 3-line
  type can do for free. Verdict: prefer types over runtime warnings.

## Evidence

- Drifted-iteration hub:
  [drifted-iteration.md](../context/drifted-iteration.md)
- Drifted design contract, `MasterLayout`, and UI package layout:
  distilled into the pull-list above so this memo remains useful
  after the local ignored reference is removed.
- Companion build-first lesson:
  [memory/2026-05-22-ui-boundary-build-first.md](2026-05-22-ui-boundary-build-first.md)
- Round 10 plan:
  [.agents/plan/cycles/Round_10.md](../plan/cycles/Round_10.md)

## Recommendation

**Do**:

- Treat this memo as a **backlog** of named pulls, not a contract.
  Future rounds pull one entry as their scope.
- Update verdicts in place when a pull lands (ADOPT-VIA-ROUND
  becomes ADOPTED with the landing round number; DEFER becomes
  ADOPT-VIA-ROUND when the trigger fires).
- Re-cut at higher abstraction if the list grows past 20 — the cap
  is a quality gate against bloat.

**Don't**:

- Cherry-pick from drifted without consulting this memo. The whole
  point is to make the decisions visible.
- Treat REJECT entries as "maybe later." The BIZ-leak rejections
  are structural rules; revisiting them would require revisiting
  the build-first memo first.
- Let this memo drift from reality. If a future round adds a
  primitive that isn't on this list, the memo is incomplete —
  amend in the round that pulled it.

## Promotion Candidate?

- [ ] `context/` – Not yet. This is a _lesson register_ tied to a
      specific external reference (the drifted iteration); when the
      register's pulls are all landed or rejected, the surviving
      principles fold into [context/](../context/) and this memo
      archives.
- [ ] `skills/` – No. Not a reusable procedure.
- [x] Not yet – Stays in `memory/` until ADOPT-VIA-ROUND pulls are
      exhausted (likely R11–R15 window).

---

> Filename convention: `YYYY-MM-DD-short-topic.md`.
> Status lifecycle: `New` → `Needs Review` → `Promoted` → `Archived`.
> See [.agents/AGENTS.md](../AGENTS.md) for the write policy.
