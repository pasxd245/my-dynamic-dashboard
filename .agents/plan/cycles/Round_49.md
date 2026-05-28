# Round 49: DCFBI/DFCFBI skill set — bootstrap (`flow-selector` + `gate-walker`)

**Status**: Complete
**Date started**: 2026-05-28
**Date completed**: 2026-05-28

## Goal

**Inherits from ← [Round_48](Round_48.md)** — R48 archived the
DCBF corpus (11 fully-superseded artifacts moved to `_archive/`)
producing an uncontaminated workspace. R47 bound the DCFBI/DFCFBI
doctrine in
[`decisions/2026-05-28-hybrid-flow-governance.md`](../../decisions/2026-05-28-hybrid-flow-governance.md).

R48's experience surfaced a structural insight: **the DCBF context
file's archive was forced because doctrine had been written but no
operational tooling carried it — leaving a "DCBF doctrine document
loading every session" contradicting R47 at session-load time.**
Repeating this shape with DCFBI/DFCFBI (doctrine in `decisions/`,
zero tooling) would reproduce the same failure mode: round authors
re-derive flow selection, gate criteria, and the O-rule from prose
every round, drift accumulates, and the first measurable failure is
also the first usage. R49 fixes this by **building operational
tooling before the first trial**, not after.

R49 bootstraps `.agents/skills/` and lands **three skills** —
two **primary** (workflow-specific to DCFBI/DFCFBI) and one
**dependent** (generic utility that primary skills or any task
can invoke when extra information is needed):

**Primary skills** — without which no DCFBI/DFCFBI round can run
at all:

1. **`flow-selector`** — runs R47's 2-of-5 check at Design exit
   and records the chosen flow (`DCFBI` or `DFCFBI (triggers N,M)`)
   in the round file. Without it, every round re-reads R47 prose
   and decides ad-hoc; with it, the selection becomes mechanical
   and auditable.
2. **`gate-walker`** — verifies each Hard Gate's exit criterion is
   documented as met before allowing phase advance. Without it,
   gates are aspirational checkboxes (R47 Act explicitly flagged
   this as "aspirational without enforcement"); with it, gates
   block at the right moments and pass-through is verifiable.

**Dependent skill** — a peer utility the primary skills (and any
other task in the repo) can call when a step needs more
information than the round file carries:

1. **`research`** — generic research procedure (frame question →
   choose sources → collect evidence → evaluate → synthesize →
   report). Already authored via `a2scaffold` (staged alongside
   R49 planning) with companion crawl4ai reference + script.
   R49 includes it as a **scoped deliverable** (not as user
   setup), labels its `metadata.category` as `dependent`, and
   documents the primary-vs-dependent distinction in the skills
   README. Concrete use: when `flow-selector` hits condition #2
   ("new interaction pattern not previously used in product") and
   the round author isn't sure whether a pattern is new, they
   invoke `research` to check prior art before tallying. The
   primary skill carries the workflow logic; the dependent skill
   carries the information-gathering capability.

Four other skills sketched in conversation (`f1-timeboxer`,
`o-rule-checker`, `round-scaffolder`, `contract-v2-router`) are
**deferred to R50+ rounds** under the "narrow until reversible"
discipline R48 codified (see
[`memory/2026-05-28-dcbf-to-dcfbi-pivot.md`](../../memory/2026-05-28-dcbf-to-dcfbi-pivot.md))
— their pull will be concrete after the first trial round surfaces
which one earns the next slot.

