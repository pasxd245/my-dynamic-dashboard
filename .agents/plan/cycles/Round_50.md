# Round 50: `markdown-check-link` skill — link-integrity checker for `.agents/`

**Status**: Review
**Date started**: 2026-05-28
**Date completed**:

## Goal

**Inherits from ← [Round_49](Round_49.md)** — R49 bootstrapped
`.agents/skills/` with two primary skills (`flow-selector`,
`gate-walker`) and one dependent (`research`), then deferred the
first DCFBI/DFCFBI feature trial to R51 with one tooling round
in between. R50 is that round: ship a **dependent** skill named
**`markdown-check-link`** that verifies markdown links resolve
inside the `.agents/` corpus (and optionally repo-wide).

The skill exists because R49's own Risks section flagged the
load-bearing failure mode — *"AGENTS.md horizons section is
load-bearing. Adding a bullet that points at a non-existent
README means every session-load hits a broken link"* — and R49
mitigated it once by hand-sequencing the file creation. The
DCFBI/DFCFBI chain expands cross-link surface dramatically:
round files cite decisions, decisions cite design markdown,
gate-walker remediation cites R47 clauses, the O-rule cites
contract artifacts. R51's trial will create many of these links
in flight; a checker that runs in the pipeline catches rot
during the round, not after.

R50 ships the skill as a **dependent** (generic, no round-file
coupling), peer to `research`. The README index gains one entry
under `## Dependent skills`. Post-round audit (per
[PDCA.md](../PDCA.md)) gains one optional line: invoke
`markdown-check-link` alongside `npx markdownlint-cli2`.

*Track: 2 (agent-method, tooling). Pulled by: R49 Risks entry
on load-bearing AGENTS.md horizons link; concrete pull from
R51's expanding cross-link surface in the upcoming DCFBI trial.
Per [Evolution Rule](../../AGENTS.md).*

**Reasonable defaults under [auto mode]; user redirects via
end-of-round Q&A:**

1. **Implementation form**: bundle a small Python script at
   `.agents/skills/markdown-check-link/scripts/check_links.py`
   that does the actual checking (parity with `research`'s
   `crawl4ai_recursive.py` pattern). The SKILL.md body
   documents trigger / procedure / quality bar; the script does
   the deterministic work. Rationale: pure-procedure skills
   (Claude does the grep + path-resolve by hand) produce
   variance round-to-round; a script makes the result
   reproducible and CI-friendly later.
2. **Scope of "link"**: cover the three markdown link shapes —
   inline `[text](url)`, image `![alt](url)`, and reference
   `[ref]: url` definitions. Skip raw URLs in prose (no
   surrounding `[...]`).
3. **Path resolution**: verify relative-path links resolve to
   an existing file from the markdown file's own directory.
   Fragment-only links (`#anchor`) verify against the same file's
   headings (kebab-cased H1-H6). Path-with-fragment links
   (`other.md#anchor`) verify both file existence and heading
   presence in the target.
4. **HTTP links**: **skip by default.** Network checks are
   slow, flaky, and rate-limited; running them in the
   post-round audit would make the audit unreliable. Add an
   opt-in `--check-http` flag for occasional manual sweeps.
