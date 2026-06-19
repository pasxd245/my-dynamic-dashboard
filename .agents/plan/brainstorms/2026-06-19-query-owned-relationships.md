# Brainstorm — Query-owned relationships (copy-on-pick · define free-form · promote)

**Date**: 2026-06-19
**Status**: Vision sealed by the human across the R87 F1 review (2026-06-18→19); the substantive
calls below are **decided**, the remaining items are **Design-gate questions** for the theme's first
round.
**Pulled by**: the **R87 F1 verdict** — the human ran the shipped pick-pair canvas editor and judged it
"almost the same as the current Form builder," then articulated the missing capability: a Data Analyst
needs **query-local, free-form relationships**, not only the predefined governed FKs.
_Track: 1 (product feature — model evolution + new capability). Per the
[Evolution Rule](../../AGENTS.md)._

Feeds the canvas theme ([canvas.md](../../design/data-management/queries/canvas.md)) and the relationships
domain ([relationships.md](../../design/data-management/workspaces/relationships.md)).

---

## 1. The core reframe — two kinds of relationship

| | **Governed (workspace ER)** | **Query-owned (ad-hoc)** |
| --- | --- | --- |
| Purpose | Predefined; the **reusable** speed-up **and** the **biz-context** entity model | A DA **playing with data** — exploratory joins beyond the declared FKs |
| Scope | Workspace; shared; validated; single source of truth | Lives **inside one query**; not (yet) part of the governed schema |
| Today | `Relationship` (`rel_…`), persisted, referenced by `JoinStep.relationshipId` | **does not exist yet** — this theme adds it |

**The decision: a query owns its relationships.** Every join in a query resolves through the query's
**own** relationship records. The governed ER becomes two things to a query:

- a **library you copy from** — picking a governed `rel_` **copies** its definition into the query as a
  query-owned rel (with a back-reference to the origin); and
- a **promotion target** — a useful query-owned rel can be **promoted** up into the concrete governed ER.

```
        Governed ER (workspace)
            │  copy-on-pick                       ▲  promote (deliberate, dedup/conflict rules)
            ▼                                     │
        Query-owned relationships  ◀── define free-form here too (no governed rel needed)
            │
            └── joins[] resolve through these (not through rel_ ids)
```

R87's pick-pair editor **is** the copy-on-pick half — so it is retained, not thrown away. The new work is
**(a)** define free-form and **(b)** promote, plus the model change that makes joins query-owned.

---

## 2. Why this is better (not just "more freedom")

1. **Queries stop being brittle.** Today a query *references* a governed `rel_`; editing/deleting that
   rel breaks the query out from under the analyst (the `409 relationship_stale` path). With a **copy**,
   the query runs on its own snapshot — the governed ER can evolve without silently breaking saved
   analyses. This is the headline robustness win.
2. **The draw gesture finally earns its keep.** Drawing a line to *pick* an existing rel is redundant
   with a dropdown (why R87 felt list-like). Drawing to *create* a query-owned rel is not — the gesture
   produces something. This is what justifies a free-form canvas (and React Flow) downstream.
