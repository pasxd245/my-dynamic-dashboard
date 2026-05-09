# DevOps

Canonical container orchestration files live here.

| File               | Purpose                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `compose.yaml`     | Local container stack for development (Docker default — no `-f` flag needed) |
| `compose.prod.yml` | Single-host production stack for Spec 006                                    |

Run production operations through scripts in `scripts/ops/` so compose paths
and operator defaults stay centralized:

```bash
pnpm prod:validate
scripts/ops/deploy-release.sh
scripts/ops/rollback-release.sh
```

Direct compose commands are still supported when needed:

```bash
cd devops && docker compose up -d --build              # dev (uses compose.yaml)
docker compose -f devops/compose.prod.yml config       # prod
```
