# Step-model extensibility — more steps · AI/YAML · what else — brainstorm

> **Status: brainstorm (working conclusions, NOT locked).** Came out of the R139 F2
> review, when the human asked three forward questions: (1) add more steps (sort,
> date_trunc, date format, popular aggregate functions), (2) think of #2 (AI support)
> → YAML edit/import for advanced users → so the step model must be extendable, and
> (3) what else? Anything acted on gets a proper Design gate + round.
>
> _Track: 1 (product — the data-shaping trajectory). Pulled by: the human's three
> threads at R139. Consistent with [[workflows-extend-query-duckdb-first]] (steps =
> DuckDB-first, extend the closed vocabulary) and the product-value framing (#1 ease
> stands alone; #2 AI-loop is additive-premium; #3 heavy-DA is a separate surface).
> The Workflow surface it extends is specced in the [workflows design
> doc](../../design/data-management/workflows/workflows.md)._

## The one insight that ties all three threads together

The step engine is a **`kind`-discriminated, declarative, closed-vocabulary union**
(`aggregate | derive | filter | top_n`): each kind is validated by a dispatch branch
(`_plan_one_step`) and compiled to DuckDB SQL (`_apply_step`). Three consequences:

1. **It is already extensible by construction.** A new step = one `kind` + a plan
   branch + an apply branch + an editor + a contract schema. "Must the step be
   extendable?" — yes, it already is. Nothing structural blocks growth.
2. **The same declarative model powers UI (#1) AND AI/YAML (#2).** The UI renders a
   step editor over the vocabulary; an AI emits the *same* steps; the backend
   re-validates every step (422 with `loc`/`msg`), so an **AI-generated spec
   self-corrects against the contract**. YAML import/edit is then merely a
   *serialization layer over the existing JSON `definition`* — not a new engine.
3. **The guardrail that keeps 1+2 aligned: never add a free-SQL or free-formula
   step.** Free SQL breaks #1 (it is "Excel-with-extra-steps" — the founding hard
   test) and #2 (a raw blob is hard for an AI to get right and for a human to verify
   the *meaning* of). **Extend the closed vocabulary; never open it.**

So the whole discussion reduces to: **grow a closed catalog of declarative
operations, and expose that catalog to the UI, to YAML, and to the AI identically.**

## Thread 1 — more steps, by value ÷ cost

| Want | Shape | Cost | Value |
| --- | --- | --- | --- |
| avg / min / max / count_distinct | extend the aggregate `agg` enum (today: sum/count) | tiny | high — everyday rollups |
| date_trunc (month/quarter/year) | column-producing op (period bucket) | small | **highest** — monthly/quarterly rollups ARE the CRM-reporting pain |
| sort (order, no limit) | new step (`top_n` minus the limit) | tiny | medium — deliverable ordering |
| select / rename / reorder columns | new step | small | high — the "consolidated Excel out" needs specific, friendly columns |
| date_format (e.g. "Jan 2026") | column-producing op (display label) | small | medium — labels for the deliverable |

Three natural families: **measures** (extend the aggregate enum), **column
producers** (date_trunc, date_format, and later round/upper/lower…), and **row/column
shaping** (sort, select/rename/reorder).

## The fork that gates the column-producer family

Before building date_trunc/format/etc., decide **how** column producers are modelled:

- **(A) Narrow step-per-function** — `{kind:'date_trunc', …}`, `{kind:'date_format',
  …}`, … Simple each, but the union **sprawls** and every new function is a full
  round (schema + plan + apply + editor).
- **(B) One `compute` step + a closed function catalog** — `{kind:'compute',
  fn:'date_trunc', args:{col, unit}, as}`, where `fn` is drawn from a growing but
  **closed** catalog. The union stays small; a new function is a catalog entry (+ its
  SQL template + editor arg-form), not a new kind. The UI renders a function picker;
  **the AI picks from the same catalog**; YAML names the same `fn`.

**Lean: (B) for column producers**, because it scales for *both* breadth (thread 1)
and AI/YAML (thread 2) from one seam — and the function catalog IS the thing the AI
and an advanced YAML author target. Keep `sort` and `select` as their own small kinds
(they are row/column *shaping*, not column *computation*), and `avg/min/max/
count_distinct` as a plain enum extension (cheapest win, no fork needed). This is the
one architectural decision worth locking before the date family. The long-run vision
(§ below) strengthens this lean further: **the catalog call-shape is the future
plugin ABI**, so (B) is also the substrate the plugin ecosystem stands on.

## Thread 2 — #2 (AI) → YAML edit/import

Refines the earlier "YAML parked" note ([workflows design doc](../../design/data-management/workflows/workflows.md)
§Scope): parked as the **primary #1 path**, but legitimate as a **#2 additive-premium
surface**.

- **YAML import/edit = serialization over the existing contract.** The `definition` is
  already JSON with an OpenAPI schema; YAML is the same tree in a friendlier text
  form. A parse/emit layer, not a new model — cheap *iff* steps stay declarative
  (the guardrail above).