3. **Governance stays clean.** Ad-hoc rels are query-scoped; the governed ER only changes via an explicit
   **Promote**. Free exploration (accelerate) + governed reuse (brake), with promotion as the bridge —
   the [dynamic equilibrium](../../context/purpose.md#dynamic-equilibrium) in one feature.

---

## 3. Settled decisions (the human's calls — do not relitigate)

1. **Back-reference / provenance — YES.** Each query-owned rel keeps `originRelationshipId` (the governed
   rel it was copied from), or null when defined free-form. _(agreed)_
2. **Divergence policy — WARN ONLY, no auto-impact.** When the origin governed rel changes or is removed,
   the builder **warns** ("the source relationship changed/was removed — your query uses its own copy");
   **re-syncing is the user's choice**, never automatic. The snapshot is intentionally stable — the future
   **data-saver** theme owns the "save before staling" lifecycle, not this round. _(human, 2026-06-19)_
3. **Promotion rules — YES, needs a small rulebook.** On promote: dedupe against an equivalent governed
   rel; resolve cardinality/column conflicts. _(agreed)_
4. **Model / contract / engine change — accepted as the heaviest part.** `JoinStep` stops pointing at a
   governed `rel_` and resolves through query-owned rels; the join resolver reads query-owned specs.
   Validation (dtype-compat, acyclic, leaf) is **reused**, not reinvented. _(agreed)_
5. **No backward-compat — CLEAN SLATE.** We are on `dev`. **Collapse alembic to a single fresh `0001`**
   carrying the new model; drop `0002_query_source_id`'s incremental history; re-create seed data. **No
   migration of old `relationshipId`-shaped queries.** Don't over-care about compat. _(human, 2026-06-19)_

---

## 4. Proposed model shape (to seal at the theme's Design gate — not yet final)

```ts
// QueryDefinition gains the query's OWN relationships; joins resolve through them.
type QueryRelationship = {
  id: string;                    // query-local id
  leftDatasetId: string;
  leftColumn: string;
  rightDatasetId: string;
  rightColumn: string;
  cardinality: Cardinality;      // same vocab as the governed Relationship
  originRelationshipId?: string; // back-ref to the governed rel copied from (provenance; null = free-form)
};

type JoinStep = {
  queryRelId: string;            // WAS relationshipId (→ governed rel); now → a query-owned rel
  type: JoinType;                // unchanged (inner | left | right | full)
};

type QueryDefinition = {
  q?: string | null;
  filters: FilterAtom[];
  advanced: FilterAtom[][];
  relationships: QueryRelationship[]; // NEW — seeded by copy-on-pick, or defined free-form
  joins: JoinStep[];                  // each hop references a query-owned rel
};
```

- **Same connected-acyclic tree** as today; the only change is *where the edge definition lives* (in the
  query, not the workspace store).
- **Promotion** = `POST` a `QueryRelationship` up to the workspace `relationships` (dedup/conflict per
  decision 3); on success the query-owned rel gains/keeps its `originRelationshipId`.
- **Reuse** the governed `Relationship` validation + the existing join engine's ON-clause/guard logic —
  it just sources the key pair from the query-owned rel.

---

## 5. Sequencing — the theme's rounds (truth first)

Build the model before the canvas before the dashboard:

| Round | Slice | Why this order |
| --- | --- | --- |
| **R88 (proposed) — model truth** | Query-owned relationships: contract (`query.yaml`), BE models + join resolver, **fresh alembic `0001`**, FE types, **copy-on-pick** wired into the existing list + R87 canvas (no new UX yet). | The model is the truth; everything else rides on it. Clean-slate makes it cheap. |
| **R89 (later) — free-form canvas UX** | Draw column→column to **define** a query-owned rel (no governed match needed) + **promote**; adopt **React Flow** here (drawing now *creates*, so drag/pan-zoom pays off). | The UX the F1 verdict asked for; only worth it once the model carries ad-hoc rels. |
| **R90+ (later) — dashboards** | Charts / insights over the richer queries. | The payoff: free exploration → rich queries → visualized. Roadmap horizon, out of this theme's first cut. |

---

## 6. Open Design-gate questions (for R88)

- **Model home of `relationships[]`** — a sibling list in `QueryDefinition` (proposed §4), or embed the
  spec inline on each `JoinStep`? (Sibling list supports promotion + provenance more naturally.)
- **Promotion endpoint** — reuse `POST /workspaces/{id}/relationships`, or a dedicated promote route?
  (dedup and conflict rules — decision 3).
- **Divergence detection** — how the builder compares a query-owned rel to its origin governed rel to
  raise the warn (decision 2): on read, recompute and diff?
- **Flow** — `flow-selector` at R88's Design gate (expect contract+BE → a fuller DCFBI; possibly DFCFBI if
  the copy-on-pick UX needs a prototype, though R88's UX is "no new UX yet").
- **Persistence-foundation check** — collapsing to a fresh `0001` (decision 5) must re-create the seed +
  the contract-parity tests; confirm `test_schema_parity` / seed scripts come along.

---

## 7. Risks + mitigations

| Risk | Mitigation |
| --- | --- |
| Governance dilution (ad-hoc rels erode the governed ER) | Query-scoped by construction; the ER only changes via explicit **Promote** (decision 3). |
| Snapshot divergence from the governed truth | **Back-ref + warn-only** (decisions 1–2); re-sync is user choice; data-saver owns the lifecycle later. |
| Two parallel graph UIs (canvas vs workspace ER) | One graph engine (React Flow) configured for both, decided at R89's Design gate — not R88. |
| Model/contract/engine blast radius | Clean-slate `0001` (decision 5); reuse existing validation + join engine; **R88 ships no new UX** to bound it. |
| Scope creep into dashboards | Explicitly R90+; this theme stops at model (R88) + free-form canvas (R89). |
