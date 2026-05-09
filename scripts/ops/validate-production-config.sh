#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f docker-compose.prod.yml ]]; then
  echo "missing docker-compose.prod.yml" >&2
  exit 1
fi

if [[ ! -f .env.example ]]; then
  echo "missing .env.example" >&2
  exit 1
fi

docker compose -f docker-compose.prod.yml config >/dev/null

echo "production config validation passed"
