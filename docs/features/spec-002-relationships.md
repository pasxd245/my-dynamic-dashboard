# Spec 002 — Relationship Rules

**Status**: ✅ Complete | **Source of truth**: [specs/002-relationship-rules/](../../specs/002-relationship-rules/)

## What it does

Govern multi-table joins by defining relationship rules between datasets. Only **approved** rules are usable in the query builder, enforcing the "Approved-Only Joins" constitution principle.

## Capabilities

- Visual relationship rule builder
- Overlap and cardinality analysis (informs join safety)
- Status lifecycle: `suggested` → `approved`
- Governance gates: low-overlap acknowledgment, actor audit trail

## Where to look

- Spec: [spec.md](../../specs/002-relationship-rules/spec.md)
- Data model: [data-model.md](../../specs/002-relationship-rules/data-model.md)
- Contracts: [contracts/](../../specs/002-relationship-rules/contracts/)
