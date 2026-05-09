#!/usr/bin/env bash
set -euo pipefail

: "${ROLLBACK_TARGET_BUNDLE:?ROLLBACK_TARGET_BUNDLE is required}"

echo "rollback_started bundle=$ROLLBACK_TARGET_BUNDLE"
# Preserve current data/backups and only recreate runtime containers.
docker compose -f docker-compose.prod.yml up -d --no-deps backend builder dashboard

echo "rollback_finished bundle=$ROLLBACK_TARGET_BUNDLE"