- **The AI-loop shape**: human states a need → AI emits a workflow `definition`
  (YAML/JSON) → backend validates (422 self-correct) → **human verifies the
  *meaning*** (this is where a per-step preview/diff earns its place) → run. UI stays
  the primary #1 path; YAML/AI is the advanced/premium lane. Never load-bearing.
- **Extensibility requirement it imposes**: the vocabulary must be **self-describing +
  stable** (it is — the contract), and **closed** (no raw SQL). The `compute` catalog
  (fork B) is the most AI-legible extension seam: a finite, documented function list
  the model can be grounded on.

**Net**: YAML/AI does not need a *different* step model — it needs the *same* one kept
declarative and closed. Fork (B) serves it directly.

## Thread 3 — what else

- **Column shaping (select / rename / reorder)** — the most-requested thing the moment
  someone has a materialized output to hand to a boss. Pairs with the deliverable.
- **The value-out deliverable (Excel/CSV download)** — deferred at R136; the shaped
  columns are exactly what gets exported. Natural next surface once shaping exists.
- **Scheduled / one-click refresh — the out-of-the-box one.** The R131-era cold-review
  found the *deepest* pain is not the one-time build but the **recurring monthly
  refresh** (new CRM export → re-run everything). More steps polish the one-time
  build; a "refresh this workflow" (then a schedule) attacks the **treadmill** itself.
  Highest strategic leverage, biggest surface — likely its own theme, not a step.
- **Join-based consolidation** (enrich, not just union/stack) — named OUT at R135;
  pull when a real consolidation cannot be a union.
