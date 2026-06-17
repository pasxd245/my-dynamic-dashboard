---
name: markdown-check-link
description: Verify markdown links resolve to existing files and headings. Emits full link inventory + broken-link report under .agents/tmp/markdown-check-link/. Supports opt-in auto-correct (--fix / --dry-run) driven by ranked, confidence-scored suggestions (git-rename, case-mismatch, unique-basename, fragment-case).
when_to_use: Invoke in the post-round audit (alongside markdownlint-cli2), after large doc edits, or when a session-load link click 404s. Default scope reads .markdownlint-cli2.jsonc globs + ignores; falls back to .agents/**/*.md if config missing. Trigger phrases include "check links", "broken markdown links", "link rot", "verify .agents links".
argument-hint: '[path-or-glob ...] [--changed] [--check-http] [--fix | --dry-run] [--min-confidence FLOAT] [--exclude PATTERN] [--resolution FILE]'
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
status, reason?, suggestions: [{path, score, reason}, ...]}`.
- `suggestions.json` — same schema as `links.json`, filtered
  to broken records that need human review: no high-confidence
  fix, or two candidates both at the auto-apply threshold (a tie
  the script refuses to break). Always written (empty
  `files: {}` when nothing needs review).
- `broken.md` — human-readable broken-link report grouped
  by source file. Each broken link lists its ranked
  suggestions inline with score + reason; `✓` marks ones
  the script will auto-apply under `--fix`.

Stderr emits one line per broken link:
`path:line: <link-text> → <target> (reason)`.

Exit code: `0` clean, `1` if any links are broken.

### 3. Triage findings

Read `.agents/tmp/markdown-check-link/broken.md`. For each
broken link, decide:

- **Obvious intent + one-line fix** → fix by hand.
- **Top suggestion marked `✓`** (score ≥ 0.9, no rival at
  the same score) → re-run with `--dry-run` to preview, then
  `--fix` to apply. **Round-author decision; not automatic.**
- **Two candidates tied at ≥ 0.9, or best < 0.9** → see
  `suggestions.json`. Pick by hand with the context the
  script doesn't have, or defer.

### 4. Apply auto-correct (opt-in)

```bash
# Preview only; no writes.
python3 .agents/skills/markdown-check-link/scripts/check_links.py --dry-run

# Apply safe candidates in place.
python3 .agents/skills/markdown-check-link/scripts/check_links.py --fix
```

Auto-correct picks the top-ranked suggestion **only when**
it scores ≥ `--min-confidence` (default `0.9`) **and** no
runner-up is tied at that score. Scoring tiers:

| Score | Tier                 | Trigger                                                                    |
| ----- | -------------------- | -------------------------------------------------------------------------- |
| 1.00  | `git-rename`         | Git history shows the broken target was renamed; destination still exists. |
| 0.95  | `case-mismatch`      | Same parent directory; basename differs only by case.                      |
| 0.95  | `fragment-case`      | Heading fragment matches exactly one heading case-insensitively.           |
| 0.90  | `unique-basename`    | Exactly one file in scope has the broken target's basename.                |
| 0.50  | `ambiguous-basename` | Multiple basename candidates — surfaced ranked, not applied.               |
| 0.50  | `ambiguous-fragment` | Multiple case-insensitive fragment matches — surfaced, not applied.        |

To pull in lower-confidence repairs, pass
`--min-confidence 0.5` (or any float). Anything below the
chosen threshold stays in `broken.md` / `suggestions.json`
for human review.

### Human-in-the-loop override (`suggestions.fixed.json`)

When the script can't pick — multi-candidate ambiguity, fragment
typos with no clean case-fix, broken links with no candidates at
all — disambiguate by copying the suggestions artifact and
editing scores:

```bash
cp .agents/tmp/markdown-check-link/suggestions.json \
   .agents/tmp/markdown-check-link/suggestions.fixed.json
