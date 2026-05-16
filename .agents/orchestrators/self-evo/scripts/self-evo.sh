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
  fi
}

ensure_built
exec node "$CLI_ENTRY" "$@"
