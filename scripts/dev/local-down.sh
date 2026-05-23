#!/usr/bin/env bash
# Stop the local dev stack started by local-up.sh.
# Reads tmp/dev/pid/*.pid, sends SIGTERM then SIGKILL after grace,
# cleans up orphan uvicorn/vite processes via pkill as a fallback.

set -euo pipefail

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
source "$DEV_DIR/_lib.sh"

stop_pid_file() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"
  if [[ ! -f "$pid_file" ]]; then
    warn "no pid file for $name (already stopped?)"
    return 0
  fi
  local pid
  pid="$(cat "$pid_file" 2>/dev/null || echo "")"
  if [[ -z "$pid" ]]; then
    warn "empty pid file for $name; removing"
    rm -f "$pid_file"
    return 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    say "stopping $name (PID $pid) ..."
    kill -TERM "$pid" 2>/dev/null || true
    sleep 1
    if kill -0 "$pid" 2>/dev/null; then
      warn "$name (PID $pid) didn't respond to TERM, sending KILL"
      kill -KILL "$pid" 2>/dev/null || true
    fi
    ok "$name stopped"
  else
    warn "$name pid $pid not running (stale pid file)"
  fi
  rm -f "$pid_file"
}

stop_pid_file backend
stop_pid_file builder

# Fallback: kill orphan processes by their actual binary paths.
# Patterns are chosen to be specific enough that unrelated shells
# (curl, pgrep, IDE searches) won't be matched.
ORPHAN_UVICORN_PATTERN='\.venv/bin/uvicorn'
# Match the actual vite binary path. pnpm's .bin shim makes the path
# look like .../node_modules/.bin/../vite/bin/vite.js, so anchor on
# vite/bin/vite — specific enough to avoid grep/curl false matches.
ORPHAN_VITE_PATTERN='vite/bin/vite'

if pgrep -f "$ORPHAN_UVICORN_PATTERN" >/dev/null 2>&1; then
  warn "cleaning up orphan uvicorn processes"
  pkill -f "$ORPHAN_UVICORN_PATTERN" 2>/dev/null || true
fi

if pgrep -f "$ORPHAN_VITE_PATTERN" >/dev/null 2>&1; then
  warn "cleaning up orphan vite processes"
  pkill -f "$ORPHAN_VITE_PATTERN" 2>/dev/null || true
fi

ok "dev stack stopped"