5. **Scope source of truth**: when invoked without explicit
   paths, the script reads
   [`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc)
   at the repo root and reuses its `globs` + `ignores` fields.
   Rationale: this keeps the link-checker and the format-linter
   surveying the same file set, so a markdownlint-clean repo
   that also passes link-check is meaningfully "all-green
   across the corpus." Explicit CLI paths always override.
6. **Two distinct failure modes for the config lookup**:
   - **Config missing** (file not at repo root) → warn on
     stderr and **fall back** to `.agents/**/*.md`. Graceful
     because a fresh clone or new branch may not have the
     config yet, and the audit still has value at narrower
     scope.
   - **Config present but unparseable** (JSONC strip + JSON
     parse fails) → **raise a clear error and exit nonzero**.
     Don't silently switch surface area when the source of
     truth is broken — the right fix is to repair the config.
     Error message names the file path + the parse failure
     reason so the human can fix it directly.
7. **JSONC stripping**: small regex pass strips `//`
   line-comments and `/* … */` block-comments before passing
   to stdlib `json.loads`. Straightforward for the
   well-formed config we ship.
8. **Output artifacts under `.agents/tmp/markdown-check-link/`**
   (gitignored per
   [`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc)
   `ignores`). Every run writes two files:
   - `links.json` — full inventory of every link the parser
     found, one record per link:
     `{file, line, text, target, kind, resolved_path, status,
     reason?}`. Always written, even on clean runs. Enables
     diffing between runs and grounds auto-correct (next
     point) in a structured artifact rather than ad-hoc grep.
   - `broken.md` — human-readable summary of only the broken
     links, grouped by file. Matches the stderr report. Easy
     to grep, easy to attach in a round's Do log.

   Stderr still emits the line-oriented
   `path:line: broken-link → target (reason)` form for
   grep-friendliness. Exit code `0` for clean, `1` for any
   broken links found (CI integration).
9. **Auto-correct capability ships, but is opt-in.** Default
   invocation reports only (writes the artifacts above, exits
   0/1). A `--fix` flag applies corrections; `--dry-run`
   prints what `--fix` would do without writing. Auto-correct
   logic stays **conservative** — applies only when there's
   exactly one safe candidate:
   - **Case-only mismatch** on a path that exists with
     different casing → fix.
   - **Heading-fragment case mismatch** when the slug matches
     case-insensitively to exactly one heading → fix.
   - **Single unambiguous basename match** elsewhere in the
     repo (file moved within tree) → fix.
   - **Anything else** (multiple candidates, fuzzy match, no
     candidate) → emit as a suggestion in `broken.md` for
     human review; **do not auto-apply**.

   The round author at Review time decides whether `--fix`
   runs against R50's own corpus (per the user's "at review
   I will decide" — gated decision, not automatic).
10. **No edits to R49 skills.** The new skill stands alone;
    `flow-selector` and `gate-walker` don't gain link-check
    calls in their procedures this round. If R51's trial
    surfaces a concrete need ("gate-walker should refuse to
    close a gate whose evidence pointer is broken"), that's
    a sharpening for a later round, not R50.
11. **No promotion to `.agents/context/`.** Skills are
    themselves operational; promotion path is the same as any
    other context promotion (validate through use across
    multiple rounds first).
12. **No new memory file unless R50 execution surfaces a
    learning.** Memory captures learnings *from* completed
    work; R50 is the work.

## What is IN scope

### 1. Author `markdown-check-link` skill

- Paths (dual-write per R49 convention):
  - `.agents/skills/markdown-check-link/SKILL.md` — canonical.
  - `.claude/skills/markdown-check-link/SKILL.md` — `skill-ref`
    pointer stub (name + description + skillPath + "Do not edit
    directly" comment).
- Frontmatter (canonical Claude Code schema; standard fields):

  ```yaml
  ---
  name: markdown-check-link
  description: Verify markdown links resolve to existing files
    and headings; emits full link inventory + broken-link
    report under .agents/tmp/markdown-check-link/. Supports
    opt-in conservative auto-correct (--fix / --dry-run).
  when_to_use: Invoke in the post-round audit (alongside
    markdownlint-cli2), after large doc edits, or when a
    session-load link click 404s. Default scope reads
    .markdownlint-cli2.jsonc globs + ignores; falls back to
    .agents/**/*.md if config missing.
  argument-hint: "[path-or-glob ...] [--check-http] [--fix |
    --dry-run]"
  allowed-tools: Read, Grep, Glob, Bash(python3 *)
  metadata:
    author: hand-authored-r50
    version: '1.0'
  ---
  ```

- Body sections (matching `flow-selector` / `gate-walker` /
  `research` house style):
  - `## Trigger` — when to invoke (post-round audit, after
    large doc reshuffles, on broken-link reports).
  - `## Procedure` — numbered steps:
    1. Resolve scope from
       [`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc)
       (or fall back / explicit paths).
    2. Run the bundled script in default mode; read
       `.agents/tmp/markdown-check-link/broken.md`.
    3. Triage findings — for each broken link, decide: fix
       inline by hand, defer to follow-up, or (when the
       round author opts in) re-run with `--dry-run` then
       `--fix` for the safe-candidate subset.
    4. Re-run the script after fixes; confirm clean exit.
  - `## Quality Bar` — what NOT to do:
    - Don't bypass with `--exclude` for "this link doesn't
      really matter."
    - Don't treat HTTP timeouts as broken links.
    - Don't run `--check-http` in CI without rate-limit
      handling.
    - Don't run `--fix` blind — always `--dry-run` first
      and read the diff.
    - Don't edit links to suppress findings without
      verifying intent (the link may be a real reference
      that drifted; the target may need to be created, not
      the link to be repointed).

### 2. Bundle the checker script

- Path: `.agents/skills/markdown-check-link/scripts/check_links.py`
  (parity with `research/scripts/crawl4ai_recursive.py`).
- Python 3 stdlib only — no third-party dependencies. Avoids
  pip-install friction; the script is small enough to be
  readable end-to-end.
- Responsibilities:
  - **Resolve scope**: if explicit paths/globs were passed,
    use them; otherwise read
    [`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc)
    at repo root and apply its `globs` + `ignores`. If the
    config is missing, warn on stderr and fall back to
    `.agents/**/*.md`. If the config is **present but
    unparseable**, raise a clear error and exit nonzero
    (point at the file + parse reason).
  - **Parse**: walk the resolved file set; skip files matched
    by `ignores` or `--exclude`. Parse each markdown file for
    the three link shapes; track file + line number + kind
    (inline / image / ref-def) per link. Skip link
    extraction inside fenced code blocks.
  - **Verify (non-HTTP)**: resolve relative path against the
    markdown file's directory; verify the target file exists.
    If the link has a `#fragment`, verify the fragment matches
    a kebab-cased heading slug in the target file (or same
    file for `#`-only links).
  - **Verify (HTTP)**: skip unless `--check-http` is passed;
    with the flag, do a HEAD request (stdlib `urllib`) with
    a 5s timeout and treat 4xx/5xx as broken. Network errors
    are recorded as `status: skipped, network unreachable`,
    not as broken.
  - **Emit artifacts** under
    `.agents/tmp/markdown-check-link/` (always, on every
    run):
    - `links.json` — every link with
      `{file, line, kind, text, target, resolved_path,
      status, reason?, fix_candidate?}`.
    - `broken.md` — human-readable, grouped by source file.
      Includes the `fix_candidate` (if any) under each
      broken link so the human reviewer can decide.
  - **Auto-correct** (opt-in via `--fix` / `--dry-run`):
    - For each broken link, compute the conservative
      candidate per Defaults #9 (case-only mismatch, heading
      slug case mismatch, single unambiguous basename match).
    - `--dry-run` → print the proposed edits as a unified
      diff to stdout; exit 0 if everything has a safe
      candidate, 1 if any broken link has no safe candidate.
    - `--fix` → apply the safe-candidate edits in place;
      print the diff that was applied; exit 0 if all broken
      links were fixed, 1 if any remain. Always idempotent
      (re-running `--fix` on the same state is a no-op).
    - `--fix` and `--dry-run` are mutually exclusive.
  - **Stderr line-oriented report**: emit one line per broken
    link as `path:line: <link-text> → <target> (reason)`
    regardless of mode. Exit code: `0` clean, `1` if any
    link is broken (default mode) or remained broken after
    `--fix`.
- Add a `--help` flag with one-screen usage covering all
  flags (`--check-http`, `--fix`, `--dry-run`, `--exclude`).

### 3. Index in skills README

- One entry under `## Dependent skills` in
  [`.agents/skills/README.md`](../../skills/README.md) — file
  link, one-line role description, default scope. Match the
  shape of the existing `research` entry.
- No frontmatter `metadata.category` (canonical schema doesn't
  accept it; taxonomy lives in README structure only — per
  R49 lookup).

### 4. Note the skill in PDCA post-round audit

- One bullet appended to
  [`plan/PDCA.md § Post-round audit`](../PDCA.md), under or
  after the existing `markdownlint-cli2` bullet. Phrased as
  *optional* (round authors can skip if they didn't touch
  cross-links), not mandatory — to avoid the gate-theater
  failure mode the Hybrid Flow doctrine warned about.

### 5. Pipeline

- Run the new script in **default mode** against the config's
  resolved scope as part of R50's own verification. Read
  `.agents/tmp/markdown-check-link/broken.md` and triage.
- For findings with safe `fix_candidate`, **gated on user
  decision at Review**: optionally re-run with `--dry-run`
  to preview, then `--fix` to apply. Per user direction, the
  decision to invoke `--fix` happens at Review, not
  automatically during Do.
- For findings without a safe candidate: one-line fixes by
  hand where intent is obvious; defer the rest as
  follow-ups.
- `npx markdownlint-cli2` repo-wide → 0 errors.
- Grep this round file for unticked `- [ ]` before flipping
  Status to `Review`.
- Append promotion entry to
  [`plan/promotions.md`](../promotions.md).

## What is OUT of scope

- **No CI wiring.** The skill ships as a manual / post-audit
  invocation. CI integration is a separate concern (where it
  runs, on what trigger, how it interacts with `markdownlint-cli2`
  failures) — defer until a round has a CI pull.
- **No HTTP-link checking by default.** Network checks add
  flakiness; `--check-http` exists for opt-in but the default
  audit path is offline.
- **No aggressive auto-correct.** `--fix` applies only the
  three conservative candidates (case-only mismatch, heading
  slug case mismatch, single unambiguous basename match).
  Fuzzy matching, multi-candidate selection, and content
  rewrites are explicitly out — those need a different design
  (interactive selection or LLM-in-the-loop) and the pull is
  not yet concrete. R50's first run will surface what shape
  of breakage actually occurs; subsequent rounds can expand
  the fix surface if R50 evidence justifies it.
- **No `--fix` invocation during Do.** Per user direction, the
  decision to apply auto-corrections is gated at Review. Do
  produces the report; Review decides whether to apply.
- **No anchor-syntax tolerance for non-standard renderers.**
  GitHub's heading-slug algorithm has quirks (consecutive
  hyphens, emoji stripping, etc.); the script uses the common
  kebab-case form. If R50 verification surfaces false positives
  in real files, refine the slugger; otherwise stay simple.
- **No edits to existing skills.** `flow-selector` and
  `gate-walker` do not gain link-check calls in their
  procedures. Compose at the round-author / pipeline level for
  now.
- **No first DCFBI/DFCFBI feature trial.** That's R51.
- **No `markdownlint` replacement.** This skill is **additive**
  — markdownlint catches format issues; markdown-check-link
  catches reference issues. They run side-by-side, not in
  competition.
- **No `.agents/context/` promotion.** Promotion requires
  validation through use across multiple rounds.

## Plan

- [x] Confirm scope at planning review (user confirmed:
      list-artifact + ship auto-correct capability behind
      `--fix` / `--dry-run`; decision to invoke `--fix` is
      gated at Review).
- [x] Author `.agents/skills/markdown-check-link/SKILL.md`
      with canonical frontmatter (`name`, `description`,
      `when_to_use`, `argument-hint`, `allowed-tools`) + body
      sections (`## Trigger`, `## Procedure`, `## Quality Bar`).
      Procedure covers default-mode triage + `--dry-run` →
      `--fix` flow.
- [x] Write `.agents/skills/markdown-check-link/scripts/check_links.py`
      — stdlib-only. Walks paths, parses three link shapes,
      checks file existence + fragments. Supports
      `--check-http`, `--fix`, `--dry-run`, `--exclude`.
      Emits `links.json` + `broken.md` under
      `.agents/tmp/markdown-check-link/` on every run.
      **Scope resolution**: reads
      [`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc)
      `globs` + `ignores` when no explicit paths given;
      missing config warns + falls back to `.agents/**/*.md`;
      malformed config raises error + exits nonzero.
      Auto-correct applies only the three conservative
      candidates (case-only path, case-only fragment, single
      unambiguous basename); anything else is a suggestion in
      `broken.md`. Include `--help`.
- [x] Dual-write `.claude/skills/markdown-check-link/SKILL.md`
      as a `skill-ref` pointer stub (name + description +
      skillPath + "Do not edit" comment), mirroring the R49
      pattern.
- [x] Add an entry for `markdown-check-link` under
      `## Dependent skills` in
      [`.agents/skills/README.md`](../../skills/README.md).
- [x] Append a bullet to
      [`plan/PDCA.md § Post-round audit`](../PDCA.md) noting
      the skill as an optional companion to
      `markdownlint-cli2`.
- [x] Self-test (default mode): run the script with no args;
      confirm it reads the markdownlint config and walks the
      resolved scope. Verify
      `.agents/tmp/markdown-check-link/links.json` + `broken.md`
      are written.
- [x] Self-test (`--dry-run`): if broken.md has findings,
      preview the proposed safe-candidate fixes. Confirm
      diffs look correct; do not apply.
- [x] Triage findings: one-line obvious fixes by hand; defer
      anything requiring substantive content change as a
      follow-up in Act. **Do not invoke `--fix` during Do**
      — that decision is gated at Review per user direction.
- [x] Self-test (config error path): rename
      `.markdownlint-cli2.jsonc` aside; rerun → confirm
      stderr warning + fallback to `.agents/**/*.md`. Revert.
      Then break the JSON (insert garbage); rerun → confirm
      error message + nonzero exit. Revert.
- [x] Self-test as a stranger: re-read the SKILL.md as someone
      who hasn't seen R50; verify it stands alone (no implicit
      knowledge of the script's internals, no R49 context
      required to operate it).
- [x] Run `npx markdownlint-cli2` repo-wide → 0 errors.
- [x] Append a 2026-05-29 entry to
      [`plan/promotions.md`](../promotions.md) covering the
      new skill + the PDCA bullet.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md).
