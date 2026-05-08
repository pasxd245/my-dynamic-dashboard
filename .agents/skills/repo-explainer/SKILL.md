---
name: repo-explainer
description: Explain a repository (or a slice of one) using Mermaid diagrams + short narrative. Use when the user asks "how does this work?", "walk me through X", or needs an onboarding view of a subsystem. Produces component, sequence, and flow diagrams that render natively in GitHub and VS Code.
metadata:
  author: a2scaffold
  version: '1.0'
---

# repo-explainer

## Trigger

Activate this skill when the user asks for any of:

- An overview of the repo or a subsystem ("how does upload work?",
  "explain the query builder", "walk me through schema versioning").
- A walkthrough of a specific flow ("what happens when I run
  a report export?").
- Onboarding material for a new contributor.

Do **not** activate for narrow code questions ("what does this
function return?") — answer those directly.

## Why Mermaid, not strict UML

Mermaid diagrams-as-code render inline in GitHub, VS Code, and most
markdown viewers without a toolchain. Strict UML (PlantUML, 14-diagram
spec) is heavier than this repo needs. Stick to the four Mermaid
diagram types below.

## Procedure

### 1. Scope the explanation

Ask (or infer from the question):

- **Depth:** 10,000-ft overview, or a specific flow?
- **Audience:** new contributor, or someone debugging a specific
  subsystem?
- **Output location:** inline chat reply, or a file under
  `docs/`?

If you cannot answer these from context, ask one clarifying question
before drawing.

### 2. Read the relevant code first

Never diagram from assumptions. For each subsystem mentioned, read
the entry points and follow the call graph one level deep. At
minimum:

- Entry point (e.g. FastAPI router, React route/component, Streamlit page,
  script, or service module)
- The concern files it dispatches to
- Any shared helpers, API clients, models, schemas, or storage adapters

### 3. Pick the diagram type

| Question the user is asking  | Diagram type            |
| ---------------------------- | ----------------------- |
| "What are the pieces?"       | `flowchart` (component) |
| "What happens when I run X?" | `sequenceDiagram`       |
| "What are the states?"       | `stateDiagram-v2`       |
| "How does data move?"        | `flowchart LR`          |

Use **one** diagram per question. If the answer truly needs two,
write two — but never stack three+ diagrams in one reply; split into
sections.

### 4. Draw

Template — component view:

````markdown
```mermaid
flowchart TD
  Builder[apps/builder upload UI] --> API[apps/backend upload API]
  API --> ETL[Polars schema detection]
  ETL --> Parquet[data/parquet version]
  ETL --> Metadata[SQLite metadata]
  Metadata --> Builder
```
````

Template — sequence view:

````markdown
```mermaid
sequenceDiagram
  participant User
  participant Builder as React builder
  participant API as FastAPI backend
  participant DuckDB
  participant Export as Excel/CSV export
  User->>Builder: run saved report
  Builder->>API: query config
  API->>DuckDB: generated SQL over Parquet
  DuckDB-->>API: result frame
  API->>Export: format result
  Export-->>User: downloadable file
```
````

Rules:

- Node labels are **file paths** or **function names** from the
  current code — not invented abstractions.
- Keep ≤ 12 nodes per diagram. If it doesn't fit, the scope is too
  wide — split.
- No colors, no theming — let the viewer's renderer handle it.

### 5. Add a short narrative

After the diagram, write 3–6 bullets: what happens, in what order,
and where to look in the code. Each bullet ends with a clickable
file reference, e.g. `see [apps/backend/app/api/upload.py:42](apps/backend/app/api/upload.py#L42)`.

Do **not** restate the diagram in prose — the diagram is the
picture, the bullets are the captions.

### 6. Regenerate, don't cache

Diagrams drift from code fast. When asked about a subsystem that
was diagrammed before:

1. Re-read the current code.
2. Regenerate from scratch.
3. If a diagram file already exists under `docs/`, regenerate the full content
   so it reflects current code. For `docs/agents/`, ask for confirmation before
   writing because that area is human-owned governance/reference material.

## Output locations

| Request shape                | Where to put the output                                       |
| ---------------------------- | ------------------------------------------------------------- |
| Conversational "explain X"   | Reply inline in chat                                          |
| "Add a docs page for X"      | `docs/diagrams/<name>.md`                                     |
| "Update the README overview" | Edit the relevant README section                              |
| "Update agent workflow docs" | Propose patch under `docs/agents/` and confirm before writing |

## Anti-patterns

- ❌ Drawing from memory of what the code "probably" does.
- ❌ Using UML-specific syntax (`<<interface>>`, lifelines with
  activation bars) — Mermaid has its own conventions.
- ❌ One mega-diagram of the whole repo. Pick a slice.
- ❌ Copying a diagram from an older doc without re-reading the code.
