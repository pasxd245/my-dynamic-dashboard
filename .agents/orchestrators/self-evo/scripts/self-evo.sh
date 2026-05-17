#!/usr/bin/env bash
# Dispatcher for @self/orchestrator. Wraps `node dist/cli.js` so callers
# do `scripts/self-evo.sh round "topic"` without remembering the path.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
CLI_ENTRY="$PKG_DIR/dist/cli.js"

ensure_built() {
  if [[ ! -f "$CLI_ENTRY" ]]; then
    echo "[self-evo] dist/cli.js missing — running pnpm build" >&2
    (cd "$PKG_DIR" && pnpm run build >/dev/null)
    return
  fi
  # Stale-build detection: if any .ts under src/ is newer than the
  # compiled entrypoint, rebuild. Cheap (one find call) and avoids the
  # silent "old graph runs" failure we hit on the first real round.
  if [[ -n "$(find "$PKG_DIR/src" -name '*.ts' -newer "$CLI_ENTRY" -print -quit 2>/dev/null)" ]]; then
    echo "[self-evo] src/ newer than dist/cli.js — rebuilding" >&2
    (cd "$PKG_DIR" && pnpm run build >/dev/null)
  fi
}

ensure_built
exec node "$CLI_ENTRY" "$@"