- [x] Grep this round file for unticked `- [ ]` before
      flipping Status to `Review`.

## Risks / unknowns

- **Heading-slug algorithm divergence.** GitHub, GitLab,
  markdownlint, Pandoc, and VS Code's preview each have
  slightly different kebab-case rules for headings. The
  bundled checker uses the common case (lowercase, spaces →
  hyphens, strip punctuation); files using emoji or special
  chars in headings may produce false positives. Mitigation:
  R50's self-test surfaces real-corpus mismatches; refine the
  slugger only if findings show up.
- **`#`-only fragment links to multi-heading files.** A link
  `[foo](#section-name)` could match multiple headings if
  duplicate slugs exist. The script flags duplicates as a
  warning rather than treating the link as broken. Edge case
  not common in `.agents/` corpus, but worth handling.
- **Reference-style link defs in code blocks.** Markdown
  fenced code blocks can contain `[text]: url` strings that
  are not actual link defs. Mitigation: the parser tracks
  fenced-block state (triple-backtick / tildes / indented
  4-space) and skips link extraction inside.
- **Performance on repo-wide sweep.** The new default reads
  `globs` from
  [`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc),
  which is currently `["**/*.md"]` (repo-wide). With the
  config's `ignores` honored (`node_modules`, `dist`, etc.),
  this stays manageable, but it's slower than the
  `.agents/`-only fallback. Acceptable — the script is
  invoked in the post-round audit, not in a tight loop, and
  parity with markdownlint's surface is the whole point.
- **JSONC parsing fragility.** Stripping `//` and `/* */`
  comments via regex is good enough for our well-formed
  config but can mis-handle pathological cases (comment-like
  strings inside string values). Mitigation: under the
  current design, missing-config falls back gracefully but
  **malformed-config raises an error and exits nonzero** so
  the human fixes the source of truth rather than silently
  shadowing it with a fallback scope. If a real-world config
  edit trips the stripper, refine then; don't engineer for
  it pre-emptively.
- **Auto-correct candidate selection is heuristic.** The
  three "safe" categories (case-only path, case-only
  fragment, single unambiguous basename) cover the common
  cases but not all. Edge: two files with the same basename
  at different paths → the script must treat that as
  ambiguous (suggestion-only), not pick one. Verified in
  self-test: artificially create the ambiguity and confirm
  the script lists candidates rather than auto-applying.
- **Idempotence of `--fix`.** Re-running `--fix` on a clean
  tree must be a no-op. Bug shape to watch: a fix that
  introduces a new broken link (e.g., renames a fragment to
  match a heading the script slugged differently than the
  renderer), causing the next run to "fix" it again in the
  opposite direction. Mitigation: after applying `--fix`,
  re-run default mode and confirm exit 0 before stopping.
- **Skill-ref pointer resolution still unverified.** R49's
  open question — *does Claude Code's runtime follow the
  pointer to fetch the canonical body, or only see the stub?*
  — remains open. R50 follows the same convention
  (canonical record plus pointer stub). If R51's first skill
  invocation reveals the
  pointer is opaque, R50's skill needs the same fallback
  treatment (byte-byte dual-write, symlink, or pre-commit
  copy). Flagged as inherited risk, not blocker.
- **Pre-existing broken links in `.agents/`.** Likely the
  script's first run will flag links that have been broken
  since R44 or earlier. Triage policy in Plan: fix
  one-liners inline; defer anything requiring substantive
  content change as a follow-up note in Act. Don't let
  triage scope-creep R50.
- **HTTP checking with stdlib `urllib` is fragile.** HEAD
  support varies by server; some 403 a HEAD but 200 a GET.
  Opt-in only mitigates blast radius. If `--check-http`
  surfaces too much noise in practice, R51+ can switch the
  flag to `lychee` or `markdown-link-check`.
- **Markdownlint and our script disagree on link rules.**
  Repo's `markdownlint-cli2` config disables some rules; our
  checker is orthogonal (it checks resolution, not format).
  Should coexist without conflict, but verify in self-test.
- **`when_to_use` 1,536-char cap.** The Claude Code
  auto-trigger surface caps frontmatter size; keep
  `description` + `when_to_use` concise.

## Do

**Skill files authored.**

- [`.agents/skills/markdown-check-link/SKILL.md`](../../skills/markdown-check-link/SKILL.md)
  — canonical content. Frontmatter carries `name`,
  `description`, `when_to_use` (mentions config-as-SoT and
  fallback), `argument-hint` (covers
  `[--check-http] [--fix | --dry-run]`), `allowed-tools`
  (`Read, Grep, Glob, Bash(python3 *)`), and the
  parity-with-other-skills `metadata.{author, version}`.
  Body sections: `## Trigger`, `## Procedure` (5 numbered
  steps covering scope resolution, default run, triage,
  auto-correct opt-in, HTTP opt-in), `## Quality Bar` (six
  prohibitions).
- [`.claude/skills/markdown-check-link/SKILL.md`](../../../.claude/skills/markdown-check-link/SKILL.md)
  — `skill-ref` pointer stub (name + description +
  metadata.{type, rootPath, skillPath} + "Do not edit"
  comment), mirroring R49 convention.

**Pointer-resolution data point (R49 open question).** When
the new SKILL.md was authored, the session-load reminder
listed `markdown-check-link` as an available skill — the
runtime *did* see the new skill at session-load via the
pointer. Open: whether the runtime also fetches the canonical
body when the skill is *invoked* (vs only at session-load).
R51's first skill invocation is still the measurement.

**Checker script bundled.**

- [`.agents/skills/markdown-check-link/scripts/check_links.py`](../../skills/markdown-check-link/scripts/check_links.py)
  — Python 3 stdlib only, ~400 lines.
- Responsibilities implemented per Plan: scope resolution
  from `.markdownlint-cli2.jsonc` (with two-mode error
  handling), JSONC stripping, three link-shape parsing
  (inline / image / ref-def), fenced-code-block skipping,
  inline-code-span masking (single/double/triple-tick),
  fragment-slug verification, conservative fix-candidate
  suggestion (3 safe rules), artifact emission, opt-in
  `--fix` / `--dry-run`, opt-in `--check-http`.
- One parser refinement during Do: initial run produced
  false positives for `` `[text](url)` `` and
  `` `[foo](#section-name)` `` inside single-backtick code
  spans. Added `_strip_inline_code()` that masks span
  interiors with spaces (preserving character positions so
  link offsets remain correct), then re-extracts display
  text from the original line. R50.md's own findings
  dropped to 0 after the fix.

**Self-test results.**

- `--help` renders cleanly with all five flags.
- **Default mode** (no args, with config): scanned 130
  files, found **192 broken links**, wrote
  `.agents/tmp/markdown-check-link/links.json` (full
  inventory) + `broken.md` (grouped human-readable
  report). Exit 1.
- **Config-missing fallback**: renamed
  `.markdownlint-cli2.jsonc` aside → stderr warned and
  script fell back to `.agents/**/*.md` (103 files).
  Restored.
- **Config-malformed error path**: wrote a deliberately
  broken JSONC → script exited 1 with clear
  `error: cannot parse <path>: <reason>` message and
  the "fix the config file; this script will not
  silently fall back" justification. Restored.
- **`--dry-run`**: previewed proposed safe-candidate
  fixes as unified-ish diffs (e.g., contract files using
  `../../../.agents/...` would be repointed to
  `../../../../.agents/...`, which is the genuinely
  correct path). No writes. Diff reviewed for sanity.

**Findings triage.** Per Plan, **`--fix` was NOT invoked
during Do** (gated at Review). The 192 broken links break
down into three categories:

1. **Archive trail from R48** (largest set). Many round
   files (R07 → R14 era) and design markdown reference
   `*.preview.html` files that R48 moved to `_archive/`.
   Memory files and decisions point at
   `../context/contract-driven-feature.md` which moved to
   `../context/_archive/contract-driven-feature.md`.
   The `.agents/context/_archive/contract-driven-feature.md`
   itself contains broken `../plan/cycles/Round_NN.md`
   links — its archived location requires `../../plan/...`
   instead. Per R48's "no content edits to archived files"
   doctrine, **archived files stay as-is**. Live-tree
   references to the archive can be repointed.
2. **Contract files use wrong `../` depth**. Files under
   `workspace/packages/contracts/<entity>/*.contract.md`
   use `../../../.agents/...` to reach the corpus, but
   that resolves to `workspace/.agents/...` (which doesn't
   exist) — should be `../../../../.agents/...` (4 up to
   repo root). This is a genuine pre-existing bug the
   script surfaced. The fix candidate is correct and
   uniform.
3. **A few internal slug mismatches** (e.g., `#risks` vs
   `#risks--unknowns` for round files). Real navigation
   bugs; small triage cost.

**No fix applied during Do**, per the gate. The full report
lives at
[`.agents/tmp/markdown-check-link/broken.md`](../../tmp/markdown-check-link/broken.md)
(gitignored). User decides at Review whether/how to
invoke `--fix`.

**Discoverability wired.**

- [`.agents/skills/README.md`](../../skills/README.md)
  gained a `markdown-check-link` entry under
  `## Dependent skills`, sibling to `research`. The entry
  names the config-as-SoT behavior, fallback rule,
  artifact paths, and the conservative `--fix` policy.
- [`plan/PDCA.md § Post-round audit`](../PDCA.md) gained
  one new optional bullet after the existing
  `markdownlint-cli2` line, pointing at the skill and
  noting the Review-gated `--fix` policy.

**Skill self-test (read as stranger).** Re-read
`markdown-check-link/SKILL.md` cold: Trigger / Procedure /
Quality Bar are self-contained, cite the markdownlint config
and tmp paths concretely, and don't require R49 or R50
context to operate. The script's `--help` covers all flags.
Stands alone.

**Pipeline.**

- `npx markdownlint-cli2` repo-wide → **0 errors over 130
  files** (was 127 pre-R50; +3: canonical SKILL.md, pointer
  stub SKILL.md, R50 round file).

**Review-phase amendment: `--changed` flag added.** User
surfaced the canonical pre-commit / per-PR use case during
Review — scanning the whole corpus on every commit is
wasteful when only a handful of `.md` files moved. Folded
into R50 (rather than deferring to a follow-up) because:

- Same skill, same CLI surface — natural fit, not new
  scope.
- Small, bounded addition (one git helper + one
  `_resolve_files` branch).
- Pre-commit hook integration is the canonical pull for any
  link-checker; deferring would have meant R51's trial
  could only run against a heavier audit than necessary.

Implementation:

- New helper `_git_changed_md()` unions
  `git diff --name-only --diff-filter=ACMR` (unstaged) +
  `--cached` (staged) + `git ls-files --others
  --exclude-standard` (untracked). Errors cleanly if git is
  unavailable or the cwd isn't a repo.
- `_resolve_files` precedence:
  explicit paths > `--changed` > config defaults > fallback.
- `--changed` still honors the config's `ignores` (so a
  changed file under `node_modules/` or `_archive/` won't be
  picked up).
