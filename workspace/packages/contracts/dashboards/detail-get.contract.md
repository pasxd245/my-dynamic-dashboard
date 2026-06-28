# GET /dashboards/{id} — rationale

**Round**: R101 — dashboard-as-a-persisted-noun. **Design**:
[Round_101.md](../../../../.agents/plan/cycles/Round_101.md).

## What it is

Gets a single dashboard by its stable `dsh_` id. The id-keyed canonical read —
used to hydrate the FE cache after a create/update by the same stable key the
mutations use.

## Shape decisions

- **Id-keyed** (mirrors `GET /queries/{id}`). The slug is editable, so the
  stable id — not the slug — is the resource key for reads that pair with a
  mutation.
- The **URL-facing** detail route (`/dashboards/<ws_id>/<slug>`) resolves the
  slug → dashboard from the workspace's dashboard list (`get.contract.yaml`),
  which the FE loads for the nav anyway; this id-keyed read is the canonical
  resource read used to hydrate after a create/update.

## Errors

- `404 not_found` — no dashboard with that id (deleted / never existed).
