---
name: design-sync
description: Re-sync a domain's design docs to the ACTUAL implementation (the code is the source of truth), then compact them to current-state only. Emits a doc↔code drift report and rewrites each doc to match what is really built, dropping the round-by-round ledger. Run per domain folder under .agents/design/<domain>/. Two modes — `--check` detects drift and stamps an OUT-OF-SYNC marker on each drifted doc (no body rewrite); the default sync mode reconciles each doc to the code, compacts, and clears the marker.
when_to_use: A domain's design docs have drifted from the shipped code (stale field names, vanished/added routes, surfaces that moved, behaviour frozen at an old round, deferred items that have since shipped), or code in a domain changed without its design/<domain>/*.md being updated in the same round/commit (including cross-cutting ripple from an in-flow round), or a domain is about to be designed-on and its doc needs verifying first. Use --check to report drift without rewriting; default mode rewrites. Trigger phrases include "sync the design", "is the design in sync with the code", "the design docs are stale", "re-sync <domain>", "check <domain> for drift".
argument-hint: <design-domain-dir | design-doc.md> [--check] (e.g. .agents/design/data-management/workspaces)
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

## Triggers & modes

**Two modes.** `--check` runs steps 1–3 (CODE-TRUTH map → drift report) and **stamps the
out-of-sync marker** (§ Drift marker) on each drifted doc — then **stops**. It writes *only the
marker*, never the body, so it stays safe / idempotent / auto-runnable: this is the detection
surface. **sync** (default) runs steps 1–6 (check, then reconcile + compact + link-repair +
gate): it rewrites the body **and clears the marker**, and is **human-invoked**.

### Drift marker

When `--check` finds a doc drifted from code, it stamps a top-of-file banner (immediately after
the H1, before the Concept) — a **visible banner + a hidden sentinel** the tooling greps:

```markdown
> ⚠️ **OUT OF SYNC** — `design-sync --check` (<date>) found this doc has drifted from the
> implementation: **<N> claim(s) diverge from code**. See `.agents/tmp/design-sync/<domain>.md`.
> Re-sync before trusting or designing on it: run `design-sync <domain>`.
<!-- design-sync:out-of-sync domain=<domain> detected=<date> claims=<N> -->
```

