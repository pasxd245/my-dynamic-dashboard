# R87 prior-art brief — visual join/ER editors: add-node + column-link, lib-vs-hand-rolled, pick-vs-declare

**For**: [Round_87](../cycles/Round_87.md) Design gate — the human's "both" direction (click to add an
entity, then draw a link between columns). **Date**: 2026-06-18. **Constraints**: React + Ant Design,
accessibility-first, **FE-only over an existing governed-relationship model** (the canvas _consumes_ one
`rel_` per edge), bounded-small trees (2–4 nodes), today a hand-rolled SVG/DOM render (no graph lib).

## Summary (answer first)

1. **The two-step interaction the human described is a validated, standard pattern** — but it splits by
   tool _category_, and that split is the most important finding:
   - **Schema-authoring tools** (dbdiagram.io, drawSQL, Supabase Visual Schema Designer, MS Access /
     SSMS diagrams, Prisma visual editors) — drawing a column→column link **DECLARES a new
     foreign-key/relationship**. The diagram _is_ the schema.
   - **Query/analytics tools** (Metabase notebook, Hasura, Looker/LookML, dbt) — a join **PICKS / consumes
     an existing relationship** (auto-filled from the FK, or chosen per query); it does **not** alter the
     schema.
2. **Our canvas is squarely in the second category** — it edits a _query's_ join tree by consuming
   governed `rel_`s. So the evidence says: **column-link should PICK an existing governed `rel_`, not
   declare one inline.** Inline relationship _declaration_ is schema-authoring — it belongs to
   [relationships.md](../../design/data-management/workspaces/relationships.md) and is a **separate
   pull**, not R87.
3. **For literal column-to-column _drag_ drawing + pan/zoom, React Flow (`@xyflow/react`) is the de-facto
   React standard** (Supabase Studio, Prismaliser, Hubql, many others) and ships a **Database Schema
   Node** with **per-column connection handles** — exactly the column→column draw the human sketched,
   out of the box, with baseline keyboard/ARIA a11y. **n8n** uses its Vue sibling (Vue Flow).
4. **But there is a lighter, AntD-native, zero-dep path that reaches the same end model and is keyboard-
   accessible by construction**: click-to-add an entity node, then a **column-pair pick** (click a source
   column → click a target column, or a small `<Select>`) that resolves to the governed `rel_`. On our
   bounded-small tree this is tractable hand-rolled. **Recommendation: prototype the column-draw at the
   Design gate; default to this lighter pick-pair path unless the human values literal drag enough to take
   the React Flow peer-dep deviation.**

## Key findings (by theme)

### A. Interaction — add a node, then link

- **Add-node**: schema/diagram tools place a table by toolbar/double-click/drag-from-palette; query tools
  (Metabase) add a step that names the table. Either way "place the entity first" is conventional.
- **Column-level link**: the strongest match is **draw.io** ("drag a connector end, hover over a _row_
  inside the table, drop when the row highlights") and **React Flow's Database Schema Node** (each column
  row has its own left target-handle + right source-handle; you drag handle→handle). **MS Access**: drag a
  field onto the matching field in another table → an Edit-Relationships dialog confirms the field pair.
  **Metabase**: no canvas — you pick the table, then it auto-fills the FK column pair (or you pick the two
  columns); fully dropdown/keyboard-driven.

### B. Library vs hand-rolled

- **React Flow (`@xyflow/react`)** is the dominant React-ecosystem choice for node-link DB diagrams:
  Supabase Studio's Visual Schema Designer, Prismaliser, Visma, Hubql, and the official "Database Schema
  Node" UI component all use it. **Vue Flow** (same family) powers **n8n**'s canvas.
- The ready-made **Database Schema Node** assumes **shadcn/ui + Tailwind**, _not_ AntD — so adopting it
  means either pulling that styling stack or rebuilding the node in AntD against React Flow's headless
  core. React Flow's core is CSS-var-styleable, so an AntD-token node is feasible but is custom work.
- **dbdiagram.io is code-first** (you type DBML; the diagram is generated) — a reminder that "drawing" is
  not the only good editor; a structured picker is a legitimate, often more-accessible, alternative.
- **Looker/LookML and dbt** define joins/relationships in **governed code** consumed by queries — the
  closest analogues to our "governed `rel_` consumed per edge" model, and neither uses a draw-canvas to
  author the per-query join.

### C. Accessibility / keyboard

- **React Flow** ships real a11y: nodes/edges are Tab-focusable, Enter/Space select, arrow keys move a
  node, an `aria-live` region announces moves, ARIA roles/labels on nodes/edges, toggles
  (`nodesFocusable`, `edgesFocusable`, `disableKeyboardA11y`). **However**, this covers node _movement_ and
  selection well; **drag-to-_connect_ (drawing an edge) is pointer-centric** — a keyboard equivalent for
  "draw a column→column link" still needs custom handling either way.
- **Metabase's dropdown/notebook approach is the most accessible of all** — it's plain HTML controls, no
  drag, inherently keyboard/SR-complete. This validates a **pick-pair** affordance as the a11y-complete
  path (and mirrors our existing rule: the Form tab stays the keyboard/SR-complete equivalent).

### D. Pick-existing vs declare-new (the boundary that matters most for us)

- **Declare-new** = schema authoring (dbdiagram, drawSQL, Supabase Designer, Access, SSMS, Prisma editors):
  the drawn link mints an FK. **Out of scope for a query builder** — that's our
  [relationships.md](../../design/data-management/workspaces/relationships.md) governance surface.
