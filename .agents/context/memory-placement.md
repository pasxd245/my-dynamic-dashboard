# Memory Placement Rule

> Where agent memories live in this repo, and how to decide between
> the two locations.

## Two memory locations

This repo uses two distinct memory systems. They are **not
interchangeable**.

| Location                                                                               | Scope                                     | Persists across                           | Who sees it                                                  |
| -------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| `.agents/memory/` (in this repo)                                                       | Project knowledge                         | git, machines, agents, contributors       | Everyone working on the repo — Claude, Codex, Gemini, humans |
| Auto-memory at `~/.claude/projects/<repo-slug>/memory/` (per-Claude-install, off-repo) | User and tool habits local to one machine | Claude Code sessions on this machine only | Just the one Claude Code install on the user's machine       |

## What belongs where

**`.agents/memory/`** is the canonical home for project knowledge:

- Tech-stack decisions (e.g., "uv is the default Python package
  manager")
- Architectural lessons (e.g., "build the UI/BIZ boundary first,
  don't extract later")
- Long-running deferral rationales (e.g., "Streamlit dashboard is
  deferred indefinitely; revisit only if X")
- Drift incidents and their root causes
- Governance rules that emerged from real rounds
- Repo-specific tool quirks documented for everyone (e.g., the
  markdownlint MD004 + `+`-prefix gotcha)

The format is set by [.agents/memory/\_TEMPLATE.md](../memory/_TEMPLATE.md):
Date / Agent / Confidence / Status / Problem / Finding / Evidence /
Recommendation / Promotion Candidate. Filenames follow
`YYYY-MM-DD-short-topic.md`.

**Auto-memory** is reserved for things that genuinely do not need to
travel with the repo:

- The user's personal working habits (e.g., "prefer single-feature
  rounds with end-of-round Q&A") — applies across repos.
- Claude-Code-specific tool quirks (e.g., the `Read`-before-`Write`
  guard going stale across `git rm` in the same iteration) — not
  relevant to other agent tools.
- Cross-project conventions the user follows.

If another agent or human contributor on this repo would benefit
from seeing it, it does **not** belong in auto-memory.

## Decision rule

Before saving a memory, ask:

> _Would Codex, Gemini, or a human contributor working on this repo
> next month benefit from seeing this?_

- **Yes** → write to `.agents/memory/` using the project template.
- **No, this is about how I personally work with Claude Code** →
  auto-memory is fine.
- **In doubt** → `.agents/memory/`. False positives are cheap (extra
  shared knowledge); false negatives are expensive (lost context for
  the next contributor).

## When recalling memory

- **Project-level questions** (what stack do we use? what was
  deferred? what lesson came out of the drifted iteration?) →
  check `.agents/memory/` first.
- **User-preference questions** (how does this user like rounds
  scoped?) → auto-memory.
- Both can be stale. Verify recalled memories against current code
  and round artifacts before acting on them.

## Conflict handling

If a fact appears in both locations and they disagree:

- The `.agents/memory/` version wins (it's the shared source of
  truth).
- Update the auto-memory entry or delete it.
- If the disagreement reveals a genuinely changed decision, treat
  it as an open question — surface it to the human before acting.

## Extraction rule (auto-memory → `.agents/memory/`)

**If an auto-memory entry becomes project-load-bearing — another
agent/contributor needs it, a `.agents/` file would benefit from
citing it, or losing it on machine change would hurt — it MUST be
extracted to `.agents/memory/`.** Active rule, not aspirational.

Procedure: re-frame the entry using
[\_TEMPLATE.md](../memory/_TEMPLATE.md) (don't just copy) and cite
the extraction round in its Status; **delete the original** or
stub it to a one-line pointer (stale duplicates are the failure
mode); update `MEMORY.md` so the auto-memory side knows. Three
historical extractions are linked in Cross-references below as
worked examples.

Automation of this is deferred to a future self-evo round —
trigger: ≥ 3 rounds of recurring misplacement friction. Until then,
manual discipline.

## Promotion pathway

Memories may **promote** out of `.agents/memory/` into
`.agents/context/` (stable, broadly-applicable principles) or
`.agents/skills/` (reusable procedures) per the criteria in
[governance.md](governance.md). Promotions are logged in
[../plan/promotions.md](../plan/promotions.md) and reduce the
memory's Status to `Promoted` (or `Archived` if superseded). The
auto-memory side has no promotion pathway — entries either stay
local or get extracted to `.agents/memory/` first (see Extraction
rule above), and only then become promotion candidates.

## Cross-references

- The historical migration that established this rule:
  [2026-05-22-round-roadmap-deferrals.md](../memory/2026-05-22-round-roadmap-deferrals.md),
  [2026-05-22-python-tooling-uv.md](../memory/2026-05-22-python-tooling-uv.md),
  [2026-05-22-ui-boundary-build-first.md](../memory/2026-05-22-ui-boundary-build-first.md)
  — three project memories that were initially saved to auto-memory
  during Round_01-02, then migrated to `.agents/memory/` after the
  user identified the mismatch.
- Governance frame: [governance.md](governance.md).
- Template for `.agents/memory/` entries:
  [\_TEMPLATE.md](../memory/_TEMPLATE.md).

---

_Origin: distilled from the conversation that produced Round_01-04
on 2026-05-22, after three project memories were misplaced and
migrated. Codified in Round_05._
