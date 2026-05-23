# Design — HIxAI brainstorming artifacts

> This directory holds **intent-before-code** design artifacts for the
> product UI. The goal is to give the Human a tangible target to react
> to during PDCA's Plan phase, so feedback lands before code rather
> than after.

_Track: 2 (agent-method, dev discipline). Pulled by: conversation
2026-05-23 (workspace-shell brainstorm); companion to
[memory/2026-05-22-ui-boundary-build-first.md](../memory/2026-05-22-ui-boundary-build-first.md);
drifted-iteration evidence at
`tmp/ref-apps/my-dynamic-dashboard-drifted/docs/agents/design/`._

---

## Why this directory exists

The drifted iteration had a rich design directory at
`docs/agents/design/` — but it arrived at Round 34's "finalization
pass," after code had already entangled. The **path was right; the
timing was wrong**. We do the opposite here: a concept's design
artifact is authored **before** the round that implements it, and is
what the round implements against.

The companion lesson is
[memory/2026-05-22-ui-boundary-build-first.md](../memory/2026-05-22-ui-boundary-build-first.md)
("build `@mdd/ui` first, don't extract later"). The same principle
applied one layer up: **design the UI first, don't backfill it later**.

## What lives here

- **Per-concept design specs** in markdown, grouped by domain.
- **Optional brainstorming previews** in HTML (Tailwind via CDN, no
  build) when a concept introduces a _new_ visual pattern that text
  cannot adequately convey.
- **Reference materials** (images, color palettes, external links)
  imported only when they survive their own scrutiny — see "What does
  NOT live here" below.

## What does NOT live here

- Implementation details (those live in `apps/builder/src/` or
  `workspace/packages/ui/src/`).
- Storybook config, Ladle, or any component-gallery tooling — not
  pulled yet.
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
├── README.md                       (this file)
└── <domain>/                       (e.g. data-management/)
    ├── <concept>.md                (canonical intent — always)
    └── <concept>.preview.html      (Tailwind brainstorming aid — optional)
