#!/usr/bin/env bash
# Start the local dev stack (backend on :8000, builder on :3000).
# Backgrounds both apps, persists PIDs to tmp/dev/pid/, logs to
# tmp/dev/log/, and waits until both endpoints respond before
# returning. Run `bash scripts/dev/local-down.sh` to stop.

set -euo pipefail

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
source "$DEV_DIR/_lib.sh"

mkdirs

if ! require_deps; then
  exit 1
fi

# Refuse to start if anything is already running or ports are taken.
if is_running "$PID_DIR/backend.pid"; then
  err "backend already running (PID $(cat "$PID_DIR/backend.pid")); run 'pnpm dev:local:down' first"
  exit 1
fi
if is_running "$PID_DIR/builder.pid"; then
  err "builder already running (PID $(cat "$PID_DIR/builder.pid")); run 'pnpm dev:local:down' first"
  exit 1
fi
if port_is_listening 8000; then
  err ":8000 is already in use; kill the offending process or run 'pnpm dev:local:down'"
  exit 1
fi
if port_is_listening 3000; then
  err ":3000 is already in use; kill the offending process or run 'pnpm dev:local:down'"
  exit 1
fi

# Clean up any stale (process-already-dead) pid files.
rm -f "$PID_DIR/backend.pid" "$PID_DIR/builder.pid"

say "starting backend (uv + uvicorn on :8000) ..."
cd "$REPO_ROOT/workspace/apps/backend"
nohup uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 \
  > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_DIR/backend.pid"

say "starting builder (pnpm vite on :3000) ..."
cd "$REPO_ROOT"
nohup pnpm --filter builder dev \
  > "$LOG_DIR/builder.log" 2>&1 &
BUILDER_PID=$!
echo "$BUILDER_PID" > "$PID_DIR/builder.pid"

# Both started in parallel; wait for both endpoints in series.
say "waiting for backend at http://127.0.0.1:8000/health ..."
if wait_for_url "http://127.0.0.1:8000/health" 30; then
  ok "backend up (PID $BACKEND_PID)"
else
  err "backend did not respond within 30s — check $LOG_DIR/backend.log"
  exit 1
fi

say "waiting for builder at http://127.0.0.1:3000 ..."
if wait_for_url "http://127.0.0.1:3000" 30; then
  ok "builder up (PID $BUILDER_PID)"
else
  err "builder did not respond within 30s — check $LOG_DIR/builder.log"
  exit 1
fi

printf '\n'
ok "dev stack is up"
printf '  backend:  http://127.0.0.1:8000  (log: %s)\n' "$LOG_DIR/backend.log"
printf '  builder:  http://127.0.0.1:3000  (log: %s)\n' "$LOG_DIR/builder.log"
printf '\nStop with: pnpm dev:local:down\n'