- **Step preview / diff** — we deliberately have no live preview, but the #2 AI-loop
  needs the human to verify *meaning*; a per-step "what this did" view may become the
  verification surface (serves both #1 confidence and #2 review).

## The long-run vision — "Services as Software" (BYO-AI + a plugin ecosystem)

> Added in a second brainstorm pass (2026-07-02, the human's long-run framing).
> **Vision, not commitment** — the near-term roadmap below is unchanged; this section
> records WHERE it points and which cheap design choices NOW keep that future open.

**The vision (human's framing).** As AI becomes more useful, the endgame is
**"Services as Software"**: the user buys the OUTCOME (the report maintained, the
consolidation done), not a tool they operate. The #2 doctrine already carries the
seed — *state a need → the agent operates → the human verifies meaning*. Two
additions complete the picture:

- **BYO-AI** — an advanced user brings their own AI, which authors the "extra" work:
  e.g. a new domain column like hg_code's `plugin.is_authorized("column")` (a
  Polars-callable plugin function). The human's job shifts from writing to verifying.
- **A plugin ecosystem, OUTSIDE this repo** — community-contributed functions in a
  separate plugin repo, explicitly opt-in for advanced users (a "do your own
  research" warning — the browser-extension trust UX), never load-bearing for #1.

**The extension-mechanism ladder** (what "call predefined / Polars / plugins from
YAML" actually decomposes into — each rung a different author + trust boundary):

| Rung | Who writes the fn | Power | Tier |
| --- | --- | --- | --- |
| 1. Closed SQL vocab (`compute` catalog) | — (declarative) | low | #1 + #2 |
| 2. Curated catalog incl. **Polars-backed** (fuzzy, dates) | us (vetted) | medium | #1 + #2 |
| 3. Polars expressions exposed to the user | user (DSL) | high | advanced |
| 4. **Plugins** (user/AI-authored Python, community repo) | user's AI | max | #2-advanced / self-host |

**Why rung 4 is legitimate (what changed vs the earlier brake):**

1. **Domain semantics are the real wall.** A closed catalog can cover *generic*
   compute forever; it can NEVER cover `is_authorized` — a user-domain predicate.
   When that wall fires, the only honest answers are "no" or "plugins"; there is no
   third, catalog-shaped answer.
2. **The Excel precedent.** Excel is simultaneously the #1-ease tool AND a platform
   with VBA/add-ins — macros never hurt basic users; they made Excel the durable
   platform. dbt packages / Home Assistant / Airflow providers repeat the shape:
   **safe core · opt-in ecosystem · explicit trust boundary · separate repo**.
3. **BYO-AI changes authorship economics.** The advanced user doesn't hand-write
   Python; their AI does. The platform's job is not authoring but **GOVERNANCE**:
   validation, typing, isolated execution, and the verify-meaning surface.

**The bridge — near-term choices that make the future cheap.** The `compute` catalog
(fork B) call-shape IS the future plugin ABI. Design it with four properties and
plugins become a *namespace extension*, not a new mechanism:

1. **Namespaced fn ids** — `core.date_trunc` today; `plugin:<repo>.is_authorized`
   later. One resolver.
2. **Self-describing registry** — every entry declares its args schema + output
   dtype. The UI renders arg forms from it, the AI grounds on it, YAML names it, and
   step-threading reads the declared output type. A plugin must declare the same
   contract — **plugins are contract-first too**.
3. **An executor slot per entry** — `duckdb-sql` today; `polars` when the first
   Polars-backed catalog fn lands. The Polars slot a CATALOG fn uses is the SAME slot
   a PLUGIN fn uses later; sandboxing wraps the slot, not the model.
4. **Trust-tier metadata** — `core | community | local` on every entry. Invisible
   now; the warning UX + policy gate later.

**Gates that must fire before any plugin round** (the brake, now as fire conditions):
(a) a real domain-semantic need a catalog genuinely cannot express; (b) the #2
AI-authoring lane exists first (the plugin's author is an AI); (c) an
execution-isolation story — self-hosted/enterprise deployment or a hard sandbox. The
plugin repo is community, versioned, and OUT of this repo; the core runs fully
without it.

### The mission ring — marketplace economics in the AI era (Kahneman-grounded)

> Third brainstorm pass (2026-07-02): the human's mission framing — a small thing
> solving our own CRM pain, driven by a big dream; classic path = gain users →
> commercialize (marketplace); the game-changer = AI can author most things itself.

**The inversion.** A plugin marketplace classically sells *code*. AI collapses the
price of average code toward zero — the marketplace's long tail evaporates. What
stays scarce (what "quality stuff" precisely means): **domain truth** (the
authorization list behind `is_authorized` — AI writes the function, it doesn't own
the fact), **vetted trust** (reputation-staked, warranted), and **maintenance
against drift** (keeps working as the world changes — the CRM-drift pain, one level
up). So the marketplace inverts from an *artifact market* into a **service market**:
contributors sell *maintained domain truth*, AI authors the commodity glue, the
end-user buys the outcome. Services-as-Software closes its own loop — even the
plugins are services.

**Kahneman grounding.** *WYSIATI*: AI output looks complete; S1 can't see missing
edge cases — so the scarce good is what counters WYSIATI (provenance, verification,
a legible trust tier; the marketplace's real product is making S1 adoption safe).
*Loss aversion*: users weigh the broken monthly report (recurring loss) ~2× an
equivalent gain — willingness-to-pay is insurance-shaped → subscription/service
economics, not artifact sales. *Regression to the mean*: an AI-flooded plugin pool
regresses to mediocre; staying above the mean needs a mechanism (curation,
reputation, upkeep) — that mechanism is what the platform monetizes.

**Three honest challenges (S3).** (1) **AI reverses the chicken-and-egg** — the AI
lane covers the long tail from day one, so no ecosystem is needed to win early
users; the marketplace moves to LAST in sequence, built only when domain-truth
contributors actually appear (default-don't-add, one ring out). (2) **Features are
nobody's moat, including ours** — the durable assets are the governed substrate
(contracts/validation/typing/materialization), the verify-meaning surface, the trust
registry, and the user's accumulated workflows (switching cost). (3) **Value
capture** stays as doctrine already says: #2 = AI-skill + subscription, additive
premium; a marketplace take is a *trust-rake, not a code-rake*.

**The rings, each gated by the previous ring's real demand:**

> ease (#1) → AI lane (#2, subscription) → plugins (domain semantics) →
> marketplace (trust economy). The small CRM-pain thing is not a stepping stone to
> the dream — it IS ring one, dogfooded.

## Rough roadmap (thin rounds, each a Design gate first)

1. **Aggregate functions** — enum-extend `agg` to avg/min/max/count_distinct. Cheapest
   high-value; no fork needed. (Good first round.)
2. **Lock fork (B)** — a short design decision: `compute` step + closed function
   catalog. Then **date_trunc** as its first catalog entry (the highest-value op).
3. **sort** + **select/rename/reorder** — deliverable shaping.
4. **Value-out deliverable** (Excel/CSV) — export the shaped output.
5. **AI/YAML lane** (#2) — YAML import/emit over the contract + validation loop;
   advanced/premium. Depends on the vocabulary being stable + closed (1–3 above).
6. **Scheduled refresh** — separate theme; attacks the recurring treadmill.

## What is NOT decided here (needs a real gate)

- Fork (A) vs (B) for column producers — **recommend (B)**, but it is a lock-in
  decision (cold-review at the gate).
- Whether YAML/AI is in the near roadmap at all, or stays parked until a concrete #2
  pull (an actual AI-authoring feature) fires.
- Scheduled refresh scope (manual re-run button → cron → CRM-drift detection) — a
  theme-sized question, not a step.
- Plugin-round timing — the vision § names its three fire-gates (domain-semantic
  wall · AI lane exists · isolation story); until they fire, only the four cheap
  catalog properties (namespacing, registry, executor slot, trust tier) are built —
  as part of fork (B), not as plugin infra.

## Links

- [[workflows-extend-query-duckdb-first]] — steps = DuckDB-first, extend the closed
  vocabulary (the doctrine this grows).
- [[d-gate-artifact-in-design-corpus]] — each acted-on item authors its design-doc
  section BEFORE code.
- [workflows design doc](../../design/data-management/workflows/workflows.md) — the
  surface + step model these extend.
- [2026-07-01 queries⇒workflows brainstorm](2026-07-01-queries-to-workflows-module.md)
  — the module this builds on; `hg_code` was the config-driven (YAML) prior art.
