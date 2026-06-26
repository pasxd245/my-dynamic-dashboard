# Product value framing — ease-of-use (#1, stands alone) ⇄ AI-loop (#2, additive)

**Date**: 2026-06-26
**Agent**: claude-opus-4-8
**Confidence**: High
**Status**: New

## Problem

At the R100 dashboard kickoff the human gave, across several turns, the load-bearing
product framing — who the user is, what hurts them, what we are (and are *not*) building,
and the **priority order** of the two value props. It was being recorded only in
local/auto-memory; it must live in the repo (shared, version-controlled) because it
should steer **every round from here**, not just this session.

## Finding

### We are NOT competing with BI platforms

Not Attio / Metabase / Power BI / Tableau. Don't import their "best practice" as a target.
The user is **someone whose current tool can't answer their question right now** — they
bring their own data and try this to close *their own gap*, **quickly**. Prior-art research
(e.g. the R100 live-vs-snapshot brief) is useful only as evidence that a concept is
*separable*, never as a standard to conform to. Framing decisions as "what do the big tools
do / what performs best" is the wrong axis and pulls scope toward platform-competition.

Anchored in the real pain — see [purpose.md](../context/purpose.md) (broken CRM→Excel
reporting; users already know Excel; relationships central; schema flexibility).

### The user is a BASIC-Excel user — this is the hard constraint

A *leader* with only basic Excel skill. The stuck is the **report-maintenance treadmill**:
(1) build the report once (pivots/VLOOKUP/formulas) — already above their head; (2) every
period re-feed the new CRM export by hand + fix ranges/refresh pivots; (3) the **CRM export
structure drifts** (cols renamed/added/removed, rows grow) → `#REF!`/`#N/A`, dead pivot
sources; (4) they hit a **wall** — can't see why it broke, can't fix it alone; (5) so they
live with recurring **dread** + **dependence** on a more-skilled colleague.

The hurt is not just lost time: it is **powerlessness over their own data**, dependence on
someone else's schedule, and — deepest — **never fully trusting the report they put their
name on.** Their real skill (judgment) is blocked by spreadsheet *plumbing* they never
signed up to learn.

### PRIORITY ORDER (the reframe — the spine of this doctrine)

- **#1 — Easy to use. The floor; stands on its own with ZERO AI.** A basic-Excel leader
  must get real, switch-worthy value *by hand* — no agent, no subscription. If the AI never
  existed, the core product still has to win. This is the bedrock and the primary build
  target. Ease-of-use is **existential** (the reason to switch), not a nice-to-have.
- **#2 — AI evolve (the agent-loop).** An **additive premium layer** for whoever has
  **AI-skill + a subscription**: *user states a business need → an AI agent operates the
  platform's primitives → the human verifies the **meaning** (not the formulas).* It
  accelerates an already-easy product; it is **never load-bearing** for the core value.
- **#3 — Heavy DA task / compute, as a *separate surface* (TENTATIVE — parked, set 2026-06-26;
  details deferred).** A higher tier for a **bespoke deep insight** beyond reading a standard
  dashboard (e.g. *"boss asks for a certain insight from the data"*). The thing that is off-axis and
  parked here is the **separate Python-analyst SURFACE** (think **Plotly Dash** — a parallel
  Python-served front-end), **off the #1 formula-free axis** because authoring analysis in code is
  the opposite of formula-free. The rungs are needs-driven: **#1 can't solve everything → #2 exists;
  #2 doesn't cover the heaviest bespoke surface → #3 may.**

**CRITICAL — do not pin Polars to #3 (anti-lock-in).** **Polars is a COMPUTE ENGINE, tier-agnostic** —
it is **not** the off-axis thing. Its first pull is the **workflow / complex-query** feature, a
**core-trajectory roadmap item** (the long-standing *"workflow (YAML + Polars)"* deferral across
R71–R77; [[post-mvp-roadmap-migration-first]]) that stays **formula-free** and renders to the **same
recharts widgets**. Polars serves #1/#2 core; it *could* also back #3. **Only the Dash-style separate
surface is the #3 / off-axis fork.** This doctrine MUST NOT be cited to *resist* adding Polars when a
workflow round pulls it — that would be the constitution braking the thing it exists to enable
([[gates-dont-survive-self-modification]] · dynamic equilibrium).

**Architectural through-line (set at R100) — separate two orthogonal layers:**

