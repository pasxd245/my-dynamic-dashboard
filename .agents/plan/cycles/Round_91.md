# Round 91: dashboards — visualize a saved Query (theme opening — Plan gate)

**Status**: Planning
**Date started**: 2026-06-19
**Date completed**: —
**Flow**: TBD — set at the Design gate via `flow-selector` (expect DFCFBI: a genuinely new
interaction surface — charting — with low prior-art confidence).

## Goal

**Inherits from ← [Round_90](Round_90.md)** — the free-form canvas is hardened and proven on
the real stack, so a saved Query now carries rich, exploratory, query-owned relationships and
runs real joined results in DuckDB. This is the **substrate for value-out**: the theme payoff
is **free exploration → rich queries → visualized**.

R91 **opens the dashboards theme** — letting a user **see** a query's results as a chart, not
only a row table. Per [purpose.md](../../context/purpose.md) this closes the product success
arc ("upload → profile → govern joins → run queries → save reports → **view dashboards**") and
the [queries.md trajectory](../../design/data-management/queries/queries.md) `NEXT →
consumer-save / dashboards (downstream value-out)`.

_Track: 1 (product — the value-out surface the whole builder exists to feed). Pulled by ←
[Round_90](Round_90.md) "Feeds into → Round_91+ (dashboards)" + [purpose.md](../../context/purpose.md)
success criterion + [queries.md](../../design/data-management/queries/queries.md) NEXT +
[[2026-06-16-post-mvp-roadmap-migration-first]]. Per the [Evolution Rule](../../AGENTS.md)._

## This is a roadmap-home surface — do not MVP-rush it

Dashboards is a **major new surface with no prior design** in the repo (no brainstorm, no
`design/` doc yet). Per [[dont-mvp-rush-a-roadmap-home-surface]], the first round must **prove
the concept at the right altitude**, not ship the lightest possible chart and call the theme
done. Like the query-owned-relationships theme (which earned a
[brainstorm](../brainstorms/2026-06-19-query-owned-relationships.md) before R88–R90), this one
likely **needs a brainstorm first** to settle the model before a build round commits.

So R91's Plan gate is a **fork in the road**, and the human chooses:

1. **R91 = brainstorm + thin first slice** — brainstorm the dashboards model, then ratify a
   deliberately thin but real first round (e.g. _one chart type on one saved Query's result_),
   sequencing the rest as R92+.
2. **R91 = brainstorm only** — a design-confidence round (no build) that settles the noun/model
   and the chart taxonomy; the first build lands R92.

## Open questions to settle (Plan → brainstorm → Design)

These are **not pre-decided** — they are the decisions this round exists to make with the human:

- **Noun vs. mode** ([[design-gate-noun-vs-mode]], the model-confidence valve in
  [hybrid-flow-governance](../../decisions/2026-05-28-hybrid-flow-governance.md)). Is a
  **Dashboard** a new persisted noun (a saved arrangement of charts, its own entity + routes),
  or a **view mode** on a saved Query (a "Chart" tab beside the result table, like Canvas is a
  tab on the builder)? Default to **mode/reuse**; a new noun must justify itself. The cheapest
  first slice is almost certainly a **chart view of one Query** (mode), deferring the
  multi-chart "dashboard" noun.
- **Data source.** A chart reads a saved Query's run (`GET /queries/{id}/rows` +
  `resolvedColumns` — both already shipped). Does R91 add **any** wire surface, or (like R89)
  ride entirely on existing endpoints? Aim for the latter for the first slice.
- **Chart taxonomy.** Which chart kind(s) first — bar / line / pie / KPI single-value? Pick the
  **one** that proves the most with the least (likely a categorical **bar** over a
  group-by-able column), and what column→encoding mapping the user controls.
- **Aggregation.** Charts usually need group-by + aggregate (sum/count/avg). Does the **query**
  produce the aggregate (a new query capability), or does the **chart** aggregate the returned
  rows client-side for the first slice? (The latter avoids a query/engine change but caps row
  volume — a named tradeoff.)
- **Charting library.** A new peer-dep decision (like React Flow at R89) — or hand-rolled SVG
  for the first slice? Decide at Design with a bundle/a11y plan; do not assume here.
- **Persistence.** If "mode," the chart spec may not persist at all in R91 (ephemeral view) or
  ride a small `definition` addition. If "noun," it needs an entity + alembic — a much larger
  round. The noun-vs-mode answer gates this.

## Plan (by gate — pending the Plan-gate fork + `flow-selector` at Design)

1. **Plan gate** — ratify: (a) the R91 scope fork above (brainstorm+slice vs. brainstorm-only),
   (b) the noun-vs-mode default (chart **view mode on a Query**, dashboard-noun deferred),
   (c) whether a brainstorm precedes the build. _(This step — awaiting human ratification.)_
2. **Brainstorm** (likely) — settle the dashboards model, chart taxonomy, aggregation locus, and
   the noun-vs-mode call; record under `plan/brainstorms/`.
3. **Design gate** — run `flow-selector`; seal the first-slice surface + chart mapping +
   library decision; run `ui-design` (design-spec mode); author the first `design/` dashboards
   doc ([[design-docs-are-source-code]]).
4. **C / F / B / I** (or **F1** if DFCFBI) — per the sealed flow.

## Acceptance criteria (draft — sharpen at Plan/Design)

- [ ] **Scope fork ratified** — the human has chosen R91's shape (brainstorm+slice vs.
      brainstorm-only) and the noun-vs-mode default.
- [ ] **A saved Query's result renders as a chart** _(first slice, if a build round)_ — one
      chart kind over a Query's real DuckDB run, no new wire field if reachable on existing
      endpoints.
- [ ] **Roadmap-home altitude honored** — the slice proves the concept without locking a wrong
      model; the rest of the theme is sequenced, not crammed.

## Risks / unknowns

- **Scope explosion** — "dashboards" can mean anything from one chart to a drag-arrange
  multi-widget board. _Mitigation: the Plan-gate fork + a thin first slice; sequence the theme._
- **Premature noun** — minting a `Dashboard` entity before the model is proven repeats the R69
  specious-model trap. _Mitigation: noun-vs-mode default to mode; model-confidence valve._
- **New charting peer-dep blast radius / a11y** — a chart lib must keep a text-equivalent
  (the result table stays the AT-complete view). _Mitigation: Design-gate decision + a11y plan._

## Do

### Plan-gate draft (2026-06-19)

Opened from [Round_90](Round_90.md)'s "Feeds into → Round_91+ (dashboards)" on the human's
instruction ("open r91"). R90 left the free-form canvas hardened + real-stack-proven, so the
query substrate for value-out is ready. Dashboards has **no prior design** in the repo — this
is a fresh, roadmap-home theme.

**Proposed**: treat R91 as the **theme opening** — ratify the scope fork (brainstorm+thin slice
vs. brainstorm-only), default the model to a **chart view mode on a saved Query** (noun
deferred), and likely **brainstorm before building**. **Awaiting the human's ratification** on
that shape before any Design/flow-selector work.

## Check

- [ ] **Plan gate** — scope fork + noun-vs-mode default + brainstorm-first decision ratified by
      the human.

## Act

_(Drafted at Review.)_

## Feeds into → Round_92+ (TBD)

The rest of the dashboards theme — additional chart kinds, aggregation in-query, and (if it
earns it) a multi-chart **Dashboard** noun — sequenced after R91 proves the first slice.
