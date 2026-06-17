# Multi-join — merged into the Query spine

> **Redirect stub.** The multi-hop join **tree** (connected acyclic topology, the
> `query_joined_rows` fold, the `T{left_idx}` ON-clause, effective columns across N
> sources, the `disconnected_join` / `cyclic_join` validation) is now part of the
> canonical Query spine:
> **[saved-query.md § Joins: reading related datasets as one](saved-query.md#joins-reading-related-datasets-as-one)**
> (see **Join tree (topology)**).
>
> A multi-join is **not a noun** — it is the ordered `definition.joins: JoinStep[]` tree.
> This file remains only so the locked round-file deep-links below keep resolving (the
> R73/R74 round-by-round ledger they pointed at was compacted away in the R83
> design-sync; the current-state spec is the code-true spine).

## Topology truth-test record (R74)

Folded into the spine. R74 confirmed the model already carried a **tree**: each
`JoinStep` names its own left/right via its governed `rel_`, so relaxing the linear-chain
policy to a connected-acyclic tree (left ∈ graph, right ∉ graph) needed **no model
change** — only the invariant, the engine ON-clause (`T{k}` → `T{left_idx}`), and the
builder affordance generalized. The current-state topology + engine live at
[saved-query.md § Joins → Join tree (topology)](saved-query.md#join-tree-topology).
</content>
