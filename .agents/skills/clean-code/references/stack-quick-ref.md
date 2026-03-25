# Stack Quick Reference

Cheat sheet for the project's tech stack. Refer to `SKILL.md` for
conventions; this file is for quick lookup of versions and imports.

## Backend (Python)

```txt
fastapi        → API framework
polars         → ETL, schema detection, Parquet I/O
duckdb         → SQL query execution over Parquet
sqlite3        → Metadata storage (stdlib)
pydantic       → Request/response models
pyarrow        → Parquet support
networkx       → Relationship graph traversal
openpyxl       → Excel read/write
pyyaml         → Config / workflow definitions
python-dotenv  → Environment variable loading
```

### Common imports (backend)

```python
# FastAPI
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field

# Polars
import polars as pl

# DuckDB
import duckdb

# SQLite
import sqlite3
import json
from pathlib import Path
```

## Builder (TypeScript / React)

```txt
react            → UI framework
@tanstack/react-query    → Server state (API calls)
@tanstack/react-router   → File-based routing
@tanstack/react-table    → Sortable/filterable tables
reactflow        → Visual relationship graph
axios            → HTTP client
zustand          → Local state (if needed)
tailwindcss      → Utility-first styling
lucide-react     → Icons
clsx             → Conditional class names
vite             → Build tool
```

### Common imports (builder)

```tsx
// TanStack Query
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// TanStack Router
import { createFileRoute, useNavigate } from '@tanstack/react-router'

// TanStack Table
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table'

// React Flow
import ReactFlow, { Node, Edge, Background, Controls } from 'reactflow'
import 'reactflow/dist/style.css'

// Utilities
import { clsx } from 'clsx'
import { Upload, Database, Link, Search } from 'lucide-react'
```

## Dashboard (Python / Streamlit)

```txt
streamlit   → Dashboard framework
pandas      → DataFrame display and export
plotly      → Interactive charts (px.bar, px.line, px.scatter)
requests    → Call backend API
openpyxl    → Excel export
pyarrow     → Read Parquet results
```

### Common imports (dashboard)

```python
import streamlit as st
import pandas as pd
import plotly.express as px
import requests
import io
```

## Data files

| Type | Location | Format |
|------|----------|--------|
| Raw uploads | Converted on ingest | Excel / CSV |
| Stored data | `data/parquet/{file_id}/v{n}.parquet` | Parquet (zstd) |
| Metadata | `data/metadata.db` | SQLite |
| Query results | `results/{result_id}.parquet` | Parquet |
