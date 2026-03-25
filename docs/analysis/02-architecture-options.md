# Architecture Options

## Option 1: Processing Bridge

Use Python plus an analytical database engine to process uploads and export summarized results back to Excel.

### Shape

- upload Excel files
- infer basic schema
- register tables in an analytical engine
- define relationships in config or metadata
- run report queries
- export result files

### Strengths

- fastest way to remove Excel as the computation bottleneck
- low implementation complexity
- directly supports the current workflow

### Weaknesses

- limited self-service UX
- relationship handling may remain technical at first

## Option 2: Metadata-Driven Analytics App

Add a web app layer that manages uploaded files, schema metadata, relationships, and report generation.

### Shape

- file upload UI
- schema preview
- relationship definition UI
- report builder
- export and dashboard outputs

### Strengths

- aligns with the long-term product direction
- makes dynamic joins accessible without writing SQL

### Weaknesses

- much larger scope
- UI complexity arrives before the data engine is proven

## Option 3: Visual Relationship Builder First

Prioritize graph-based relationship modeling and interactive report composition.

### Strengths

- compelling UX
- strong product differentiation

### Weaknesses

- high complexity too early
- risks solving presentation before solving throughput and reliability

## Recommended Sequence

Option 1 should come first, with a clean path into Option 2.

```mermaid
flowchart LR
    A[Option 1: Processing Bridge] --> B[Option 2: Metadata-Driven App]
    B --> C[Option 3: Visual Relationship Builder]
```

## Suggested Technical Direction

### Data layer

- analytical store for query execution
- metadata store for uploads, columns, and relationships

### Application layer

- Python-based ETL and query engine first
- web UI second

### Output layer

- Excel export first
- dashboard rendering later

## Why This Direction Fits The Draft

The draft repeatedly returns to one urgent reality: Excel is too slow on large relationship-heavy data. That means the architecture should first solve:

- data loading
- joins
- aggregations
- output generation

before spending effort on rich UI mechanics.
