# Composition — merged into the Query spine

> **Redirect stub.** Composition (a Query whose driving `sourceId` is another Query
> `qr_`, the recursive `resolve_source`, the subquery fold, join-key provenance, and the
> `composition_cycle` guard) is now part of the canonical Query spine:
> **[saved-query.md § Composed source (`qr_`)](saved-query.md#composed-source-qr_)**.
>
> A composed Query is **not a noun** — only its source reference is polymorphic
> (`sourceId: ds_ | qr_`) and the resolver recursive. Note the code-true status code: the
> cycle guard returns **`409 composition_cycle`** at create/update/preview **and** run
> (the earlier docs said `422` — corrected in the R83 design-sync). The relationship edge
> stays dataset↔dataset; a `qr_` is admitted only as the **base** source. This file
> remains only so the locked round-file links (R76, R77) keep resolving; the
> round-by-round ledger they pointed at was compacted away.
</content>
