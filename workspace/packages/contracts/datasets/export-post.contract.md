# POST /datasets/{id}/export — rationale (R196)

- **Why a dataset export at all.** A saved copy (R193) is read on its own page only: a widget's number
  over a copy needs a frozen dashboard (OUT). The manager's way to take "the numbers we decided on" to
  Excel is the copy's rows — so the copy, and any dataset, exports. The query export (R182) needs a
  query; making one over a copy is refused (read-only workspace).
- **Visible columns only.** `hidden` is a presentation hint; the file follows what the page shows.
- **The data version rides along** (3.2c): the Filters sheet and `X-MDD-Data-Versions` say which rows
  the file holds; a copy says it is frozen and what it froze.
- **Same cap and cell typing** as the query export, by reusing its writers.
