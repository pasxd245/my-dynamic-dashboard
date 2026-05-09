#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_PROD_FILE="${COMPOSE_PROD_FILE:-devops/compose.prod.yml}"

if [[ ! -f "$COMPOSE_PROD_FILE" ]]; then
  echo "missing $COMPOSE_PROD_FILE" >&2
  exit 1
fi

if [[ ! -f .env.example ]]; then
  echo "missing .env.example" >&2
  exit 1
fi

docker compose -f "$COMPOSE_PROD_FILE" config >/dev/null

echo "production config validation passed"
