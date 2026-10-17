# rc.5 — tags (conditional)

Parent: [release-rc2-rc5.plan.md](release-rc2-rc5.plan.md).

**Default: skip.** `tags` is a recorded deferral in `datasets.md`. rc.5 opens only if the rolling log
shows naming conventions + search failing to find things — e.g. saved copies (3.6) and
`adhoc-YYYY-MM-DD-<topic>` workspaces piling up so that a person cannot find "everything about
topic X" across workspaces.

If it opens:

- **Contract:** `tags: [string]` (lowercase, `^[a-z0-9][a-z0-9-]{0,31}$`, ≤ 10 per item) on dataset,
  query, dashboard, workflow; `GET /search?tag=…` across workspaces.
- **Migration:** a `tags` table `(kind, id, tag)`; downgrade drops it.
- **Builder:** tag chips on detail views; a tag filter on list pages.
- **Gate:** the logged finding that opened rc.5 is re-run and now succeeds.

If it does not open: rc.4's tag becomes **v0.0.1**, and this file folds into the program's closing
note.