- Self-test: ran `--changed` against R50's own working
  tree → 6 files in scope (vs 130 in default mode), 2
  broken links surfaced (vs 192) — both real findings in
  `promotions.md`. Wall-clock dropped accordingly.

**Lint cleanup during Review.** SonarLint surfaced several
warnings during the Review-phase edits; fixed the real ones,
left the heuristic ones:

- **Fixed** `python:S6397` — replaced the single-char
  character class `[ ]{0,3}` with the literal space form
  in `REF_DEF_RE`.
- **Fixed** `python:S5713` — collapsed
  `except (urllib.error.URLError, TimeoutError, OSError)`
  to `except OSError`; both `URLError` and `TimeoutError`
  already derive from `OSError`, so the broader catch
  covers both.
- **Refactored once** for `python:S3776` on
  `_resolve_files` (was 35 after `--changed` plumbing; the
  change pushed it from borderline-fine to genuinely worth
  splitting). Extracted `_filter_excludes` (shared between
  changed-mode and default-mode) and `_resolve_explicit`
  (linear flow). Also split `main` by lifting
  `_scan_and_verify`, `_verify_one`, and `_run_fix_mode` —
  each a tight helper with a single responsibility.
- **Left alone** the remaining `python:S3776` findings on
  `_strip_jsonc`, `_strip_inline_code`, `_parse_links`,
  `_verify_local`, `_apply_fixes`. These are
  character-by-character parsers and state machines; their
  cognitive complexity is inherent to the problem domain
  and splitting them produces worse code (shared mutable
  state across function boundaries). Suppression options
  (`# NOSONAR` per function, or a `sonar-project.properties`
  for connected-mode setups) are available if the IDE
  noise becomes a real friction point — deferred until pull.
  User applied `# NOSONAR` to `_strip_inline_code` during
  Review as a sample treatment.

