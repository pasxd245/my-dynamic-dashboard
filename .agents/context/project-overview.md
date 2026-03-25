# Project Overview: my-dynamic-dashboard

## What This Is

A lightweight analytics platform that replaces a broken Excel workflow.
The CRM lacks reporting features, Excel crashes on 100k+ rows, and the
dev team cannot help. This project bridges that gap.

**Name rationale**: *my* (personal/team problem) + *dynamic* (adapts to
changing schemas) + *dashboard* (end goal is insights).

---

## The Problem in One Sentence

> Excel is doing too many jobs at once (storage, transformation, joins,
> aggregation, presentation) and is failing at all of them as data grows
> past 100k rows.

For the full problem decomposition, root causes, and framing:
**[docs/analysis/00-problem.md](../../docs/analysis/00-problem.md)**

---

## Architecture at a Glance

```
React Builder  ──┐
                  ├──▶  FastAPI Backend  ──▶  DuckDB + Polars + SQLite + Parquet
Streamlit Dash ──┘
```

Three layers, each doing what it does best:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Backend** | FastAPI + Polars + DuckDB + SQLite | Data processing, schema management, query execution, API |
| **Builder** | React + TanStack + React Flow | File upload, visual relationship builder, query builder |
| **Dashboard** | Streamlit + Pandas + Plotly | Report viewing, charts, Excel export |

The backend is the single source of truth. Both frontends consume its REST API.

For tech stack rationale and comparisons:
**[docs/analysis/04-tech-stack.md](../../docs/analysis/04-tech-stack.md)**

---

## Data Layer: Three Tools, Clear Roles

| Tool | Role | Handles |
|------|------|---------|
| **Polars** | ETL | Read Excel/CSV, clean data, detect schemas, write Parquet |
| **DuckDB** | Query engine | Execute SQL joins/aggregations over Parquet files |
| **SQLite** | Metadata | Track files, schemas, versions, relationships, saved configs |
| **Parquet** | Storage | Versioned data files; DuckDB queries them directly |

Schema evolution is handled by versioned Parquet files. Each upload
creates a new version; DuckDB unions them with `union_by_name=true`.
Broken relationships are auto-detected when columns disappear.

For full data architecture and schema evolution design:
**[docs/analysis/05-data-layer.md](../../docs/analysis/05-data-layer.md)**

---

## Query Flow

```
User builds query in React UI
    ↓  JSON config
SQL Translator converts to DuckDB SQL
    ↓  SQL string
DuckDB executes against Parquet files
    ↓  Result DataFrame
Pandas renders in Streamlit / exports to Excel
```

Polars is NOT used for joins. SQL is simpler to generate, debug, and
maintain. Polars is reserved for ETL where it excels.

---

## Key Design Decisions

1. **Builder first, dashboard second.** Without uploaded data and
   defined relationships, there is nothing to visualize.

2. **Excel output is the first delivery format.** Users already know
   Excel. The system offloads heavy processing, then hands back a
   manageable result file.

3. **Relationships are central and not fixed.** Join paths change per
   report. The system uses a graph (networkx) to find shortest join
   paths between any two tables.

4. **Schema flexibility over rigidity.** New columns appear when the
   CRM changes. The system detects, versions, and flags affected
   relationships rather than rejecting the upload.

5. **AI features come last.** The draft explicitly warns against
   building AI workflow generation before the data pipeline is proven
   and users are running pre-built reports.

For requirements breakdown:
**[docs/analysis/01-requirements.md](../../docs/analysis/01-requirements.md)**

For architecture options considered:
**[docs/analysis/02-architecture-options.md](../../docs/analysis/02-architecture-options.md)**

---

## MVP Strategy

Two milestones, each delivering standalone value:

### MVP 1: Core Engine (Weeks 1-3)

Upload data, build relationships visually, query with SQL generation,
export to Excel/CSV.

**Success test**: "Can I process 100k+ rows and export a weekly report
in 30 seconds instead of 3 hours?"

### MVP 2: Production Ready (Weeks 4-6)

Streamlit dashboard, saved query configurations, visualizations,
deployment with Docker.

**Success test**: "Can a colleague access this via URL and run a report
without my help?"

For detailed week-by-week plan, monorepo structure, and risk management:
**[docs/analysis/09-mvp-plan.md](../../docs/analysis/09-mvp-plan.md)**

For phased roadmap overview:
**[docs/analysis/03-roadmap.md](../../docs/analysis/03-roadmap.md)**

---

## Future Layers (Post-MVP)

These are documented but explicitly deferred:

- **AI workflow engine**: Export metadata to AI, generate YAML workflows,
  human review before deployment.
  See **[docs/analysis/06-ai-workflow-engine.md](../../docs/analysis/06-ai-workflow-engine.md)**

- **Business-tech collaboration model**: Structured request format,
  business submits WHAT, tech reviews HOW, AI bridges the gap.
  See **[docs/analysis/07-collaboration-model.md](../../docs/analysis/07-collaboration-model.md)**

- **Evolutionary approach**: Just-in-time feature philosophy, Polars/DuckDB/Pandas
  division of labor, what NOT to build prematurely.
  See **[docs/analysis/08-evolutionary-approach.md](../../docs/analysis/08-evolutionary-approach.md)**

---

## Monorepo Structure

```
my-dynamic-dashboard/
├── packages/
│   ├── backend/          # FastAPI + Polars + DuckDB + SQLite
│   ├── builder/          # React + TanStack + React Flow
│   └── dashboard/        # Streamlit + Pandas (MVP 2)
├── data/                 # gitignored: parquet/, metadata.db
├── docs/analysis/        # 10 analysis documents (00 through 09)
├── .agents/              # AI agent context, memory, prompts
├── scripts/              # dev.sh, stop.sh, clean.sh
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## Analysis Document Index

| Doc | Topic |
|-----|-------|
| [00-problem.md](../../docs/analysis/00-problem.md) | Problem decomposition, constraints, two product directions |
| [01-requirements.md](../../docs/analysis/01-requirements.md) | Functional/non-functional requirements, risks, MVP acceptance |
| [02-architecture-options.md](../../docs/analysis/02-architecture-options.md) | Three architecture options compared, recommended sequence |
| [03-roadmap.md](../../docs/analysis/03-roadmap.md) | Four-phase delivery roadmap |
| [04-tech-stack.md](../../docs/analysis/04-tech-stack.md) | FastAPI + React + Streamlit decision, stack details |
| [05-data-layer.md](../../docs/analysis/05-data-layer.md) | DuckDB + SQLite + Parquet, schema evolution strategy |
| [06-ai-workflow-engine.md](../../docs/analysis/06-ai-workflow-engine.md) | AI-generated YAML workflows, execution engine |
| [07-collaboration-model.md](../../docs/analysis/07-collaboration-model.md) | Business-tech bridge, roles, request workflow |
| [08-evolutionary-approach.md](../../docs/analysis/08-evolutionary-approach.md) | Just-in-time features, Polars/DuckDB/Pandas roles |
| [09-mvp-plan.md](../../docs/analysis/09-mvp-plan.md) | Two-MVP plan, week-by-week breakdown, deployment |

---

## Domain Context

- **Industry**: Telesales insurance
- **Reporting cadence**: Weekly and monthly
- **Data source**: CRM exports (Excel files)
- **Data volume**: 100k+ rows, growing
- **Users**: Technical PM (builder/maintainer), sales managers (report consumers)
- **Current pain**: Manual export → Power Query → Pivot → slow/crash cycle
