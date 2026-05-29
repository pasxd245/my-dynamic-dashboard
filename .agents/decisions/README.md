# Decisions

Cross-round commitments captured from conversation. The anti-drift anchor
for promises that span multiple rounds and aren't owned by any single
round doc.

## What goes here

- **Multi-round commitments** ("no X before round N")
- **Track-2/3 deferrals with named triggers** — what we are explicitly
  _not_ building, and the condition that would revisit it
- **Conversation-derived governance** that constrains the
  [Evolution Rule](../AGENTS.md#evolution-rule-governance-against-drift)
  without amending it

## What does NOT go here

- Reusable patterns / gotchas → [`memory/`](../memory/)
- Within-a-round decisions → that round's doc under
  [`plan/cycles/`](../plan/cycles/)
- Capabilities that graduated from memory → [`plan/promotions.md`](../plan/promotions.md)
- Durable purpose statements → [`context/`](../context/)

## Format

One file per decision: `YYYY-MM-DD-kebab-slug.md`. Use
[`_TEMPLATE.md`](_TEMPLATE.md) as the starting point.

### Frontmatter schema (v1)

Every decision file carries structured frontmatter so both humans and
future agents can query the register without re-reading prose:

| Field             | Required | Purpose                                                                                                                         |
| ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `decided`         | yes      | Date the decision was bound. `YYYY-MM-DD`.                                                                                      |
| `source-round`    | yes      | Where this came from. `RNN` for a numbered round, `conv:YYYY-MM-DD` for a conversation-derived decision, or a memory-file path. |
| `track`           | yes      | `1` (product) \| `2` (agent-method) \| `3` (self-evo). Comma-separated for cross-cutting.                                       |
| `status`          | yes      | Closed vocabulary — see Lifecycle below.                                                                                        |
| `applies-when`    | yes      | One-line scope statement. WHERE / WHEN this constrains future work.                                                             |
| `failure-mode`    | yes      | One-line. WHAT bad outcome this guards against. Forces honesty: a hand-wavy `failure-mode` is a smell the proposal isn't ready. |
| `revisit-trigger` | yes      | Named condition (round id, event, measurable threshold) that re-opens the decision. Not "TBD" or "later".                       |
| `promoted-to`     | yes      | Path the decision matured into, or `null`. Filled when an `applies-when` scope is fully absorbed by code or a sibling decision. |

The schema deliberately mirrors `applies-when:` from the
[R99 evo-horizon](2026-05-27-r99-evo-horizon.md) carve-out — that
decision named memory tagging as Track-3 infrastructure; this schema
extends the discipline to decisions themselves.

### Why the schema (not just prose)

Two compounding benefits:

- **Now (focus discipline)**: filling `failure-mode:` and
  `revisit-trigger:` forces evidence-based reasoning. If we can't name
  what we're guarding against or what would change our mind, the
  decision isn't ready to land.
- **Later (queryable retrieval)**: structured fields beat free-text
  search for the queries that matter — `status: parked AND track: 2`,
  `revisit-trigger` mentioning a measurable threshold, etc. Pull-driven
  by the R99 horizon's named expectation of retrieval infrastructure.

### Where the schema is NOT applied

Load-bearing artifacts only. Skip frontmatter for:

- **`memory/` entries** — personal habits / patterns / gotchas have
  their own simpler structure
- **`plan/cycles/Round_NN.md`** — has Status + Date header already
- **Casual notes / READMEs** — prose suffices

## Lifecycle

Closed vocabulary for `status:`:

- **proposed** — drafted but not yet binding (rare; usually goes
  straight to `active`)
- **active** — currently binding
- **landed** — `applies-when` scope completed; the carve-out is now in
  code / process. Decision file stays as history.
- **parked** — `revisit-trigger` hasn't fired; decision is queued for
  later attention. Common for verification-stack-queue items.
- **superseded** — replaced by a later decision (link forward)

When a decision is superseded, keep the file (it's history), flip
`status:`, and remove it from the Index below. `landed` decisions stay
in the index briefly (one round) then move to a "Recently landed"
sub-section before being archived.

## Index (active only)

- [2026-05-27 — R99 evo-horizon](2026-05-27-r99-evo-horizon.md) —
  No Track-3 system-building before Round 99; artifact-only until then.
- [2026-05-27 — Verification stack queue](2026-05-27-verification-stack-queue.md) —
  Ordered queue of verification investments (MSW first; Playwright,
  preview-HTML, retriever parked with named triggers).
- [2026-05-27 — MSW contract-anchor](2026-05-27-msw-contract-anchor.md) —
  FE MSW handlers schema-validate against contract YAML; YAML
  `examples:` blocks are the canonical fixture reference.
- [2026-05-27 — Categorization proposal test](2026-05-27-categorization-proposal-test.md) —
  Before adding a new field/enum/taxonomy, show which existing
  field's job it replaces and why that field is insufficient.