```

- **Group by domain/feature**, mirroring how features will be
  organised under `apps/builder/src/features/<domain>/`.
- **First puller wins**: a cross-cutting concept (like the workspace
  shell) lives under the domain folder that pulled it into
  existence. When a second domain consumes the same concept,
  promote it via a future round to a cross-cutting location
  (lean: `_platform/`, name decided at promotion time) and leave a
  one-line redirect stub at the original path.

## File-format conventions

### Canonical: `<concept>.md`

Always present. Markdown is the contract. Contains:

- **Status header**: concept name, round that introduced it,
  status (draft / accepted / superseded).
- **Reference materials**: links to drifted artifacts, external
  inspiration, or sibling design docs. Marked clearly as
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

### Optional: `<concept>.preview.html`

Present only when the concept introduces a _new_ visual pattern that
the markdown cannot adequately convey. Once the pattern is
established, later concepts that reuse it stay markdown-only.

Format requirements:

- **Self-contained**: a single `.html` file, opens directly in a
  browser without any build step or local server.
- **Tailwind Play CDN** for utility classes:
  `<script src="https://cdn.tailwindcss.com"></script>`. (Tailwind's
  own docs endorse this for prototyping; not for production.)
- **Token parity with `@mdd/ui`**: copy the CSS custom properties
  derived from
  [themeTokens.ts](../../workspace/packages/ui/src/themeTokens.ts)
  into a `<style>` block, with a comment pointing at the
  authoritative source. The preview will drift; that is acceptable;
  the source of truth is the React app.
- **Click-through**: vanilla `<script>` with `addEventListener`
  and `classList.toggle`. No frameworks, no jQuery.
- **Header comment** that names the round and the lifecycle:

  ```html
  <!--
    HIxAI brainstorming aid for Round_NN — <concept>.
    Visual reference only. ~90% fidelity to the intended UI.
    Production truth is the running builder, not this file.
    May be removed in a later round once the pattern is established.
  -->
  ```

- **Honest framing in-page**: a small banner near the top of the
  rendered page stating "Brainstorming preview — not production."

### Honest caveats

- **Tailwind Play CDN needs internet** — each open fetches the CDN.
  Acceptable for now; revisit if friction appears.
- **Preview will diverge from production.** Tailwind utility-divs do
  not equal AntD `<Layout.Sider>` components. The token layer
  (colors, spacing, type) bridges the two. Component-level structure
  will not match perfectly. Treat the preview as a visual prompt for
  feedback, not a pixel contract.
- **Two files per concept = two-way drift risk.** The markdown is
  canonical for intent; the preview is canonical for visual feel.
  If they disagree, fix the markdown to match the visual or vice
  versa, then say which is authoritative for the disputed point.

## Lifecycle: when previews come and go

- **Created** in the round that introduces a new visual pattern.
  Lives through that round's Plan / Do / Check / Act and the
  immediate next round (so the visual decision stays
  reconstructible).
- **Retained or removed** by an explicit per-round decision in a
  later round's Plan. There is no automatic sweep — trust the round
  artifact to call it.
- **Markdown specs are durable.** They survive concept evolution;
  amend in place when the concept matures, or supersede with a
  redirect stub when it splits or moves.

## Token authority

There is **one** source of design tokens for the product:
[workspace/packages/ui/src/themeTokens.ts](../../workspace/packages/ui/src/themeTokens.ts).

Everything in this directory **cites** that source; nothing here
shadows or overrides it. When a round changes tokens, the design
docs are updated as part of that round (or the round is rejected
during review). Token drift between this directory and the
authoritative source is a bug, not a style.

External token references (e.g., the drifted iteration's
`Styles.css`) are read-only reference material. They live outside
this directory (under `tmp/ref-apps/...`) and are cited by link.
Adopting any value from them is a decision in a round, not an
implicit copy.

## Adding a new design artifact

1. Decide the domain (matches `apps/builder/src/features/<domain>/`).
2. Create `.agents/design/<domain>/<concept>.md` from the format above.
3. Decide whether a `.preview.html` is needed (new visual pattern?
   yes; reuses established pattern? no).
4. Reference the design artifact from the round that authored it
   (`Round_NN.md` → Plan section cites the design doc).
5. Implement against the design; reconcile any divergence by
   amending the design doc in the same round.

## When to add structure (deferred decisions)

Per the [Evolution Rule](../AGENTS.md), structure is added when a
real pull arrives — not in anticipation. The following expansions
are foreseeable but not yet justified; this section names the
trigger so the next round knows when to act.

### Shared CSS extraction → `.agents/design/_css/`

**Trigger**: when a **second** `.preview.html` is created, extract
the shared token block and any common utility classes
(`.mdd-sidebar`, `.mdd-nav-item`, etc.) into `.agents/design/_css/`
in the same round. Do not let triplication happen.

**Shape when extracted**:

```text
.agents/design/_css/
├── tokens.css           (CSS variables mirroring themeTokens.ts + AntD seeds)
└── preview-shell.css    (shared utility classes used across previews)
```

- Leading underscore (`_css/`) signals "cross-cutting, not a domain"
  — same convention as `_platform/` for promoted cross-cutting
  concepts.
- Previews link via `<link rel="stylesheet" href="../_css/tokens.css">`.
  This still works directly from `file://` — no build, no server.
- **Token authority is unchanged**: `_css/tokens.css` mirrors
  [themeTokens.ts](../../workspace/packages/ui/src/themeTokens.ts);
  it is not a second source. If the two diverge, themeTokens.ts wins
  and `_css/tokens.css` is updated to match in the same round.
- **Lifecycle**: when the last `.preview.html` using a shared CSS
  file is removed, the CSS file goes with it.

While only one preview exists, **keep the CSS inline** in the
preview's `<style>` block — N=1 has nothing to deduplicate against.

### Cross-linked previews ("feel the app before it exists")

**Trigger**: arrives with the **second** `.preview.html` — naturally
coupled to the CSS extraction above (both fire at N=2).

**Pattern**: each preview's sidebar items use plain `<a href>` to
the other previews' files, so clicking navigates the browser to
that concept. Full-page navigation between standalone HTML files;
no SPA, no JS routing, no content-fragment plumbing — works
directly from `file://`. The HIxAI feedback loop becomes
interactive: not just "do you like this layout" but "does the
whole flow work before any of it exists."

**Coordination cost**: every preview's sidebar must list the
current set of nav items. At N=2-3, copy-paste between preview
files is acceptable, discipline-managed. At **N=4+**, extract the
nav structure to a JSON manifest in `_css/` (or alongside it) and
inject it via ~20 lines of vanilla JS — still no build, still no
framework.

### Discovery / index page → `.agents/design/index.html`

**Trigger**: when **three or more** `.preview.html` files exist and
the README's prose listing becomes awkward to scan. Add a manually
maintained `.agents/design/index.html` then; do not build generation
tooling.

### Component-gallery tooling (Storybook / Ladle)

**Trigger**: when `@mdd/ui` reaches **three or more** primitives and
a real need to view them in isolation surfaces. The round that hits
the trigger picks the tool from then-current constraints — lean
Ladle as a default, not a commitment.
