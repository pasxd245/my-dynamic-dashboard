# Design — intent-before-code artifacts

> This directory holds **intent-before-code** design artifacts for the
> product UI. The goal is to give the Human a tangible target to react
> to during PDCA's Plan phase, so feedback lands before code rather
> than after.

_Track: 2 (agent-method, dev discipline). Pulled by: conversation
2026-05-23 (workspace-shell brainstorm); companion to
[memory/2026-05-22-ui-boundary-build-first.md](../memory/2026-05-22-ui-boundary-build-first.md);
drifted-iteration handling governed by
[context/drifted-iteration.md](../context/drifted-iteration.md)._

---

## Why this directory exists

The drifted iteration had a rich design directory at
`docs/agents/design/` — but it arrived at Round 34's "finalization
pass," after code had already entangled. See
[context/drifted-iteration.md](../context/drifted-iteration.md) for
the durable summary. The **path was right; the
timing was wrong**. We do the opposite here: a concept's design
artifact is authored **before** the round that implements it, and is
what the round implements against.

The companion lesson is
[memory/2026-05-22-ui-boundary-build-first.md](../memory/2026-05-22-ui-boundary-build-first.md)
("build `@mdd/ui` first, don't extract later"). The same principle
applied one layer up: **design the UI first, don't backfill it later**.

## What lives here

- **Per-concept design specs** in markdown, grouped by domain then by
  feature cluster (mirroring `apps/builder/src/features/<domain>/<cluster>/`).
- **Optional `<concept>.target.md` horizon docs** when a concept will
  iterate across three or more rounds and needs a fixed destination.
- **Reference materials** (images, color palettes, external links)
  imported only when they survive their own scrutiny — see "What does
  NOT live here" below.

## What does NOT live here

- Implementation details (those live in `apps/builder/src/` or
  `workspace/packages/ui/src/`).
- **HTML previews / preview-shell infrastructure.** Retired at R47:
  under the DCFBI/DFCFBI flow the **FE running against MSW is the
  canonical UX preview**; design markdown is its _spec_, not a
  parallel artifact. The old `*.preview.html` files and their
  `_css/` / `_js/` preview-shell were archived at R48 and deleted in
  the 2026-06-13 restructure — a second UX source of truth was the #1
  drift risk the hybrid flow eliminated. See
  [decisions/2026-05-28-hybrid-flow-governance.md](../decisions/2026-05-28-hybrid-flow-governance.md).
- Storybook config, Ladle, or any component-gallery tooling — not
  pulled yet (see § When to add structure).
- Vendor screenshots or generated assets unless the artifact citing
  them genuinely needs them.
- Architecture/sequence diagrams for non-UI concerns — those belong
  alongside their concept (e.g., backend flows in
  `.agents/context/` or future `docs/`).
- Pixel-binding mockups. Nothing here is the production truth. The
  running builder is.

## Directory structure

```text
.agents/design/
├── README.md                         (this file)
├── _platform/                        (app-level chrome, above any domain)
│   └── <concept>.md                  (e.g. workspace-shell.md, .target.md)
└── <domain>/                         (e.g. data-management/ — mirrors features/<domain>/)
    ├── _TEMPLATE.md                  (domain doc template)
    ├── _shared/                      (concepts reused across the domain's clusters)
    │   └── <concept>.md              (e.g. crud-hygiene.md)
    └── <cluster>/                    (e.g. datasets/, workspaces/ — mirrors features/<domain>/<cluster>/)
        ├── <concept>.md              (canonical intent — always)
        └── <concept>.target.md       (horizon doc — optional)
```

- **Mirror `apps/builder/src/features/`.** Domains and their feature
  clusters track the code layout
  (`data-management/{datasets,workspaces,_shared}`); `_platform/`
  holds app-level chrome that lives above any single domain (the
  master-layout shell, whose code is in `apps/builder/src/components/`,
  not under a feature).
- **First puller wins, then promote when shared.** A concept lives
  under the cluster that pulled it into existence. When it proves
  cross-cutting — the workspace shell is consumed app-wide; the
  rename/delete modals are reused across clusters — promote it:
  app-level chrome → `_platform/`; within-domain cross-cluster → the
  domain's `_shared/`. Promotion **moves** the file and **repoints**
  inbound links (run
  [`markdown-check-link --fix`](../skills/markdown-check-link/SKILL.md));
  historical round-file links are repaired the same way rather than
  left as redirect stubs. _(First promotions: the 2026-06-13
  restructure moved `workspace-shell{,.target}.md` → `_platform/` and
  `crud-hygiene.md` → `data-management/_shared/`.)_

