---
name: markdown-check-link
description: Verify markdown links resolve to existing files and headings. Emits full link inventory + broken-link report under .agents/tmp/markdown-check-link/. Supports opt-in conservative auto-correct (--fix / --dry-run) for case-only and single-unambiguous-basename mismatches.
when_to_use: Invoke in the post-round audit (alongside markdownlint-cli2), after large doc edits, or when a session-load link click 404s. Default scope reads .markdownlint-cli2.jsonc globs + ignores; falls back to .agents/**/*.md if config missing. Trigger phrases include "check links", "broken markdown links", "link rot", "verify .agents links".
argument-hint: "[path-or-glob ...] [--changed] [--check-http] [--fix | --dry-run] [--exclude PATTERN]"
allowed-tools: Read, Grep, Glob, Bash(python3 *)
metadata:
  author: hand-authored-r50
  version: '1.0'
---

## Trigger

Run this skill when:

- A round's **post-round audit** runs (alongside
  `npx markdownlint-cli2`). Optional companion, not mandatory
  — skip if the round didn't touch cross-links.
- A **large doc reshuffle** lands (renames, moves, archival
  batches). Cross-link rot is the leading risk.
- A **session-load link click 404s** in an `.agents/` doc.
  Re-run to catch sibling rot.
- Before flipping a round from `In Progress` → `Review` when
  the round wrote substantial Markdown.

Do not run this skill when:

- The round didn't touch any Markdown — it has nothing to
  verify.
- Network availability is required for `--check-http` mode
  but the environment is offline.

## Procedure

### 1. Resolve scope

The script reads
[`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc)
at the repo root by default — its `globs` + `ignores` are the
single source of truth for "what markdown does this repo
care about." Resolution precedence:

1. **Explicit paths/globs** passed as positional args →
   override the config entirely.
2. **`--changed`** → scope = changed `.md` files in the git
   workspace (unstaged + staged + untracked), intersected
   with the config's `ignores`. Right scope for pre-commit
   hooks and per-PR audits. Requires git on PATH; errors
   cleanly outside a repo.
3. **No args, config present + parseable** → apply the
   config's `globs` + `ignores`.
4. **No args, config missing** → warn on stderr; fall back to
   `.agents/**/*.md`.
5. **No args, config present but unparseable** → raise an
   error with the file path + parse reason; exit nonzero.
   Fix the source of truth, don't silently switch surface
   area.

### 2. Run

```bash
# Full corpus (config-scoped).
python3 .agents/skills/markdown-check-link/scripts/check_links.py

# Only what's changed in the git workspace — fast, pre-commit fit.
python3 .agents/skills/markdown-check-link/scripts/check_links.py --changed
```

The script always writes three artifacts under
`.agents/tmp/markdown-check-link/` (gitignored):

- `links.json` — every link found, file-grouped:
  `{root_path, files: {<rel/path>: {items: [<record>, ...]}}}`.
  Items per file are sorted ascending by line. Each record
  carries `{file, line, kind, text, target, resolved_path,
  status, reason?, fix_candidate?, conflict_candidates?}`.
- `conflicts.json` — same schema as `links.json`, filtered
  to records where the script found **multiple candidates**
  (e.g., a missing target basename that exists in 2+ places).
  These need human disambiguation; auto-fix skips them.
  Always written (empty `files: {}` when no conflicts).
- `broken.md` — human-readable broken-link report grouped
  by source file. Mentions `fix_candidate` and
  `conflict_candidates` inline so a reviewer doesn't need
  to cross-reference JSON.

Stderr emits one line per broken link:
`path:line: <link-text> → <target> (reason)`.

Exit code: `0` clean, `1` if any links are broken.

### 3. Triage findings

Read `.agents/tmp/markdown-check-link/broken.md`. For each
broken link, decide:

- **Obvious intent + one-line fix** → fix by hand.
- **Safe-candidate auto-fix offered** (per `fix_candidate`
  in the report) → re-run with `--dry-run` to preview, then
  `--fix` to apply. **Round-author decision; not automatic.**
- **No safe candidate / ambiguous** → defer as a follow-up,
  or fix manually with the full context the script doesn't
  have.

### 4. Apply auto-correct (opt-in)

```bash
# Preview only; no writes.
python3 .agents/skills/markdown-check-link/scripts/check_links.py --dry-run

# Apply safe candidates in place.
python3 .agents/skills/markdown-check-link/scripts/check_links.py --fix
```

Auto-correct applies **only three conservative patterns**:

1. **Case-only path mismatch** — target exists with
   different casing (e.g., `README.MD` → `README.md`).
2. **Case-only heading-fragment mismatch** — fragment matches
   exactly one heading case-insensitively.
3. **Single unambiguous basename match** — exactly one file
   in the scanned set has the broken target's basename.

Anything else (ambiguous, fuzzy, multi-candidate) stays as a
suggestion in `broken.md` for human review.

After `--fix`, **re-run default mode** to confirm clean exit
before stopping. Idempotence is the correctness bar.

### 5. Optional: HTTP link check

```bash
python3 .agents/skills/markdown-check-link/scripts/check_links.py --check-http
```

Off by default (network is flaky, slow, and rate-limited).
With the flag, the script does a HEAD request via stdlib
`urllib` with a 5s timeout per link. 4xx/5xx are recorded as
broken; network errors are `status: skipped, network
unreachable`, not broken.

## Quality Bar

- **Do not** bypass with `--exclude` for "this link doesn't
  really matter" — either it's a real reference (fix it) or
  it shouldn't be a link (rewrite the prose).
- **Do not** treat HTTP timeouts as broken links — flag
  separately as network-unreachable.
- **Do not** run `--check-http` in CI without rate-limit
  handling — current implementation has no backoff.
- **Do not** run `--fix` blind — always `--dry-run` first
  and read the diff. The "safe candidate" heuristic is
  conservative but not infallible.
- **Do not** edit links to suppress findings without
  verifying intent. The link may be a real reference whose
  target needs to be created, not repointed.
- **Do not** treat a `--fix` run as complete without
  re-running default mode to confirm clean exit. A fix that
  introduces new breakage is a bug, not progress.
