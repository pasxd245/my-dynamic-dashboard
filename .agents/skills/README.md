# `.agents/skills/` — Project skills index

Skills extend Claude's capabilities with named, reusable procedures.
This directory is the **durable, version-controlled home** for skills
this repo ships. Each skill can have a sibling **`skill-ref` pointer**,
ex: under [`../../.claude/skills/`](../../.claude/skills/) so Claude Code's runtime discovers it at session load.

Skills follow the Claude Code Agent Skills schema:
([code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)).

## Layout

```text
.agents/skills/
  <skill-name>/
    SKILL.md             ← canonical content (required)
    references/*.md      ← optional supporting docs
    scripts/*            ← optional helper scripts

.claude/skills/
  <skill-name>/
    SKILL.md             ← skill-ref pointer stub (a2scaffold convention)
```

The pointer stub carries only `name` + `description` so Claude Code's
auto-trigger surface works at session load. The full procedure body
lives in the canonical `.agents/skills/<name>/SKILL.md`.

## Categories

Skills under this directory belong to one of two classes — encoded by
README structure, not frontmatter (Claude Code's schema does not
recognize arbitrary metadata keys):

- **Primary skills** — workflow-specific, operate on round files in
  [`.agents/plan/cycles/`](../plan/cycles/), carry doctrine
  enforcement for R47's DCFBI/DFCFBI hybrid flow.
- **Dependent skills** — generic utility, domain-agnostic, callable
  by any primary skill or task that needs the capability.

## Primary skills

### [`flow-selector`](flow-selector/SKILL.md)

Run R47's 2-of-5 flow selector at Design exit. Records `Flow: DCFBI`
or `Flow: DFCFBI (triggers N,M)` in the round file's Do log so the
choice is mechanical and auditable, not re-derived ad-hoc each
round. Cited clause:
[R47 § Flow selector (2-of-5)](../decisions/2026-05-28-hybrid-flow-governance.md).

### [`gate-walker`](gate-walker/SKILL.md)

Verify a named Hard Gate's exit criterion is documented as met
before phase advance. Blocks with a remediation pointer if open.
DCFBI/DFCFBI branching reads the round's recorded `Flow:` line to
decide whether F1/F2 gates apply. Cited clause:
[R47 § Hard gates (non-negotiable)](../decisions/2026-05-28-hybrid-flow-governance.md).

## Dependent skills

### [`research`](research/SKILL.md)

Frame question → choose sources → collect evidence → evaluate →
synthesize → report. Invoke from any primary skill or task that
needs extra information beyond the round file — e.g.
`flow-selector` condition #2 (prior-art check for "new
interaction pattern") delegates here when the round author is not
sure whether a pattern is genuinely new.

Bundles
[`references/crawl4ai.md`](research/references/crawl4ai.md) +
[`scripts/crawl4ai_recursive.py`](research/scripts/crawl4ai_recursive.py)
for browser-backed multi-page crawling when web research needs it.

### [`markdown-check-link`](markdown-check-link/SKILL.md)

