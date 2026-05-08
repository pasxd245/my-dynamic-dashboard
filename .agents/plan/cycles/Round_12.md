# Round 12: Deployment

**Status**: Deferred
**Date started**:
**Date completed**:
**MVP**: 2
**DoD tasks**: 12.1–12.8
**Canonical state**: Branch `001-upload-profile-field-roles` (US1-US3 complete, MVP1 gates pending)

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

**Context**: Production deployment round. Follows Polish gate (Round 11). Containerizes backend (FastAPI), builder (Vite/React), and dashboard (Streamlit) for cloud/on-prem deployment.

## Check

- [ ] `docker compose -f docker-compose.prod.yml up` starts all services
- [ ] Health check endpoints respond
- [ ] Data survives `docker compose down && docker compose up`
- [ ] Backup script runs without errors
- [ ] Services accessible via URL from another machine
- [ ] User accesses dashboard and runs a report
- [ ] System runs 24 hours without manual intervention

## Act

## **Learnings**

**Operations**: Containerization enables repeatable deployment and scaling. Health checks + restart policies + data mounts ensure production reliability.

**Promotions**:

- [ ] → context/ :
- [ ] → skills/ :
