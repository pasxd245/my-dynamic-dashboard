from contextlib import asynccontextmanager
from typing import AsyncIterator

import duckdb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app._config import CONFIG
from app.db import bootstrap_schema
from app.routers import datasets, uploads, workspaces


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    bootstrap_schema()
    yield


app = FastAPI(title="my-dynamic-dashboard backend", lifespan=lifespan)

# R13: first time the backend serves the browser. The builder dev
# server runs on :3000; restrict to that until a staging/prod origin
# enters the picture.
# R26 (post-merge fix): added PATCH + DELETE to allow_methods.
# R28: allow_origins now reads from CONFIG (values.yaml +
# MDD_CONFIG_FILE override + MDD_BACKEND__CORS_ALLOW_ORIGINS env var)
# instead of being hardcoded. allow_methods stays inline — it's
# protocol-level, not deployment-config.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CONFIG.settings.backend.cors_allow_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

app.include_router(workspaces.router)
app.include_router(uploads.router)
app.include_router(datasets.router)


@app.get("/health")
def health() -> dict[str, str]:
    with duckdb.connect(":memory:") as con:
        version = con.execute("SELECT version()").fetchone()[0]
    return {"status": "ok", "duckdb": version}
