---
name: design-sync
description: Re-sync a domain's design docs to the ACTUAL implementation (the code is the source of truth), then compact them to current-state only. Emits a doc↔code drift report and rewrites each doc to match what is really built, dropping the round-by-round ledger. Run per domain folder under .agents/design/<domain>/.
when_to_use: A domain's design docs have drifted from the shipped code (stale field names, vanished/added routes, surfaces that moved, behaviour frozen at an old round, deferred items that have since shipped), or a build round changed code without updating the design. Trigger phrases include "sync the design", "is the design in sync with the code", "the design docs are stale", "re-sync <domain>", "compact <domain>".
argument-hint: <design-domain-dir> (e.g. .agents/design/data-management/workspaces)
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, Agent
metadata:
  author: hand-authored-r81
  version: '1.0'
---

## What this skill does

Design docs are **source code, not history**: each should state only the **current
state** of the part-of-app it describes. Over rounds they drift two ways — they fall
**behind the implementation** (the code changed; the doc didn't) and they **accrete a
ledger** (round-stamps, test counts, "shipped RNN", as-built deltas, HIxAI Q&A tables,
lifecycle sections). This skill re-syncs one **domain** (a folder under
[`.agents/design/`](../../design/)) to the real code and strips the ledger.

**The code is the source of truth.** Old design docs are *hints* about intent and
rationale — they are never trusted for facts (field names, routes, error codes,
surfaces). When the doc and the code disagree, the code wins and the doc is corrected.

This is the **primary** axis: doc↔code sync. De-fragmenting round-by-round doc sprawl
(merging redundant docs) is a **secondary** clean-up that happens only where a single
concept has split across files (§ 5).

## The keep / delete boundary (apply to every line)

One test: **"would this line still be written if the screen were built fresh today,
knowing nothing of how we got here?"**

- **KEEP** — the current surface-declaration table, the current layout / behaviour /
  state spec, the current token map, the current data contract (matched to code), the
  scope boundary, **and the living rationale that explains *why the current shape is the
  way it is*** (an explanatory comment a fresh reader needs), de-attributed.
- **DELETE → git / rounds / memory already own it** — dated round-stamps (`R30 stamp`,
  `shipped R24–R26`), test counts (`54/54 tests pass`), per-round decision attribution
  (`R23 HIxAI Q1`, "locked R11"), the round-by-round implementation-chain narration,
  "as-built deltas" / "reconciled RNN" blockquotes, HIxAI Q&A tables, the Lifecycle
  section, and any **superseded intermediate state** (e.g. "R13 ships in-memory; real
  persistence is R14+" once persistence shipped; "linear chain" once a tree shipped).

## Procedure

### 1. Inventory the domain + locate its code

Read every `*.md` under `$ARGUMENTS` (the `design/<domain>` dir). For each doc, find the
**corresponding implementation**: the backend routers / models / migrations, the
`*.contract.yaml` pairs, and the frontend feature folder
(`apps/builder/src/features/<domain>/…`). The design README mirrors the feature layout,
so the mapping is usually name-for-name; verify, don't assume.

### 2. Build the CODE TRUTH map (the source of truth)

Read the **actual code** and extract, per concept:

- **Routes** — every endpoint: method, path, request-body field names (exact), success
  status + response shape, **every** error status + error `code`. Quote real identifiers.
- **Model / schema** — persisted columns (names, types, constraints, uniqueness, cascade),
  the ORM reality (e.g. SQLModel for DDL but raw `sqlite3` in handlers), and whether
  migrations exist. Note where wire (camelCase) and DB (snake_case) names differ.
- **Frontend** — the actual pages, components (and **where** they live — `@mdd/ui` vs
  feature-local), TanStack hooks (names, query keys, invalidations), TS types, and the UI
  affordances actually present.
- **Cross-links** — how this domain references the others in code (FKs, cascades, routes).
- **Field-name inventory** — a flat list of exact identifiers, so a doc can be checked
  word-for-word against reality.

For a large domain, delegate this read to a subagent (`Agent`) so the raw code stays out
of context and you keep the structured map. Tell it: *read the real code, trust no design
doc, quote exact identifiers, flag anything half-migrated or inconsistent across
contract/backend/frontend.*

### 3. Diff → drift report

For each doc, diff its claims against the CODE TRUTH map. Record every gap as
**doc says X / code does Y**, categorised: stale field name; vanished / added route or
error code; surface that moved (e.g. `@mdd/ui` → feature-local); behaviour frozen at an
old round; a "deferred" item that has since shipped; a resolved "open question". Write
the drift report into the invoking round's Do log (or `.agents/tmp/design-sync/`) — it is
the auditable evidence that the sync happened and what changed.

### 4. Reconcile each doc to the code

Rewrite each doc to the CODE TRUTH, applying the keep/delete boundary. The result reads as
documentation of the **current** app: present-tense spec, real identifiers, real routes
and error codes, real component homes — plus the living rationale, de-attributed. No
ledger. Keep the design-doc format conventions (status header · surface-declaration table
with the canonical Reusability/Purity tokens · token map citing
[`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts) · scope boundary ·
acceptance criteria) — see the [design README](../../design/README.md).

### 5. De-fragment (only if a concept has split)

If one concept has spread across **≥3 docs** (round-by-round accretion), merge them
**spine-first**: establish the canonical **noun/model** doc first, then fold the
verb/surface (mode) docs onto it; do **not** start from the newest doc (it is usually a
leaf mode and forces re-deriving the model — rework). A genuine mode keeps its own doc
only if folding it into the spine would push the spine past readability.

**Merge → redirect stub, not deletion, when locked round files link the merged path.**
A merged-away doc is referenced by `Complete` (append-only) round files; replace it with a
short **redirect stub** pointing at the spine's section, rather than deleting it and
breaking locked history. Live design docs that link it are repointed directly.

### 6. Repair links + gate

- Run [`markdown-check-link --fix`](../markdown-check-link/SKILL.md) for moved/merged
  paths; repoint live inbound links.
- Gate green before declaring done: `pnpm design:lint` 0, `pnpm design:tokens` 0,
  `npx markdownlint-cli2` 0, `markdown-check-link` 0.
- Verify the highest-risk current-state claim per doc once more against the code (the
  spot-check that catches a reconciliation error).

## Brake — does this skill earn its place?

The skill counters a **named failure mode**: design docs silently drift from the
implementation and accrete a round-ledger, so the "intent-before-code" corpus stops
describing the code. It is **human-invoked, never an automatic sweep**. Its output is also
its own brake: once a domain is synced, the durable convention *design docs are source
code, not history* tells every future round to **re-sync / amend in place**, never append
a stamp — so a domain whose docs are kept current round-by-round does not need this skill.
The code being the source of truth bounds the skill: it reconciles to reality, it cannot
invent. Run it per `design/<domain>`; it generalises unchanged across domains.
