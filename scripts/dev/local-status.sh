#!/usr/bin/env bash
# Show status of the local dev stack: per-app pid, port, log path,
# and the last few log lines.

set -euo pipefail

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./_lib.sh
source "$DEV_DIR/_lib.sh"

show_status() {
  local name="$1"
  local port="$2"
  local pid_file="$PID_DIR/${name}.pid"
  local log_file="$LOG_DIR/${name}.log"

  printf '%b%s%b\n' "$C_BOLD" "$name" "$C_RESET"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || echo "")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      printf '  pid:  %s (running)\n' "$pid"
    elif [[ -n "$pid" ]]; then
      printf '  pid:  %s (stale — process not running)\n' "$pid"
    else
      printf '  pid:  (empty pid file)\n'
    fi
  else
    printf '  pid:  (no pid file)\n'
  fi

  if port_is_listening "$port"; then
    printf '  port: %s (listening)\n' "$port"
  else
    printf '  port: %s (not listening)\n' "$port"
  fi

  if [[ -f "$log_file" ]]; then
    printf '  log:  %s\n' "$log_file"
    printf '  tail (last 3 lines):\n'
    tail -n 3 "$log_file" 2>/dev/null | sed 's/^/    /' || true
  else
    printf '  log:  (no log file)\n'
  fi
  printf '\n'
}

show_status backend 8000
show_status builder 3000