- **Pick-existing** = query building (Metabase auto-fills the FK pair; Hasura _suggests_ relationships
  from FK constraints; Looker/dbt joins reference governed model definitions). **This is our case.**

## Comparison table

| Tool | Category | Add node | Column-link interaction | Graph lib | Pick vs declare | A11y note |
| --- | --- | --- | --- | --- | --- | --- |
| dbdiagram.io | Schema | type DBML | code (DBML), not drawn | none (code editor) | declare | text/code = accessible |
| drawSQL | Schema | drag/add | drag connector between tables | (proprietary canvas) | declare | drag-centric |
| Supabase Visual Schema Designer | Schema | drag-drop table/field | drag to define 1:1/1:N/N:N | **React Flow** | declare | RF baseline |
| MS Access / SSMS diagram | Schema | add table to pane | **drag field → field** → confirm dialog | native | declare | drag-centric |
| Prismaliser / Visma / Prisma editors | Schema | node-based | React Flow handles | **React Flow** | declare (schema) | RF baseline |
| draw.io ER | Diagram | shape palette | drag connector end onto a **row** | mxGraph | declare (drawing) | drag-centric |
| **Metabase notebook** | **Query** | add Join step (pick table) | **pick column pair** (auto-fills FK) | none (linear UI) | **pick/consume** | **dropdowns = fully keyboard** |
| Hasura console | Query/API | form-based | suggested from FK constraints | none (forms) | pick/consume | forms = accessible |
| Looker (LookML) / dbt | Query/model | code | join defined in governed code | none | pick/consume (governed) | text/code = accessible |
| n8n | Workflow | drag node onto canvas | drag handle→handle | **Vue Flow** | n/a (not joins) | Flow baseline |
| React Flow "Database Schema Node" | (component) | — | **per-column handles, drag handle→handle** | **React Flow** + shadcn/Tailwind | either (you wire it) | RF baseline + custom for connect |

## Risks / unknowns

- **React Flow a11y for _connecting_** is not free — node-move/select is covered; keyboard "draw a link"
  needs custom work regardless of lib. So a lib does **not** discharge the accessibility-first constraint
  for the link gesture; a pick-pair affordance does.
- **Styling integration**: the off-the-shelf schema node is shadcn/Tailwind; AntD-token parity
  ([design-token-parity](../../../scripts/lint/design-token-parity.mjs)) means custom node work either way.
- **Bundle/peer-dep deviation**: adopting React Flow deviates from the declared `react, antd` peer deps
  ([canvas.md surfaces table](../../design/data-management/queries/canvas.md)) — the exact deviation R85
  reserved "for R87's evidence." Justifiable **only** if literal drag + pan/zoom is judged worth it.
- **Pick-vs-declare creep**: if column→column linking is allowed where no `rel_` exists, the canvas
  silently becomes a schema-authoring tool (governance/BE). Must be held to **pick-existing**; "no
  governed `rel_` for these columns" guides to relationships.md, it does not declare inline.

## Recommendation (for our React/AntD, a11y-first, FE-only-over-governed-rels constraints)

1. **Adopt the human's two-step shape**: click-to-add an entity node (dataset/saved query) onto the
   canvas, then connect at **column granularity**.
2. **Semantics = PICK an existing governed `rel_`** (the Metabase/Looker/Hasura convention for our
   category). Drawing/selecting a column pair resolves to the governed `rel_` whose key pair matches →
   `addJoin`. **No inline relationship declaration** — that's a separate relationships.md pull.
3. **Mechanism = default to the lighter, AntD-native, zero-dep pick-pair** (click source column → click
   target column, or a small `<Select>` of eligible governed pairs), which is **keyboard-accessible by
   construction** and tractable on our 2–4-node trees — **unless** the Design-gate prototype shows the
   human strongly values literal drag-to-connect + pan/zoom, in which case **React Flow (`@xyflow/react`)
   is the evidence-backed library** to adopt (a flagged peer-dep deviation, with a custom AntD-token node
   and a keyboard equivalent for the connect gesture).
4. **Decide at the Design gate by a small prototype of the column-draw**, per R85's "deviation against
   R87's evidence" note — don't pre-commit the lib.

## Sources

- [Metabase — Joining data](https://www.metabase.com/docs/latest/questions/query-builder/join) ·
  [Query builder editor](https://www.metabase.com/docs/latest/questions/query-builder/editor)
- [React Flow — Accessibility](https://reactflow.dev/learn/advanced-use/accessibility) ·
  [Database Schema Node](https://reactflow.dev/ui/components/database-schema-node) ·
  [Easy Connect example](https://reactflow.dev/examples/nodes/easy-connect) ·
  [Showcase](https://reactflow.dev/showcase)
- [Supabase — Visual Schema Designer](https://supabase.com/features/visual-schema-designer) ·
  [Studio 3.0 announcement](https://supabase.com/blog/supabase-studio-3-0)
- [dbdiagram docs (DBML)](https://docs.dbdiagram.io/) · [drawSQL](https://drawsql.app/) ·
  [draw.io — ER tables](https://www.drawio.com/docs/diagram-types/entity-relationship-tables/)
- [MS Access — create/edit/delete a relationship](https://support.microsoft.com/en-us/office/create-edit-or-delete-a-relationship-dfa453a7-0b6d-4c34-a128-fdebc7e686af)
- [Prismaliser](https://github.com/Ovyerus/prismaliser) ·
  [n8n canvas / Vue Flow (DeepWiki)](https://deepwiki.com/n8n-io/n8n/6.2-workflow-canvas-and-node-management)
