# `@mdd/contracts` — wire-shape contract package

The **authoritative** definition of HTTP wire shapes between the
[builder](../../apps/builder/) frontend and the
[backend](../../apps/backend/). One OpenAPI 3.1 YAML file per
endpoint; one paired Markdown file for the **rationale** — what
the endpoint means, how it behaves, what its errors imply,
worked examples.

## Why this package exists

R15 introduced a **4-round-per-feature methodology**:

```text
Design → Contract → Backend → Frontend
```

Each step is its own round. Each step is the smallest boundary
one autonomous agent could realistically execute. The contract
is the **unit of agent coordination**: two parallel agents (or
two future-Claude sessions) can implement BE and FE against the
same locked contract without integration debt.

See [Round_15](../../../.agents/plan/cycles/Round_15.md) for the
round that introduced this layer, and
[upload.md](../../../.agents/design/data-management/upload.md) /
[datasets.md](../../../.agents/design/data-management/datasets.md)
for the design docs the contracts implement.

## File layout

```text
packages/contracts/
├── README.md                                ← this file
├── package.json                             ← @mdd/contracts (private)
├── workspaces/
│   ├── get.contract.yaml                    ← OpenAPI: GET /workspaces
│   ├── get.contract.md                      ← rationale + behavior
│   ├── post.contract.yaml                   ← OpenAPI: POST /workspaces
│   └── post.contract.md
├── uploads/
│   ├── post.contract.{yaml,md}              ← POST /uploads (multipart)
│   └── parse.contract.{yaml,md}             ← POST /uploads/{temp_id}/parse
├── datasets/
│   ├── batch-post.contract.{yaml,md}        ← POST /workspaces/{id}/datasets/batch
│   └── get.contract.{yaml,md}               ← GET /datasets
├── _shared/                                 ← reusable schemas, $ref'd by endpoints
│   ├── workspace.yaml
│   ├── dataset.yaml
│   ├── column.yaml
│   ├── parse-options.yaml
│   ├── column-override.yaml
│   └── temp-upload.yaml
└── tests/
    └── openapi-validity.test.ts             ← validates every *.contract.yaml
```

## File conventions

- **One folder per URL segment** (`workspaces/`, `uploads/`,
  `datasets/`). Sub-routes (`uploads/{id}/parse`) live in the
  parent's folder with a verb-prefixed filename.
- **`<verb>.contract.yaml`** is the **authoritative** definition.
  Machines read this. OpenAPI 3.1 (JSON Schema 2020-12).
- **`<verb>.contract.md`** is the **rationale**. Humans (and AI
  reviewers) read this to understand _why_ the contract is
  shaped this way. It does **not** redefine the shape; it
  annotates it. Sections: Purpose · Behavior · Error semantics ·
  Examples · Cross-links.
- **`_shared/<name>.yaml`** holds cross-endpoint schemas as
  OpenAPI component fragments (`components.schemas.<Name>`).
  Endpoints reference them via
  `$ref: '../_shared/<name>.yaml#/components/schemas/<Name>'`.
- **No codegen yet.** BE writes Pydantic models matching the
  YAML by hand; FE writes TS types matching the YAML by hand.
  Codegen is the optimization that arrives when 3+ contracts
  exist and hand-alignment drifts.

## Adding a new contract

1. Pick the URL segment folder (create one if new).
2. Write `<verb>.contract.yaml` as a standalone OpenAPI 3.1 doc
   (top-level `openapi`, `info`, `paths`, optionally
   `components`). `$ref` shared types from `_shared/`.
3. Write `<verb>.contract.md` capturing: what this endpoint is
   for, behavioral semantics (idempotency, retry safety,
   ordering), each error response's meaning, ≥1 worked example,
   cross-links to the design doc + any related contracts.
4. Run `pnpm test` from this package. The validator dereferences
   `$ref`s and validates against the OpenAPI 3.1 spec.
5. If you added a new `_shared/` schema, ensure it's referenced
   by at least one endpoint (no dead schemas).

## What is NOT in this package (yet)

- **TS types / Pydantic models.** Implementations live in their
  respective apps (`apps/builder/src/api/types.ts`,
  `apps/backend/app/routers/<feature>.py`) and are hand-aligned
  to the YAML. Codegen lands when drift proves it's needed.
- **MSW handlers.** R15 deferred — they arrive in a later
  track-2 round paired with the FE consumer.
- **A composite whole-API `api.yaml`.** Each endpoint's YAML is
  standalone. A composite merger lands if/when Swagger UI or a
  similar tool justifies it.

## Running the validator

```bash
pnpm --filter @mdd/contracts test
```

Iterates every `*.contract.yaml`, dereferences `$ref`s via
[`@apidevtools/swagger-parser`](https://github.com/APIDevTools/swagger-parser),
and asserts each is a valid OpenAPI 3.1 document. Catches:
malformed YAML, broken refs, missing required keys, schemas
that don't validate against the OpenAPI meta-schema.

What the validator does **not** catch (deliberately deferred —
see [Round_15](../../../.agents/plan/cycles/Round_15.md)):

- Sample-payload validation (the `.md` examples are not yet
  cross-checked against the `.yaml` schema)
- BE response conformance (R16 adds this)
- FE request conformance (R17 adds this)
