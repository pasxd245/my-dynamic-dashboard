#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="$ROOT_DIR/tmp/dev"
mkdir -p "$STATE_DIR"

BACKEND_PID_FILE="$STATE_DIR/backend.pid"
BUILDER_PID_FILE="$STATE_DIR/builder.pid"
DASHBOARD_PID_FILE="$STATE_DIR/dashboard.pid"

log() {
  printf '[dev-stack] %s\n' "$1"
}

is_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

start_local() {
  log "Starting local backend (:8000), builder (:3000), dashboard (:8501)"

  if [[ -f "$BACKEND_PID_FILE" ]] && is_running "$(cat "$BACKEND_PID_FILE")"; then
    log "Backend already running (pid $(cat "$BACKEND_PID_FILE"))"
  else
    nohup bash -lc "cd '$ROOT_DIR' && source .venv/bin/activate && PYTHONPATH=apps/backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" \
      >"$STATE_DIR/backend.log" 2>&1 &
    echo "$!" >"$BACKEND_PID_FILE"
    log "Started backend (pid $!)"
  fi

  if [[ -f "$BUILDER_PID_FILE" ]] && is_running "$(cat "$BUILDER_PID_FILE")"; then
    log "Builder already running (pid $(cat "$BUILDER_PID_FILE"))"
  else
    nohup bash -lc "cd '$ROOT_DIR/apps/builder' && pnpm dev -- --host 0.0.0.0 --port 3000" \
      >"$STATE_DIR/builder.log" 2>&1 &
    echo "$!" >"$BUILDER_PID_FILE"
    log "Started builder (pid $!)"
  fi

  if [[ -f "$DASHBOARD_PID_FILE" ]] && is_running "$(cat "$DASHBOARD_PID_FILE")"; then
    log "Dashboard already running (pid $(cat "$DASHBOARD_PID_FILE"))"
  else
    nohup bash -lc "cd '$ROOT_DIR/apps/dashboard' && source '$ROOT_DIR/.venv/bin/activate' && DASHBOARD_API_BASE_URL=http://localhost:8000 streamlit run streamlit_app.py --server.port 8501" \
      >"$STATE_DIR/dashboard.log" 2>&1 &
    echo "$!" >"$DASHBOARD_PID_FILE"
    log "Started dashboard (pid $!)"
  fi

  log "Local URLs: backend=http://localhost:8000 | builder=http://localhost:3000 | dashboard=http://localhost:8501"
  log "Logs in $STATE_DIR"
}

stop_local() {
  log "Stopping local services"

  for svc in backend builder dashboard; do
    pid_file="$STATE_DIR/${svc}.pid"
    if [[ -f "$pid_file" ]]; then
      pid="$(cat "$pid_file")"
      if is_running "$pid"; then
        kill "$pid" || true
        log "Stopped $svc (pid $pid)"
      fi
      rm -f "$pid_file"
    fi
  done

  pkill -f "uvicorn app.main:app" || true
  pkill -f "vite --host 0.0.0.0 --port 3000" || true
  pkill -f "node .*vite\.js.*--host 0\.0\.0\.0.*--port 3000" || true
  pkill -f "streamlit run streamlit_app.py" || true
}

up_docker() {
  log "Starting Docker dev stack from devops/compose.yaml"
  (cd "$ROOT_DIR/devops" && docker compose up -d --build)
  log "Docker URLs: backend=http://localhost:8000 | builder=http://localhost:3000 | dashboard=http://localhost:8501"
}

down_docker() {
  log "Stopping Docker dev stack"
  (cd "$ROOT_DIR/devops" && docker compose down)
}

status_all() {
  log "Port status"
  lsof -i :8000 -i :3000 -i :8501 2>/dev/null || true
  log "Health checks"
  curl -s http://localhost:8000/health || true
  printf '\n'
}

case "${1:-}" in
  local-up)
    start_local
    ;;
  local-down)
    stop_local
    ;;
  docker-up)
    up_docker
    ;;
  docker-down)
    down_docker
    ;;
  stop-all)
    stop_local
    down_docker
    ;;
  status)
    status_all
    ;;
  *)
    cat <<'EOF'
Usage: scripts/dev/stack.sh <command>

Commands:
  local-up     Start backend + builder + dashboard in local dev mode
  local-down   Stop local dev services
  docker-up    Start Docker dev stack (devops/compose.yaml)
  docker-down  Stop Docker dev stack
  stop-all     Stop local services and Docker stack
  status       Show port and backend health status
EOF
    exit 1
    ;;
esac