## File-format conventions

### Canonical: `<concept>.md`

Always present. Markdown is the contract. Contains:

- **Status header**: concept name, round that introduced it,
  status (draft / accepted / superseded).
- **Surface declaration** (mandatory): a table at the top of the
  doc, before Reference materials, listing every surface the concept
  introduces. Columns: **Surface · Layer · Reusability · Purity ·
  Allowed peer deps**. This declaration is how each concept doc
  re-states how it specifically honors the UI/BIZ boundary rule per
  [memory/2026-05-22-ui-boundary-build-first.md](../memory/2026-05-22-ui-boundary-build-first.md).
  A reader of one design doc must be able to tell which surface
  belongs in `@mdd/ui` vs `apps/builder/src/features/<domain>/`
  without leaving the doc.
  - **Layer** values: `@mdd/ui`, `apps/builder/src/`, or a specific
    deeper path (`apps/builder/src/features/<domain>/`).
  - **Reusability** and **Purity** cells follow a **base token +
    optional `(qualifier)`** form: the token before any `(…)` must be
    one of the canonical values below; the parenthetical is freeform
    annotation (e.g. `glue (server-data)`, `feature (DM domain)`,
    `pure (no react)`). The lint checks the base token only.
  - **Reusability** base tokens: `shared cross-domain` (an `@mdd/ui`
    primitive, reusable across domains), `feature` (domain-feature
    code), `builder-only` (builder-app glue/api/host), `backend`
    (backend route/helper), `data type` (a type-alias surface).
    _(R64: reconciled to the corpus's de-facto usage. The earlier
    `domain-only` is folded into `feature`; `one-off` was unused and
    retired.)_
  - **Purity** base tokens: `plain-UI` (no router, no query, no zod),
    `glue` (router-aware or wires BIZ libs to UI), `data constant`,
    `feature` (full BIZ), `data type`, `pure` (a pure function — no
    react, no router, no fetch).
  - **Allowed peer deps**: explicit list. For `@mdd/ui` surfaces,
    must stay within `react`, `react-dom`, `antd`,
    `@ant-design/icons` (the permanent allow-list). Anything else
    is a BIZ leak.
- **Reference materials**: links to extracted drifted lessons,
  external inspiration, or sibling design docs. Marked clearly as
  _reference_, not authority.
- **ASCII layout**: unicode box-drawing for spatial structure.
  Mermaid is for flows/states, not for layout — be explicit.
- **Token map**: a table mapping each surface (background,
  border, active-state, text) to a CSS variable or AntD seed
  token already defined in
  [workspace/packages/ui/src/themeTokens.ts](../../workspace/packages/ui/src/themeTokens.ts).
  Never invent values inline; cite the source.
- **Behavior**: state transitions, interaction notes. Mermaid
  `stateDiagram-v2` or `sequenceDiagram` where they help.
- **Component contract** (if the concept produces a `@mdd/ui`
  primitive): prop signature, router-agnostic / BIZ-peer-free
  rules per
  [memory/2026-05-22-ui-boundary-build-first.md](../memory/2026-05-22-ui-boundary-build-first.md),
  one positive + one negative usage example.
- **Scope boundary**: what this concept covers, what is
  deferred, what is explicitly out.

### Optional: `<concept>.target.md`

Present only when a concept will iterate across **three or more
rounds** before reaching its destination shape, and a horizon doc
helps each round walk toward (not away from) that destination. The
trigger to author a target doc is observed Brownian motion: each
round lands a single decision without a system-level target visible,
risking the drifted-iteration failure mode where R33's hand-rolled
sidebar was retired in R35.

A target doc is **strictly for the destination**, never amended to
track current state. The canonical `<concept>.md` is amended in
place as rounds land; the target stays fixed (or is superseded with
a redirect stub) so future-self can see the original horizon.

Format requirements:

- **TARGET-NOT-CURRENT banner** near the top of the file (visible at
  first scroll), so the doc can't be mistaken for the canonical
  contract.
