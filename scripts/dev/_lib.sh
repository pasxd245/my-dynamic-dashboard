#!/usr/bin/env bash
# Shared helpers for scripts/dev/local-*.sh — sourced, not executed.

# Resolve repo root from this file's location:
# scripts/dev/_lib.sh → ../.. → repo root.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PID_DIR="$REPO_ROOT/tmp/dev/pid"
LOG_DIR="$REPO_ROOT/tmp/dev/log"

if [[ -t 1 ]]; then
  C_RESET='\033[0m'
  C_GREEN='\033[32m'
  C_YELLOW='\033[33m'
  C_RED='\033[31m'
  C_BLUE='\033[34m'
  C_BOLD='\033[1m'
else
  C_RESET=''
  C_GREEN=''
  C_YELLOW=''
  C_RED=''
  C_BLUE=''
  C_BOLD=''
fi

say()  { printf '%b%s%b\n' "${C_BLUE}"  "$*" "${C_RESET}"; }
ok()   { printf '%b✓%b %s\n' "${C_GREEN}"  "${C_RESET}" "$*"; }
warn() { printf '%b!%b %s\n' "${C_YELLOW}" "${C_RESET}" "$*"; }
err()  { printf '%b✗%b %s\n' "${C_RED}"    "${C_RESET}" "$*" >&2; }

mkdirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file" 2>/dev/null)" || return 1
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

wait_for_url() {
  local url="$1"
  local timeout="${2:-30}"
  local elapsed=0
  while (( elapsed < timeout )); do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      return 0
    fi
    sleep 1
    ((++elapsed))
  done
  return 1
}

require_deps() {
  if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
    err "node_modules not found at repo root; run 'pnpm install' first"
    return 1
  fi
  if [[ ! -d "$REPO_ROOT/workspace/apps/backend/.venv" ]]; then
    err "workspace/apps/backend/.venv not found; run 'uv sync --extra test --extra dev' in workspace/apps/backend"
    return 1
  fi
  return 0
}

port_is_listening() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tln 2>/dev/null | awk '{print $4}' | grep -E ":${port}\$" >/dev/null
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  elif command -v netstat >/dev/null 2>&1; then
    netstat -tln 2>/dev/null | grep -E ":${port}[[:space:]]" >/dev/null
  else
    return 1
  fi
}