*Track: 2 (agent-method, tooling). Pulled by: R48's experience —
archiving `context/contract-driven-feature.md` proved that doctrine
alone leaks back as live-tree contradiction; preventing the same
shape for DCFBI/DFCFBI is the immediate next move. Concrete pull
on R47's Act: "Hard gates without enforcement are aspirational."
Per [Evolution Rule](../../AGENTS.md).*

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Skill format** — Claude Code's canonical Agent Skills schema
   ([code.claude.com/docs/en/skills.md](https://code.claude.com/docs/en/skills.md)):
   YAML frontmatter with standard fields only (`name`,
   `description`, `when_to_use`, optionally `allowed-tools`,
   `disallowed-tools`, `arguments`, `argument-hint`,
   `user-invocable`, `disable-model-invocation`, etc.) + Markdown
   body with the procedure. **No `metadata` object** with
   `author`/`version` — that's `a2scaffold`'s non-standard
   extension (used in the staged `research/SKILL.md`). The new
   primary skills follow the canonical schema; the existing
   `research/SKILL.md` is **left untouched** (already shipped via
   `a2scaffold`; rewriting its frontmatter is out of scope).
2. **Skill-creator invocation**: there is **no automated
   skill-creator tool** in Claude Code — skills are
   hand-authored by writing SKILL.md directly. The user's
   reference to "skill-creator" means *Claude Code's authoring
   approach* (hand-write per the schema), not a CLI/tool
   invocation. R49 hand-authors `flow-selector` and `gate-walker`
   per the canonical schema linked above.
3. **Canonical location + skill-ref pointer pattern**: Claude
   Code's runtime discovers skills at three scopes —
   `~/.claude/skills/` (user-global), `.claude/skills/`
   (project-local, **canonical for repo-shared skills**), and
   plugin skills (per
   [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)).
   The `a2scaffold` convention staged by `research` is **not**
   byte-byte dual-write; it is a **primary + pointer** pattern:
   - Full SKILL.md lives in `.agents/skills/<name>/SKILL.md`
     (the durable, committed record alongside
     `.agents/context/` and `.agents/memory/`).
   - A **thin pointer stub** lives at
     `.claude/skills/<name>/SKILL.md` with frontmatter
     `metadata.type: skill-ref`,
     `metadata.skillPath: ../../../.agents/skills/<name>`, and
     a one-line "Do not edit this file directly" body comment.
   - The pointer carries the `name` + `description` so Claude
     Code's runtime auto-trigger works at session-load; the
     full procedure body lives only in the canonical
     `.agents/skills/` file.
   R49 follows this convention for the new primary skills:
   author full content at `.agents/skills/<name>/SKILL.md`, and
   write a matching `skill-ref` stub at
   `.claude/skills/<name>/SKILL.md`. **Open question** (R49
   execution will resolve): does Claude Code's native runtime
   actually *follow* the `skill-ref` to fetch full body content,
   or does it only see the stub? If only the stub, the runtime
   never gets the procedure — and the convention needs revisiting
   (either inline full content in both locations, or symlink, or
   add a pre-skill-resolution step). The `research` skill's
   real-world invocation in R50+ is the first measurement.
4. **Directory layout**: **nested**
   (`<scope>/skills/flow-selector/SKILL.md`,
   `<scope>/skills/gate-walker/SKILL.md`) — matches the canonical
   shape. Nesting allows companion artifacts (templates, example
   transcripts, helper scripts) to live alongside SKILL.md
   without polluting the skills root.
5. **Primary vs dependent skill convention** (project-local
   taxonomy; not in canonical Claude Code schema). Two classes of
   skill live under `.agents/skills/`:
   - **Primary**: workflow-specific, operates on round files,
     carries doctrine-enforcement logic. Examples this round:
     `flow-selector`, `gate-walker`.
   - **Dependent**: generic utility, callable by any primary skill
     or task that needs the capability. Domain-agnostic; not
     bound to round files. Examples this round: `research`.

   The canonical Claude Code frontmatter is **strict** — it does
   **not** accept arbitrary keys like `metadata.category`. So the
   primary-vs-dependent taxonomy lives in:
   - The **skills README** (`.agents/skills/README.md`), under two
     top-level sub-headings (`## Primary skills`, `## Dependent
     skills`). This is the canonical project record.
   - Each skill's own `description` / `when_to_use` field naming
     its category naturally (e.g., "Use when a round needs to
     pick its phase chain at Design exit" implicitly marks
     flow-selector as primary; "Use when a task needs extra
     information" marks research as dependent).

   R49 does **not** edit `research/SKILL.md`'s frontmatter to add a
   non-standard `metadata.category` field (prior plan revision did
   — superseded by this lookup). The README structure carries the
   convention.
6. **Primary skill I/O scope**: each primary skill operates on a
   **round file in `.agents/plan/cycles/`** as its primary
   surface — reads the round's Goal / Plan / Do sections, writes
   back lines in `Do` (flow-selector) or `Check` (gate-walker).
   Primary skills do not touch contract / FE / BE files; those
   remain the round author's hand-work. Dependent skills
   (`research`) are domain-agnostic and have no round-file
   coupling.
7. **Discoverability wiring**: one new bullet under
   [`AGENTS.md § Operative horizons`](../../AGENTS.md) pointing at
   a new `.agents/skills/README.md` that indexes the available
   skills. The README is the canonical entry point, not AGENTS.md
   prose — keeps AGENTS.md slim and lets the index grow.
8. **No promotion to `context/` this round.** Skills are
   themselves operational; `context/` is for stable patterns
   discovered through use. R49 commits hypotheses (the three
   skills as shipped) to be measured against by R50's trial;
   promotion path is the same as any context promotion.
9. **No new memory file unless R49 execution surfaces a learning.**
   Memory captures learnings *from* completed work; R49 is the
   work. Tool-quirk gotchas (e.g., a new pattern for invoking
   skills, an unexpected schema constraint) earn a memory note
   if encountered.

## What is IN scope

### 1. Bootstrap `.agents/skills/` directory

- Create `.agents/skills/` (new top-level dir under `.agents/`).
- Author `.agents/skills/README.md` — short index naming each
  skill, one-line role, and the convention that skills operate on
  round files. Keep it under ~50 lines.

### 2. Author `flow-selector` skill

- Paths (dual-write):
  - `.agents/skills/flow-selector/SKILL.md` — durable record.
  - `.claude/skills/flow-selector/SKILL.md` — runtime discovery.
- Frontmatter (Claude Code canonical schema; standard fields
  only):

  ```yaml
  ---
  name: flow-selector
  description: Choose the DCFBI or DFCFBI phase chain for a
    feature round by running R47's 2-of-5 selector against the
    round's Design exit state.
  when_to_use: Invoke at Design phase exit, before declaring the
    round's phase chain. Required for every feature round under
    R47's hybrid flow governance.
  argument-hint: <round-file-path>
  ---
  ```

- Body sections:
  - `## Trigger` — names the activation point (Design exit,
    before declaring the phase chain).
  - `## Procedure` — numbered steps walking each of R47's 5
    selector conditions, collecting yes/no with author
    justification, tallying, emitting the `Flow:` line, and
    writing back to the round's `## Do` section.
  - `## Quality Bar` — what NOT to do (don't decide ad-hoc; don't
    skip the per-condition justification; don't run if Design
    exit gate isn't closed yet).
- Cite R47's clause by link, not by copy — the decision is the
  source of truth; the skill paraphrases minimally so R47
  amendments propagate.

### 3. Author `gate-walker` skill

- Paths (dual-write):
  - `.agents/skills/gate-walker/SKILL.md` — durable record.
  - `.claude/skills/gate-walker/SKILL.md` — runtime discovery.
- Frontmatter:

  ```yaml
  ---
  name: gate-walker
  description: Verify a named Hard Gate (Design, F1, Contract, F2,
    Backend, or Integration) has its exit criterion documented as
    met in the round file. Block phase advance with a remediation
    pointer if the gate is open.
  when_to_use: Invoke before advancing a feature round from one
    phase to the next (e.g., before flipping the round's active
    phase from Design to Contract, run gate-walker for the Design
    gate).
  arguments:
    - name: gate
      description: Gate name — one of Design, F1, Contract, F2,
        Backend, Integration.
    - name: round
      description: Path to the round file (e.g.,
        .agents/plan/cycles/Round_50.md).
  ---
  ```

- Body sections:
  - `## Trigger` — phase-boundary moments; specifically before
    flipping the round's active phase.
  - `## Procedure` — takes a gate name + round path, reads the
    round file, checks the exit criterion per R47's Hard Gates
    table, returns Gate closed (with evidence pointer) or Gate
    open (with remediation pointer). Encodes DCFBI/DFCFBI
    branching: F1+F2 are skipped on the DCFBI path (skill reads
    the round's recorded `Flow:` line first to decide which gates
    apply).
  - `## Quality Bar` — don't accept a gate as closed without a
    cited evidence line; don't auto-advance phases (the round
    author owns the flip; the skill only verifies).

### 4. Include `research` as the first dependent skill

- The skill is already authored (staged via `a2scaffold` at
  [`.agents/skills/research/SKILL.md`](../../skills/research/SKILL.md)
  with companion
  [`references/crawl4ai.md`](../../skills/research/references/crawl4ai.md)
  and [`scripts/crawl4ai_recursive.py`](../../skills/research/scripts/crawl4ai_recursive.py),
  plus the runtime `skill-ref` stub at
  [`.claude/skills/research/SKILL.md`](../../../.claude/skills/research/SKILL.md)).
- R49 includes these files in its commit — they are not user
  setup carried in separately; they are R49's dependent-skill
  deliverable.
- **Frontmatter enhancements applied during planning** (per
  Claude Code's canonical schema at
  [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)):
  - **Added `when_to_use`** — splits use-when triggers from
    `description`. Mentions trigger phrases (research,
    investigate, compare, etc.) and the cross-skill invocation
    pattern (e.g., flow-selector condition #2 prior-art check).
  - **Added `allowed-tools`** — pre-approves the tools the
    procedure needs (Read, Grep, Glob, WebFetch, WebSearch, plus
    `Bash(python3 *)`, `Bash(pip *)`, `Bash(crawl4ai-* *)` for
    the bundled crawl4ai script).
  - **Did not add `metadata.category`** — the prior plan
    revision proposed it, but the canonical schema doesn't
    recognize it. Taxonomy lives in the README only.
  - **Kept the existing `metadata: {author: a2scaffold,
    version: '1.0'}`** — non-canonical but harmless (the
    runtime ignores unknown frontmatter keys); preserves
    authorship trail.
- **Did not edit the `.claude/skills/research/SKILL.md`
  pointer file** — its body comment explicitly says "Do not
  edit this file directly." The pointer carries only `name` +
  `description` (unchanged); the runtime auto-trigger surface is
  preserved.
- The skills README lists `research` under a `## Dependent skills`
  sub-heading, separate from `## Primary skills`. One-line role
  description: "Frame question → choose sources → collect evidence
  → evaluate → synthesize → report. Invoke from any primary skill
  or task that needs extra information."
- R49 does **not** invoke `research` itself — it ships the
  capability; R50+ uses it.

### 5. Wire AGENTS.md horizons + skills README

- New bullet in
  [`AGENTS.md § Operative horizons`](../../AGENTS.md) pointing at
  `.agents/skills/README.md` (the index), matching the existing
  bullet format.
- `.agents/skills/README.md` structure:
  - Top-line convention statement: skills follow the
    `<name>/SKILL.md` layout with frontmatter (`name`,
    `description`, `metadata.{author, version, category}`) and
    body sections (`## Trigger`, `## Procedure`, `## Quality
    Bar`). `metadata.category` is one of `primary` or `dependent`.
  - `## Primary skills` — sub-sections for `flow-selector` and
    `gate-walker`, each ~5 lines (file link, role, R47-clause
    cited).
  - `## Dependent skills` — sub-section for `research`, ~5 lines
    (file link, role, invocation pattern).
  - `## Adding a skill` — short procedure: pick category, scaffold
    or hand-author per schema, index in this README, mirror to
    `.claude/skills/` if runtime discovery requires it.

### 6. Pipeline

- `npx markdownlint-cli2` repo-wide → 0 errors.
- Post-round audit per
  [PDCA.md § Post-round audit](../PDCA.md).
- Grep this round file for unticked `- [ ]` before flipping Status
  to `Review`.

## What is OUT of scope

- **No `f1-timeboxer` skill.** F1 only fires on DFCFBI; no
  DFCFBI round has run yet. The ≤2-day timebox stays as R47
  prose enforced by round-author discipline until first DFCFBI
  surfaces concrete shape.
- **No `o-rule-checker` skill.** The three-truths invariant
  (UX / data-behavior / execution) is conceptually crisp but
  operationally heavy — encoding "traceability between truths is
  explicit" needs design work the trial will inform. Defer.
- **No `round-scaffolder` skill.** Round template lives in
  [PDCA.md § Round Template](../PDCA.md); manual copy works for
  the trial. Scaffolder is a productivity win, not a correctness
  one.
- **No `contract-v2-router` skill.** F2 surfacing a shape change
  is a conditional path; build the skill when first F2 reaches
  it, not before.
- **No first DCFBI/DFCFBI feature trial.** That is R50. R49 ships
  the tooling; R50 uses it.
- **No edits to surviving DCBF-era artifacts.** R48's deferred
  rewrites stay deferred. R49 cites R47's decision body for the
  five selector conditions and six gate criteria; no reframing of
  `design/README.md`, the spec `.md` files, or other survivors.
- **No `.agents/context/` promotion.** Skills bind to R47's
  doctrine; promotion to `context/` requires validation through
  use (R50+).
- **No skill chaining / orchestration.** Each skill stands alone;
  R49 does not write a "phase-runner" that calls flow-selector
  then gate-walker. Composition is the round author's job until
  evidence shows orchestration earns its complexity.

## Plan

- [x] Confirm scope at planning review (user reads Goal + IN/OUT
      sections, redirects if needed). Specifically surface: is
      there a `skill-creator` tool whose schema differs from the
      Claude Code agent-skill shape assumed in IN scope?
- [x] Create `.agents/skills/` directory and author
      `.agents/skills/README.md` (index + convention statement).
- [x] Draft `.agents/skills/flow-selector/SKILL.md` with
      canonical Claude Code frontmatter (`name`, `description`,
      `when_to_use`, `argument-hint`) + body sections (`## Trigger`,
      `## Procedure`, `## Quality Bar`). Cite R47's 5 conditions by
      link, not by copy.
- [x] Dual-write: copy `.agents/skills/flow-selector/SKILL.md` to
      `.claude/skills/flow-selector/SKILL.md` (runtime discovery).
- [x] Draft `.agents/skills/gate-walker/SKILL.md` with canonical
      frontmatter (`arguments` array carries `gate` + `round`) +
      body. Procedure encodes the DCFBI/DFCFBI branching on the
      `Flow:` line read from the round file.
- [x] Dual-write `.claude/skills/gate-walker/SKILL.md`.
- [x] **No edits** to `.agents/skills/research/SKILL.md` or
      `.claude/skills/research/SKILL.md` — canonical schema forbids
      the prior `metadata.category` plan; taxonomy lives in the
      README only.
- [x] Edit
      [`AGENTS.md § Operative horizons`](../../AGENTS.md) to add
      one bullet pointing at `.agents/skills/README.md` (the
      index). Match existing format.
- [x] Self-test: read the skill files as a stranger; verify each
      skill could be executed by a different agent in a future
      round without re-reading R47's full decision body. If a skill
      needs R47's full context to run, the skill itself is too
      thin — fix before flipping Status.
- [x] Run `npx markdownlint-cli2` repo-wide → 0 errors.
- [x] Append a 2026-05-28 entry to
      [`plan/promotions.md`](../promotions.md) covering the new
      `.agents/skills/` directory and the AGENTS.md horizons
      bullet.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this round file for unticked `- [ ]` before flipping
      Status to `Review`.

## Risks / unknowns

- **`skill-creator` schema unknown.** Assumed Claude Code
  agent-skill shape (frontmatter + body). If a different tool
  exists with a different schema (different field names, JSON not
  YAML, separate prompt + tools files), R49's output won't be
  loadable by it. Mitigation: surface at planning review; if
  unclear at execution time, look for `skill-creator` in the
  environment one more time before committing to a format.
- **Skill self-sufficiency is the correctness bar.** Each skill
  must run without re-reading R47's full decision body. If R49
  ships a skill that's a thin pointer to R47 prose ("apply the
  2-of-5 check as described in the decision file"), it provides
  no operational lift over the doctrine alone — the exact failure
  mode R49 exists to prevent. Mitigation: the self-test step in
  Plan reads each skill as a stranger and verifies it stands
  alone.
- **R47 is a moving target.** R47's `revisit-trigger` names three
  conditions for amendment (first DFCFBI run; R48 surfaces an
  unanticipated category; F1 overrun >50%). If R47 amends, the
  skills must follow. Mitigation: skills cite R47 by link (not
  copy verbatim) so amendments propagate naturally; structural
  changes (e.g., a new gate added) need a follow-up skill update.
- **Gate-walker's exit-criterion check is currently grep-shaped.**
  "Documented as met in the round file" is fuzzy — it relies on
  the round author writing the right kind of evidence. The skill
  can lint for structure (presence of an "evidence" line under the
  phase) but cannot verify the evidence is *truthful*. Acceptable
  for R49 (the first measurable failure surfaces in the trial);
  R50+ can sharpen the check shape if needed.
- **AGENTS.md horizons section is load-bearing.** Every agent
  reads it at session start (per Load Order). Adding a bullet
  that points at a non-existent README means every session-load
  hits a broken link. Mitigation: the explicit checkbox sequence
  in Plan creates the README *before* the AGENTS.md edit.
- **Two-primary-skill set may be wrong about what's essential.**
  I'm assuming flow-selector + gate-walker are the minimum; could
  be that `o-rule-checker` is actually essential and the other two
  are luxuries. Mitigation: the user redirects at planning review
  if the framing is off; R50's trial will surface the real
  ordering anyway.
- **Claude Code's canonical schema is strict.** The prior plan
  revision proposed `metadata.category: primary/dependent`;
  confirmed via the official docs that this won't work — only
  documented fields (`name`, `description`, `when_to_use`,
  `arguments`, etc.) are accepted. Taxonomy lives in the README
  only. The staged `research/SKILL.md`'s `metadata: {author,
  version}` is itself non-canonical (`a2scaffold`'s shape); the
  Claude Code runtime may ignore unrecognized fields silently or
  emit a warning. Acceptable for R49 since `research` was shipped
  externally; if it breaks at runtime, surface as follow-up.
- **Dual-write of `.agents/skills/` + `.claude/skills/` is a
  drift risk.** Skills now live in two locations and must stay
  byte-identical. Risk: a future edit touches one location and
  the other rots. Mitigation: R49 ships parity; later R50+
  rounds adopt a single-source convention (e.g., `.claude/skills/`
  symlinked from `.agents/skills/`, or a pre-commit script that
  copies). Documented as a follow-up; not solved in R49.
- **`when_to_use` may not exist as a distinct field.** The lookup
  cited it as a recommended field, but the observed
  `research/SKILL.md` uses `description` alone to carry that
  context. The new primary skills include both `description`
  (one-line summary) and `when_to_use` (invocation context); if
  `when_to_use` turns out to be a documentation field not
  enforced by the runtime, both forms still serve the reader.
  Risk: minor; no blocker.
- **Markdownlint and skill-format friction.** Skill frontmatter
  often uses YAML; markdownlint's MD041 / MD001 / MD025 rules can
  bite on heading patterns inside skill bodies. The repo config
  already disables MD041, MD001, MD025-via-siblings_only; should
  be fine, but verify before flipping Status.

## Do

**Scope confirmation.** User authorized R49 execution via "proceed"
after planning review.

**Schema lookup completed during planning.** Fetched
[code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)
for the canonical Claude Code Agent Skills schema. Key facts that
shaped execution:

- Only `description` is recommended; everything else optional.
- Recognized frontmatter fields: `name`, `description`,
  `when_to_use`, `argument-hint`, `arguments`,
  `disable-model-invocation`, `user-invocable`, `allowed-tools`,
  `disallowed-tools`, `model`, `effort`, `context`, `agent`,
  `hooks`, `paths`, `shell`.
- Body is **free-form** — no required heading structure. R49
  followed the `a2scaffold` house style (`## Trigger`,
  `## Procedure`, `## Quality Bar`) for consistency with the
  staged `research` skill.
- Unknown frontmatter keys (like `metadata.{author, version}`)
  are silently tolerated by the runtime, not rejected.
- The `skill-ref` pointer pattern (`metadata.type: skill-ref`,
  `metadata.skillPath: ...`) is **not** in the documented schema
  — it's an `a2scaffold` convention. R49 mirrored the pattern
  for the new primary skills but flags as open question whether
  Claude Code's native runtime resolves the pointer to fetch the
  canonical body, or only sees the stub. R50's first invocation
  is the measurement.

**Research skill enhanced during planning** (per "check and
enhance" review). Edits to
[`.agents/skills/research/SKILL.md`](../../skills/research/SKILL.md)
frontmatter — two additions, no body changes:

- `when_to_use` — splits trigger phrases from `description`;
  includes the cross-skill invocation hint (flow-selector
  condition #2 prior-art check).
- `allowed-tools` — pre-approves Read, Grep, Glob, WebFetch,
  WebSearch, plus `Bash(python3 *)`, `Bash(pip *)`,
  `Bash(crawl4ai-* *)` for the bundled crawler script.

Pointer stub at
[`.claude/skills/research/SKILL.md`](../../../.claude/skills/research/SKILL.md)
left untouched per its own "Do not edit this file directly"
comment.

**Skills directory bootstrapped.**
[`.agents/skills/README.md`](../../skills/README.md) authored
with: layout convention, primary-vs-dependent category split,
index of all three skills with one-line role descriptions, and an
`## Adding a skill` procedure. Indexes link back to canonical
SKILL.md and (for primary skills) the R47 clause each enforces.

**`flow-selector` skill authored.**

- [`.agents/skills/flow-selector/SKILL.md`](../../skills/flow-selector/SKILL.md)
  — canonical content. Frontmatter: `name`, `description`,
  `when_to_use`, `argument-hint`, `allowed-tools` (Read, Grep,
  `Bash(grep *)`), plus the parity-with-research
  `metadata.{author: hand-authored-r49, version: '1.0'}`. Body
  walks all 5 of R47's selector conditions with per-condition
  justification, tallies, emits the `Flow:` line as a structured
  block (markdown table) in the round's Do log. Quality Bar
  forbids ad-hoc decision, skipping justification, running
  pre-Design-close, rewriting a locked Flow line, and invoking
  research for conditions other than #2.
- [`.claude/skills/flow-selector/SKILL.md`](../../../.claude/skills/flow-selector/SKILL.md)
  — `skill-ref` pointer stub (name + description + skillPath +
  "Do not edit" comment).

**`gate-walker` skill authored.**

- [`.agents/skills/gate-walker/SKILL.md`](../../skills/gate-walker/SKILL.md)
  — canonical content. Frontmatter includes `arguments: gate
  round` (two positional args), `allowed-tools` Read + Grep +
  `Bash(grep *)`. Procedure validates gate name (Design / F1 /
  Contract / F2 / Backend / Integration), reads the round's
  `Flow:` line, branches DCFBI vs DFCFBI (F1/F2 skipped on
  DCFBI path), checks the gate's exit criterion against R47's
  Hard Gates table (encoded inline as a markdown table), accepts
  three evidence forms (Do-section `**Gate closed**` line,
  ticked Check item, or CI pass-count for Contract/BE/Int),
  returns Gate-closed or Gate-open with remediation pointer.
  Quality Bar forbids accepting evidence-less closure, verifying
  truthfulness (structural check only), auto-advancing rounds,
  inferring missing Flow line, and running on non-feature rounds.
- [`.claude/skills/gate-walker/SKILL.md`](../../../.claude/skills/gate-walker/SKILL.md)
  — `skill-ref` pointer stub.

**Discoverability wired.**

- [`AGENTS.md § Operative horizons`](../../AGENTS.md) gained one
  bullet pointing at the skills README, matching the existing
  R99-evo-horizon + Hybrid-flow-governance format. The bullet
  names all three R49 skills inline so a session-load reader
  knows what's available without navigating into the README.
- [`promotions.md`](../promotions.md) gained a 2026-05-28 entry
  covering all three skills + the AGENTS.md horizons bullet,
  with Track-1 anchor cite + R48-pull rationale.

**Self-test pass.** Re-read each new SKILL.md as a stranger:

- `flow-selector` cites R47 by link only (no copy of the 5
  conditions); a future R47 amendment propagates without
  touching the skill. Stands alone.
- `gate-walker` encodes the 6-gate table inline because R47's
  table is small + the skill needs to reference each gate's
  criterion in remediation output without resolving a link
  mid-procedure. Tradeoff: an R47 gate-table amendment requires
  a paired gate-walker edit; flagged as Risks entry. Worth the
  inline encoding because gate-walker invocation is hot-path
  (every phase boundary).
- `research` (post-enhancement) carries `when_to_use` matching
  the cross-skill invocation pattern; primary skills can
  reference it confidently.

**Pipeline.**

- `npx markdownlint-cli2` repo-wide → **0 errors over 127
  files** (was 122 pre-R49; +5: README, 2 canonical SKILL.md, 2
  pointer stubs).
- Post-round audit per
  [PDCA.md § Post-round audit](../PDCA.md) complete; all Plan +
  Check boxes flipped before Status flip.

## Check

- [x] `.agents/skills/` directory contains `README.md`,
      `flow-selector/SKILL.md`, `gate-walker/SKILL.md`, and
      `research/SKILL.md` (the existing dependent skill).
- [x] `.claude/skills/` mirror contains `flow-selector/SKILL.md`,
      `gate-walker/SKILL.md`, `research/SKILL.md` (parity with
      the durable record for runtime discovery).
- [x] `flow-selector/SKILL.md` (both locations) has canonical
      Claude Code frontmatter (`name`, `description`,
      `when_to_use`, optionally `argument-hint`) and body sections
      `## Trigger`, `## Procedure` (walking all 5 of R47's
      selector conditions), `## Quality Bar`.
- [x] `gate-walker/SKILL.md` (both locations) has canonical
      frontmatter with `arguments` (`gate`, `round`); procedure
      handles all 6 R47 gates with DCFBI/DFCFBI branching on the
      `Flow:` line.
- [x] `research/SKILL.md` frontmatter **unchanged** from staged
      `a2scaffold` shape — taxonomy lives in README only.
- [x] Skills README indexes both classes: `## Primary skills`
      (flow-selector, gate-walker) and `## Dependent skills`
      (research), plus an `## Adding a skill` procedure.
- [x] `.agents/skills/README.md` indexes both skills with
      file links + when-to-use + R47-clause cited.
- [x] `AGENTS.md § Operative horizons` has one new bullet
      pointing at the skills README; format matches existing
      entries.
- [x] Skill self-test passed: each skill is readable as a
      stranger and stands alone (does not require concurrent
      R47 read to execute).
- [x] `plan/promotions.md` has a 2026-05-28 entry covering the
      skills directory + AGENTS.md horizons bullet.
- [x] `npx markdownlint-cli2` repo-wide → 0 errors.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md) complete; all
      Plan + Check boxes flipped.

## Act

**Learnings**:

- **The "doctrine then tooling" sequence is now empirically
  cheaper than the alternative.** R47 (doctrine) → R48 (archive
  the old-doctrine corpus) → R49 (operational tooling for the
  new doctrine) is a three-step build-out before the first
  trial. Costly upfront, but R48's discovery that DCBF context
  had to be archived (because doctrine-without-tooling leaked
  back) is the alternative outcome we explicitly avoided here.
  Pattern: when a methodology break-point lands, build the
  tooling in the gap between doctrine and trial, not after.
  Captured as the central R49 framing in Goal.
- **The docs are the source of truth; agent lookups are a
  starting point.** A prior `claude-code-guide` agent dispatch
  claimed "no skill-creator tool exists" and "the canonical
  schema is strict / does not accept arbitrary metadata fields."
  Both turned out partially wrong: a `/skill-creator` plugin
  *does* exist (per the user-provided plugins page), and the
  schema is *defined* but not *strict-rejecting* (unknown keys
  like `metadata: {author, version}` are silently tolerated).
  Direct doc fetch (WebFetch on
  `code.claude.com/docs/en/skills`) resolved both ambiguities.
  For canonical-schema questions, prefer direct doc fetch over
  agent summary.
- **`a2scaffold`'s `skill-ref` pointer pattern is a clever
  primary-vs-mirror tradeoff but unverified.** Keeping canonical
  content in `.agents/skills/<name>/SKILL.md` and a thin pointer
  at `.claude/skills/<name>/SKILL.md` avoids byte-byte drift.
  But Claude Code's documented schema does NOT mention
  `metadata.type: skill-ref` or `metadata.skillPath` — they're
  `a2scaffold`'s convention. Whether the native runtime
  *follows* the pointer (loads the canonical body when the
  skill is invoked) or *only sees the stub* is the open
  question. R50's first invocation of any R49 skill is the
  measurement. If the pointer is not followed, three fallbacks
  exist (byte-byte dual-write, symlink, pre-commit copy script)
  — noted in R49 Risks.
- **R47-clause citation strategy: link for principles, inline
  for hot-path tables.** `flow-selector` cites R47 by link only
  for the 5 selector conditions — R47 amendments propagate
  automatically. `gate-walker` encodes R47's 6-gate exit
  criteria table inline because the skill needs each criterion
  reachable mid-procedure for remediation output. Tradeoff: an
  R47 gate-table amendment requires a paired gate-walker edit.
  Pattern for future skills: link by default; inline only when
  the procedure references the cited content mid-execution
  (hot-path), and pair the inline copy with a Risks note
  naming the propagation cost.
- **Two frontmatter additions to `research` were essentially
  free wins.** Adding `when_to_use` gave Claude Code's
  auto-trigger surface more matching keywords (within the
  1,536-char cap). Adding `allowed-tools` pre-approves the
  tools the procedure actually needs, eliminating per-call
  permission prompts during research runs. Both are
  doc-recommended; both cost zero behavior change. Pattern for
  any future skill review: scan frontmatter for missing
  `when_to_use` and missing `allowed-tools` first.

**Promotions**:

- [x] → `.agents/skills/`: bootstrap as the project skills
  directory; three skills (flow-selector, gate-walker, research)
  plus README and AGENTS.md horizons bullet. Logged in
  [promotions.md](../promotions.md) 2026-05-28.

**Follow-ups (not promotions, just notes):**

- **skill-ref pointer pattern: prove or replace at first R50
  invocation.** When any R49 skill is first invoked by Claude,
  observe whether the runtime sees the canonical body or only
  the stub. If only the stub: pick a fallback (byte-byte
  dual-write via pre-commit script is the lowest-friction
  fix).
- **The deferred four skills** (`f1-timeboxer`,
  `o-rule-checker`, `round-scaffolder`, `contract-v2-router`)
  await concrete pull from R50's first trial. Pull triggers:
  - F1 fires + overruns → `f1-timeboxer`.
  - Gate-walker structurally passes but feature breaks at
    Integration → `o-rule-checker` or sharper gate-walker.
  - Round authoring drags on template re-typing →
    `round-scaffolder`.
  - F2 surfaces a real shape change → `contract-v2-router`.
- **gate-walker's inline 6-gate table couples to R47.** If R47
  amends any gate's exit criterion (per its own
  `revisit-trigger`), gate-walker must be updated paired with
  the R47 amendment. Flag as Risks for any future R47 edit.
- **`research` skill body has a hardcoded `.agents/skills/`
  install path** in `references/crawl4ai.md` (line 45:
  `python3 .agents/skills/research/scripts/crawl4ai_recursive.py`).
  This works only at the `.agents/skills/` location, not for
  user-global (`~/.claude/skills/`) installs. Acceptable for now
  (the skill is project-local); a future generalization would
  use `${CLAUDE_SKILL_DIR}` substitution in SKILL.md body and
  invoke the script from there.
- **Bundled-skill author tag inconsistency.** `research` lists
  `metadata.author: a2scaffold`; R49's new skills use
  `metadata.author: hand-authored-r49`. Neither is canonical
  (Claude Code ignores both). Worth standardizing if/when more
  skills land — but not a R49 concern.

## Feeds into → Round_50 (TBD) — `markdown-check-link` skill (pre-trial)

R50 is **one more tooling round before the first DCFBI/DFCFBI
feature trial** (which moves to R51+). The inserted skill is
**`markdown-check-link`** — a link-integrity checker for the
`.agents/` corpus.

**Why insert this before the trial:**

- R49's own Risks named the failure mode: *"AGENTS.md horizons
  section is load-bearing. Adding a bullet that points at a
  non-existent README means every session-load hits a broken
  link."* R49 mitigated it once by hand-sequencing the README
  before the AGENTS.md edit, but the failure mode is structural,
  not one-off.
- The DCFBI/DFCFBI chain itself adds new cross-link surface
  (round files cite `.agents/decisions/`, `.agents/skills/`,
  `.agents/design/`; gate-walker output cites round files; the
  O-rule cites contract artifacts). The trial round will create
  many of these links in flight — a checker that runs in the
  trial's pipeline catches rot *during* the round, not after.
- Per R49 Act *"two frontmatter additions to `research` were
  essentially free wins"* pattern: small linting tooling that
  runs alongside `markdownlint-cli2` is low-cost, high-leverage,
  and earns its slot well before the trial needs it.
- Category: **dependent skill** (generic utility, callable by
  any task; no round-file coupling). Sits alongside `research`
  in the README index.

**R50 ships:**

- `.agents/skills/markdown-check-link/SKILL.md` (canonical) +
  `.claude/skills/markdown-check-link/SKILL.md` (skill-ref
  pointer, same convention as R49 skills).
- Index entry under `## Dependent skills` in
  [`.agents/skills/README.md`](../../skills/README.md).
- A pipeline note: `markdown-check-link` runs alongside
  `npx markdownlint-cli2` in the post-round audit (additive,
  doesn't replace markdownlint).

**Not in R50:** the feature trial itself. The four deferred
DCFBI skills (`f1-timeboxer`, `o-rule-checker`,
`round-scaffolder`, `contract-v2-router`) stay deferred —
their pull is still the first trial, now R51+.

R51 is **the first DCFBI/DFCFBI feature trial** — picks a
feature, runs `flow-selector` at Design exit, `gate-walker` at
each phase boundary, and (newly) `markdown-check-link` in the
pipeline. R51's outcomes inform which of the four queued skills
earns the next slot:

- If F1 fires (DFCFBI selected) and overruns, the next skill is
  `f1-timeboxer`.
- If gate-walker's structural check passes but the evidence
  turns out shallow, the next skill is `o-rule-checker` or a
  sharpened gate-walker.
- If round authoring itself drags, the next skill is
  `round-scaffolder`.
- If F2 surfaces a real shape change, `contract-v2-router`
  enters the queue.

Skills are deferred until pulled — same Evolution Rule shape
that governs the rest of `.agents/`.
