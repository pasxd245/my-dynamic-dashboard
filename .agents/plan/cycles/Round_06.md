# Round 06: Root dev-experience scripts — `scripts/dev/local-*`

**Status**: Complete
**Date started**: 2026-05-23
**Date completed**: 2026-05-23

## Goal

**Inherits from ← [Round_05](Round_05.md)** — codified PDCA process
(Round Template, Status Lifecycle, Post-round Audit, Governance
revisability, Appending rule); memory placement rule in
`.agents/context/`. R06 follows the new template directly and stays
strictly within single-feature scope.

Add **root-level dev-experience scripts** so a contributor (or
agent) can boot both apps with one command and stop them cleanly.
Today the dev loop requires two terminals and manual cd commands.

Specifically: shell scripts under [scripts/dev/](../../../scripts/dev/)
that start, stop, and report status of the local dev stack
(backend + builder); root `package.json` scripts that call them;
plus a few static-check scripts (`md:lint`, `format`,
`format:check`) wired to existing dev-deps.

*Track: 2 (agent-method / dev experience). Pulled by: R01 follow-up
(md:lint wiring), R03 follow-up (concurrent dev startup). Per
[Evolution Rule](../../../AGENTS.md), both pulls are documented in
predecessor rounds.*

## What is IN scope

- `scripts/dev/_lib.sh` — shared helpers: repo-root resolution,
  PID/log directory setup, colored echo, "wait until URL responds"
  helper.
- `scripts/dev/local-up.sh` — start backend (`uv run uvicorn` on
  :8000) + builder (`pnpm --filter builder dev` on :3000) in
  background; persist PIDs to `tmp/dev/pid/`; logs to
  `tmp/dev/log/`; wait until both endpoints respond 200 before
  returning success.
- `scripts/dev/local-down.sh` — read PID files, kill processes,
  remove PID files. Falls back to `pkill -f` patterns if the
  PIDs are stale.
- `scripts/dev/local-status.sh` — show whether each app is up
  (PID file + port listening + recent log tail).
- Root `package.json` script additions:
  - `dev:local:up` → `bash scripts/dev/local-up.sh`
  - `dev:local:down` → `bash scripts/dev/local-down.sh`
  - `dev:local:status` → `bash scripts/dev/local-status.sh`
  - `dev` → `pnpm run dev:local:up` (ergonomic alias)
  - `md:lint` → `markdownlint-cli2` (no longer via `npx --yes`)
  - `format` → `prettier --write "**/*.md"`
  - `format:check` → `prettier --check "**/*.md"`
- Root `README.md` — add a Quickstart section:
  `pnpm install` → `pnpm dev` → open `localhost:3000`.
- Update root `.gitignore` if `tmp/dev/` needs explicit coverage
  (currently `tmp/` is ignored, so this is implicit — verify).

## What is OUT of scope (explicit deferrals)

- **Docker / docker-compose scripts.** Not needed yet; the script
  architecture leaves room (`scripts/dev/docker-up.sh` slot is
  reserved). Add when docker actually arrives.
- **Husky / lint-staged / pre-commit hooks.** Queued as R07
  candidate; deferred until benefit-vs-friction is genuinely
  felt.
- **Recursive `pnpm -r test` meta-script.** Backend uses uv, not
  pnpm — needs a multi-stack solution. Defer until needed.
- **Codification of per-package script convention.** Per the
  "code stays honest, doc lies" decision from R05's tail
  discussion — accepted as session wisdom, no doc this round.
- **Prettier across non-markdown files.** Drifted repo limited
  prettier to `**/*.md`; we follow suit. TS/JSON formatting is
  handled by individual apps' own tooling (vite, prettier
  configs per package — none exist yet, none needed yet).
- **CI configuration.** Separate concern; whole different round.

## Plan

