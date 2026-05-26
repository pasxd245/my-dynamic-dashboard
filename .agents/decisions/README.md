# Decisions

Cross-round commitments captured from conversation. The anti-drift anchor
for promises that span multiple rounds and aren't owned by any single
round doc.

## What goes here

- **Multi-round commitments** ("no X before round N")
- **Track-2/3 deferrals with named triggers** — what we are explicitly
  *not* building, and the condition that would revisit it
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

## Lifecycle

- **active** — currently binding
- **superseded** — replaced by a later decision (link forward)
- **expired** — `revisit-when` fired and the decision was retired

When a decision is superseded or expired, keep the file (it's history),
flip `status:`, and remove it from the Index below.

## Index (active only)

- [2026-05-27 — R99 evo-horizon](2026-05-27-r99-evo-horizon.md) —
  No Track-3 system-building before Round 99; artifact-only until then.
- [2026-05-27 — Verification stack queue](2026-05-27-verification-stack-queue.md) —
  Ordered queue of verification investments (MSW first; Playwright,
  preview-HTML, retriever parked with named triggers).
