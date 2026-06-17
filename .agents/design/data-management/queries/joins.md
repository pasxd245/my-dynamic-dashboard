# Joins — merged into the Query spine

> **Redirect stub.** The single-edge join model, the `query_joined_rows` engine, the
> effective-column space, the per-hop `409 relationship_stale` gate, and the outer-join
> types are now part of the canonical Query spine:
> **[saved-query.md § Joins — reading related datasets as one](saved-query.md#joins-reading-related-datasets-as-one)**.
>
> A join is **not a noun** — it is a `JoinStep` in the spine's `definition.joins` list.
> This file remains only so the locked round-file deep-links below keep resolving (the
> round-by-round truth-test ledger they pointed at was compacted away in the R83
> design-sync; the current-state spec is the code-true spine).

## Truth-test record (J-4)

Folded into the spine. R71's truth-test confirmed that R70's governed
[Relationship](../workspaces/relationships.md) edge carries a real join's **inputs** (two
sources, the dtype-validated key pair, the freshness gate) while join **type**,
projection, and predicate qualification are **query-time** concerns held in the
`QueryDefinition`, not the edge. The edge needed no revision; the genuinely-new work was
the multi-source engine. See
[saved-query.md § Joins](saved-query.md#joins-reading-related-datasets-as-one) +
[§ Composed source](saved-query.md#composed-source-qr_).

## R75 outer join types

Folded into the spine. Each `JoinStep.type` ∈ `inner | left | right | full` maps to the
matching SQL JOIN keyword per hop (`_JOIN_KEYWORDS`); an outer join keeps unmatched rows
(NULL → empty cell), and a graph may mix types. See
[saved-query.md § Joins → Join types](saved-query.md#join-types).
</content>
