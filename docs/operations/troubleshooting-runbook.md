# Troubleshooting Runbook (Spec 006)

## Health Degradation

1. Check backend health payload: `curl -s http://localhost:8000/health`.
2. Inspect service status: `docker compose -f docker-compose.prod.yml ps`.
3. Review last 200 log lines per service:
   - `docker compose -f docker-compose.prod.yml logs --tail=200 backend`

## Startup Loop

1. Confirm env contract values in `.env`.
2. Run `scripts/ops/validate-production-config.sh`.
3. Verify required paths are writable (`/app/data`, backup dirs).

## Disk Pressure

1. Check free space: `df -h`.
2. Prune stale backups except latest valid.
3. Rotate logs and verify `logrotate-production.conf` policy is active.

## Incident Evidence Checklist

1. Health snapshots (before/after).
2. Relevant logs with correlation ID.
3. Backup/restore artifact IDs and timestamps.
4. Actions taken with UTC times.
