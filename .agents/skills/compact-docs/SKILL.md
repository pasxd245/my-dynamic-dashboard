---
name: compact-docs
description: 'Compact one or more Markdown docs in a directory while preserving key ideas. Strategy-driven: scope → plan → user confirm/revise loop → execute. Never proceeds without explicit user authorization of the agreed plan. Use when a doc folder has grown noisy (chat transcripts, multi-round PDCA notes, layered design docs) and the user wants a tighter version that keeps decisions, evidence, and constraints but drops redundancy and narrative scaffolding.'
---

# compact-docs Skill

## When to use

Trigger when the user asks to "compact", "shrink", "tighten", "summarise" a folder of docs (e.g. `docs/agents/...`, `chat.md`, archive/PDCA notes) AND wants editorial control rather than a one-shot rewrite. Typical signals:

- "compact `<dir>`"
- "make these docs shorter"
- "extract the key ideas from this folder"
- "the audits are done, can we tighten the original notes?"

Do **not** trigger for: a single file edit, a code refactor, removing a single section. Use direct edits for those.

## Core principle

This skill is **strategy, not mechanics**. The model picks a compaction strategy per doc type, drafts a plan, and **only edits files after the user authorizes the plan**. No silent rewrites. No partial in-flight edits while the plan is still being negotiated.

## Workflow — 4 phases

### Phase 1 — Scope

Inputs:

- A target directory (required)
- Optional: a single file (treat as 1-doc directory)

Steps:

1. List the target directory's `*.md` files at the top level.
2. **Ask the user:** "Recurse into subdirectories? (y/N)" — only ask if subdirectories contain `.md` files. If none, skip.
3. **Ask the user:** "Output mode?"
   - **Sidecar (default, non-destructive):** write `<file>.compact.md` next to each source file
   - **In-place:** overwrite the source file (only if explicitly requested)
   - **Single merged file:** combine all compacted output into one new file (path required)
4. Build the candidate list: `path · size · last-modified · brief role guess`. Show this back to the user before planning.

### Phase 2 — Plan

For each doc in the candidate list, decide:

- **Strategy** (see § Strategy Menu below)
- **Target size** — rough line/word ratio (e.g. "→ 30%", "→ 100 lines max")
- **Anchors to preserve** — what MUST survive: decisions made, file:line evidence, verbatim quotes from incidents, dates, owner names, [NEEDS HUMAN INPUT] markers
- **What to drop** — narrative scaffolding, restated context that lives in another canonical doc, exploratory dialogue, superseded options, multi-round PDCA "we tried X then Y" stories

Render the plan as a single Markdown table the user can scan in one screen:

```markdown
| File                | Strategy          | Target       | Preserve                       | Drop                                   | Cross-link              |
| ------------------- | ----------------- | ------------ | ------------------------------ | -------------------------------------- | ----------------------- |
| docs/foo/notes.md   | extract-decisions | ~120 lines   | 4 decisions + 2 file:line refs | session narration, restated background | → docs/foo/decisions.md |
| docs/foo/round02.md | merge-into        | (drops to 0) | 1 unique finding               | superseded by round03                  | merged into round03.md  |
```

Add 1-3 **strategy notes** below the table explaining non-obvious choices ("why merge round02 into round03 instead of keeping both").

If the corpus is large (>20 files), break the plan into batches of ≤10 files, present batch 1 only, defer the rest until that batch is approved. Don't overwhelm.

### Phase 3 — Confirm loop

Ask the user one of three things:

1. **"Authorize the plan as-is?"** (most common after a clean Phase 2)
2. **"Revise — what should change?"** (loop back to Phase 2 with their feedback)
3. **"Stop."**

Loop on revisions. Do **not** start editing files until the user uses the literal word "authorize", "go", "proceed", or equivalent positive confirmation. Hedged language ("looks ok I guess") is a revise signal — ask for explicit go.

If the user revises, surface the diff between the previous plan and the new plan ("changed strategy on `notes.md` from extract → merge; added preservation of file:line refs"), so they can see what their feedback altered.

### Phase 4 — Execute

Only after authorization:

1. Apply the agreed plan one file at a time.
2. Use `Read` then `Write` (sidecar mode) or `Edit` (in-place mode).
3. After each file, do a quick self-check:
   - Did every "Preserve" anchor survive? (grep / read back)
   - Are file:line refs still resolvable?
   - Is the target size hit (within ±20%)?
4. After all files, produce a short execution report:
   - Files written, total lines before/after
   - Any preserve-target that didn't make it (with reason)
   - Suggested follow-up (e.g. "delete the source notes after one review cycle")

If a self-check fails, **stop** and ask the user how to proceed. Do not silently move on.

## Strategy menu

Pick per-file based on what the doc actually is. These are the most common — the model can invent a hybrid if needed and document it in the plan's strategy notes.

### `extract-decisions`

For: dialog-heavy docs (chat transcripts, planning sessions, PDCA logs).

