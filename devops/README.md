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

Builder workflow smoke placeholder command:

```bash
pnpm dev:builder:smoke
```

## Metadata DB bootstrap guidance

Feature 008 moves metadata schema ownership to Alembic migrations plus SQLModel metadata while keeping the backend service layer on raw `sqlite3` access in this round.

- Normal backend startup runs the migration bootstrap automatically.
- Existing metadata DB files without `alembic_version` are expected to follow the locked auto-stamp-then-upgrade path.
- Do not apply ad hoc schema SQL to recover legacy databases.

One-off migration command in the backend container:

```bash
cd devops
docker compose run --rm -e METADATA_DB_PATH=/app/data/metadata.dev.db backend alembic upgrade head
```

Metadata reset flow for disposable environments:

```bash
cd devops
docker compose run --rm -e METADATA_DB_PATH=/app/data/metadata.dev.db backend sh -lc 'rm -f /app/data/metadata.dev.db && alembic upgrade head'
```

Operator note: the checked-in `compose.yaml` does not set `METADATA_DB_PATH` or mount a dedicated metadata volume by default. Use a compose override or explicit `docker compose run -e ...` invocation when you need a non-default metadata DB path inside containers.