# Edit suggestions.fixed.json: bump the right candidate's
# "score" to 1.0 (or ≥ --min-confidence), add a new
# suggestion entry if none of the heuristic options were right.
python3 .agents/skills/markdown-check-link/scripts/check_links.py --dry-run
python3 .agents/skills/markdown-check-link/scripts/check_links.py --fix
```

How it works:

- The override file is **opt-in** — missing → no-op, silent.
- Schema matches `suggestions.json` exactly (you copied it).
- For each `(file, line, target)` present in the override file,
  the heuristic `suggestions` list is **replaced** wholesale.
  Anything not in the override file keeps its heuristic
  suggestions.
- The normal apply path still runs: top suggestion ≥
  `--min-confidence` AND no rival tied at that score → applied.
- Stale entries (matching no currently-broken link) produce a
  stderr warning but don't block the run.
- The file is gitignored — treat it as a personal scratch pad
  for the current audit, not a checked-in artifact.

#### `resolution` field — demote instead of repoint

Sometimes the right answer isn't a different target — the link
points at something that no longer exists anywhere, but the
path/identifier is still useful as a prose reference. Set
`"resolution": "unlink"` on the override entry to rewrite
`[text](target)` as `` `target` ``:

```json
{
  "file": ".agents/plan/cycles/Round_18.md",
  "line": 268,
  "kind": "inline",
  "text": "auto-memory note on this exact failure mode",
  "target": "../../../../.claude/projects/.../feedback_round_cadence.md",
  "resolution": "unlink",
  "suggestions": []
}
```

When `resolution` is set, it takes precedence over `suggestions[]`
— you either repoint or demote, not both. Syntax is `<kind>` or
`<kind>:<value>`. Known kinds:

| Value             | When applied          | Effect                                                                                                                        |
| ----------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `null`            | —                     | Default. Fall through to `suggestions[]`.                                                                                     |
| `"as-is"`         | **every run**         | Mark the link correct; flip status `broken` → `ok`. Use when the checker is wrong (e.g. `path.md:25` line-suffix convention). |
| `"as-is:<note>"`  | every run             | Same, with an audit note (free text after the colon). Surfaces in `links.json`.                                               |
| `"unlink"`        | `--fix` / `--dry-run` | Rewrite `[text](target)` as `` `target` `` (broken URL becomes code-span).                                                    |
| `"unlink:<text>"` | `--fix` / `--dry-run` | Rewrite as `` `<text>` `` — substitute any code-span content.                                                                 |
| `"link"`          | `--fix` / `--dry-run` | Repoint to `#` (TODO marker for later).                                                                                       |
| `"link:<target>"` | `--fix` / `--dry-run` | Repoint to `<target>` (one-line shortcut for filling in `suggestions`).                                                       |

`as-is` is the only resolution that takes effect outside fix mode — it's a _verifier-time_ decision ("this isn't broken"), so it needs to suppress the report and the nonzero exit code on every run. The others are _fixer-time_ decisions and only matter when you're actually rewriting markdown.

Examples:

```json
{ "resolution": "as-is" }                               // status broken → ok
{ "resolution": "as-is:filename:line convention" }      // ok + audit note
{ "resolution": "unlink" }                              // [t](broken) → `broken`
{ "resolution": "unlink:feedback_round_cadence" }       // [t](broken) → `feedback_round_cadence`
{ "resolution": "link" }                                // [t](broken) → [t](#)
{ "resolution": "link:#feedback_round_cadence" }        // [t](broken) → [t](#feedback_round_cadence)
{ "resolution": "link:../../other/file.md" }            // [t](broken) → [t](../../other/file.md)
```

Unsupported on `ref-def` links (the user-visible reference lives
elsewhere) and on code-span content / targets containing
backticks (CommonMark escaping isn't worth the corner case) —
warnings emit, the link stays broken.

After `--fix`, **re-run default mode** to confirm clean exit
before stopping. Idempotence is the correctness bar.

#### `--resolution <file>` — bulk repoint for merges / folds

`suggestions.fixed.json` is keyed by `(file, line, target)` — fine for a
handful of ambiguous links, impractical when **one moved/merged target** is
linked from dozens of places (e.g. a design-doc **fold**: `joins.md` +
`multi-join.md` + `query-builder.md` → `queries.md`). The `git-rename`
heuristic auto-follows a **1:1** rename, but an **N→1 merge** has no single
rename target, and merged anchors (`old.md#frag` → `new.md#other-frag`) can't
be inferred. `--resolution <file>` is the explicit, repo-wide bridge:

```bash
# map.json: { "<old-target>": "<new-repo-rel-target>", ... }
python3 .agents/skills/markdown-check-link/scripts/check_links.py --dry-run --resolution map.json
python3 .agents/skills/markdown-check-link/scripts/check_links.py --fix     --resolution map.json
```

- **Keys** match a broken link by `resolved-path#frag`, `basename#frag`,
  `resolved-path`, `basename`, or the raw target (most specific first), so one
  entry repoints every inbound link to that old anchor regardless of the
  relative path each source used.
- **Values** are the new target as a **repo-relative path from the repo root**
  (+ optional `#frag`); the per-source relative path is computed at apply time.
  A **file-only** value (no `#frag`) matched by a **file-only** key **preserves
  the link's original fragment** (`old.md#frag` → `new.md#frag`). A bare
  `"#frag"` value repoints the fragment only.
- It injects a `link:<computed>` resolution (reusing the table above), then the
  normal `--fix` path rewrites the URL. Records already carrying a
  `suggestions.fixed.json` resolution are left alone (that override wins).
- A map key matching no broken link emits a stderr warning (catch typos / a
  link already repointed). Malformed map → hard error (no silent no-op).

```json
{
  "query-builder.md#the-trajectory-what-queries-grows-into": ".agents/design/data-management/queries/queries.md#the-trajectory-what-queries-grows-into",
  "joins.md": ".agents/design/data-management/queries/queries.md#joins-reading-related-datasets-as-one"
}
```

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
