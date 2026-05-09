#!/usr/bin/env bash
set -euo pipefail

: "${ROLLBACK_TARGET_BUNDLE:?ROLLBACK_TARGET_BUNDLE is required}"

COMPOSE_PROD_FILE="${COMPOSE_PROD_FILE:-devops/compose.prod.yml}"

echo "rollback_started bundle=$ROLLBACK_TARGET_BUNDLE"
# Preserve current data/backups and only recreate runtime containers.
docker compose -f "$COMPOSE_PROD_FILE" up -d --no-deps backend builder dashboard

echo "rollback_finished bundle=$ROLLBACK_TARGET_BUNDLE"