- [x] Create `scripts/dev/_lib.sh` with: `repo_root()`,
  `pid_dir()`, `log_dir()`, `mkdirs()`, `wait_for_url($url, $timeout_s)`,
  `say()` (colored echo), `is_running($pid_file)`.
- [x] Create `scripts/dev/local-up.sh`:
  - Source `_lib.sh`.
  - Start backend in background: `uv run uvicorn app.main:app
    --host 127.0.0.1 --port 8000 > <log>/backend.log 2>&1 &`,
    write PID to `<pid>/backend.pid`.
  - Start builder in background: `pnpm --filter builder dev >
    <log>/builder.log 2>&1 &`, write PID to `<pid>/builder.pid`.
  - `wait_for_url http://127.0.0.1:8000/health 30`
  - `wait_for_url http://127.0.0.1:3000 30`
  - Print final status table (URLs, log paths, stop command).
- [x] Create `scripts/dev/local-down.sh`:
  - Source `_lib.sh`.
  - For each PID file, `kill -TERM <pid>` then `kill -KILL` after
    grace; remove PID file.
  - Fallback: `pkill -f "uvicorn app.main:app"` and
    `pkill -f "vite"` to catch orphans.
- [x] Create `scripts/dev/local-status.sh`:
  - For each PID file: show PID, whether process is alive,
    whether port is listening (`ss -tlnp` or `lsof -i`), and
    the last few log lines.
- [x] Set executable bit on all `scripts/dev/*.sh` files.
- [x] Update root `package.json` with the 7 new scripts listed
  above.
- [x] Update root `README.md` (currently a placeholder) with a
  Quickstart section.
- [x] Run `pnpm install` if any dep changes occurred (none
  expected — `markdownlint-cli2` and `prettier` already in
  root devDeps).
- [x] Verify: each script executes correctly; root `pnpm dev`
  boots both apps; `pnpm dev:local:status` reports both up;
  `pnpm dev:local:down` cleanly stops both;
  `pnpm md:lint` / `format:check` work.

## Risks / unknowns

- **`pnpm dev` → `vite` spawn — PID cascade.** Killing pnpm's
  PID may not always cascade to the vite child cleanly. Mitigation:
  use process-group kill (`kill -- -<pgid>`) or fallback
  `pkill -f vite` in `local-down.sh`. Acceptable trade-off for
  R06 scope.
- **WSL2 vs Linux vs macOS portability.** Scripts use bash
  features and standard Unix tools (`kill`, `pkill`, `ss`/`lsof`).
  Should be portable across Linux + WSL; macOS may need `lsof`
  fallback if `ss` is unavailable. Will use `command -v` checks
  in `_lib.sh`.
- **Port collisions.** :8000 (backend) and :3000 (builder) are
  the defaults. If something else binds them, `local-up.sh`
  should detect and fail fast (not silently start a broken
  stack).
- **Background-process lifecycle on script termination.** If
  the user runs `local-up.sh` then closes the terminal, do the
  child processes survive? With `&` alone they receive SIGHUP on
  shell exit. We need `nohup` or `setsid` to detach properly.
  Will use `nohup` for portability.
- **First-run experience.** Quickstart in README assumes
  `pnpm install` has happened. Should the script auto-detect
  missing `node_modules` or missing `.venv` and run installs?
  Lean: yes, fail with a clear error pointing at the right
  install command rather than auto-installing (less magic).
- **No automated test for shell scripts.** Verification is the
  manual run + observe pattern, same as R03's "visual check"
  approach. Acceptable for a dev-experience round.

## Do

