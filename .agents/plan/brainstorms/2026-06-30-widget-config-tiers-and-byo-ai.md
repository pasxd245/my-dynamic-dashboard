# Widget config tiers + spec-as-currency + BYO-AI bridge — brainstorm

> **Status: brainstorm (working conclusions, NOT locked).** Came out of the R109–R118 charts probe
> ([ledger](2026-06-29-charts-probe-data-layer.md)); sits *before* the data-layer theme. Anything here that
> we act on later gets a proper Plan/Design gate (and the security item → a decision/guardrail).
>
> _Track: 1 (product — presentation + AI-loop). Pulled by: the R109–R117 finding that structured props don't
> scale to chart-library expressiveness, + the human's brainstorm 2026-06-30. Consistent with
> [[2026-06-26-product-value-framing]] and [[charts-probe-data-layer]]._

## The problem

We cannot serve every charting need by **adding more structured props** (`seriesCol`, `measureCol2`,
`target`, `numberFormat`, …). The R109–R117 arc proved it: the builder's cognitive complexity hit **23**
across 10 chart kinds while still covering a sliver of what recharts/ECharts can do (see their galleries).
Enumerating props is a treadmill. So: **how do we bring chart-library expressiveness to the end-user?**

## Reframe — tier by CONFIG MODE, not by library

"Simple = recharts / Advanced = ECharts" is the wrong axis: the library is an **internal detail**
(heatmap/gauge are ECharts yet configured by the same simple dropdowns). The real axis is **how the config is
produced**:

| Surface | Expressiveness | For | Touches JSON? |
| --- | --- | --- | --- |
| Structured dropdowns (today) | the common ~80% | #1 everyday | no |
| Templates / presets (pick a gallery chart, bind data) | curated breadth | #1 everyday | no |
| **AI-from-intent** (describe → AI edits the spec → verify the *chart*) | **the whole gallery** | **#2** | no (AI's medium) |
| Raw spec editor (import / hand-edit) | full | #3 power | yes |

## Spec-as-currency — one artifact, several pens

Every chart is ultimately a **config spec**. The structured builder is just *one editor* that emits a narrow
slice of it. So we build **one thing** — a validated chart-spec + renderer + a view/edit surface (the R108
inspector → editor) — and the spec is authored by any of:

1. **AI-from-intent (#2, primary pen).** The user describes the change in words; the AI manipulates the rich
   spec; the user **verifies the rendered chart, not the config**. This is literally our #2 thesis (state
   need → agent operates → human verifies *meaning*), and chart config is a near-perfect fit. It's how a
   non-technical user "adjusts the chart from the UI" without ever seeing JSON: **the conversation is the
   config UI.**