Keep: decisions made, with the date and the deciding party. Drop the back-and-forth that led there. One-line context per decision is fine; full Q&A is not.

Output shape: a table or bullet list of `{date, decision, why, owner}`.

### `extract-findings`

For: audit / review / discovery docs.

Keep: the findings (what is broken / what works / what's risky), each with file:line evidence. Drop methodology, search logs, restated requirements.

Output shape: a findings table sorted by severity, plus a short "what to do next" section.

### `merge-into`

For: superseded / redundant docs.

The doc itself drops to zero; its unique content (if any) is appended to a canonical newer doc. The plan must name the merge target.

Output: an empty (or deleted) source + an annotated patch to the target.

### `cross-reference-only`

For: docs that exist mainly because they restated content already canonical elsewhere.

Replace the body with a short "see X" pointer plus 2-5 lines that justify the doc's continued existence (audit trail, search SEO, deep-link from elsewhere). If nothing justifies it, propose deletion.

### `compress-prose`

For: well-structured reference docs that are simply too long.

Keep section structure and code samples; rewrite prose paragraphs into terse bullet points. No re-organization, no new sections. Targets 50–60% of original size.

### `archive-and-thin`

For: round-N docs where the team wants to keep history but extract the gist.

Move the full file to `<dir>/archive/<filename>` and write a thin successor at the original path (≤50 lines) that summarises and deep-links into the archive.

## Plan template

Drop this verbatim into the message that asks for authorization:

```markdown
## Compaction plan — <directory> · <date>

**Scope:** <N files, recursive? Y/N> · **Output mode:** <sidecar | in-place | merged>

| File | Strategy | Target | Preserve | Drop | Cross-link |
| ---- | -------- | ------ | -------- | ---- | ---------- |
| ...  | ...      | ...    | ...      | ...  | ...        |

**Strategy notes:**

- <non-obvious choice 1>
- <non-obvious choice 2>

**Authorize this plan?** Reply with one of: `authorize` · `revise: <feedback>` · `stop`.
```

## Safety rules — never compact away

These survive every strategy. If the plan would drop one of these, the plan is wrong — flag it in strategy notes and ask the user.

1. **`[NEEDS HUMAN INPUT]` markers** — explicit unresolved questions.
2. **Verbatim quotes from external parties** (DBA review notes, customer incident reports, external review comments) — paraphrasing loses fidelity.
3. **File:line evidence pointers** — these are the audit trail; they must remain resolvable post-compact.
4. **Dates and owner names** in decision records.
5. **Code, SQL, configuration snippets** — never paraphrase these. Drop or keep verbatim.
6. **License / copyright headers** if present.
7. **Front-matter `spec.json` / YAML metadata** — leave untouched.

## Cross-tool boundaries

- This skill **does not delete files** without explicit user say-so. "Drops to zero" in `merge-into` means the file becomes empty or contains only a "see <target>" pointer; deletion is a separate confirmation.
- This skill **does not move files** between directories without asking. `archive-and-thin` requires the user to confirm the archive subdirectory path before execution.
- This skill **does not run tools** beyond `Read` / `Write` / `Edit` / `Bash` for grep / `Glob`. No git operations, no destructive shell.

## Common failure modes

- **Plan too coarse** (one strategy for the whole folder): different docs serve different purposes. Force per-file decisions.
- **Authorize-creep**: starting to edit on a hedged "ok" — don't. Re-ask for explicit go.
- **Losing evidence**: a file:line ref drops because it lived inside a paragraph being rewritten. Always extract anchors before rewriting prose.
- **Dropping the wrong round**: in PDCA-style multi-round docs, the latest round may not have the latest finding (sometimes a finding only appears in round 2). Check before merging.
- **Hidden cross-links**: another doc links to a heading you're about to remove. Run a quick `grep -r "the-heading-anchor"` before changing heading structure.

## Output conventions for compacted docs

When writing a compacted doc:

- Frontmatter stays if present; add `compacted_at: <date>` and `compacted_from: <source-path>` keys for traceability.
- First section is a 2-3 line "What this is" pointer.
- Last section is a "Source / archive" pointer back to the original (or its archive location).
- Use the same heading levels and link conventions as the rest of the project (see existing docs in `docs/agents/sdd/`).

## Example session shape

```text
User: /compact-docs docs/archive/pdca/

Skill (Phase 1): "I see 12 .md files at top level + 3 subdirs each with 4-9 files. Recurse? (y/N)"
User: y
Skill: "Output mode? sidecar (default) / in-place / merged"
User: archive-and-thin into docs/archive/pdca/_archive/
Skill: [shows candidate list, 47 files]

Skill (Phase 2): [shows table with 47 rows, strategy notes]
"Authorize?"

User: revise: keep round03 verbatim, it's load-bearing
Skill: [updates plan, marks round03 as cross-reference-only with no compaction]
"Authorize?"

User: authorize
Skill (Phase 4): [executes, file by file, reports back]
```