- **Compute** (where aggregation happens): client JS today → **DuckDB `GROUP BY`** → **Polars** for
  multi-step *workflows*. A compute upgrade behind an endpoint feeds `{label, value}` to the **same
  widget** — the widget impl is the swappable detail ([[layout-is-the-architecture]]).
- **Presentation** (how it renders): **recharts widgets in the one React app** (#1/#2). A **Dash**
  surface (#3) is a *different front-end app*, not a charting-lib swap — **Dash ≠ a charting lib**.
  Adopt Dash only with a real #3 *surface* pull, never as a side effect of "we need a heavier
  aggregate" (that's a compute pull → DuckDB/Polars, presentation unchanged).

The #1/#2 recharts dashboard and a future #3 Dash surface **coexist** (different jobs); Polars may
power either.

Build #1 first, on its own merit; #2 layers on top; #3 (the separate surface) is a parked higher
tier. Everything in the core product must be **fully usable by hand**; the agent only makes an
already-easy thing faster.

### Why the #2 agent-loop beats Excel + an AI plugin — the moat is the SUBSTRATE, not the AI

- **Excel is an ungoverned grid.** The model (what joins what, what a column means, fact vs
  measure) lives only in the user's head + fragile formulas. An AI on Excel must **re-infer**
  structure every time, **breaks on CRM drift** like the user's formulas do, and to *verify*
  its VLOOKUP you'd need the Excel skill the user lacks.
- **This platform makes the model explicit + governed** — typed/profiled columns,
  relationships defined **once and reused**, queries as **durable named definitions**
  ([query-owned-relationships](2026-06-19-query-owned-relationships.md)), drift **flagged**
  not silently broken ([purpose.md](../context/purpose.md) #4/#5). So the agent operates on
  **stable primitives**, the result **survives new data**, and the human **verifies meaning,
  not mechanics** — never auditing a formula. That verify loop is only possible *because* the
  substrate is governed.
- **Honest boundary** (the human is unsure future Excel can't improve — don't over-claim):
  one-shot Excel+AI ("chart from this sheet") *will* improve. The durable gap is **governed
  reuse + drift survival + business-level verification** — which needs a model layer a
  spreadsheet lacks. **AND the edge is on us:** it holds only if we keep the substrate
  genuinely governed and verification genuinely business-level.

## Evidence

- Round: [Round_100](../plan/cycles/Round_100.md) (dashboard theme-opener — this framing is
  recorded in its Goal/Do sections; live-vs-snapshot brief used as separability evidence only).
- Source: the human's framing across the 2026-06-26 R100 kickoff dialogue ("we don't compete";
  "my excel skill just basic"; "tell the BIZ + my needs → agent supports → I verify";
  "easy to use #1 even without AI · AI evolve #2 for AI-skill+subscription").

## Recommendation

**Do**:

- Judge every product decision by "does this make it **easier** for a basic-Excel user to
  quickly solve **their own** data gap?" — before any performance/parity argument.
- Default to the simplest mental model with the fewest concepts to learn.
- Build the core product **fully usable by hand** (#1); treat the agent-loop as an additive
  #2 layer for AI-skill+subscription users.
- For any surface, check: (a) does it keep the model **governed + reusable** (not re-inferred
  per task)? (b) can the user **verify in business terms**, with no formula/mechanics skill?

**Don't**:

- Frame decisions as "what the big tools do / what performs best" (wrong axis — we don't
  compete; performance is not our axis).
- Make the AI-loop load-bearing for core value, or assume the user has AI-skill/subscription.
- **Ever make the user read/write a formula or configure a pivot to use — or to verify — the
  product.** That moment = we have become Excel with extra steps (the one failure that
  collapses both #1 and the #2 moat).

## Promotion Candidate?

- [ ] `context/` – Stable pattern, broadly applicable (candidate for `context/purpose.md`
      adjacency once it survives a few rounds)
- [ ] `skills/` – Reusable procedure/checklist
- [x] Not yet – Needs more validation (set this session; let it prove out across the dashboard theme)

---

> Filename convention: `YYYY-MM-DD-short-topic.md` or `agent-name-topic.md`.
> Status lifecycle: `New` → `Needs Review` → `Promoted` → `Archived`.
> See [.agents/AGENTS.md](../AGENTS.md) for the write policy.