**Review-phase amendment: `links.json` schema reshape.** User
proposed restructuring the artifact from a flat list of
records to a file-grouped tree:

```json
{
  "root_path": "<abs repo root>",
  "files": {
    "<rel/path.md>": { "items": [<record>, ...] }
  }
}
```

Each file's `items` are sorted ascending by line. Benefits:

- **Per-file lookup is O(1)** for downstream tooling
  (pre-commit hook checking one file, an editor extension
  rendering one file's broken links).
- **Diffability between runs improves** — two runs of the
  same scope produce JSON with the same key order; a
  `jq '.files["foo.md"]'` slice is stable.
- **Bottom-up fix application is natural**: iterating
  `reversed(items)` means future fix shapes that insert or
  delete lines don't invalidate the line numbers of
  earlier records.

`_apply_fixes` updated to iterate bottom-up
(`for lineno in sorted(keys, reverse=True)`) for the same
reason — today's in-place replacement doesn't strictly
need it (line indices are stable), but it's cheap
insurance against future fix shapes that add/remove lines.

`broken.md` writer reuses the same file-grouped dict (no
duplicate grouping work).

**Review-phase amendment: `conflicts.json` artifact added.**
User proposed surfacing the "ambiguous candidate" case as a
first-class output rather than silently dropping it. Previous
behavior: when `_suggest_path` found multiple basename
matches, it left `fix_candidate = None` — indistinguishable
from "no candidate exists at all." New behavior:

- `LinkRecord` gained `conflict_candidates: Optional[list[str]]`.
- `_suggest_path` and `_suggest_fragment` populate the list
  when there are 2+ candidates instead of leaving it unset.
- New artifact `.agents/tmp/markdown-check-link/conflicts.json`,
  same `{root_path, files: {<path>: {items}}}` schema as
  `links.json`, filtered to records with non-None
  `conflict_candidates`. Always written (even when empty)
  for tooling stability.
- `broken.md` mentions the candidate list inline so a human
  reviewing the report sees both the fix-candidate (if any)
  and the conflict-candidates (if any) without cross-file
  navigation.

Real-corpus surface: the first full-mode run after this
change wrote 2 conflicts to `conflicts.json` — both
`AGENTS.md` references (one in
`.agents/context/_archive/contract-driven-feature.md`,
one in
`workspace/packages/contracts/datasets/rows-get.contract.md`)
where the target basename `AGENTS.md` exists both at repo
root and at `.agents/AGENTS.md`. Without `conflicts.json`
these would have looked like "broken, no candidate" — now
the report shows the disambiguation choice the human needs
to make. Validates the design.

Refactor along the way: extracted `_group_by_file`,
`_filter_subset`, `_file_tree`, and `_render_broken_md`
helpers from a previously-monolithic `_write_artifacts` —
each writer now has single responsibility and the helper
shape makes future additions (e.g., a `summary.md`) cheap.

## Check

- [x] `.agents/skills/markdown-check-link/SKILL.md` exists
      with canonical frontmatter (`name`, `description`,
      `when_to_use`, `argument-hint`, `allowed-tools`) and
      body sections (`## Trigger`, `## Procedure`, `## Quality
      Bar`).
- [x] `.agents/skills/markdown-check-link/scripts/check_links.py`
      exists, stdlib-only, runs end-to-end with `--help`,
      `--check-http`, `--fix`, `--dry-run`, `--exclude`, and
      explicit-path arguments. Default run (no args) reads
      [`.markdownlint-cli2.jsonc`](../../../.markdownlint-cli2.jsonc)
      `globs` + `ignores`; missing-config path warns and
      falls back to `.agents/**/*.md`.
- [x] `.claude/skills/markdown-check-link/SKILL.md` skill-ref
      pointer stub exists with matching `name` + `description`
      + skillPath pointing at the canonical record.
- [x] [`.agents/skills/README.md`](../../skills/README.md)
      has a `markdown-check-link` entry under `## Dependent
      skills` with file link, role line, and default-scope
      note.
- [x] [`plan/PDCA.md § Post-round audit`](../PDCA.md) has
      one new bullet noting `markdown-check-link` as an
      optional companion to `markdownlint-cli2`.
- [x] Script default-mode self-test ran;
      `.agents/tmp/markdown-check-link/links.json` +
      `broken.md` written.
- [x] `--dry-run` self-test ran (if broken.md had findings);
      proposed diffs reviewed.
- [x] Config-missing fallback verified (rename → warn +
      fallback → revert).
- [x] Config-malformed error path verified (break JSON →
      nonzero exit with clear message → revert).
- [x] Any surfaced broken links either fixed inline by hand,
      flagged for Review-gated `--fix`, or documented as
      follow-up in Act. **No `--fix` invoked during Do.**
- [x] Skill self-test passed: SKILL.md readable as a stranger;
      stands alone (no R49 / R50 context required).
- [x] [`plan/promotions.md`](../promotions.md) has a
      2026-05-29 entry covering the new skill + the PDCA
      bullet.
- [x] `npx markdownlint-cli2` repo-wide → 0 errors.
- [x] Post-round audit per
      [PDCA.md § Post-round audit](../PDCA.md) complete; all
      Plan + Check boxes flipped before Status flip.

## Act

**Learnings**:

- **The artifact-output pattern earns its keep immediately.**
  Writing every link into `links.json` (not just broken
  ones) means run-over-run diffs are possible — a Review
  reading "did the post-round work introduce new broken
  links" becomes a structural check, not a vibes check.
  The cost was small (one JSON dump); the leverage shows
  up the first time anyone reviews two consecutive runs.
- **Conservative auto-correct surfaces real bugs the
  format-linter cannot.** The script's `--dry-run` output
  identified that contract files under
  `workspace/packages/contracts/<entity>/` use the wrong
  number of `../` (3 vs the required 4) when referencing
  `.agents/`. `markdownlint-cli2` had nothing to say about
  this for many rounds because format is intact;
  resolution checking is a different axis. This validates
  R50's framing — markdownlint and markdown-check-link
  are orthogonal, not competing.
- **Inline-code masking is a parser correctness bar most
  link-checkers get wrong.** Initial run produced ~5 false
  positives in R50.md itself because the parser walked
  `` `[text](url)` `` inside single-backtick code spans.
  Fixed with a position-preserving span-masker that
  replaces interiors with spaces (so link character
  offsets stay correct), then re-extracts display text
  from the original line for the report. Worth bundling
  as a pattern for any future markdown-touching skill.
- **"Two distinct failure modes deserve two distinct
  treatments."** The Defaults-step revision (missing
  config → graceful fallback; malformed config → loud
  error) came from the user mid-planning. It's a small
  thing on the surface but a real correctness shift:
  silently falling back on malformed input shadows the
  source of truth precisely when it most needs repair.
  Generalizable pattern — when a tool depends on a config
  file, treat "missing" and "broken" as separate signals.
