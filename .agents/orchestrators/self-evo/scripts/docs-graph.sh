#!/usr/bin/env bash
# Dispatcher for the docs-graph subcommand. Mirrors self-evo.sh: ensures
# the dist/ build is fresh and copies the static web assets into place
# before forwarding the call to the compiled CLI.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
CLI_ENTRY="$PKG_DIR/dist/docs-graph/cli.js"
WEB_SRC="$PKG_DIR/src/docs-graph/web"
WEB_DEST="$PKG_DIR/dist/docs-graph/web"

ensure_built() {
  if [[ ! -f "$CLI_ENTRY" ]]; then
    echo "[docs-graph] dist/docs-graph/cli.js missing — running pnpm build" >&2
    (cd "$PKG_DIR" && pnpm run build >/dev/null)
  elif [[ -n "$(find "$PKG_DIR/src" -name '*.ts' -newer "$CLI_ENTRY" -print -quit 2>/dev/null)" ]]; then
    echo "[docs-graph] src/ newer than dist — rebuilding" >&2
    (cd "$PKG_DIR" && pnpm run build >/dev/null)
  fi
  # Static web assets — tsc ignores them, so mirror manually.
  mkdir -p "$WEB_DEST"
  cp -f "$WEB_SRC/"*.html "$WEB_SRC/"*.js "$WEB_SRC/"*.css "$WEB_DEST/"
}

ensure_built
exec node "$CLI_ENTRY" "$@"
