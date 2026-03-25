# Round 12: Deployment

**Status**: Planning
**Date started**:
**Date completed**:
**MVP**: 2
**DoD tasks**: 12.1–12.8

## Goal

The system runs in production via Docker Compose. Data persists, services
auto-restart, and users access everything via URL.

## Plan

- [ ] Create production Dockerfiles with multi-stage builds (backend, builder, dashboard)
- [ ] Create `docker-compose.prod.yml` with health checks, restart policy, resource limits
- [ ] Document all environment variables in `.env.example`
- [ ] Verify data directory mounts persist across container restarts
- [ ] Create `scripts/backup.sh` for data directory
- [ ] Deploy to target environment (local server or cloud VM)
- [ ] Verify all three services accessible from another machine
- [ ] Monitor for 24 hours

## Do

_Progress log — update as work proceeds._

## Check

- [ ] `docker compose -f docker-compose.prod.yml up` starts all services
- [ ] Health check endpoints respond
- [ ] Data survives `docker compose down && docker compose up`
- [ ] Backup script runs without errors
- [ ] Services accessible via URL from another machine
- [ ] User accesses dashboard and runs a report
- [ ] System runs 24 hours without manual intervention

## Act

**Learnings**:
-

**Promotions**:
- [ ] → context/ :
- [ ] → skills/  :
