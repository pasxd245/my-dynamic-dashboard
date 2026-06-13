# Round 10: Target-shape methodology — mine drifted AppShell into a pull-list

**Status**: Complete
**Date started**: 2026-05-23
**Date completed**: 2026-05-23

## Goal

**Inherits from ← [Round_09](Round_09.md)** — `<WorkspaceShell>` with
collapse state machine ships in `@mdd/ui`; three consecutive design-first
rounds (R07/R08/R09) have validated the methodology; `pnpm dev:builder`
gives single-command UI verification. R09's own follow-ups note that
R10 is the natural promotion trigger for the build-first lesson once a
second consumer or third structural primitive arrives.

Before R11+ ships either of those, this round closes **three
methodology gaps** surfaced by the 2026-05-23 brainstorming
conversation — gaps that single-decision rounds will compound if left
unaddressed:

1. **No target-shape doc.** [workspace-shell.md](../../design/_platform/workspace-shell.md)
   describes the current state, not the destination. Three rounds
   walked toward an undeclared horizon. The drifted iteration shows
   the cost of this exact pattern: R33 hand-rolled a sidebar that R35
   retired — two rounds wasted because no system-level target was
   visible.
2. **No layer / reuse / purity declaration in design MDs.** The UI/BIZ
   boundary rule lives in
   [memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md);
   each concept doc should re-state how _it specifically_ honors that
   boundary, so a reader of one design doc can tell which surface
   belongs in `@mdd/ui` vs `apps/builder/src/features/<domain>/`
   without leaving the doc.
3. **Drifted system wisdom isn't queued for adoption.** The drifted
   `design-guidelines.md`
   is a post-mortem distillation that earned its decomposition over
   ~35 rounds (`AppShell`, `PageHeader`, `PageCard`, `WorkflowShell`,
   `routeMeta`, sizing tiers, "rule of one shell", CSS layer
   order). Without a curated pull-list, future rounds will either
   cherry-pick ad-hoc or re-discover lessons that are already paid
   for. Dialectical negation done right: **preserve the principles,
   negate the timing.**

The deliverable is **methodology infrastructure**, not a feature
surface. R11+ pulls from this round's outputs to ship features with
a known destination.

_Track: 2 (agent-method — design discipline + drift protection).
Pulled by: conversation 2026-05-23 (brainstorming on Brownian motion
risk, dialectical negation of drifted AppShell); R09 Act-section's
"AntD wrapper testing pattern" / "shell as next promotion trigger"
notes; cumulative evidence from R07/R08/R09's per-round design-MD
limitations. Per [Evolution Rule](../../AGENTS.md)._

## What is IN scope