Verify markdown links resolve to existing files and headings.
Default scope reads
[`.markdownlint-cli2.jsonc`](../../.markdownlint-cli2.jsonc)
`globs` + `ignores` (single source of truth for "what markdown
the repo cares about"); falls back to `.agents/**/*.md` if the
config is missing. Emits `links.json` + `broken.md` under
`.agents/tmp/markdown-check-link/` on every run. Opt-in
auto-correct (`--fix` / `--dry-run`) applies only the three
conservative candidates (case-only path, case-only fragment,
single unambiguous basename); anything else stays as a
suggestion in the report. Invoke as an optional companion to
`npx markdownlint-cli2` in the post-round audit.

### [`ux-design`](ux-design/SKILL.md)

> **Renamed from `ui-design` in R98** — it reviews **UX affordances**, not the **UI layout
> skeleton**; the `ui-design` name is reserved for a future layout-skeleton skill. (Round files
> R51–R97 + memories reference the old `ui-design` name as historical record.)

Review a UI surface against **the six essential components of a
design** (UX-honeycomb facets — Findability, Usability,
Accessibility, Credibility, Utility, Desirability), grounded in
[Ant Design's Data Entry guidance](https://ant.design/docs/spec/data-entry/).
Two modes: **design-spec** (does the design doc _declare_ the
affordances — run at the **Design gate**, _primary/preventive_,
because under DCFBI the F phase only confirms and the design is
where UX is decided) and **fidelity** (does the _build_ carry them
— run at **F1/F2**, _backstop/corrective_, catching drift like
R51's dropped label + `[Clear]`). Emits a per-facet `pass`/`gap`
report; **verifies, does not auto-fix** (same discipline as
`gate-walker`). Filed dependent (not primary): operates on design
docs + components, not round files, callable by any round or task.
Introduced by [Round_52](../plan/cycles/Round_52.md), pulled by
R51's advanced-query field shipping unlabeled with a hidden clear
action.

### [`design-sync`](design-sync/SKILL.md)

Re-sync a **domain**'s design docs (`design/<domain>/`) to the
**actual implementation** — the code is the source of truth — then
compact them to current-state only. Builds a CODE TRUTH map from the
backend / contracts / frontend, diffs each doc against it (a
doc↔code drift report), and rewrites each doc to what is really
built, dropping the round-by-round ledger (stamps, test counts,
as-built deltas, HIxAI tables, lifecycle) per the *design docs are
source code, not history* rule ([design README](../design/README.md)).
De-fragments spine-first only where a concept has split across ≥3
docs; merges leave a redirect stub when locked round files link the
merged path. Filed dependent: operates on design docs + code, runs
per domain, callable by any round or task. Introduced by
[Round_81](../plan/cycles/Round_81.md), pulled by the workspaces
design doc having frozen at R13 (read+create-stub, in-memory) while
the code shipped full CRUD + SQLModel/Alembic persistence.

### [`cold-reviewer`](cold-reviewer/SKILL.md)

Apply a fixed, **cold-authored** six-anchor review to a decision at
its **lock-in moment** (sealing a Plan/Design gate, locking a
scope/model, flipping a round Complete, approving a diff) so blind
spots surface before commitment. One axis — reviewer disposition
(`challenge`/`fair`/`constructive`/`mix`); the anchor-set is fixed and
every verdict is **grounded-or-`could-not-verify`** (never a fluent
assertion). **Surfaces, never decides** — only the human locks (same
verify-don't-fix discipline as `ux-design`/`gate-walker`). The *why*
(Kahneman S1/S2 human + S3 AI, WYSIATI, regression-to-mean, "cold" =
pre-registered questions) lives in
[`references/theory.md`](cold-reviewer/references/theory.md). Companion:
a proposed `gate-walker` Design-exit criterion (the gate triggers the
pause; this skill is the lens applied during it). Filed dependent:
operates on round files / diffs / decisions, human-invoked at lock-in,
not DCFBI/DFCFBI doctrine enforcement. _Track 2 (agent-method —
decision-hygiene for the HIxAI co-spiral). Pulled by
[Round_92](../plan/cycles/Round_92.md) planning — a cold-reviewer pass
caught the `resolveConnect`/provenance seam and pinned the `qr_`-node
scope before build; within the
[R99 evo-horizon](../decisions/2026-05-27-r99-evo-horizon.md) (a
Track-2 promotion of a crystallized lesson, allowed)._

## Adding a skill

1. **Pick category.** Primary if the skill enforces DCFBI/DFCFBI
   doctrine on a round file; dependent if it's domain-agnostic
   utility.
2. **Author canonical content** at
   `.agents/skills/<skill-name>/SKILL.md`. Frontmatter: `name`,
   `description`, optionally `when_to_use`, `arguments`,
   `allowed-tools`, etc. (See
   [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)
   for the full schema.)
3. **Write skill-ref pointer stub** at
   `.claude/skills/<skill-name>/SKILL.md` carrying
   `metadata.type: skill-ref` and
   `metadata.skillPath: ../../../.agents/skills/<skill-name>`.
4. **Index here** under the right category section. One link, one
   role-line, plus the R47 (or other) clause it enforces if any.
5. **Lint** with `npx markdownlint-cli2` and commit alongside the
   round that introduces it.
