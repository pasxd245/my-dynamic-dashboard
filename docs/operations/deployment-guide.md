# Deployment Guide (Spec 006)

## Prerequisites

1. Linux host (or WSL2 for staging verification).
2. Docker CE with Compose plugin.
3. Repo clone with `.env` created from `.env.example`.
4. Writable backup paths: `BACKUP_DIR` and `BACKUP_EXTERNAL_DIR`.

## First-Time Setup

1. Validate compose and env files:
   - `scripts/ops/validate-production-config.sh`
2. Start production stack:
   - `docker compose -f docker-compose.prod.yml up -d --build`
3. Validate baseline health:
   - `curl -s http://localhost:8000/health`
   - `curl -s http://localhost:3000/health`
   - `curl -s "http://localhost:8501/?healthcheck=1"`

## Upgrade Flow

1. Export release variables:
   - `export RELEASE_BUNDLE_ID=<release-id>`
   - `export BACKEND_IMAGE=<image:tag>`
   - `export BUILDER_IMAGE=<image:tag>`
   - `export DASHBOARD_IMAGE=<image:tag>`
2. Run release deploy script:
   - `scripts/ops/deploy-release.sh`
3. Verify health checks and startup logs.

## Validation Gates

1. Gate A: compose config and env validation pass.
2. Gate B: backend `/health` returns healthy with dependency details.
3. Gate C: builder and dashboard probes return healthy.
4. Gate D: backup + restore drill completes with evidence.
5. Gate E: non-author operator can execute this guide without ad-hoc steps.