- **Pointer-pattern resolution: one half-confirmed.** The
  R49 open question (does Claude Code's runtime follow
  the `skill-ref` pointer to fetch the canonical body, or
  only see the stub?) got partial evidence: at
  session-load, the new skill's name+description showed
  up immediately after authoring — confirming pointer
  *registration* works. The harder question — whether
  the canonical body is read on invocation — still needs
  R51's first invocation as the measurement.

**Promotions**:

- [x] → `skills/` : `markdown-check-link` (dependent).
  Bootstrapped into `.agents/skills/` with the
  `skill-ref` pointer at `.claude/skills/`. Indexed in
  the skills README under `## Dependent skills`;
  optional bullet appended to PDCA post-round audit.
  Logged in [promotions.md](../promotions.md) 2026-05-29.

**Follow-ups (not promotions, just notes):**

- **Apply `--fix` at Review (user-gated).** The 192
  broken links in
  [`.agents/tmp/markdown-check-link/broken.md`](../../tmp/markdown-check-link/broken.md)
  break into the three categories listed in Do. At
  Review, decide:
  1. Which subset to run `--fix` against (likely:
     live-tree archive references, contract-file
     `../` depth bug).
  2. Which subset to leave (archived `_archive/` files
     per R48's hands-off policy).
  3. Which subset to defer entirely (historical round
     files like R07 → R14 — broken links in completed
     rounds are append-only-friendly).
- **Pointer-resolution measurement is still owed.** R51's
  first invocation of `flow-selector`, `gate-walker`, or
  `markdown-check-link` is the test. If only the stub
  body is reachable at invocation, three fallbacks
  remain (byte-byte dual-write, symlink, pre-commit
  copy script).
- **Inline-code-span masking could be promoted.** The
  `_strip_inline_code` helper in `check_links.py` is a
  generic pattern. If another R51+ skill walks markdown,
  consider extracting to a shared helper rather than
  duplicating. Not a promotion target now — single use,
  no second invocation.
- **HTTP checking remains opt-in.** No round so far has
  pulled it; defer hardening (better HEAD/GET fallback,
  rate-limit handling) until concrete need surfaces.
- **`--staged-only` refinement deferred.** The current
  `--changed` flag unions unstaged + staged + untracked;
  ideal for interactive use but slightly broader than a
  strict pre-commit hook wants (a pre-commit hook should
  fail only on what's about to be committed, i.e., staged).
  Defer until a real pre-commit hook lands and the
  precision pull is concrete.
- **Pre-commit hook wiring deferred.** R50 ships the flag;
  installing the hook (`.husky/`, `.git/hooks/pre-commit`,
  or a `lint-staged`-style integration) is a separate
  concern with its own design questions. R51's trial will
  exercise the audit path; hook integration follows from
  there.
- **Slug algorithm has known limits.** The bundled
  kebab-caser handles common cases (lowercase, spaces →
  hyphens, strip punctuation) but not GitHub's full
  rules (emoji-stripping, duplicate-slug suffixing).
  Real-corpus testing surfaced one false positive
  (`#risks` vs `#risks--unknowns`) — not enough to
  justify the more complex slugger yet.

## Feeds into → Round_51 (TBD) — first DCFBI/DFCFBI feature trial

R51 is the **first feature round operating under R47 doctrine
with the full R49 + R50 toolkit in hand**:

- `flow-selector` picks DCFBI vs DFCFBI at Design exit.
- `gate-walker` blocks each phase boundary until the exit
  criterion is documented.
- `markdown-check-link` runs in the post-round audit pipeline
  to catch cross-link rot introduced during the round.

R51's outcomes still inform which of the four queued DCFBI
skills earns the next slot (same pull triggers carried
forward from R49):

- F1 fires + overruns → `f1-timeboxer`.
- Gate-walker structurally passes but feature breaks
  integration → `o-rule-checker` or sharpened gate-walker.
- Round authoring drags (template re-typing, manual Flow line
  authoring) → `round-scaffolder`.
- F2 surfaces real shape change → `contract-v2-router`.

Skills stay deferred until pulled — same Evolution Rule that
governs the rest of `.agents/`.