- **Term is "OUT OF SYNC" (drifted)** — deliberately **not** "stale" (the product already uses
  `query_stale` / `relationship_stale` / a relationship's `status: stale` for *runtime* schema
  drift — reusing it collides) and **not** "obsolete" (which implies retire/replace; a drifted
  doc's surface still exists, the fix is re-sync, not delete).
- The marker is a **comment, not content** — `--check` writing it does not violate
  "never auto-rewrite" (the body is untouched). Matches the existing `*.target.md`
  TARGET-NOT-CURRENT banner pattern (top-of-file, visible at first scroll).
- **Idempotent**: a re-`--check` updates the date / claim count in place via the sentinel; it
  never stacks banners. **`sync` removes** both banner + sentinel as its final step (a synced doc
  carries no marker — its absence *is* the in-sync signal).

**When it runs:**

1. **Explicit invocation** — on a `design/<domain>` dir or a single `design/<domain>/*.md`. If
   the argument does **not** resolve to an existing design dir/doc, **do not guess and do not
   sync** — list the available domains/docs and ask which was meant.
2. **Code changed without the doc** (the real drift signal) — a change touched a domain's
   backend / contracts / frontend but **not** its `design/<domain>/*.md`. This is broader than
   "bypassed the DCFBI/DFCFBI flow": it also catches *in-flow* rounds whose cross-cutting edits
   (a field rename, a persistence-foundation round) ripple into **sibling / downstream** domains
   they never re-synced — the actual source of the workspaces/relationships drift. Run `--check`
   (in the [post-round audit](../../plan/PDCA.md#post-round-audit), or on demand); on confirmed
   drift a human runs sync. **Detect-and-suggest — never auto-rewrite** (the brake).
3. **Design-gate pre-flight** (preventive) — before opening a build round on a domain, `--check`
   it so the round designs against the real current state, not a stale doc.

**When it does NOT run:** during a normal in-scope DCFBI/DFCFBI round on the domain being
built — that round's Design phase already syncs its own doc by construction, so running sync
there is redundant double-work.

**Deferred (named trigger):** a git/CI path-coupling gate that auto-flags a change touching a
domain's code but not its design doc. Useful, but new standing mechanism — add it only when a
real drift slips past the on-demand / post-round `--check` (the Evolution Rule + the brake).

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

**Which layer owns which fact — and why BE is not optional.** Assign each doc claim to the
layer that actually owns it, and never sync a server claim from FE+Contract alone:

- **Contract** is the *declared* interface (routes, request/response shapes, declared codes) —
  the fast, structured spine. But it is **not self-certifying**: it states what *should* be,
  not what *is*. Treat contract↔BE disagreement as a finding, not a tie.
- **BE** is the *behavioural* truth and is **required** for any persistence / model / schema /
  constraint / cascade / uniqueness claim **and for the error codes actually emitted**. These
  are invisible to the contract and the FE (e.g. a `422` declared with a code but emitted as a
  plain `detail[]` with none; `status` computed-on-read vs stored; SQLModel+Alembic vs raw
  SQL; global vs per-workspace uniqueness; block-not-cascade delete). Skipping BE means
  trusting the contract is faithfully implemented — which is exactly the drift being hunted.
- **FE** owns the UI facts the other two cannot show: which surfaces/components exist and
  **where they live** (`@mdd/ui` vs feature-local), hooks / query keys / invalidations,
  navigation, client-side validation.

The only doc that can be synced from FE+Contract alone is a **pure-UI** surface with no server
claims — rare in this corpus. BE need not be read line-by-line: use the contract as the spine,
then read the handlers to *confirm* it and to fill the persistence/behaviour facts it can't carry.

For a large domain, delegate this read to a subagent (`Agent`) so the raw code stays out
of context and you keep the structured map. Tell it: *read the real code, trust no design
doc, quote exact identifiers, flag anything half-migrated or inconsistent across
contract/backend/frontend.*

### 3. Diff → drift report  _(`--check` mode stops here)_

For each doc, diff its claims against the CODE TRUTH map. Record every gap as
**doc says X / code does Y**, categorised: stale field name; vanished / added route or
error code; surface that moved (e.g. `@mdd/ui` → feature-local); behaviour frozen at an
old round; a "deferred" item that has since shipped; a resolved "open question". Write
the drift report into the invoking round's Do log (or `.agents/tmp/design-sync/`) — it is
the auditable evidence that the sync happened and what changed. **In `--check` mode, also
stamp the out-of-sync marker** (§ Drift marker) on each drifted doc, then stop here.

### 4. Reconcile each doc to the code

Rewrite each doc to the CODE TRUTH, applying the keep/delete boundary. The result reads as
documentation of the **current** app: present-tense spec, real identifiers, real routes
and error codes, real component homes — plus the living rationale, de-attributed. No
ledger. Keep the design-doc format conventions (status header · surface-declaration table
with the canonical Reusability/Purity tokens · token map citing
[`themeTokens.ts`](../../../workspace/packages/ui/src/themeTokens.ts) · scope boundary ·
acceptance criteria) — see the [design README](../../design/README.md).

**A mermaid diagram is code-owned too.** A `stateDiagram` / `sequenceDiagram` is a drift
surface — its states, branches, and **error codes** are facts the handlers own (e.g. a
declare-flow diagram's `409` / `422` branch labels). **Sync the diagram, not only the
prose.** And honour the convention on *whether* a doc should have one: a diagram earns its
place only for a genuine **state machine** — >3 interactive states, conditional error-branches
(`201 | 409 | 422`), or back-edges/loops (the `flow-selector` cond-1 bar); `sequenceDiagram`
when cross-actor order matters. A flat set of **independent render-states**
(loading/empty/populated/error), a linear happy-path, spatial layout (→ ASCII), or a flow
**owned by a sibling doc** stays prose/bullets. **Don't invent** a diagram where prose
suffices (brake), and **drop** one that shows superseded states.

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
- **Clear the out-of-sync marker** (banner + sentinel, § Drift marker) from each doc just
  synced — a synced doc carries no marker; its absence is the in-sync signal.

## Brake — does this skill earn its place?

The skill counters a **named failure mode**: design docs silently drift from the
implementation and accrete a round-ledger, so the "intent-before-code" corpus stops
describing the code. It is **human-invoked, never an automatic sweep**. Its output is also
its own brake: once a domain is synced, the durable convention *design docs are source
code, not history* tells every future round to **re-sync / amend in place**, never append
a stamp — so a domain whose docs are kept current round-by-round does not need this skill.
The code being the source of truth bounds the skill: it reconciles to reality, it cannot
invent. Run it per `design/<domain>`; it generalises unchanged across domains.