**Five** artifacts plus a citation sweep, one cohesive outcome
("equip future rounds with a target horizon + per-concept boundary
declaration + structural drifted-citation governance"). They are
bundled because splitting them would itself reproduce the
Brownian-motion failure mode — each artifact is meaningless without
the others. The 5th artifact (drifted-iteration hub) was added
mid-round after HIxAI review flagged that the citation-rot risk
needed a structural answer, not just a preamble.

- **Distillation memo** at
  [.agents/memory/2026-05-23-drifted-shell-distillation.md](../../memory/2026-05-23-drifted-shell-distillation.md):
  - One-page pull-list (≤ 20 bullets) mining the drifted
    `design-guidelines.md` and `AppShell.tsx` for principles.
  - Each bullet has a verdict: **ADOPT-NOW** (this round bakes it
    into the template), **ADOPT-VIA-ROUND** (named future round
    will pull it as a single feature), **DEFER** (no concrete pull
    yet; named trigger for re-evaluation), or **REJECT** (anti-pattern,
    with one-line reason).
  - Lean toward ADOPT-VIA-ROUND for system primitives (PageHeader,
    PageCard, routeMeta, sizing tiers) — those each become a future
    round, not a sub-bullet here.
  - Cites the source line/section in drifted file for each entry.
  - **Not a contract** — a backlog. Updatable when a round actually
    pulls from it. Stored in `.agents/memory/` (not in
    `.agents/design/_register/`) because it's a _lesson register_,
    not a design source.
- **Target-shape doc** at
  [.agents/design/data-management/workspace-shell.target.md](../../design/_platform/workspace-shell.target.md):
  - Sketches the destination AppShell system at the level the
    drifted iteration eventually landed on (post-R35), stripped of
    BIZ leaks.
  - Names the future primitives the shell will compose with
    (`PageHeader`, `PageCard`, `WorkflowShell`) and how they
    decompose responsibility (chrome / route-meta / route-wrapper /
    specialized-route).
  - Plots R11–R14 as **named pulls** from the target — each pull
    is a single concept, not a single decision. Order is suggestive,
    not binding; future rounds reorder as real product pulls arrive.
  - ASCII intent for the full target layout (top bar + breadcrumb
    region + content card + right rail slot if any), explicitly
    marked as **target-not-current** so it doesn't get mistaken for
    the canonical state.
  - Closes with a "when to retire this doc" lifecycle clause: when
    the last named pull lands and the target matches reality,
    fold relevant material back into `workspace-shell.md` and
    delete the target.
- **`.agents/design/README.md` amendment**:
  - Add a **mandatory header table** to the "Canonical: `<concept>.md`"
    template section. Columns: Surface · Layer · Reusability ·
    Purity · Allowed peer deps. Each design doc declares its
    surfaces upfront.
  - Add a new template section: **"Target horizon (when applicable)"**
    — concepts that span multiple rounds may pair the canonical doc
    with a `<concept>.target.md` sibling. Document the sibling's
    lifecycle (created when ≥3 rounds will iterate on the concept;
    retired when target matches reality).
  - One short paragraph under "Lifecycle" noting that target docs
    are _strictly_ for the destination, never amended to track
    current state — the canonical `<concept>.md` is amended in
    place as rounds land, and the target stays fixed (or is
    superseded with a redirect stub) so future-self can see the
    original horizon.
- **`workspace-shell.md` backfill**:
  - Add the layer/reuse/purity header table at the top of
    [workspace-shell.md](../../design/_platform/workspace-shell.md)
    (just after the Status header, before Reference materials).
  - Three rows to start: `WorkspaceShell` (`@mdd/ui`, shared
    cross-domain, plain-UI, peer deps `react`+`antd`+`@ant-design/icons`),
    `NAV_ITEMS` constant (`apps/builder/src/`, builder-only, data
    constant, none), `AppLayout` (`apps/builder/src/`, builder-only,
    glue/router-aware, `react-router-dom`).
  - This row is the **template instance** — proves the schema works
    on the only existing concept doc before R11's design doc adopts
    it.
- **Drifted-iteration hub** at
  [.agents/context/drifted-iteration.md](../../context/drifted-iteration.md)
  (5th artifact, added mid-round):
  - The canonical "what is the drifted iteration, how do we use it,
    when does it go away" hub. Every memory or design doc that mines
    lessons from drifted routes through this file rather than
    redocumenting the context.
  - Indexes the four extracted-lesson memos (build-first,
    python-tooling, roadmap-deferrals, shell-distillation) in a
    single table.
  - Establishes **citation discipline**: new docs route through the
    drifted-iteration hub first; raw local reference paths are
    reserved for evidence-only memory notes and never markdown links.
    Pre-R10 files were already mostly in inline-code form; R10's own
    outputs were swept (see next bullet) to match.
  - Documents the **retirement procedure** — when the last
    ADOPT-VIA-ROUND pull lands, a small dedicated round runs the
    procedure. No bundling with feature rounds.
  - **Promoted to `context/` in-round** with explicit human
    authorization (mid-round override of the default `context/`
    agent-write block per [governance.md](../../context/governance.md)).
    Final path: [.agents/context/drifted-iteration.md](../../context/drifted-iteration.md).
    Drafted first in `.agents/memory/` per default discipline, then
    moved to `.agents/context/` after explicit approval — date
    prefix dropped, memory-template trailer stripped, status moved
    from "New (candidate)" to canonical context-file form.
- **Citation rot sweep** (mechanical):
  - Convert direct links to the ignored drifted reference in R10's
    own outputs (distillation memo: 28 links; Round_10.md: 5 links)
    to hub links or inline evidence. Two-pass `sed` kept the
    human-readable label and dropped fragile URL targets.
  - Verify pre-R10 files (`AGENTS.md`, `context/purpose.md`, the
    four pre-existing drifted memos, `design/README.md`,
    `workspace-shell.md`) already use inline code spans — no
    changes needed.
  - Conformance check: no markdown links to the ignored drifted
    reference under `.agents/` (the only allowed exception is the
    intentional `❌ Bad` example inside the hub file itself).

## What is OUT of scope (explicit deferrals)

- **Building any of the named future primitives** (`PageHeader`,
  `PageCard`, `WorkflowShell`, `routeMeta` resolver, sizing tiers).
  Each is its own future round. This round only **queues** them.
- **Promoting the build-first lesson to `.agents/context/`.** R09 Act
  noted R10 as the natural trigger if shell consumption widened. This
  round doesn't widen consumption — it lays methodology. Hold the
  promotion for the round that actually adds the second shell
  consumer (R12+ depending on how the pull-list lands).
- **Updating any other design doc** beyond `workspace-shell.md`
  backfill. There is only one other design doc (the README itself),
  which is amended above. No drift across siblings to worry about.
- **`.agents/design/_register/` directory creation.** The
  brainstorming raised it as a third option ("full distillation
  register"). Rejected: heavier than needed at N=1 concept, and
  `.agents/memory/` is the natural home for a lesson register.
  If a second distillation memo arrives, revisit then.
- **Storybook / Ladle / component-gallery tooling.** Still deferred
  until `@mdd/ui` has 3+ primitives (per README's "When to add
  structure"). The target doc names the future primitives but does
  not pull tooling in.
- **Brand refresh, top app-bar, right rail, collapse persistence**
  — all still deferred from R07–R09. They appear in the distillation
  memo as ADOPT-VIA-ROUND with named triggers.
- **Code changes to `<WorkspaceShell>` or any `@mdd/ui` primitive.**
  This round is documentation-only. No new tests; no new component
  files. The existing 12 + 3 test suite continues to pass unchanged
  as a byproduct of touching nothing.
- **Retirement of the local drifted reference.** The hub file
documents the retirement procedure but does not run it. Retirement
is its own future round triggered when the last ADOPT-VIA-ROUND pull
lands. R10 only sweeps existing citation rot; the drifted reference
itself stays in place to serve R11+.
<!-- Was: "Promoting the drifted-iteration hub to .agents/context/ is
deferred to human review" — that deferral was removed mid-round when
the user explicitly authorized the direct write. The hub now lives at
.agents/context/drifted-iteration.md. -->
- _(no remaining hub-related deferrals)_

## Plan

- [x] Author
      [.agents/memory/2026-05-23-drifted-shell-distillation.md](../../memory/2026-05-23-drifted-shell-distillation.md):
      read drifted
      `design-guidelines.md`
      §§ 1–8 and
      `AppShell.tsx`;
      produce ≤ 20 verdict-tagged bullets. Cite source line/section
      for each. Memory frontmatter per
      [memory protocol](../../AGENTS.md) — type / date / confidence /
      status fields.
- [x] Author
      [.agents/design/data-management/workspace-shell.target.md](../../design/_platform/workspace-shell.target.md):
      ASCII target layout, named-future-primitive list, R11–R14
      named-pull sketch, lifecycle clause. Mark every surface
      "target-not-current" in a banner near the top so it can't be
      mistaken for canonical state.
- [x] Amend
      [.agents/design/README.md](../../design/README.md): add
      mandatory header table to "Canonical: `<concept>.md`"
      template; add "Target horizon (when applicable)" template
      section; add target-doc lifecycle paragraph under "Lifecycle:
      when previews come and go".
- [x] Backfill the header table into
      [.agents/design/data-management/workspace-shell.md](../../design/_platform/workspace-shell.md)
      as the template's first instance. Four rows: `WorkspaceShell`,
      `NAV_ITEMS`, `AppLayout`, `DataManagementPage` (the fourth
      surfaced during writing — the placeholder route component is
      a real surface even if minimal).
- [x] **Author the drifted-iteration hub** at
      [.agents/context/drifted-iteration.md](../../context/drifted-iteration.md)
      (5th artifact, added mid-round after HIxAI review). Indexes the
      four extracted-lesson memos, establishes inline-code-span
      citation discipline, documents the retirement procedure. Marked
      as strong promotion candidate to `context/`.
- [x] **Sweep R10's own markdown links** to the ignored drifted
      reference (33 total: 28 in distillation memo, 5 in
      Round_10.md). Direct references now route through the hub or
      stay as inline evidence only. Pre-R10 files verified already in
      inline-code-span form — no rework needed. Conformance check
      returns one allowed exception (the `❌ Bad` example in the hub
      file itself).
- [x] `pnpm md:lint` clean across all five files (use `-` bullets;
      avoid `+` start-of-line; one-long-line bullets where Prettier
      disagrees with markdownlint — same patterns as R07/R08/R09).
- [x] `pnpm format:check` clean for new + amended files.
- [x] Verify no code paths touched: `git status` shows only `.md`
      changes under `.agents/`; `pnpm --filter @mdd/ui test` and
      `pnpm --filter builder test` continue to pass unchanged (smoke
      check, not a re-validation).
- [x] Cross-link: `Inherits from ← Round_09` in Goal (already
      present above); `Feeds into → Round_11` in Act section, naming
      R11's first pull from the distillation memo as the candidate.
- [x] Post-round audit per [PDCA.md](../PDCA.md): flip Plan
      checkboxes, fill Check items, format Promotions as plain text
      (decision: none this round), run markdownlint clean.

## Risks / unknowns

- **Bundling four artifacts into one round risks violating
  single-feature discipline.** Counter: the four artifacts together
  _are_ one feature ("methodology infrastructure for the next batch
  of rounds"). Splitting would reproduce the exact failure mode this
  round is designed to prevent — each fragment is meaningless
  without the others (a target doc without a pull-list, a header
  table without an instance, a pull-list without a horizon to
  contextualise it). If during Do this judgment turns out wrong,
  the recovery is to land 1–3 of the four and defer the rest to R11
  rather than to retroactively split the round.
- **Distillation memo could become bloated.** The brainstorming
  rejected the 350-line "full distillation register" for exactly
  this reason. Hard cap: ≤ 20 bullets. If the drifted material
  doesn't compress to that, the memo is wrong — re-cut at higher
  abstraction (principles, not individual prop names).
- **Target doc could drift from canonical doc over time.** Honest
  caveat in the README amendment: the target is a snapshot of the
  destination _at the moment R10 wrote it_. If product pulls change
  the destination (e.g., a workflow domain demands a different
  shell), the target doc is _superseded_, not amended — same
  discipline as "Markdown specs are durable" in the existing README.
  Document this lifecycle explicitly so no future round silently
  rewrites the target.
- **Header table schema may not survive contact with the second
  concept doc.** The schema (Surface · Layer · Reusability · Purity ·
  Allowed peer deps) is informed by one drifted reference plus the
  build-first memory. R11's design doc will be the first real test.
  Plan an explicit revisit: if R11 amends the schema (adds a column,
  drops one), R11's Act section captures the lesson and amends the
  README in the same round. Don't pre-commit to a schema we haven't
  stress-tested.
- **Risk of methodology-round inertia.** A round that doesn't ship
  user-visible value can feel like overhead. Mitigation: R11 must
  pull from this round's output _and_ ship a user-visible primitive,
  so the methodology infrastructure has its first consumer
  immediately. The named-pull sketch in `workspace-shell.target.md`
  is the prerequisite for that immediacy.
- **Markdownlint `+` / Prettier round-artifact carry-over.** Same
  flap patterns as R07–R09. Use `-` bullets; avoid `+` at start of
  continuation lines; use unified single-long-line bullets where
  the formatters disagree. Per
  [memory/2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md).
- **Governance: `.agents/design/<concept>.target.md` is a new
  artifact type.** Per
  [Evolution Rule](../../AGENTS.md), citation required. Provided in
  the Goal section's `Track / Pulled by` note. Re-confirm during
  Check.
- **HIxAI feedback may rebalance scope.** The brainstorming already
  resolved the major architecture question (option B: short
  pull-list, not full distillation register). If review surfaces a
  concrete pivot (e.g., "drop the target doc, just amend
  workspace-shell.md in place"), pivot rather than ship under
  protest. Single-round discipline > strict adherence to a plan
  that no longer fits.
- **Citation rot when the ignored drifted reference is removed.**
  Originally a deferred risk; addressed **structurally** mid-round
  after HIxAI review. Three changes: (a) the 5th artifact
  (drifted-iteration hub) establishes hub-first citation discipline;
  (b) R10's own outputs were swept so direct references route
  through the hub or inline evidence; (c) pre-R10 files already used
  inline code spans, so they need no rework. When drifted is
  eventually removed, surviving inline code spans become stale path
  strings — readable evidence, not broken navigation. The retirement
  procedure itself is documented in the hub file and runs as its own
  dedicated round.

## Do

- **Distillation memo authored** at
  [.agents/memory/2026-05-23-drifted-shell-distillation.md](../../memory/2026-05-23-drifted-shell-distillation.md).
  Source material wider than expected: not only
  `design-guidelines.md`
  but also the drifted
  `packages/ui/src/Components/MasterLayout/index.tsx`
  (`MasterLayout` — the actual primitive name the user referenced
  in brainstorming) plus the BIZ-leak evidence in the drifted
  `packages/ui/src/` tree (`Contexts/`, `Pages/`, `Providers/`).
  Final memo: **20 verdict-tagged entries** (A–T) under the cap.
  Three ADOPT-NOW (baked into this round's outputs), eight
  ADOPT-VIA-ROUND (named future-round candidates), five DEFER (no
  current pull, named triggers), four REJECT (the BIZ leaks +
  runtime collision warnings).
- **Target-shape doc authored** at
  [.agents/design/data-management/workspace-shell.target.md](../../design/_platform/workspace-shell.target.md).
  Includes TARGET-NOT-CURRENT banner near the top, surface table
  with 7 rows (3 existing + 4 future/deferred), full-system ASCII
  layout, target prop signatures for `WorkspaceShell`, `PageCard`,
  `PageHeader`, named-pulls table sketching R11–R14, and the
  lifecycle clause.
- **README amendment landed** at
  [.agents/design/README.md](../../design/README.md). Three changes:
  (a) added mandatory **Surface declaration** bullet to the
  Canonical-doc template with Layer / Reusability / Purity /
  Allowed peer deps definitions; (b) added a new **Optional:
  `<concept>.target.md`** subsection mirroring the preview
  subsection's shape (when to author, format requirements, first
  instance link); (c) restructured the Lifecycle section into three
  named sub-sections (Previews / Target docs / Canonical specs) so
  each artifact type's lifecycle is independently readable; (d)
  added two new steps to the "Adding a new design artifact"
  numbered list (fill the Surface declaration; decide whether a
  target doc is needed).
- **Backfill into `workspace-shell.md`**: added the Surface
  declaration table between Status header and Reference materials,
  per spec. **Deviation from Plan**: ended up with **4 rows, not 3**
  — `DataManagementPage` placeholder is a real surface even if
  minimal, and omitting it would have hidden a feature-purity row
  that the schema needs to demonstrate. Schema survived contact
  with the only existing concept doc, but R11 is still the real
  stress test.
- **Lint flap pattern revisited** (R07/R08/R09 carry-over). Three
  separate friction points hit:
  - **Markdownlint MD004 `+` continuation**: four bullets in the
    distillation memo wrapped such that a line started with two
    spaces of indent followed by `+ [link](...)`, which markdownlint
    parsed as a `+`-bulleted sub-item and then flagged every parent
    `-` as inconsistent. Fixed by replacing the four `+` joiners
    with `and` per
    [memory/2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md).
    Also hit one instance in Round_10.md itself
    ("(`AppShell` + `PageHeader` + ...)" prose wrapping) — same
    fix.
  - **MD049 emphasis-style flip-flop**: I initially wrote some
    italics as `*text*` (single asterisk) and others as `_text_`
    (single underscore) within the same file. Markdownlint takes
    the first style as canonical and flags all the others. Then
    Prettier auto-formatted everything to `_text_` (its preference),
    which silenced markdownlint by side effect. Lesson: pick one
    italic style per file from the first instance, or rely on
    Prettier to normalise — but don't fight both tools.
  - **Prettier round-artifact warnings**: 3 carry-over warnings in
    R02 / R04 / promotions.md remain (governance blocks editing
    Complete rounds without explicit authorisation). Same state as
    R07/R08/R09 closes — not a regression.
- **No code touched.** `git status` shows only `.md` changes under
  `.agents/`. `pnpm --filter @mdd/ui test` → 12 tests pass;
  `pnpm --filter builder test` → 3 tests pass; both unchanged from R09.
- **Bundling judgment vindicated.** All five artifacts shipped
  together; each references the others (target doc cites
  distillation, distillation indexed by hub, workspace-shell.md
  cites target, README documents the template instance, R10
  narrates all of them). Splitting would have produced nominally-
  independent artifacts that each leave the others under-defined
  for the duration of the split. The risks-section "if judgment
  turns out wrong" fallback wasn't needed.
- **5th artifact (drifted-iteration hub) added mid-round.** HIxAI
  review surfaced the citation-rot risk after the first four
  artifacts shipped — initially addressed by a preamble in the
  distillation memo plus a deferred sweep round in the follow-ups.
  User pushback ("any other ways? R11??") made it clear that a
  structural answer was warranted. Pivoted to: (a) a hub file in
  `memory/` (governance-respecting; agents can't write to
  `context/`) establishing inline-code-span-only discipline; (b)
  immediate sweep of R10's own 33 markdown links inside the same
  round, since drifted is still locally available for verification;
  (c) the retirement procedure documented in the hub, run as its
  own future round when triggered. Lesson: mid-round pivots are
  acceptable when the original plan's mitigation was acknowledgment
  rather than structure.
- **Sweep mechanics**: two `sed` passes — first for labels already
  in backticks (`` [`X`](url) → `X` ``), then for plain-text labels
  (`[X](url)` → backticked code span). Idempotent. Conformance
  check via grep returned exactly one match (the intentional `❌ Bad`
  example inside the hub file), which is the expected exception.
  Total runtime: ~5 seconds; total reviewed diff: 33 line-level
  changes across 2 files.
- **Human review-pass enrichment** (post-agent-execution, before the
  human flip to Complete). User extended R10's scope further while
  reviewing the agent-shipped artifacts. Five additional improvements
  landed:
  1. **Token-authority contradiction closed** in
     [design/README.md](../../design/README.md) — the "External token
     references... cited by link" paragraph was rewritten to "cite
     the hub or an extracted memory instead of linking to local-only
     ignored paths." The agent's R10 amendment had left a
     self-contradicting sentence; review caught it.
  2. **Hub elevated to AGENTS.md governance**
     ([.agents/AGENTS.md](../../AGENTS.md) "Preserve what works"
     bullet) — every future agent reading the constitution is now
     routed to the hub. The inline `tmp/ref-apps/` reference was
     removed; replaced with "Route any lesson from the prior drifted
     iteration through `context/drifted-iteration.md`."
  3. **Pre-R10 files upgraded beyond R10's conformance bar.** R10's
     own plan said pre-R10 files were already mostly inline code
     spans and needed no rework. User went further: replaced passive
     `tmp/ref-apps/` path strings in
     [memory/2026-05-22-ui-boundary-build-first.md](../../memory/2026-05-22-ui-boundary-build-first.md),
     [memory/2026-05-22-round-roadmap-deferrals.md](../../memory/2026-05-22-round-roadmap-deferrals.md),
     [memory/2026-05-22-python-tooling-uv.md](../../memory/2026-05-22-python-tooling-uv.md),
     and [context/purpose.md](../../context/purpose.md) with hub-routed
     prose that **inlines the load-bearing evidence directly** (e.g.,
     "had `react-router-dom`, `@tanstack/react-query`, `zod` as peers
     — the BIZ leak"). When drifted is eventually retired, the
     evidence survives as readable prose, not as stale path strings.
  4. **Workspace-shell.md reference table collapsed.** Three rows
     pointing at drifted source files (`Sample.png`, `Styles.css`,
     `WorkflowShell.tsx`) replaced with one row pointing at the
     [shell distillation memo](../../memory/2026-05-23-drifted-shell-distillation.md)
     plus a hub row at the top as the meta-pointer. Cleaner
     abstraction; routes through the extracted lessons rather than
     direct sources.
  5. **Promotion recorded in
     [plan/promotions.md](../promotions.md).** Audit trail closed —
     the agent should have done this when the hub moved to `context/`;
     user caught the omission.
- **Net effect of the review-pass enrichment**: `tmp/ref-apps/`
  references across `.agents/` dropped from **49 across 9 files**
  (pre-R10) to **9 in 1 file** (the hub itself, where they're
  legitimately load-bearing). The drifted-retirement follow-up R10
  had originally deferred is now substantially complete — only the
  directory removal itself remains, to run when triggered.
- **Auto-memory audit (review-pass).** User asked the agent to also
  audit the local-only auto-memory at
  `~/.claude/projects/<repo-slug>/memory/` (governance contract in
  [context/memory-placement.md](../../context/memory-placement.md))
  for the same local-only risk that `tmp/ref-apps/` carries. Result:
  6 entries audited; 5 are correctly placed per the existing user
  rule (auto-memory is for Claude-Code-tool quirks and user-personal
  habits — appropriate for the per-Claude-install location). The
  6th entry was project-knowledge for a _different repo_ (self-evo
  agent infrastructure, not my-dynamic-dashboard); migrating it to
  _this_ repo's `.agents/memory/` would be incorrect. No action
  taken this round. The existing rule held — no migration needed.
  Local-only paths in this Act-section narrative were abstracted to
  the `<repo-slug>` form so this round file doesn't itself carry
  the rot risk it just audited.
- **Memory-placement extraction rule clarified** (same review pass).
  User flagged that
  [context/memory-placement.md](../../context/memory-placement.md)
  defined the two memory locations but didn't actively state the
  rule "if an auto-memory entry becomes project-load-bearing, it
  MUST be extracted to `.agents/memory/`." Old text covered it
  passively across sections; new "Extraction rule" section makes it
  active with explicit triggers + procedure + worked examples. A
  future self-evo improvement (automation of detection + assist for
  rewrite) is deferred with a named trigger ("≥ 3 rounds of
  recurring misplacement friction"). Until that trigger fires,
  manual discipline is the intervention.
- **Context-rot compaction** (same review pass). User asked
  honestly whether `.agents/context/` files were getting bloated.
  Audit: agent's R10-added [drifted-iteration.md](../../context/drifted-iteration.md)
  was 1544 words (42% of all context/) — the largest file by far.
  Patterns hit: repeated framing across sections, two structurally
  similar 6-step procedures, bullets where prose would do, Do/Don't
  section restating the body. Compacted to ~750 words (~50% reduction)
  without substance loss — combined "What/Lifecycle/Governance" into
  one section, dropped the Do/Don't (already in the body), reduced
  procedures from 6 steps to 4. The Extraction rule section in
  [memory-placement.md](../../context/memory-placement.md) was
  similarly trimmed (5-step procedure → terse prose; 3 criteria → 1
  sentence). Added a **post-round audit step** in
  [PDCA.md](../PDCA.md) so future rounds that touch `context/` run
  a re-read-and-cut pass before flipping to Complete — prevents
  re-accumulation of the bloat caught here.

## Check

- [x] Distillation memo exists at
      `.agents/memory/2026-05-23-drifted-shell-distillation.md`,
      contains ≤ 20 verdict-tagged bullets, each with a drifted
      source citation.
- [x] Target-shape doc exists at
      `.agents/design/data-management/workspace-shell.target.md`,
      contains ASCII target layout + named-future-primitive list +
      R11–R14 pull sketch + lifecycle clause + "target-not-current"
      banner.
- [x] `.agents/design/README.md` has the mandatory header table
      added to the canonical-doc template, a new "Target horizon"
      template section, and a lifecycle paragraph for target docs.
- [x] `workspace-shell.md` has the header table backfilled (4 rows,
      one more than planned — see Do) at the top of the doc, just
      after Status, before Reference materials.
- [x] `pnpm md:lint` clean; `pnpm format:check` clean for R10
      files (3 carry-over warnings on R02 / R04 / promotions.md remain
      from R07/R08/R09 — governance-blocked, not a regression).
- [x] `git status` shows only `.md` changes under `.agents/`;
      `@mdd/ui` and builder test suites unchanged in count + pass
      (12 + 3 tests, same as R09).
- [x] Cross-links: `Inherits from ← Round_09` in Goal (above);
      `Feeds into → Round_11` in Act, naming the first pull from
      the distillation memo as R11's candidate.
- [x] **5th artifact** (drifted-iteration hub) exists at
      `.agents/context/drifted-iteration.md`; indexes the
      four extracted-lesson memos; establishes inline-code-span
      citation discipline; documents the retirement procedure; marked
      Promotion Candidate `[x] context/`.
- [x] **Citation rot sweep** complete. Conformance grep returns
      exactly one match — the `❌ Bad` example inside the hub file
      itself, which is the intentional exception.

## Act

**Status**: Complete (human-approved 2026-05-23 in the same review
pass that authored the 7 review-pass enrichments and the context-rot
compaction).

**Learnings**:

- **Dialectical negation, structured.** The brainstorming framing
  ("preserve the principles, negate the timing") translated cleanly
  into the four verdict tags (ADOPT-NOW / ADOPT-VIA-ROUND / DEFER /
  REJECT). The hard part wasn't producing verdicts — it was
  resisting the urge to write a verdict for every detail. Capping
  at 20 forced abstraction; the cap was the quality gate. Without
  it the memo would have grown to mirror the drifted
  `design-guidelines.md` line by line, reproducing the failure mode
  the brainstorming explicitly rejected.
- **The drifted `MasterLayout` is the real reference, not
  `AppShell.tsx`.** R09 follow-ups and the R10 Plan both used
  "AppShell" as shorthand because the drifted `design-guidelines.md`
  did. But the actual primitive in `packages/ui/` is named
  `MasterLayout` — and that name is the one the user used in the
  brainstorming session ("the 'master-layout' (sidebar, menu,
  sub-menu...)"). The terminology drift is harmless this round but
  worth noting: the **drifted code** is `MasterLayout`; the
  **drifted guideline** documents it as the `AppShell` system.
  Future references can use either, but the code is the
  source-of-truth name.
- **Surface declaration surfaces what the design doc was hiding.**
  Writing the four rows for `workspace-shell.md` forced explicit
  declarations that had been implicit. `DataManagementPage` is a
  surface — feature-purity, builder-only — that the prior doc
  treated as "placeholder, ignore." Naming it as a row makes the
  feature/glue boundary visible and gives R11 a clear "this row
  changes from feature-purity placeholder to feature-purity real
  content" target. Suggests the schema is doing real work.
- **The bundled-round bet paid off.** All four artifacts reference
  the others by name. If any single artifact had been deferred,
  the references would have pointed to vapor — exactly the kind of
  fragmentation single-feature discipline is meant to prevent. The
  "single feature" interpretation in the user's auto-memory
  `feedback_round_cadence` entry (governed by
  [context/memory-placement.md](../../context/memory-placement.md))
  can absorb "cohesive methodology unit" without violating the
  spirit; the test is whether the artifacts depend on each other,
  not whether they're each a separate file.
- **Lint flap pattern is now well-characterised.** Three
  recurring frictions (MD004 `+` continuation, MD049 emphasis-style
  flip-flop, MD038 wrapped code-spans) plus the carry-over
  Prettier governance constraint. None new, all known. Worth
  considering for a future `.agents/context/` promotion: a short
  "writing markdown for this repo" guide once a 4th unique
  friction appears, per the existing
  [markdownlint-plus-prefix memo](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md)
  Promotion Candidate note.
- **Methodology-round inertia, addressed.** The Risk-section
  worry that a no-code round would feel like overhead held in
  reality — there were moments during Do where the work felt
  meta-meta. The mitigation (R11 must pull from this round's
  output and ship a primitive in the same round) is real, not
  rhetorical: the target doc's R11 candidate now has a named
  destination and the distillation memo's entry D names the exact
  drifted source to start from. R11 should be visibly easier than
  R09 was for the same scope-of-work, and that's the measurable
  test of whether this round was worth it.

**Promotions** (decision: one promotion **executed** with explicit
human authorization):

- → `context/` **EXECUTED**: the drifted-iteration hub now lives at
  [.agents/context/drifted-iteration.md](../../context/drifted-iteration.md).
  Initially drafted in `.agents/memory/2026-05-23-drifted-iteration.md`
  per the default agent-write discipline; promoted mid-round after
  explicit human authorization to override the
  [context/ governance constraint](../../context/governance.md).
  Promotion edits: date prefix dropped from filename, memory-template
  trailer stripped, Status / Date / Agent / Confidence header removed,
  Promotion Candidate footer removed, internal links to sibling
  memos rewritten from same-dir form (e.g.
  `2026-05-22-ui-boundary-build-first.md`) to `../memory/...` form,
  R10's 5 cross-references rewritten to point at the new path. The
  hub is durable canonical knowledge — it codifies stable citation
  discipline that applies across every future round mining drifted.
- → `context/` (build-first lesson): still not yet. R10 lays
  methodology infrastructure but does not widen shell consumption —
  the build-first promotion trigger remains the round that adds a
  second shell consumer (likely R11 if a Data Management feature
  lands, otherwise R12+). Holding per R09 Act's same reasoning.
- → `skills/`: none this round.

**Follow-ups (not promotions, just notes):**

- R11 candidate pulls from the distillation memo, in suggestive
  priority order (final order set by R11's Plan-phase Q&A):
  1. **First real Data Management feature** (CSV upload OR dataset
     list OR schema view) — same R09 follow-up #1. Now framed by
     the target doc's named-pull sketch; the feature picks up
     `PageCard` or its equivalent if available, otherwise pulls
     `PageCard` as a sub-feature of the same round.
  2. **`PageCard` primitive in `@mdd/ui`** — the most reused future
     primitive per drifted evidence (every route lived in one).
     One round, one primitive, one consumer (the Data Management
     placeholder becomes the first occupant).
  3. **Sizing tier lock (32/40/48)** — pure token-layer round,
     small. Updates `themeTokens.ts` + design doc.
- **Promotion trigger watch**: when R12 (or whichever round adds
the second shell consumer) lands, promote the build-first lesson
to `.agents/context/` per R09's deferred promotion criterion.
<!-- Was: "Hub promotion to context/ awaiting human review" — the
promotion happened in-round with explicit human authorization. See
the Promotions block above. -->
- **Drifted retirement (deferred round, procedure documented).**
  When the last ADOPT-VIA-ROUND pull from the shell-distillation
  memo lands (R12–R15 window), a dedicated round runs the
  retirement procedure documented in the hub's "Retirement
  procedure" section. R10 only **establishes** the procedure; it
  does not run it. The procedure is short (≤ 6 steps) and explicitly
  not bundled with feature work.

## Feeds into → Round_11 (TBD)

What R10 hands forward:

- **Distillation pull-list** — R11's design-doc Plan section cites
  one named pull from this memo as its scope, instead of
  re-discovering decisions ad-hoc.
- **Target-shape doc** — R11 implements against both the canonical
  `workspace-shell.md` (current state) and the new `.target.md`
  (destination). The named-pull sketch tells R11 where in the
  destination its work lands.
- **Layer / reuse / purity header schema** — R11's new design doc
  declares its surfaces in the header table from the first draft.
  Schema is stress-tested by the second instance; any amendment
  lands in R11's Act.
- **Methodology drift protection** — future rounds walk toward a
  declared horizon. R11 is the first round under the new regime;
  R11's Act captures whether the regime worked.
- **Drifted-iteration hub + citation discipline** — R11 (and every
  subsequent round mining drifted lessons) routes through the hub
  first; raw local evidence paths are reserved for exceptional
  forensic notes. New extracted-lesson memos add a row to the hub's
  index table. The conformance grep documents itself as the
  regression check.