- Created [scripts/dev/_lib.sh](../../../scripts/dev/_lib.sh):
  shared helpers — `repo_root`, `PID_DIR`, `LOG_DIR`, `say`/`ok`/
  `warn`/`err` color helpers (no-op when stdout isn't a tty),
  `mkdirs`, `is_running`, `wait_for_url(url, timeout_s)`,
  `require_deps` (checks node_modules + backend `.venv`),
  `port_is_listening` (ss → lsof → netstat probe order).
- Created [scripts/dev/local-up.sh](../../../scripts/dev/local-up.sh):
  - `require_deps` + per-process `is_running` check + per-port
    `port_is_listening` check; refuses to start if anything would
    collide.
  - Starts backend with
    `nohup uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`,
    persists PID to `tmp/dev/pid/backend.pid`.
  - Starts builder with `nohup pnpm --filter builder dev`, persists
    PID to `tmp/dev/pid/builder.pid`.
  - Waits sequentially for `:8000/health` and `:3000` (30s timeout
    each) before declaring success; final status table with log
    paths + stop command.
- Created [scripts/dev/local-down.sh](../../../scripts/dev/local-down.sh):
  - Reads PID files, sends `TERM` then `KILL` after 1s grace,
    removes the file.
  - Fallback orphan cleanup via `pkill -f` with anchored patterns
    (`\.venv/bin/uvicorn`, `vite/bin/vite`). Tightened from the
    initial broader `vite` pattern after a test run revealed it
    matched any process with "vite" in its cmdline (including
    sibling verification shells).
- Created [scripts/dev/local-status.sh](../../../scripts/dev/local-status.sh):
  per-app PID + alive-check, port-listening probe, log tail (3
  lines).
- Set executable bit on all 4 scripts; `bash -n` syntax check clean.
- Updated [package.json](../../../package.json) with 7 new scripts:
  `dev`, `dev:local:up`, `dev:local:down`, `dev:local:status`,
  `md:lint`, `format`, `format:check`. (`markdownlint-cli2` and
  `prettier` already in devDeps — no `pnpm install` needed.)
- Rewrote [README.md](../../../README.md) (was a 1-line placeholder)
  with three-track summary, Quickstart (`pnpm install` →
  `uv sync` → `pnpm dev`), repo layout, and a Scripts cheat sheet.
- Updated [.prettierignore](../../../.prettierignore):
  - `**/.venv` — vendored Python deps (Prettier was discovering
    `LICENSE.md` files inside installed packages).
  - `**/.pytest_cache` — autogenerated.
  - `tmp` — PID/log scratch area.
  - `.agents/plan/cycles/Round_*.md` — PDCA round artifacts have
    their own discipline (markdownlint + Round Template); Prettier
    is not the right authority and Complete rounds are append-only.
- Ran `pnpm format` once across eligible files. Changes were purely
  whitespace: table-column alignment, `*italic*` → `_italic_`,
  code-fence quote-style. No content changes.
- **Mid-round scope correction:** the initial `pnpm format` run
  reformatted governance-protected files under `.agents/AGENTS.md`,
  `.agents/context/`, `.agents/plan/PDCA.md`,
  `.agents/plan/promotions.md`, and `.agents/prompts/`. Per
  [governance.md](../../context/governance.md), modifications to
  those paths require explicit human warning + authorization, which
  R06's scope did not have. Even cosmetic whitespace changes count
  as modifications. Resolution:
  - `git checkout HEAD --` on the 7 affected files to revert them
    to their R05-committed state.
  - Broadened `.prettierignore` to permanently exclude those paths
    (and `.agents/skills/`) — so a future `pnpm format` cannot
    silently bypass governance. Memory (`.agents/memory/`) stays
    Prettier-eligible since it's explicitly agent-writable.
  - Memory file changes (2 files) kept — governance explicitly
    allows agent writes to `.agents/memory/`.
  - Workspace README changes (builder + ui) kept — those are
    product code, not under `.agents/` governance.
- **Mid-round adjustment:** initial `pkill -f "vite"` orphan pattern
  was too broad — first end-to-end test killed a sibling
  verification shell because its cmdline contained "vite". Tightened
  to `vite/bin/vite` (matches the binary path even through pnpm's
  `.bin/..` shim) and re-tested cleanly.
- Verified locally (`pnpm dev:local:up` cycle):
  - `pnpm dev:local:status` (cold) → "no pid file, not listening,
    no log" for both apps.
  - `pnpm dev:local:up` → backend up in ~2s, builder up in ~2s,
    final table printed.
  - `curl /health` → `{"status":"ok","duckdb":"v1.1.3"}`;
    `curl :3000` → 200 with rendered Vite HTML.
  - `pnpm dev:local:status` (warm) → PIDs running, ports
    listening, log tails show uvicorn `INFO` lines and Vite
    `Local: http://localhost:3000/`.
  - `pnpm dev:local:up` (while stack is up) → refused with
    `backend already running (PID …); run 'pnpm dev:local:down' first`
    (collision guard works).
  - `pnpm dev:local:down` → both PID-based stops succeed; orphan
    cleanup catches the pnpm-spawned vite child cleanly; nothing
    left running on `pgrep '[u]vicorn'` / `pgrep '[v]ite/bin/vite'`.
  - `pnpm dev` (alias) → same behavior as `pnpm dev:local:up`.
  - `pnpm md:lint` → 37 files, 0 errors (now via the wired script,
    no more `npx --yes`).
  - `pnpm format:check` → "All matched files use Prettier code
    style!"

## Check

- [x] All 4 shell scripts have executable bit set and pass
      `bash -n` syntax check.
- [x] `pnpm dev:local:up` (and `pnpm dev` alias) starts both apps;
      `curl :8000/health` → 200 with duckdb version; `curl :3000`
      → 200 with Vite HTML.
- [x] `pnpm dev:local:status` reports both running with correct
      PIDs, ports, and log tails.
- [x] `pnpm dev:local:down` stops both via PID; orphan cleanup
      catches pnpm-spawned vite child; subsequent
      `pgrep '[u]vicorn app'` and `pgrep '[v]ite/bin/vite'` are
      empty.
- [x] Collision guard verified: running `pnpm dev:local:up` while
      stack is up returns a clear error and exit 1.
- [x] `pnpm md:lint` passes (37 files, 0 errors) — wired script,
      no more `npx --yes`.
- [x] `pnpm format:check` passes ("All matched files use Prettier
      code style"); `pnpm format` is idempotent on a clean tree.
- [x] Root README.md Quickstart section verified accurate by
      reading + cross-checking against the actual scripts.

## Act

**Status**: Complete (human-approved 2026-05-23). Per
[governance.md](../../context/governance.md), only humans move a
round to Complete.

**Learnings**:

- **`pkill -f` patterns are dangerously easy to over-broaden.**
  Initial `pkill -f "vite"` matched any process whose cmdline
  contained "vite" — including sibling verification shells. The
  collateral kill cost ~5 min of debugging. Lesson: always anchor
  pkill patterns to the actual binary path (`vite/bin/vite`,
  `\.venv/bin/uvicorn`), and verify by sending TERM via a tight
  pattern before promoting to KILL.
- **pnpm's `.bin/..` shim broke my first tightened pattern.**
  Vite's real cmdline is
  `node /repo/.../node_modules/.bin/../vite/bin/vite.js`. The
  `node_modules/vite/bin/vite` substring doesn't appear; only
  `vite/bin/vite` does. Worth remembering for any future pkill
  pattern targeting pnpm-spawned binaries.
- **Prettier's scope is bigger than expected.** `**/*.md` reaches
  into vendored Python wheels (`workspace/apps/backend/.venv/.../
  LICENSE.md`) and `.pytest_cache/README.md`. The `.prettierignore`
  needs explicit exclusions for `**/.venv` and `**/.pytest_cache`.
  Without them, format:check fails on files nobody owns.
- **Append-only meets Prettier: one-time normalization was OK.**
  R5 codified that Complete rounds are append-only. Prettier
  would have reformatted R01-R05. Resolution: exclude
  `.agents/plan/cycles/Round_*.md` from Prettier entirely — PDCA
  artifacts have their own discipline (markdownlint + Round
  Template), Prettier is not the right authority. This preserves
  R5's intent without needing a per-case exception.
- **`set -euo pipefail` + `((var++))` interaction is a real gotcha.**
  `((elapsed++))` returns the pre-increment value, so the first
  increment from `elapsed=0` exits 1 and kills the script under
  `set -e`. Used `((++elapsed))` (returns post-increment) to
  avoid it. Memory-worthy if a future bash round happens.
- **R5's PDCA template held up.** Inherits-from, Risks/unknowns,
  Promotions-as-plain-text, Feeds-into — all natural to write in
  R06 with zero manual structural decisions. The template did
  what it was supposed to do.
- **Governance gate caught a real overreach.** `pnpm format`
  silently touched 7 governance-protected files. R5's
  authorization didn't cover them. Caught at end-of-round review
  before commit, reverted cleanly, prettierignore broadened.
  Lesson for future: any `format`/`lint --fix`/codemod that walks
  a glob can cross governance boundaries without intent. The fix
  is structural (broader prettierignore), not procedural ("be
  careful next time" is not enforcement).

**Memories captured (in `.agents/memory/`):** none this round —
the gotchas above are useful but each is small enough that the
Round artifact and commit log can carry them. Re-evaluate if any
recurs.

**Promotions** *(decision: none this round)*:

- → `context/` : not yet — the script architecture
  (`scripts/dev/local-*` + reserved docker slots) is the candidate
  pattern, but until docker actually arrives and the slot proves
  itself, codifying it would just describe what's visible in
  `package.json` + `scripts/dev/`. See R5 tail discussion:
  "code stays honest, doc lies."
- → `skills/` : none expected.

**Follow-ups (not promotions, just notes):**

- **R07 candidate:** pre-commit hooks (husky + lint-staged) —
  was the alternative B+C path; user chose "not much value as of
  now." Re-open when friction surfaces (e.g., a CI run gets red
  on a check that pre-commit would have caught locally).
- **Docker arrival:** add `scripts/dev/docker-up.sh` /
  `docker-down.sh` siblings; root scripts gain `dev:docker:up` /
  `dev:docker:down`. The `pnpm dev` alias should stay pointing at
  local mode unless we explicitly want docker as default.
- **Recursive test/type-check meta-scripts** at root once a
  multi-stack runner is genuinely needed. Backend uses uv, JS
  packages use pnpm — a thin shell script would cover both.
- **`+`-prefix markdownlint gotcha bit again** at line 5 of the
  new README. Memory file
  [2026-05-22-markdownlint-plus-prefix-gotcha.md](../../memory/2026-05-22-markdownlint-plus-prefix-gotcha.md)
  exists but I walked into it anyway. Not a new fix, just an
  observation that the memory exists but doesn't prevent the
  error at write-time. A future linter integration or pre-write
  check might. Not urgent.

## Feeds into → Round_07 (TBD)

What R06 hands forward:

- **Single-command dev loop**: `pnpm dev` boots backend + builder,
  `pnpm dev:local:down` stops cleanly, `pnpm dev:local:status`
  introspects. Track-1 BIZ rounds inherit this as the dev-mode
  baseline; no more "two terminals + manual cd."
- **Reserved `scripts/dev/docker-*` slots**: when docker arrives,
  the script + `package.json` slot pattern composes — no
  restructure needed.
- **Static-check scripts wired**: `pnpm md:lint`, `pnpm format`,
  `pnpm format:check` are root-level. Pre-commit hooks (if R07
  goes for C) hook directly into these.
- **`.prettierignore` discipline**: PDCA round artifacts are
  explicitly Prettier-exempt; future rounds inherit this without
  needing re-litigation.
- **Quickstart in root README**: first-time-clone path
  documented. New contributors (human or agent) have a single
  entry point.