- **Surface declaration table** with rows for future surfaces marked
  `(future)`. Layer / Reusability / Purity / Allowed peer deps are
  declared up-front so future rounds implement against the schema.
- **ASCII target layout** for the destination state.
- **Component contracts (target signatures)** for primitives that
  do not yet exist — TypeScript-shaped prop signatures, marked as
  "future shape" or "not yet implemented".
- **Named pulls table** sketching the rounds that will land each
  surface, citing the corresponding distillation memo entry (when
  the target draws from a memo). Order is suggestive, not binding.
- **Lifecycle clause**: when the last named pull lands, fold
  relevant material into the canonical doc and delete the target.

First instance: see
[\_platform/workspace-shell.target.md](_platform/workspace-shell.target.md)
(Round 10).

## Lifecycle: when docs come and go

### Target docs

- **Created** in the round that decides a concept will iterate
  across 3+ rounds and needs a visible destination.
- **Never amended to track current state.** The target stays fixed
  for the lifetime of the iteration; current-state changes belong in
  the canonical `<concept>.md`. If the destination itself changes,
  the target is **superseded with a redirect stub** (same discipline
  as a canonical doc that splits or moves), not amended.
- **Retired** when the last named pull from the target lands.
  Relevant material folds into the canonical doc and the target is
  deleted in the same round. There is no automatic sweep.

### Canonical specs

- **Markdown specs are durable.** They survive concept evolution;
  amend in place when the concept matures, or supersede with a
  redirect stub when it splits or moves. When a concept is promoted
  across clusters, **move** it and repoint inbound links (§ Directory
  structure) rather than leaving a stub.

## Token authority

There is **one** source of design tokens for the product:
[workspace/packages/ui/src/themeTokens.ts](../../workspace/packages/ui/src/themeTokens.ts).

Everything in this directory **cites** that source; nothing here
shadows or overrides it. When a round changes tokens, the design
docs are updated as part of that round (or the round is rejected
during review). Token drift between this directory and the
authoritative source is a bug, not a style.

External token references (e.g., the drifted iteration's old
`Styles.css`) are read-only reference material. Current design docs
cite [context/drifted-iteration.md](../context/drifted-iteration.md)
or an extracted memory instead of linking to local-only ignored
paths. Adopting any value from them is a decision in a round, not an
implicit copy.

## Adding a new design artifact

1. Decide the **domain + cluster** (matches
   `apps/builder/src/features/<domain>/<cluster>/`). App-level chrome
   goes in `_platform/`; a concept reused across a domain's clusters
   goes in `<domain>/_shared/`.
2. Create `.agents/design/<domain>/<cluster>/<concept>.md` from the
   format above.
3. Fill the **Surface declaration** table at the top of the doc —
   one row per surface the concept introduces. A concept doc without
   this table is incomplete; do not skip it.
4. Decide whether a `<concept>.target.md` is needed (concept will
   iterate across 3+ rounds and needs a visible destination? yes;
   one-or-two-round concept? no).
5. Reference the design artifact from the round that authored it
   (`Round_NN.md` → Plan section cites the design doc).
6. Implement against the design; reconcile any divergence by
   amending the design doc in the same round.

## When to add structure (deferred decisions)

Per the [Evolution Rule](../AGENTS.md), structure is added when a
real pull arrives — not in anticipation. The following expansions
are foreseeable but not yet justified; this section names the
trigger so the next round knows when to act.

### Cross-cutting promotion (`_platform/`, `<domain>/_shared/`)

**Trigger**: when a concept living under one cluster is genuinely
consumed by a second cluster or domain (two real consumers, not a
manufactured duplicate — see
[memory/2026-06-13-specious-model-lock-in.md](../memory/2026-06-13-specious-model-lock-in.md)).
Promote it by **moving** the file (app-level chrome → `_platform/`;
within-domain cross-cluster → `<domain>/_shared/`) and repointing
inbound links with
[`markdown-check-link --fix`](../skills/markdown-check-link/SKILL.md)
in the same round. Don't pre-create empty cluster folders for
concepts that don't exist yet.

### Component-gallery tooling (Storybook / Ladle)

**Trigger**: when `@mdd/ui` reaches **three or more** primitives and
a real need to view them in isolation surfaces. The round that hits
the trigger picks the tool from then-current constraints — lean
Ladle as a default, not a commitment.