2. **BYO-AI copy-paste (the big unlock — see below).**
3. **Manual edit (#3 escape/override).** A power user tweaks what the AI produced. Not blank authoring.

So #2 and #3 aren't separate features — **#3 is "see and touch what #2 made."**

## BYO-AI bridge — the cheap, early way to ship #2-grade value

A "hand-edit" need NOT be a developer. A non-coder who has **any chat AI** (ChatGPT, Claude, **M365 Copilot**,
Gemini — and our persona, a basic-Excel leader in a company, very likely already has Copilot) can do it **if
our app exports a suitable input and imports the result**:

`export bundle → paste into their AI → ask in words → paste result back → we validate + render`.

This ships the #2 loop **before we build any in-app AI**, on intelligence the user already pays for.

**The "suitable input" (export bundle) must contain:**

- the **current spec** (the chart config);
- the **data context** — the query's columns + dtypes (+ a few sample rows) so the AI knows what it can
  reference;
- a **return contract** — "reply with a spec matching this schema; bind data via `dataset.source`, do NOT
  inline it" — so the returned chart stays **live**, not frozen on sample data.

**Import = validate against the schema + bind to the live query + render.**

## ⚠️ SECURITY GUARDRAIL (capture this — harness/guardrail, not just a nicety)

The spec is now **untrusted input** (it comes from an external LLM or a pasted file). ECharts `option`
permits **executable function values** (e.g. `formatter`, event callbacks). **A pasted-in / AI-returned spec
MUST NOT carry executable code.** Therefore:

- The advanced spec is a **declarative subset of ECharts `option` ONLY**.
- On import we **reject any function strings / executable fields** (allow-list of declarative keys; strip or
  refuse the rest), and never `eval`/`new Function` anything.
- This keeps the spec **safe to store, safe to render, and portable**.

This is a hard rule for whatever import/validation we build — it belongs in the eventual decision/guardrail,
not just code review.

## Why the advanced spec should BE an ECharts-`option` subset

ECharts `option` is **LLM-native** — every major model has seen mountains of it. If our advanced spec is a
declarative ECharts-`option` subset, external AIs (and ours later) can edit it **out of the box**, zero
teaching. Inventing our own DSL would make every AI fumble. So:

- **Advanced tier** = declarative ECharts-`option` subset (full power, lib-specific, LLM-native).
- **Structured tier** stays the **lib-agnostic abstract model** (the R114-proven seam) — bar/line/pie/etc.,
  lib auto-picked, no JSON, #1.

Two representations, one `WidgetView` seam. The trade (advanced couples to ECharts) is *worth it* precisely
because LLM-nativeness is what makes BYO-AI + #2 work.

## The two focuses (human's framing) + the "heavy DA" decomposition

Two things we actually care about now:

- **Data-layer: how easy to escape Excel** (the #1 ease driver — get data in + shaped without Excel pain).
- **Widget/chart: how much we support, easy DA → heavy DA.**

**Trap to avoid: "all-by-widget."** "Heavy DA" is not one thing — and only one slice is the widget:

| "Heavy DA" really means… | Lives in | Not… |
| --- | --- | --- |
| Heavy **compute** (big aggregates / pivots / transforms) | **data-layer** (workflow / Polars) | the widget |
| Heavy **presentation** (rich/custom charts) | **advanced widget tier** (spec + AI/manual) | compute |
| Heavy **bespoke analyst task** (ad-hoc Python) | a **separate surface** (parked Dash-like #3) | the dashboard |

Keep the **widget a presentation consumer** — even a "heavy" chart just renders a spec over query results.
The heaviness is upstream (data layer) or sideways (separate surface, parked). Don't let the chart become a
compute engine → that's the drift into "BI-tool-with-JSON" we explicitly avoid.

## AI is the bridge across BOTH axes

The #2 loop spans the whole pipeline:

- data-layer axis → AI = "shape my data" (write the query/workflow → escape Excel without SQL/Polars);
- widget axis → AI = "shape my chart" (write the spec → reach the gallery without ECharts).

**The product in one sentence:**

> Escape Excel (get data in + shaped) → see it (widget) → adjust by asking (AI edits the **data** or the
> **chart**) → verify the result, never the config.

The two axes **meet at the widget↔query binding** — exactly the arc's finding that different widgets want
different fetch modes (aggregate / scalar / raw). Design the data-layer aggregate knowing a widget (structured
*or* spec) binds to it.

## Path forward (sequencing)

1. **Data-layer first** — the demand-proven dominant pull (server-side aggregate / GROUP-BY = the workflow
   feature). Every tier above consumes the same query results, so an advanced/AI widget hits the *same*
   aggregate ceiling; building presentation first just re-exposes it.
2. **Then the spec substrate** — a validated declarative ECharts-`option`-subset spec + the export bundle +
   the validating import (with the security guardrail). This alone **ships the BYO-AI loop**.
3. **Then in-app #2** — "automate the copy-paste": we call the model with the same bundle + same validator.
4. **Templates** can slot in for #1 breadth whenever; the structured builder's declarative-field-schema
   refactor is a separate presentation cleanup.

Manual/BYO is **not a throwaway** — it's the foundation in-app #2 automates later.

## Open questions (for a later Design gate — not resolved here)

- For #1 end-users, does **templates** or **BYO-AI** carry more of the early value? (changes what ships first
  in the presentation theme)
- Exact **allow-list** for the declarative ECharts-`option` subset (which keys in / out).
- Where the **data-binding contract** lives in the export bundle (so returned specs stay live).
- Whether structured widgets ever "graduate" to a spec (edit-as-advanced) — one-way or round-trip?
