#!/usr/bin/env bash
set -euo pipefail

: "${RELEASE_BUNDLE_ID:?RELEASE_BUNDLE_ID is required}"
: "${BACKEND_IMAGE:?BACKEND_IMAGE is required}"
: "${BUILDER_IMAGE:?BUILDER_IMAGE is required}"
: "${DASHBOARD_IMAGE:?DASHBOARD_IMAGE is required}"

validate_immutable_ref() {
  local image_ref="$1"
  if [[ "$image_ref" != *":"* ]]; then
    echo "image ref must include tag: $image_ref" >&2
    exit 1
  fi
}

validate_immutable_ref "$BACKEND_IMAGE"
validate_immutable_ref "$BUILDER_IMAGE"
validate_immutable_ref "$DASHBOARD_IMAGE"

COMPOSE_PROD_FILE="${COMPOSE_PROD_FILE:-devops/compose.prod.yml}"

echo "deployment_started bundle=$RELEASE_BUNDLE_ID"
docker compose -f "$COMPOSE_PROD_FILE" pull || true
docker compose -f "$COMPOSE_PROD_FILE" up -d --remove-orphans

echo "deployment_finished bundle=$RELEASE_BUNDLE_ID"
